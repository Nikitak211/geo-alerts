/**
 * Inference API controller: request/response handling.
 */

import type { Request, Response } from "express";
import type { InferenceService } from "./inference.service";

export function createInferenceController(service: InferenceService) {
  async function getActiveAlert(req: Request, res: Response): Promise<void> {
    const alert = service.getActiveAlert();
    if (!alert) {
      res.status(404).json({ error: "No active alert" });
      return;
    }
    res.json(alert);
  }

  async function getAlertById(req: Request, res: Response): Promise<void> {
    const id = typeof req.params?.id === "string" ? req.params.id : undefined;
    if (!id) {
      res.status(400).json({ error: "Alert id required" });
      return;
    }
    try {
      const alert = await service.getAlertById(id);
      if (!alert) {
        res.status(404).json({ error: "Alert not found" });
        return;
      }
      res.json(alert);
    } catch (e) {
      res.status(500).json({
        error: "Alert load failed",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function getInference(req: Request, res: Response): Promise<void> {
    const id = typeof req.params?.id === "string" ? req.params.id : undefined;
    if (!id) {
      res.status(400).json({ error: "Alert id required" });
      return;
    }
    try {
      const result = await service.getInferenceResultForAlert(id);
      if (!result) {
        res.status(404).json({ error: "Alert or inference not found" });
        return;
      }
      res.json(result);
    } catch (e) {
      res.status(500).json({
        error: "Inference failed",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function getRenderData(req: Request, res: Response): Promise<void> {
    const id = typeof req.params?.id === "string" ? req.params.id : undefined;
    if (!id) {
      res.status(400).json({ error: "Alert id required" });
      return;
    }
    try {
      const alert = await service.getAlertById(id);
      if (!alert) {
        res.status(404).json({ error: "Alert not found" });
        return;
      }
      const result = await service.getInferenceResultForAlert(id);
      if (!result) {
        res.status(500).json({ error: "Inference not found" });
        return;
      }
      const renderData = service.buildRenderData(result) as unknown as Record<string, unknown>;
      renderData.receivedAt = alert.receivedAt;
      renderData.impactAreaNames = result.cluster.matchedSettlements.map(
        (s) => s.name
      );
      res.json(renderData);
    } catch (e) {
      res.status(500).json({
        error: "Render data failed",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return {
    getActiveAlert,
    getAlertById,
    getInference,
    getRenderData,
  };
}

export type InferenceController = ReturnType<typeof createInferenceController>;
