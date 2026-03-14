/**
 * Inference API routes: alerts and inference endpoints.
 */

import type { Express, Request, Response } from "express";
import type { InferenceService } from "./inference.service";
import { createInferenceController } from "./inference.controller";

export function mountInferenceRoutes(
  app: Express,
  service: InferenceService
): void {
  const controller = createInferenceController(service);

  app.get("/api/alerts/active", (req: Request, res: Response) => {
    controller.getActiveAlert(req, res).catch(() => {
      if (!res.headersSent) res.status(500).json({ error: "Internal error" });
    });
  });

  app.get("/api/alerts/:id", (req: Request, res: Response) => {
    controller.getAlertById(req, res).catch(() => {
      if (!res.headersSent) res.status(500).json({ error: "Internal error" });
    });
  });

  app.get("/api/alerts/:id/inference", (req: Request, res: Response) => {
    controller.getInference(req, res).catch(() => {
      if (!res.headersSent) res.status(500).json({ error: "Internal error" });
    });
  });

  app.get("/api/alerts/:id/render-data", (req: Request, res: Response) => {
    controller.getRenderData(req, res).catch(() => {
      if (!res.headersSent) res.status(500).json({ error: "Internal error" });
    });
  });
}
