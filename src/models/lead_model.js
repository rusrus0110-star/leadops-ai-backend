import mongoose from "mongoose";

const emailValidationSchema = new mongoose.Schema(
  {
    formatValid: {
      type: Boolean,
      default: false,
    },
    domain: {
      type: String,
      default: null,
    },
    hasMxRecords: {
      type: Boolean,
      default: false,
    },
    isBusinessEmail: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["valid", "invalid", "warning", "not_checked"],
      default: "not_checked",
    },
    reason: {
      type: String,
      default: null,
    },
  },
  { _id: false },
);

const phoneValidationSchema = new mongoose.Schema(
  {
    formatValid: {
      type: Boolean,
      default: false,
    },
    normalizedPhone: {
      type: String,
      default: null,
    },
    countryCode: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["valid", "invalid", "missing", "not_checked"],
      default: "not_checked",
    },
    reason: {
      type: String,
      default: null,
    },
  },
  { _id: false },
);

const websiteValidationSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      default: null,
    },
    domain: {
      type: String,
      default: null,
    },
    formatValid: {
      type: Boolean,
      default: false,
    },
    reachable: {
      type: Boolean,
      default: false,
    },
    statusCode: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      enum: ["valid", "invalid", "unreachable", "missing", "not_checked"],
      default: "not_checked",
    },
    reason: {
      type: String,
      default: null,
    },
  },
  { _id: false },
);

const aiRecommendationSchema = new mongoose.Schema(
  {
    summary: {
      type: String,
      default: null,
    },
    painPoints: {
      type: [String],
      default: [],
    },
    recommendedAction: {
      type: String,
      default: null,
    },
    suggestedContactChannel: {
      type: String,
      enum: [
        "email",
        "phone",
        "email_then_phone",
        "manual_review",
        "not_defined",
      ],
      default: "not_defined",
    },
    riskLevel: {
      type: String,
      enum: ["low", "medium", "high", "not_defined"],
      default: "not_defined",
    },
    emailDraft: {
      type: String,
      default: null,
    },
  },
  { _id: false },
);

const leadSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 160,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 160,
    },
    companyWebsite: {
      type: String,
      trim: true,
      default: null,
    },
    jobTitle: {
      type: String,
      trim: true,
      default: null,
      maxlength: 120,
    },
    companySize: {
      type: String,
      required: true,
      enum: ["1-10", "11-50", "51-200", "201-500", "501+"],
    },
    industry: {
      type: String,
      required: true,
      enum: [
        "SaaS / Software",
        "E-commerce",
        "Manufacturing",
        "Construction",
        "Consulting",
        "Healthcare",
        "Logistics",
        "Finance",
        "Other",
      ],
    },
    country: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    interest: {
      type: String,
      required: true,
      enum: [
        "CRM automation",
        "Lead management",
        "AI reporting",
        "Marketing automation",
        "Sales process optimization",
        "API integration",
        "Other",
      ],
    },
    budgetRange: {
      type: String,
      required: true,
      enum: [
        "Not sure yet",
        "Under €2,000",
        "€2,000–€5,000",
        "€5,000–€10,000",
        "€10,000–€25,000",
        "€25,000+",
      ],
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 2000,
    },
    source: {
      type: String,
      default: "Website Form",
      trim: true,
    },
    utmSource: {
      type: String,
      default: null,
      trim: true,
    },
    utmCampaign: {
      type: String,
      default: null,
      trim: true,
    },
    emailValidation: {
      type: emailValidationSchema,
      default: () => ({}),
    },
    phoneValidation: {
      type: phoneValidationSchema,
      default: () => ({}),
    },
    websiteValidation: {
      type: websiteValidationSchema,
      default: () => ({}),
    },
    dataQualityScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    leadScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    leadPriority: {
      type: String,
      enum: ["cold", "warm", "hot"],
      default: "cold",
    },
    status: {
      type: String,
      enum: [
        "new",
        "qualified",
        "manual_review",
        "validation_failed",
        "synced_to_hubspot",
        "sync_failed",
      ],
      default: "new",
    },
    aiRecommendation: {
      type: aiRecommendationSchema,
      default: () => ({}),
    },
    hubspotSyncStatus: {
      type: String,
      enum: ["not_synced", "pending", "synced", "failed"],
      default: "not_synced",
    },
    hubspotContactId: {
      type: String,
      default: null,
    },
    hubspotCompanyId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

leadSchema.index({ email: 1 });
leadSchema.index({ companyName: 1 });
leadSchema.index({ leadPriority: 1 });
leadSchema.index({ hubspotSyncStatus: 1 });
leadSchema.index({ createdAt: -1 });

export const Lead = mongoose.model("Lead", leadSchema);
