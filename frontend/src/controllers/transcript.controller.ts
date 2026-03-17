/**
 * src/controllers/transcript.controller.ts
 * ======================================================
 * Transcript Controller (เกรดจริงของนักศึกษา)
 *
 * วัตถุประสงค์:
 * - ให้นักศึกษาบันทึกผลการเรียนจริง (Transcript)
 * - ใช้ข้อมูลนี้คำนวณ GPA และหน่วยกิตสะสม
 * - เป็นฐานสำหรับหน้า "ตรวจสอบจบการศึกษา" ในอนาคต
 *
 * หมายเหตุ:
 * - ระบบนี้ Student-only: ใช้ authGuard แล้วดึง studentProfileId จาก req.user
 * - เราออกแบบให้ Transcript 1 วิชา ต่อ 1 นักศึกษา (unique: studentId+courseId)
 *   ถ้าในความเป็นจริงมี "ลงซ้ำ" ให้เปลี่ยน unique เป็น (studentId, courseId, attemptNo) ได้
 */

import type { Request, Response } from "express";
import { prisma } from "../prisma";
import { calculateGPA } from "../services/gpa.service";

// ===== Grade Letter -> Grade Point (Float) =====
const GRADE_POINT_MAP: Record<string, number> = {
  "A": 4.0,
  "B+": 3.5,
  "B": 3.0,
  "C+": 2.5,
  "C": 2.0,
  "D+": 1.5,
  "D": 1.0,
  "F": 0.0,
};

function toGradePoint(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const g = String(raw).trim().toUpperCase();
  if (g === "" || g === "-") return null;
  const point = GRADE_POINT_MAP[g];
  if (point === undefined) {
    throw new Error(`Invalid grade letter: ${g}`);
  }
  return point;
}

/**
 * เพิ่ม/อัปเดตผลการเรียน 1 วิชา
 *
 * Request body:
 * - courseId (required) : id ของ Course
 * - yearNo (required)   : ชั้นปี 1-4
 * - termNo (required)   : เทอม 1-2 (และ 3=summer ได้)
 * - grade (required)    : เกรด A,B+,B,...,F,W,I
 *
 * credits:
 * - ถ้าไม่ส่งมา เราจะดึงจาก Course.credits แล้ว snapshot ลง Transcript
 *
 * พฤติกรรม:
 * - ถ้ายังไม่มี transcript ของวิชานี้ -> create
 * - ถ้ามีแล้ว -> update (เพื่อให้แก้เกรดได้)
 */
export async function upsertMyTranscript(req: Request, res: Response) {
  if (!req.user?.studentProfileId) {
    return res.status(401).json({ message: "ไม่พบข้อมูลนักศึกษาใน token" });
  }

  const studentId = req.user.studentProfileId;
  const { courseId, yearNo, termNo, grade, credits } = req.body ?? {};

  // grade อาจเป็น "-" ได้ (แปลว่า null) => ห้ามเช็ค !grade
  if (!courseId || !yearNo || !termNo || grade === undefined) {
    return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ" });
  }

  // หาเครดิตจาก Course ถ้าไม่ได้ส่งมา
  let creditSnapshot: number | null = null;
  if (typeof credits === "number") creditSnapshot = credits;
  else {
    const c = await prisma.course.findUnique({ where: { id: Number(courseId) } });
    if (!c) return res.status(404).json({ message: "ไม่พบรายวิชา (courseId ไม่ถูกต้อง)" });
    creditSnapshot = c.credits;
  }

  let gradePoint: number | null = null;
  try {
    gradePoint = toGradePoint(grade);
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || "เกรดไม่ถูกต้อง" });
  }

  const t = await prisma.transcript.upsert({
    // schema.prisma: @@unique([studentId, courseId, yearNo, termNo])
    where: {
      studentId_courseId_yearNo_termNo: {
        studentId,
        courseId: Number(courseId),
        yearNo: Number(yearNo),
        termNo: Number(termNo),
      },
    },
    create: {
      studentId,
      courseId: Number(courseId),
      yearNo: Number(yearNo),
      termNo: Number(termNo),
      grade: gradePoint,
      credits: Number(creditSnapshot),
    },
    update: {
      grade: gradePoint,
      credits: Number(creditSnapshot),
    },
    include: { course: true },
  });

  return res.json({
    message: "บันทึกผลการเรียนสำเร็จ",
    transcript: {
      id: t.id,
      courseId: t.courseId,
      courseCode: t.course.courseCode,
      courseNameTH: t.course.courseNameTH,
      credits: t.credits,
      yearNo: t.yearNo,
      termNo: t.termNo,
      gradePoint: t.grade, // Float? ใน DB
      gradeLetter: String(grade).trim(), // ส่งกลับไว้ให้ UI แต่ไม่ใช้เป็น source of truth
    },
  });
}

/**
 * ดู Transcript ของตัวเองทั้งหมด
 */
export async function getMyTranscript(req: Request, res: Response) {
  if (!req.user?.studentProfileId) {
    return res.status(401).json({ message: "ไม่พบข้อมูลนักศึกษาใน token" });
  }

  const studentId = req.user.studentProfileId;

  const transcripts = await prisma.transcript.findMany({
    where: { studentId },
    include: { course: true },
    orderBy: [{ yearNo: "asc" }, { termNo: "asc" }],
  });

  return res.json({
    transcripts: transcripts.map((t) => ({
      id: t.id,
      courseId: t.courseId,
      courseCode: t.course.courseCode,
      courseNameTH: t.course.courseNameTH,
      courseNameEN: t.course.courseNameEN ?? null,
      credits: t.credits,
      yearNo: t.yearNo,
      termNo: t.termNo,
      gradePoint: t.grade,
    })),
  });
}

/**
 * คำนวณ GPA และสรุปหน่วยกิตสะสมของตัวเอง
 * ใช้กับ Dashboard ได้ทันที
 */
export async function getMyGPA(req: Request, res: Response) {
  if (!req.user?.studentProfileId) {
    return res.status(401).json({ message: "ไม่พบข้อมูลนักศึกษาใน token" });
  }

  const studentId = req.user.studentProfileId;

  const result = await calculateGPA(studentId);

  return res.json({
    message: "คำนวณ GPA สำเร็จ",
    ...result,
  });
}
