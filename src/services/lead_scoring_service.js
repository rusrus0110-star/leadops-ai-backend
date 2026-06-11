const companySizeScores = {
  "1-10": 5,
  "11-50": 10,
  "51-200": 20,
  "201-500": 25,
  "501+": 30,
};

const budgetScores = {
  not_sure: 0,
  under_2000: 5,
  "2000-5000": 10,
  "5000-10000": 20,
  "10000-25000": 30,
  "25000_plus": 40,
};

const strategicInterestScores = {
  "CRM automation": 20,
  "Lead management": 20,
  "AI reporting": 20,
  "Marketing automation": 15,
  "Sales process optimization": 15,
  "API integration": 20,
  Other: 5,
};

const sourceScores = {
  LinkedIn: 10,
  "LinkedIn Ads": 10,
  "Website Form": 5,
  "Google Ads": 8,
  Referral: 12,
  "Email Campaign": 6,
  "Trade Fair": 10,
};

const calculateDataQualityScore = ({
  emailValidation,
  phoneValidation,
  websiteValidation,
}) => {
  let score = 0;

  if (emailValidation?.formatValid) {
    score += 10;
  }

  if (emailValidation?.hasMxRecords) {
    score += 15;
  }

  if (emailValidation?.isBusinessEmail) {
    score += 20;
  }

  if (phoneValidation?.status === "valid") {
    score += 20;
  }

  if (websiteValidation?.formatValid) {
    score += 10;
  }

  if (websiteValidation?.reachable) {
    score += 15;
  }

  return Math.min(score, 100);
};

export const calculateLeadScore = ({
  leadData,
  emailValidation,
  phoneValidation,
  websiteValidation,
}) => {
  const scoreBreakdown = [];

  let score = 0;

  const dataQualityScore = calculateDataQualityScore({
    emailValidation,
    phoneValidation,
    websiteValidation,
  });

  const dataQualityContribution = Math.round(dataQualityScore * 0.25);

  score += dataQualityContribution;

  scoreBreakdown.push({
    category: "Data quality",
    value: dataQualityContribution,
    reason: `Data quality score is ${dataQualityScore}/100`,
  });

  const companySizeScore = companySizeScores[leadData.companySize] || 0;

  score += companySizeScore;

  scoreBreakdown.push({
    category: "Company size",
    value: companySizeScore,
    reason: `Company size: ${leadData.companySize}`,
  });

  const budgetScore = budgetScores[leadData.budgetRange] || 0;

  score += budgetScore;

  scoreBreakdown.push({
    category: "Budget",
    value: budgetScore,
    reason: `Budget range: ${leadData.budgetRange}`,
  });

  const interestScore = strategicInterestScores[leadData.interest] || 0;

  score += interestScore;

  scoreBreakdown.push({
    category: "Business interest",
    value: interestScore,
    reason: `Interest: ${leadData.interest}`,
  });

  const sourceScore = sourceScores[leadData.source] || 0;

  score += sourceScore;

  scoreBreakdown.push({
    category: "Lead source",
    value: sourceScore,
    reason: `Source: ${leadData.source || "not specified"}`,
  });

  if (leadData.message && leadData.message.trim().length >= 120) {
    score += 10;

    scoreBreakdown.push({
      category: "Message detail",
      value: 10,
      reason: "Message contains detailed business context",
    });
  }

  if (
    emailValidation?.status === "invalid" &&
    phoneValidation?.status !== "valid"
  ) {
    score -= 25;

    scoreBreakdown.push({
      category: "Contact risk",
      value: -25,
      reason: "Invalid email and no valid phone fallback",
    });
  }

  const finalScore = Math.max(0, Math.min(100, score));

  let leadPriority = "cold";

  if (finalScore >= 70) {
    leadPriority = "hot";
  } else if (finalScore >= 40) {
    leadPriority = "warm";
  }

  return {
    dataQualityScore,
    leadScore: finalScore,
    leadPriority,
    scoreBreakdown,
  };
};
