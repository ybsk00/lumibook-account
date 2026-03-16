"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

const BATCH_SYSTEM_PROMPT = `너는 한국 기업회계기준(K-GAAP)에 따른 복식부기 분개 전문가다.
주식회사 루미브리즈는 AI/소프트웨어 개발 법인이다.

## 핵심 원칙: 은행 거래는 현금 이동만 기록한다
- 매출/매입은 세금계산서 발행 시 이미 기록되어 있다
- 은행 입금은 외상매출금(108) 회수이지, 새로운 매출이 아니다
- 은행 출금 중 거래처 대금 지급은 외상매입금(201) 상환이다

## 규칙
1. 반드시 차변 합계 = 대변 합계 (대차균형)
2. 고객으로부터 입금: 보통예금(102) 차변 / 외상매출금(108) 대변 (부가세 분리 안함)
3. 거래처에 대금 지급: 외상매입금(201) 차변 / 보통예금(102) 대변 (부가세 분리 안함)
4. 직접 비용 출금 (임차료, 통신비 등): 해당 비용 계정 차변 / 보통예금(102) 대변
5. 과세 직접 비용은 부가세 10% 자동 분리: 부가세대급금(113) 차변
6. 면세 거래: 급여, 이자, 4대보험, 보험료, 세금 → 부가세 분리 안함
7. 이자 입금: 보통예금(102) 차변 / 이자수익(451) 대변
8. 100만원 이상 장비/비품 구매는 비품(156), 미만은 소모품비(524)
9. 절대로 입금을 매출(401/402/403/404) 계정으로 분류하지 마라 → 외상매출금(108) 사용

## 응답 형식
반드시 아래 JSON 배열로만 응답 (마크다운/설명 없이):
[
  {
    "id": "tx-1",
    "journalType": "출금",
    "counterAccountCode": "518",
    "counterAccountName": "임차료",
    "partnerName": null,
    "vatSeparation": true,
    "reasoning": "판단 근거"
  }
]

id는 입력의 id와 동일하게 매칭해라.
counterAccountCode/counterAccountName은 보통예금(102) 상대편 계정이다.
vatSeparation이 true이면 시스템이 자동으로 공급가액/세액을 분리한다.`;

export const classifyBatch = action({
  args: {
    userId: v.id("users"),
    transactions: v.array(
      v.object({
        id: v.string(),
        date: v.string(),
        description: v.string(),
        deposit: v.number(),
        withdrawal: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(api.bankUpload.getClassificationContext, {
      userId: args.userId,
    });

    const accountList = context.accounts
      .map((a: { code: string; name: string; category: string; subCategory: string }) =>
        `${a.code} ${a.name} (${a.category}/${a.subCategory})`)
      .join("\n");

    const partnerList = context.partners
      .map((p: { name: string; businessNumber: string }) => `${p.name} (${p.businessNumber})`)
      .join("\n");

    const exampleText = context.examples
      .slice(0, 20)
      .map((ex: { inputType: string; inputDescription: string; resultEntries: unknown }) =>
        `입력: ${ex.inputType} ${ex.inputDescription}\n결과: ${JSON.stringify(ex.resultEntries)}`)
      .join("\n\n");

    // 30건씩 배치 처리
    const BATCH_SIZE = 30;
    const allResults: {
      id: string;
      journalType: string;
      counterAccountCode: string;
      counterAccountName: string;
      partnerName: string | null;
      vatSeparation: boolean;
      reasoning: string;
    }[] = [];

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_AI_API_KEY가 설정되지 않았습니다.");
    }

    for (let i = 0; i < args.transactions.length; i += BATCH_SIZE) {
      const batch = args.transactions.slice(i, i + BATCH_SIZE);

      const txList = batch.map((tx) => {
        const type = tx.deposit > 0 ? "입금" : "출금";
        const amount = tx.deposit > 0 ? tx.deposit : tx.withdrawal;
        return `- id: ${tx.id}, 구분: ${type}, 금액: ${amount}원, 적요: "${tx.description}", 날짜: ${tx.date}`;
      }).join("\n");

      const fullPrompt = `${BATCH_SYSTEM_PROMPT}

## 사용 가능한 계정과목
${accountList}

## 등록된 거래처
${partnerList || "(없음)"}

## 과거 승인된 분개 예시
${exampleText || "(없음)"}

## 분류할 거래 목록
${txList}`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 4096,
            },
          }),
        }
      );

      if (!response.ok) {
        console.error(`Gemini API error: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          allResults.push(...parsed);
        }
      } catch {
        console.error("Failed to parse Gemini batch response");
      }
    }

    return allResults;
  },
});
