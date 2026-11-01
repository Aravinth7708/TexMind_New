import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { runMigrations } from "./db/migrations";
import { initializeSupabaseSync, queueSupabaseSnapshotSave } from "./db/supabase-sync";
import { errorHandler } from "./middleware/error";

// Routes
import authRouter from "./routes/auth";
import dashboardRouter from "./routes/dashboard";
import ordersRouter from "./routes/orders";
import buyersRouter from "./routes/buyers";
import productionRouter from "./routes/production";
import inventoryRouter from "./routes/inventory";
import notificationsRouter from "./routes/notifications";
import proposalsRouter from "./routes/proposals";
import usersRouter from "./routes/users";
import analyticsRouter from "./routes/analytics";
import healthRouter from "./routes/health";
import buyerRouter from "./routes/buyer";
import supervisorRouter from "./routes/supervisor";
import documentsRouter from "./routes/documents";
import qcRouter from "./routes/qc";
import capacityRouter from "./routes/capacity";
import agentsRouter from "./routes/agents";
import scenarioRouter from "./routes/scenario";
import settingsRouter from "./routes/settings";
import searchRouter from "./routes/search";
import reportsRouter from "./routes/reports";
import chatRouter from "./routes/chat";
import operationalRouter from "./routes/operational";
import whatsappRouter from "./routes/whatsapp";
import { waManager } from "./lib/whatsapp";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

// ──────────────── Middleware ─────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:5173,http://localhost:8080")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (Postman, curl, etc.)
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origin ${origin} not allowed`));
      }
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    res.on("finish", () => {
      if (res.statusCode < 400) queueSupabaseSnapshotSave();
    });
  }
  next();
});

// ──────────────── Initialize DB ──────────────────────────────
runMigrations();

// ──────────────── Routes ──────────────────────────────────────
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/buyers", buyersRouter);
app.use("/api/buyer", buyerRouter);
app.use("/api/production", productionRouter);
app.use("/api/supervisor", supervisorRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/qc", qcRouter);
app.use("/api/capacity", capacityRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/scenario", scenarioRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/search", searchRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/chat", chatRouter);
app.use("/api/operational", operationalRouter);
app.use("/api/whatsapp", whatsappRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/proposals", proposalsRouter);
app.use("/api/users", usersRouter);
app.use("/api/analytics", analyticsRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use(errorHandler);

// ──────────────── Start ───────────────────────────────────────
void initializeSupabaseSync()
  .catch((error) => console.error("Supabase startup sync failed:", error))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`\n🚀 TexMind Node.js Backend running on http://localhost:${PORT}`);
      console.log(`   📊 API docs: http://localhost:${PORT}/api/health`);
      console.log(`   🌐 CORS origins: ${allowedOrigins.join(", ")}`);
      console.log(`   📁 DB: ${process.env.DB_PATH || "./texmind.sqlite3"}\n`);

      waManager.connect().catch((err) =>
        console.error("WhatsApp auto-connect failed:", err)
      );
    });
  });

export default app;
