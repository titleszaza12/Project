/**
 * src/controllers/dashboard.controller.ts
 * ======================================================
 * Dashboard Controller
 *
 * เป้าหมายของไฟล์นี้:
 * - ทำ endpoint สำหรับหน้า Dashboard โดยดึง “ข้อมูลจริงจาก DB” เท่านั้น
 * - ไม่ใช้ placeholder และไม่ hardcode ตัวเลขในฝั่ง frontend
 *
 * Endpoint ที่ไฟล์นี้ดูแล
 * - GET /api/dashboard/summary?planId=
 *   สรุปข้อมูลนักศึกษา + หน่วยกิตผ่านแล้ว (Transcript) + หน่วยกิตที่วางแผน/ลงทะเบียน (PlanEntry)
 *   - completedCredits = Transcript ที่ "ผ่าน" เท่านั้น
 *   - plannedCredits   = PlanEntry.status ∈ {PLANNED, ENROLLED} เฉพาะแผนที่เลือก และไม่นับรายวิชาที่ผ่านแล้วซ้ำ
 *
 * - GET /api/dashboard/credit-breakdown?planId=
 *   สรุปหน่วยกิตรายหมวด (ผ่านแล้ว/ลงไว้/ต้องได้) ตามหมวดหลัก 4 หมวด
 *   - วิชาศึกษาทั่วไป
 *   - วิชาเฉพาะ (เอกบังคับ)
 *   - วิชาเลือก (เอกเลือก)
 *   - วิชาเสรี
 *
 * หลักการคำนวณ (ตาม requirement ล่าสุด)
 * - แยก 2 ก้อน
 *   1) ผ่านแล้ว (Completed)  -> Transcript ที่ผ่าน
 *   2) ลงวิชาไว้ (Planned)   -> PlanEntry.status ∈ {PLANNED, ENROLLED}
 * - Planned ต้องผูกกับ "StudyPlan ที่เลือก" (planId) และไม่นับซ้ำรายวิชา
 * - Planned จะไม่นับรายวิชาที่ผ่านแล้วซ้ำ (เพื่อไม่ให้ตัวเลขหลอก)
 * - requiredCredits (ต้องได้): อิง Curriculum.totalMinCredits (รวม) และ CreditRequirement ต่อหมวด (minCredits)
 */

import type { Request, Response } from "express";
import { prisma } from "../prisma";

// หมวดหลักที่ UI ต้องการแสดง (ยึดจาก seed ที่เราตั้ง groupCode ไว้)
const CATEGORY_ORDER = [
  "GENERAL",
  "MAJOR_REQUIRED",
  "MAJOR_ELECTIVE",
  "FREE_ELECTIVE",
] as const;

type CategoryCode = (typeof CATEGORY_ORDER)[number];

const CATEGORY_TH: Record<CategoryCode, string> = {
  GENERAL: "วิชาศึกษาทั่วไป",
  MAJOR_REQUIRED: "วิชาเฉพาะ (เอกบังคับ)",
  MAJOR_ELECTIVE: "วิชาเลือก (เอกเลือก)",
  FREE_ELECTIVE: "วิชาเสรี",
};

/**
 * helper: หา curriculum ที่ “นักศึกษาใช้อยู่จริง”
 * - ถ้านักศึกษามี StudyPlan -> ใช้ curriculumId จากแผนแรก
 * - ถ้าไม่มี -> fallback เป็น curriculum ตัวแรกในระบบ
 */
async function resolveCurriculumId(studentProfileId: number): Promise<number | null> {
  const sp = await prisma.studyPlan.findFirst({
    where: { studentId: studentProfileId },
    select: { curriculumId: true },
    orderBy: { id: "asc" },
  });

  if (sp?.curriculumId) return sp.curriculumId;

  const c = await prisma.curriculum.findFirst({
    select: { id: true },
    orderBy: { id: "asc" },
  });

  return c?.id ?? null;
}

async function resolveActivePlanId(studentProfileId: number, planIdRaw?: any): Promise<number | null> {
  const planId = typeof planIdRaw === "string" ? Number(planIdRaw) : typeof planIdRaw === "number" ? planIdRaw : NaN;
  if (Number.isFinite(planId)) {
    const ok = await prisma.studyPlan.findFirst({
      where: { id: planId, studentId: studentProfileId },
      select: { id: true },
    });
    if (ok) return ok.id;
  }

  const sp = await prisma.studyPlan.findFirst({
    where: { studentId: studentProfileId },
    select: { id: true },
    // NOTE: StudyPlan model ไม่มี updatedAt/createdAt ใน schema.prisma
    // ให้เรียงจาก id ล่าสุดแทน (แผนที่สร้างทีหลังจะ id มากกว่า)
    orderBy: { id: "desc" },
  });

  return sp?.id ?? null;
}

function normalizeCategory(
  groupCode?: string | null,
  parentCode?: string | null
): CategoryCode | null {
  if (groupCode && (CATEGORY_ORDER as readonly string[]).includes(groupCode)) return groupCode as CategoryCode;
  if (parentCode && (CATEGORY_ORDER as readonly string[]).includes(parentCode)) return parentCode as CategoryCode;

  const code = groupCode ?? parentCode ?? "";
  if (code.startsWith("GENERAL")) return "GENERAL";
  if (code.startsWith("MAJOR_REQUIRED")) return "MAJOR_REQUIRED";
  if (code.startsWith("MAJOR_ELECTIVE")) return "MAJOR_ELECTIVE";
  if (code.startsWith("FREE")) return "FREE_ELECTIVE";
  return null;
}


/**
 * helper: สรุปหน่วยกิตจาก PlanEntry (ตาม requirement ล่าสุด)
 * - นับเฉพาะ status ∈ {PASSED, PLANNED}
 * - ไม่นับซ้ำรายวิชา (courseId) ต่อคน
 * - ถ้ารายวิชาเดียวกันมีทั้ง PASSED และ PLANNED -> ให้ถือว่า PASSED (PASSED มี priority สูงกว่า)
 * - credits ที่ใช้:
 *   - PASSED: ใช้ earnedCredits ถ้ามี ไม่งั้นใช้ course.credits
 *   - PLANNED: ใช้ course.credits
 */
async function calculateCreditsFromPlanEntries(
  studentProfileId: number,
  planId: number | null
) {
  const wherePlan = planId
    ? { term: { studyPlan: { id: planId, studentId: studentProfileId } } }
    : { term: { studyPlan: { studentId: studentProfileId } } };

  const entries = await prisma.planEntry.findMany({
    where: {
      ...wherePlan,
      status: { in: ["PASSED", "PLANNED"] as any },
    },
    select: {
      status: true,
      earnedCredits: true,
      course: {
        select: {
          id: true,
          credits: true,
          group: {
            select: {
              groupCode: true,
              parentGroup: { select: { groupCode: true } },
            },
          },
        },
      },
    },
  });

  type Best = {
    status: "PASSED" | "PLANNED";
    credits: number;
    category: CategoryCode | null;
  };

  const bestByCourse = new Map<number, Best>();

  for (const e of entries) {
    const courseId = e.course.id;
    const cat = normalizeCategory(
      e.course.group?.groupCode ?? null,
      e.course.group?.parentGroup?.groupCode ?? null
    );
    const credits =
      e.status === "PASSED"
        ? Number(e.earnedCredits ?? e.course.credits ?? 0)
        : Number(e.course.credits ?? 0);

    const prev = bestByCourse.get(courseId);
    if (!prev) {
      bestByCourse.set(courseId, { status: e.status as any, credits, category: cat });
      continue;
    }

    // PASSED ชนะ PLANNED
    if (prev.status === "PLANNED" && e.status === "PASSED") {
      bestByCourse.set(courseId, { status: "PASSED", credits, category: cat });
      continue;
    }

    // ถ้าสถานะเท่ากัน เลือก credits ที่มากกว่า (กันข้อมูลแปลก)
    if (prev.status === e.status) {
      if (credits > prev.credits) bestByCourse.set(courseId, { status: prev.status, credits, category: cat });
    }
  }

  const passedByCategory: Record<CategoryCode, number> = {
    GENERAL: 0,
    MAJOR_REQUIRED: 0,
    MAJOR_ELECTIVE: 0,
    FREE_ELECTIVE: 0,
  };
  const plannedByCategory: Record<CategoryCode, number> = {
    GENERAL: 0,
    MAJOR_REQUIRED: 0,
    MAJOR_ELECTIVE: 0,
    FREE_ELECTIVE: 0,
  };

  let passedCredits = 0;
  let plannedCredits = 0;

  for (const v of bestByCourse.values()) {
    if (v.status === "PASSED") {
      passedCredits += v.credits;
      if (v.category) passedByCategory[v.category] += v.credits;
    } else {
      plannedCredits += v.credits;
      if (v.category) plannedByCategory[v.category] += v.credits;
    }
  }

  return { passedCredits, plannedCredits, passedByCategory, plannedByCategory };
}


/**
 * helper: นับหน่วยกิต “ลงแล้ว + ผ่าน” จาก PlanEntry
 * - นับตาม Course.credits เป็นหลัก
 * - ถ้า PASSED และมี earnedCredits ให้ใช้ earnedCredits (กันเคสเครดิตได้จริงไม่เท่ากัน)
 * - ไม่นับซ้ำรายวิชา (courseId) ภายในคนเดียว
 */
async function calculateCompletedFromTranscript(studentProfileId: number) {
  const transcripts = await prisma.transcript.findMany({
    where: { studentId: studentProfileId },
    select: {
      courseId: true,
      credits: true,
      grade: true,
      course: {
        select: {
          group: {
            select: {
              groupCode: true,
              parentGroup: { select: { groupCode: true } },
            },
          },
        },
      },
    },
  });

  const { isPassed } = await import("../utils/gpa.util");

  const passedCourseIds = new Set<number>();
  const creditsByCourseId = new Map<number, number>();
  const catByCourseId = new Map<number, CategoryCode | null>();


  const completedByCategory: Record<CategoryCode, number> = {
    GENERAL: 0,
    MAJOR_REQUIRED: 0,
    MAJOR_ELECTIVE: 0,
    FREE_ELECTIVE: 0,
  };

  let total = 0;
  for (const [courseId, credits] of creditsByCourseId.entries()) {
    total += credits;
    const cat = catByCourseId.get(courseId);
    if (cat) completedByCategory[cat] += credits;
  }

  return { passedCourseIds, totalCompletedCredits: total, completedByCategory };
}

async function calculatePlannedCreditsForPlan(
  studentProfileId: number,
  planId: number | null,
  excludeCourseIds?: Set<number>
) {
  const plannedByCategory: Record<CategoryCode, number> = {
    GENERAL: 0,
    MAJOR_REQUIRED: 0,
    MAJOR_ELECTIVE: 0,
    FREE_ELECTIVE: 0,
  };

  if (!planId) {
    return { totalPlannedCredits: 0, plannedByCategory };
  }

  const entries = await prisma.planEntry.findMany({
    where: {
      status: { in: ["PLANNED", "ENROLLED"] },
      term: { studyPlan: { id: planId, studentId: studentProfileId } },
    },
    select: {
      course: {
        select: {
          id: true,
          credits: true,
          group: {
            select: {
              groupCode: true,
              parentGroup: { select: { groupCode: true } },
            },
          },
        },
      },
    },
  });

  const creditsByCourseId = new Map<number, number>();
  const catByCourseId = new Map<number, CategoryCode | null>();

  for (const e of entries) {
    const courseId = e.course.id;
    if (excludeCourseIds?.has(courseId)) continue;

    const cat = normalizeCategory(
      e.course.group?.groupCode ?? null,
      e.course.group?.parentGroup?.groupCode ?? null
    );
    catByCourseId.set(courseId, cat);

    const prev = creditsByCourseId.get(courseId);
    creditsByCourseId.set(courseId, typeof prev === "number" ? Math.max(prev, e.course.credits) : e.course.credits);
  }

  let total = 0;
  for (const [courseId, credits] of creditsByCourseId.entries()) {
    total += credits;
    const cat = catByCourseId.get(courseId);
    if (cat) plannedByCategory[cat] += credits;
  }

  return { totalPlannedCredits: total, plannedByCategory };
}

/**
 * GET /api/dashboard/summary
 */
export async function getDashboardSummary(req: any, res: any) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const profile = await prisma.studentProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profileImageUrl: true,
        user: { select: { username: true } },
      },
    });

    if (!profile) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    const studentProfile = {
      id: profile.id,
      studentCode: profile.user?.username ?? "",
      firstName: profile.firstName,
      lastName: profile.lastName,
      profileImageUrl: profile.profileImageUrl ?? null,
    };

    const curriculumId = await resolveCurriculumId(profile.id);
    const curriculum = curriculumId
      ? await prisma.curriculum.findUnique({
          where: { id: curriculumId },
          select: { id: true, curriculumName: true, totalMinCredits: true },
        })
      : null;

    const totalRequired = curriculum?.totalMinCredits ?? 126;

    // ใช้ plan ล่าสุดเป็น default (ถ้าส่ง planId มาก็ใช้ของนั้น)
    const planId = await resolveActivePlanId(profile.id, req.query?.planId);

    // ✅ นับหน่วยกิตจาก PlanEntry เท่านั้น (PASSED + PLANNED)
    const credits = await calculateCreditsFromPlanEntries(profile.id, planId);

    const passedCredits = credits.passedCredits;
    const plannedOnlyCredits = credits.plannedCredits;
    const combinedCredits = passedCredits + plannedOnlyCredits;

    const progressPct =
      totalRequired > 0 ? Math.max(0, Math.min(100, Math.round((combinedCredits / totalRequired) * 100))) : 0;

    return res.json({
      studentProfile,
      curriculum,
      planId,
      // ✅ FE ใหม่: แยกให้ชัด
      passedCredits,
      plannedOnlyCredits,
      // ✅ FE เดิม: ใช้ plannedCredits เป็น "ผ่าน+วางแผน" ตาม requirement ล่าสุด
      plannedCredits: combinedCredits,
      enrolledPassedCredits: combinedCredits, // backward compatibility
      totalCreditsRequired: totalRequired,
      progressPct,
    });
  } catch (e: any) {
    console.error("getDashboardSummary error:", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

/**
 * GET /api/dashboard/credit-breakdown
 */
export async function getCreditBreakdown(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId as number | undefined;
    if (!userId) return res.status(401).json({ message: "กรุณาเข้าสู่ระบบ" });

    const sp = await prisma.studentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    const studentProfileId = sp?.id;
    if (!studentProfileId) return res.status(404).json({ message: "Student profile not found" });

    // fallback หน่วยกิตขั้นต่ำ
    const FALLBACK_REQUIRED: Record<CategoryCode, number> = {
      GENERAL: 30,
      MAJOR_REQUIRED: 78,
      MAJOR_ELECTIVE: 12,
      FREE_ELECTIVE: 6,
    };

    const curriculumId = await resolveCurriculumId(studentProfileId);
    const planId = await resolveActivePlanId(studentProfileId, (req as any).query?.planId);

    // 1) required credits ต่อหมวด (CreditRequirement)
    let groupCodeToGroupId = new Map<string, number>();
    let requiredByGroupId = new Map<number, number>();

    if (curriculumId) {
      const groups = await prisma.courseGroup.findMany({
        where: {
          curriculumId,
          groupCode: { in: [...CATEGORY_ORDER] },
        },
        select: { id: true, groupCode: true },
      });

      for (const g of groups) groupCodeToGroupId.set(g.groupCode, g.id);

      const reqs = await prisma.creditRequirement.findMany({
        where: { curriculumId, courseGroupId: { in: groups.map((g) => g.id) } },
        select: { courseGroupId: true, minCredits: true },
      });

      for (const r of reqs) requiredByGroupId.set(r.courseGroupId, r.minCredits);
    }

    // 2) earned = PlanEntry (PASSED/PLANNED) เท่านั้น
    const credits = await calculateCreditsFromPlanEntries(studentProfileId, planId);

    // 3) response
    const byCategory = CATEGORY_ORDER.map((code) => {
      const gid = groupCodeToGroupId.get(code);
      const requiredCredits = gid ? requiredByGroupId.get(gid) ?? FALLBACK_REQUIRED[code] : FALLBACK_REQUIRED[code];

      const completedCredits = credits.passedByCategory[code];
      const plannedCredits = credits.plannedByCategory[code];
      const earnedCredits = completedCredits + plannedCredits;

      return {
        code,
        nameTH: CATEGORY_TH[code],
        completedCredits,
        plannedCredits,
        earnedCredits,
        requiredCredits,
      };
    });

    return res.json({
      curriculumId: curriculumId ?? null,
      planId,
      byCategory,
    });
  } catch (e: any) {
    console.error("getCreditBreakdown error:", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

/**
 * GET /api/dashboard/plans-overview
 *
 * สรุปหน่วยกิต “ลงไว้” แยกตามแต่ละ StudyPlan ของนักศึกษา
 * - completedCredits: จาก Transcript (เหมือนกันทุกแผน)
 * - plannedCredits: จาก PlanEntry (PLANNED/ENROLLED) ของแผนนั้น ๆ และไม่นับซ้ำรายวิชาที่ผ่านแล้ว
 */
export async function getPlansOverview(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId as number | undefined;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const sp = await prisma.studentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    const studentProfileId = sp?.id;
    if (!studentProfileId) return res.status(404).json({ message: "Student profile not found" });

    const curriculumId = await resolveCurriculumId(studentProfileId);
    const curriculum = curriculumId
      ? await prisma.curriculum.findUnique({
          where: { id: curriculumId },
          select: { id: true, totalMinCredits: true },
        })
      : null;
    const totalRequired = curriculum?.totalMinCredits ?? 126;

    const completed = await calculateCompletedFromTranscript(studentProfileId);

    const plans = await prisma.studyPlan.findMany({
      where: { studentId: studentProfileId },
      select: {
        id: true,
        planId: true,
        track: { select: { code: true, nameTH: true } },
      },
      orderBy: { id: "asc" },
    });

    const out: any[] = [];
    for (const p of plans) {
      const planned = await calculatePlannedCreditsForPlan(
        studentProfileId,
        p.id,
        completed.passedCourseIds
      );

      const combined = completed.totalCompletedCredits + planned.totalPlannedCredits;
      const progressPct = totalRequired > 0 ? Math.round((combined / totalRequired) * 100) : 0;

      out.push({
        id: p.id,
        planId: p.planId,
        track: p.track ? { code: p.track.code, nameTH: p.track.nameTH } : null,
        completedCredits: completed.totalCompletedCredits,
        plannedCredits: planned.totalPlannedCredits,
        combinedCredits: combined,
        totalCreditsRequired: totalRequired,
        progressPct,
        remainingAfterPlan: Math.max(0, totalRequired - combined),
        plannedByCategory: planned.plannedByCategory,
      });
    }

    return res.json({
      curriculumId,
      totalCreditsRequired: totalRequired,
      completedCredits: completed.totalCompletedCredits,
      plans: out,
    });
  } catch (e: any) {
    console.error("getPlansOverview error:", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}