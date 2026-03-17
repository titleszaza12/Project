/**
 * src/services/gpa.service.ts
 * ======================================================
 * Service สำหรับคำนวณ GPA จาก "Transcript (เกรดจริง)"
 *
 * ทำไมต้องใช้ Transcript แทน PlanEntry?
 * - PlanEntry คือ "แผน" (สิ่งที่วางจะเรียน)
 * - Transcript คือ "ผลการเรียนจริง" (สิ่งที่เรียนแล้วได้เกรดจริง)
 *
 * ดังนั้น:
 * - GPA / หน่วยกิตสะสม / ผ่าน-ไม่ผ่าน -> ต้องอิง Transcript
 *
 * การคำนวณ:
 * - GPA = sum(gradePoint * credits) / sum(credits) สำหรับรายการที่ "นับ GPA"
 */

import { prisma } from "../prisma";

// Transcript.grade ถูกออกแบบเป็น Float? (คะแนนเกรด) เช่น 3.5, 4.0, 0.0
// null = ยังไม่ใส่เกรด

export async function calculateGPA(studentProfileId: number) {
  const transcripts = await prisma.transcript.findMany({
    where: { studentId: studentProfileId },
  });

  let totalScore = 0;
  let totalCredits = 0;

  // หน่วยกิตสะสมแบบผ่าน (ไม่จำเป็นต้องเท่ากับ credits ที่นับ GPA)
  let passedCredits = 0;

  for (const t of transcripts) {
    const gp = t.grade;
    if (gp === null || gp === undefined) continue;

    // ผ่าน: ตั้งแต่ D (1.0) ขึ้นไป (F=0.0 ไม่ผ่าน)
    if (gp > 0) passedCredits += t.credits;

    // นับ GPA เฉพาะรายการที่มีคะแนนเกรด
    totalScore += gp * t.credits;
    totalCredits += t.credits;
  }

  const gpa = totalCredits > 0 ? totalScore / totalCredits : 0;

  return {
    gpa: Number(gpa.toFixed(2)),
    gpaCredits: totalCredits,     // หน่วยกิตที่ถูกนำไปคิด GPA
    passedCredits,                // หน่วยกิตที่ "ผ่าน" (ใช้แสดง progress)
    transcriptCount: transcripts.length,
  };
}
