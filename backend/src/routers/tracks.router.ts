/**
 * src/routers/tracks.router.ts
 * ======================================================
 * Router สำหรับ Track (แผนการเรียน)
 *
 * - GET /api/tracks
 * - GET /api/tracks/:code/plan
 */

import { Router } from "express";
import { listTracks, getTrackPlan } from "../controllers/tracks.controller";

const router = Router();

router.get("/", listTracks);
router.get("/:code/plan", getTrackPlan);

export default router;
