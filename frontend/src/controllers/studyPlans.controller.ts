/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * src/controllers/studyPlans.controller.ts
 * ======================================================
 * StudyPlan Controller (ของนักศึกษา)
 *
 * เป้าหมาย:
 * - ให้นักศึกษาสร้าง/จัดการแผนการเรียนของตัวเองได้
 * - นักศึกษาจะ "เลือกวิชาเอง" ตามหมวด/กลุ่มวิชาที่ระบบกำหนด
 *
 * ✅ IMPORTANT (ตาม requirement ล่าสุดของตี้)
 * ------------------------------------------------------
 * - เรา "ไม่ใช้ placeholder ใน PlanEntry" แล้ว
 * - PlanEntry จะเก็บเฉพาะ "รายวิชาจริง" ที่นักศึกษาเลือกเท่านั้น
 *
 * แล้วบรรทัดประเภท "เลือกจากกลุ่ม..." อยู่ที่ไหน?
 * - อยู่ใน TrackPlanSlot (โครงแผนมาตรฐานของ Track)
 * - UI หน้า "จัดการแผนการเรียน" สามารถเรียก /api/tracks/:code/plan
 *   เพื่อเอา "ช่องที่ต้องเลือก" (slots) ไปแสดงเป็น guideline ได้
 *
 * ------------------------------------------------------
 * Endpoint (Base: /api/study-plans)
 * ------------------------------------------------------
 * - GET    /                       listMyPlans
 * - GET    /:id                    getMyPlanById
 * - POST   /                       createPlan
 * - POST   /from-track             createPlanFromTrack
 * - DELETE /:id                    deletePlan
 *
 * Term:
 * - POST   /:id/terms              addTerm
 * - DELETE /:id/terms/:termId      removeTerm
 *
 * Entry:
 * - POST   /:id/terms/:termId/entries                 addEntry
 * - PUT    /:id/terms/:termId/entries/:entryId        updateEntry
 * - DELETE /:id/terms/:termId/entries/:entryId        removeEntry
 *
 * Validate (MVP):
 * - POST   /:id/validate           validatePlan
 */
import type { Request, Response } from "express";
import { prisma } from "../prisma";
import type { EntryStatus, TermType } from "@prisma/client";
import { pickFirstOrThrow } from "../utils/req";

/** ดึง StudentProfile ของผู้ใช้จาก token */
async function requireStudentProfile(userId: number) {
  const sp = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!sp) {
    const err: any = new Error("ไม่พบ StudentProfile ของผู้ใช้ (อาจยังไม่ได้ register ถูกต้อง)");
    err.status = 400;
    throw err;
  }
  return sp;
}

/** ตรวจว่า plan นี้เป็นของนักศึกษาคนนี้จริง */
async function requireOwnedPlan(planId: number, studentId: number) {
  const plan = await prisma.studyPlan.findFirst({
    where: { id: planId, studentId },
  });
  if (!plan) {
    const err: any = new Error("ไม่พบแผนการเรียน หรือไม่มีสิทธิ์เข้าถึงแผนนี้");
    err.status = 404;
    throw err;
  }
  return plan;
}

// ------------------------------------------------------
// Helpers: แปลงค่าจาก request ให้เป็น Prisma enum (กัน type เพี้ยน)
// ------------------------------------------------------
function toEntryStatus(s: any): EntryStatus | undefined {
  if (s === null || s === undefined) return undefined;
  const v = String(s).trim().toUpperCase();
  if (v === "PLANNED" || v === "ENROLLED" || v === "PASSED" || v === "FAILED" || v === "DROPPED") {
    return v as EntryStatus;
  }
  return undefined;
}

function toTermType(s: any): TermType {
  const v = String(s ?? "").trim().toUpperCase();
  if (v === "SEMESTER" || v === "SUMMER") return v as TermType;
  return "SEMESTER" as TermType;
}


export async function listMyPlans(req: Request, res: Response) {
  const student = await requireStudentProfile(req.user!.userId);

  const items = await prisma.studyPlan.findMany({
    where: { studentId: student.id },
    include: {
      curriculum: true,
      track: true,
      terms: {
        include: { entries: { include: { course: true } } },
        orderBy: [{ termYear: "asc" }, { termNo: "asc" }],
      },
      validationRuns: { orderBy: { startedAt: "desc" }, take: 1, include: { results: { include: { rule: true, term: true, course: true } } } },
    },
    orderBy: { id: "desc" },
  });

  const shaped = items.map((p) => ({
    ...p,
    validationRuns: (p.validationRuns || []).map((r: any) => ({
      ...r,
      violations: (r.results || [])
        .filter((x: any) => x.severity === "ERROR")
        .map((x: any) => ({
          id: x.id,
          ruleCode: x.rule?.ruleCode,
          messageTH: x.message,
          severity: x.severity,
          termId: x.termId,
          courseId: x.courseId,
        })),
    })),
  }));

  return res.json({ items: shaped });
}

export async function getMyPlanById(req: Request, res: Response) {
  const student = await requireStudentProfile(req.user!.userId);
  const id = Number(pickFirstOrThrow(req.params.id, "id"));

  await requireOwnedPlan(id, student.id);

  const item = await prisma.studyPlan.findUnique({
    where: { id },
    include: {
      curriculum: true,
      track: true,
      terms: {
        include: { entries: { include: { course: true } } },
        orderBy: [{ termYear: "asc" }, { termNo: "asc" }],
      },
      validationRuns: {
        orderBy: { startedAt: "desc" },
        include: { results: { include: { rule: true, course: true, term: true } } },
      },
    },
  });

  const shaped = item
    ? {
        ...item,
        validationRuns: (item.validationRuns || []).map((r: any) => ({
          ...r,
          violations: (r.results || [])
            .filter((x: any) => x.severity === "ERROR")
            .map((x: any) => ({
              id: x.id,
              ruleCode: x.rule?.ruleCode,
              messageTH: x.message,
              severity: x.severity,
              termId: x.termId,
              courseId: x.courseId,
            })),
        })),
      }
    : null;

  return res.json({ item: shaped });
}

/**
 * POST /api/study-plans
 * สร้างแผนการเรียนเปล่า (นักศึกษาเพิ่มเทอม/วิชาเอง)
 *
 * body:
 * - planId?: string (optional)
 * - curriculumId?: number (optional; ถ้าไม่ส่งจะใช้ curriculum ตัวแรก)
 * - trackCode?: "COOP" | "JOB_TRAINING" (optional)
 */
export async function createPlan(req: Request, res: Response) {
  const student = await requireStudentProfile(req.user!.userId);

  const { planId, curriculumId, trackCode } = req.body ?? {};

  const curriculum =
    typeof curriculumId === "number"
      ? await prisma.curriculum.findUnique({ where: { id: curriculumId } })
      : await prisma.curriculum.findFirst({ orderBy: { id: "asc" } });

  if (!curriculum) return res.status(400).json({ message: "ไม่พบข้อมูล Curriculum ในระบบ" });

  const track = trackCode ? await prisma.track.findUnique({ where: { code: String(trackCode) } }) : null;

  const created = await prisma.studyPlan.create({
    data: {
      planId: planId ? String(planId) : `PLAN-${student.userId}-${Date.now()}`,
      studentId: student.id,
      curriculumId: curriculum.id,
      trackId: track?.id ?? null,
    },
    include: { curriculum: true, track: true },
  });

  return res.status(201).json({ message: "สร้างแผนการเรียนสำเร็จ", plan: created });
}

/**
 * POST /api/study-plans/from-track
 * ======================================================
 * สร้างแผนการเรียน "เริ่มต้น" จากโครงแผนมาตรฐานของ Track
 *
 * แนวคิด:
 * - เราสร้าง StudyPlan + Term ตาม TrackPlanTerm
 * - และ (optional) ใส่วิชาบังคับ/แนะนำจาก TrackPlanCourse เป็น PlanEntry (status=PLANNED)
 * - นักศึกษาจะเติมวิชาเองเพิ่มเติมตาม TrackPlanSlot (ดู guideline จาก /api/tracks/:code/plan)
 *
 * body:
 * - trackCode: "COOP" | "JOB_TRAINING"
 * - planId?: string (optional)
 * - termYear?: number (optional; default = 1)
 * - termNo?: number (optional; default = 1)
 */
export async function createPlanFromTrack(req: Request, res: Response) {
  const student = await requireStudentProfile(req.user!.userId);
  const { trackCode, planId, termYear, termNo } = req.body ?? {};

  if (!trackCode) return res.status(400).json({ message: "กรุณาระบุ trackCode (COOP/JOB_TRAINING)" });

  const track = await prisma.track.findUnique({
    where: { code: String(trackCode) },
    include: {
      curriculum: true,
      planTerms: {
        orderBy: { sortOrder: "asc" },
        include: { courseEntries: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  if (!track) return res.status(404).json({ message: "ไม่พบแผนการเรียน (Track) ที่ร้องขอ" });

  // ✅ Requirement ล่าสุด: สร้างเฉพาะ "ปี/เทอมที่เลือก" เท่านั้น
  // - ถ้า frontend ยังไม่ส่งมา จะ default เป็น ปี 1 เทอม 1
  const targetYear = Number.isFinite(Number(termYear)) ? Number(termYear) : 1;
  const targetTermNo = Number.isFinite(Number(termNo)) ? Number(termNo) : 1;

  const targetPlanTerm = (track.planTerms || []).find(
    (t: any) => Number(t.year) === targetYear && Number(t.termNo) === targetTermNo
  );

  if (!targetPlanTerm) {
    return res.status(400).json({
      message: `ไม่พบโครงเทอมของ Track สำหรับ ปี ${targetYear} เทอม ${targetTermNo}`,
    });
  }

  const created = await prisma.$transaction(async (tx) => {
    const sp = await tx.studyPlan.create({
      data: {
        planId: planId ? String(planId) : `PLAN-${student.userId}-${track.code}-${Date.now()}`,
        studentId: student.id,
        curriculumId: track.curriculumId,
        trackId: track.id,
      },
    });

    // สร้าง Term เฉพาะปี/เทอมที่เลือก
    const term = await tx.term.create({
      data: {
        studyPlanId: sp.id,
        termYear: targetPlanTerm.year,
        termNo: targetPlanTerm.termNo,
        termType: toTermType(targetPlanTerm.termType),
      },
    });

    // ใส่วิชาจริงที่อยู่ใน TrackPlanCourse ของเทอมนี้ลงเป็น PlanEntry (PLANNED)
    for (const ce of targetPlanTerm.courseEntries || []) {
      await tx.planEntry.create({
        data: {
          termId: term.id,
          courseId: ce.courseId,
          status: "PLANNED" as EntryStatus,
        },
      });
    }

    return sp;
  });

  const full = await prisma.studyPlan.findUnique({
    where: { id: created.id },
    include: {
      curriculum: true,
      track: true,
      terms: { include: { entries: { include: { course: true } } }, orderBy: [{ termYear: "asc" }, { termNo: "asc" }] },
    },
  });

  return res.status(201).json({ message: "สร้างแผนจากแผนการเรียนสำเร็จ", plan: full });
}

/**
 * POST /api/study-plans/:id/add-term-from-track
 * เพิ่มเทอม (ปี/เทอมที่เลือก) จาก Track template เข้า "แผนเดิม" โดยไม่สร้าง StudyPlan ใหม่
 * body: { trackCode, termYear, termNo }
 */
export async function addTermFromTrack(req: Request, res: Response) {
  const student = await requireStudentProfile(req.user!.userId);
  const planId = Number(pickFirstOrThrow(req.params.id, "id"));
  await requireOwnedPlan(planId, student.id);

  const { trackCode, termYear, termNo } = req.body ?? {};
  if (!trackCode) return res.status(400).json({ message: "กรุณาระบุ trackCode (COOP/JOB_TRAINING)" });
  if (!termYear || !termNo) return res.status(400).json({ message: "กรุณาระบุ termYear และ termNo" });

  const plan = await prisma.studyPlan.findUnique({ where: { id: planId } });
  if (!plan) return res.status(404).json({ message: "ไม่พบแผนการเรียน" });

  // กันซ้ำ: ถ้ามีเทอมนี้อยู่แล้ว
  const exists = await prisma.term.findFirst({
    where: { studyPlanId: planId, termYear: Number(termYear), termNo: Number(termNo) },
    select: { id: true },
  });
  if (exists) {
    return res.status(409).json({ message: `เทอม ปี ${Number(termYear)} เทอม ${Number(termNo)} มีอยู่แล้วในแผนนี้` });
  }

  const track = await prisma.track.findUnique({
    where: { code: String(trackCode) },
    include: {
      planTerms: {
        orderBy: { sortOrder: "asc" },
        include: { courseEntries: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!track) return res.status(404).json({ message: "ไม่พบแผนการเรียน (Track) ที่ร้องขอ" });

  const targetYear = Number(termYear);
  const targetTermNo = Number(termNo);

  const targetPlanTerm = (track.planTerms || []).find(
    (t: any) => Number(t.year) === targetYear && Number(t.termNo) === targetTermNo
  );
  if (!targetPlanTerm) {
    return res.status(400).json({ message: `ไม่พบโครงเทอมของ Track สำหรับ ปี ${targetYear} เทอม ${targetTermNo}` });
  }

  // สร้าง Term + PlanEntry เฉพาะเทอมนั้น
  await prisma.$transaction(async (tx) => {
    const term = await tx.term.create({
      data: {
        studyPlanId: planId,
        termYear: targetPlanTerm.year,
        termNo: targetPlanTerm.termNo,
        termType: toTermType(targetPlanTerm.termType),
      },
    });

    for (const ce of targetPlanTerm.courseEntries || []) {
      await tx.planEntry.create({
        data: { termId: term.id, courseId: ce.courseId, status: "PLANNED" },
      });
    }
  });

  const full = await prisma.studyPlan.findUnique({
    where: { id: planId },
    include: {
      curriculum: true,
      track: true,
      terms: {
        include: { entries: { include: { course: true } } },
        orderBy: [{ termYear: "asc" }, { termNo: "asc" }],
      },
    },
  });

  return res.status(201).json({ message: "เพิ่มเทอมเข้าแผนสำเร็จ", plan: full });
}

export async function deletePlan(req: Request, res: Response) {
  const student = await requireStudentProfile(req.user!.userId);
  const id = Number(pickFirstOrThrow(req.params.id, "id"));

  await requireOwnedPlan(id, student.id);

  await prisma.studyPlan.delete({ where: { id } });
  return res.json({ message: "ลบแผนการเรียนสำเร็จ" });
}

/**
 * POST /api/study-plans/:id/terms
 * เพิ่มเทอมให้แผน (ใช้กรณีไม่ได้สร้างจาก track หรืออยากเพิ่มเทอมเอง)
 *
 * body: { termYear, termNo, termType? }
 */
export async function addTerm(req: Request, res: Response) {
  const student = await requireStudentProfile(req.user!.userId);
  const id = Number(pickFirstOrThrow(req.params.id, "id"));
  await requireOwnedPlan(id, student.id);

  const { termYear, termNo, termType } = req.body ?? {};
  if (!termYear || !termNo) return res.status(400).json({ message: "กรุณาระบุ termYear และ termNo" });

  const term = await prisma.term.create({
    data: {
      studyPlanId: id,
      termYear: Number(termYear),
      termNo: Number(termNo),
      termType: toTermType(termType),
    },
  });

  return res.status(201).json({ message: "เพิ่มเทอมสำเร็จ", term });
}

export async function removeTerm(req: Request, res: Response) {
  const student = await requireStudentProfile(req.user!.userId);
  const planId = Number(pickFirstOrThrow(req.params.id, "id"));
  const termId = Number(pickFirstOrThrow(req.params.termId, "termId"));

  await requireOwnedPlan(planId, student.id);

  // ensure term belongs to plan
  const term = await prisma.term.findFirst({ where: { id: termId, studyPlanId: planId } });
  if (!term) return res.status(404).json({ message: "ไม่พบเทอม หรือไม่มีสิทธิ์เข้าถึง" });

  await prisma.term.delete({ where: { id: termId } });
  return res.json({ message: "ลบเทอมสำเร็จ" });
}

/**
 * POST /api/study-plans/:id/terms/:termId/entries
 * เพิ่มรายวิชาจริงเข้าเทอม (นักศึกษาเลือกเอง)
 *
 * body: { courseId, status? }
 */
export async function addEntry(req: Request, res: Response) {
  const student = await requireStudentProfile(req.user!.userId);
  const planId = Number(pickFirstOrThrow(req.params.id, "id"));
  const termId = Number(pickFirstOrThrow(req.params.termId, "termId"));

  await requireOwnedPlan(planId, student.id);

  const term = await prisma.term.findFirst({ where: { id: termId, studyPlanId: planId } });
  if (!term) return res.status(404).json({ message: "ไม่พบเทอม หรือไม่มีสิทธิ์เข้าถึง" });

  const { courseId, status } = req.body ?? {};
  if (!courseId) return res.status(400).json({ message: "กรุณาระบุ courseId" });

  const created = await prisma.planEntry.create({
    data: {
      termId: term.id,
      courseId: Number(courseId),
      status: toEntryStatus(status) ?? ("PLANNED" as EntryStatus),
    },
    include: { course: true },
  });

  return res.status(201).json({ message: "เพิ่มรายวิชาสำเร็จ", entry: created });
}

export async function updateEntry(req: Request, res: Response) {
  const student = await requireStudentProfile(req.user!.userId);
  const planId = Number(pickFirstOrThrow(req.params.id, "id"));
  const termId = Number(pickFirstOrThrow(req.params.termId, "termId"));
  const entryId = Number(pickFirstOrThrow(req.params.entryId, "entryId"));

  await requireOwnedPlan(planId, student.id);

  // ✅ เช็คว่า term นี้อยู่ในแผนจริง
  const term = await prisma.term.findFirst({ where: { id: termId, studyPlanId: planId } });
  if (!term) return res.status(404).json({ message: "ไม่พบเทอม หรือไม่มีสิทธิ์เข้าถึง" });

  // ✅ เช็คว่า entry อยู่ใน term นี้จริง (กันอัปเดตผิดเทอม / state เพี้ยน)
  const existing = await prisma.planEntry.findFirst({
    where: { id: entryId, termId: termId },
    include: { course: true },
  });
  if (!existing) {
    return res.status(404).json({ message: "ไม่พบรายวิชาในเทอมนี้ หรือไม่มีสิทธิ์เข้าถึง" });
  }

  const { status, grade, earnedCredits } = req.body ?? {};

  // ถ้ามี field "grade" ใน payload -> server จะคำนวณ status (+ earnedCredits) ให้อัตโนมัติ
  const hasGradeInPayload = req.body && Object.prototype.hasOwnProperty.call(req.body, "grade");

  const PASSING_GRADES = new Set(["A", "B+", "B", "C+", "C", "D+", "D"]);

  const normalizeGrade = (g: any): string | null => {
    if (g === null || g === undefined) return null;
    const s = String(g).trim().toUpperCase();
    if (s === "" || s === "-") return null;
    return s;
  };

  let computedGrade: string | null | undefined = undefined;
  let computedStatus: EntryStatus | undefined = undefined;
  let computedEarnedCredits: number | null | undefined = undefined;

  if (hasGradeInPayload) {
    const norm = normalizeGrade(grade);
    computedGrade = norm; // null ได้ = ยังไม่เลือกเกรด

    if (norm === null) {
      computedStatus = "PLANNED";
      computedEarnedCredits = null;
    } else if (PASSING_GRADES.has(norm)) {
      computedStatus = "PASSED";
      // ✅ ผ่านแล้ว: ถ้าไม่ได้ส่ง earnedCredits มา ให้ใช้เครดิตของรายวิชานั้น
      computedEarnedCredits = typeof earnedCredits === "number" ? earnedCredits : (existing.course?.credits ?? null);
    } else if (norm === "F") {
      computedStatus = "FAILED";
      computedEarnedCredits = null;
    } else {
      return res.status(400).json({ message: "grade ไม่ถูกต้อง" });
    }
  }

  const updated = await prisma.planEntry.update({
    where: { id: entryId },
    data: {
      // ถ้าส่ง grade มา จะ override status ตามกติกา
      status: hasGradeInPayload ? computedStatus : (toEntryStatus(status) ?? undefined),

      // ถ้าส่ง grade มา: "-" / "" -> เก็บเป็น null
      grade: hasGradeInPayload ? computedGrade : (grade ?? undefined),

      // ถ้าส่ง grade มา: server คุม earnedCredits ให้สอดคล้องสถานะ (ผ่าน=credits, ไม่ผ่าน/วางแผน=null)
      earnedCredits: hasGradeInPayload
        ? (computedEarnedCredits as any)
        : (typeof earnedCredits === "number" ? earnedCredits : undefined),
    },
    include: { course: true },
  });

  return res.json({ message: "อัปเดตรายวิชาสำเร็จ", entry: updated });
}


export async function removeEntry(req: Request, res: Response) {
  const student = await requireStudentProfile(req.user!.userId);
  const planId = Number(pickFirstOrThrow(req.params.id, "id"));
  const termId = Number(pickFirstOrThrow(req.params.termId, "termId"));
  const entryId = Number(pickFirstOrThrow(req.params.entryId, "entryId"));

  await requireOwnedPlan(planId, student.id);

  const term = await prisma.term.findFirst({ where: { id: termId, studyPlanId: planId } });
  if (!term) return res.status(404).json({ message: "ไม่พบเทอม หรือไม่มีสิทธิ์เข้าถึง" });

  await prisma.planEntry.delete({ where: { id: entryId } });
  return res.json({ message: "ลบรายวิชาสำเร็จ" });
}

/**
 * POST /api/study-plans/:id/validate
 * ======================================================
 * Validate แบบ MVP:
 * - ตอนนี้ทำเป็นตัวอย่างเพื่อให้หน้า "ตรวจสอบจบ" มีข้อมูลแสดง
 * - ในอนาคตสามารถต่อกับกฎ SPARQL/ontology ได้
 */
export async function validatePlan(req: Request, res: Response) {
  const student = await requireStudentProfile(req.user!.userId);
  const planId = Number(pickFirstOrThrow(req.params.id, "id"));

  await requireOwnedPlan(planId, student.id);

  // โหลดแผนแบบละเอียดเพื่อรันกฎจาก DB จริง
  const plan = await prisma.studyPlan.findUnique({
    where: { id: planId },
    include: {
      curriculum: { include: { creditRequirements: { include: { courseGroup: true } } } },
      track: {
        include: {
          planTerms: { include: { courseEntries: { include: { course: true } }, slots: true } },
        },
      },
      terms: {
        include: {
          // prerequisite report ต้องใช้ข้อมูล prereqCourse เพื่อแสดงชื่อวิชาที่ขาด
          entries: {
            include: {
              course: {
                include: {
                  prerequisites: { include: { prereqCourse: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!plan) return res.status(404).json({ message: "ไม่พบแผนการเรียน" });

  // helper: label เทอมสำหรับข้อความรายงาน
  function termLabelLocal(termNo: number) {
    if (termNo === 1) return "เทอม 1";
    if (termNo === 2) return "เทอม 2";
    return `เทอม ${termNo}`;
  }

  // --------------------------------------------
  // Helper: ensure rule exists (สร้างอัตโนมัติถ้ายังไม่มี)
  // --------------------------------------------
  async function ensureRule(ruleCode: string, ruleText: string, severity: any) {
    const found = await prisma.validationRule.findUnique({ where: { ruleCode } });
    if (found) {
      // ถ้ากฎมีอยู่แล้ว แต่ข้อความ/ระดับความรุนแรงเปลี่ยน ให้ update ให้ตรงกับเวอร์ชันล่าสุด
      if (found.ruleText !== ruleText || found.severity !== severity) {
        return prisma.validationRule.update({
          where: { ruleCode },
          data: { ruleText, severity },
        });
      }
      return found;
    }
    return prisma.validationRule.create({
      data: { ruleCode, ruleText, severity, language: "NOTE" },
    });
  }

  const RULES = {
    PLAN_DUP_TERM: await ensureRule(
      "PLAN_001",
      "ห้ามลงรายวิชาซ้ำในเทอมเดียวกัน",
      "ERROR"
    ),
    PLAN_ALREADY_PASSED: await ensureRule(
      "PLAN_002",
      "ไม่ควรเลือกวิชาที่เคยผ่านแล้ว",
      "WARNING"
    ),
    PREREQ: await ensureRule(
      "PREREQ_001",
      "ต้องผ่านวิชาที่เป็น Prerequisite ก่อนลงรายวิชานี้",
      // ทางเลือก B: อนุญาตให้วางแผนได้ แต่ต้องเตือน
      "WARNING"
    ),
    CREDIT_TOTAL: await ensureRule(
      "CREDIT_002",
      "หน่วยกิตรวมต้องครบตามหลักสูตร",
      "WARNING"
    ),
    CREDIT_GROUP: await ensureRule(
      "CREDIT_001",
      "หน่วยกิตในแต่ละหมวดต้องครบตามเกณฑ์",
      "WARNING"
    ),
    MANDATORY: await ensureRule(
      "CURR_001",
      "ต้องมีรายวิชาบังคับครบตามแผนมาตรฐาน (Track)",
      "ERROR"
    ),
  };

  // --------------------------------------------
  // เตรียมชุดข้อมูลพื้นฐาน
  // --------------------------------------------
  const transcripts = await prisma.transcript.findMany({
    where: { studentId: student.id },
    // grade: A=4.0 ... F=0.0, null=ยังไม่มีผล
    // สำหรับ prerequisite (ตี้กำหนด): ผ่านเมื่อได้ D ขึ้นไป
    select: { courseId: true, grade: true },
  });

  // D ขึ้นไป = ผ่าน (gradePoint >= 1.0)
  const PASS_GRADEPOINT_MIN = 1.0;

  // ใช้ไว้ทำ report ให้บอกเหตุผลได้ว่า "ตก" หรือ "ยังไม่มีผล"
  const gradePointByCourse = new Map<number, number | null>();
  for (const t of transcripts) gradePointByCourse.set(t.courseId, t.grade === null ? null : Number(t.grade));

  function toLetterGrade(gradePoint: number | null): string {
    if (gradePoint === null) return "ยังไม่มีผล";
    const gp = Number(gradePoint);
    // mapping แบบทั่วไป (ไทยนิยม): 4=A, 3.5=B+, 3=B, 2.5=C+, 2=C, 1.5=D+, 1=D, 0=F
    if (gp >= 4) return "A";
    if (gp >= 3.5) return "B+";
    if (gp >= 3) return "B";
    if (gp >= 2.5) return "C+";
    if (gp >= 2) return "C";
    if (gp >= 1.5) return "D+";
    if (gp >= 1) return "D";
    return "F";
  }

  const passedFromTranscript = new Set<number>(
    transcripts
      .filter((t) => t.grade !== null && Number(t.grade) >= PASS_GRADEPOINT_MIN)
      .map((t) => t.courseId)
  );

  const allEntries = plan.terms.flatMap((t) => t.entries.map((e) => ({ term: t, entry: e })));

  const passedFromPlan = new Set<number>(
    allEntries
      .filter(({ entry }) => entry.status === "PASSED")
      .map(({ entry }) => entry.courseId)
  );

  const passedSet = new Set<number>([...passedFromTranscript, ...passedFromPlan]);

  // สำหรับการนับหน่วยกิตตาม requirement ของตี้: ENROLLED + PASSED
  const doneStatuses = new Set(["ENROLLED", "PASSED"]);
  const doneEntries = allEntries.filter(({ entry }) => doneStatuses.has(entry.status));

  // ใช้ distinct courseId กันนับซ้ำ
  const doneCourseIds = Array.from(new Set(doneEntries.map(({ entry }) => entry.courseId)));

  // courseId -> credits/group
  const courseMeta = new Map<number, { credits: number; groupId: number | null; name: string; code: string }>();
  for (const { entry } of allEntries) {
    const c: any = entry.course as any;
    if (!c) continue;
    courseMeta.set(entry.courseId, {
      credits: Number(c.credits || 0),
      groupId: c.groupId ?? null,
      name: c.courseNameTH ?? "",
      code: c.courseCode ?? "",
    });
  }

  // เติม meta จาก Track (กรณีวิชาบังคับไม่ได้อยู่ในแผน แต่ต้องใช้ชื่อวิชาในรายงาน)
  const trackTermsAll: any[] = (plan.track as any)?.planTerms ?? [];
  for (const tt of trackTermsAll) {
    const ces: any[] = tt?.courseEntries ?? [];
    for (const ce of ces) {
      const c: any = ce?.course;
      if (!ce?.courseId || !c) continue;
      if (!courseMeta.has(Number(ce.courseId))) {
        courseMeta.set(Number(ce.courseId), {
          credits: Number(c.credits || 0),
          groupId: c.groupId ?? null,
          name: c.courseNameTH ?? "",
          code: c.courseCode ?? "",
        });
      }
    }
  }

  // map สำหรับหา termId ของเทอมที่แนะนำ (ใช้ให้ FE filter รายเทอมได้)
  const termIdByYearTerm = new Map<string, number>();
  for (const t of plan.terms) {
    termIdByYearTerm.set(`${t.termYear}:${t.termNo}`, t.id);
  }

  // --------------------------------------------
  // สร้าง ValidationRun
  // --------------------------------------------
  const run = await prisma.validationRun.create({
    data: { studyPlanId: planId, startedAt: new Date() },
  });

  const results: Array<{
    ruleId: number;
    message: string;
    severity: any;
    termId?: number | null;
    courseId?: number | null;
  }> = [];

  // --------------------------------------------
  // RULE: PLAN_001 (ซ้ำในเทอมเดียวกัน)
  // --------------------------------------------
  for (const t of plan.terms) {
    const mapCount = new Map<number, number>();
    for (const e of t.entries) {
      // ไม่นับ DROPPED
      if (e.status === "DROPPED") continue;
      mapCount.set(e.courseId, (mapCount.get(e.courseId) ?? 0) + 1);
    }
    for (const [courseId, cnt] of mapCount.entries()) {
      if (cnt > 1) {
        const meta = courseMeta.get(courseId);
        results.push({
          ruleId: RULES.PLAN_DUP_TERM.id,
          severity: RULES.PLAN_DUP_TERM.severity,
          termId: t.id,
          courseId,
          message: `เทอม ปี ${t.termYear} เทอม ${t.termNo}: พบลงซ้ำ ${meta?.code || courseId} จำนวน ${cnt} ครั้ง`,
        });
      }
    }
  }

  // --------------------------------------------
  // RULE: PLAN_002 (เลือกวิชาที่เคยผ่านแล้ว)
  // --------------------------------------------
  for (const { term, entry } of allEntries) {
    if (!["PLANNED", "ENROLLED"].includes(entry.status)) continue;
    if (!passedSet.has(entry.courseId)) continue;
    const meta = courseMeta.get(entry.courseId);
    results.push({
      ruleId: RULES.PLAN_ALREADY_PASSED.id,
      severity: RULES.PLAN_ALREADY_PASSED.severity,
      termId: term.id,
      courseId: entry.courseId,
      message: `วิชา ${meta?.code || ""} ${meta?.name || ""} เคยผ่านแล้ว ไม่จำเป็นต้องลงซ้ำ`,
    });
  }

  // --------------------------------------------
  // RULE: PREREQ_001 (Prerequisite)
  // --------------------------------------------
  for (const { term, entry } of allEntries) {
    // ตรวจเฉพาะสถานะที่ตี้ต้องการ: PASSED / PLANNED / FAILED
    if (!["PASSED", "PLANNED", "FAILED"].includes(entry.status)) continue;

    const prereqs: any[] = (entry.course as any)?.prerequisites ?? [];
    if (!Array.isArray(prereqs) || prereqs.length === 0) continue;

    // ใช้ข้อมูล prereqCourse ที่ include มาจาก Prisma เพื่อแสดงชื่อวิชา
    const missingPrereqs = prereqs
      .map((p) => ({
        prereqCourseId: Number(p.prereqCourseId),
        prereqCourse: (p as any).prereqCourse as any,
      }))
      .filter((x) => x.prereqCourseId && !passedSet.has(x.prereqCourseId));

    if (missingPrereqs.length) {
      const meta = courseMeta.get(entry.courseId);
      const missingText = missingPrereqs
        .map((x) => {
          const c = x.prereqCourse;
          const code = c?.courseCode ?? "";
          const name = c?.courseNameTH ?? c?.courseNameEN ?? "";
          const gp = gradePointByCourse.has(x.prereqCourseId)
            ? gradePointByCourse.get(x.prereqCourseId)!
            : null;
          const letter = toLetterGrade(gp);
          const statusText = letter === "ยังไม่มีผล" ? "ยังไม่มีผลการเรียน" : `เกรด ${letter}`;
          return `${name}${code ? ` (${code})` : ""} - ${statusText}`.trim();
        })
        .filter(Boolean)
        .join(", ");

      results.push({
        ruleId: RULES.PREREQ.id,
        severity: RULES.PREREQ.severity,
        termId: term.id,
        courseId: entry.courseId,
        message: `Prerequisite ไม่ผ่าน (ผ่านเมื่อได้ D ขึ้นไป): ${meta?.name || ""}${meta?.code ? ` (${meta.code})` : ""} ต้องผ่านก่อนเรียน: ${missingText}\nคำแนะนำ: แก้เกรด/ลงเรียนรายวิชา Prerequisite ให้ได้ D ขึ้นไปก่อน แล้วค่อยลงรายวิชานี้จริง (วางแผนไว้ได้)`,
      });
    }
  }

  // --------------------------------------------
  // RULE: CREDIT_002 (หน่วยกิตรวม 126)
  // --------------------------------------------
  const totalDoneCredits = doneCourseIds.reduce((sum, cid) => sum + (courseMeta.get(cid)?.credits ?? 0), 0);
  const TOTAL_REQ = 126;

  if (totalDoneCredits < TOTAL_REQ) {
    results.push({
      ruleId: RULES.CREDIT_TOTAL.id,
      severity: RULES.CREDIT_TOTAL.severity,
      message: `หน่วยกิตรวม (นับ ENROLLED+PASSED แบบไม่ซ้ำวิชา): ได้ ${totalDoneCredits} / ${TOTAL_REQ} (ขาด ${TOTAL_REQ - totalDoneCredits})\nคำแนะนำ: เพิ่มรายวิชาตามหมวดที่ยังขาด และอัปเดตสถานะ/เกรดให้เป็น ENROLLED หรือ PASSED เพื่อให้นับหน่วยกิตได้ถูกต้อง`,
    });
  }

  // --------------------------------------------
  // RULE: CREDIT_001 (หน่วยกิตรายหมวด)
  // --------------------------------------------
  const byGroup = new Map<number, number>(); // groupId -> credits
  for (const cid of doneCourseIds) {
    const meta = courseMeta.get(cid);
    if (!meta?.groupId) continue;
    byGroup.set(meta.groupId, (byGroup.get(meta.groupId) ?? 0) + (meta.credits ?? 0));
  }

  const creditReqs = plan.curriculum?.creditRequirements ?? [];
  for (const req of creditReqs) {
    const gid = req.courseGroupId;
    const have = byGroup.get(gid) ?? 0;
    const need = Number(req.minCredits || 0);
    if (need > 0 && have < need) {
      results.push({
        ruleId: RULES.CREDIT_GROUP.id,
        severity: RULES.CREDIT_GROUP.severity,
        message: `หมวด ${req.courseGroup?.groupName || req.courseGroupId}: ได้ ${have} / ${need} หน่วยกิต (ขาด ${need - have})\nคำแนะนำ: เพิ่มรายวิชาในหมวด “${req.courseGroup?.groupName || req.courseGroupId}” อีกอย่างน้อย ${need - have} หน่วยกิต`,
      });
    }
  }

  // --------------------------------------------
  // RULE: CURR_001 (รายวิชาบังคับตาม TrackPlanCourse)
  // - ถ้ามี trackId ใน plan ถือว่ามีชุดบังคับ
  // - นับ ENROLLED+PASSED เป็น "ทำแล้ว" ตามนิยามในระบบตี้
  // --------------------------------------------
  if (plan.trackId) {
    const requiredCourseIds = new Set<number>();
    // courseId -> recommended (year, termNo)
    const recommendByCourseId = new Map<number, { year: number; termNo: number }>();
    const trackTerms: any[] = (plan.track as any)?.planTerms ?? [];
    for (const tt of trackTerms) {
      const entries: any[] = tt?.courseEntries ?? [];
      for (const ce of entries) {
        if (!ce?.courseId) continue;
        const cid = Number(ce.courseId);
        requiredCourseIds.add(cid);
        // เก็บเทอมแรกที่เจอเป็นเทอมแนะนำ
        if (!recommendByCourseId.has(cid)) {
          recommendByCourseId.set(cid, { year: Number(tt.year), termNo: Number(tt.termNo) });
        }
      }
    }

    const doneSet = new Set<number>(doneCourseIds);
    const missing = Array.from(requiredCourseIds).filter((cid) => !doneSet.has(cid));
    if (missing.length) {
      for (const cid of missing) {
        const meta = courseMeta.get(cid);
        const rec = recommendByCourseId.get(cid);
        const recTxt = rec ? `ปี ${rec.year} ${termLabelLocal(rec.termNo)}` : "-";
        const termId = rec ? termIdByYearTerm.get(`${rec.year}:${rec.termNo}`) ?? null : null;
        results.push({
          ruleId: RULES.MANDATORY.id,
          severity: RULES.MANDATORY.severity,
          termId,
          courseId: cid,
          message: `รายวิชาบังคับตาม Track: ยังขาด ${meta?.name || ""}${meta?.code ? ` (${meta.code})` : ""} (นับ ENROLLED+PASSED)\nคำแนะนำ: วาง/ลงรายวิชานี้ตามแผน Track ที่แนะนำ (${recTxt}) และทำสถานะให้เป็น ENROLLED หรือ PASSED`,
        });
      }
    }
  }

  // --------------------------------------------
  // บันทึกผล
  // --------------------------------------------
  if (results.length) {
    await prisma.validationResult.createMany({
      data: results.map((r) => ({
        runId: run.id,
        ruleId: r.ruleId,
        message: r.message,
        severity: r.severity,
        termId: r.termId ?? null,
        courseId: r.courseId ?? null,
      })),
    });
  }

  const finished = await prisma.validationRun.update({
    where: { id: run.id },
    data: { finishedAt: new Date() },
    include: { results: { include: { rule: true, term: true, course: true } } },
  });

  return res.json({ message: "ตรวจสอบแผนสำเร็จ", run: finished });
}
