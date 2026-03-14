import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// NextAuth 로그인 검증용 엔드포인트
http.route({
  path: "/auth/verify",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const { email } = await request.json();

    const user = await ctx.runQuery(api.auth.getUserByEmail, { email });

    if (!user) {
      return new Response(JSON.stringify({ error: "사용자를 찾을 수 없습니다." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        id: user._id,
        email: user.email,
        name: user.name,
        companyName: user.companyName,
        passwordHash: user.passwordHash,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }),
});

export default http;
