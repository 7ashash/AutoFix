import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { pingDatabase } from "./config/database.js";
import apiRouter from "./routes/index.js";

const app = express();

app.use(
  cors({
    origin: env.corsOrigin,
    credentials: false
  })
);
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    await pingDatabase();
    res.json({
      success: true,
      data: {
        service: "autofix-backend",
        environment: env.nodeEnv,
        database: {
          connected: true,
          name: env.db.name
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message
      }
    });
  }
});

app.use("/api", apiRouter);

app.use((error, _req, res, _next) => {
  const status = error.statusCode || 500;
  res.status(status).json({
    success: false,
    error: {
      message: error.message || "Unexpected server error"
    }
  });
});

export default app;
