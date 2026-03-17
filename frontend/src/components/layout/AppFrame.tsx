"use client";

import React from "react";
import { usePathname } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";

const NO_SHELL_PREFIX = ["/login", "/signup"];

export default function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";

  const hideShell = NO_SHELL_PREFIX.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (hideShell) return <>{children}</>;

  return <DashboardShell>{children}</DashboardShell>;
}
