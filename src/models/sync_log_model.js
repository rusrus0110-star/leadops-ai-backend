import mongoose from "mongoose";

const syncLogSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
    },
    provider: {
      type: String,
      enum: ["hubspot", "openai", "internal"],
      required: true,
    },
    operation: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["success", "failed", "pending"],
      required: true,
    },
    message: {
      type: String,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

syncLogSchema.index({ leadId: 1 });
syncLogSchema.index({ provider: 1 });
syncLogSchema.index({ status: 1 });
syncLogSchema.index({ createdAt: -1 });

export const SyncLog = mongoose.model("SyncLog", syncLogSchema);
