import express from "express";
import dashboardRoutes from "./features/dashboard/dashboard.routes.js";
import businessRoutes from "./features/business/business.routes.js";
import healthRoutes from "./features/health/health.routes.js";
import sessionRoutes from "./features/sessions/session.routes.js";
import stationRoutes from "./features/stations/station.routes.js";
import accessRoutes from "./features/access/access.routes.js";
import employeeRoutes from "./features/employees/employee.routes.js";
import platformRoutes from "./features/platform/platform.routes.js";
import { cors } from "./middleware/cors.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { apiRateLimiter, securityHeaders } from "./middleware/security.js";
import { getTrustProxyHops } from "./config/env.js";
import { requestContext } from "./middleware/requestContext.js";
import { requestId } from "./middleware/requestId.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", getTrustProxyHops());
  app.disable("x-powered-by");
  app.use(securityHeaders);
  app.use(cors);
  app.use(requestId);
  app.use(requestContext);
  app.use(apiRateLimiter);
  app.use(express.json({ limit: "256kb" }));
  app.use("/api/health", healthRoutes);
  app.use("/api/access", accessRoutes);
  app.use("/api/platform", platformRoutes);
  app.use("/api/employees", employeeRoutes);
  app.use("/api/stations", stationRoutes);
  app.use("/api/sessions", sessionRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/business", businessRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
