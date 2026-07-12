"use client";

import { auth } from "@/api/auth";
import { MOCKS_ENABLED } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [demoToken, setDemoToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await auth.forgot(email.trim());
      setSent(true);
      if (MOCKS_ENABLED && res?.resetToken) setDemoToken(res.resetToken);
    } catch {
      setError("Couldn't reach the server — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-hairline bg-surface p-6 shadow-card">
      <h1 className="text-xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-1 text-sm text-muted">We&apos;ll send a single-use reset link to your email.</p>

      {sent ? (
        <div className="mt-5 space-y-4">
          <p className="rounded-lg bg-cobalt-050 px-3 py-2.5 text-sm text-cobalt-700">
            If <span className="font-medium">{email}</span> has an account, a reset link is on its way. It expires in an hour.
          </p>
          {demoToken && (
            <p className="rounded-lg border border-dashed border-hairline px-3 py-2.5 text-[13px] text-muted">
              Demo shortcut (the real backend emails this):{" "}
              <Link href={`/reset?token=${demoToken}`} className="font-medium text-cobalt-600 hover:text-cobalt-500">
                open the reset link
              </Link>
            </p>
          )}
          <Link href="/login" className="block text-center text-[13px] font-medium text-cobalt-600 hover:text-cobalt-500">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-4">
          <Field label="Email" required>
            <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoFocus />
          </Field>
          {error && <p className="rounded-lg bg-danger-050 px-3 py-2 text-sm text-danger-700">{error}</p>}
          <Button type="submit" loading={busy} className="w-full">
            Send reset link
          </Button>
          <Link href="/login" className="block text-center text-[13px] font-medium text-cobalt-600 hover:text-cobalt-500">
            Back to sign in
          </Link>
        </form>
      )}
    </div>
  );
}
