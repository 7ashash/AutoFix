import { Router } from "express";
import authRoutes from "./auth.routes.js";
import adminRoutes from "./admin.routes.js";
import dealersRoutes from "./dealers.routes.js";
import vehiclesRoutes from "./vehicles.routes.js";
import partsRoutes from "./parts.routes.js";
import commerceRoutes from "./commerce.routes.js";
import verificationRoutes from "./verification.routes.js";
import assistantRoutes from "./assistant.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/dealers", dealersRoutes);
router.use("/vehicles", vehiclesRoutes);
router.use("/parts", partsRoutes);
router.use("/verification", verificationRoutes);
router.use("/assistant", assistantRoutes);
router.use("/", commerceRoutes);

export default router;
