import mongoose from "mongoose";
import { Lead } from "../models/lead_model.js";
import { validateLeadPayload } from "../services/lead_validation_service.js";
import { validateEmail } from "../services/email_validation_service.js";
import { validatePhone } from "../services/phone_validation_service.js";
import { validateWebsite } from "../services/website_validation_service.js";
import { calculateLeadScore } from "../services/lead_scoring_service.js";
import { generateAiRecommendation } from "../services/ai_recommendation_service.js";
import { successResponse } from "../utils/api_response.js";

export const createLead = async (req, res, next) => {
  try {
    const payload = req.body;

    const validationResult = validateLeadPayload(payload);

    if (!validationResult.isValid) {
      const error = new Error(
        `Lead payload validation failed: ${validationResult.errors.join(", ")}`,
      );
      error.statusCode = 400;
      throw error;
    }

    const emailValidation = await validateEmail(payload.email);
    const phoneValidation = validatePhone(payload.phone, payload.country);
    const websiteValidation = await validateWebsite(payload.companyWebsite);

    const scoringResult = calculateLeadScore({
      leadData: payload,
      emailValidation,
      phoneValidation,
      websiteValidation,
    });

    const aiRecommendation = await generateAiRecommendation({
      ...payload,
      emailValidation,
      phoneValidation,
      websiteValidation,
      leadScore: scoringResult.leadScore,
      leadPriority: scoringResult.leadPriority,
      dataQualityScore: scoringResult.dataQualityScore,
    });

    const leadStatus =
      emailValidation.status === "invalid" && phoneValidation.status !== "valid"
        ? "validation_failed"
        : "new";

    const lead = await Lead.create({
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone?.trim() || "",
      companyName: payload.companyName.trim(),
      companyWebsite: payload.companyWebsite?.trim() || "",
      jobTitle: payload.jobTitle?.trim() || "",
      companySize: payload.companySize,
      industry: payload.industry,
      country: payload.country.trim(),
      interest: payload.interest,
      budgetRange: payload.budgetRange,
      message: payload.message.trim(),
      source: payload.source?.trim() || "unknown",
      utmSource: payload.utmSource?.trim() || "",
      utmCampaign: payload.utmCampaign?.trim() || "",

      emailValidation,
      phoneValidation,
      websiteValidation,

      dataQualityScore: scoringResult.dataQualityScore,
      leadScore: scoringResult.leadScore,
      leadPriority: scoringResult.leadPriority,
      scoreBreakdown: scoringResult.scoreBreakdown,

      aiRecommendation,

      status: leadStatus,
      hubspotSyncStatus: "not_synced",
    });

    return successResponse({
      res,
      statusCode: 201,
      message: "Lead created successfully",
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};

export const getLeads = async (req, res, next) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 }).select("-__v");

    return successResponse({
      res,
      message: "Leads fetched successfully",
      data: leads,
    });
  } catch (error) {
    next(error);
  }
};

export const getLeadById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error("Invalid lead ID format");
      error.statusCode = 400;
      throw error;
    }

    const lead = await Lead.findById(id).select("-__v");

    if (!lead) {
      const error = new Error("Lead not found");
      error.statusCode = 404;
      throw error;
    }

    return successResponse({
      res,
      message: "Lead fetched successfully",
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};
