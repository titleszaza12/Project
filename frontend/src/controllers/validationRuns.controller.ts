/**
 * src/controllers/validationRuns.controller.ts
 * ======================================================
 * ValidationRun Controller
 *
 * Run = ประวัติการ "กดตรวจสอบแผน" แต่ละครั้ง
 * - เก็บ startedAt/finishedAt
 * - เก็บ results (ValidationResult)
 *
 * ใช้กับหน้า:
 * - ตรวจสอบจบการศึกษา (แสดงสถานะล่าสุด)
 * - ดูประวัติการตรวจ (ถ้าต้องการ)
 */
import type { Request, Response } from "express";
import { prisma } from "../prisma";
import { pickFirst, pickFirstOrThrow } from "../utils/req";

/**
 * list:
 * - ถ้าส่ง query studyPlanId จะ list เฉพาะของแผนนั้น
 */
export async function list(req: Request, res: Response) {
  const studyPlanId = pickFirst(req.query.studyPlanId);

  const items = await prisma.validationRun.findMany({
    where: studyPlanId ? { studyPlanId: Number(studyPlanId) } : undefined,
    include: { results: { include: { rule: true } } },
    orderBy: { startedAt: "desc" },
  });

  return res.json({ items });
}

export async function getById(req: Request, res: Response) {
  const id = Number(pickFirstOrThrow(req.params.id, "id"));

  const item = await prisma.validationRun.findUnique({
    where: { id },
    include: {
      studyPlan: true,
      results: { include: { rule: true, term: true, course: true } },
    },
  });

  if (!item) return res.status(404).json({ message: "ไม่พบ ValidationRun" });
  return res.json({ item });
}
