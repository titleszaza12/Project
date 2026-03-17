/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./myPlan.module.css";

import { deleteStudyPlan, getStudyPlan, listStudyPlans, validatePlan } from "@/lib/studyPlansApi";

type Course = {
  id: number;
  courseCode?: string | null;
  courseNameTH?: string | null;
  code?: string | null;
  nameTh?: string | null;
  credits?: number | null;
};

type Entry = {
  id: number;
  status?: string | null; // PLANNED | ENROLLED | PASSED | FAILED
  grade?: string | number | null;
  course?: Course | null;
};

type Term = {
  id: number;
  termYear: number;
  termNo: number;
  entries?: Entry[];
};

type Track = { code: string; name?: string | null };

type StudyPlan = {
  id: number;
  planId?: string | null;
  curriculumId?: number | null;
  track?: Track | null;
  terms?: Term[];
  validationRuns?: any[];
};

function asArray<T>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function n(v: any, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function courseCode(c?: Course | null) {
  return c?.courseCode || c?.code || "";
}

function courseNameTh(c?: Course | null) {
  return c?.courseNameTH || c?.nameTh || "";
}

const PASS_GRADE_SET = new Set(["A", "B+", "B", "C+", "C", "D+", "D"]);

function normalizeGradeLetter(g?: string | number | null): string | null {
  if (g == null) return null;

  if (typeof g === "number") {
    const x = Number(g);
    if (!Number.isFinite(x)) return null;
    if (x >= 3.75) return "A";
    if (x >= 3.25) return "B+";
    if (x >= 2.75) return "B";
    if (x >= 2.25) return "C+";
    if (x >= 1.75) return "C";
    if (x >= 1.25) return "D+";
    if (x >= 0.75) return "D";
    return "F";
  }

  const s = String(g).trim().toUpperCase();
  if (!s) return null;

  const compact = s.replace(/\s+/g, "");
  if (compact === "A") return "A";
  if (compact === "B+") return "B+";
  if (compact === "B") return "B";
  if (compact === "C+") return "C+";
  if (compact === "C") return "C";
  if (compact === "D+") return "D+";
  if (compact === "D") return "D";
  if (compact === "F") return "F";
  return compact;
}

function statusFromGradeOrEntry(e: Entry): "PASSED" | "FAILED" | "PLANNED" {
  const letter = normalizeGradeLetter(e.grade);
  if (!letter) return "PLANNED";
  if (letter === "F") return "FAILED";
  if (PASS_GRADE_SET.has(letter)) return "PASSED";
  return "PLANNED";
}

function displayStatusFromGradeOrEntry(e: Entry) {
  const s = statusFromGradeOrEntry(e);
  if (s === "PASSED") return "ผ่านแล้ว";
  if (s === "FAILED") return "ไม่ผ่าน";
  return "วางแผน";
}

function termLabel(termNo: number) {
  if (termNo === 1) return "เทอม 1";
  if (termNo === 2) return "เทอม 2";
  return `เทอม ${termNo}`;
}

type Severity = "PASS" | "WARNING" | "ERROR";
const severityRank: Record<Severity, number> = { PASS: 0, WARNING: 1, ERROR: 2 };

function worstSeverity(items: { severity?: Severity | string }[]): Severity {
  let w: Severity = "PASS";
  for (const it of items) {
    const raw = (it.severity || "PASS") as any;
    const s: Severity = raw === "ERROR" || raw === "WARNING" ? raw : "PASS";
    if (severityRank[s] > severityRank[w]) w = s;
  }
  return w;
}

const RULE_CATEGORIES = [
  { key: "prereq", title: "1) Prerequisite (เงื่อนไขก่อนเรียน)", codes: ["PREREQ_001"] },
  { key: "sequence", title: "2) Study Plan Sequence (ลำดับแผน)", codes: ["PLAN_001", "PLAN_002"] },
  { key: "mandatory", title: "3) Mandatory Courses (วิชาบังคับ)", codes: ["CURR_002", "MAND_001"] },
  { key: "credit_total", title: "4) Credit Requirement (หน่วยกิตรวม)", codes: ["CREDIT_002"] },
  { key: "credit_group", title: "5) Course Group (หน่วยกิตรายหมวด)", codes: ["CREDIT_001"] },
  { key: "track", title: "6) Track Requirement (เงื่อนไข Track)", codes: ["CURR_001"] },
] as const;

type ValidationIssue = {
  message: string;
  severity: Severity;
  termYear?: number | null;
  termNo?: number | null;
  courseCode?: string | null;
  courseNameTH?: string | null;
  ruleCode?: string | null;
  ruleText?: string | null;
};

type ValidationCard = {
  key: string;
  title: string;
  status: Severity;
  issues: ValidationIssue[];
};

type ValidationReport = {
  message: string;
  runId: number | null;
  studyPlanId: number | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  summary: { total: number; passed: number; warning: number; error: number };
  cards: ValidationCard[];
};

function buildValidationReport(apiData: any): ValidationReport {
  const results = asArray<any>(apiData?.run?.results);

  const byCode: Record<string, any[]> = {};
  for (const r of results) {
    const code = r?.rule?.ruleCode || "UNKNOWN";
    if (!byCode[code]) byCode[code] = [];
    byCode[code].push(r);
  }

  const cards: ValidationCard[] = RULE_CATEGORIES.map((cat) => {
    const rawIssues = cat.codes.flatMap((code) => asArray<any>(byCode[code]));
    const issues: ValidationIssue[] = rawIssues.map((x) => ({
      message: String(x?.message || ""),
      severity: x?.severity === "ERROR" || x?.severity === "WARNING" ? x.severity : "PASS",
      termYear: x?.term?.termYear ?? null,
      termNo: x?.term?.termNo ?? null,
      courseCode: x?.course?.courseCode ?? null,
      courseNameTH: x?.course?.courseNameTH ?? null,
      ruleCode: x?.rule?.ruleCode ?? null,
      ruleText: x?.rule?.ruleText ?? null,
    }));

    return {
      key: cat.key,
      title: cat.title,
      status: worstSeverity(issues),
      issues,
    };
  });

  const passed = cards.filter((c) => c.status === "PASS").length;
  const warning = cards.filter((c) => c.status === "WARNING").length;
  const error = cards.filter((c) => c.status === "ERROR").length;

  return {
    message: String(apiData?.message || "ตรวจสอบแผนเสร็จสิ้น"),
    runId: apiData?.run?.id ?? null,
    studyPlanId: apiData?.run?.studyPlanId ?? null,
    startedAt: apiData?.run?.startedAt ?? null,
    finishedAt: apiData?.run?.finishedAt ?? null,
    summary: { total: 7, passed, warning, error },
    cards,
  };
}

function badgeClass(status: Severity) {
  if (status === "PASS") return styles.badgePass;
  if (status === "WARNING") return styles.badgeWarn;
  return styles.badgeErr;
}

function statusText(status: Severity) {
  if (status === "PASS") return "ผ่าน";
  if (status === "WARNING") return "เตือน";
  return "ไม่ผ่าน";
}

export default function MyPlanPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [plan, setPlan] = useState<StudyPlan | null>(null);

  const [selectedYear, setSelectedYear] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const [lastValidateMsg, setLastValidateMsg] = useState<string>("");
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);

  // ✅ filter สำหรับ “รายงานกฎ”
  const [filterYear, setFilterYear] = useState<number | "ALL">("ALL");
  const [filterTerm, setFilterTerm] = useState<number | "ALL">("ALL");

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError("");
      setLastValidateMsg("");
      setValidationReport(null);

      try {
        const res = await listStudyPlans();
        const items = asArray<StudyPlan>(res?.items)
          .slice()
          .sort((a, b) => n(b.id, 0) - n(a.id, 0));
        if (!alive) return;

        setPlans(items);
        const firstId = items?.[0]?.id ?? null;
        setSelectedPlanId(firstId);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "โหลดรายการแผนไม่สำเร็จ");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedPlanId) {
      setPlan(null);
      return;
    }

    let alive = true;

    (async () => {
      setLoading(true);
      setError("");
      setLastValidateMsg("");

      try {
        const res = await getStudyPlan(selectedPlanId);
        const item = (res?.item as StudyPlan) || null;
        if (!alive) return;

        setPlan(item);

        const ys = Array.from(new Set(asArray<Term>(item?.terms).map((t) => n(t.termYear, 1))))
          .filter((x) => x > 0)
          .sort((a, b) => a - b);

        // ✅ default ปีที่มีจริง ถ้าไม่มีให้ 1
        setSelectedYear(ys?.[0] ?? 1);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "โหลดแผนไม่สำเร็จ");
        setPlan(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [selectedPlanId]);

  // ✅ ปีทั้งหมดของ “แผน” (ถ้าไม่มีข้อมูล ให้โชว์ 1-4)
  const yearOptions = useMemo(() => {
    const ys = Array.from(new Set(asArray<Term>(plan?.terms).map((t) => n(t.termYear, 1))))
      .filter((x) => x > 0)
      .sort((a, b) => a - b);
    return ys.length ? ys : [1, 2, 3, 4];
  }, [plan?.terms]);

  // ✅ เทอมทั้งหมดใน “แผน” (เอาไว้ทำ option filterTerm ให้ครบ)
  const termOptionsForFilter = useMemo(() => {
    const ts = asArray<Term>(plan?.terms);
    if (!ts.length) return [1, 2];

    const set = new Set<number>();
    ts.forEach((t) => {
      const y = n(t.termYear, 0);
      const no = n(t.termNo, 0);
      if (!no) return;
      if (filterYear !== "ALL" && y !== filterYear) return;
      set.add(no);
    });

    const arr = Array.from(set).sort((a, b) => a - b);
    return arr.length ? arr : [1, 2];
  }, [plan?.terms, filterYear]);

  const termsInYear = useMemo(() => {
    return asArray<Term>(plan?.terms)
      .filter((t) => n(t.termYear, 1) === n(selectedYear, 1))
      .sort((a, b) => n(a.termNo, 1) - n(b.termNo, 1));
  }, [plan?.terms, selectedYear]);

  const headerTitle = useMemo(() => {
    if (!plan) return "แผนการเรียนของฉัน";
    const trackName = plan.track?.name || plan.track?.code || "";
    const pid = plan.planId ? `(${plan.planId})` : "";
    return ["แผนการเรียนของฉัน", trackName ? `• ${trackName}` : "", pid].filter(Boolean).join(" ");
  }, [plan]);

  const overall = useMemo(() => {
    const allEntries = asArray<Term>(plan?.terms).flatMap((t) => asArray<Entry>(t.entries));
    const passed = allEntries
      .filter((e) => statusFromGradeOrEntry(e) === "PASSED")
      .reduce((acc, e) => acc + n(e.course?.credits, 0), 0);
    const planned = allEntries
      .filter((e) => statusFromGradeOrEntry(e) === "PLANNED")
      .reduce((acc, e) => acc + n(e.course?.credits, 0), 0);
    const failed = allEntries
      .filter((e) => statusFromGradeOrEntry(e) === "FAILED")
      .reduce((acc, e) => acc + n(e.course?.credits, 0), 0);
    const total = passed + planned + failed;
    return { passed, planned, failed, total };
  }, [plan?.terms]);

  async function onValidate() {
    if (!selectedPlanId) return;
    setBusy(true);
    setLastValidateMsg("");
    setError("");

    try {
      const r = await validatePlan(selectedPlanId);
      const res = await getStudyPlan(selectedPlanId);
      setPlan((res?.item as StudyPlan) || null);

      const report = buildValidationReport(r);
      setValidationReport(report);

      // ✅ reset filter เป็น ALL ทุกครั้งที่กดตรวจ
      setFilterYear("ALL");
      setFilterTerm("ALL");

      const msg = `ผลตรวจแผน: ผ่าน ${report.summary.passed} / 6 | เตือน ${report.summary.warning} | ไม่ผ่าน ${report.summary.error}`;
      setLastValidateMsg(msg);
    } catch (e: any) {
      setError(e?.message || "ตรวจแผนไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function onDeletePlan() {
    if (!selectedPlanId) return;

    const ok = window.confirm("ลบแผนการเรียนทั้งแผน?\n\n- จะลบเทอมและรายวิชาทั้งหมด\n- ย้อนกลับไม่ได้\n\nกด OK เพื่อยืนยัน");
    if (!ok) return;

    setBusy(true);
    setError("");
    setLastValidateMsg("");

    try {
      await deleteStudyPlan(selectedPlanId);

      const res = await listStudyPlans();
      const items = asArray<StudyPlan>(res?.items);
      setPlans(items);
      const firstId = items?.[0]?.id ?? null;
      setSelectedPlanId(firstId);
      setPlan(null);
    } catch (e: any) {
      setError(e?.message || "ลบแผนไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div>
            <div className={styles.h2}>{headerTitle}</div>
            <div className={styles.sub}>ดูภาพรวมเป็นกราฟ แยกตามชั้นปี และดูรายละเอียดรายเทอมได้</div>
          </div>

          <div className={styles.actions}>
            <button className={styles.btn} onClick={onValidate} disabled={!selectedPlanId || busy} title="ตรวจสอบกฎ">
              ตรวจแผน
            </button>
            <button className={styles.btnDanger} onClick={onDeletePlan} disabled={!selectedPlanId || busy} title="ลบทั้งแผน">
              ลบแผน
            </button>
          </div>
        </div>

        <div className={styles.controls}>
          <div className={styles.controlGroup}>
            <label className={styles.label}>เลือกแผน</label>
            <select
              className={styles.select}
              value={selectedPlanId ?? ""}
              onChange={(e) => setSelectedPlanId(Number(e.target.value) || null)}
              disabled={loading || busy}
            >
              {plans.length === 0 ? (
                <option value="">ยังไม่มีแผน</option>
              ) : (
                plans.map((p) => {
                  const ts = asArray<Term>(p.terms);
                  const minY = ts.length ? Math.min(...ts.map((t) => n(t.termYear, 1))) : null;
                  const maxY = ts.length ? Math.max(...ts.map((t) => n(t.termYear, 1))) : null;
                  const minT = ts.length ? Math.min(...ts.map((t) => n(t.termNo, 1))) : null;
                  const maxT = ts.length ? Math.max(...ts.map((t) => n(t.termNo, 1))) : null;

                  const scopeLabel =
                    minY == null
                      ? ""
                      : minY === maxY && minT === maxT
                      ? `• ปี ${minY} ${termLabel(minT!)}`
                      : `• ปี ${minY}-${maxY} เทอม ${minT}-${maxT}`;

                  return (
                    <option key={p.id} value={p.id}>
                      {p.planId || `Plan #${p.id}`} {p.track?.code ? `• ${p.track.code}` : ""} {scopeLabel}
                    </option>
                  );
                })
              )}
            </select>
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.label}>เลือกชั้นปี</label>
            <select
              className={styles.select}
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value) || 1)}
              disabled={!plan || loading || busy}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  ปี {y}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.legend}>
            <span className={`${styles.dot} ${styles.dotPassed}`} /> ผ่านแล้ว
            <span className={`${styles.dot} ${styles.dotPlanned}`} /> วางแผน
            <span className={`${styles.dot} ${styles.dotFailed}`} /> ตก/ไม่ผ่าน
          </div>
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}
        {lastValidateMsg ? <div className={styles.ok}>{lastValidateMsg}</div> : null}

        {validationReport ? (
          <div className={styles.reportWrap}>
            <div className={styles.reportHeader}>
              <div>
                <div className={styles.reportTitle}>Validation Report (กฎ 6 ข้อ)</div>
                <div className={styles.reportSub}>
                  {validationReport.message}
                  {validationReport.runId ? ` | Run #${validationReport.runId}` : ""}
                </div>
              </div>

              <div className={styles.reportSummary}>
                ผ่าน {validationReport.summary.passed} / 7 • เตือน {validationReport.summary.warning} • ไม่ผ่าน{" "}
                {validationReport.summary.error}
              </div>
            </div>

            {/* ✅ FILTER: ให้เลือกได้ทุกชั้นปี (ยึดจากแผน ไม่ยึดจาก issues) */}
            <div className={styles.filterRow}>
              <div className={styles.filterItem}>
                <label className={styles.filterLabel}>ปี</label>
                <select
                  className={styles.select}
                  value={filterYear}
                  onChange={(e) => {
                    const v = e.target.value === "ALL" ? "ALL" : Number(e.target.value);
                    setFilterYear(v as any);
                    setFilterTerm("ALL");
                  }}
                >
                  <option value="ALL">ทุกปี</option>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      ปี {y}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.filterItem}>
                <label className={styles.filterLabel}>เทอม</label>
                <select
                  className={styles.select}
                  value={filterTerm}
                  onChange={(e) => {
                    const v = e.target.value === "ALL" ? "ALL" : Number(e.target.value);
                    setFilterTerm(v as any);
                  }}
                >
                  <option value="ALL">ทุกเทอม</option>
                  {termOptionsForFilter.map((tno) => (
                    <option key={tno} value={tno}>
                      เทอม {tno}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.reportGrid}>
              {validationReport.cards.map((card) => {
                const filtered = card.issues.filter((it) => {
                  // รายการที่ไม่ผูกเทอม (termYear/termNo null) ให้โชว์เสมอ
                  if (!it.termYear || !it.termNo) return true;

                  if (filterYear !== "ALL" && it.termYear !== filterYear) return false;
                  if (filterTerm !== "ALL" && it.termNo !== filterTerm) return false;

                  return true;
                });

                const status = worstSeverity(filtered);
                const showCount = filtered.length;

                return (
                  <div key={card.key} className={styles.ruleCard}>
                    <div className={styles.ruleTop}>
                      <div className={styles.ruleTitle}>{card.title}</div>
                      <span className={`${styles.badge} ${badgeClass(status)}`}>{statusText(status)}</span>
                    </div>

                    <div className={styles.ruleMeta}>พบ {showCount} รายการ</div>

                    {showCount > 0 ? (
                      <div className={styles.issueList}>
                        {filtered.map((it, idx) => (
                          <div key={`${card.key}-${idx}`} className={styles.issueItem}>
                            <div className={styles.issueMsg}>{it.message}</div>
                            <div className={styles.issueSub}>
                              {it.ruleCode ? `กฎ ${it.ruleCode}` : ""}
                              {it.termYear && it.termNo ? ` • ปี ${it.termYear} เทอม ${it.termNo}` : ""}
                              {it.courseCode ? ` • ${it.courseCode}` : ""}
                              {it.courseNameTH ? ` ${it.courseNameTH}` : ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={styles.passHint}>ไม่พบประเด็นในหมวดนี้</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className={styles.loading}>กำลังโหลด...</div>
        ) : plans.length === 0 ? (
          <div className={styles.empty}>
            ยังไม่มีแผนการเรียนของคุณ
            <div className={styles.emptyHint}>แนะนำ: ไปที่เมนู “จัดการแผนการเรียน” เพื่อสร้างแผนจาก Track ก่อน</div>
          </div>
        ) : !plan ? (
          <div className={styles.empty}>ไม่พบข้อมูลแผน</div>
        ) : (
          <>
            <div className={styles.summaryRow}>
              <div className={styles.summaryCard}>
                <div className={styles.k}>หน่วยกิตทั้งหมดในแผน</div>
                <div className={styles.v}>{overall.total}</div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.k}>ผ่านแล้ว</div>
                <div className={styles.v}>{overall.passed}</div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.k}>วางแผน</div>
                <div className={styles.v}>{overall.planned}</div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.k}>ไม่ผ่าน</div>
                <div className={styles.v}>{overall.failed}</div>
              </div>
            </div>

            <div className={styles.grid}>
              {termsInYear.length === 0 ? (
                <div className={styles.empty}>ยังไม่มีเทอมในปี {selectedYear}</div>
              ) : (
                termsInYear.map((t) => {
                  const entries = asArray<Entry>(t.entries);
                  const passed = entries
                    .filter((e) => statusFromGradeOrEntry(e) === "PASSED")
                    .reduce((acc, e) => acc + n(e.course?.credits, 0), 0);
                  const planned = entries
                    .filter((e) => statusFromGradeOrEntry(e) === "PLANNED")
                    .reduce((acc, e) => acc + n(e.course?.credits, 0), 0);
                  const failed = entries
                    .filter((e) => statusFromGradeOrEntry(e) === "FAILED")
                    .reduce((acc, e) => acc + n(e.course?.credits, 0), 0);
                  const total = passed + planned + failed;

                  const pct = (x: number) => (total > 0 ? (x / total) * 100 : 0);

                  return (
                    <div key={t.id} className={styles.termCard}>
                      <div className={styles.termTop}>
                        <div className={styles.termTitle}>
                          ปี {t.termYear} • {termLabel(t.termNo)}
                        </div>
                        <div className={styles.termTotal}>{total} หน่วยกิต</div>
                      </div>

                      <div className={styles.bar} aria-label="กราฟหน่วยกิตแยกตามสถานะ">
                        <div
                          className={`${styles.seg} ${styles.segPassed}`}
                          style={{ width: `${pct(passed)}%` }}
                          title={`ผ่านแล้ว ${passed} หน่วยกิต`}
                        />
                        <div
                          className={`${styles.seg} ${styles.segPlanned}`}
                          style={{ width: `${pct(planned)}%` }}
                          title={`วางแผน ${planned} หน่วยกิต`}
                        />
                        <div
                          className={`${styles.seg} ${styles.segFailed}`}
                          style={{ width: `${pct(failed)}%` }}
                          title={`ตก/ไม่ผ่าน ${failed} หน่วยกิต`}
                        />
                      </div>

                      <div className={styles.termMeta}>
                        <div>
                          ผ่าน: <b>{passed}</b>
                        </div>
                        <div>
                          วางแผน: <b>{planned}</b>
                        </div>
                        <div>
                          ตก: <b>{failed}</b>
                        </div>
                      </div>

                      <details className={styles.details}>
                        <summary className={styles.summaryBtn}>ดูรายวิชาในเทอม</summary>
                        <div className={styles.tableWrap}>
                          <table className={styles.table}>
                            <thead>
                              <tr>
                                <th>รหัส</th>
                                <th>ชื่อวิชา</th>
                                <th className={styles.right}>หน่วยกิต</th>
                                <th>เกรด</th>
                                <th>สถานะ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entries.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className={styles.muted}>
                                    ยังไม่มีรายวิชาในเทอมนี้
                                  </td>
                                </tr>
                              ) : (
                                entries.map((e) => (
                                  <tr key={e.id}>
                                    <td className={styles.code}>{courseCode(e.course) || "-"}</td>
                                    <td>{courseNameTh(e.course) || "-"}</td>
                                    <td className={styles.right}>{n(e.course?.credits, 0)}</td>
                                    <td>{normalizeGradeLetter(e.grade) || "-"}</td>
                                    <td>
                                      <span className={styles.badge}>{displayStatusFromGradeOrEntry(e)}</span>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}