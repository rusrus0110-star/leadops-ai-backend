import { Router } from "express";
import { syncLeadWithHubSpot } from "../controllers/hubspot_controller.js";
import { createTestNote } from "../controllers/hubspot_note_controller.js";

const router = Router();

router.post("/leads/:id/sync", syncLeadWithHubSpot);

router.post("/contacts/:contactId/test-note", createTestNote);

export default router;
