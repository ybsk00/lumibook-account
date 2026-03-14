"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

const BATCH_SYSTEM_PROMPT = `너는 한국 기업회계기준(K-GAAP)에 따른 복식부기 분개 전문가다.
주식회사 루미브리즈는 AI/소프트웨어 개발 법인이다.

## 규칙
1. 반드시 차변 합계 = 대변 합계 (대차균형)
2. 입금 거래: 보통예금(102) 차변 / 해당 수익·부채 계정 대변
3. 출금 거래: 해당 비용·자산 계정 차변 / 보통예금(102) 대변
4. 과세 거래는 부가세 10% 자동 분리:
   - 매출: 부가세예수금(207) 대변
   - 매입: 부가세대급금(113) 차변
5. 면세 거래: 급여, 이자, 4대보험, 보험료, 세금 → 부가세 분리 안함
6. 거래처명이 있으면 등록 거래처에서 매칭
7. 100만원 이상 장비/비품 구매는 비품(156), 미만은 소모품비(524)

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
    const context = await ctx.runQuery(api.bankUpload.getClassificationContext);

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
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`,
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
