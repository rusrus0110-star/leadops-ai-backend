import OpenAI from "openai";

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not defined");
  }

  return new OpenAI({ apiKey });
};

const getSafeString = (
  value,
  fallback = "Not provided",
) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  return String(value);
};

const extractJson = (content) => {
  if (!content) {
    throw new Error(
      "OpenAI returned an empty response",
    );
  }

  const cleanedContent = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleanedContent);
  } catch {
    const firstBrace =
      cleanedContent.indexOf("{");

    const lastBrace =
      cleanedContent.lastIndexOf("}");

    if (
      firstBrace === -1 ||
      lastBrace === -1
    ) {
      throw new Error(
        "OpenAI response does not contain valid JSON",
      );
    }

    return JSON.parse(
      cleanedContent.slice(
        firstBrace,
        lastBrace + 1,
      ),
    );
  }
};

const normalizePainPoints = (
  painPoints,
  leadMessage = "",
) => {
  const blockedPatterns = [
    /^interest in\b/i,
    /^potential need\b/i,
    /described in (the )?message/i,
    /^message:/i,
  ];

  const normalizedPainPoints =
    Array.isArray(painPoints)
      ? painPoints
          .filter(
            (item) =>
              typeof item === "string",
          )
          .map((item) =>
            item
              .replace(/\s+/g, " ")
              .trim(),
          )
          .filter(Boolean)
          .filter(
            (item) =>
              !blockedPatterns.some(
                (pattern) =>
                  pattern.test(item),
              ),
          )
          .filter(
            (item) =>
              item.length <= 160,
          )
          .slice(0, 2)
      : [];

  if (
    normalizedPainPoints.length === 2
  ) {
    return normalizedPainPoints;
  }

  const message = getSafeString(
    leadMessage,
    "",
  ).toLowerCase();

  const fallbackPainPoints = [];

  if (
    message.includes(
      "different channels",
    ) ||
    message.includes(
      "multiple channels",
    ) ||
    message.includes(
      "customer requests",
    )
  ) {
    fallbackPainPoints.push(
      "Customer requests from multiple channels are difficult to consolidate and prioritize.",
    );
  }

  if (
    message.includes("lead") ||
    message.includes("follow-up") ||
    message.includes("follow up") ||
    message.includes("crm")
  ) {
    fallbackPainPoints.push(
      "Manual lead qualification can delay follow-up and increase the risk of missed opportunities.",
    );
  }

  const defaults = [
    "Incoming lead data requires consistent validation before sales follow-up.",
    "Sales teams need a clear priority and next action for every new inquiry.",
  ];

  return [
    ...normalizedPainPoints,
    ...fallbackPainPoints,
    ...defaults,
  ]
    .filter(
      (item, index, items) =>
        items.indexOf(item) === index,
    )
    .slice(0, 2);
};

const normalizeRiskLevel = (
  riskLevel,
) => {
  const normalized = getSafeString(
    riskLevel,
    "medium",
  ).toLowerCase();

  if (
    normalized === "low" ||
    normalized === "medium" ||
    normalized === "high"
  ) {
    return normalized;
  }

  return "medium";
};

const normalizeContactChannel = (
  channel,
) => {
  const normalized = getSafeString(
    channel,
    "email",
  )
    .toLowerCase()
    .replaceAll(" ", "_");

  const allowedChannels = [
    "email",
    "phone",
    "linkedin",
    "video_call",
    "manual_review",
  ];

  return allowedChannels.includes(
    normalized,
  )
    ? normalized
    : "email";
};

const buildFallbackEmailDraft = ({
  firstName,
  companyName,
}) => {
  return [
    `Hi ${firstName},`,
    "",
    `Thank you for your request. LeadOps AI could help ${companyName} consolidate incoming requests, prioritize leads and improve CRM follow-up.`,
    "",
    "Would Thursday at 10:00 CET or Friday at 14:00 CET work for a 30-minute discovery call?",
    "",
    "Best regards,",
    "LeadOps AI Team",
  ].join("\n");
};

const normalizeEmailDraft = ({
  emailDraft,
  firstName,
  companyName,
}) => {
  const fallbackEmail =
    buildFallbackEmailDraft({
      firstName,
      companyName,
    });

  if (
    typeof emailDraft !== "string" ||
    !emailDraft.trim()
  ) {
    return fallbackEmail;
  }

  const normalizedLines = emailDraft
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) =>
        !/^hi\s+/i.test(line),
    )
    .filter(
      (line) =>
        !/^best regards/i.test(line),
    )
    .filter(
      (line) =>
        !/^leadops ai team$/i.test(
          line,
        ),
    )
    .filter(
      (line) =>
        !/30-minute discovery call/i.test(
          line,
        ),
    )
    .filter(
      (line) =>
        !/which time works better/i.test(
          line,
        ),
    );

  const mainText = normalizedLines
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const conciseMainText = mainText
    ? mainText.length > 260
      ? `${mainText
          .slice(0, 259)
          .trim()}…`
      : mainText
    : `Thank you for your request. LeadOps AI could help ${companyName} consolidate incoming requests, prioritize leads and improve CRM follow-up.`;

  return [
    `Hi ${firstName},`,
    "",
    conciseMainText,
    "",
    "Would Thursday at 10:00 CET or Friday at 14:00 CET work for a 30-minute discovery call?",
    "",
    "Best regards,",
    "LeadOps AI Team",
  ].join("\n");
};

const buildLeadContext = ({
  leadData,
  emailValidation,
  phoneValidation,
  websiteValidation,
}) => {
  return {
    firstName: getSafeString(
      leadData.firstName,
      "there",
    ),

    lastName: getSafeString(
      leadData.lastName,
    ),

    email: getSafeString(
      leadData.email,
    ),

    phone: getSafeString(
      leadData.phone,
    ),

    jobTitle: getSafeString(
      leadData.jobTitle,
    ),

    companyName: getSafeString(
      leadData.companyName,
      "the company",
    ),

    companyWebsite: getSafeString(
      leadData.companyWebsite,
    ),

    industry: getSafeString(
      leadData.industry,
    ),

    country: getSafeString(
      leadData.country,
    ),

    companySize: getSafeString(
      leadData.companySize,
    ),

    source: getSafeString(
      leadData.source,
    ),

    budget: getSafeString(
      leadData.budget,
    ),

    message: getSafeString(
      leadData.message,
    ),

    emailValidationStatus:
      getSafeString(
        emailValidation?.status,
        "not_checked",
      ),

    emailValidationReason:
      getSafeString(
        emailValidation?.reason ||
          emailValidation?.message,
      ),

    phoneValidationStatus:
      getSafeString(
        phoneValidation?.status,
        "not_checked",
      ),

    websiteValidationStatus:
      getSafeString(
        websiteValidation?.status,
        "not_checked",
      ),

    websiteDomain: getSafeString(
      websiteValidation?.domain,
    ),
  };
};

export const generateAiRecommendation =
  async ({
    leadData,
    emailValidation,
    phoneValidation,
    websiteValidation,
  }) => {
    if (!leadData) {
      throw new Error(
        "leadData is required for AI recommendation",
      );
    }

    const client =
      getOpenAIClient();

    const model =
      process.env.OPENAI_MODEL ||
      "gpt-4.1-mini";

    const leadContext =
      buildLeadContext({
        leadData,
        emailValidation,
        phoneValidation,
        websiteValidation,
      });

    const prompt = `
You are a B2B sales operations assistant.

Analyse the lead and return a concise, practical recommendation for a sales manager.

LEAD DATA:
${JSON.stringify(leadContext, null, 2)}

Return ONLY valid JSON with this structure:

{
  "summary": "string",
  "painPoints": ["string", "string"],
  "riskLevel": "low | medium | high",
  "recommendedAction": "string",
  "suggestedContactChannel": "email | phone | linkedin | video_call | manual_review",
  "emailDraft": "string"
}

RULES:

SUMMARY
- Maximum 2 short sentences.
- Explain the company need and likely business value.
- Do not repeat all input fields.
- Do not copy the original message verbatim.

PAIN POINTS
- Return exactly 2 concrete operational business problems.
- Each pain point must describe a negative operational consequence.
- Do not return "Interest in API integration".
- Do not return "Potential need described in message".
- Do not start with "Interest in", "Potential need", or "Message".
- Do not quote or truncate the original lead message.
- For multichannel requests, focus on consolidation, prioritization and delayed follow-up.
- Example:
  "Customer requests from multiple channels are difficult to consolidate and prioritize."
  "Manual lead qualification can delay follow-up and increase the risk of missed opportunities."

RISK LEVEL
- Use only low, medium or high.
- Consider validation results, data quality and buying intent.

RECOMMENDED ACTION
- Maximum 2 short sentences.
- Recommend a 30-minute discovery call.
- The lead should receive a response within one business day.

CONTACT CHANNEL
- Use only one allowed value.
- Prefer email when email is usable.
- Prefer phone when email is invalid and phone is valid.

EMAIL DRAFT
- Professional B2B English.
- Keep the full email short.
- Do not include a subject line.
- Do not use markdown.
- Do not invent unsupported features.
- Use this exact structure:

Hi FirstName,

One short paragraph thanking the lead and connecting the business problem to the proposed solution.

Would Thursday at 10:00 CET or Friday at 14:00 CET work for a 30-minute discovery call?

Best regards,
LeadOps AI Team

- Preserve blank lines.
- Include both proposed times.
`;

    const completion =
      await client.chat.completions.create(
        {
          model,
          temperature: 0.2,

          response_format: {
            type: "json_object",
          },

          messages: [
            {
              role: "system",
              content:
                "Return concise B2B sales recommendations as valid JSON only.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        },
      );

    const content =
      completion.choices?.[0]
        ?.message?.content;

    const parsedRecommendation =
      extractJson(content);

    const firstName =
      getSafeString(
        leadData.firstName,
        "there",
      );

    const companyName =
      getSafeString(
        leadData.companyName,
        "your company",
      );

    return {
      summary: getSafeString(
        parsedRecommendation.summary,
        "The lead requires manual review.",
      ),

      painPoints: normalizePainPoints(
        parsedRecommendation.painPoints,
        leadData.message,
      ),

      riskLevel: normalizeRiskLevel(
        parsedRecommendation.riskLevel,
      ),

      recommendedAction:
        getSafeString(
          parsedRecommendation
            .recommendedAction,
          "Contact the lead within one business day and arrange a 30-minute discovery call.",
        ),

      suggestedContactChannel:
        normalizeContactChannel(
          parsedRecommendation
            .suggestedContactChannel,
        ),

      emailDraft:
        normalizeEmailDraft({
          emailDraft:
            parsedRecommendation
              .emailDraft,

          firstName,
          companyName,
        }),

      generatedAt: new Date(),
      model,
    };
  };

