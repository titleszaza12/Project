/**
 * src/controllers/auth.controller.ts
 * ======================================================
 * Auth Controller (Student-only)
 *
 * Endpoint:
 * - POST /api/auth/register
 * - POST /api/auth/login
 * - GET  /api/auth/me
 */

import type { Request, Response } from "express";
import prisma from "../prisma";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";

export const register = async (req: Request, res: Response) => {
  try {
    const { studentCode, firstName, lastName, password } = req.body as {
      studentCode?: string;
      firstName?: string;
      lastName?: string;
      password?: string;
    };

    if (!studentCode || !firstName || !lastName || !password) {
      return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" });
    }

    const existingUser = await prisma.userAccount.findUnique({
      where: { username: studentCode },
    });

    if (existingUser) {
      return res.status(409).json({ message: "รหัสนักศึกษานี้ถูกใช้งานแล้ว" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // nested create ได้เมื่อ schema relation ถูกต้อง (StudentProfile.userId @unique)
    const newUser = await prisma.userAccount.create({
      data: {
        username: studentCode,
        passwordHash: hashedPassword,
        studentProfile: {
          create: {
            firstName,
            lastName,
          },
        },
      },
      include: { studentProfile: true },
    });

    return res.status(201).json({
      message: "สมัครสมาชิกสำเร็จ",
      userId: newUser.id,
    });
  } catch (err: any) {
    // unique constraint (ซ้ำจริง) เท่านั้น
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json({ message: "รหัสนักศึกษานี้ถูกใช้งานแล้ว" });
    }

    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ message: "เกิดข้อผิดพลาดในระบบ" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { studentCode, password } = req.body as { studentCode?: string; password?: string };

    if (!studentCode || !password) {
      return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    }

    const user = await prisma.userAccount.findUnique({
      where: { username: studentCode },
      include: { studentProfile: true },
    });

    // ป้องกัน user enumeration
    if (!user) {
      return res.status(401).json({ message: "รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง" });
    }

    if (!user.studentProfile) {
      return res.status(500).json({ message: "ไม่พบโปรไฟล์นักศึกษา" });
    }

    const secret = process.env.JWT_SECRET || "dev_secret_change_me";
    const token = jwt.sign(
      {
        userId: user.id,
        studentCode: user.username,
        studentProfileId: user.studentProfile.id,
      },
      secret,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        studentCode: user.username,
        studentProfileId: user.studentProfile.id,
        firstName: user.studentProfile.firstName,
        lastName: user.studentProfile.lastName,
        profileImageUrl: (user.studentProfile as any).profileImageUrl ?? null,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "เกิดข้อผิดพลาดในระบบ" });
  }
};

export const me = async (req: Request, res: Response) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await prisma.userAccount.findUnique({
      where: { id: req.user.userId },
      include: { studentProfile: true },
    });

    if (!user || !user.studentProfile) {
      return res.status(404).json({ message: "ไม่พบข้อมูลผู้ใช้" });
    }

    return res.json({
      id: user.id,
      studentCode: user.username,
      studentProfileId: user.studentProfile.id,
      firstName: user.studentProfile.firstName,
      lastName: user.studentProfile.lastName,
      profileImageUrl: (user.studentProfile as any).profileImageUrl ?? null,
    });
  } catch (err) {
    console.error("ME ERROR:", err);
    return res.status(500).json({ message: "เกิดข้อผิดพลาดในระบบ" });
  }
};
