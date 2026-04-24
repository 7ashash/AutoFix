import { Router } from "express";
import { attachOptionalAuth, requireAuth } from "../middleware/authenticate.js";
import {
  getAssistantBootstrapData,
  listAssistantHistory,
  processAssistantChat
} from "../lib/assistant-service.js";

const router = Router();

router.get("/bootstrap", attachOptionalAuth, async (req, res, next) => {
  try {
    const data = await getAssistantBootstrapData(req.auth?.user || null);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/history", requireAuth, async (req, res, next) => {
  try {
    const data = await listAssistantHistory(req.auth.user.id, {
      locale: req.query?.locale,
      mode: req.query?.mode
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/chat", attachOptionalAuth, async (req, res, next) => {
  try {
    const data = await processAssistantChat({
      user: req.auth?.user || null,
      locale: req.body?.locale,
      mode: req.body?.mode,
      message: req.body?.message,
      context: req.body?.context,
      history: req.body?.history
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
