import type { Request, Response } from "express";
import prisma from "../prisma";

/**
 * POST /api/uploads/profile-image
 * - รับไฟล์จาก multer field ชื่อ "file"
 * - เก็บ binary ลง MediaFile
 * - ผูกกับ StudentProfile ของ user ที่ login
 * - คืน profileImageUrl เพื่อให้ frontend เอาไป render ได้ทันที
 */
export async function uploadProfileImage(req: Request, res: Response) {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;
    const user = (req as any).user as { userId?: number } | undefined;

    if (!user?.userId) return res.status(401).json({ message: "Unauthorized" });
    if (!file)
      return res
        .status(400)
        .json({ message: "No file uploaded (field name must be 'file')" });

    const created = await prisma.mediaFile.create({
      data: {
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        // Prisma Bytes ต้องการ Uint8Array
        data: new Uint8Array(file.buffer),
      },
      select: { id: true },
    });

    const profileImageUrl = `/api/uploads/${created.id}`;

    await prisma.studentProfile.update({
      where: { userId: user.userId },
      data: {
        profileImageFileId: created.id,
        profileImageUrl,
      },
    });

    return res.json({
      message: "อัปโหลดรูปโปรไฟล์สำเร็จ",
      fileId: created.id,
      profileImageUrl,
    });
  } catch (e: any) {
    console.error("uploadProfileImage error:", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

/**
 * GET /api/uploads/:id
 * - ส่ง binary file กลับเป็นรูป
 */
export async function getFileById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });

    const file = await prisma.mediaFile.findUnique({
      where: { id },
      select: { mimeType: true, fileName: true, data: true },
    });
    if (!file) return res.status(404).json({ message: "File not found" });

    res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${file.fileName}"`);
    res.setHeader("Cache-Control", "no-store");

    return res.status(200).send(Buffer.from(file.data));
  } catch (e: any) {
    console.error("getFileById error:", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
