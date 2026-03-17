/**
 * src/services/validationFuseki.service.ts
 * ======================================================
 * บริการ "กดตรวจสอบแผน" (Validate Plan) ด้วย Fuseki + SPARQL Rules
 *
 * สิ่งที่ไฟล์นี้ทำ:
 * 1) สร้าง RDF (แผน+ผลการเรียนจริง) -> named graph
 * 2) โหลด rule จาก Fuseki (:ValidationRule ที่ ACTIVE)
 * 3) รัน SPARQL ทีละ rule แล้วแปลง bindings -> ValidationResult (ข้อความไทยอ่านง่าย)
 * 4) บันทึก ValidationRun + ValidationResult ลง DB
 *
 * หมายเหตุ:
 * - Rule ใน TTL ที่รองรับตอนนี้ (ตามไฟล์ ITStudyPlan_RMUTTO_RULES_MATCH_DB_v1.ttl):
 *   CREDIT_001: หน่วยกิตรายหมวดไม่ครบ (roll-up ตาม subGroupOf*)
 *   CREDIT_002: หน่วยกิตรวมไม่ครบ
 *   CURR_001:  วิชาบังคับยังไม่ครบ
 *   PLAN_001:  วิชาซ้ำในเทอมเดียวกัน
 *   PLAN_002:  วางแผนลงวิชาที่เรียนผ่านไปแล้ว
 *   PREREQ_001: วางแผนลงวิชา แต่ยังไม่ผ่าน prerequisite
 */
import { prisma } from "../prisma";
import { buildStudentPlanGraphTurtle, courseCodeToIndividual } from "./rdfPlanBuilder.service";
import { fetchActiveRules, getFusekiConfig, putNamedGraphTurtle, sparqlSelect } from "./fuseki.service";

/** passing grades ที่ถือว่า "ผ่านรายวิชา" */
const PASSING_GRADES = new Set(["A", "B+", "B", "C+", "C", "D+", "D", "S", "P"]);

function localNameFromUri(u: string) {
  // <http://...#Something> หรือ http://...#Something
  const hashIdx = u.lastIndexOf("#");
  if (hashIdx >= 0) return u.slice(hashIdx + 1).replace(/[>]/g, "");
  return u.replace(/[>]/g, "");
}

async function courseIdFromCourseIndividual(localName: string) {
  // localName: Course_04_06_212 -> courseCode: 04-06-212
  if (!localName.startsWith("Course_")) return null;
  const code = localName.replace(/^Course_/, "").replace(/_/g, "-");
  const course = await prisma.course.findUnique({ where: { courseCode: code } });
  return course?.id ?? null;
}

async function termIdFromTermUri(u: string) {
  const local = localNameFromUri(u);
  if (!local.startsWith("Term_")) return null;
  const id = Number(local.replace("Term_", ""));
  return Number.isFinite(id) ? id : null;
}

function formatGroupNameFromUri(u: string) {
  // ใน TTL หมวดเป็น CourseGroup individual เช่น G_GE, G_MAJOR
  // เราไม่มี table mapping ชื่อ group ใน DB ทุกตัวแบบ 1:1 (บางครั้งอยู่ใน Fuseki)
  // ดังนั้นตรงนี้เราทำข้อความอ่านง่ายขึ้น: แยกชื่อหลัง # ถ้ามี
  return localNameFromUri(u);
}

export async function validateStudyPlanWithFuseki(params: { studentId: number; studyPlanId: number }) {
  const cfg = getFusekiConfig();

  // 1) build RDF graph for this student plan
  const turtle = await buildStudentPlanGraphTurtle(params);
  const graphUri = `http://rmutto.ac.th/it-studyplan#graph/studyplan/${params.studyPlanId}`;

  // overwrite graph
  await putNamedGraphTurtle(cfg, graphUri, turtle);

  // 2) load active rules from Fuseki
  const rules = await fetchActiveRules(cfg);

  // 3) create run
  const run = await prisma.validationRun.create({
    data: {
      studyPlanId: params.studyPlanId,
      startedAt: new Date(),
    },
  });

  // helper: upsert ValidationRule in DB (เพื่อ join + แสดงใน UI)
  async function ensureDbRule(ruleKey: string, comment?: string) {
    return prisma.validationRule.upsert({
      where: { ruleCode: ruleKey },
      update: {
        ruleText: comment ?? ruleKey,
        // default severity: WARNING (ปรับภายหลังได้)
        severity: "WARNING",
        language: "SPARQL",
      },
      create: {
        ruleCode: ruleKey,
        ruleText: comment ?? ruleKey,
        severity: "WARNING",
        language: "SPARQL",
      },
    });
  }

  const resultsToCreate: Array<{
    ruleId: number;
    message: string;
    severity: "WARNING" | "ERROR" | "INFO";
    termId?: number | null;
    courseId?: number | null;
  }> = [];

  // 4) run each rule
  for (const r of rules) {
    if (!r.sparqlText?.trim()) continue;

    // IMPORTANT: ให้ SPARQL query เห็น named graph นักศึกษา
    // วิธีที่ปลอดภัย: wrap query ด้วย GRAPH <graphUri> สำหรับส่วนที่เป็น PlanEntry/Student
    // แต่ใน TTL เดิม query ไม่ระบุ GRAPH -> จะ query across default graph
    // ใน Fuseki, named graphs ไม่ถูก query ถ้าไม่ระบุ FROM/FROM NAMED/GRAPH
    // ดังนั้นเราจะ inject "FROM <graphUri>" เข้าไปหลัง PREFIX block
    const injected = injectFromGraph(r.sparqlText, graphUri);

    const sel = await sparqlSelect(cfg, injected);
    const bindings = sel.results.bindings;

    if (bindings.length === 0) continue;

    const dbRule = await ensureDbRule(r.ruleKey, r.comment);

    // mapping ต่อ ruleKey
    if (r.ruleKey === "CREDIT_001") {
      for (const b of bindings) {
        const group = b.group?.value ?? "";
        const minReq = b.minReq?.value ?? "";
        const sumCredits = b.sumCredits?.value ?? b.sumCredits?.value ?? "";
        const msg = `หน่วยกิตหมวด ${formatGroupNameFromUri(group)} ได้ ${sumCredits} หน่วยกิต (ต้องอย่างน้อย ${minReq})`;
        resultsToCreate.push({ ruleId: dbRule.id, message: msg, severity: "WARNING" });
      }
    } else if (r.ruleKey === "CREDIT_002") {
      for (const b of bindings) {
        const minReq = b.minReq?.value ?? "";
        const sumCredits = b.sumCredits?.value ?? "";
        const msg = `หน่วยกิตรวมได้ ${sumCredits} หน่วยกิต (ต้องอย่างน้อย ${minReq})`;
        resultsToCreate.push({ ruleId: dbRule.id, message: msg, severity: "WARNING" });
      }
    } else if (r.ruleKey === "CURR_001") {
      for (const b of bindings) {
        const courseUri = b.course?.value ?? "";
        const courseLocal = localNameFromUri(courseUri);
        const courseId = await courseIdFromCourseIndividual(courseLocal);
        const msg = `ยังไม่ได้ผ่านวิชาบังคับ: ${courseLocal.replace(/^Course_/, "").replace(/_/g, "-")}`;
        resultsToCreate.push({ ruleId: dbRule.id, message: msg, severity: "WARNING", courseId });
      }
    } else if (r.ruleKey === "PLAN_001") {
      for (const b of bindings) {
        const termUri = b.term?.value ?? "";
        const courseUri = b.course?.value ?? "";
        const termId = await termIdFromTermUri(termUri);
        const courseLocal = localNameFromUri(courseUri);
        const courseId = await courseIdFromCourseIndividual(courseLocal);
        const msg = `มีการวางแผนลงวิชาซ้ำในเทอมเดียวกัน: ${courseLocal.replace(/^Course_/, "").replace(/_/g, "-")}`;
        resultsToCreate.push({ ruleId: dbRule.id, message: msg, severity: "WARNING", termId, courseId });
      }
    } else if (r.ruleKey === "PLAN_002") {
      for (const b of bindings) {
        const courseUri = b.course?.value ?? "";
        const courseLocal = localNameFromUri(courseUri);
        const courseId = await courseIdFromCourseIndividual(courseLocal);
        const msg = `รายวิชานี้เรียนผ่านไปแล้ว ไม่จำเป็นต้องวางแผนซ้ำ: ${courseLocal.replace(/^Course_/, "").replace(/_/g, "-")}`;
        resultsToCreate.push({ ruleId: dbRule.id, message: msg, severity: "INFO", courseId });
      }
    } else if (r.ruleKey === "PREREQ_001") {
      for (const b of bindings) {
        const courseUri = b.course?.value ?? "";
        const prereqUri = b.prereqCourse?.value ?? "";
        const courseLocal = localNameFromUri(courseUri);
        const prereqLocal = localNameFromUri(prereqUri);
        const courseId = await courseIdFromCourseIndividual(courseLocal);
        const msg = `ยังไม่ผ่านวิชาพื้นฐาน (Prerequisite): ต้องผ่าน ${prereqLocal.replace(/^Course_/, "").replace(/_/g, "-")} ก่อนลง ${courseLocal.replace(/^Course_/, "").replace(/_/g, "-")}`;
        resultsToCreate.push({ ruleId: dbRule.id, message: msg, severity: "ERROR", courseId });
      }
    } else {
      // fallback: dump variables แบบสั้น ๆ
      const msg = `Rule ${r.ruleKey} พบ ${bindings.length} รายการไม่ผ่านเงื่อนไข`;
      resultsToCreate.push({ ruleId: dbRule.id, message: msg, severity: "WARNING" });
    }
  }

  // 5) persist results
  if (resultsToCreate.length > 0) {
    await prisma.validationResult.createMany({
      data: resultsToCreate.map((x) => ({
        runId: run.id,
        ruleId: x.ruleId,
        message: x.message,
        severity: x.severity,
        termId: x.termId ?? null,
        courseId: x.courseId ?? null,
      })),
    });
  }

  // 6) finish run summary
  const finished = await prisma.validationRun.update({
    where: { id: run.id },
    data: {
      finishedAt: new Date(),
    },
  });

  return { run: finished, resultsCount: resultsToCreate.length };
}

/**
 * inject FROM <graphUri> เข้าไปใน SPARQL SELECT
 *
 * ทำไมต้อง inject?
 * - เราเก็บ plan data ไว้ใน named graph
 * - ถ้า query ไม่มี FROM/GRAPH จะไม่เห็น named graph
 * - วิธีง่ายสุดคือเพิ่ม: FROM <graphUri>
 *
 * ข้อควรระวัง:
 * - เราใส่ FROM หลัง PREFIX block (ถ้ามี)
 * - ถ้า query มี FROM อยู่แล้ว เราไม่ใส่ซ้ำ
 */
function injectFromGraph(query: string, graphUri: string) {
  if (/\bFROM\b/i.test(query)) return query;

  const lines = query.split("\n");
  let i = 0;
  while (i < lines.length && lines[i].trim().toUpperCase().startsWith("PREFIX")) i++;

  // insert FROM line after prefix block and before SELECT
  const fromLine = `FROM <${graphUri}>`;
  lines.splice(i, 0, fromLine);
  return lines.join("\n");
}
