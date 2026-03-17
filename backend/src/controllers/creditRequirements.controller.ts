/**
 * src/controllers/creditRequirements.controller.ts
 * ======================================================
 * CreditRequirement = เงื่อนไขหน่วยกิตขั้นต่ำต่อหมวด/กลุ่มวิชา
 *
 * ใช้สำหรับหน้าตรวจสอบจบ/สรุปหน่วยกิตรายหมวด
 */
import type { Request, Response } from "express";
import { prisma } from "../prisma";
import { pickFirst, pickFirstOrThrow } from "../utils/req";

export async function list(req: Request, res: Response) {
  const curriculumId = pickFirst(req.query.curriculumId);
  const where = curriculumId ? { curriculumId: Number(curriculumId) } : undefined;

  const items = await prisma.creditRequirement.findMany({
    where,
    include: { courseGroup: true },
    orderBy: { id: "asc" },
  });
  return res.json({ items });
}

export async function getById(req: Request, res: Response) {
  const id = Number(pickFirstOrThrow(req.params.id, "id"));
  const item = await prisma.creditRequirement.findUnique({
    where: { id },
    include: { courseGroup: true, curriculum: true },
  });
  if (!item) return res.status(404).json({ message: "ไม่พบ CreditRequirement" });
  return res.json({ item });
}

export async function create(req: Request, res: Response) {
  const { minCredits, curriculumId, courseGroupId } = req.body ?? {};
  if (minCredits === undefined || curriculumId === undefined || courseGroupId === undefined) {
    return res.status(400).json({ message: "กรุณากรอก minCredits, curriculumId, courseGroupId" });
  }

  const item = await prisma.creditRequirement.create({
    data: {
      minCredits: Number(minCredits),
      curriculumId: Number(curriculumId),
      courseGroupId: Number(courseGroupId),
    },
  });

  return res.status(201).json({ message: "สร้าง CreditRequirement สำเร็จ", item });
}

export async function update(req: Request, res: Response) {
  const id = Number(pickFirstOrThrow(req.params.id, "id"));
  const { minCredits } = req.body ?? {};

  const item = await prisma.creditRequirement.update({
    where: { id },
    data: {
      minCredits: minCredits !== undefined ? Number(minCredits) : undefined,
    },
  });

  return res.json({ message: "อัปเดต CreditRequirement สำเร็จ", item });
}

export async function remove(req: Request, res: Response) {
  const id = Number(pickFirstOrThrow(req.params.id, "id"));
  await prisma.creditRequirement.delete({ where: { id } });
  return res.json({ message: "ลบ CreditRequirement สำเร็จ" });
}
