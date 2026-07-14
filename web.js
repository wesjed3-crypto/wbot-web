import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { cors } from "cors";

// Load environment variables
dotenv.config({ override: false });

// Import routes
import authRoutes from "./routes/auth.js";
import guildRoutes from "./routes/guilds.js";
import reactionRoleRoutes from "./routes/reaction-roles.js";
import ticketPanelRoutes from "./routes/ticket-panels.js";
import inviteLoggerRoutes from "./routes/invite-logger.js";
import boostLoggerRoutes from "./routes/boost-logger.js";
import levelSystemRoutes from "./routes/level-system.js";
import twitchRoutes from "./routes/twitch.js";
import autoModRoutes from "./routes/automod.js";
import adminRoutes from "./routes/admin.js";

// Import middleware
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { requireAuth, requireOwner } from "./middleware/auth.js";

// Import utilities
import { __dirname } from "./utils/pathUtils.js";

// Initialize Express app
const app = express();

// Set trust proxy for proper IP detection behind proxies
app.set('trust proxy', 1);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, "public")));

// Session configuration
const sessionStore = process.env.MONGODB_URI
  ? MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: "sessions",
      ttl: 60 * 60 * 24 * 7 // 1 week
    })
  : new session.MemoryStore();

app.use(session({
  name: "moderacion.sid",
  secret: process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString("hex"),
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.PUBLIC_URL?.startsWith('https') || false,
    maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || true,
  credentials: true
}));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root endpoint - serve static index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Alternative root path
app.get("/wbot", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/guilds", guildRoutes);
app.use("/api/reaction-roles", reactionRoleRoutes);
app.use("/api/ticket-panels", ticketPanelRoutes);
app.use("/api/invite-logger", inviteLoggerRoutes);
app.use("/api/boost-logger", boostLoggerRoutes);
app.use("/api/level-system", levelSystemRoutes);
app.use("/api/twitch", twitchRoutes);
app.use("/api/automod", autoModRoutes);
app.use("/api/admin", requireAuth, requireOwner, adminRoutes);

// Legacy endpoints for backward compatibility
app.get("/api/status", (req, res) => {
  // Delegate to auth route handler
  const isAuthenticated = req.session.user && req.session.accessToken;
  res.json({
    loggedIn: isAuthenticated,
    user: isAuthenticated ? req.session.user : null,
    isOwner: isAuthenticated && req.session.user.id === process.env.OWNER_ID,
    guildCount: req.session.userGuilds ? req.session.userGuilds.length : 0
  });
});

// Bot control endpoints (admin only)
app.get("/api/admin/bot/logs", requireAuth, requireOwner, (req, res) => {
  // This would be implemented in adminRoutes
  res.json({ log: "Bot logs endpoint - to be implemented" });
});

app.post("/api/admin/bot/:action", requireAuth, requireOwner, async (req, res) => {
  // This would be implemented in adminRoutes
  const { action } = req.params;
  res.json({ 
    success: true, 
    message: `Bot action ${action} executed`, 
    action 
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || process.env.WEB_PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 MongoDB: ${process.env.MONGODB_URI ? 'Connected' : 'Not configured (using memory store)'}`);
  console.log(`🔑 Session secret: ${process.env.SESSION_LENGTH ? 'Set' : 'Generated'}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM');
  server.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});

export default app;
