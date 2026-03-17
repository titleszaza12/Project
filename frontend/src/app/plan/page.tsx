/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./plan.module.css";

// ต้องมี function: getTracks() และ getTrackPlan(trackCode)
import {
  addEntry,
  addTermFromTrack,
  createPlanFromTrack,
  deleteEntry,
  getStudyPlan,
  getTracks,
  getTrackPlan,
  listStudyPlans,
  updateEntry,
  upsertMyTranscript,
} from "@/lib/studyPlansApi";
import { backendBaseUrl, fetchWithAuth } from "@/lib/api";

/**
 * Types (ยืดหยุ่นพอ ไม่ strict เกินไป)
 */
type Track = {
  id: number;
  code: string; // ใช้เป็น param /api/tracks/:code/plan
  name?: string | null;
};

type CourseRow = {
  id?: number | string;
  courseId?: number;
  code?: string;
  nameTh?: string;
  credits?: number;
  groupName?: string | null; // แสดง "หมวดวิชา"
  groupCode?: string | null;
  note?: string | null; // remark
};

type Slot = {
  id?: number | string;
  slotCode?: string | null;
  name?: string | null;
  minCredits?: number | null;
  maxCredits?: number | null;
  groupCode?: string | null;
  note?: string | null;
};

type PlanTerm = {
  id?: number | string;
  year: number;
  term: number;
  courses?: CourseRow[];
  courseEntries?: CourseRow[];
  slots?: Slot[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asArray<T>(v: any): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && Array.isArray(v.items)) return v.items as T[];
  return [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function num(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function PlanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [createdPlanId, setCreatedPlanId] = useState<number | null>(null);
  const [createdPlan, setCreatedPlan] = useState<any>(null);
  const [createdMsg, setCreatedMsg] = useState<string | null>(null);

  const [planName, setPlanName] = useState<string>("");

  const [myPlans, setMyPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  // course groups / options cache for slot dropdowns
  const [groupIdByCode, setGroupIdByCode] = useState<Record<string, number>>({});
  const [courseOptionsByGroup, setCourseOptionsByGroup] = useState<Record<string, CourseRow[]>>({});
  // ใช้ร่วมกันทั้งแถว fixed และ slot
  const [rowSelectedCourseId, setRowSelectedCourseId] = useState<Record<string, number>>({});
  const [rowEntryId, setRowEntryId] = useState<Record<string, number>>({});
  const [rowSaving, setRowSaving] = useState<Record<string, boolean>>({});
  const [rowGrade, setRowGrade] = useState<Record<string, string>>({});

  const GRADE_OPTIONS = useMemo(() => ["A", "B+", "B", "C+", "C", "D+", "D", "F"], []);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [trackCode, setTrackCode] = useState<string>("");

  const [terms, setTerms] = useState<PlanTerm[]>([]);
  const [year, setYear] = useState<number>(1);
  const [term, setTerm] = useState<number>(1);

  // ---------- Load tracks ----------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const res = await getTracks();
        const list = asArray<Track>(res);

        if (cancelled) return;

        setTracks(list);
        const first = list?.[0]?.code ?? "";
        setTrackCode(first);

        // default plan name (editable)
        if (!planName) {
          const firstName = list?.[0]?.name ?? first;
          setPlanName("แผนหลัก");
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "โหลด Track ไม่สำเร็จ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- Load course groups (with subGroups) for slot filtering ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const base = backendBaseUrl();
        const res = await fetchWithAuth(`${base}/api/course-groups`, { method: "GET" });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();

        const items = asArray<any>(data?.items);
        const map: Record<string, number> = {};
        for (const g of items) {
          if (g?.groupCode && g?.id) map[String(g.groupCode)] = Number(g.id);
          for (const sg of asArray<any>(g?.subGroups)) {
            if (sg?.groupCode && sg?.id) map[String(sg.groupCode)] = Number(sg.id);
          }
        }
        if (!cancelled) setGroupIdByCode(map);
      } catch {
        // ถ้าโหลดไม่ได้ จะ fallback ไปกรองแบบหมวดหลัก
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  
// ---------- Load my study plans (for single plan across terms) ----------
useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const res = await listStudyPlans();
      const list = asArray<any>(res?.items ?? res);
      // sort latest first
      list.sort((a: any, b: any) => Number(b?.id ?? 0) - Number(a?.id ?? 0));
      if (cancelled) return;
      setMyPlans(list);

      // auto-pick latest plan that matches current track (if any)
      if (trackCode) {
        const match = list.find((p: any) => String(p?.track?.code ?? p?.trackCode ?? "").toUpperCase() === String(trackCode).toUpperCase());
        if (match?.id) {
          setSelectedPlanId(Number(match.id));
          setPlanName(String(match.planId ?? planName));
        } else if (list[0]?.id) {
          // if no track match, keep none selected to avoid confusion
          setSelectedPlanId(null);
        }
      }
    } catch {
      // ignore
    }
  })();
  return () => { cancelled = true; };
}, [trackCode]);

// when selected plan changes, load full plan (terms/entries) into cache
useEffect(() => {
  let cancelled = false;
  (async () => {
    if (!selectedPlanId) {
      setCreatedPlanId(null);
      setCreatedPlan(null);
      return;
    }
    try {
      const res = await getStudyPlan(Number(selectedPlanId));
      // backend returns { item } for GET /api/study-plans/:id
      const plan = res?.plan ?? res?.item ?? res;
      if (cancelled) return;
      setCreatedPlanId(Number(plan?.id ?? selectedPlanId));
      setCreatedPlan(plan);
      // keep plan name synced (but do not overwrite if user is typing for new plan)
      if (plan?.planId) setPlanName(String(plan.planId));
    } catch {
      // ignore
    }
  })();
  return () => { cancelled = true; };
}, [selectedPlanId]);

// ---------- Load plan by trackCode ----------
  useEffect(() => {
    if (!trackCode) {
      setTerms([]);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const res = await getTrackPlan(trackCode);

        /**
         * รองรับ response หลายแบบ:
         * - { terms: [...] }
         * - { planTerms: [...] }
         * - { items: [...] }
         * - [...] (array ตรง ๆ)
         */
        const rawTerms =
          (res && Array.isArray(res.terms) && res.terms) ||
          (res && Array.isArray(res.planTerms) && res.planTerms) ||
          (res && Array.isArray(res.items) && res.items) ||
          (Array.isArray(res) ? res : []);

        const list = asArray<PlanTerm>(rawTerms);

        // normalize courses + slots ให้เป็น array ชัวร์
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const normalized: PlanTerm[] = list.map((t: any) => {
          const courses =
            asArray<CourseRow>(t?.courses) ||
            asArray<CourseRow>(t?.courseEntries) ||
            asArray<CourseRow>(t?.items);

          const slots = asArray<Slot>(t?.slots);

          return {
            id: t?.id,
            year: num(t?.year, 1),
            term: num(t?.term, 1),
            courses,
            courseEntries: undefined,
            slots,
          };
        });

        if (cancelled) return;

        setTerms(normalized);

        // ตั้ง year/term default จาก term แรกที่มีจริง
        if (normalized.length > 0) {
          const y = normalized[0].year ?? 1;
          const tm = normalized[0].term ?? 1;
          setYear(y);
          setTerm(tm);
        } else {
          setYear(1);
          setTerm(1);
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "โหลดแผนการศึกษาไม่สำเร็จ");
        if (!cancelled) setTerms([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [trackCode]);

  // ---------- Derived lists ----------
  const yearOptions = useMemo(() => {
    const ys = Array.from(new Set(asArray<PlanTerm>(terms).map((t) => num(t.year, 1))))
      .filter((x) => x > 0)
      .sort((a, b) => a - b);
    return ys.length ? ys : [1, 2, 3, 4];
  }, [terms]);

  const termOptions = useMemo(() => {
    const ts = Array.from(
      new Set(
        asArray<PlanTerm>(terms)
          .filter((t) => num(t.year, 1) === num(year, 1))
          .map((t) => num(t.term, 1))
      )
    )
      .filter((x) => x > 0)
      .sort((a, b) => a - b);

    return ts.length ? ts : [1, 2];
  }, [terms, year]);

  const selectedTerm = useMemo(() => {
    const safe = asArray<PlanTerm>(terms);
    return (
      safe.find(
        (t) => num(t.year, 1) === num(year, 1) && num(t.term, 1) === num(term, 1)
      ) || null
    );
  }, [terms, year, term]);

  const rows = useMemo(() => {
    const list = asArray<CourseRow>(selectedTerm?.courses);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return list.map((r: any, idx) => ({
      id: r?.id ?? `${r?.courseId ?? "c"}-${idx}`,
      courseId: r?.courseId,
      code: r?.code ?? r?.courseCode ?? "",
      nameTh: r?.nameTh ?? r?.courseNameTh ?? r?.name ?? "",
      credits: num(r?.credits ?? r?.courseCredits, 0),
      groupName: r?.groupName ?? r?.group?.groupName ?? r?.group?.name ?? null,
      groupCode: r?.groupCode ?? r?.group?.groupCode ?? r?.group?.code ?? null,
      note: r?.note ?? r?.remark ?? null,
    }));
  }, [selectedTerm]);

  // ---------- helper: slot -> target groupCode (subgroup) ----------
  // NOTE: ใช้ function declaration เพื่อหลีกเลี่ยง TDZ (Cannot access before initialization)
  function slotTargetGroupCode(slot: Slot): string | null {
    const sc = String(slot?.slotCode ?? "").trim();
    const gc = String(slot?.groupCode ?? "").trim();

    // Placeholder patterns ตามหน้า 27–31
    if (/^00-1/i.test(sc)) return "GE_SOC_HUM"; // 00-1x-xxx
    if (/^00-41/i.test(sc)) return "GE_INTEGRATED"; // 00-41-xxx
    if (/^00-2/i.test(sc)) return "GE_LANGUAGE"; // 00-2x-xxx
    if (/^00-31/i.test(sc)) return "GE_SCI_MATH";
    if (/^04-06/i.test(sc)) return "MAJOR_ELECTIVE"; // 04-06-xxx กลุ่มวิชาเลือก
    if (/^xx/i.test(sc)) return "FREE_ELECTIVE"; // xx-xx-xxx วิชาเลือกเสรี

    return gc || null;
  }

  // helper: courseCode -> subgroup (fallback เฉพาะกรณี groupCode ไม่มา)
  function courseTargetGroupCode(courseCode?: string | null): string | null {
    const cc = String(courseCode ?? "").trim();
    if (!cc) return null;
    if (/^00-1/i.test(cc)) return "GE_SOC_HUM";
    if (/^00-41/i.test(cc)) return "GE_INTEGRATED";
    if (/^00-2/i.test(cc)) return "GE_LANGUAGE";
    if (/^00-31/i.test(cc)) return "GE_SCI_MATH";
    if (/^04-06/i.test(cc)) return "MAJOR_ELECTIVE";
    return null;
  }

  // slots ของเทอมที่เลือก (ประกาศก่อน fullTableRows เพื่อไม่ให้ TDZ)
  const slots = useMemo(() => asArray<Slot>(selectedTerm?.slots), [selectedTerm]);

  // ---- row key (สำคัญมาก): ต้อง stable ต่อแถว ไม่ผูกกับ courseId (เพราะ courseId เปลี่ยนได้)
  const rowKeyOf = (r: any) => {
    const code = String(r?.code ?? "").trim();
    if (r?.type === "slot") {
      return `slot:${String(r?.slotId ?? r?.id ?? code)}`;
    }
    // fixed rows: ใช้รหัสวิชา (slot code/requirement code) เป็นตัวระบุแถว
    return `fixed:${code || String(r?.id ?? "")}`;
  };

  // รวม fixed course + slot ให้เป็น table เดียว (ทุกแถวเป็น dropdown)
  const fullTableRows = useMemo(() => {
    const fixed = rows.map((r) => ({ type: "fixed" as const, ...r }));
    const srows = slots.map((s, idx) => {
      const sid = String(s.id ?? `slot-${idx}`);
      const targetCode = slotTargetGroupCode(s);
      return {
        type: "slot" as const,
        id: sid,
        slotId: sid,
        code: s.slotCode ?? "",
        nameTh: s.name ?? `Slot ${idx + 1}`,
        credits: s.minCredits ?? 0,
        groupCode: targetCode,
        groupName: null,
        note: s.note ?? null,
      };
    });

    return [...fixed, ...srows];
  }, [rows, slots]);

// ---------- Default selection (run per term): show recommended course immediately ----------
useEffect(() => {
  // ตั้งค่า default เฉพาะตอนเปลี่ยนเทอม/โหลดเทอมใหม่ เพื่อกัน overwrite ตอน user เปลี่ยนเอง
  const next: Record<string, number> = {};
  for (const r of fullTableRows as any[]) {
    const key = rowKeyOf(r);
    if (r.type === "fixed" && r.courseId && rowSelectedCourseId[key] == null) {
      next[key] = Number(r.courseId);
    }
  }
  if (Object.keys(next).length) {
    setRowSelectedCourseId((prev) => ({ ...prev, ...next }));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [selectedTerm?.id]);

// ---------- Default grade selection (sync from createdPlan if exists) ----------
useEffect(() => {
  if (!createdPlan || !Number(createdPlan?.id) || !planHasTerm(createdPlan, year, term)) return;
  const termId = findTermIdInPlan(createdPlan, year, term);
  if (!termId) return;

  const next: Record<string, string> = {};
  const terms = asArray<any>(createdPlan?.terms);
  const t = terms.find((x) => Number(x?.id) === Number(termId));
  const entries = asArray<any>(t?.entries);

  for (const r of fullTableRows as any[]) {
    const key = rowKeyOf(r);
    const cid = rowSelectedCourseId[key] ?? r.courseId;
    if (!cid) continue;
    const found = entries.find((e) => Number(e?.courseId) === Number(cid));
    if (found?.grade != null && String(found.grade).trim() !== "") {
      next[key] = String(found.grade);
    }
  }

  if (Object.keys(next).length) {
    setRowGrade((prev) => ({ ...prev, ...next }));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [createdPlan?.id, selectedTerm?.id, year, term]);

// ---------- Prefetch course options so dropdown can actually choose (no need to focus first) ----------
useEffect(() => {
  // wait until we know group ids
  if (!groupIdByCode || Object.keys(groupIdByCode).length === 0) return;

  const need = new Set<string>();
  for (const r of fullTableRows as any[]) {
    const gc = (r.groupCode as string | null) || courseTargetGroupCode(r.code) || "GENERAL";
    if (gc) need.add(String(gc));
  }

  // fire and forget
  need.forEach((gc) => {
    ensureCourseOptions(gc).catch(() => void 0);
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [fullTableRows, groupIdByCode]);



  const ensureCourseOptions = async (groupCode: string) => {
    if (!groupCode) return;
    if (courseOptionsByGroup[groupCode]) return;

    const groupId = groupIdByCode[groupCode] ?? groupIdByCode["GENERAL"];
    if (!groupId) return;

    const base = backendBaseUrl();
    const res = await fetchWithAuth(
      `${base}/api/courses?groupId=${encodeURIComponent(String(groupId))}&pageSize=500`,
      { method: "GET" }
    );
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const list = asArray<any>(data?.items || data?.courses || data);
    const mapped: CourseRow[] = list.map((c: any) => ({
      courseId: c?.id,
      code: c?.courseCode,
      nameTh: c?.courseNameTH,
      credits: num(c?.credits, 0),
      groupName: c?.group?.groupName ?? c?.groupName ?? null,
      groupCode: c?.group?.groupCode ?? c?.groupCode ?? null,
      note: null,
    }));
    setCourseOptionsByGroup((prev) => ({ ...prev, [groupCode]: mapped }));
  };

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(null), 2800);
  };

  
const ensurePlanCreated = async (): Promise<any> => {
  // ถ้าเลือกแผนเดิมอยู่แล้ว ใช้แผนนั้นเลย (แผนเดียวตลอด 4 ปี)
  if (selectedPlanId) {
    if (createdPlan && Number(createdPlan?.id) === Number(selectedPlanId)) return createdPlan;
    const res = await getStudyPlan(Number(selectedPlanId));
    const plan = res?.plan ?? res?.item ?? res;
    setCreatedPlanId(Number(plan?.id ?? selectedPlanId));
    setCreatedPlan(plan);
    return plan;
  }

  if (createdPlanId && createdPlan) return createdPlan;
  if (!trackCode) throw new Error("ยังไม่ได้เลือก Track");

  const name = (planName || "").trim();
  if (!name) throw new Error("กรุณากรอกชื่อแผน");

  // ✅ ใช้ชื่อที่กรอก “ตรง ๆ” เป็น planId ตามที่ต้องการ (ไม่เติม prefix/suffix)
  const planId = name;

  // createPlanFromTrack สร้าง “แผน” เท่านั้น (ยังไม่เพิ่มเทอม)
  const res = await createPlanFromTrack({ trackCode, planId, planName: name });
  const sp = res?.plan;
  if (!sp?.id) throw new Error(res?.message || "สร้างแผนไม่สำเร็จ");

  setCreatedPlanId(Number(sp.id));
  setCreatedPlan(sp);
  setSelectedPlanId(Number(sp.id));

  // refresh my plans list
  try {
    const r = await listStudyPlans();
    const list = asArray<any>(r?.items ?? r);
    list.sort((a: any, b: any) => Number(b?.id ?? 0) - Number(a?.id ?? 0));
    setMyPlans(list);
  } catch {}

  return sp;
};

  // helper: เช็คว่า plan มีเทอม (ปี/เทอม) นี้แล้วหรือยัง
  const planHasTerm = (plan: any, y: number, t: number) => {
    const list = asArray<any>(plan?.terms);
    return !!list.find((x) => Number(x?.termYear) === Number(y) && Number(x?.termNo) === Number(t));
  };

  const findTermIdInPlan = (plan: any, y: number, t: number): number | null => {
    const list = asArray<any>(plan?.terms);
    const found = list.find((x) => Number(x?.termYear) === Number(y) && Number(x?.termNo) === Number(t));
    return found?.id ? Number(found.id) : null;
  };

  const findEntryIdInPlan = (plan: any, termId: number, courseId: number): number | null => {
    const terms = asArray<any>(plan?.terms);
    const term = terms.find((x) => Number(x?.id) === Number(termId));
    const entries = asArray<any>(term?.entries);
    const found = entries.find((e) => Number(e?.courseId) === Number(courseId));
    return found?.id ? Number(found.id) : null;
  };

  const trackName = useMemo(() => {
    const t = tracks.find((x) => x.code === trackCode);
    return t?.name || trackCode || "-";
  }, [tracks, trackCode]);

  // ---------- UI ----------
  return (
    <div className={styles.page}>
      {toast ? (
        <div
          style={{
            position: "fixed",
            right: 16,
            top: 16,
            zIndex: 9999,
            padding: "10px 12px",
            borderRadius: 12,
            border: toast.type === "success" ? "1px solid #86efac" : "1px solid #fed7aa",
            background: toast.type === "success" ? "#f0fdf4" : "#fff7ed",
            color: toast.type === "success" ? "#166534" : "#9a3412",
            boxShadow: "0 10px 30px rgba(15,23,42,0.15)",
            maxWidth: 420,
            fontSize: 13,
            fontWeight: 700,
          }}
          role="status"
        >
          {toast.msg}
        </div>
      ) : null}

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <div className={styles.h2}>ตารางแผนการศึกษา</div>
            <div className={styles.sub}>
              แสดงโครงรายวิชาตามแผนการเรียน (Track) แยกตามชั้นปีและภาคเรียน
            </div>
          </div>
        </div>

        {/* NEW: single-column toolbar (changes layout significantly) */}
        <div className={styles.planBar}>
          <div className={styles.planBarRow}>
            <div className={styles.pillField}>
              <div className={styles.pillLabel}>Track</div>
              <select
                className={styles.pillControl}
                value={trackCode}
                onChange={(e) => setTrackCode(e.target.value)}
                disabled={loading}
              >
                {tracks.length === 0 ? <option value="">-</option> : null}
                {tracks.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name ? `${t.name} (${t.code})` : t.code}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.pillField}>
              <div className={styles.pillLabel}>เลือกแผน</div>
              <select
                className={styles.pillControl}
                value={selectedPlanId ? String(selectedPlanId) : ""}
                onChange={(e) => setSelectedPlanId(e.target.value ? Number(e.target.value) : null)}
                disabled={loading}
              >
                <option value="">ยังไม่มีแผน</option>
                {myPlans
                  .filter(
                    (p: any) =>
                      String(p?.track?.code ?? p?.trackCode ?? "").toUpperCase() ===
                      String(trackCode).toUpperCase()
                  )
                  .map((p: any) => (
                    <option key={String(p.id)} value={String(p.id)}>
                      {String(p.planId || p.planName || `Plan #${p.id}`)}
                    </option>
                  ))}
              </select>
            </div>

            <div className={styles.pillField}>
              <div className={styles.pillLabel}>ชั้นปี</div>
              <select
                className={styles.pillControl}
                value={String(year)}
                onChange={(e) => {
                  const y = num(e.target.value, 1);
                  setYear(y);

                  const nextTerms = Array.from(
                    new Set(
                      asArray<PlanTerm>(terms)
                        .filter((t) => num(t.year, 1) === y)
                        .map((t) => num(t.term, 1))
                    )
                  )
                    .filter((x) => x > 0)
                    .sort((a, b) => a - b);

                  setTerm(nextTerms?.[0] ?? 1);
                }}
                disabled={loading}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={String(y)}>
                    ปี {y}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.pillField}>
              <div className={styles.pillLabel}>ภาคเรียน</div>
              <select
                className={styles.pillControl}
                value={String(term)}
                onChange={(e) => setTerm(num(e.target.value, 1))}
                disabled={loading}
              >
                {termOptions.map((t) => (
                  <option key={t} value={String(t)}>
                    เทอม {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.planBarRow}>
            {!selectedPlanId ? (
              <div className={styles.pillField} style={{ flex: "1 1 360px" }}>
                <div className={styles.pillLabel}>ชื่อแผน (สร้างใหม่)</div>
                <input
                  className={styles.pillControl}
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="เช่น แผนหลัก"
                  disabled={creating}
                />
              </div>
            ) : (
              <div className={styles.planBarHint}>
                เพิ่มเทอมเข้าแผน: <b>{planName || "แผนที่เลือก"}</b>
              </div>
            )}

            <div className={styles.planBarActions}>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={loading || creating || !trackCode || (!selectedPlanId && !planName.trim())}
                onClick={async () => {
                  if (!trackCode) return;
                  setCreating(true);
                  setErr(null);
                  setCreatedMsg(null);
                  try {
                    if (selectedPlanId) {
                      const resp = await addTermFromTrack(Number(selectedPlanId), {
                        trackCode,
                        termYear: year,
                        termNo: term,
                      });
                      // IMPORTANT:
                      // บาง backend อาจ return แค่ summary (ไม่มี terms/entries ครบ)
                      // ทำให้ UI เข้าโหมด draft แล้วเกรดที่เลือก "ไม่ถูกบันทึก" รอบแรก
                      // (เพราะ planHasTerm(createdPlan, year, term) ยังเป็น false)
                      // ดังนั้นหลังเพิ่มเทอม ให้ refetch แผนเต็ม 1 รอบเสมอ
                      const pid = Number(resp?.plan?.id ?? resp?.studyPlan?.id ?? selectedPlanId);
                      try {
                        const rr = await getStudyPlan(pid);
                        const full = rr?.plan ?? rr?.item ?? rr;
                        if (full?.id) {
                          setCreatedPlanId(Number(full.id));
                          setCreatedPlan(full);
                        } else {
                          // fallback กรณี response แปลก
                          const plan = resp?.plan ?? resp?.studyPlan;
                          if (plan?.id) {
                            setCreatedPlanId(Number(plan.id));
                            setCreatedPlan(plan);
                          }
                        }
                      } catch {
                        // fallback กรณี refetch ไม่สำเร็จ
                        const plan = resp?.plan ?? resp?.studyPlan;
                        if (plan?.id) {
                          setCreatedPlanId(Number(plan.id));
                          setCreatedPlan(plan);
                        }
                      }
                      showToast("success", `เพิ่ม ปี ${year} เทอม ${term} เข้าแผนเดิมสำเร็จ`);
                    } else {
                      const p = await ensurePlanCreated();
                      await addTermFromTrack(Number(p.id), {
                        trackCode,
                        termYear: year,
                        termNo: term,
                      });
                      const rr = await getStudyPlan(Number(p.id));
                      const pp = rr?.plan ?? rr?.item ?? rr;
                      setCreatedPlan(pp);
                      showToast("success", `สร้างแผนและเพิ่ม ปี ${year} เทอม ${term} สำเร็จ`);
                    }
                  } catch (e: any) {
                    const msg = e?.message || (selectedPlanId ? "เพิ่มเทอมไม่สำเร็จ" : "สร้างแผนไม่สำเร็จ");
                    setErr(msg);
                    showToast("error", msg);
                  } finally {
                    setCreating(false);
                  }
                }}
              >
                {creating ? "กำลังบันทึก..." : selectedPlanId ? "เพิ่มเทอม" : "สร้างแผน"}
              </button>

              {createdPlanId ? (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => router.push(`/my-plan?planId=${createdPlanId}`)}
                >
                  ไปดูแผนที่สร้าง
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {createdMsg ? <div className={styles.success}>{createdMsg}</div> : null}
        {err ? <div className={styles.error}>{err}</div> : null}

        <div className={styles.meta}>
          <div className={styles.metaItem}>
            <span className={styles.metaKey}>Track:</span> {trackName}
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaKey}>ชั้นปี/เทอม:</span> ปี {year} เทอม {term}
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thCode}>รหัสวิชา</th>
                <th>เลือกวิชา</th>
                <th className={styles.thGroup}>หมวดวิชา</th>
                <th className={styles.thCredits}>หน่วยกิต</th>
                <th className={styles.thCredits}>เกรด</th>
                <th className={styles.thNote}>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className={styles.empty} colSpan={6}>
                    กำลังโหลด...
                  </td>
                </tr>
              ) : fullTableRows.length === 0 ? (
                <tr>
                  <td className={styles.empty} colSpan={6}>
                    ไม่พบข้อมูลรายวิชาสำหรับ ปี {year} เทอม {term}
                  </td>
                </tr>
              ) : (
                fullTableRows.map((r: any) => {
                  const key = rowKeyOf(r);
                  const isSlot = r.type === "slot";
                  // fixed: ใช้ groupCode ที่มากับ course ถ้าไม่มีให้ infer จาก courseCode
                  const targetGroupCode = (r.groupCode as string | null) || courseTargetGroupCode(r.code) || "GENERAL";
                  const selectedId = rowSelectedCourseId[key] ?? r.courseId;
                  const options = targetGroupCode ? courseOptionsByGroup[targetGroupCode] : undefined;

                  const selectedOpt = (options || []).find(
                    (o: any) => Number(o?.courseId) === Number(selectedId)
                  );
                  const displayCode = selectedOpt?.code || r.code || "-";
                  const displayGroup = selectedOpt?.groupName || r.groupName || targetGroupCode || "-";
                  const displayCredits =
                    Number.isFinite(Number(selectedOpt?.credits)) ? Number(selectedOpt?.credits) : (r.credits || "-");

                  return (
                    <tr key={key}>
                      <td className={styles.code}>{displayCode}</td>
                      <td className={styles.name}>
                        <select
                          className={styles.select}
                          value={selectedId ? String(selectedId) : ""}
                          disabled={!!rowSaving[key]}
                          onFocus={async () => {
                            if (targetGroupCode) {
                              try {
                                await ensureCourseOptions(targetGroupCode);
                              } catch {
                                /* ignore */
                              }
                            }
                          }}
                          onChange={async (e) => {
                            const cid = Number(e.target.value);
                            if (!cid) return;

                            // เก็บค่าเดิมไว้สำหรับ revert
                            const prevSelectedId = rowSelectedCourseId[key] ?? r.courseId;

                            // optimistic UI: เปลี่ยนให้เห็นทันที
                            setRowSelectedCourseId((p) => ({ ...p, [key]: cid }));
                            setErr(null);

                            // ✅ Draft mode: ยังไม่มีแผน/ยังไม่ได้เพิ่มเทอมนี้ → ให้เลือกได้ แต่ไม่บันทึก
                            if (!createdPlan || !Number(createdPlan?.id) || !planHasTerm(createdPlan, year, term)) {
                              showToast(
                                "success",
                                "เลือกวิชาแล้ว (ยังไม่บันทึก) — กด 'เพิ่มเทอม/สร้างแผน' ด้านบนเพื่อบันทึกลงแผน"
                              );
                              return;
                            }

                            setRowSaving((p) => ({ ...p, [key]: true }));
                            try {
                              // โหลด plan ล่าสุดก่อน เพื่อให้ termId/entries ตรง
                              const fresh = await getStudyPlan(Number(createdPlan.id));
                              const plan = fresh?.plan ?? fresh?.item ?? fresh;
                              const planId = Number(plan.id);
                              const termId = findTermIdInPlan(plan, year, term);
                              if (!termId) throw new Error("ยังไม่ได้เพิ่มเทอมนี้ในแผน (กดปุ่ม 'เพิ่มเทอม' ก่อน)");

                              // ลบ entry เดิมของแถวนี้ (ถ้ามี)
                              const prev =
                                rowEntryId[key] ??
                                (prevSelectedId
                                  ? findEntryIdInPlan(plan, termId, Number(prevSelectedId))
                                  : null);
                              if (prev) await deleteEntry(planId, termId, prev);

                              const resp = await addEntry(planId, termId, {
                                courseId: cid,
                                status: "PLANNED",
                              });
                              const eid = resp?.entry?.id;
                              if (typeof eid === "number") setRowEntryId((p) => ({ ...p, [key]: eid }));

                              // sync createdPlan
                              try {
                                const rr = await getStudyPlan(planId);
                                const pp = rr?.plan ?? rr?.item ?? rr;
                                setCreatedPlan(pp);
                              } catch {}

                              showToast("success", "บันทึกรายวิชาลงแผนสำเร็จ");
                            } catch (ex: any) {
                              const m = ex?.message || "บันทึกรายวิชาไม่สำเร็จ";
                              setErr(m);
                              showToast("error", m);

                              // revert ถ้าบันทึกพัง
                              if (prevSelectedId) {
                                setRowSelectedCourseId((p) => ({ ...p, [key]: Number(prevSelectedId) }));
                              }
                            } finally {
                              setRowSaving((p) => ({ ...p, [key]: false }));
                            }
                          }}
                        >
                          {!selectedId ? <option value="">เลือกวิชา...</option> : null}
                          {selectedId && (!options || !(options || []).some((o: any) => Number(o.courseId) === Number(selectedId))) ? (
                            <option value={String(selectedId)}>
                              {(selectedOpt?.code || r.code || "-") + " • " + (selectedOpt?.nameTh || r.nameTh || "")}
                            </option>
                          ) : null}
                          {targetGroupCode
                            ? (options || []).map((c: CourseRow) => (
                                <option key={String(c.courseId)} value={String(c.courseId)}>
                                  {c.code} • {c.nameTh}
                                </option>
                              ))
                            : null}
                        </select>
                        {isSlot ? (
                          <div className={styles.miniHint}>
                            {targetGroupCode ? `เลือกได้จากหมวด: ${targetGroupCode}` : ""}
                            {rowSaving[key] ? " • กำลังบันทึก..." : rowEntryId[key] ? " • บันทึกแล้ว" : ""}
                          </div>
                        ) : null}
                      </td>
                      <td className={styles.group}>{displayGroup}</td>
                      <td className={styles.credits}>{displayCredits}</td>
                      <td className={styles.credits}>
                        <select
                          className={styles.select}
                          value={rowGrade[key] ?? ""}
                          disabled={!!rowSaving[key]}
                          onChange={async (e) => {
                            const g = String(e.target.value || "");
                            setRowGrade((p) => ({ ...p, [key]: g }));
                            setErr(null);

                            // ✅ เป้าหมาย: เปลี่ยนเกรดครั้งแรกแล้วเข้า DB เลย
                            // ถ้าเทอม/entry ยังไม่ถูกสร้าง (race) → สร้างให้เอง แล้วค่อย update grade
                            if (!createdPlan || !Number(createdPlan?.id)) {
                              const m = "ยังไม่มีแผน (ให้กด 'สร้างแผน' ก่อน)";
                              setErr(m);
                              showToast("error", m);
                              return;
                            }

                            const planId = Number(createdPlan.id);
                            const cid =
                              rowSelectedCourseId[key] ??
                              (r.courseId as any) ??
                              (typeof r.id === "number" ? r.id : Number(r.id)) ??
                              (r as any)?.course?.id;
                            if (!cid || !Number(cid)) return;

                            setRowSaving((p) => ({ ...p, [key]: true }));
                            try {
                              // 1) โหลดแผนล่าสุด
                              let fresh = await getStudyPlan(planId);
                              let plan = fresh?.plan ?? fresh?.item ?? fresh;

                              // 2) หา termId ถ้าไม่มี → เพิ่มเทอมจาก track แล้ว refetch
                              let termId = findTermIdInPlan(plan, year, term);
                              if (!termId) {
                                await addTermFromTrack(planId, {
                                  trackCode,
                                  termYear: year,
                                  termNo: term,
                                });
                                fresh = await getStudyPlan(planId);
                                plan = fresh?.plan ?? fresh?.item ?? fresh;
                                termId = findTermIdInPlan(plan, year, term);
                              }
                              if (!termId) throw new Error("เพิ่มเทอมไม่สำเร็จ");

                              // 3) หา entryId ถ้าไม่มี → addEntry แล้ว refetch/ค้นใหม่
                              if (!termId) {
  throw new Error("เพิ่มเทอมไม่สำเร็จ (termId เป็น null)");
}
const safeTermId: number = termId;

// กัน cid แปลก ๆ
const courseIdNum = cid != null ? Number(cid) : NaN;

// eid ต้องเป็น let (เพราะเราจะ assign ทีหลัง)
let eid: number | null =
  rowEntryId[key] ??
  (Number.isFinite(courseIdNum)
    ? findEntryIdInPlan(plan, safeTermId, courseIdNum)
    : null);

if (!eid) {
  if (!Number.isFinite(courseIdNum)) {
    throw new Error("courseId ไม่ถูกต้อง");
  }

  const resp = await addEntry(planId, safeTermId, {
    courseId: courseIdNum,
    status: "PLANNED",
  });

  const newId = resp?.entry?.id;

  if (typeof newId === "number") {
    eid = newId;
    setRowEntryId((p) => ({ ...p, [key]: newId }));
  } else {
    // fallback: refetch แล้วค้นใหม่
    const rr = await getStudyPlan(planId);
    const pp = (rr as any)?.plan ?? (rr as any)?.item ?? rr;

    const found = findEntryIdInPlan(pp, safeTermId, courseIdNum);
    eid = found ?? null;
  }
}

if (!eid) {
  throw new Error("สร้างรายวิชาในแผนไม่สำเร็จ");
}

                              // 4) update grade
                              const payloadGrade = g ? g : null;
                              await updateEntry(planId, termId, Number(eid), { grade: payloadGrade });

                              // 5) ✅ sync ไป Transcript ด้วย (เพื่อคำนวณ GPA / เก็บผลการเรียนจริง)
                              // หมายเหตุ: backend รับเป็นตัวอักษร (A,B+,...) แล้วแปลงเป็น Float ใน DB
                              try {
                                const creditsNum = Number(displayCredits);
                                await upsertMyTranscript({
                                  courseId: Number(cid),
                                  yearNo: Number(year),
                                  termNo: Number(term),
                                  grade: g || "-",
                                  credits: Number.isFinite(creditsNum) ? creditsNum : undefined,
                                });
                              } catch (e) {
                                // ไม่ block UX หลัก (PlanEntry เข้าแล้ว) แต่จะแจ้งเตือนเพื่อให้รู้ว่าผลจริงยังไม่ถูก sync
                                console.error("sync transcript failed", e);
                                showToast("error", "บันทึก Transcript ไม่สำเร็จ (แต่ PlanEntry ถูกบันทึกแล้ว)");
                              }

                              // sync createdPlan เพื่อให้ status/pass-fail เปลี่ยนตาม grade
                              try {
                                const rr = await getStudyPlan(planId);
                                const pp = rr?.plan ?? rr?.item ?? rr;
                                setCreatedPlan(pp);
                              } catch {}

                              showToast("success", "บันทึกเกรดสำเร็จ (สถานะจะเปลี่ยนเป็น ผ่าน/ไม่ผ่าน อัตโนมัติ)");
                            } catch (ex: any) {
                              const m = ex?.message || "บันทึกเกรดไม่สำเร็จ";
                              setErr(m);
                              showToast("error", m);
                            } finally {
                              setRowSaving((p) => ({ ...p, [key]: false }));
                            }
                          }}
                        >
                          <option value="">-</option>
                          {GRADE_OPTIONS.map((x) => (
                            <option key={x} value={x}>
                              {x}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={styles.note}>{r.note || "-"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
