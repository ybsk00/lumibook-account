"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

const PARSE_PROMPT = `너는 한국 재무상태표(대차대조표) PDF를 분석하는 전문가다.

아래 텍스트는 홈택스 또는 회계프로그램에서 출력된 재무상태표 PDF의 내용이다.
각 계정과목의 금액을 추출하여 아래 JSON 배열 형식으로만 응답해라 (마크다운/설명 없이).

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
2. 계정명이 정확히 일치하지 않아도 유사하면 매핑 (예: "현금및현금성자산" → 101)
3. 소계/합계 행은 무시하고 개별 계정만 추출
4. 감가상각누계액(157)은 양수로 추출
5. 금액이 0이거나 없는 계정은 제외

## 응답 형식
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

    // Gemini에 PDF를 inline_data로 전송
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`,
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
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API 오류: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      throw new Error("AI 응답에서 JSON을 추출할 수 없습니다.");
    }

    return [];
  },
});
