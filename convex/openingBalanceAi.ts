"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

const PARSE_PROMPT = `너는 한국 표준재무제표(재무상태표/대차대조표) PDF를 분석하는 전문가다.

아래 PDF는 홈택스에서 다운로드한 표준재무제표다.
각 계정과목의 기말 금액을 추출하여 JSON 배열 형식으로만 응답해라 (마크다운 코드블록, 설명, 부가 텍스트 없이 순수 JSON만).

## K-GAAP 계정코드 매핑
101=현금, 102=보통예금, 103=정기예금, 108=외상매출금, 109=받을어음,
110=미수금, 111=선급금, 112=선급비용, 113=부가세대급금, 114=가지급금,
115=단기대여금, 120=재고자산, 151=토지, 152=건물, 153=구축물,
154=기계장치, 155=차량운반구, 156=비품, 157=감가상각누계액, 160=무형자산,
161=영업권, 170=장기투자증권, 171=장기대여금, 172=임차보증금,
201=외상매입금, 202=지급어음, 203=미지급금, 204=미지급비용, 205=선수금,
206=예수금, 207=부가세예수금, 208=단기차입금, 209=유동성장기부채, 210=미지급법인세,
251=장기차입금, 252=사채, 253=퇴직급여충당부채, 254=임대보증금,
301=자본금, 311=자본잉여금, 321=이익잉여금, 322=이월이익잉여금, 331=자본조정

## 규칙
1. 금액은 원 단위 정수 (콤마 제거)
2. 계정명이 정확히 일치하지 않아도 유사하면 매핑 (예: "현금및현금성자산" → 101, "단기금융상품" → 103)
3. 소계/합계/총계 행은 무시하고 개별 계정만 추출
4. 감가상각누계액(157)은 양수로 추출 (차감 항목이지만 금액 자체는 양수)
5. 금액이 0이거나 없는 계정은 제외
6. "당기" 또는 "기말" 금액을 추출 ("전기" 또는 "기초"는 무시)
7. 여러 페이지에 걸친 재무제표도 모두 파싱
8. 결손금(미처리결손금, 미처분이익잉여금이 음수)은 반드시 음수로 반환 (예: -116,382,981)
9. 감가상각누계액이 여러 개 있으면 합산하여 157 하나로 반환
10. 시설장치, 기계장치 → 154, 비품 → 156, 구축물 → 153으로 매핑

## 응답 형식 (순수 JSON 배열만 — 마크다운 없이)
[
  { "code": "102", "name": "보통예금", "amount": 50000000 },
  { "code": "172", "name": "임차보증금", "amount": 30000000 }
]`;

export const parseBalanceDocument = action({
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
      // 마크다운 코드블록 제거 후 JSON 추출
      const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(parsed)) {
          throw new Error("파싱 결과가 배열이 아닙니다.");
        }
        // 유효성 검증 (음수도 허용 — 결손금 등)
        return parsed.filter(
          (item: { code?: string; amount?: number }) =>
            item.code && typeof item.amount === "number" && item.amount !== 0
        );
      }
    } catch (parseErr) {
      const preview = text.slice(0, 300);
      throw new Error(
        `AI 응답에서 JSON을 추출할 수 없습니다.\n응답 미리보기: ${preview}`
      );
    }

    throw new Error("AI 응답에서 계정 데이터를 찾을 수 없습니다. PDF 형식을 확인해주세요.");
  },
});
