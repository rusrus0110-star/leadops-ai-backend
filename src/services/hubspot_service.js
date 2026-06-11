const HUBSPOT_BASE_URL =
  process.env.HUBSPOT_BASE_URL || "https://api.hubapi.com";

const getHubSpotToken = () => {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;

  if (!token) {
    throw new Error("HUBSPOT_PRIVATE_APP_TOKEN is not defined");
  }

  return token;
};

const hubspotRequest = async ({ endpoint, method = "GET", body = null }) => {
  const token = getHubSpotToken();
  const url = `${HUBSPOT_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : null,
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

const searchContactByEmail = async (email) => {
  const body = {
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
  };

  const result = await hubspotRequest({
    endpoint: "/crm/v3/objects/contacts/search",
    method: "POST",
    body,
  });

  return result?.results?.[0] || null;
};

const searchCompanyByDomain = async (domain) => {
  if (!domain) {
    return null;
  }

  const body = {
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
  };

  const result = await hubspotRequest({
    endpoint: "/crm/v3/objects/companies/search",
    method: "POST",
    body,
  });

  return result?.results?.[0] || null;
};

const getSafeString = (value, fallback = "not_available") => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
};

const buildAiRecommendationText = (lead) => {
  const recommendation = lead.aiRecommendation || {};

  const painPoints = Array.isArray(recommendation.painPoints)
    ? recommendation.painPoints.join("; ")
    : "";

  return [
    `Lead priority: ${getSafeString(lead.leadPriority)}`,
    `Lead score: ${getSafeString(lead.leadScore)}/100`,
    `Data quality score: ${getSafeString(lead.dataQualityScore)}/100`,
    `Email validation: ${getSafeString(lead.emailValidation?.status, "not_checked")}`,
    `Phone validation: ${getSafeString(lead.phoneValidation?.status, "not_checked")}`,
    `Website validation: ${getSafeString(lead.websiteValidation?.status, "not_checked")}`,
    `Risk level: ${getSafeString(recommendation.riskLevel)}`,
    `Suggested contact channel: ${getSafeString(recommendation.suggestedContactChannel)}`,
    `Recommended action: ${getSafeString(recommendation.recommendedAction, "Not generated")}`,
    `Summary: ${getSafeString(recommendation.summary, "No summary generated")}`,
    `Pain points: ${painPoints || "No pain points detected"}`,
    `Suggested email draft: ${getSafeString(recommendation.emailDraft, "No email draft generated")}`,
  ].join("\n");
};

const buildContactProperties = (lead) => {
  const aiRecommendationText = buildAiRecommendationText(lead);

  const properties = {
    email: getSafeString(lead.email),
    firstname: getSafeString(lead.firstName),
    lastname: getSafeString(lead.lastName),
    phone: getSafeString(
      lead.phoneValidation?.normalizedPhone || lead.phone,
      "",
    ),
    jobtitle: getSafeString(lead.jobTitle, ""),
    company: getSafeString(lead.companyName, ""),

    leadops_lead_score: getSafeString(lead.leadScore, "0"),
    leadops_lead_priority: getSafeString(lead.leadPriority, "not_defined"),
    leadops_data_quality_score: getSafeString(lead.dataQualityScore, "0"),
    leadops_email_validation_status: getSafeString(
      lead.emailValidation?.status,
      "not_checked",
    ),
    leadops_phone_validation_status: getSafeString(
      lead.phoneValidation?.status,
      "not_checked",
    ),
    leadops_website_validation_status: getSafeString(
      lead.websiteValidation?.status,
      "not_checked",
    ),
    leadops_ai_recommendation: aiRecommendationText,
  };

  console.log("Lead values before HubSpot sync:", {
    leadId: lead._id,
    email: lead.email,
    leadScore: lead.leadScore,
    leadPriority: lead.leadPriority,
    dataQualityScore: lead.dataQualityScore,
    emailValidationStatus: lead.emailValidation?.status,
    phoneValidationStatus: lead.phoneValidation?.status,
    websiteValidationStatus: lead.websiteValidation?.status,
    aiRecommendation: lead.aiRecommendation,
  });

  console.log("HubSpot contact properties payload:", properties);

  return properties;
};

const buildCompanyProperties = (lead) => {
  const websiteUrl = lead.websiteValidation?.url || lead.companyWebsite || "";
  const domain = lead.websiteValidation?.domain || "";

  return {
    name: getSafeString(lead.companyName),
    domain: getSafeString(domain, ""),
    website: getSafeString(websiteUrl, ""),
  };
};

export const createOrUpdateHubSpotContact = async (lead) => {
  const existingContact = await searchContactByEmail(lead.email);
  const properties = buildContactProperties(lead);

  if (existingContact) {
    const updatedContact = await hubspotRequest({
      endpoint: `/crm/v3/objects/contacts/${existingContact.id}`,
      method: "PATCH",
      body: { properties },
    });

    return {
      id: updatedContact.id,
      operation: "updated",
    };
  }

  const createdContact = await hubspotRequest({
    endpoint: "/crm/v3/objects/contacts",
    method: "POST",
    body: { properties },
  });

  return {
    id: createdContact.id,
    operation: "created",
  };
};

export const createOrUpdateHubSpotCompany = async (lead) => {
  const domain = lead.websiteValidation?.domain;

  const existingCompany = await searchCompanyByDomain(domain);
  const properties = buildCompanyProperties(lead);

  if (existingCompany) {
    const updatedCompany = await hubspotRequest({
      endpoint: `/crm/v3/objects/companies/${existingCompany.id}`,
      method: "PATCH",
      body: { properties },
    });

    return {
      id: updatedCompany.id,
      operation: "updated",
    };
  }

  const createdCompany = await hubspotRequest({
    endpoint: "/crm/v3/objects/companies",
    method: "POST",
    body: { properties },
  });

  return {
    id: createdCompany.id,
    operation: "created",
  };
};

export const associateContactWithCompany = async ({ contactId, companyId }) => {
  if (!contactId || !companyId) {
    throw new Error(
      "contactId and companyId are required for HubSpot association",
    );
  }

  return hubspotRequest({
    endpoint: `/crm/v3/objects/contacts/${contactId}/associations/companies/${companyId}/contact_to_company`,
    method: "PUT",
  });
};

export const syncLeadToHubSpot = async (lead) => {
  const contactResult = await createOrUpdateHubSpotContact(lead);
  const companyResult = await createOrUpdateHubSpotCompany(lead);

  await associateContactWithCompany({
    contactId: contactResult.id,
    companyId: companyResult.id,
  });

  return {
    contactId: contactResult.id,
    contactOperation: contactResult.operation,
    companyId: companyResult.id,
    companyOperation: companyResult.operation,
  };
};
