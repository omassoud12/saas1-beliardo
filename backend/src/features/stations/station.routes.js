import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireApprovedOwner, requireHomeAccess } from "../../middleware/accessGuards.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { listStations, syncStations } from "./station.controller.js";
import { validateStationSync } from "./station.validation.js";

const router = Router();
router.use(authenticate);
router.get("/", requireHomeAccess, listStations);
router.put("/", requireApprovedOwner, validateRequest(validateStationSync), syncStations);

export default router;
