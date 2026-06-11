import { Router } from "express";
import {
  createLead,
  getLeadById,
  getLeads,
} from "../controllers/lead_controller.js";

const router = Router();

router.post("/", createLead);
router.get("/", getLeads);
router.get("/:id", getLeadById);

export default router;
