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

  const response = await fetch(`${HUBSPOT_BASE_URL}${endpoint}`, {
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
    properties: ["name", "domain", "website", "industry"],
    limit: 1,
  };

  const result = await hubspotRequest({
    endpoint: "/crm/v3/objects/companies/search",
    method: "POST",
    body,
  });

  return result?.results?.[0] || null;
};

const buildAiRecommendationText = (lead) => {
  const recommendation = lead.aiRecommendation || {};

  const painPoints = Array.isArray(recommendation.painPoints)
    ? recommendation.painPoints.join("; ")
    : "";

  return [
    `Lead priority: ${lead.leadPriority}`,
    `Lead score: ${lead.leadScore}/100`,
    `Data quality score: ${lead.dataQualityScore}/100`,
    `Email validation: ${lead.emailValidation?.status || "not_checked"}`,
    `Phone validation: ${lead.phoneValidation?.status || "not_checked"}`,
    `Website validation: ${lead.websiteValidation?.status || "not_checked"}`,
    `Risk level: ${recommendation.riskLevel || "not_defined"}`,
    `Suggested contact channel: ${recommendation.suggestedContactChannel || "not_defined"}`,
    `Recommended action: ${recommendation.recommendedAction || "Not generated"}`,
    `Summary: ${recommendation.summary || "No summary generated"}`,
    `Pain points: ${painPoints || "No pain points detected"}`,
    `Suggested email draft: ${recommendation.emailDraft || "No email draft generated"}`,
  ].join("\n");
};

const mapIndustryToHubSpotIndustry = (industry) => {
  const industryMap = {
    "SaaS / Software": "COMPUTER_SOFTWARE",
    "E-commerce": "INTERNET",
    Manufacturing: "INDUSTRIAL_AUTOMATION",
    Construction: "CONSTRUCTION",
    Consulting: "MANAGEMENT_CONSULTING",
    Healthcare: "HOSPITAL_HEALTH_CARE",
    Logistics: "LOGISTICS_AND_SUPPLY_CHAIN",
    Finance: "FINANCIAL_SERVICES",
    Other: "",
  };

  return industryMap[industry] || "";
};

const buildContactProperties = (lead) => {
  return {
    email: lead.email,
    firstname: lead.firstName,
    lastname: lead.lastName,
    phone: lead.phoneValidation?.normalizedPhone || lead.phone || "",
    jobtitle: lead.jobTitle || "",
    company: lead.companyName,
  };
};

const buildCompanyProperties = (lead) => {
  const websiteUrl = lead.websiteValidation?.url || lead.companyWebsite || "";
  const domain = lead.websiteValidation?.domain || "";
  const hubspotIndustry = mapIndustryToHubSpotIndustry(lead.industry);

  const properties = {
    name: lead.companyName,
    domain,
    website: websiteUrl,
  };

  if (hubspotIndustry) {
    properties.industry = hubspotIndustry;
  }

  return properties;
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
    aiRecommendationPreview: buildAiRecommendationText(lead),
  };
};
