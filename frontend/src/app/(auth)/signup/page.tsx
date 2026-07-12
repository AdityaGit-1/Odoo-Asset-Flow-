"use client";

import { auth } from "@/api/auth";
import { isApiError } from "@/api/client";
import { departments } from "@/api/org";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useAuth } from "@/stores/auth";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

// Signup is Employee-only by design — there is deliberately no role field here,
// and the server rejects one. Roles are granted later in the employee directory.
export default function SignupPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", departmentId: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const deptQuery = useQuery({ queryKey: ["departments"], queryFn: departments.list });
  const depts = deptQuery.data?.filter((d) => d.status === "ACTIVE");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await auth.signup({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        departmentId: Number(form.departmentId),
      });
      await login(form.email.trim(), form.password);
      router.replace("/dashboard");
    } catch (err) {
      setError(
        isApiError(err, 409)
          ? "An account with this email already exists — sign in instead."
          : isApiError(err)
            ? err.message
            : "Couldn't reach the server — try again.",
      );
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-hairline bg-surface p-6 shadow-card">
      <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-muted">New accounts start as Employee — an admin grants further roles.</p>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <Field label="Full name" required>
          <Input required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Priya Sharma" autoFocus />
        </Field>
        <Field label="Work email" required>
          <Input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" />
        </Field>
        <Field label="Department" required error={deptQuery.isError ? "Couldn't load departments — retry below." : undefined}>
          <Select required value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} disabled={!depts}>
            <option value="" disabled>
              {deptQuery.isLoading ? "Loading…" : "Pick your department"}
            </option>
            {depts?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        {deptQuery.isError && (
          <Button variant="secondary" size="sm" onClick={() => deptQuery.refetch()}>
            Retry loading departments
          </Button>
        )}
        <Field label="Password" required hint="At least 8 characters.">
          <Input type="password" required autoComplete="new-password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
        </Field>

        {error && <p className="rounded-lg bg-danger-050 px-3 py-2 text-sm text-danger-700">{error}</p>}

        <Button type="submit" loading={busy} className="w-full" disabled={!depts}>
          Create account
        </Button>
      </form>

      <p className="mt-4 text-center text-[13px] text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-cobalt-600 hover:text-cobalt-500">
          Sign in
        </Link>
      </p>
    </div>
  );
}
