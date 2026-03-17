"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./courses.module.css";

import { getCurriculum } from "@/lib/curriculumApi";
import { getCourseGroups, getCourses } from "@/lib/coursesApi";

type Curriculum = { id: number; name?: string | null };

type CourseGroup = {
  id: number;
  groupCode: string;
  groupName: string;
  parentGroupId?: number | null;
};

type Course = {
  id: number;
  courseCode: string;
  courseNameTH: string;
  credits: number;
  groupId?: number | null;
  group?: { id: number; groupName: string; groupCode?: string } | null;
};

const PAGE_SIZE = 10;

function toArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p: any = payload;
    const candidates = [p.items, p.data, p.rows, p.results, p.result];
    for (const c of candidates) {
      if (Array.isArray(c)) return c as T[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (c && typeof c === "object" && Array.isArray((c as any).items)) return (c as any).items as T[];
    }
  }
  return [];
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}

/**
 * ตัดหมวด "รวม/แม่" ออกจาก dropdown
 * ตามที่ตี้ต้องการให้เอาออก:
 * - หมวดวิชาศึกษาทั่วไป (GENERAL)
 * - หมวดวิชาเฉพาะ (MAJOR_REQUIRED/MAJOR_ELECTIVE)
 * - หมวดวิชาเลือกเสรี (FREE_ELECTIVE)
 * - หมวดรวม (GE_TOTAL/MAJOR_TOTAL/FREE_TOTAL)
 */
function isSelectableGroup(g: CourseGroup) {
  // ✅ แสดง “ทุกหมวด” ใน dropdown
  // ตัดเฉพาะหมวดสรุปรวม (TOTAL) ที่ไม่ใช่หมวดจริงของรายวิชา
  const bannedCodes = new Set(["GE_TOTAL", "MAJOR_TOTAL", "FREE_TOTAL"]);

  if (bannedCodes.has(g.groupCode)) return false;

  return true;
}

export default function CoursesPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [curriculumId, setCurriculumId] = useState<number | null>(null);
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);

  const [groups, setGroups] = useState<CourseGroup[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  const [groupId, setGroupId] = useState<string>("all");
  const [q, setQ] = useState<string>("");

  // ✅ พิมพ์แล้วค้นหาทันที แต่ไม่ยิงถี่ (400ms)
  const qDebounced = useDebouncedValue(q, 400);

  const [page, setPage] = useState<number>(1);

  async function fetchCourses(id: number, nextGroupId: string, keyword: string) {
    const gid = nextGroupId === "all" ? null : Number(nextGroupId);
    const qv = keyword.trim();

    const cRes = await getCourses({
      curriculumId: id,
      groupId: gid,
      q: qv ? qv : undefined,
    });

    return toArray<Course>(cRes);
  }

  // 1) โหลด curriculum
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const curRes = await getCurriculum();
        const list = toArray<Curriculum>(curRes);

        if (!cancelled) {
          setCurriculums(list);
          setCurriculumId(list?.[0]?.id ?? null);
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "โหลดข้อมูลหลักสูตรไม่สำเร็จ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // 2) โหลด groups + courses ครั้งแรกเมื่อ curriculumId พร้อม
  useEffect(() => {
    if (curriculumId == null) return;
    const id = curriculumId;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const [gRes, cs] = await Promise.all([
          getCourseGroups(id),
          fetchCourses(id, "all", ""),
        ]);

        const gsAll = toArray<CourseGroup>(gRes);
        const gs = gsAll.filter(isSelectableGroup);

        if (!cancelled) {
          setGroups(gs);
          setCourses(cs);

          setGroupId("all");
          setQ("");
          setPage(1);
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "โหลดรายวิชาไม่สำเร็จ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [curriculumId]);

  // 3) ทุกครั้งที่ “หมวด” หรือ “ข้อความค้นหา (debounced)” เปลี่ยน -> ยิง API ใหม่ทันที
  useEffect(() => {
    if (curriculumId == null) return;
    const id = curriculumId;

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const cs = await fetchCourses(id, groupId, qDebounced);

        if (!cancelled) {
          setCourses(cs);
          setPage(1);
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "ค้นหารายวิชาไม่สำเร็จ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [curriculumId, groupId, qDebounced]);

  // pagination
  const safeCourses = useMemo(() => (Array.isArray(courses) ? courses : []), [courses]);

  const totalPages = Math.max(1, Math.ceil(safeCourses.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return safeCourses.slice(start, start + PAGE_SIZE);
  }, [safeCourses, safePage]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.h2}>รายวิชาทั้งหมด</div>
          <div className={styles.sub}>ค้นหาด้วยรหัสวิชา/ชื่อวิชา (ไทยหรืออังกฤษ)</div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.field}>
            <label className={styles.label}>หมวด</label>
            <select
              className={styles.select}
              value={groupId}
              onChange={(e) => {
                setGroupId(e.target.value);
                setPage(1);
              }}
              disabled={loading}
            >
              <option value="all">ทุกหมวด</option>
              {groups.map((g) => (
                <option key={g.id} value={String(g.id)}>
                  {g.groupName}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.searchWrap}>
            <input
              className={styles.search}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="ค้นหา..."
              // ✅ ไม่ disable เพื่อให้พิมพ์ได้ตลอด
            />
            {/* ปุ่ม “ค้นหา” ไม่จำเป็นแล้วเพราะพิมพ์แล้วค้นหาอัตโนมัติ
                แต่ถ้าตี้อยากเก็บไว้ ก็ใส่ปุ่มแล้วเรียก setQ(q) ได้ */}
          </div>
        </div>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thCode}>รหัสวิชา</th>
              <th>ชื่อรายวิชา</th>
              <th>หมวดวิชา</th>
              <th className={styles.thCredits}>หน่วยกิต</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className={styles.empty}>
                  กำลังโหลด...
                </td>
              </tr>
            ) : pageItems.length === 0 ? (
              <tr>
                <td colSpan={4} className={styles.empty}>
                  ไม่พบรายวิชา
                </td>
              </tr>
            ) : (
              pageItems.map((c) => {
                const groupName =
                  c.group?.groupName ??
                  groups.find((g) => g.id === c.groupId)?.groupName ??
                  "-";

                return (
                  <tr key={c.id}>
                    <td className={styles.code}>{c.courseCode}</td>
                    <td className={styles.name}>{c.courseNameTH}</td>
                    <td>{groupName}</td>
                    <td className={styles.credits}>{c.credits}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.footer}>
        <div className={styles.count}>
          แสดง {(safePage - 1) * PAGE_SIZE + (pageItems.length ? 1 : 0)}-
          {(safePage - 1) * PAGE_SIZE + pageItems.length} จาก {safeCourses.length} รายวิชา
        </div>

        <div className={styles.pager}>
          <button
            className={styles.pageBtn}
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1 || loading}
          >
            ก่อนหน้า
          </button>

          <span className={styles.pagePill}>
            หน้า {safePage}/{totalPages}
          </span>

          <button
            className={styles.pageBtn}
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages || loading}
          >
            ถัดไป
          </button>
        </div>
      </div>
    </div>
  );
}