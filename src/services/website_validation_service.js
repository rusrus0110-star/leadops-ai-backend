import dns from "node:dns/promises";

const normalizeWebsiteUrl = (website) => {
  if (!website || typeof website !== "string") {
    return null;
  }

  const trimmedWebsite = website.trim();

  if (trimmedWebsite.length === 0) {
    return null;
  }

  if (
    trimmedWebsite.startsWith("http://") ||
    trimmedWebsite.startsWith("https://")
  ) {
    return trimmedWebsite;
  }

  return `https://${trimmedWebsite}`;
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 5000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    return response;
  } finally {
    clearTimeout(timeout);
  }
};

export const validateWebsite = async (website) => {
  const normalizedUrl = normalizeWebsiteUrl(website);

  if (!normalizedUrl) {
    return {
      url: null,
      domain: null,
      formatValid: false,
      reachable: false,
      statusCode: null,
      status: "missing",
      reason: "Website is missing",
    };
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(normalizedUrl);
  } catch (error) {
    return {
      url: normalizedUrl,
      domain: null,
      formatValid: false,
      reachable: false,
      statusCode: null,
      status: "invalid",
      reason: "Website URL format is invalid",
    };
  }

  const domain = parsedUrl.hostname;

  try {
    await dns.lookup(domain);
  } catch (error) {
    return {
      url: normalizedUrl,
      domain,
      formatValid: true,
      reachable: false,
      statusCode: null,
      status: "unreachable",
      reason: "Website domain cannot be resolved",
    };
  }

  try {
    let response = await fetchWithTimeout(
      normalizedUrl,
      {
        method: "HEAD",
        redirect: "follow",
      },
      5000,
    );

    if (response.status === 405 || response.status === 403) {
      response = await fetchWithTimeout(
        normalizedUrl,
        {
          method: "GET",
          redirect: "follow",
        },
        5000,
      );
    }

    const reachable = response.status >= 200 && response.status < 500;

    return {
      url: normalizedUrl,
      domain,
      formatValid: true,
      reachable,
      statusCode: response.status,
      status: reachable ? "valid" : "unreachable",
      reason: reachable ? null : `Website returned status ${response.status}`,
    };
  } catch (error) {
    return {
      url: normalizedUrl,
      domain,
      formatValid: true,
      reachable: false,
      statusCode: null,
      status: "unreachable",
      reason: "Website request failed or timed out",
    };
  }
};
