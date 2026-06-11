import { Lead } from "../models/lead_model.js";
import { SyncLog } from "../models/sync_log_model.js";
import { syncLeadToHubSpot } from "../services/hubspot_service.js";
import { successResponse } from "../utils/api_response.js";

export const syncLeadWithHubSpot = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      const error = new Error("Lead not found");
      error.statusCode = 404;
      throw error;
    }

    lead.hubspotSyncStatus = "pending";
    await lead.save();

    await SyncLog.create({
      leadId: lead._id,
      provider: "hubspot",
      operation: "sync_lead_to_hubspot",
      status: "pending",
      message: "HubSpot sync started",
    });

    const hubspotResult = await syncLeadToHubSpot(lead);

    lead.hubspotSyncStatus = "synced";
    lead.status = "synced_to_hubspot";
    lead.hubspotContactId = hubspotResult.contactId;
    lead.hubspotCompanyId = hubspotResult.companyId;

    await lead.save();

    await SyncLog.create({
      leadId: lead._id,
      provider: "hubspot",
      operation: "sync_lead_to_hubspot",
      status: "success",
      message: "Lead synced to HubSpot successfully",
      metadata: hubspotResult,
    });

    return successResponse({
      res,
      message: "Lead synced to HubSpot successfully",
      data: {
        lead,
        hubspot: hubspotResult,
      },
    });
  } catch (error) {
    try {
      const lead = await Lead.findById(req.params.id);

      if (lead) {
        lead.hubspotSyncStatus = "failed";
        lead.status = "sync_failed";
        await lead.save();

        await SyncLog.create({
          leadId: lead._id,
          provider: "hubspot",
          operation: "sync_lead_to_hubspot",
          status: "failed",
          errorMessage: error.message,
          metadata: error.hubspotResponse || {},
        });
      }
    } catch (logError) {
      console.error(
        "Failed to write HubSpot sync error log:",
        logError.message,
      );
    }

    next(error);
  }
};
