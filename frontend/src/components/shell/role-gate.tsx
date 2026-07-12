"use client";

import type { Role } from "@/api/types";
import { useAuth } from "@/stores/auth";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { AlertTriangleIcon } from "@/components/icons";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * UX-only gate for whole pages. The server still 403s — this just keeps the
 * navigation honest and the message calm.
 */
export function RoleGate({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (user && !roles.includes(user.role)) {
    return (
      <div className="rounded-lg border border-hairline bg-surface shadow-card">
        <EmptyState
          icon={<AlertTriangleIcon size={18} />}
          title="You don't have access to this area"
          body="It's limited to other roles. If you think you need it, ask an admin."
          action={
            <Link href="/dashboard">
              <Button variant="secondary">Back to dashboard</Button>
            </Link>
          }
        />
      </div>
    );
  }
  return <>{children}</>;
}
