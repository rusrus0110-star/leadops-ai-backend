import { Router } from "express";
import { syncLeadWithHubSpot } from "../controllers/hubspot_controller.js";

const router = Router();

router.post("/leads/:id/sync", syncLeadWithHubSpot);

export default router;
