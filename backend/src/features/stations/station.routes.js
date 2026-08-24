import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { listStations, syncStations } from "./station.controller.js";
import { validateStationSync } from "./station.validation.js";

const router = Router();
router.use(authenticate);
router.get("/", listStations);
router.put("/", validateRequest(validateStationSync), syncStations);

export default router;
