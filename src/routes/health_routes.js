import { Router } from "express";
import { successResponse } from "../utils/api_response.js";

const router = Router();

router.get("/", (req, res) => {
  return successResponse({
    res,
    message: "LeadOps AI API is healthy",
    data: {
      service: "LeadOps AI API",
      status: "ok",
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
