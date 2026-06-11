import { Lead } from "../models/lead_model.js";
import { validateLeadPayload } from "../services/lead_validation_service.js";
import { validateEmail } from "../services/email_validation_service.js";
import { validatePhone } from "../services/phone_validation_service.js";
import { validateWebsite } from "../services/website_validation_service.js";
import { calculateLeadScore } from "../services/lead_scoring_service.js";
import { generateMockAiRecommendation } from "../services/ai_recommendation_service.js";
import { successResponse } from "../utils/api_response.js";

const getDefaultCountryCode = (country) => {
  const normalizedCountry = country?.trim().toLowerCase();

  const countryMap = {
    germany: "DE",
    deutschland: "DE",
    austria: "AT",
    österreich: "AT",
    switzerland: "CH",
    schweiz: "CH",
    netherlands: "NL",
    niederlande: "NL",
  };

  return countryMap[normalizedCountry] || "DE";
};

const determineLeadStatus = ({
  emailValidation,
  phoneValidation,
  leadPriority,
}) => {
  const emailInvalid = emailValidation.status === "invalid";
  const phoneValid = phoneValidation.status === "valid";

  if (emailInvalid && !phoneValid) {
    return "validation_failed";
  }

  if (emailInvalid && phoneValid) {
    return "manual_review";
  }

  if (leadPriority === "hot") {
    return "qualified";
  }

  return "new";
};

export const createLead = async (req, res, next) => {
  try {
    const payloadValidation = validateLeadPayload(req.body);

    if (!payloadValidation.isValid) {
      const error = new Error("Lead payload validation failed");
      error.statusCode = 400;
      error.details = payloadValidation.errors;
      throw error;
    }

    const countryCode = getDefaultCountryCode(req.body.country);

    const emailValidation = await validateEmail(req.body.email);
    const phoneValidation = validatePhone(req.body.phone, countryCode);
    const websiteValidation = await validateWebsite(req.body.companyWebsite);

    const leadData = {
      firstName: req.body.firstName.trim(),
      lastName: req.body.lastName.trim(),
      email: req.body.email.trim().toLowerCase(),
      phone: req.body.phone?.trim() || null,
      companyName: req.body.companyName.trim(),
      companyWebsite: req.body.companyWebsite?.trim() || null,
      jobTitle: req.body.jobTitle?.trim() || null,
      companySize: req.body.companySize,
      industry: req.body.industry,
      country: req.body.country.trim(),
      interest: req.body.interest,
      budgetRange: req.body.budgetRange,
      message: req.body.message.trim(),
      source: req.body.source?.trim() || "Website Form",
      utmSource: req.body.utmSource?.trim() || null,
      utmCampaign: req.body.utmCampaign?.trim() || null,
    };

    const scoringResult = calculateLeadScore({
      leadData,
      emailValidation,
      phoneValidation,
      websiteValidation,
    });

    const aiRecommendation = generateMockAiRecommendation({
      leadData,
      emailValidation,
      phoneValidation,
      websiteValidation,
      scoringResult,
    });

    const status = determineLeadStatus({
      emailValidation,
      phoneValidation,
      leadPriority: scoringResult.leadPriority,
    });

    const lead = await Lead.create({
      ...leadData,
      emailValidation,
      phoneValidation,
      websiteValidation,
      dataQualityScore: scoringResult.dataQualityScore,
      leadScore: scoringResult.leadScore,
      leadPriority: scoringResult.leadPriority,
      status,
      aiRecommendation,
    });

    return successResponse({
      res,
      statusCode: 201,
      message: "Lead created successfully",
      data: {
        lead,
        scoreBreakdown: scoringResult.scoreBreakdown,
      },
    });
  } catch (error) {
    if (error.details) {
      error.message = `${error.message}: ${error.details.join(", ")}`;
    }

    next(error);
  }
};

export const getLeads = async (req, res, next) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 }).limit(100);

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
    const lead = await Lead.findById(req.params.id);

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
