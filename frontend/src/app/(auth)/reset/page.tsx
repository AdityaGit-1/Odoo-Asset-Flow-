"use client";

import { auth } from "@/api/auth";
import { isApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useQueryParam } from "@/lib/useQueryParam";
import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function ResetPage() {
  const token = useQueryParam("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (!token) {
      setError("This reset link is incomplete — use the link from your email, or request a new one.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await auth.reset(token, password);
      setDone(true);
    } catch (err) {
      setError(isApiError(err) ? err.message : "Couldn't reach the server — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-hairline bg-surface p-6 shadow-card">
      <h1 className="text-xl font-semibold tracking-tight">Choose a new password</h1>

      {done ? (
        <div className="mt-5 space-y-4">
          <p className="rounded-lg bg-cobalt-050 px-3 py-2.5 text-sm text-cobalt-700">Password updated — sign in with it now.</p>
          <Link href="/login">
            <Button className="w-full">Go to sign in</Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-4">
          <Field label="New password" required hint="At least 8 characters.">
            <Input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          </Field>
          <Field label="Confirm password" required>
            <Input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          {error && <p className="rounded-lg bg-danger-050 px-3 py-2 text-sm text-danger-700">{error}</p>}
          <Button type="submit" loading={busy} className="w-full">
            Update password
          </Button>
        </form>
      )}
    </div>
  );
}
