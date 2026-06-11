import dns from "node:dns/promises";
import validator from "validator";

const freeEmailDomains = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.de",
  "web.de",
]);

export const validateEmail = async (email) => {
  if (!email || typeof email !== "string") {
    return {
      formatValid: false,
      domain: null,
      hasMxRecords: false,
      isBusinessEmail: false,
      status: "invalid",
      reason: "Email is required",
    };
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!validator.isEmail(normalizedEmail)) {
    return {
      formatValid: false,
      domain: null,
      hasMxRecords: false,
      isBusinessEmail: false,
      status: "invalid",
      reason: "Email format is invalid",
    };
  }

  const domain = normalizedEmail.split("@")[1];

  let hasMxRecords = false;

  try {
    const mxRecords = await dns.resolveMx(domain);
    hasMxRecords = Array.isArray(mxRecords) && mxRecords.length > 0;
  } catch (error) {
    hasMxRecords = false;
  }

  const isFreeEmail = freeEmailDomains.has(domain);
  const isBusinessEmail = hasMxRecords && !isFreeEmail;

  if (!hasMxRecords) {
    return {
      formatValid: true,
      domain,
      hasMxRecords: false,
      isBusinessEmail: false,
      status: "warning",
      reason: "Email domain has no MX records",
    };
  }

  return {
    formatValid: true,
    domain,
    hasMxRecords: true,
    isBusinessEmail,
    status: isBusinessEmail ? "valid" : "warning",
    reason: isBusinessEmail ? null : "Free email domain detected",
  };
};
