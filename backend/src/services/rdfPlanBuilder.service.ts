/**
 * src/services/rdfPlanBuilder.service.ts
 * ======================================================
 * แปลง "แผนการเรียน + transcript" ในฐานข้อมูล (Relational DB)
 * ให้กลายเป็น RDF/Turtle เพื่อส่งให้ Fuseki ใช้ตรวจ Rule (SPARQL)
 *
 * แนวคิด:
 * - หลักสูตร/วิชา/หมวด/credit requirement/prereq อยู่ใน Fuseki อยู่แล้ว (ontology.ttl)
 * - เราจะส่งเฉพาะ "ข้อมูลนักศึกษาและรายการเรียนของเขา" เข้า named graph
 * - Rule ใน TTL จะ query รวมทั้ง graph หลัก + graph นักศึกษา
 *
 * ความสอดคล้อง URI (สำคัญมาก)
 * - ใน TTL หลักสูตร มี Course individual ชื่อรูปแบบ :Course_04_06_212 เป็นต้น
 *   (เอา courseCode มาแทน '-' เป็น '_' และนำหน้า Course_)
 *
 * ตัวอย่าง:
 *   courseCode = "04-06-212"  =>  :Course_04_06_212
 *
 * - เราจะสร้าง URI สำหรับ Student/Term/PlanEntry แบบ deterministic:
 *   :Student_{studentId}
 *   :Term_{termId}
 *   :PlanEntry_{entryId}
 *
 * หมายเหตุเรื่อง Transcript:
 * - ระบบ DB แยก transcript ออกจาก plan entry
 * - แต่ Rule ใน TTL ตรวจผ่าน PlanEntry (entryStatus/entryGrade)
 * - ดังนั้นเราจะ "ฉาย" transcript ให้เป็น PlanEntry อีกชุดหนึ่ง (สถานะ PASSED)
 */
import { prisma } from "../prisma";

const NS = "http://rmutto.ac.th/it-studyplan#";

/** แปลงรหัสวิชาให้เป็น localname ของ individual ใน TTL */
export function courseCodeToIndividual(courseCode: string) {
  const safe = courseCode.replace(/[^0-9A-Za-z]+/g, "_");
  return `Course_${safe}`;
}

export function uri(localName: string) {
  return `<${NS}${localName}>`;
}

function litStr(v: string) {
  return JSON.stringify(v);
}
function litInt(v: number) {
  return `"${v}"^^<http://www.w3.org/2001/XMLSchema#integer>`;
}

export type BuildRdfInput = {
  studentId: number;
  studyPlanId: number;
};

export async function buildStudentPlanGraphTurtle(input: BuildRdfInput) {
  const { studentId, studyPlanId } = input;

  // ดึง plan + term + entries
  const plan = await prisma.studyPlan.findUnique({
    where: { id: studyPlanId },
    include: {
      terms: {
        orderBy: [{ termYear: "asc" }, { termNo: "asc" }],
        include: { entries: { include: { course: true } } },
      },
    },
  });

  if (!plan) throw new Error("ไม่พบ StudyPlan");
  if (plan.studentId !== studentId) throw new Error("StudyPlan ไม่ได้เป็นของนักศึกษาคนนี้");

  // ดึง transcript ทั้งหมดของนักศึกษา (เพื่อใช้เป็น completed courses จริง)
  const transcripts = await prisma.transcript.findMany({
    where: { studentId },
    include: { course: true },
  });

  const studentNode = `Student_${studentId}`;

  const ttl: string[] = [];
  ttl.push(`# Auto-generated RDF for student plan validation`);
  ttl.push(`@prefix : <${NS}> .`);
  ttl.push(`@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .`);
  ttl.push(`@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .`);
  ttl.push("");

  // Student
  ttl.push(`${uri(studentNode)} rdf:type :Student .`);

  // Terms + PlanEntries from StudyPlan
  for (const t of plan.terms) {
    const termNode = `Term_${t.id}`;
    ttl.push(`${uri(termNode)} rdf:type :Term ; :termYear ${litInt(t.termYear)} ; :termNo ${litInt(t.termNo)} .`);

    for (const e of t.entries) {
      // ถ้า entry ไม่มี course ให้ข้าม (เช่น placeholder slot ที่ยังไม่เลือก)
      if (!e.courseId) continue;

      const entryNode = `PlanEntry_${e.id}`;
      const courseInd = courseCodeToIndividual(e.course!.courseCode);

      ttl.push(
        `${uri(entryNode)} rdf:type :PlanEntry ; ` +
          `:entryForStudent ${uri(studentNode)} ; ` +
          `:entryInTerm ${uri(termNode)} ; ` +
          `:entryCourse ${uri(courseInd)} ; ` +
          `:entryStatus ${litStr(e.status)} .`
      );

      if (e.grade) {
        ttl.push(`${uri(entryNode)} :entryGrade ${litStr(e.grade)} .`);
      }
    }
  }

  // Transcript -> PlanEntry shadow (PASSED)
  // เราจะสร้าง localName ใหม่เพื่อไม่ชนกับ plan entries: PlanEntry_T_{transcriptId}
  for (const tr of transcripts) {
    const entryNode = `PlanEntry_T_${tr.id}`;

    const termNode = `Term_T_${tr.yearNo}_${tr.termNo}`;
    // ถ้า transcript มี termId แล้ว term นั้นน่าจะอยู่ใน DB term table
    // ถ้าไม่มี termId เราสร้าง term ชั่วคราวจาก yearNo/semester เพื่อไม่ให้ SPARQL พัง

    // ประกาศ term (ถ้ายังไม่มี) — เขียนซ้ำไม่เป็นไร (TTL parser จะ merge)
    const yearNo = tr.yearNo ?? 0;
    const semester = tr.termNo ?? 0;
    ttl.push(`${uri(termNode)} rdf:type :Term ; :termYear ${litInt(yearNo)} ; :termNo ${litInt(semester)} .`);

    const courseInd = courseCodeToIndividual(tr.course.courseCode);

    ttl.push(
      `${uri(entryNode)} rdf:type :PlanEntry ; ` +
        `:entryForStudent ${uri(studentNode)} ; ` +
        `:entryInTerm ${uri(termNode)} ; ` +
        `:entryCourse ${uri(courseInd)} ; ` +
        `:entryStatus "PASSED" .`
    );

    if (tr.grade) {
      ttl.push(`${uri(entryNode)} :entryGrade ${litStr(tr.grade)} .`);
    }
  }

  ttl.push("");
  return ttl.join("\n");
}
