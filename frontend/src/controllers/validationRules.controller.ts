/**
 * src/controllers/validationRules.controller.ts
 * ======================================================
 * ValidationRule Controller
 *
 * Rule = กฎที่ใช้ตรวจสอบแผนการเรียน (เช่น A1, B2)
 * ใน MVP ตอนนี้ เราใช้ NOTE เป็นหลัก (ruleText) และ severity
 *
 * หมายเหตุ:
 * - ต่อไปตี้สามารถเก็บ SPARQL ใน ruleText หรือเพิ่ม field ใหม่ได้
 * - ตอนนี้ schema มี language = SPARQL | NOTE
 */
import type { Request, Response } from "express";
import { prisma } from "../prisma";
import { pickFirstOrThrow } from "../utils/req";

export async function list(_req: Request, res: Response) {
  const items = await prisma.validationRule.findMany({ orderBy: { ruleCode: "asc" } });
  return res.json({ items });
}

export async function getById(req: Request, res: Response) {
  const id = Number(pickFirstOrThrow(req.params.id, "id"));
  const item = await prisma.validationRule.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ message: "ไม่พบ ValidationRule" });
  return res.json({ item });
}

export async function create(req: Request, res: Response) {
  const { ruleCode, ruleText, severity, language } = req.body ?? {};
  if (!ruleCode || !ruleText || !severity || !language) {
    return res.status(400).json({ message: "กรุณากรอก ruleCode, ruleText, severity, language" });
  }

  const item = await prisma.validationRule.create({
    data: {
      ruleCode: String(ruleCode),
      ruleText: String(ruleText),
      severity,
      language,
    },
  });

  return res.status(201).json({ message: "สร้าง ValidationRule สำเร็จ", item });
}

export async function update(req: Request, res: Response) {
  const id = Number(pickFirstOrThrow(req.params.id, "id"));
  const { ruleText, severity, language } = req.body ?? {};

  const item = await prisma.validationRule.update({
    where: { id },
    data: {
      ruleText: ruleText !== undefined ? String(ruleText) : undefined,
      severity: severity !== undefined ? severity : undefined,
      language: language !== undefined ? language : undefined,
    },
  });

  return res.json({ message: "อัปเดต ValidationRule สำเร็จ", item });
}

export async function remove(req: Request, res: Response) {
  const id = Number(pickFirstOrThrow(req.params.id, "id"));
  await prisma.validationRule.delete({ where: { id } });
  return res.json({ message: "ลบ ValidationRule สำเร็จ" });
}
