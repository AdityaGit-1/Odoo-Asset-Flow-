"use client";

import { isApiError, MOCKS_ENABLED } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useQueryParam } from "@/lib/useQueryParam";
import { useAuth } from "@/stores/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

const DEMO_ACCOUNTS = [
  { label: "Admin", email: "admin@assetflow.dev" },
  { label: "Asset manager", email: "manager@assetflow.dev" },
  { label: "Dept head", email: "head@assetflow.dev" },
  { label: "Employee", email: "employee@assetflow.dev" },
];

export default function LoginPage() {
  const { login, status } = useAuth();
  const router = useRouter();
  const next = useQueryParam("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in (e.g. back-button to /login) → straight to the app.
  useEffect(() => {
    if (status === "authed" && !busy) router.replace(next && next.startsWith("/") ? next : "/dashboard");
  }, [status, busy, next, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      router.replace(next && next.startsWith("/") ? next : "/dashboard");
    } catch (err) {
      setError(
        isApiError(err, 401)
          ? "Incorrect email or password — check both and try again."
          : "Couldn't reach the server — check that the gateway is up and retry.",
      );
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-hairline bg-surface p-6 shadow-card">
      <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-muted">Track, allocate and book your organization&apos;s assets.</p>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <Field label="Email" required>
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoFocus
          />
        </Field>
        <Field label="Password" required>
          <Input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>

        {error && <p className="rounded-lg bg-danger-050 px-3 py-2 text-sm text-danger-700">{error}</p>}

        <Button type="submit" loading={busy} className="w-full">
          Sign in
        </Button>
      </form>

      <div className="mt-4 flex items-center justify-between text-[13px]">
        <Link href="/forgot" className="font-medium text-cobalt-600 hover:text-cobalt-500">
          Forgot password?
        </Link>
        <Link href="/signup" className="font-medium text-cobalt-600 hover:text-cobalt-500">
          Create an account
        </Link>
      </div>

      {MOCKS_ENABLED && (
        <div className="mt-5 border-t border-hairline pt-4">
          <p className="mb-2 font-mono text-[11px] tracking-wider text-faint">DEMO ACCOUNTS · password123</p>
          <div className="flex flex-wrap gap-1.5">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => {
                  setEmail(a.email);
                  setPassword("password123");
                }}
                className="rounded-md border border-hairline px-2 py-1 text-xs text-muted hover:bg-hover hover:text-ink"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
