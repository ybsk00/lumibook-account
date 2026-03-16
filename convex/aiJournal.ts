"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

const SYSTEM_PROMPT = `너는 한국 기업회계기준(K-GAAP)에 따른 복식부기 분개 전문가다.
주식회사 루미브리즈는 AI/소프트웨어 개발 법인이다.

## 규칙
1. 반드시 차변 합계 = 대변 합계 (대차균형)
2. 과세 거래는 부가세 10% 자동 분리 (공급가액 + 세액)
   - 매출: 부가세예수금(207) 대변
   - 매입: 부가세대급금(113) 차변
3. 면세 거래: 급여, 이자, 4대보험, 보험료 → 부가세 분리 안함
4. 입금 = 보통예금(102) 차변 / 출금 = 보통예금(102) 대변
5. 거래처명이 입력 내용에 포함되면 등록 거래처에서 매칭
6. 100만원 이상 장비/비품 구매는 비품(156)으로, 미만은 소모품비(524)로 처리
7. 결과는 아래 JSON 형식으로만 응답 (마크다운/설명 없이):

{
  "journalType": "매출",
  "entries": [
    {
      "accountCode": "102",
      "accountName": "보통예금",
      "debitAmount": 22000000,
      "creditAmount": 0,
      "partnerName": null,
      "description": "입금"
    }
  ],
  "reasoning": "판단 근거 설명"
}`;

export const generateJournal = action({
  args: {
    userId: v.id("users"),
    type: v.string(),
    amount: v.number(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const accounts = await ctx.runQuery(api.accounts.list, {
      userId: args.userId,
      activeOnly: true,
    });
    const accountList = accounts
      .map((a: { code: string; name: string; category: string; subCategory: string }) =>
        `${a.code} ${a.name} (${a.category}/${a.subCategory})`)
      .join("\n");

    const partners = await ctx.runQuery(api.partners.list, {
      userId: args.userId,
      activeOnly: true,
    });
    const partnerList = partners
      .map((p: { name: string; businessNumber: string }) => `${p.name} (${p.businessNumber})`)
      .join("\n");

    const examples = await ctx.runQuery(api.aiJournalExamples.getExamples, {
      userId: args.userId,
    });
    const exampleText = examples
      .slice(0, 20)
      .map(
        (ex: { inputType: string; inputDescription: string; resultEntries: unknown }) =>
          `입력: ${ex.inputType} ${ex.inputDescription}\n결과: ${JSON.stringify(ex.resultEntries)}`
      )
      .join("\n\n");

    const fullPrompt = `${SYSTEM_PROMPT}

## 사용 가능한 계정과목
${accountList}

## 등록된 거래처
${partnerList || "(없음)"}

## 과거 승인된 분개 예시
${exampleText || "(없음)"}

## 사용자 입력
구분: ${args.type}
금액: ${args.amount}원
내용: ${args.description}`;

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_AI_API_KEY가 설정되지 않았습니다.");
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API 오류: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("AI 응답에서 JSON을 추출할 수 없습니다.");
    }

    const result = JSON.parse(jsonMatch[0]);

    const totalDebit = result.entries.reduce(
      (sum: number, e: { debitAmount: number }) => sum + e.debitAmount, 0
    );
    const totalCredit = result.entries.reduce(
      (sum: number, e: { creditAmount: number }) => sum + e.creditAmount, 0
    );

    if (totalDebit !== totalCredit) {
      throw new Error(`AI 분개 대차불균형: 차변 ${totalDebit} ≠ 대변 ${totalCredit}`);
    }

    return result;
  },
});
