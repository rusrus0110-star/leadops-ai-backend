import { parsePhoneNumberFromString } from "libphonenumber-js";

export const validatePhone = (phone, country = "DE") => {
  if (!phone || typeof phone !== "string" || phone.trim().length === 0) {
    return {
      formatValid: false,
      normalizedPhone: null,
      countryCode: null,
      status: "missing",
      reason: "Phone number is missing",
    };
  }

  const parsedPhone = parsePhoneNumberFromString(phone.trim(), country);

  if (!parsedPhone || !parsedPhone.isValid()) {
    return {
      formatValid: false,
      normalizedPhone: null,
      countryCode: null,
      status: "invalid",
      reason: "Phone number format is invalid",
    };
  }

  return {
    formatValid: true,
    normalizedPhone: parsedPhone.number,
    countryCode: parsedPhone.country || country,
    status: "valid",
    reason: null,
  };
};
