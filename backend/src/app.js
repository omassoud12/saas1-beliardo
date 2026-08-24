import express from "express";
import dashboardRoutes from "./features/dashboard/dashboard.routes.js";
import healthRoutes from "./features/health/health.routes.js";
import sessionRoutes from "./features/sessions/session.routes.js";
import stationRoutes from "./features/stations/station.routes.js";
import { cors } from "./middleware/cors.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors);
  app.use(express.json({ limit: "256kb" }));
  app.use("/api/health", healthRoutes);
  app.use("/api/stations", stationRoutes);
  app.use("/api/sessions", sessionRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
