/**
 * src/controllers/curriculum.controller.ts
 * ======================================================
 * Curriculum Controller
 *
 * Curriculum = "หลักสูตร" (ในระบบนี้มักมี 1 หลักสูตรเป็นแกน)
 *
 * แนวทางที่ใช้:
 * - CRUD พื้นฐาน (สร้าง/อ่าน/แก้/ลบ)
 * - include ความสัมพันธ์บางส่วนเพื่อให้ frontend ดึงข้อมูลไปใช้ได้ง่าย
 *
 * หมายเหตุ:
 * - ตอนนี้เราใส่ authGuard ใน router เพื่อกันคนที่ไม่ login
 */
import type { Request, Response } from "express";
import { prisma } from "../prisma";
import { pickFirstOrThrow } from "../utils/req";

export async function list(_req: Request, res: Response) {
  const items = await prisma.curriculum.findMany({
    orderBy: { id: "asc" },
  });
  return res.json({ items });
}

export async function getById(req: Request, res: Response) {
  const id = Number(pickFirstOrThrow(req.params.id, "id"));
  const item = await prisma.curriculum.findUnique({
    where: { id },
    include: {
      courseGroups: true,
      creditRequirements: { include: { courseGroup: true } },
      courses: true,
    },
  });
  if (!item) return res.status(404).json({ message: "ไม่พบหลักสูตร" });
  return res.json({ item });
}

export async function create(req: Request, res: Response) {
  const { curriculumName, totalMinCredits } = req.body ?? {};
  if (!curriculumName || totalMinCredits === undefined) {
    return res.status(400).json({ message: "กรุณากรอก curriculumName และ totalMinCredits" });
  }

  const item = await prisma.curriculum.create({
    data: {
      curriculumName: String(curriculumName),
      totalMinCredits: Number(totalMinCredits),
    },
  });
  return res.status(201).json({ message: "สร้างหลักสูตรสำเร็จ", item });
}

export async function update(req: Request, res: Response) {
  const id = Number(pickFirstOrThrow(req.params.id, "id"));
  const { curriculumName, totalMinCredits } = req.body ?? {};

  const item = await prisma.curriculum.update({
    where: { id },
    data: {
      curriculumName: curriculumName !== undefined ? String(curriculumName) : undefined,
      totalMinCredits: totalMinCredits !== undefined ? Number(totalMinCredits) : undefined,
    },
  });

  return res.json({ message: "อัปเดตหลักสูตรสำเร็จ", item });
}

export async function remove(req: Request, res: Response) {
  const id = Number(pickFirstOrThrow(req.params.id, "id"));
  await prisma.curriculum.delete({ where: { id } });
  return res.json({ message: "ลบหลักสูตรสำเร็จ" });
}
