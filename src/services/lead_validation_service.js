import validator from "validator";

export const validateLeadPayload = (payload) => {
  const errors = [];

  const requiredStringFields = [
    "firstName",
    "lastName",
    "email",
    "companyName",
    "companySize",
    "industry",
    "country",
    "interest",
    "budgetRange",
    "message",
  ];

  for (const field of requiredStringFields) {
    if (
      !payload[field] ||
      typeof payload[field] !== "string" ||
      payload[field].trim().length === 0
    ) {
      errors.push(`${field} is required`);
    }
  }

  if (payload.email && !validator.isEmail(payload.email.trim())) {
    errors.push("email format is invalid");
  }

  if (payload.message && payload.message.trim().length < 10) {
    errors.push("message must be at least 10 characters long");
  }

  if (payload.message && payload.message.trim().length > 2000) {
    errors.push("message must not exceed 2000 characters");
  }

  const allowedCompanySizes = ["1-10", "11-50", "51-200", "201-500", "501+"];

  if (
    payload.companySize &&
    !allowedCompanySizes.includes(payload.companySize)
  ) {
    errors.push("companySize is invalid");
  }

  const allowedIndustries = [
    "SaaS / Software",
    "E-commerce",
    "Manufacturing",
    "Construction",
    "Consulting",
    "Healthcare",
    "Logistics",
    "Finance",
    "Other",
  ];

  if (payload.industry && !allowedIndustries.includes(payload.industry)) {
    errors.push("industry is invalid");
  }

  const allowedInterests = [
    "CRM automation",
    "Lead management",
    "AI reporting",
    "Marketing automation",
    "Sales process optimization",
    "API integration",
    "Other",
  ];

  if (payload.interest && !allowedInterests.includes(payload.interest)) {
    errors.push("interest is invalid");
  }

  const allowedBudgetRanges = [
    "Not sure yet",
    "Under €2,000",
    "€2,000–€5,000",
    "€5,000–€10,000",
    "€10,000–€25,000",
    "€25,000+",
  ];

  if (
    payload.budgetRange &&
    !allowedBudgetRanges.includes(payload.budgetRange)
  ) {
    errors.push("budgetRange is invalid");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
