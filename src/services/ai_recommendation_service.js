import OpenAI from "openai";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const getSafeString = (value, fallback = "not provided") => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
};

const getOpenAiClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
};

const buildLeadPrompt = (lead) => {
  return `
You are an AI assistant for B2B sales operations.

Analyze the following lead and return a strict JSON object only.
Do not include markdown.
Do not include explanations outside JSON.

Lead data:
- First name: ${getSafeString(lead.firstName)}
- Last name: ${getSafeString(lead.lastName)}
- Email: ${getSafeString(lead.email)}
- Phone: ${getSafeString(lead.phone)}
- Company name: ${getSafeString(lead.companyName)}
- Company website: ${getSafeString(lead.companyWebsite)}
- Job title: ${getSafeString(lead.jobTitle)}
- Company size: ${getSafeString(lead.companySize)}
- Industry: ${getSafeString(lead.industry)}
- Country: ${getSafeString(lead.country)}
- Interest: ${getSafeString(lead.interest)}
- Budget range: ${getSafeString(lead.budgetRange)}
- Message: ${getSafeString(lead.message)}
- Source: ${getSafeString(lead.source)}
- UTM source: ${getSafeString(lead.utmSource)}
- UTM campaign: ${getSafeString(lead.utmCampaign)}

Validation and scoring:
- Lead score: ${getSafeString(lead.leadScore)}
- Lead priority: ${getSafeString(lead.leadPriority)}
- Data quality score: ${getSafeString(lead.dataQualityScore)}
- Email validation status: ${getSafeString(lead.emailValidation?.status)}
- Email validation reason: ${getSafeString(lead.emailValidation?.reason)}
- Phone validation status: ${getSafeString(lead.phoneValidation?.status)}
- Website validation status: ${getSafeString(lead.websiteValidation?.status)}

Return exactly this JSON structure:
{
  "summary": "short business summary of the lead",
  "painPoints": ["pain point 1", "pain point 2"],
  "recommendedAction": "clear next action for sales",
  "suggestedContactChannel": "email | phone | email_then_phone | manual_review",
  "riskLevel": "low | medium | high",
  "emailDraft": "short professional first outreach email"
}

Rules:
- suggestedContactChannel must be one of: email, phone, email_then_phone, manual_review.
- riskLevel must be one of: low, medium, high.
- painPoints must contain 1 to 4 items.
- emailDraft must be concise and business-like.
- If email validation is warning or invalid, prefer phone or email_then_phone.
- If data quality is low, mention manual review risk.
`;
};

const parseJsonResponse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("OpenAI response did not contain valid JSON");
    }

    return JSON.parse(jsonMatch[0]);
  }
};

const validateAiRecommendation = (recommendation) => {
  const allowedChannels = [
    "email",
    "phone",
    "email_then_phone",
    "manual_review",
  ];
  const allowedRiskLevels = ["low", "medium", "high"];

  return {
    summary: getSafeString(recommendation.summary, "No AI summary generated."),
    painPoints: Array.isArray(recommendation.painPoints)
      ? recommendation.painPoints.slice(0, 4).map(String)
      : ["No clear pain points detected."],
    recommendedAction: getSafeString(
      recommendation.recommendedAction,
      "Review the lead manually and decide the next sales action.",
    ),
    suggestedContactChannel: allowedChannels.includes(
      recommendation.suggestedContactChannel,
    )
      ? recommendation.suggestedContactChannel
      : "manual_review",
    riskLevel: allowedRiskLevels.includes(recommendation.riskLevel)
      ? recommendation.riskLevel
      : "medium",
    emailDraft: getSafeString(
      recommendation.emailDraft,
      "Hello, thank you for your interest. I would be happy to discuss your current process and possible next steps.",
    ),
  };
};

const generateFallbackRecommendation = (lead) => {
  return {
    summary: `${lead.companyName} is a B2B lead interested in ${lead.interest}.`,
    painPoints: [
      `Interest in ${lead.interest}`,
      "Potential need for better lead qualification and CRM workflow",
    ],
    recommendedAction:
      "Contact the lead within 24 hours and offer a short discovery call.",
    suggestedContactChannel: "email_then_phone",
    riskLevel: "medium",
    emailDraft: `Hi ${lead.firstName}, thank you for your request. Based on your message, it looks like ${lead.companyName} may benefit from a structured approach to lead qualification and CRM automation. I would be happy to schedule a short discovery call to better understand your current process and discuss possible next steps.`,
  };
};

export const generateAiRecommendation = async (lead) => {
  const openai = getOpenAiClient();

  if (!openai) {
    console.warn(
      "OPENAI_API_KEY is not defined. Falling back to mock AI recommendation.",
    );

    return generateFallbackRecommendation(lead);
  }

  const prompt = buildLeadPrompt(lead);

  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: prompt,
    temperature: 0.2,
    max_output_tokens: 900,
  });

  const outputText = response.output_text;

  if (!outputText) {
    throw new Error("OpenAI response is empty");
  }

  const parsedRecommendation = parseJsonResponse(outputText);

  return validateAiRecommendation(parsedRecommendation);
};
