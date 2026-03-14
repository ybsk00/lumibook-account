"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import bcrypt from "bcryptjs";

export default function SignUpPage() {
  const register = useMutation(api.auth.register);
  const seedAccounts = useMutation(api.seed.seedAccounts);

  const [form, setForm] = useState({
    email: "",
    password: "",
    passwordConfirm: "",
    name: "",
    companyName: "",
    businessNumber: "",
    businessType: "",
    businessItem: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.email || !form.password || !form.name || !form.companyName) {
      setError("필수 항목을 모두 입력해주세요.");
      return;
    }

    if (form.password !== form.passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    if (form.password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    setLoading(true);

    try {
      const passwordHash = await bcrypt.hash(form.password, 12);

      const userId = await register({
        email: form.email,
        passwordHash,
        name: form.name,
        companyName: form.companyName,
        businessNumber: form.businessNumber || "000-00-00000",
        businessType: form.businessType || undefined,
        businessItem: form.businessItem || undefined,
      });

      // 기본 계정과목 시드
      await seedAccounts({ userId });

      // 자동 로그인
      await signIn("credentials", {
        email: form.email,
        password: form.password,
        callbackUrl: "/dashboard",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "회원가입에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6 p-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">LumiBooks</h1>
          <p className="text-muted-foreground">법인 회계시스템 회원가입</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3 border rounded-lg p-4">
            <p className="text-sm font-medium text-muted-foreground">계정 정보</p>
            <div className="space-y-1">
              <Label>이메일 *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="admin@company.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>비밀번호 *</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="6자 이상"
                />
              </div>
              <div className="space-y-1">
                <Label>비밀번호 확인 *</Label>
                <Input
                  type="password"
                  value={form.passwordConfirm}
                  onChange={(e) => setForm({ ...form, passwordConfirm: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 border rounded-lg p-4">
            <p className="text-sm font-medium text-muted-foreground">회사 정보</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>회사명 *</Label>
                <Input
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  placeholder="주식회사 루미브리즈"
                />
              </div>
              <div className="space-y-1">
                <Label>대표자명 *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="유범석"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>사업자등록번호</Label>
              <Input
                value={form.businessNumber}
                onChange={(e) => setForm({ ...form, businessNumber: e.target.value })}
                placeholder="000-00-00000"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>업태</Label>
                <Input
                  value={form.businessType}
                  onChange={(e) => setForm({ ...form, businessType: e.target.value })}
                  placeholder="서비스업"
                />
              </div>
              <div className="space-y-1">
                <Label>종목</Label>
                <Input
                  value={form.businessItem}
                  onChange={(e) => setForm({ ...form, businessItem: e.target.value })}
                  placeholder="소프트웨어 개발"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "처리 중..." : "회원가입"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          이미 계정이 있으신가요?{" "}
          <Link href="/auth/signin" className="text-primary hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
