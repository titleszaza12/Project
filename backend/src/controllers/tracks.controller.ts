/**
 * src/controllers/tracks.controller.ts
 * ======================================================
 * Endpoint:
 * - GET  /api/tracks
 *   คืนรายการแผนการเรียนทั้งหมด  ✅ return { items: [...] }
 *
 * - GET  /api/tracks/:code/plan
 *   คืนโครงแผนแนะนำของแผนนั้น ✅ return { track, terms }
 */
import { Request, Response } from "express";
import { prisma } from "../prisma";
import { pickFirstOrThrow } from "../utils/req";

export async function listTracks(_req: Request, res: Response) {
  const tracks = await prisma.track.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      code: true,
      nameTH: true,
      nameEN: true,
      descriptionTH: true,
      descriptionEN: true,
      curriculumId: true,
    },
  });

  // ✅ ให้ frontend อ่านง่าย: items เป็น array
  const items = tracks.map((t) => ({
    id: t.id,
    code: t.code,
    name: t.nameTH ?? t.nameEN ?? t.code,
    nameTH: t.nameTH,
    nameEN: t.nameEN,
    descriptionTH: t.descriptionTH,
    descriptionEN: t.descriptionEN,
    curriculumId: t.curriculumId,
  }));

  return res.json({ items });
}

export async function getTrackPlan(req: Request, res: Response) {
  const code = pickFirstOrThrow(req.params.code, "code");

  const track = await prisma.track.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      nameTH: true,
      nameEN: true,
      descriptionTH: true,
      descriptionEN: true,
      curriculumId: true,
      planTerms: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          year: true,
          termNo: true,
          termType: true,
          suggestedTotalCredits: true,
          sortOrder: true,
          courseEntries: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              sortOrder: true,
              noteTH: true,
              noteEN: true,
              course: {
                select: {
                  id: true,
                  courseCode: true,
                  courseNameTH: true,
                  courseNameEN: true,
                  credits: true,
                  group: {
                    select: {
                      id: true,
                      groupCode: true,
                      groupName: true,
                      groupNameEN: true,
                    },
                  },
                },
              },
            },
          },
          slots: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              slotCode: true,
              titleTH: true,
              titleEN: true,
              groupCode: true,
              requiredCredits: true,
              requiredCourses: true,
              noteTH: true,
              noteEN: true,
              sortOrder: true,
            },
          },
        },
      },
    },
  });

  if (!track) {
    return res.status(404).json({ message: "ไม่พบแผนการเรียน (track) ที่ร้องขอ" });
  }

  // ✅ normalize เป็น terms[] ให้หน้า plan ใช้ตรง ๆ
  const terms = (track.planTerms ?? []).map((t) => {
    const courses = (t.courseEntries ?? []).map((ce) => ({
      id: ce.id,
      courseId: ce.course?.id,
      code: ce.course?.courseCode ?? "",
      nameTh: ce.course?.courseNameTH ?? "",
      nameEn: ce.course?.courseNameEN ?? "",
      credits: ce.course?.credits ?? 0,
      groupCode: ce.course?.group?.groupCode ?? null,
      groupName: ce.course?.group?.groupName ?? null,
      groupNameEn: ce.course?.group?.groupNameEN ?? null,
      note: ce.noteTH ?? ce.noteEN ?? null,
      sortOrder: ce.sortOrder,
    }));

    const slots = (t.slots ?? []).map((s) => ({
      id: s.id,
      name: s.titleTH ?? s.titleEN ?? s.slotCode ?? null,
      minCredits: s.requiredCredits ?? null,
      maxCredits: null, // ใน schema ไม่มี max -> ไม่เดาเพิ่ม
      groupCode: s.groupCode ?? null,
      note: s.noteTH ?? s.noteEN ?? null,
      sortOrder: s.sortOrder,
    }));

    return {
      id: t.id,
      year: t.year,
      term: t.termNo, // ✅ แปลง termNo -> term ให้หน้าอ่านง่าย
      termType: t.termType,
      suggestedTotalCredits: t.suggestedTotalCredits,
      sortOrder: t.sortOrder,
      courses,
      slots,
    };
  });

  return res.json({
    track: {
      id: track.id,
      code: track.code,
      name: track.nameTH ?? track.nameEN ?? track.code,
      nameTH: track.nameTH,
      nameEN: track.nameEN,
      descriptionTH: track.descriptionTH,
      descriptionEN: track.descriptionEN,
      curriculumId: track.curriculumId,
    },
    terms,
  });
}
