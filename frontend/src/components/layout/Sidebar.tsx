"use client";

/**
 * components/layout/Sidebar.tsx
 * -----------------------------------------------------------------------------
 * Sidebar ตามโครงของตี้:
 * - โลโก้ระบบ + ชื่อระบบ
 * - โปรไฟล์ผู้ใช้ (avatar + info card)
 * - เมนู: Dashboard / รายวิชาทั้งหมด / จัดการแผนการเรียน
 * - ปุ่มออกจากระบบ
 */

import Link from "next/link";
import styles from "./layout.module.css";
import { clearAccessToken } from "@/lib/api";
import { usePathname, useRouter } from "next/navigation";

export type SidebarUser = {
  firstName: string;
  lastName: string;
  studentCode: string;
};

export default function Sidebar({ user }: { user: SidebarUser | null }) {
  const pathname = usePathname();
  const router = useRouter();

  const fullName = user ? `${user.firstName} ${user.lastName}` : "-";
  const initials = user ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() : "";

  function isActive(href: string) {
    return pathname === href;
  }

  function logout() {
    clearAccessToken();
    router.push("/login");
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.brandDot} />
        <div>
          <div className={styles.brandTitle}>StudyPlan System</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>นักศึกษา</div>
        </div>
      </div>

      <div className={styles.profileCard}>
        <div className={styles.profileRow}>
          <div className={styles.avatar}>{initials || "SP"}</div>
          <div>
            <div className={styles.profileName}>{fullName}</div>
            <div className={styles.profileMeta}>รหัส: {user?.studentCode ?? "-"}</div>
          </div>
        </div>
      </div>

      <nav className={styles.nav}>
        <Link className={`${styles.navItem} ${isActive("/dashboard") ? styles.navItemActive : ""}`} href="/dashboard">
          📊 แดชบอร์ด
        </Link>
        <a className={styles.navItem} href="#" aria-disabled>
          📚 รายวิชาทั้งหมด
        </a>
        <a className={styles.navItem} href="#" aria-disabled>
          🧩 จัดการแผนการเรียน
        </a>

        <div style={{ height: 12 }} />
        <button className={styles.navItem} onClick={logout} style={{ width: "100%", border: 0, background: "transparent", textAlign: "left", cursor: "pointer" }}>
          🚪 ออกจากระบบ
        </button>
      </nav>
    </aside>
  );
}
