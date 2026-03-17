/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import styles from "./dashboard.module.css";
import { getCreditBreakdown, getDashboardSummary } from "@/lib/api";

type Summary = {
  studentProfile: {
    id: number;
    studentCode: string;
    firstName: string;
    lastName: string;
    profileImageUrl?: string | null;
  };
  // ✅ dashboard: รวม "ผ่าน + วางแผน" (นับจาก PlanEntry เฉพาะ PASSED/PLANNED)
  plannedCredits?: number | null;

  // ✅ แยกรายละเอียด
  passedCredits?: number | null;
  plannedOnlyCredits?: number | null;

  // backward compat
  enrolledPassedCredits?: number | null;

  totalCreditsRequired?: number | null;
  progressPct?: number | null;
};

type Breakdown = {
  byCategory: Array<{
    code: string;
    nameTH: string;
    completedCredits?: number; // = PASSED
    plannedCredits?: number; // = PLANNED
    earnedCredits?: number; // = PASSED + PLANNED
    requiredCredits: number;
  }>;
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [error, setError] = useState<string>("");

  async function refresh() {
    const [s, b] = await Promise.all([getDashboardSummary(), getCreditBreakdown()]);
    setSummary(s);
    setBreakdown(b);
  }

  useEffect(() => {
    (async () => {
      try {
        setError("");
        await refresh();
      } catch (e: any) {
        setError(e?.message ?? "โหลดข้อมูลไม่สำเร็จ");
      }
    })();
  }, []);

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>เกิดข้อผิดพลาด</h2>
          <div className={styles.muted} style={{ whiteSpace: "pre-wrap" }}>
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!summary || !breakdown) {
    return (
      <div style={{ padding: 24 }}>
        <div className={styles.card}>Loading...</div>
      </div>
    );
  }

  const fullName = `${summary.studentProfile.firstName} ${summary.studentProfile.lastName}`.trim();
  const code = summary.studentProfile.studentCode ?? "-";

  const passed = Number(summary.passedCredits ?? 0);
  const plannedOnly = Number(summary.plannedOnlyCredits ?? 0);
  const combined =
    Number(summary.plannedCredits ?? summary.enrolledPassedCredits ?? 0) || passed + plannedOnly;

  const requiredTotal = Number(summary.totalCreditsRequired ?? 126);
  const pct =
    summary.progressPct ??
    (requiredTotal ? Math.max(0, Math.min(100, Math.round((combined / requiredTotal) * 100))) : 0);

  return (
    <>
      <div className={styles.topRow}>
        <h1 className={styles.title}>แดชบอร์ด</h1>
      </div>

      <div className={styles.grid}>
        <section className={styles.card} style={{ gridColumn: "1 / -1" }}>
          <h2 className={styles.cardTitle}>ภาพรวมความคืบหน้า</h2>

          <div className={styles.muted}>
            นักศึกษา: <b>{fullName || "-"}</b> · รหัส: <b>{code}</b>
          </div>

          <div style={{ height: 8 }} />

          <div className={styles.muted}>
            นับหน่วยกิตจาก <b>ผ่านแล้ว + วางแผน</b>: <b>{combined}</b> / <b>{requiredTotal}</b>
          </div>

          <div style={{ height: 6 }} />

          <div className={styles.muted}>
            ผ่านแล้ว (PASSED): <b>{passed}</b> · วางแผน (PLANNED): <b>{plannedOnly}</b>
          </div>

          <div style={{ height: 12 }} />

          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${pct}%` }} />
          </div>

          <div className={styles.kpis}>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>Progress</div>
              <div className={styles.kpiValue}>{pct}%</div>
            </div>
          </div>
        </section>

        <section className={styles.card} style={{ gridColumn: "1 / -1" }}>
          <h2 className={styles.cardTitle}>หน่วยกิตสะสมแยกหมวด</h2>
          <div className={styles.muted}>นับจาก PlanEntry ที่สถานะ PASSED/PLANNED (ไม่นับซ้ำรายวิชา)</div>

          <div className={styles.breakdownGrid}>
            {breakdown.byCategory.map((r) => {
              const completed = Number(r.completedCredits ?? 0);
              const plannedC = Number(r.plannedCredits ?? 0);
              const earned = Number(r.earnedCredits ?? completed + plannedC);

              const p = r.requiredCredits ? Math.round((earned / r.requiredCredits) * 100) : 0;
              const safe = Math.max(0, Math.min(100, p));

              return (
                <div key={r.code} className={styles.miniCard}>
                  <div className={styles.miniTitle}>{r.nameTH}</div>
                  <div className={styles.miniMeta}>{r.code}</div>

                  <div className={styles.miniValue}>
                    {earned} / {r.requiredCredits}
                  </div>

                  <div className={styles.miniBar}>
                    <div className={styles.miniFill} style={{ width: `${safe}%` }} />
                  </div>

                  <div className={styles.miniPct}>{safe}%</div>

                  <div className={styles.muted} style={{ marginTop: 6 }}>
                    ผ่านแล้ว: <b>{completed}</b> · วางแผน: <b>{plannedC}</b>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
