/**
 * src/controllers/courses.controller.ts
 * ======================================================
 * Course Controller
 *
 * Course = รายวิชา
 * มีความสัมพันธ์:
 * - curriculumId (อยู่ในหลักสูตรไหน)
 * - groupId (อยู่ในหมวดไหน - optional)
 * - prerequisites (ความสัมพันธ์แบบ many-to-many ผ่าน CoursePrerequisite)
 *
 * Endpoint เพิ่มเติมที่สำคัญ:
 * - POST   /:id/prerequisites          เพิ่ม prerequisite 1 ตัว
 * - DELETE /:id/prerequisites/:pid     ลบ prerequisite 1 ตัว
 */
import type { Request, Response } from "express";
import { prisma } from "../prisma";
import { pickFirst, pickFirstOrThrow } from "../utils/req";

export async function list(req: Request, res: Response) {
  const curriculumId = pickFirst(req.query.curriculumId);
  const groupId = pickFirst(req.query.groupId);
  const q = pickFirst(req.query.q); // keyword search (courseCode/courseNameTH)

  const where: any = {};
  if (curriculumId) where.curriculumId = Number(curriculumId);
  if (groupId) where.groupId = Number(groupId);
  if (q) {
    where.OR = [
      { courseCode: { contains: q, mode: "insensitive" } },
      { courseNameTH: { contains: q, mode: "insensitive" } },
      { courseNameEN: { contains: q, mode: "insensitive" } },
    ];
  }

  const items = await prisma.course.findMany({
    where: Object.keys(where).length ? where : undefined,
    include: {
      group: true,
      prerequisites: { include: { prereqCourse: true } },
    },
    orderBy: { courseCode: "asc" },
  });

  return res.json({ items });
}

export async function getById(req: Request, res: Response) {
  const id = Number(pickFirstOrThrow(req.params.id, "id"));
  const item = await prisma.course.findUnique({
    where: { id },
    include: {
      group: true,
      curriculum: true,
      prerequisites: { include: { prereqCourse: true } },
      prereqFor: { include: { course: true } },
    },
  });
  if (!item) return res.status(404).json({ message: "ไม่พบรายวิชา" });
  return res.json({ item });
}

export async function create(req: Request, res: Response) {
  const { courseCode, courseNameTH, courseNameEN, credits, creditDetail, curriculumId, groupId } = req.body ?? {};
  if (!courseCode || !courseNameTH || credits === undefined || curriculumId === undefined) {
    return res.status(400).json({ message: "กรุณากรอก courseCode, courseNameTH, credits, curriculumId" });
  }

  const item = await prisma.course.create({
    data: {
      courseCode: String(courseCode),
      courseNameTH: String(courseNameTH),
      courseNameEN: courseNameEN ? String(courseNameEN) : null,
      credits: Number(credits),
      creditDetail: creditDetail ? String(creditDetail) : null,
      curriculumId: Number(curriculumId),
      groupId: groupId === undefined || groupId === null || groupId === "" ? null : Number(groupId),
    },
  });

  return res.status(201).json({ message: "สร้างรายวิชาสำเร็จ", item });
}

export async function update(req: Request, res: Response) {
  const id = Number(pickFirstOrThrow(req.params.id, "id"));
  const { courseCode, courseNameTH, courseNameEN, credits, creditDetail, groupId } = req.body ?? {};

  const item = await prisma.course.update({
    where: { id },
    data: {
      courseCode: courseCode !== undefined ? String(courseCode) : undefined,
      courseNameTH: courseNameTH !== undefined ? String(courseNameTH) : undefined,
      courseNameEN: courseNameEN !== undefined ? (courseNameEN ? String(courseNameEN) : null) : undefined,
      credits: credits !== undefined ? Number(credits) : undefined,
      creditDetail: creditDetail !== undefined ? (creditDetail ? String(creditDetail) : null) : undefined,
      groupId: groupId !== undefined ? (groupId === null || groupId === "" ? null : Number(groupId)) : undefined,
    },
  });

  return res.json({ message: "อัปเดตรายวิชาสำเร็จ", item });
}

export async function remove(req: Request, res: Response) {
  const id = Number(pickFirstOrThrow(req.params.id, "id"));
  await prisma.course.delete({ where: { id } });
  return res.json({ message: "ลบรายวิชาสำเร็จ" });
}

/**
 * เพิ่ม prerequisite ให้รายวิชา
 * body: { prereqCourseId: number }
 */
export async function addPrerequisite(req: Request, res: Response) {
  const courseId = Number(pickFirstOrThrow(req.params.id, "id"));
  const { prereqCourseId } = req.body ?? {};
  if (prereqCourseId === undefined) {
    return res.status(400).json({ message: "กรุณากรอก prereqCourseId" });
  }

  const link = await prisma.coursePrerequisite.create({
    data: {
      courseId,
      prereqCourseId: Number(prereqCourseId),
    },
  });

  return res.status(201).json({ message: "เพิ่ม prerequisite สำเร็จ", link });
}

/**
 * ลบ prerequisite
 * path: /courses/:id/prerequisites/:pid
 * - pid = prereqCourseId
 */
export async function removePrerequisite(req: Request, res: Response) {
  const courseId = Number(pickFirstOrThrow(req.params.id, "id"));
  const prereqCourseId = Number(pickFirstOrThrow(req.params.pid, "pid"));

  await prisma.coursePrerequisite.delete({
    where: {
      courseId_prereqCourseId: { courseId, prereqCourseId },
    },
  });

  return res.json({ message: "ลบ prerequisite สำเร็จ" });
}
