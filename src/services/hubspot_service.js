const HUBSPOT_BASE_URL =
  process.env.HUBSPOT_BASE_URL || "https://api.hubapi.com";

const getHubSpotToken = () => {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;

  if (!token) {
    throw new Error("HUBSPOT_PRIVATE_APP_TOKEN is not defined");
  }

  return token;
};

const hubspotRequest = async ({ endpoint, method = "GET", body }) => {
  const token = getHubSpotToken();

  const url = `${HUBSPOT_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      method,

      headers: {
        Authorization: `Bearer ${token}`,

        "Content-Type": "application/json",
      },

      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const responseData = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        responseData?.message ||
        responseData?.error ||
        `HubSpot request failed with status ${response.status}`;

      const error = new Error(message);

      error.statusCode = response.status;

      error.hubspotResponse = responseData;

      throw error;
    }

    return responseData;
  } catch (error) {
    console.error("HubSpot request failed:", {
      url,
      method,
      message: error.message,
      cause: error.cause,
      hubspotResponse: error.hubspotResponse,
    });

    throw error;
  }
};

const getSafeString = (value, fallback = "") => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
};

const escapeHtml = (value) => {
  return getSafeString(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

const normalizeText = (value) => {
  return getSafeString(value).replace(/\s+/g, " ").trim();
};

const shortenText = (value, maxLength = 180) => {
  const normalized = normalizeText(value);

  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trim()}…`;
};

const extractDomainFromUrl = (url) => {
  try {
    if (!url) {
      return "";
    }

    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const normalizeEmailDraft = (emailDraft, firstName, companyName) => {
  const rawEmail = getSafeString(emailDraft)
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .trim();

  const rawLines = rawEmail
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^hi\s+/i.test(line))
    .filter((line) => !/^best regards/i.test(line))
    .filter((line) => !/^leadops ai team$/i.test(line))
    .filter((line) => !/30-minute discovery call/i.test(line))
    .filter((line) => !/which time works better/i.test(line));

  const rawMainText = rawLines.join(" ").replace(/\s+/g, " ").trim();

  const fallbackMainText =
    `Thank you for your request. ` +
    `LeadOps AI could help ${companyName} ` +
    `consolidate incoming requests, ` +
    `prioritize leads and improve CRM follow-up.`;

  const mainText = rawMainText || fallbackMainText;

  const conciseMainText =
    mainText.length > 260 ? `${mainText.slice(0, 259).trim()}…` : mainText;

  return {
    greeting: `Hi ${firstName},`,

    mainText: conciseMainText,

    callToAction:
      "Would Thursday at 10:00 CET or Friday at 14:00 CET work for a 30-minute discovery call?",

    signOff: "Best regards,",

    signature: "LeadOps AI Team",
  };
};

const buildEmailDraftHtml = ({ emailDraft, firstName, companyName }) => {
  const email = normalizeEmailDraft(emailDraft, firstName, companyName);

  return [
    escapeHtml(email.greeting),
    "<br><br>",

    escapeHtml(email.mainText),
    "<br><br>",

    escapeHtml(email.callToAction),
    "<br><br>",

    escapeHtml(email.signOff),
    "<br>",

    escapeHtml(email.signature),
  ].join("");
};

const searchContactByEmail = async (email) => {
  const result = await hubspotRequest({
    endpoint: "/crm/v3/objects/contacts/search",

    method: "POST",

    body: {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "email",

              operator: "EQ",

              value: email,
            },
          ],
        },
      ],

      properties: ["email", "firstname", "lastname", "phone", "company"],

      limit: 1,
    },
  });

  return result?.results?.[0] || null;
};

const searchCompanyByDomain = async (domain) => {
  if (!domain) {
    return null;
  }

  const result = await hubspotRequest({
    endpoint: "/crm/v3/objects/companies/search",

    method: "POST",

    body: {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "domain",

              operator: "EQ",

              value: domain,
            },
          ],
        },
      ],

      properties: ["name", "domain", "website"],

      limit: 1,
    },
  });

  return result?.results?.[0] || null;
};

const getPriorityConfig = (priority) => {
  const normalized = getSafeString(priority, "cold").toLowerCase();

  if (normalized === "hot") {
    return {
      label: "HOT LEAD",
      icon: "🔥",
    };
  }

  if (normalized === "warm") {
    return {
      label: "WARM LEAD",
      icon: "🟠",
    };
  }

  return {
    label: "COLD LEAD",
    icon: "🔵",
  };
};

const getRiskConfig = (riskLevel) => {
  const normalized = getSafeString(riskLevel, "medium").toLowerCase();

  if (normalized === "low") {
    return {
      label: "LOW RISK",
      icon: "🟢",
    };
  }

  if (normalized === "high") {
    return {
      label: "HIGH RISK",
      icon: "🔴",
    };
  }

  return {
    label: "MEDIUM RISK",
    icon: "🟠",
  };
};

const getValidationConfig = (status) => {
  const normalized = getSafeString(status, "not_checked").toLowerCase();

  if (normalized === "valid") {
    return {
      label: "VALID",
      icon: "🟢",
    };
  }

  if (normalized === "warning") {
    return {
      label: "WARNING",
      icon: "⚠️",
    };
  }

  if (normalized === "invalid") {
    return {
      label: "INVALID",
      icon: "🔴",
    };
  }

  return {
    label: "NOT CHECKED",
    icon: "⚪",
  };
};

const buildContactValidationText = (lead) => {
  const email = getValidationConfig(lead.emailValidation?.status);

  const phone = getValidationConfig(lead.phoneValidation?.status);

  const website = getValidationConfig(lead.websiteValidation?.status);

  return [
    `${email.icon} Email: ${email.label}`,
    `${phone.icon} Phone: ${phone.label}`,
    `${website.icon} Website: ${website.label}`,
  ].join("\n");
};

const buildCompactAiRecommendation = (lead) => {
  const recommendation = lead.aiRecommendation || {};

  const summary = shortenText(recommendation.summary, 180);

  const action = shortenText(recommendation.recommendedAction, 140);

  return [
    summary || "No AI summary generated.",

    action ? `Next action: ${action}` : "",
  ]
    .filter(Boolean)
    .join("\n");
};

const buildContactProperties = (lead) => {
  const recommendation = lead.aiRecommendation || {};

  const priority = getPriorityConfig(lead.leadPriority);

  const risk = getRiskConfig(recommendation.riskLevel);

  return {
    email: getSafeString(lead.email),

    firstname: getSafeString(lead.firstName),

    lastname: getSafeString(lead.lastName),

    phone: getSafeString(lead.phoneValidation?.normalizedPhone || lead.phone),

    jobtitle: getSafeString(lead.jobTitle),

    company: getSafeString(lead.companyName),

    leadops_lead_score: getSafeString(lead.leadScore, "0"),

    leadops_lead_priority: `${priority.icon} ${priority.label}`,

    leadops_data_quality_score: getSafeString(lead.dataQualityScore, "0"),

    leadops_risk_level: `${risk.icon} ${risk.label}`,

    leadops_contact_validation: buildContactValidationText(lead),

    leadops_recommended_action: shortenText(
      recommendation.recommendedAction,
      140,
    ),

    leadops_ai_recommendation: buildCompactAiRecommendation(lead),
  };
};

const buildCompanyProperties = (lead) => {
  const websiteUrl = lead.websiteValidation?.url || lead.companyWebsite || "";

  const domain =
    lead.websiteValidation?.domain || extractDomainFromUrl(websiteUrl) || "";

  return {
    name: getSafeString(lead.companyName),

    domain,
    website: websiteUrl,
  };
};

const buildPainPointsHtml = (painPoints, leadMessage) => {
  const blockedPatterns = [
    /^interest in\b/i,
    /^potential need\b/i,
    /described in (the )?message/i,
    /^message:/i,
  ];

  const normalizedPainPoints = Array.isArray(painPoints)
    ? painPoints
        .filter((item) => typeof item === "string")
        .map((item) => normalizeText(item))
        .filter(Boolean)
        .filter(
          (item) => !blockedPatterns.some((pattern) => pattern.test(item)),
        )
        .slice(0, 2)
    : [];

  const message = getSafeString(leadMessage, "").toLowerCase();

  const fallbackPainPoints = [];

  if (
    message.includes("different channels") ||
    message.includes("multiple channels") ||
    message.includes("customer requests")
  ) {
    fallbackPainPoints.push(
      "Customer requests from multiple channels are difficult to consolidate and prioritize.",
    );
  }

  if (
    message.includes("lead") ||
    message.includes("crm") ||
    message.includes("follow-up") ||
    message.includes("follow up")
  ) {
    fallbackPainPoints.push(
      "Manual lead qualification can delay follow-up and increase the risk of missed opportunities.",
    );
  }

  const defaults = [
    "Incoming lead data requires consistent validation before sales follow-up.",
    "Sales teams need a clear priority and next action for every new inquiry.",
  ];

  const finalPainPoints = [
    ...normalizedPainPoints,
    ...fallbackPainPoints,
    ...defaults,
  ]
    .filter((item, index, items) => items.indexOf(item) === index)
    .slice(0, 2);

  return finalPainPoints
    .map((item) => `<li>${escapeHtml(shortenText(item, 130))}</li>`)
    .join("");
};

const buildLeadOpsNoteHtml = (lead) => {
  const recommendation = lead.aiRecommendation || {};

  const priority = getPriorityConfig(lead.leadPriority);

  const risk = getRiskConfig(recommendation.riskLevel);

  const emailStatus = getValidationConfig(lead.emailValidation?.status);

  const phoneStatus = getValidationConfig(lead.phoneValidation?.status);

  const websiteStatus = getValidationConfig(lead.websiteValidation?.status);

  const fullName = [lead.firstName, lead.lastName]
    .map((value) => getSafeString(value))
    .filter(Boolean)
    .join(" ");

  const roleAndCompany = [lead.jobTitle, lead.companyName]
    .map((value) => getSafeString(value))
    .filter(Boolean)
    .join(" at ");

  const industryAndCountry = [lead.industry, lead.country]
    .map((value) => getSafeString(value))
    .filter(Boolean)
    .join(" · ");

  const emailReason = shortenText(
    lead.emailValidation?.reason || lead.emailValidation?.message,
    70,
  );

  const emailDetails = emailReason ? ` (${escapeHtml(emailReason)})` : "";

  const summary = shortenText(recommendation.summary, 240);

  const nextAction = shortenText(recommendation.recommendedAction, 180);

  const suggestedChannel = getSafeString(
    recommendation.suggestedContactChannel,
    "manual review",
  )
    .replaceAll("_", " ")
    .toUpperCase();

  const emailDraftHtml = buildEmailDraftHtml({
    emailDraft: recommendation.emailDraft,

    firstName: getSafeString(lead.firstName, "there"),

    companyName: getSafeString(lead.companyName, "your company"),
  });

  return `
    <h3>LeadOps AI Sales Brief</h3>
    <b>${escapeHtml(fullName)}</b><br>
    ${escapeHtml(roleAndCompany)}<br>
    ${escapeHtml(industryAndCountry)}
    <br><br>

    <hr>

    ${priority.icon}
    <b>Priority:</b>
    ${escapeHtml(priority.label)}
    (${escapeHtml(getSafeString(lead.leadScore, "0"))}/100)<br>

    ${risk.icon}
    <b>Risk:</b>
    ${escapeHtml(risk.label)}
    ·
    <b>Quality:</b>
    ${escapeHtml(getSafeString(lead.dataQualityScore, "0"))}/100
    <br><br>

    <b>Validation</b><br>

    ${emailStatus.icon}
    <b>Email:</b>
    ${escapeHtml(emailStatus.label)}${emailDetails}<br>

    ${phoneStatus.icon}
    <b>Phone:</b>
    ${escapeHtml(phoneStatus.label)}<br>

    ${websiteStatus.icon}
    <b>Website:</b>
    ${escapeHtml(websiteStatus.label)}
    <br><br>

    <hr>

    <h4>🧠 AI Summary</h4>

    ${escapeHtml(summary || "No AI summary generated.")}
    <br><br>

    <b>Pain points</b>

    <ul>
      ${buildPainPointsHtml(recommendation.painPoints, lead.message)}
    </ul>

    <b>Next action:</b>

    ${escapeHtml(
      nextAction ||
        "Contact the lead within one business day and arrange a 30-minute discovery call.",
    )}<br>

    <b>Channel:</b>
    ${escapeHtml(suggestedChannel)}
    <br><br>

    <hr>

    <h4>
      ✉️ Suggested Outreach Email
    </h4>

    <blockquote>
      ${emailDraftHtml}
    </blockquote>
  `;
};

export const createOrUpdateHubSpotContact = async (lead) => {
  const existingContact = await searchContactByEmail(lead.email);

  const properties = buildContactProperties(lead);

  if (existingContact) {
    const updatedContact = await hubspotRequest({
      endpoint: `/crm/v3/objects/contacts/` + `${existingContact.id}`,

      method: "PATCH",

      body: {
        properties,
      },
    });

    return {
      id: updatedContact.id,
      operation: "updated",
    };
  }

  const createdContact = await hubspotRequest({
    endpoint: "/crm/v3/objects/contacts",

    method: "POST",

    body: {
      properties,
    },
  });

  return {
    id: createdContact.id,
    operation: "created",
  };
};

export const createOrUpdateHubSpotCompany = async (lead) => {
  const websiteUrl = lead.websiteValidation?.url || lead.companyWebsite || "";

  const domain =
    lead.websiteValidation?.domain || extractDomainFromUrl(websiteUrl);

  const existingCompany = await searchCompanyByDomain(domain);

  const properties = buildCompanyProperties(lead);

  if (existingCompany) {
    const updatedCompany = await hubspotRequest({
      endpoint: `/crm/v3/objects/companies/` + `${existingCompany.id}`,

      method: "PATCH",

      body: {
        properties,
      },
    });

    return {
      id: updatedCompany.id,
      operation: "updated",
    };
  }

  const createdCompany = await hubspotRequest({
    endpoint: "/crm/v3/objects/companies",

    method: "POST",

    body: {
      properties,
    },
  });

  return {
    id: createdCompany.id,
    operation: "created",
  };
};

export const associateContactWithCompany = async ({ contactId, companyId }) => {
  if (!contactId || !companyId) {
    throw new Error("contactId and companyId are required");
  }

  return hubspotRequest({
    endpoint:
      `/crm/v3/objects/contacts/` +
      `${contactId}` +
      `/associations/companies/` +
      `${companyId}` +
      `/contact_to_company`,

    method: "PUT",
  });
};

export const createLeadOpsAiNote = async ({ lead, contactId }) => {
  if (!lead) {
    throw new Error("Lead is required to create AI note");
  }

  if (!contactId) {
    throw new Error("HubSpot contact ID is required");
  }

  return hubspotRequest({
    endpoint: "/crm/v3/objects/notes",

    method: "POST",

    body: {
      properties: {
        hs_note_body: buildLeadOpsNoteHtml(lead),

        hs_timestamp: new Date().toISOString(),
      },

      associations: [
        {
          to: {
            id: contactId,
          },

          types: [
            {
              associationCategory: "HUBSPOT_DEFINED",

              associationTypeId: 202,
            },
          ],
        },
      ],
    },
  });
};

export const createTestHubSpotNote = async (contactId) => {
  if (!contactId) {
    throw new Error("HubSpot contact ID is required");
  }

  return hubspotRequest({
    endpoint: "/crm/v3/objects/notes",

    method: "POST",

    body: {
      properties: {
        hs_note_body:
          "<h3>LeadOps AI Test</h3>" + "<hr>" + "HubSpot Notes API is working.",

        hs_timestamp: new Date().toISOString(),
      },

      associations: [
        {
          to: {
            id: contactId,
          },

          types: [
            {
              associationCategory: "HUBSPOT_DEFINED",

              associationTypeId: 202,
            },
          ],
        },
      ],
    },
  });
};

export const syncLeadToHubSpot = async (lead) => {
  const contactResult = await createOrUpdateHubSpotContact(lead);

  const companyResult = await createOrUpdateHubSpotCompany(lead);

  await associateContactWithCompany({
    contactId: contactResult.id,

    companyId: companyResult.id,
  });

  const noteResult = await createLeadOpsAiNote({
    lead,

    contactId: contactResult.id,
  });

  return {
    contactId: contactResult.id,

    contactOperation: contactResult.operation,

    companyId: companyResult.id,

    companyOperation: companyResult.operation,

    noteId: noteResult.id,

    noteOperation: "created",
  };
};
