import { createTestHubSpotNote } from "../services/hubspot_service.js";
import { successResponse } from "../utils/api_response.js";

export const createTestNote = async (req, res, next) => {
  try {
    const { contactId } = req.params;

    if (!contactId) {
      const error = new Error("HubSpot contact ID is required");

      error.statusCode = 400;
      throw error;
    }

    const note = await createTestHubSpotNote(contactId);

    return successResponse({
      res,
      statusCode: 201,
      message: "HubSpot test note created successfully",
      data: note,
    });
  } catch (error) {
    next(error);
  }
};
