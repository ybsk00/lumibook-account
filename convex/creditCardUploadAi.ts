"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

const PARSE_PROMPT = `너는 한국 사업용신용카드 매입세액 공제 내역서 PDF를 분석하는 전문가다.

아래 PDF는 홈택스에서 다운로드한 사업용신용카드 사용 내역이다.
월별 결제금액, 부가세, 합계를 추출하여 JSON 배열 형식으로만 응답해라 (마크다운 코드블록, 설명, 부가 텍스트 없이 순수 JSON만).

## 규칙
1. 금액은 원 단위 정수 (콤마 제거)
2. period는 "YYYY-MM" 형식
3. 소계/합계/총계 행은 무시하고 개별 월별 데이터만 추출
4. 금액이 0인 월은 제외
5. "상반기", "하반기" 합계 행도 무시
6. 결제기간이 월 단위가 아니라 범위(예: "01월~03월")인 경우, 각 월로 균등 분할하지 말고 해당 범위의 첫 번째 월로 기록

## 응답 형식 (순수 JSON 배열만 — 마크다운 없이)
[
  { "period": "2025-01", "paymentAmount": 1000000, "vatAmount": 100000, "totalAmount": 1100000 },
  { "period": "2025-02", "paymentAmount": 2000000, "vatAmount": 200000, "totalAmount": 2200000 }
]`;

export const parseCreditCardPdf = action({
  args: {
    base64Pdf: v.string(),
  },
  handler: async (ctx, args) => {
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
          contents: [
            {
              parts: [
                { text: PARSE_PROMPT },
                {
                  inline_data: {
                    mime_type: "application/pdf",
                    data: args.base64Pdf,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`Gemini API 오류: ${response.status} ${errorBody.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!text) {
      throw new Error("AI 응답이 비어있습니다. PDF 형식을 확인해주세요.");
    }

    try {
      const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(parsed)) {
          throw new Error("파싱 결과가 배열이 아닙니다.");
        }
        return parsed.filter(
          (item: { period?: string; totalAmount?: number }) =>
            item.period && typeof item.totalAmount === "number" && item.totalAmount > 0
        );
      }
    } catch (parseErr) {
      const preview = text.slice(0, 300);
      throw new Error(
        `AI 응답에서 JSON을 추출할 수 없습니다.\n응답 미리보기: ${preview}`
      );
    }

    throw new Error("AI 응답에서 카드 사용 데이터를 찾을 수 없습니다. PDF 형식을 확인해주세요.");
  },
});
