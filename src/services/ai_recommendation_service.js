export const generateMockAiRecommendation = ({
  leadData,
  emailValidation,
  phoneValidation,
  websiteValidation,
  scoringResult,
}) => {
  const companyName = leadData.companyName;
  const leadPriority = scoringResult.leadPriority;
  const leadScore = scoringResult.leadScore;

  const hasValidEmail =
    emailValidation.status === "valid" || emailValidation.status === "warning";
  const hasValidPhone = phoneValidation.status === "valid";
  const websiteReachable = websiteValidation.status === "valid";

  let riskLevel = "medium";

  if (hasValidEmail && hasValidPhone && websiteReachable) {
    riskLevel = "low";
  }

  if (!hasValidEmail && !hasValidPhone) {
    riskLevel = "high";
  }

  let suggestedContactChannel = "email_then_phone";

  if (!hasValidEmail && hasValidPhone) {
    suggestedContactChannel = "phone";
  }

  if (hasValidEmail && !hasValidPhone) {
    suggestedContactChannel = "email";
  }

  if (!hasValidEmail && !hasValidPhone) {
    suggestedContactChannel = "manual_review";
  }

  const recommendedAction =
    leadPriority === "hot"
      ? "Contact within 24 hours and offer a short discovery call focused on the stated business need."
      : leadPriority === "warm"
        ? "Add to a structured follow-up sequence and qualify the business need in more detail."
        : "Keep in long-term nurturing and request more information before sales handoff.";

  const painPoints = [
    `Interest in ${leadData.interest}`,
    `Potential need described in message: ${leadData.message.slice(0, 160)}${
      leadData.message.length > 160 ? "..." : ""
    }`,
  ];

  const summary = `${companyName} is a ${leadPriority.toUpperCase()} B2B lead with a score of ${leadScore}/100. The lead is interested in ${leadData.interest}. Data quality is ${
    scoringResult.dataQualityScore >= 70
      ? "strong"
      : scoringResult.dataQualityScore >= 40
        ? "medium"
        : "weak"
  }, based on email, phone and website validation.`;

  const emailDraft = `Hi ${leadData.firstName},

thank you for your request regarding ${leadData.interest}. Based on your message, it looks like ${companyName} may benefit from a structured approach to lead qualification, CRM automation and reporting.

I would be happy to schedule a short discovery call to better understand your current process and discuss possible next steps.

Best regards`;

  return {
    summary,
    painPoints,
    recommendedAction,
    suggestedContactChannel,
    riskLevel,
    emailDraft,
  };
};
