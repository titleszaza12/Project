import type { Request, Response } from "express";
import { prisma } from "../prisma";

// helper: ผ่านจริงจาก transcript (รองรับทั้ง number/string)
function isTranscriptPassed(grade: any): boolean {
  if (grade === null || grade === undefined) return false;

  // number: >0 = passed (0 = F)
  if (typeof grade === "number") return Number.isFinite(grade) && grade > 0;

  const s = String(grade).trim().toUpperCase();
  if (!s || s === "-" ) return false;
  if (s === "F") return false;
  // A, B+, B, C+, C, D+, D => passed
  return true;
}

function n(v: any, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

export async function getGraduationSummary(req: Request, res: Response) {
  const planId = Number(req.params.planId);
  if (!Number.isFinite(planId)) return res.status(400).json({ message: "planId ไม่ถูกต้อง" });

  // ✅ ต้องผ่าน authGuard มาก่อน ถึงจะมี req.user
  const studentProfileId = Number(req.user?.studentProfileId);
  if (!Number.isFinite(studentProfileId)) return res.status(401).json({ message: "UNAUTHORIZED" });

  // กันเคส studentProfile ถูกลบ/ไม่ตรง
  const sp = await prisma.studentProfile.findUnique({ where: { id: studentProfileId } });
  if (!sp) return res.status(400).json({ message: "ไม่พบ StudentProfile" });

  // ✅ เช็คว่า plan เป็นของนักศึกษาคนนี้จริง
  const plan = await prisma.studyPlan.findFirst({
    where: { id: planId, studentId: studentProfileId },
    include: {
      curriculum: {
        include: {
          creditRequirements: { include: { courseGroup: true } },
        },
      },
      terms: { include: { entries: { include: { course: true } } } },
    },
  });

  if (!plan) return res.status(404).json({ message: "ไม่พบแผน หรือไม่มีสิทธิ์เข้าถึง" });

  // transcript passed
  const transcripts = await prisma.transcript.findMany({
    where: { studentId: sp.id },
    select: { courseId: true, grade: true },
  });

  const passedFromTranscript = new Set<number>(
    transcripts.filter((t) => isTranscriptPassed(t.grade)).map((t) => t.courseId)
  );

  // plan passed only
  const allEntries = plan.terms.flatMap((t) => t.entries.map((e) => ({ term: t, entry: e })));
  const passedFromPlan = new Set<number>(
    allEntries
      .filter(({ entry }) => String(entry.status || "").toUpperCase() === "PASSED")
      .map(({ entry }) => entry.courseId)
  );

  const passedCourseIds = Array.from(new Set<number>([...passedFromTranscript, ...passedFromPlan]));

  // build course meta from entries (ถ้า transcript มี course ที่ไม่อยู่ใน plan อาจ meta ไม่ครบ)
  // กันพังด้วยการ query course เพิ่ม
  const courses = await prisma.course.findMany({
    where: { id: { in: passedCourseIds } },
    select: { id: true, credits: true, groupId: true },
  });

  const courseMeta = new Map<number, { credits: number; groupId: number | null }>();
  for (const c of courses) {
    courseMeta.set(c.id, { credits: n(c.credits, 0), groupId: c.groupId ?? null });
  }

  // CREDIT_002 (total)
  const totalHave = passedCourseIds.reduce((sum, cid) => sum + (courseMeta.get(cid)?.credits ?? 0), 0);

  // need: ถ้า curriculum มี totalMinCredits ใช้อันนั้น ไม่งั้น fallback 126
  const totalNeed = n((plan.curriculum as any)?.totalMinCredits, 126);
  const totalMissing = Math.max(0, totalNeed - totalHave);

  const creditTotal = {
    ruleCode: "CREDIT_002" as const,
    have: totalHave,
    need: totalNeed,
    missing: totalMissing,
    ok: totalHave >= totalNeed,
    basis: "PASSED_ONLY" as const,
  };

  // CREDIT_001 (by group)
// ✅ นับเป็น "หมวดหลัก" ตามที่ curriculum ตั้ง requirement ไว้
// ถ้าวิชาอยู่ในหมวดย่อย (เช่น GE_LANGUAGE) จะ roll-up ไปหมวดแม่ (เช่น GENERAL) อัตโนมัติ
  const reqs = plan.curriculum?.creditRequirements ?? [];
  const reqGroupIds = new Set<number>(reqs.map((r) => r.courseGroupId));

  // โหลดโครงสร้างหมวดทั้งหมดของ curriculum นี้ (ไว้ไล่ parentGroupId)
  const groupRows = await prisma.courseGroup.findMany({
    where: { curriculumId: plan.curriculumId },
    select: { id: true, parentGroupId: true },
  });

  const parentById = new Map<number, number | null>();
  for (const g of groupRows) parentById.set(g.id, g.parentGroupId ?? null);

  function rollupToRequiredGroupId(groupId: number | null): number | null {
    if (!groupId) return null;

    // ถ้า groupId เป็นหมวดที่มี requirement อยู่แล้ว ใช้เลย
    if (reqGroupIds.has(groupId)) return groupId;

    // ไม่งั้นไล่ขึ้น parent จนกว่าจะเจอหมวดที่มี requirement
    const seen = new Set<number>();
    let cur: number | null = groupId;

    while (cur && !reqGroupIds.has(cur)) {
      if (seen.has(cur)) break; // กัน loop
      seen.add(cur);
      cur = parentById.get(cur) ?? null;
    }

    return cur && reqGroupIds.has(cur) ? cur : groupId; // fallback: ถ้าไม่เจอหมวดแม่ ก็เก็บไว้ตามเดิม
  }

  const byGroup = new Map<number, number>(); // required groupId -> credits have
  for (const cid of passedCourseIds) {
    const meta = courseMeta.get(cid);
    const rolled = rollupToRequiredGroupId(meta?.groupId ?? null);
    if (!rolled) continue;
    byGroup.set(rolled, (byGroup.get(rolled) ?? 0) + (meta?.credits ?? 0));
  }

const creditGroups = reqs.map((r) => {
    const gid = r.courseGroupId;
    const need = n(r.minCredits, 0);
    const have = byGroup.get(gid) ?? 0;
    const missing = Math.max(0, need - have);
    return {
      ruleCode: "CREDIT_001" as const,
      groupId: gid,
      groupName: r.courseGroup?.groupName || `หมวด ${gid}`,
      have,
      need,
      missing,
      ok: need <= 0 ? true : have >= need,
      basis: "PASSED_ONLY" as const,
    };
  });

  const overallOk = creditTotal.ok && creditGroups.every((g) => g.ok);

  return res.json({
    message: "ok",
    planId: plan.id,
    curriculum: {
      id: plan.curriculumId,
      curriculumName: (plan.curriculum as any)?.curriculumName ?? null,
      totalMinCredits: totalNeed,
    },
    creditTotal,
    creditGroups,
    overallOk,
  });
}