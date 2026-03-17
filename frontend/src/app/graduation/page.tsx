/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import ui from "@/components/ui/ui.module.css";
import styles from "./graduation.module.css";

import { me } from "@/lib/authApi";
import { getStudyPlan, listStudyPlans, validatePlan } from "@/lib/studyPlansApi";
import { backendBaseUrl, fetchWithAuth } from "@/lib/api";

type CreditTotal = {
  ruleCode: "CREDIT_002";
  have: number;
  need: number;
  missing: number;
  ok: boolean;
  basis: "PASSED_ONLY";
};

type CreditGroup = {
  ruleCode: "CREDIT_001";
  groupId: number;
  groupName: string;
  have: number;
  need: number;
  missing: number;
  ok: boolean;
  basis: "PASSED_ONLY";
};

type GraduationSummary = {
  message: string;
  planId: number;
  curriculum?: { id: number; curriculumName?: string | null; totalMinCredits: number };
  creditTotal: CreditTotal;
  creditGroups: CreditGroup[];
  overallOk: boolean;
};

function sevBadge(overallOk: boolean) {
  return overallOk ? "PASS" : "ERROR";
}

export default function GraduationPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [summary, setSummary] = useState<GraduationSummary | null>(null);

  const [busy, setBusy] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string>("");
  const [showOnlyMissingGroups, setShowOnlyMissingGroups] = useState(false);

  // Load user + latest plan
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const u = await me();
        if (!alive) return;
        setUser(u);

        const p = await listStudyPlans();
        const items = (p?.items ?? p?.plans ?? []) as any[];
        const lastId = items?.[0]?.id ? Number(items[0].id) : null;

        if (!alive) return;
        if (lastId) {
          const sp = await getStudyPlan(lastId);
          const full = (sp?.item ?? sp?.plan ?? sp) as any;
          setPlan(full);
        } else {
          setPlan(null);
        }
      } catch (err: any) {
        if (!alive) return;
        if (String(err?.message || "") === "UNAUTHORIZED") router.replace("/login");
        else setError(err?.message || "เกิดข้อผิดพลาด");
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  // Fetch graduation summary (PASSED only)
  async function fetchGraduationSummary(planId: number) {
  const base = backendBaseUrl();
  const url = `${base}/api/graduation/${planId}/summary`;

  setLoadingSummary(true);
  try {
    const res = await fetchWithAuth(url, { method: "GET" });

    // ถ้า fetchWithAuth คืน Response ต้องเช็ค ok แล้วค่อย json()
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `โหลดสรุปตรวจสอบจบไม่สำเร็จ (${res.status})`);
    }

    const data = (await res.json()) as GraduationSummary;
    setSummary(data);
  } catch (err: any) {
    setSummary(null);
    setError(err?.message || "โหลดสรุปตรวจสอบจบไม่สำเร็จ");
  } finally {
    setLoadingSummary(false);
  }
}
  // Auto fetch summary when plan ready
  useEffect(() => {
    if (!plan?.id) return;
    fetchGraduationSummary(Number(plan.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id]);

  async function runValidateAndRefresh() {
    if (!plan?.id) {
      setError("ยังไม่มีแผนการเรียน กรุณาไปหน้า 'จัดการแผนการเรียน' เพื่อสร้างแผนก่อน");
      return;
    }
    try {
      setBusy(true);
      setError("");

      // เก็บ ValidationRun ไว้ (optional) เพื่อหน้า my-plan ใช้ดู report ได้
      await validatePlan(Number(plan.id));

      // หน้านี้ใช้ summary ตัวจริง (PASSED-only)
      await fetchGraduationSummary(Number(plan.id));
    } catch (err: any) {
      setError(err?.message || "ตรวจสอบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const creditTotal = summary?.creditTotal ?? null;
  const creditGroups = summary?.creditGroups ?? [];

  const totalPct = useMemo(() => {
    if (!creditTotal || !creditTotal.need) return 0;
    return Math.min(100, Math.round((creditTotal.have / creditTotal.need) * 100));
  }, [creditTotal]);

  const groupsToShow = useMemo(() => {
    const base = creditGroups.slice().sort((a, b) => {
      if (a.ok !== b.ok) return a.ok ? 1 : -1;
      if (a.missing !== b.missing) return b.missing - a.missing;
      return a.groupName.localeCompare(b.groupName);
    });
    return showOnlyMissingGroups ? base.filter((g) => !g.ok) : base;
  }, [creditGroups, showOnlyMissingGroups]);

  const groupsOkCount = useMemo(() => creditGroups.filter((g) => g.ok).length, [creditGroups]);
  const groupsTotalCount = creditGroups.length;

  const overallBadge = sevBadge(Boolean(summary?.overallOk));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.kicker}>ตรวจสอบจบการศึกษา</div>
          <div className={styles.h1}>Graduation Check</div>
          
        </div>

        <div className={styles.headerActions}>
          <button className={ui.btnGhost} onClick={() => router.push("/plan")}>
            กลับไปแก้แผน
          </button>
          <button className={ui.btnPrimary} onClick={runValidateAndRefresh} disabled={busy || !plan?.id}>
            {busy ? "กำลังตรวจสอบ..." : "ตรวจสอบ / รีเฟรชผล"}
          </button>
        </div>
      </div>

      {error ? <div className={styles.alert}>{error}</div> : null}

      {!plan?.id ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>ยังไม่มีแผนการเรียน</div>
          <div className={styles.emptySub}>ไปที่หน้า “จัดการแผนการเรียน” เพื่อสร้างแผน แล้วกลับมาหน้านี้อีกครั้ง</div>
          <div style={{ height: 12 }} />
          <button className={ui.btnPrimary} onClick={() => router.push("/plan")}>
            ไปหน้าแผนการเรียน
          </button>
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {/* Overall status card */}
            <div className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <div className={styles.cardTitle}>สถานะการจบ</div>
                  <div className={styles.cardHint}>
                    {loadingSummary ? "กำลังโหลด..." : summary?.overallOk ? "สามารถสำเร็จการศึกษา" : "ยังไม่ครบตามหลักสูตร"}
                    <div>กรุณาไปยื่นคำร้องขอสำเร็จการศึกษา ตามกำหนดการในปฏิทินการศึกษา</div>
                  </div>
                </div>

                <span className={`${styles.badge} ${overallBadge === "PASS" ? styles.badgePass : styles.badgeErr}`}>
                  {overallBadge === "PASS" ? "ผ่าน" : "ไม่ผ่าน"}
                </span>
              </div>

              <div className={styles.divider} />

              <div className={styles.statRow}>
                <div className={styles.statLabel}>หมวดวิชา</div>
                <div className={styles.statValue}>
                  {groupsTotalCount ? `${groupsOkCount} / ${groupsTotalCount} หมวดผ่าน` : "-"}
                </div>
              </div>

              <div className={styles.statRow}>
                <div className={styles.statLabel}>แผน</div>
                <div className={styles.statValue}>{plan?.planId || `#${plan?.id}`}</div>
              </div>

              <div className={styles.note}>
                สถานะรวม = “หน่วยกิตรวมผ่าน” และ “หน่วยกิตรายหมวดผ่านทุกหมวด”
              </div>
            </div>

            {/* Total credit card */}
            <div className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <div className={styles.cardTitle}>หน่วยกิตรวมต้องครบตามหลักสูตร</div>
                </div>

                {creditTotal ? (
                  <span className={`${styles.badge} ${creditTotal.ok ? styles.badgePass : styles.badgeWarn}`}>
                    {creditTotal.ok ? "ครบแล้ว" : "ยังไม่ครบ"}
                  </span>
                ) : (
                  <span className={`${styles.badge} ${styles.badgeMuted}`}>—</span>
                )}
              </div>

              <div className={styles.bigNumber}>
                {creditTotal ? (
                  <>
                    <span className={styles.bigHave}>{creditTotal.have}</span>
                    <span className={styles.bigSlash}>/</span>
                    <span className={styles.bigNeed}>{creditTotal.need}</span>
                    <span className={styles.bigUnit}>หน่วยกิต</span>
                  </>
                ) : (
                  <span className={styles.bigNeed}>กำลังโหลด...</span>
                )}
              </div>

              <div className={styles.progressWrap}>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${totalPct}%` }} />
                </div>
                <div className={styles.progressText}>{totalPct}%</div>
              </div>

              {creditTotal ? (
                <div className={styles.missingText}>
                  {creditTotal.ok ? "ผ่านเกณฑ์หน่วยกิตรวมแล้ว" : `ขาดอีก ${creditTotal.missing} หน่วยกิต`}
                </div>
              ) : null}
            </div>
          </div>

          {/* Credit groups */}
          <div className={styles.card}>
            <div className={styles.cardTop}>
              <div>
                <div className={styles.cardTitle}>หน่วยกิตในแต่ละหมวดต้องครบตามเกณฑ์</div>
                
              </div>

              <div className={styles.toolbar}>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={showOnlyMissingGroups}
                    onChange={(e) => setShowOnlyMissingGroups(e.target.checked)}
                  />
                  <span>แสดงเฉพาะหมวดที่ยังไม่ผ่าน</span>
                </label>

                <span className={styles.countChip}>{creditGroups.length ? `ทั้งหมด ${creditGroups.length} หมวด` : "—"}</span>
              </div>
            </div>

            <div className={styles.divider} />

            {loadingSummary ? (
              <div className={styles.skeletonList}>
                <div className={styles.skeletonRow} />
                <div className={styles.skeletonRow} />
                <div className={styles.skeletonRow} />
              </div>
            ) : groupsToShow.length ? (
              <div className={styles.groupList}>
                {groupsToShow.map((g) => (
                  <div key={g.groupId} className={styles.groupRow}>
                    <div className={styles.groupLeft}>
                      <div className={styles.groupName}>{g.groupName}</div>
                      <div className={styles.groupMeta}>{g.ok ? "ผ่าน" : `ขาด ${g.missing}`} • ต้องมี {g.need} หน่วยกิต</div>
                    </div>

                    <div className={styles.groupRight}>
                      <div className={styles.groupNums}>
                        <b>{g.have}</b>
                        <span className={styles.muted}>/{g.need}</span>
                      </div>
                      <span className={`${styles.pill} ${g.ok ? styles.pillPass : styles.pillWarn}`}>{g.ok ? "ครบ" : "ยังไม่ครบ"}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyInline}>ไม่พบข้อมูลหมวดวิชา (ตรวจสอบ curriculum.creditRequirements)</div>
            )}
          </div>

        </>
      )}
    </div>
  );
}
