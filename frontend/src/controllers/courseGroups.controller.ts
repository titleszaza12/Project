/**
 * src/controllers/courseGroups.controller.ts
 * ======================================================
 * CourseGroup Controller
 *
 * CourseGroup = กลุ่มรายวิชา/หมวด เช่น "ศึกษาทั่วไป", "วิชาเฉพาะ"
 * และรองรับกลุ่มย่อย (parentGroupId)
 */
import type { Request, Response } from "express";
import { prisma } from "../prisma";
import { pickFirst, pickFirstOrThrow } from "../utils/req";

export async function list(req: Request, res: Response) {
  // optional filter by curriculumId
  const curriculumId = pickFirst(req.query.curriculumId);
  const where = curriculumId ? { curriculumId: Number(curriculumId) } : undefined;

  const items = await prisma.courseGroup.findMany({
    where,
    include: { subGroups: true },
    orderBy: { id: "asc" },
  });
  return res.json({ items });
}

export async function getById(req: Request, res: Response) {
  const id = Number(pickFirstOrThrow(req.params.id, "id"));

  const item = await prisma.courseGroup.findUnique({
    where: { id },
    include: {
      parentGroup: true,
      subGroups: true,
      courses: true,
      creditRequirements: true,
    },
  });
  if (!item) return res.status(404).json({ message: "ไม่พบ CourseGroup" });
  return res.json({ item });
}

export async function create(req: Request, res: Response) {
  const { groupCode, groupName, curriculumId, parentGroupId } = req.body ?? {};

  if (!groupCode || !groupName || curriculumId === undefined) {
    return res.status(400).json({ message: "กรุณากรอก groupCode, groupName, curriculumId" });
  }

  const item = await prisma.courseGroup.create({
    data: {
      groupCode: String(groupCode),
      groupName: String(groupName),
      curriculumId: Number(curriculumId),
      parentGroupId: parentGroupId === undefined || parentGroupId === null || parentGroupId === "" ? null : Number(parentGroupId),
    },
  });

  return res.status(201).json({ message: "สร้าง CourseGroup สำเร็จ", item });
}

export async function update(req: Request, res: Response) {
  const id = Number(pickFirstOrThrow(req.params.id, "id"));
  const { groupCode, groupName, parentGroupId } = req.body ?? {};

  const parentId =
    parentGroupId === null || parentGroupId === "" ? null
    : parentGroupId === undefined ? undefined
    : Number(parentGroupId);

  const item = await prisma.courseGroup.update({
    where: { id },
    data: {
      groupCode: groupCode !== undefined ? String(groupCode) : undefined,
      groupName: groupName !== undefined ? String(groupName) : undefined,
      parentGroupId: parentId,
    },
  });

  return res.json({ message: "อัปเดต CourseGroup สำเร็จ", item });
}

export async function remove(req: Request, res: Response) {
  const id = Number(pickFirstOrThrow(req.params.id, "id"));
  await prisma.courseGroup.delete({ where: { id } });
  return res.json({ message: "ลบ CourseGroup สำเร็จ" });
}
