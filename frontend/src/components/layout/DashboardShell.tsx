"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import styles from "./DashboardShell.module.css";
import {
  clearAccessToken,
  getDashboardSummary,
  uploadProfileImage,
  backendBaseUrl,
} from "@/lib/api";

type StudentProfile = {
  id: number;
  studentCode?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
};

type Summary = {
  studentProfile?: StudentProfile | null;
};

function absUrl(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const base = backendBaseUrl();
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

const NAV = [
  { href: "/dashboard", label: "แดชบอร์ด" },
  { href: "/courses", label: "รายวิชาทั้งหมด" },
  { href: "/my-plan", label: "แผนการเรียนของฉัน" },
  { href: "/plan", label: "จัดการแผนการเรียน" },
  { href: "/graduation", label: "ตรวจสอบจบ" },
] as const;

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || "/";

  const [summary, setSummary] = useState<Summary | null>(null);
  const [bust, setBust] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const s = await getDashboardSummary();
        if (!alive) return;
        setSummary(s ?? null);
      } catch (e: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msg = String((e as any)?.message || "");
        if (msg === "UNAUTHORIZED") router.replace("/login");
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  const activeHref = useMemo(() => {
    const hit = NAV.find((n) => pathname === n.href || pathname.startsWith(n.href + "/"));
    return hit?.href ?? "/dashboard";
  }, [pathname]);

  const fullName = useMemo(() => {
    const p = summary?.studentProfile ?? null;
    const name = `${p?.firstName ?? ""} ${p?.lastName ?? ""}`.trim();
    return name || "นักศึกษา";
  }, [summary?.studentProfile]);

  const studentCode = summary?.studentProfile?.studentCode ?? "-";
  const avatar = absUrl(summary?.studentProfile?.profileImageUrl) || "/avatar-person.svg";
  const avatarSrc = bust ? `${avatar}${avatar.includes("?") ? "&" : "?"}t=${bust}` : avatar;

  async function onPickFile(file: File) {
    try {
      const r = await uploadProfileImage(file);

      setSummary((prev) => {
        const prevProfile: StudentProfile = prev?.studentProfile ?? {
          id: 0,
          studentCode: null,
          firstName: null,
          lastName: null,
          profileImageUrl: null,
        };

        return {
          ...(prev ?? {}),
          studentProfile: {
            ...prevProfile,
            profileImageUrl: r?.profileImageUrl ?? prevProfile.profileImageUrl ?? null,
          },
        };
      });

      setBust(Date.now());
    } catch {
      // noop
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <div className={styles.brand}>StudyPlan</div>

          <div className={styles.profileCard}>
            <div className={styles.avatarWrap}>
              <img className={styles.avatar} src={avatarSrc} alt="avatar" />
              <button
                className={styles.avatarBtn}
                type="button"
                title="อัปโหลดรูปโปรไฟล์"
                onClick={() => fileInputRef.current?.click()}
              >
                +
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onPickFile(file);
                  e.currentTarget.value = "";
                }}
              />
            </div>

            <div className={styles.profileText}>
              <div className={styles.name}>{fullName}</div>
              <div className={styles.sub}>รหัสนักศึกษา: {studentCode}</div>
              <div className={styles.sub}>Role: นักศึกษา</div>
            </div>
          </div>

          
          <nav className={styles.nav}>
            {NAV.map((n) => (
              <a
                key={n.href}
                className={`${styles.navItem} ${activeHref === n.href ? styles.navActive : ""}`}
                href={n.href}
              >
                {n.label}
              </a>
            ))}
          </nav>

          <button
            className={styles.logout}
            type="button"
            onClick={() => {
              clearAccessToken();
              router.replace("/login");
            }}
          >
            ออกจากระบบ
          </button>
        </aside>

        <main className={styles.main}>
          <div className={styles.content}>{children}</div>
        </main>
      </div>
    </div>
  );
}
