"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useUserId } from "@/hooks/useUserId";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBusinessNumber } from "@/lib/format";
import type { Id } from "../../../../convex/_generated/dataModel";

export default function CompanySettingsPage() {
  const { data: session, status } = useSession();
  const userId = useUserId();
  const user = useQuery(api.auth.getUser, userId ? { userId } : "skip");
  const updateUser = useMutation(api.auth.updateUser);

  // 세션에서 userId를 못 읽을 때, user._id를 직접 사용 (폴백)
  const effectiveUserId = userId ?? (user?._id as Id<"users"> | undefined) ?? null;

  const [form, setForm] = useState({
    companyName: "",
    businessNumber: "",
    corporateNumber: "",
    representative: "",
    businessType: "",
    businessItem: "",
    address: "",
    fiscalYearStart: 1,
    currentFiscalYear: 2025,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setForm({
        companyName: user.companyName ?? "",
        businessNumber: user.businessNumber ?? "",
        corporateNumber: user.corporateNumber ?? "",
        representative: user.name ?? "",
        businessType: user.businessType ?? "",
        businessItem: user.businessItem ?? "",
        address: user.address ?? "",
        fiscalYearStart: user.fiscalYearStart ?? 1,
        currentFiscalYear: user.currentFiscalYear ?? 2025,
      });
    }
  }, [user]);

  const handleSave = async () => {
    const saveId = effectiveUserId;
    if (!saveId) {
      setError("로그인 정보를 찾을 수 없습니다. 다시 로그인해주세요.");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      await updateUser({
        userId: saveId,
        companyName: form.companyName,
        businessNumber: form.businessNumber,
        corporateNumber: form.corporateNumber || undefined,
        name: form.representative || undefined,
        businessType: form.businessType || undefined,
        businessItem: form.businessItem || undefined,
        address: form.address || undefined,
        fiscalYearStart: form.fiscalYearStart,
        currentFiscalYear: form.currentFiscalYear,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // 세션 디버그 (개발 중만 표시)
  const sessionDebug = status === "loading"
    ? "세션 로딩 중..."
    : status === "unauthenticated"
      ? "로그인되지 않음"
      : userId
        ? null // 정상
        : `세션 있음 (userId 누락) — session.user: ${JSON.stringify(session?.user)}`;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold">회사정보 설정</h1>

      {/* 세션 디버그 */}
      {sessionDebug && (
        <div className="p-3 bg-yellow-50 text-yellow-800 rounded-lg text-xs font-mono">
          {sessionDebug}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>회사명</Label>
              <Input
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                placeholder="주식회사 루미브리즈"
              />
            </div>
            <div className="space-y-2">
              <Label>대표자</Label>
              <Input
                value={form.representative}
                onChange={(e) => setForm({ ...form, representative: e.target.value })}
                placeholder="유범석"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>사업자등록번호</Label>
              <Input
                value={form.businessNumber}
                onChange={(e) =>
                  setForm({
                    ...form,
                    businessNumber: formatBusinessNumber(e.target.value),
                  })
                }
                placeholder="000-00-00000"
                maxLength={12}
              />
            </div>
            <div className="space-y-2">
              <Label>법인등록번호</Label>
              <Input
                value={form.corporateNumber}
                onChange={(e) => setForm({ ...form, corporateNumber: e.target.value })}
                placeholder="000000-0000000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>업태</Label>
              <Input
                value={form.businessType}
                onChange={(e) => setForm({ ...form, businessType: e.target.value })}
                placeholder="서비스업"
              />
            </div>
            <div className="space-y-2">
              <Label>종목</Label>
              <Input
                value={form.businessItem}
                onChange={(e) => setForm({ ...form, businessItem: e.target.value })}
                placeholder="소프트웨어 개발"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>주소</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="서울특별시..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">회계연도</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>회계연도 시작월</Label>
              <Input
                type="number"
                min={1}
                max={12}
                value={form.fiscalYearStart}
                onChange={(e) =>
                  setForm({ ...form, fiscalYearStart: parseInt(e.target.value) || 1 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>현재 회계연도</Label>
              <Input
                type="number"
                min={2020}
                max={2030}
                value={form.currentFiscalYear}
                onChange={(e) =>
                  setForm({
                    ...form,
                    currentFiscalYear: parseInt(e.target.value) || 2025,
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !effectiveUserId}>
          {saving ? "저장 중..." : "저장"}
        </Button>
        {saved && <span className="text-sm text-green-600">저장되었습니다.</span>}
        {!effectiveUserId && status !== "loading" && (
          <span className="text-sm text-orange-600">로그인 정보를 확인할 수 없습니다.</span>
        )}
      </div>
    </div>
  );
}
