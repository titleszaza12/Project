/* prisma/seed.ts
 * Seed baseline data aligned with schema.prisma (RMUTTO IT Study Plan System)
 * - 13-digit unique usernames, password=12345678
 * - Courses extracted from RMUTTO PDF (seed-data/courses_from_pdf.json)
 * - Tracks + track plan templates + validation rules
 * - Students (demo)
 *
 * IMPORTANT (per requirement):
 * - Do NOT seed PlanEntry
 * - Do NOT seed Transcript
 *   (These will be created via frontend actions: create plan / add term / add entry / set grade)
 */

import { PrismaClient, TermType, RuleSeverity, RuleLanguage } from "@prisma/client";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();



// NOTE: Transcript rows are created by backend when user sets grades / creates terms in the app.

type PdfCourse = {
  courseCode: string;
  courseNameTH: string;
  courseNameEN?: string | null;
  credits: number;
  creditDetail?: string | null;
};

function seedPath(...parts: string[]) {
  return path.join(process.cwd(), "prisma", ...parts);
}

function loadPdfCourses(): PdfCourse[] {
  const p = seedPath("seed-data", "courses_from_pdf.json");
  const raw = fs.readFileSync(p, "utf-8");
  const items = JSON.parse(raw) as PdfCourse[];
  // basic guard
  return (Array.isArray(items) ? items : []).filter((c) => !!c.courseCode);
}

function groupForCourseCode(courseCode: string): string {
  // -----------------------------
  // GENERAL (GE) sub-groups
  // ตามแนวทางในเอกสาร/ตารางแผน:
  // - 00-10-xxx / 00-11-xxx => กลุ่มสังคมศาสตร์/มนุษยศาสตร์
  // - 00-22-xxx / 00-21-xxx => กลุ่มภาษา
  // - 00-41-xxx            => กลุ่มบูรณาการ
  // - 00-31-xxx            => กลุ่มวิทย์-คณิต (เพิ่มให้ครบ เผื่อใช้กับ slot)
  // หมายเหตุ: ถ้าไม่เข้าเงื่อนไขใด ให้ fallback ไป GENERAL
  // -----------------------------
  if (courseCode.startsWith("00-41-")) return "GE_INTEGRATED";
  if (courseCode.startsWith("00-22-") || courseCode.startsWith("00-21-")) return "GE_LANGUAGE";
  if (courseCode.startsWith("00-31-")) return "GE_SCI_MATH";
  if (courseCode.startsWith("00-10-") || courseCode.startsWith("00-11-") || courseCode.startsWith("00-12-")) return "GE_SOC_HUM";

  // GENERAL: 00-xx-xxx (fallback)
  if (courseCode.startsWith("00-")) return "GENERAL";
  // MAJOR split by hundreds for 04-06-1xx/2xx/3xx/4xx
  if (courseCode.startsWith("04-06-")) {
    const m = courseCode.match(/^04-06-(\d{3})$/);
    const n = m ? Number(m[1]) : 0;
    if (n >= 100 && n < 300) return "MAJOR_REQUIRED";
    if (n >= 300 && n < 400) return "MAJOR_ELECTIVE";
    if (n >= 400 && n < 500) return "FREE_ELECTIVE";
    return "MAJOR_REQUIRED";
  }
  return "FREE_ELECTIVE";
}

function cleanThai(s: string): string {
  const junk = [
    "ปรับชื่อรายวิชาใหม่และ",
    "ปรับค าอธิบายรายวิชา",
    "ปรับคำอธิบายรายวิชา",
    "ส าหรับ ยกเลิกรายวิชา",
    "สำหรับ ยกเลิกรายวิชา",
    "ยกเลิกรายวิชา",
  ];
  let out = s || "";
  for (const j of junk) out = out.split(j).join("");
  out = out
    .split("ค า").join("คำ")
    .split("ส าหรับ").join("สำหรับ")
    .split("ด า").join("ดำ");
  out = out.replace(/\s{2,}/g, " ").trim();
  return out;
}

async function upsertCurriculum() {
  return prisma.curriculum.upsert({
    where: { curriculumName: "หลักสูตรเทคโนโลยีสารสนเทศ (IT) RMUTTO 2564" },
    update: { totalMinCredits: 126 },
    create: {
      curriculumName: "หลักสูตรเทคโนโลยีสารสนเทศ (IT) RMUTTO 2564",
      totalMinCredits: 126,
    },
  });
}

async function ensureCourseGroups(curriculumId: number) {
  const defs = [
    { groupCode: "GENERAL", groupName: "หมวดวิชาศึกษาทั่วไป", groupNameEN: "General Education" },
    { groupCode: "MAJOR_REQUIRED", groupName: "วิชาเฉพาะ (เอกบังคับ)", groupNameEN: "Major Required" },
    { groupCode: "MAJOR_ELECTIVE", groupName: "วิชาเฉพาะ (เอกเลือก)", groupNameEN: "Major Elective" },
    { groupCode: "FREE_ELECTIVE", groupName: "วิชาเลือกเสรี", groupNameEN: "Free Elective" },
  ];

  const groups: Record<string, { id: number; groupCode: string }> = {};
  for (const d of defs) {
    const g = await prisma.courseGroup.upsert({
      where: { groupCode: d.groupCode },
      update: {
        groupName: d.groupName,
        groupNameEN: d.groupNameEN,
        curriculumId,
      },
      create: {
        groupCode: d.groupCode,
        groupName: d.groupName,
        groupNameEN: d.groupNameEN,
        curriculumId,
      },
      select: { id: true, groupCode: true },
    });
    groups[g.groupCode] = g;
  }

  // -----------------------------
  // GE sub-groups (หมวดย่อยภายใต้ GENERAL)
  // ใช้สำหรับ slot เช่น 00-1x-xxx, 00-22-xxx, 00-41-xxx
  // -----------------------------
  const generalId = groups["GENERAL"]?.id;
  if (generalId) {
    const subDefs = [
      { groupCode: "GE_SOC_HUM", groupName: "หมวดวิชาศึกษาทั่วไป • กลุ่มสังคมศาสตร์/มนุษยศาสตร์", groupNameEN: "GE • Social & Humanities" },
      { groupCode: "GE_LANGUAGE", groupName: "หมวดวิชาศึกษาทั่วไป • กลุ่มภาษา", groupNameEN: "GE • Language" },
      { groupCode: "GE_INTEGRATED", groupName: "หมวดวิชาศึกษาทั่วไป • กลุ่มบูรณาการ", groupNameEN: "GE • Integrated" },
      { groupCode: "GE_SCI_MATH", groupName: "หมวดวิชาศึกษาทั่วไป • กลุ่มวิทย์-คณิต", groupNameEN: "GE • Science & Math" },
    ];

    for (const s of subDefs) {
      const sg = await prisma.courseGroup.upsert({
        where: { groupCode: s.groupCode },
        update: {
          groupName: s.groupName,
          groupNameEN: s.groupNameEN,
          curriculumId,
          parentGroupId: generalId,
        },
        create: {
          groupCode: s.groupCode,
          groupName: s.groupName,
          groupNameEN: s.groupNameEN,
          curriculumId,
          parentGroupId: generalId,
        },
        select: { id: true, groupCode: true },
      });
      groups[sg.groupCode] = sg;
    }
  }
  return groups;
}

async function seedCreditRequirements(curriculumId: number, groups: Record<string, { id: number }>) {
  // ✅ schema uses courseGroupId (NOT groupId)
  const defs = [
    { code: "GENERAL", minCredits: 30 },
    { code: "MAJOR_REQUIRED", minCredits: 78 },
    { code: "MAJOR_ELECTIVE", minCredits: 12 },
    { code: "FREE_ELECTIVE", minCredits: 6 },
  ];

  for (const d of defs) {
    const courseGroupId = groups[d.code]?.id;
    if (!courseGroupId) continue;

    const found = await prisma.creditRequirement.findFirst({
      where: { curriculumId, courseGroupId },
      select: { id: true },
    });

    if (found) {
      await prisma.creditRequirement.update({
        where: { id: found.id },
        data: { minCredits: d.minCredits },
      });
    } else {
      await prisma.creditRequirement.create({
        data: {
          curriculumId,
          courseGroupId,
          minCredits: d.minCredits,
        },
      });
    }
  }
}

async function seedCourses(curriculumId: number, groups: Record<string, { id: number }>) {
  const items = loadPdfCourses();

  // Upsert courses by courseCode
  for (const c of items) {
    const code = c.courseCode.trim();
    const gcode = groupForCourseCode(code);
    const groupId = groups[gcode]?.id ?? null;

    await prisma.course.upsert({
      where: { courseCode: code },
      update: {
        courseNameTH: cleanThai(c.courseNameTH),
        courseNameEN: c.courseNameEN ? cleanThai(c.courseNameEN) : null,
        credits: c.credits,
        creditDetail: c.creditDetail ?? null,
        curriculumId,
        groupId,
      },
      create: {
        courseCode: code,
        courseNameTH: cleanThai(c.courseNameTH),
        courseNameEN: c.courseNameEN ? cleanThai(c.courseNameEN) : null,
        credits: c.credits,
        creditDetail: c.creditDetail ?? null,
        curriculumId,
        groupId,
      },
    });
  }
}

async function seedPrerequisites() {
  // Populate CoursePrerequisite using REAL prerequisite pairs extracted from the official curriculum PDF (5-1-65).
  // Meaning:
  //   courseId        = the course the student wants to take
  //   prereqCourseId  = the course that must be completed BEFORE taking courseId
  //
  // IMPORTANT:
  // - This version does NOT read/parse the PDF at runtime.
  // - It only inserts pairs that exist in the PDF section "วิชาบังคับก่อน:" (Prerequisite).
  //
  // Source (for reference): https://busit.rmutto.ac.th/.../สารสนเทศ-เต็ม_5-1-65.pdf

  const PREREQ_PAIRS: Array<{ courseCode: string; prereqCourseCode: string }> = [
    { courseCode: "04-06-210", prereqCourseCode: "04-06-212" },
    { courseCode: "04-06-107", prereqCourseCode: "04-06-106" },
    { courseCode: "04-06-108", prereqCourseCode: "04-06-106" },
    { courseCode: "04-06-215", prereqCourseCode: "04-06-107" },
    { courseCode: "04-06-217", prereqCourseCode: "04-06-216" },
    { courseCode: "04-06-327", prereqCourseCode: "04-06-212" },
    { courseCode: "04-06-328", prereqCourseCode: "04-06-212" },
    { courseCode: "04-06-329", prereqCourseCode: "04-06-212" },
    { courseCode: "04-06-334", prereqCourseCode: "04-06-323" },
    { courseCode: "04-06-335", prereqCourseCode: "04-06-216" },
    { courseCode: "04-06-336", prereqCourseCode: "04-06-216" },
    { courseCode: "04-06-337", prereqCourseCode: "04-06-336" },
    { courseCode: "04-06-338", prereqCourseCode: "04-06-217" },
    { courseCode: "04-06-339", prereqCourseCode: "04-06-107" },
    { courseCode: "04-06-340", prereqCourseCode: "04-06-339" },
    { courseCode: "04-06-341", prereqCourseCode: "04-06-215" },
    { courseCode: "04-06-450", prereqCourseCode: "04-06-213" },
    { courseCode: "04-06-451", prereqCourseCode: "04-06-347" },
    { courseCode: "04-06-349", prereqCourseCode: "04-06-348" },
  ];

  // Build courseCode -> id map
  const all = await prisma.course.findMany({ select: { id: true, courseCode: true } });
  const idByCode = new Map<string, number>();
  for (const c of all) idByCode.set(c.courseCode.trim(), c.id);

  // Insert pairs (skip if course codes are not found in DB)
  for (const pair of PREREQ_PAIRS) {
    const courseId = idByCode.get(pair.courseCode);
    const prereqCourseId = idByCode.get(pair.prereqCourseCode);
    if (!courseId || !prereqCourseId || courseId === prereqCourseId) continue;

    await prisma.coursePrerequisite.upsert({
      where: { courseId_prereqCourseId: { courseId, prereqCourseId } },
      update: {},
      create: { courseId, prereqCourseId },
    });
  }
}

async function seedTracks(curriculumId: number) {
  const coop = await prisma.track.upsert({
    where: { code: "COOP" },
    update: { nameTH: "แผนสหกิจศึกษา", curriculumId },
    create: {
      code: "COOP",
      nameTH: "แผนสหกิจศึกษา",
      nameEN: "Cooperative Education",
      curriculumId,
    },
  });

  const jt = await prisma.track.upsert({
    where: { code: "JOB_TRAINING" },
    update: { nameTH: "แผนฝึกประสบการณ์วิชาชีพ", curriculumId },
    create: {
      code: "JOB_TRAINING",
      nameTH: "แผนฝึกประสบการณ์วิชาชีพ",
      nameEN: "Job Training",
      curriculumId,
    },
  });

  return { coop, jt };
}

async function seedTrackPlan(trackId: number, trackCode: "COOP" | "JOB_TRAINING") {
  // create year1-4, term1-2 templates
  // pick representative courses for templates
  const pick = async (code: string) => prisma.course.findUnique({ where: { courseCode: code }, select: { id: true } });

  // Track plan templates aligned to the PDF plan table.
  // Placeholders (00-1x-xxx, 00-2x-xxx, 00-41-xxx, 04-06-xxx, xx-xx-xxx) are represented as TrackPlanSlot.
  const courseCodesByYearTerm: Record<string, string[]> = {
    // Year 1
    "1-1": ["00-22-001", "00-31-001", "00-31-002", "04-06-101", "04-06-103", "04-06-106"],
    "1-2": ["00-22-002", "04-06-102", "04-06-104", "04-06-105", "04-06-107", "04-06-108"],

    // Year 2
    // term1 has 2 GE placeholders: 00-1x-xxx and 00-41-xxx
    "2-1": ["04-06-209", "04-06-212", "04-06-215", "04-06-216", "04-06-218"],
    "2-2": ["00-22-003", "04-06-210", "04-06-211", "04-06-213", "04-06-214", "04-06-217"],

    // Year 3
    // term1 has GE language placeholder + major elective placeholder
    "3-1": ["00-41-001", "04-06-319", "04-06-322", "04-06-323"],
    // term2 has 3 major elective placeholders + prep course depends on track
    "3-2": ["00-12-001", "04-06-320", "04-06-321"].concat(trackCode === "COOP" ? ["04-06-347"] : ["04-06-348"]),

    // Year 4 differs
    "4-1": trackCode === "COOP" ? ["04-06-451"] : ["04-06-452"],
    "4-2": ["04-06-450"],
  };

  let sort = 1;
  for (let year = 1; year <= 4; year++) {
    for (let termNo = 1; termNo <= 2; termNo++) {
      const key = `${year}-${termNo}`;
      const codes = courseCodesByYearTerm[key] || [];

      const termTemplate = await prisma.trackPlanTerm.create({
        data: {
          trackId,
          year,
          termNo,
          termType: TermType.SEMESTER,
          suggestedTotalCredits: null,
          sortOrder: sort++,
        },
      });

      // courses
      let cSort = 1;
      for (const code of codes) {
        const c = await pick(code);
        if (!c) continue;
        await prisma.trackPlanCourse.create({
          data: {
            termTemplateId: termTemplate.id,
            courseId: c.id,
            sortOrder: cSort++,
            noteTH: "แนะนำ",
          },
        });
      }

      // slots (placeholders) – still keep the 4 main CourseGroup categories as requested.
      const makeSlot = async (slotCode: string, titleTH: string, groupCode: string, requiredCourses: number, sortOrder: number) => {
        await prisma.trackPlanSlot.create({
          data: {
            termTemplateId: termTemplate.id,
            slotCode,
            titleTH,
            titleEN: null,
            groupCode,
            requiredCourses,
            requiredCredits: null,
            sortOrder,
          },
        });
      };

      // Year 2 term 1: 2 GE placeholders
      if (year === 2 && termNo === 1) {
        await makeSlot("GE_SOC_HUM_1", "เลือกศึกษาทั่วไป (กลุ่มสังคม/มนุษยฯ) 1 วิชา (00-1x-xxx)", "GENERAL", 1, 90);
        await makeSlot("GE_INTEG_1", "เลือกศึกษาทั่วไป (กลุ่มบูรณาการ) 1 วิชา (00-41-xxx)", "GENERAL", 1, 91);
      }

      // Year 3 term 1: 1 language GE placeholder + 1 major elective
      if (year === 3 && termNo === 1) {
        await makeSlot("GE_LANG_1", "เลือกศึกษาทั่วไป (กลุ่มภาษา) 1 วิชา (00-2x-xxx)", "GENERAL", 1, 90);
        await makeSlot("MAJOR_ELEC_1", "เลือกวิชาเฉพาะ (เอกเลือก) 1 วิชา (04-06-xxx)", "MAJOR_ELECTIVE", 1, 92);
      }

      // Year 3 term 2: 3 major electives
      if (year === 3 && termNo === 2) {
        await makeSlot("MAJOR_ELEC_1", "เลือกวิชาเฉพาะ (เอกเลือก) 1 วิชา (04-06-xxx)", "MAJOR_ELECTIVE", 1, 90);
        await makeSlot("MAJOR_ELEC_2", "เลือกวิชาเฉพาะ (เอกเลือก) 1 วิชา (04-06-xxx)", "MAJOR_ELECTIVE", 1, 91);
        await makeSlot("MAJOR_ELEC_3", "เลือกวิชาเฉพาะ (เอกเลือก) 1 วิชา (04-06-xxx)", "MAJOR_ELECTIVE", 1, 92);
      }

      // Year 4 job training term 1: 1 major elective + 1 free elective
      if (year === 4 && termNo === 1 && trackCode === "JOB_TRAINING") {
        await makeSlot("MAJOR_ELEC_1", "เลือกวิชาเฉพาะ (วิชาเลือก) 1 วิชา (04-06-xxx)", "MAJOR_ELECTIVE", 1, 90);
        await makeSlot("FREE_ELEC_1", "เลือกวิชาเลือกเสรี 1 วิชา (xx-xx-xxx)", "FREE_ELECTIVE", 1, 91);
      }

      // Year 4 term 2: free electives (COOP=2, JOB_TRAINING=1)
      if (year === 4 && termNo === 2) {
        const freeCount = trackCode === "COOP" ? 2 : 1;
        for (let i = 1; i <= freeCount; i++) {
          await makeSlot(`FREE_ELEC_${i}`, `เลือกวิชาเลือกเสรี ${i} วิชา (xx-xx-xxx)`, "FREE_ELECTIVE", 1, 90 + i);
        }
      }
    }
  }
}

async function ensureValidationRules() {
  const defs = [
    { ruleCode: "PREREQ_001", ruleText: "ยังไม่ผ่านวิชาที่เป็น Prerequisite", severity: RuleSeverity.ERROR },
    { ruleCode: "PLAN_001", ruleText: "ลงวิชาซ้ำในเทอมเดียวกัน", severity: RuleSeverity.ERROR },
    { ruleCode: "PLAN_002", ruleText: "เลือกวิชาที่เคยผ่านแล้ว", severity: RuleSeverity.WARNING },
    { ruleCode: "CREDIT_002", ruleText: "หน่วยกิตรวมยังไม่ครบ 126", severity: RuleSeverity.WARNING },
  ];
  for (const d of defs) {
    await prisma.validationRule.upsert({
      where: { ruleCode: d.ruleCode },
      update: { ruleText: d.ruleText, severity: d.severity, language: RuleLanguage.NOTE },
      create: { ruleCode: d.ruleCode, ruleText: d.ruleText, severity: d.severity, language: RuleLanguage.NOTE },
    });
  }
}

async function createStudent(i: number, yearNo: number, kind: "GOOD" | "BAD") {
  // 13-digit numeric usernames, unique
  const username = String(6500000000000 + i).padStart(13, "0");
  const passwordHash = await bcrypt.hash("12345678", 10);

  const user = await prisma.userAccount.create({
    data: { username, passwordHash },
    select: { id: true, username: true },
  });

  const profile = await prisma.studentProfile.create({
    data: {
      userId: user.id,
      firstName: kind === "GOOD" ? `StudentGoodY${yearNo}` : `StudentBadY${yearNo}`,
      lastName: `Mock${String(i).padStart(2, "0")}`,
    },
    select: { id: true },
  });

  return { user, profile };
}

// NOTE: StudyPlan / Term / PlanEntry / Transcript are created from the frontend flows.

async function main() {
  // NOTE: do NOT truncate here; users can run prisma migrate reset separately.
  const curriculum = await upsertCurriculum();
  const groups = await ensureCourseGroups(curriculum.id);

  await seedCreditRequirements(curriculum.id, groups);
  await seedCourses(curriculum.id, groups);
  await seedPrerequisites();

  const { coop, jt } = await seedTracks(curriculum.id);

  // reset templates (safe in dev): delete existing track plan terms for these tracks to avoid duplication
  await prisma.trackPlanSlot.deleteMany({ where: { termTemplate: { trackId: { in: [coop.id, jt.id] } } } });
  await prisma.trackPlanCourse.deleteMany({ where: { termTemplate: { trackId: { in: [coop.id, jt.id] } } } });
  await prisma.trackPlanTerm.deleteMany({ where: { trackId: { in: [coop.id, jt.id] } } });

  await seedTrackPlan(coop.id, "COOP");
  await seedTrackPlan(jt.id, "JOB_TRAINING");

  await ensureValidationRules();

  // Students (demo)
  await createStudent(1, 1, "GOOD");
  await createStudent(2, 1, "BAD");


  console.log("✅ Seed completed.");
  console.log("Login accounts (username=13 digits, password=12345678):");
  const users = await prisma.userAccount.findMany({ orderBy: { id: "asc" }, select: { username: true } });
  for (const u of users.slice(-8)) console.log("-", u.username);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
