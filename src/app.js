import express from "express";
import cors from "cors";
import morgan from "morgan";

import healthRoutes from "./routes/health_routes.js";
import leadRoutes from "./routes/lead_routes.js";

import { notFoundMiddleware } from "./middlewares/not_found_middleware.js";
import { errorMiddleware } from "./middlewares/error_middleware.js";

const app = express();

const allowedOrigins = [process.env.CLIENT_URL, "http://localhost:5173"].filter(
  Boolean,
);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

app.use("/api/health", healthRoutes);
app.use("/api/leads", leadRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
