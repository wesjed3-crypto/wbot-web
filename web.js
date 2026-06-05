import crypto from "crypto";
import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

dotenv.config({ override: false });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IS_COMBINED = process.env.__WBOT_COMBINED === '1';
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const OWNER_ID = process.env.OWNER_ID || "";
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
const PORT = Number(process.env.WEB_PORT || process.env.PORT || 3000);
const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  process.env.MONGO_URI ||
  process.env.MONGODB_URL ||
  process.env.DATABASE_URL;
const SITE_NAME = process.env.WEB_NAME || "wbot";
const DATA_DIR = path.join(__dirname, "data");
const CONFIG_FILE = path.join(DATA_DIR, "guild-configs.json");
let botProcess = null;
let botLastLog = "";

// Caches globales para mitigar 429 de Discord Rate Limits
let botGuildIdsCache = null;
let botGuildIdsCacheTime = 0;
let detailedBotGuildsCache = null;
let detailedBotGuildsCacheTime = 0;

const defaultGuildConfig = {
  logChannelId: "",
  mutedRoleId: "",
  logEvents: {
    messageDelete: true,
    messageUpdate: true,
    guildBanAdd: true,
    guildBanRemove: true,
    kick: true,
    timeout: true,
    guildMemberAdd: true,
    guildMemberRemove: true,
    guildMemberUpdate: true,
    channelCreate: true,
    channelDelete: true,
    channelUpdate: true,
    roleCreate: true,
    roleDelete: true,
    roleUpdate: true
  },
  autoMod: {
    blockInvites: true,
    blockBadWords: true,
    blockMassMentions: true,
    blockSpam: true,
    blockCaps: false,
    blockLinks: false,
    maxMentions: 5,
    maxCapsPercent: 75,
    minCapsLen: 12,
    spamMaxMessages: 6,
    spamWindowMs: 8000,
    badWords: []
  },
  punishments: {
    warnsForTimeout: 3,
    timeoutMinutes: 60,
    warnsForKick: 5
  },
  welcome: {
    channelId: "",
    embedEnabled: true,
    title: "Bienvenido/a",
    description: "Hola {user}. Bienvenido/a a **{server}**. Eres el miembro numero {memberCount}.",
    color: "#8b5cf6",
    thumbnail: true
  },
  farewell: {
    channelId: "",
    embedEnabled: true,
    title: "Hasta pronto",
    description: "**{user}** ha salido del servidor.",
    color: "#ef4444",
    thumbnail: true
  },
  antiNuke: {
    enabled: false,
    maxChannelDeletes: 3,
    maxRoleDeletes: 3,
    maxBans: 3
  },

  tickets: {
    enabled: false,
    categoryId: "",
    supportRoleId: "",
    welcomeMessage: "Hola {user}. Describe tu problema y el equipo de soporte te atenderá lo antes posible."
  },

  reactionRoles: [],

  ticketPanels: [],

  inviteLogger: {
    enabled: false,
    channelId: "",
    embedEnabled: true,
    title: "🎉 Nueva invitación",
    description: "{inviter} ha invitado a **{joined}** al servidor.\n📊 Invitaciones totales de {inviter}: **{invites}**",
    color: "#8b5cf6"
  },

  boostLogger: {
    enabled: false,
    channelId: "",
    embedEnabled: true,
    title: "🚀 Nuevo boost",
    description: "{user} ha mejorado el servidor **{server}** con un boost.\n¡Gracias por el apoyo {user}! 🎉",
    color: "#f97316"
  },

  levelSystem: {
    enabled: false,
    channelId: "",
    embedEnabled: true,
    title: "🎉 ¡{user} ha subido al nivel {level}!",
    description: "¡Felicidades {user}! Has alcanzado el **nivel {level}** en {server}.\nSigue escribiendo para seguir subiendo de nivel. 🚀",
    color: "#8b5cf6",
    xpPerMessage: 20,
    cooldown: 60
  }
};

const app = express();
app.set('trust proxy', 1);

const guildConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  config: { type: Object, default: () => structuredClone(defaultGuildConfig) }
}, { timestamps: true });

const GuildConfig = mongoose.models.GuildConfig || mongoose.model("GuildConfig", guildConfigSchema);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const sessionStore = MONGODB_URI
  ? MongoStore.create({
      mongoUrl: MONGODB_URI,
      collectionName: "sessions",
      ttl: 60 * 60 * 24 * 7
    })
  : new session.MemoryStore();

app.use(session({
  name: "moderacion.sid",
  secret: SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.PUBLIC_URL?.startsWith('https') || false,
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

function deepMerge(base, value) {
  const output = structuredClone(base);
  for (const [key, item] of Object.entries(value || {})) {
    if (item && typeof item === "object" && !Array.isArray(item) && key in output) {
      output[key] = deepMerge(output[key], item);
    } else {
      output[key] = item;
    }
  }
  return output;
}

function readConfigFile() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    }
  } catch {}
  return {};
}

function writeConfigFile(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Error escribiendo archivo de config:", e);
  }
}

function fileGetGuildConfig(guildId) {
  const all = readConfigFile();
  if (!all[guildId]) {
    all[guildId] = { config: structuredClone(defaultGuildConfig) };
    writeConfigFile(all);
  }
  return deepMerge(defaultGuildConfig, all[guildId].config);
}

function fileSetGuildConfig(guildId, config) {
  const all = readConfigFile();
  all[guildId] = { config: deepMerge(defaultGuildConfig, config) };
  writeConfigFile(all);
  return all[guildId].config;
}

let useMongo = false;
let mongoAttempted = false;

async function ensureMongo() {
  if (mongoose.connection.readyState === 1) { useMongo = true; return true; }
  if (!MONGODB_URI) { useMongo = false; return false; }
  if (mongoAttempted && !useMongo) return false;
  mongoAttempted = true;
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 3000 });
    useMongo = true;
    return true;
  } catch (e) {
    console.warn("⚠️  MongoDB no disponible, usando archivo local. Detalle:", e.message);
    useMongo = false;
    return false;
  }
}

async function getGuildConfig(guildId) {
  if (await ensureMongo() && useMongo) {
    try {
      const doc = await GuildConfig.findOneAndUpdate(
        { guildId },
        { $setOnInsert: { config: structuredClone(defaultGuildConfig) } },
        { upsert: true, returnDocument: "after" }
      );
      doc.config = deepMerge(defaultGuildConfig, doc.config);
      await doc.save();
      return doc.config;
    } catch (e) {
      console.warn("⚠️  Error leyendo de MongoDB, usando archivo local:", e.message);
    }
  }
  return fileGetGuildConfig(guildId);
}

async function setGuildConfig(guildId, config) {
  const clean = deepMerge(defaultGuildConfig, config);
  if (await ensureMongo() && useMongo) {
    try {
      await GuildConfig.findOneAndUpdate(
        { guildId },
        { $set: { config: clean } },
        { upsert: true, returnDocument: "after" }
      );
      return clean;
    } catch (e) {
      console.warn("⚠️  Error guardando en MongoDB, usando archivo local:", e.message);
    }
  }
  return fileSetGuildConfig(guildId, config);
}

function requireAuth(req, res, next) {
  if (!req.session.user || !req.session.accessToken) {
    return res.status(401).json({ error: "No has iniciado sesion." });
  }
  next();
}

function requireOwner(req, res, next) {
  if (!req.session.user || req.session.user.id !== OWNER_ID) {
    return res.status(403).json({ error: "Solo el propietario puede usar este panel." });
  }
  next();
}

function getBotStatus() {
  if (IS_COMBINED) {
    return { running: true, pid: process.pid, combined: true };
  }
  return {
    running: Boolean(botProcess && botProcess.exitCode === null && !botProcess.killed),
    pid: botProcess?.pid || null
  };
}

function appendBotLog(chunk) {
  botLastLog = `${botLastLog}${chunk}`.slice(-5000);
}

function startBot() {
  if (getBotStatus().running) {
    return Promise.resolve({ bot: getBotStatus(), message: "El bot ya estaba iniciado." });
  }

  botProcess = spawn(process.execPath, ["index.js"], {
    cwd: __dirname,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  botLastLog = "";
  botProcess.stdout.on("data", chunk => {
    const text = chunk.toString();
    appendBotLog(text);
    process.stdout.write(text);
  });
  botProcess.stderr.on("data", chunk => {
    const text = chunk.toString();
    appendBotLog(text);
    process.stderr.write(text);
  });
  botProcess.on("error", err => {
    appendBotLog(`Error al iniciar el bot: ${err.message}`);
    botProcess = null;
  });
  botProcess.on("exit", (code, signal) => {
    appendBotLog(`Proceso del bot terminado (código: ${code}, señal: ${signal})`);
    botProcess = null;
  });

  return new Promise(resolve => {
    const checkReady = () => {
      const bot = getBotStatus();
      if (bot.running && botLastLog.includes("Bot iniciado correctamente")) {
        return resolve({ bot, message: "Bot iniciado." });
      }
      if (!bot.running) {
        const cleanLog = botLastLog.trim().split("\n").slice(-8).join("\n");
        return resolve({
          bot,
          error: cleanLog || "El proceso del bot se cerro al iniciar."
        });
      }
      setTimeout(checkReady, 1000);
    };
    setTimeout(() => {
      const bot = getBotStatus();
      if (bot.running && !botLastLog.includes("Bot iniciado correctamente")) {
        return resolve({
          bot,
          error: "El bot sigue arrancando (MongoDB o Discord pueden estar lentos). Revisa los logs."
        });
      }
    }, 30000);
    setTimeout(checkReady, 1500);
  });
}

function stopBot() {
  if (!getBotStatus().running) return Promise.resolve(getBotStatus());

  return new Promise(resolve => {
    const activeProcess = botProcess;
    const timeout = setTimeout(() => {
      if (activeProcess && activeProcess.exitCode === null) activeProcess.kill("SIGKILL");
      resolve(getBotStatus());
    }, 5000);

    activeProcess.once("exit", () => {
      clearTimeout(timeout);
      resolve(getBotStatus());
    });

    activeProcess.kill();
  });
}

function hasManageGuild(guild) {
  const permissions = BigInt(guild.permissions || "0");
  const administrator = 0x8n;
  const manageGuild = 0x20n;
  return Boolean((permissions & administrator) || (permissions & manageGuild) || guild.owner);
}

async function discordFetch(req, endpoint) {
  const response = await fetch(`https://discord.com/api/v10${endpoint}`, {
    headers: {
      Authorization: `Bearer ${req.session.accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Discord API error ${response.status}`);
  }

  return response.json();
}

async function fetchBotGuilds() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) return [];
  
  const now = Date.now();
  if (botGuildIdsCache && (now - botGuildIdsCacheTime < 60000)) {
    return botGuildIdsCache;
  }
  
  try {
    const response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: {
        Authorization: `Bot ${token}`
      }
    });

    if (!response.ok) {
      console.error(`Error al obtener servidores del bot: ${response.status}`);
      if (response.status === 429 && botGuildIdsCache) {
        return botGuildIdsCache;
      }
      return botGuildIdsCache || [];
    }

    const guilds = await response.json();
    botGuildIdsCache = guilds.map(g => g.id);
    botGuildIdsCacheTime = now;
    return botGuildIdsCache;
  } catch (error) {
    console.error("Error obteniendo servidores del bot:", error);
    return botGuildIdsCache || [];
  }
}

app.get("/api/status", (req, res) => {
  const isOwner = Boolean(req.session.user && req.session.user.id === OWNER_ID);
  res.json({
    loggedIn: Boolean(req.session.user),
    user: req.session.user || null,
    isOwner,
    bot: isOwner ? getBotStatus() : null,
    siteName: SITE_NAME,
    clientId: CLIENT_ID,
    inviteUrl: `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=1099645922310&scope=bot%20applications.commands`
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.get("/api/admin/bot/logs", requireAuth, requireOwner, (req, res) => {
  res.json({ log: botLastLog.trim().split("\n").slice(-20).join("\n") });
});

app.post("/api/admin/bot/:action", requireAuth, requireOwner, async (req, res) => {
  const { action } = req.params;

  if (IS_COMBINED) {
    if (action === "start") {
      return res.json({ bot: getBotStatus(), message: "El bot ya esta corriendo (modo Railway)." });
    }
    if (action === "restart") {
      res.json({ bot: getBotStatus(), message: "Reiniciando contenedor..." });
      setTimeout(() => process.exit(0), 500);
      return;
    }
    return res.status(400).json({ error: "No puedes apagar el bot en modo Railway. Railway gestiona el ciclo de vida." });
  }

  if (action === "start") {
    const result = await startBot();
    if (result.error) return res.status(500).json({ error: result.error, bot: result.bot });
    return res.json(result);
  }

  if (action === "stop") {
    const bot = await stopBot();
    return res.json({ bot, message: "Bot apagado." });
  }

  if (action === "restart") {
    await stopBot();
    const result = await startBot();
    if (result.error) return res.status(500).json({ error: result.error, bot: result.bot });
    return res.json({ ...result, message: "Bot reiniciado." });
  }

  res.status(400).json({ error: "Accion no valida." });
});

app.get("/login", (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET || CLIENT_SECRET.includes("CAMBIA_ESTO")) {
    return res.redirect("/?setup=missing-secret");
  }

  const state = crypto.randomBytes(16).toString("hex");
  req.session.oauthState = state;
  req.session.save(err => {
    if (err) console.error("Session save error:", err);

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "identify guilds",
      state,
      prompt: "none"
    });

    res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
  });
});

app.get("/callback", async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    console.error("Callback falló: faltan code o state", { code: !!code, state: !!state });
    return res.redirect("/?login=failed");
  }

  if (state !== req.session.oauthState) {
    console.error("Callback falló: state mismatch", { state, sessionState: req.session.oauthState, sessionID: req.sessionID });
    return res.redirect("/?login=failed");
  }

  try {
    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "authorization_code",
      code: String(code),
      redirect_uri: REDIRECT_URI
    });

    const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text().catch(() => "");
      console.error(`OAuth token error ${tokenResponse.status}: ${errText}`);
      throw new Error(`OAuth token error ${tokenResponse.status}`);
    }

    const token = await tokenResponse.json();
    req.session.accessToken = token.access_token;

    const user = await discordFetch(req, "/users/@me");
    req.session.user = {
      id: user.id,
      username: user.username,
      globalName: user.global_name,
      avatar: user.avatar
    };

    delete req.session.oauthState;
    res.redirect("/wbot");
  } catch (error) {
    console.error("Callback error:", error.message);
    res.redirect("/?login=failed");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/wbot"));
});

app.get("/", (req, res) => {
  res.redirect("/wbot");
});

app.get("/api/guilds", requireAuth, async (req, res) => {
  const now = Date.now();
  // Utilizar caché en sesión si es menor a 60 segundos
  if (req.session.guildsCache && (now - req.session.guildsCacheTime < 60000)) {
    return res.json(req.session.guildsCache);
  }

  try {
    const userGuilds = await discordFetch(req, "/users/@me/guilds");
    const adminGuilds = userGuilds.filter(hasManageGuild);
    
    // Obtener los servidores en donde el bot está presente
    const botGuildIds = await fetchBotGuilds();
    
    // Filtrar para mostrar solo los servidores donde el bot está presente
    const filteredGuilds = adminGuilds.filter(guild => botGuildIds.includes(guild.id));

    const result = filteredGuilds.map(guild => ({
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
      owner: guild.owner
    }));

    // Guardar en la sesión
    req.session.guildsCache = result;
    req.session.guildsCacheTime = now;

    res.json(result);
  } catch (error) {
    console.error("Error al obtener servidores del usuario:", error);
    
    // Retornar caché anterior si está disponible
    if (req.session.guildsCache) {
      return res.json(req.session.guildsCache);
    }
    
    if (error.message.includes("429")) {
      return res.status(429).json({ error: "Discord nos está limitando (Rate Limit). Reintenta en unos instantes." });
    }
    
    res.status(500).json({ error: "No se pudieron cargar tus servidores." });
  }
});

app.get("/api/guilds/:guildId/channels", requireAuth, async (req, res) => {
  try {
    const token = process.env.DISCORD_TOKEN;
    if (!token) return res.status(500).json({ error: "Falta el token del bot." });

    const guildRes = await fetch(`https://discord.com/api/v10/guilds/${req.params.guildId}/channels`, {
      headers: { Authorization: `Bot ${token}` }
    });

    if (!guildRes.ok) {
      if (guildRes.status === 403) throw new Error("Token del bot inválido o sin acceso. Regenera el token en Discord Developer Portal.");
      throw new Error(`Discord API error ${guildRes.status}`);
    }

    const channels = await guildRes.json();
    const textChannels = channels.filter(c => c.type === 0).map(c => ({ id: c.id, name: c.name }));
    const voiceChannels = channels.filter(c => c.type === 2).map(c => ({ id: c.id, name: c.name }));
    const categories = channels.filter(c => c.type === 4).map(c => ({ id: c.id, name: c.name }));

    res.json({ textChannels, voiceChannels, categories });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "No se pudieron cargar los canales." });
  }
});

app.get("/api/guilds/:guildId/roles", requireAuth, async (req, res) => {
  try {
    const token = process.env.DISCORD_TOKEN;
    if (!token) return res.status(500).json({ error: "Falta el token del bot." });

    const guildRes = await fetch(`https://discord.com/api/v10/guilds/${req.params.guildId}/roles`, {
      headers: { Authorization: `Bot ${token}` }
    });

    if (!guildRes.ok) {
      if (guildRes.status === 403) throw new Error("Token del bot inválido o sin acceso. Regenera el token en Discord Developer Portal.");
      throw new Error(`Discord API error ${guildRes.status}`);
    }

    const roles = await guildRes.json();
    const sorted = roles
      .filter(r => r.name !== "@everyone")
      .sort((a, b) => b.position - a.position)
      .map(r => ({ id: r.id, name: r.name, color: r.color }));

    res.json(sorted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "No se pudieron cargar los roles." });
  }
});

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

app.get("/api/guilds/:guildId/reaction-roles", requireAuth, async (req, res) => {
  try {
    const config = await getGuildConfig(req.params.guildId);
    res.json(config.reactionRoles || []);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No se pudieron cargar los paneles." });
  }
});

app.post("/api/guilds/:guildId/reaction-roles", requireAuth, async (req, res) => {
  try {
    const config = await getGuildConfig(req.params.guildId);
    const panel = {
      id: generateId(),
      channelId: "",
      messageId: "",
      embed: {
        title: req.body.embed?.title || "Role Panel",
        description: req.body.embed?.description || "Haz clic en un botón para obtener tus roles.",
        color: req.body.embed?.color || "#8b5cf6",
        fields: req.body.embed?.fields || [],
        imageUrl: req.body.embed?.imageUrl || "",
        thumbnailUrl: req.body.embed?.thumbnailUrl || "",
        footer: req.body.embed?.footer || ""
      },
      buttons: req.body.buttons || []
    };
    config.reactionRoles = [...(config.reactionRoles || []), panel];
    const saved = await setGuildConfig(req.params.guildId, config);
    const savedPanel = saved.reactionRoles?.find(p => p.id === panel.id);
    res.json(savedPanel || panel);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No se pudo crear el panel." });
  }
});

app.put("/api/guilds/:guildId/reaction-roles/:panelId", requireAuth, async (req, res) => {
  try {
    const config = await getGuildConfig(req.params.guildId);
    const idx = (config.reactionRoles || []).findIndex(p => p.id === req.params.panelId);
    if (idx === -1) return res.status(404).json({ error: "Panel no encontrado." });

    const panel = config.reactionRoles[idx];

    if (req.body.embed !== undefined) {
      panel.embed = {
        title: req.body.embed.title ?? panel.embed.title,
        description: req.body.embed.description ?? panel.embed.description,
        color: req.body.embed.color ?? panel.embed.color,
        fields: req.body.embed.fields ?? panel.embed.fields ?? [],
        imageUrl: req.body.embed.imageUrl ?? panel.embed.imageUrl ?? "",
        thumbnailUrl: req.body.embed.thumbnailUrl ?? panel.embed.thumbnailUrl ?? "",
        footer: req.body.embed.footer ?? panel.embed.footer ?? ""
      };
    }

    if (req.body.buttons !== undefined) {
      panel.buttons = req.body.buttons;
    }

    if (req.body.channelId !== undefined) {
      panel.channelId = req.body.channelId;
    }

    const saved = await setGuildConfig(req.params.guildId, config);
    const savedPanel = saved.reactionRoles?.find(p => p.id === panel.id);
    res.json(savedPanel || panel);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No se pudo actualizar el panel." });
  }
});

app.delete("/api/guilds/:guildId/reaction-roles/:panelId", requireAuth, async (req, res) => {
  try {
    const config = await getGuildConfig(req.params.guildId);
    config.reactionRoles = (config.reactionRoles || []).filter(p => p.id !== req.params.panelId);
    await setGuildConfig(req.params.guildId, config);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No se pudo eliminar el panel." });
  }
});

app.post("/api/guilds/:guildId/reaction-roles/:panelId/send", requireAuth, async (req, res) => {
  try {
    const token = process.env.DISCORD_TOKEN;
    if (!token) return res.status(500).json({ error: "Falta el token del bot." });

    const config = await getGuildConfig(req.params.guildId);
    const panel = (config.reactionRoles || []).find(p => p.id === req.params.panelId);
    if (!panel) return res.status(404).json({ error: "Panel no encontrado." });
    if (!panel.channelId) return res.status(400).json({ error: "El panel no tiene un canal asignado." });

    const embedPayload = {
      title: panel.embed.title?.slice(0, 256) || "Role Panel",
      description: panel.embed.description?.slice(0, 4096) || "",
      color: parseInt(panel.embed.color?.replace("#", "") || "8b5cf6", 16),
      timestamp: new Date().toISOString(),
      footer: { text: panel.embed.footer || "by wesjed" }
    };

    if (panel.embed.imageUrl) embedPayload.image = { url: panel.embed.imageUrl };
    if (panel.embed.thumbnailUrl) embedPayload.thumbnail = { url: panel.embed.thumbnailUrl };
    if (panel.embed.fields?.length) {
      embedPayload.fields = panel.embed.fields.map(f => ({
        name: String(f.name || "").slice(0, 256),
        value: String(f.value || "").slice(0, 1024),
        inline: Boolean(f.inline)
      }));
    }

    // Build action rows with buttons (max 5 per row)
    const components = [];
    const buttons = panel.buttons || [];
    const hasValidButtons = buttons.some(b => b && b.label && b.label.trim());
    if (!hasValidButtons) {
      return res.status(400).json({ error: "El panel no tiene botones válidos. Añade al menos un botón con etiqueta." });
    }
    let row = { type: 1, components: [] };
    let count = 0;
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      if (!btn || !btn.label || !btn.label.trim()) continue;
      
      // Encode mode + role IDs directly in custom_id so the bot doesn't need DB access
      const roleIds = btn.roleIds || [];
      const mode = (btn.mode || "toggle").charAt(0);
      const modePrefix = mode === "t" ? "" : `${mode}_`;
      const roleSuffix = roleIds.join("_");
      let customId;
      const full = `rp_${modePrefix}${roleSuffix}`;
      if (roleSuffix && full.length <= 100) {
        customId = full;
      } else {
        customId = `role_panel_${panel.id}_${i}`;
      }
      
      const component = {
        type: 2,
        style: 3,
        label: btn.label.trim().slice(0, 80),
        custom_id: customId
      };
      if (btn.emoji && btn.emoji.trim()) {
        const e = btn.emoji.trim();
        component.emoji = e.match(/^<a?:.+?:\d+>$/) ? { name: e } : { name: e };
      }
      row.components.push(component);
      count++;
      if (count % 5 === 0) {
        components.push(row);
        row = { type: 1, components: [] };
      }
    }
    if (row.components.length > 0) components.push(row);

    let isUpdate = !!(panel.messageId && panel.channelId);
    if (isUpdate) {
      const checkRes = await fetch(`https://discord.com/api/v10/channels/${panel.channelId}/messages/${panel.messageId}`, {
        headers: { Authorization: `Bot ${token}` }
      });
      if (!checkRes.ok) {
        panel.messageId = "";
        isUpdate = false;
      }
    }
    const url = `https://discord.com/api/v10/channels/${panel.channelId}/messages${isUpdate ? `/${panel.messageId}` : ""}`;
    const msgRes = await fetch(url, {
      method: isUpdate ? "PATCH" : "POST",
      headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embedPayload], components })
    });

    if (!msgRes.ok) {
      const errText = await msgRes.text().catch(() => "");
      throw new Error(`Error al ${isUpdate ? "actualizar" : "enviar"} mensaje (${msgRes.status}): ${errText}`);
    }

    const msg = await msgRes.json();
    panel.messageId = msg.id;

    const saved = await setGuildConfig(req.params.guildId, config);
    const savedPanel = saved.reactionRoles?.find(p => p.id === panel.id);
    res.json(savedPanel || panel);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: `No se pudo enviar el panel: ${error.message}` });
  }
});

// === TICKET PANELS API ===

app.get("/api/guilds/:guildId/ticket-panels", requireAuth, async (req, res) => {
  try {
    const config = await getGuildConfig(req.params.guildId);
    res.json(config.ticketPanels || []);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No se pudieron cargar los paneles." });
  }
});

app.post("/api/guilds/:guildId/ticket-panels", requireAuth, async (req, res) => {
  try {
    const config = await getGuildConfig(req.params.guildId);
    const panel = {
      id: generateId(),
      channelId: "",
      messageId: "",
      embed: {
        title: req.body.embed?.title || "Sistema de Tickets",
        description: req.body.embed?.description || "Haz clic en un botón para crear un ticket.",
        color: req.body.embed?.color || "#8b5cf6",
        fields: req.body.embed?.fields || [],
        imageUrl: req.body.embed?.imageUrl || "",
        thumbnailUrl: req.body.embed?.thumbnailUrl || "",
        footer: req.body.embed?.footer || "by wesjed"
      },
      buttons: req.body.buttons || []
    };
    config.ticketPanels = [...(config.ticketPanels || []), panel];
    const saved = await setGuildConfig(req.params.guildId, config);
    const savedPanel = saved.ticketPanels?.find(p => p.id === panel.id);
    res.json(savedPanel || panel);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No se pudo crear el panel." });
  }
});

app.put("/api/guilds/:guildId/ticket-panels/:panelId", requireAuth, async (req, res) => {
  try {
    const config = await getGuildConfig(req.params.guildId);
    const idx = (config.ticketPanels || []).findIndex(p => p.id === req.params.panelId);
    if (idx === -1) return res.status(404).json({ error: "Panel no encontrado." });

    const panel = config.ticketPanels[idx];
    if (req.body.embed) {
      panel.embed = {
        title: req.body.embed.title || panel.embed.title,
        description: req.body.embed.description || panel.embed.description,
        color: req.body.embed.color || panel.embed.color,
        fields: req.body.embed.fields || panel.embed.fields,
        imageUrl: req.body.embed.imageUrl || panel.embed.imageUrl || "",
        thumbnailUrl: req.body.embed.thumbnailUrl || panel.embed.thumbnailUrl || "",
        footer: req.body.embed.footer || panel.embed.footer || ""
      };
    }
    if (req.body.buttons) {
      panel.buttons = req.body.buttons;
    }
    if (req.body.channelId !== undefined) {
      panel.channelId = req.body.channelId;
    }

    const saved = await setGuildConfig(req.params.guildId, config);
    const savedPanel = saved.ticketPanels?.find(p => p.id === panel.id);
    res.json(savedPanel || panel);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No se pudo actualizar el panel." });
  }
});

app.delete("/api/guilds/:guildId/ticket-panels/:panelId", requireAuth, async (req, res) => {
  try {
    const config = await getGuildConfig(req.params.guildId);
    config.ticketPanels = (config.ticketPanels || []).filter(p => p.id !== req.params.panelId);
    await setGuildConfig(req.params.guildId, config);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No se pudo eliminar el panel." });
  }
});

app.post("/api/guilds/:guildId/ticket-panels/:panelId/send", requireAuth, async (req, res) => {
  try {
    const token = process.env.DISCORD_TOKEN;
    if (!token) return res.status(500).json({ error: "Falta el token del bot." });

    const config = await getGuildConfig(req.params.guildId);
    const panel = (config.ticketPanels || []).find(p => p.id === req.params.panelId);
    if (!panel) return res.status(404).json({ error: "Panel no encontrado." });
    if (!panel.channelId) return res.status(400).json({ error: "El panel no tiene un canal asignado." });

    const embedPayload = {
      title: panel.embed.title?.slice(0, 256) || "Sistema de Tickets",
      description: panel.embed.description?.slice(0, 4096) || "",
      color: parseInt(panel.embed.color?.replace("#", "") || "8b5cf6", 16),
      timestamp: new Date().toISOString(),
      footer: { text: panel.embed.footer || "by wesjed" }
    };

    if (panel.embed.imageUrl) embedPayload.image = { url: panel.embed.imageUrl };
    if (panel.embed.thumbnailUrl) embedPayload.thumbnail = { url: panel.embed.thumbnailUrl };
    if (panel.embed.fields?.length) {
      embedPayload.fields = panel.embed.fields.map(f => ({
        name: String(f.name || "").slice(0, 256),
        value: String(f.value || "").slice(0, 1024),
        inline: Boolean(f.inline)
      }));
    }

    // Build action rows with buttons (max 5 per row)
    const components = [];
    const buttons = panel.buttons || [];
    const hasValidButtons = buttons.some(b => b && b.label && b.label.trim());
    if (!hasValidButtons) {
      return res.status(400).json({ error: "El panel no tiene botones válidos. Añade al menos un botón con etiqueta." });
    }
    let row = { type: 1, components: [] };
    let count = 0;
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      if (!btn || !btn.label || !btn.label.trim()) continue;
      // tp_<categoryId>_<supportRoleId> — self-contained, no DB needed
      const catId = btn.categoryId || "";
      const supId = btn.supportRoleId || "";
      const customId = supId ? `tp_${catId}_${supId}` : `tp_${catId}`;
      const component = {
        type: 2,
        style: 3,
        label: btn.label.trim().slice(0, 80),
        custom_id: customId
      };
      if (btn.emoji && btn.emoji.trim()) {
        const e = btn.emoji.trim();
        component.emoji = e.match(/^<a?:.+?:\d+>$/) ? { name: e } : { name: e };
      }
      row.components.push(component);
      count++;
      if (count % 5 === 0) {
        components.push(row);
        row = { type: 1, components: [] };
      }
    }
    if (row.components.length > 0) components.push(row);

    let isUpdate = !!(panel.messageId && panel.channelId);
    if (isUpdate) {
      const checkRes = await fetch(`https://discord.com/api/v10/channels/${panel.channelId}/messages/${panel.messageId}`, {
        headers: { Authorization: `Bot ${token}` }
      });
      if (!checkRes.ok) {
        panel.messageId = "";
        isUpdate = false;
      }
    }
    const url = `https://discord.com/api/v10/channels/${panel.channelId}/messages${isUpdate ? `/${panel.messageId}` : ""}`;
    const msgRes = await fetch(url, {
      method: isUpdate ? "PATCH" : "POST",
      headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embedPayload], components })
    });

    if (!msgRes.ok) {
      const errText = await msgRes.text().catch(() => "");
      throw new Error(`Error al ${isUpdate ? "actualizar" : "enviar"} mensaje (${msgRes.status}): ${errText}`);
    }

    const msg = await msgRes.json();
    panel.messageId = msg.id;

    const saved = await setGuildConfig(req.params.guildId, config);
    const savedPanel = saved.ticketPanels?.find(p => p.id === panel.id);
    res.json(savedPanel || panel);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: `No se pudo enviar el panel: ${error.message}` });
  }
});

app.get("/api/guilds/:guildId/config", requireAuth, async (req, res) => {
  try {
    res.json(await getGuildConfig(req.params.guildId));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No se pudo cargar la configuracion del servidor." });
  }
});

app.put("/api/guilds/:guildId/config", requireAuth, async (req, res) => {
  try {
    const guildConfig = await getGuildConfig(req.params.guildId);
    const incoming = req.body || {};

    // Logs & General
    guildConfig.logChannelId = String(incoming.logChannelId || "").trim();
    guildConfig.mutedRoleId = String(incoming.mutedRoleId || "").trim();

    guildConfig.logEvents = {
      ...structuredClone(defaultGuildConfig.logEvents),
      ...(guildConfig.logEvents || {}),
      messageDelete: Boolean(incoming.logEvents?.messageDelete),
      messageUpdate: Boolean(incoming.logEvents?.messageUpdate),
      guildBanAdd: Boolean(incoming.logEvents?.guildBanAdd),
      guildBanRemove: Boolean(incoming.logEvents?.guildBanRemove),
      kick: Boolean(incoming.logEvents?.kick),
      timeout: Boolean(incoming.logEvents?.timeout),
      guildMemberAdd: Boolean(incoming.logEvents?.guildMemberAdd),
      guildMemberRemove: Boolean(incoming.logEvents?.guildMemberRemove)
    };

    // Automod
    guildConfig.autoMod.blockInvites = Boolean(incoming.autoMod?.blockInvites);
    guildConfig.autoMod.blockLinks = Boolean(incoming.autoMod?.blockLinks);
    guildConfig.autoMod.blockBadWords = Boolean(incoming.autoMod?.blockBadWords);
    guildConfig.autoMod.blockMassMentions = Boolean(incoming.autoMod?.blockMassMentions);
    guildConfig.autoMod.blockSpam = Boolean(incoming.autoMod?.blockSpam);
    guildConfig.autoMod.blockCaps = Boolean(incoming.autoMod?.blockCaps);
    guildConfig.autoMod.maxMentions = Math.max(1, Math.min(25, Number(incoming.autoMod?.maxMentions || 5)));
    guildConfig.autoMod.maxCapsPercent = Math.max(30, Math.min(100, Number(incoming.autoMod?.maxCapsPercent || 75)));
    guildConfig.autoMod.minCapsLen = Math.max(1, Math.min(100, Number(incoming.autoMod?.minCapsLen || 12)));
    guildConfig.autoMod.spamMaxMessages = Math.max(2, Math.min(50, Number(incoming.autoMod?.spamMaxMessages || 6)));
    guildConfig.autoMod.spamWindowMs = Math.max(1000, Math.min(60000, Number(incoming.autoMod?.spamWindowMs || 8000)));

    guildConfig.autoMod.badWords = String(incoming.autoMod?.badWordsText || "")
      .split(/[,\n]/)
      .map(word => word.trim().toLowerCase())
      .filter(Boolean)
      .filter((word, index, list) => list.indexOf(word) === index)
      .sort();

    // Punishments
    guildConfig.punishments.warnsForTimeout = Math.max(1, Math.min(20, Number(incoming.punishments?.warnsForTimeout || 3)));
    guildConfig.punishments.timeoutMinutes = Math.max(1, Math.min(40320, Number(incoming.punishments?.timeoutMinutes || 60)));
    guildConfig.punishments.warnsForKick = Math.max(1, Math.min(50, Number(incoming.punishments?.warnsForKick || 5)));

    // Invited by
    if (incoming.invitedBy) guildConfig.invitedBy = String(incoming.invitedBy);

    // Punishment Warns (castigos por cantidad de warns)
    guildConfig.punishmentWarns = Array.isArray(incoming.punishmentWarns) ? incoming.punishmentWarns.map(p => ({
      warns: Math.max(1, Math.min(50, Number(p.warns) || 1)),
      action: ["timeout", "kick", "ban"].includes(p.action) ? p.action : "timeout",
      duration: p.action === "timeout" ? (Number(p.duration) || 60) : null
    })).sort((a, b) => a.warns - b.warns) : [];

    // Welcome & Farewell
    guildConfig.welcome = {
      channelId: String(incoming.welcome?.channelId || "").trim(),
      embedEnabled: Boolean(incoming.welcome?.embedEnabled),
      title: String(incoming.welcome?.title || defaultGuildConfig.welcome.title).trim(),
      description: String(incoming.welcome?.description || "").trim(),
      color: String(incoming.welcome?.color || "#8b5cf6").trim(),
      thumbnail: Boolean(incoming.welcome?.thumbnail)
    };

    guildConfig.farewell = {
      channelId: String(incoming.farewell?.channelId || "").trim(),
      embedEnabled: Boolean(incoming.farewell?.embedEnabled),
      title: String(incoming.farewell?.title || defaultGuildConfig.farewell.title).trim(),
      description: String(incoming.farewell?.description || "").trim(),
      color: String(incoming.farewell?.color || "#ef4444").trim(),
      thumbnail: Boolean(incoming.farewell?.thumbnail)
    };

    // Antinuke
    guildConfig.antiNuke = {
      enabled: Boolean(incoming.antiNuke?.enabled),
      maxChannelDeletes: Math.max(1, Math.min(20, Number(incoming.antiNuke?.maxChannelDeletes || 3))),
      maxRoleDeletes: Math.max(1, Math.min(20, Number(incoming.antiNuke?.maxRoleDeletes || 3))),
      maxBans: Math.max(1, Math.min(20, Number(incoming.antiNuke?.maxBans || 3)))
    };

    // Invite Logger
    guildConfig.inviteLogger = {
      enabled: Boolean(incoming.inviteLogger?.enabled),
      channelId: String(incoming.inviteLogger?.channelId || "").trim(),
      embedEnabled: Boolean(incoming.inviteLogger?.embedEnabled),
      title: String(incoming.inviteLogger?.title || defaultGuildConfig.inviteLogger.title).trim(),
      description: String(incoming.inviteLogger?.description || "").trim(),
      color: String(incoming.inviteLogger?.color || "#8b5cf6").trim()
    };

    // Boost Logger
    guildConfig.boostLogger = {
      enabled: Boolean(incoming.boostLogger?.enabled),
      channelId: String(incoming.boostLogger?.channelId || "").trim(),
      embedEnabled: Boolean(incoming.boostLogger?.embedEnabled),
      title: String(incoming.boostLogger?.title || defaultGuildConfig.boostLogger.title).trim(),
      description: String(incoming.boostLogger?.description || "").trim(),
      color: String(incoming.boostLogger?.color || "#f97316").trim()
    };

    // Level System
    guildConfig.levelSystem = {
      enabled: Boolean(incoming.levelSystem?.enabled),
      channelId: String(incoming.levelSystem?.channelId || "").trim(),
      embedEnabled: Boolean(incoming.levelSystem?.embedEnabled),
      title: String(incoming.levelSystem?.title || defaultGuildConfig.levelSystem.title).trim(),
      description: String(incoming.levelSystem?.description || "").trim(),
      color: String(incoming.levelSystem?.color || "#8b5cf6").trim(),
      xpPerMessage: Math.max(1, Math.min(100, Number(incoming.levelSystem?.xpPerMessage || 20))),
      cooldown: Math.max(10, Math.min(300, Number(incoming.levelSystem?.cooldown || 60)))
    };

    res.json(await setGuildConfig(req.params.guildId, guildConfig));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No se pudo guardar la configuracion del servidor." });
  }
});

app.get("/api/admin/bot/guilds", requireAuth, requireOwner, async (req, res) => {
  const now = Date.now();
  if (detailedBotGuildsCache && (now - detailedBotGuildsCacheTime < 300000)) { // 5 minutos de caché
    return res.json(detailedBotGuildsCache);
  }

  try {
    const token = process.env.DISCORD_TOKEN;
    if (!token) return res.status(500).json({ error: "Falta el token del bot." });

    const guildsResponse = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: {
        Authorization: `Bot ${token}`
      }
    });

    if (!guildsResponse.ok) {
      if (guildsResponse.status === 429 && detailedBotGuildsCache) {
        return res.json(detailedBotGuildsCache);
      }
      throw new Error(`Failed to fetch bot guilds: ${guildsResponse.status}`);
    }

    const guilds = await guildsResponse.json();
    const detailedGuilds = [];

    for (const guild of guilds) {
      try {
        const guildRes = await fetch(`https://discord.com/api/v10/guilds/${guild.id}`, {
          headers: {
            Authorization: `Bot ${token}`
          }
        });
        if (!guildRes.ok) continue;
        const detailed = await guildRes.json();

        const ownerRes = await fetch(`https://discord.com/api/v10/users/${detailed.owner_id}`, {
          headers: {
            Authorization: `Bot ${token}`
          }
        });
        if (!ownerRes.ok) continue;
        const owner = await ownerRes.json();

        detailedGuilds.push({
          id: guild.id,
          name: guild.name,
          icon: guild.icon,
          owner: {
            id: owner.id,
            username: owner.username,
            globalName: owner.global_name,
            avatar: owner.avatar
          }
        });
      } catch (err) {
        console.error(`Error querying guild ${guild.id}:`, err);
        detailedGuilds.push({
          id: guild.id,
          name: guild.name,
          icon: guild.icon,
          owner: null
        });
      }
    }

    detailedBotGuildsCache = detailedGuilds;
    detailedBotGuildsCacheTime = now;
    res.json(detailedGuilds);
  } catch (error) {
    console.error(error);
    if (detailedBotGuildsCache) {
      return res.json(detailedBotGuildsCache);
    }
    res.status(500).json({ error: "No se pudieron cargar los servidores del bot." });
  }
});

app.get("/wbot", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

export { app, defaultGuildConfig, IS_COMBINED, getGuildConfig, setGuildConfig, ensureMongo };
export function startServer(port) {
  console.log(`REDIRECT_URI: ${REDIRECT_URI}`);
  console.log(`PUBLIC_URL: ${process.env.PUBLIC_URL}`);
  console.log(`SESSION_SECRET set: ${Boolean(SESSION_SECRET)}`);
  const srv = app.listen(port, '0.0.0.0', () => {
    console.log(`✓ Server listening on 0.0.0.0:${port}`);
  });
  srv.on("error", error => {
    if (error.code === "EADDRINUSE") {
      console.error(`El puerto ${port} ya esta en uso.`);
      process.exit(1);
    }
    console.error(error);
    process.exit(1);
  });
  return srv;
}

const isWebMain = process.argv[1]?.replace(/\\/g, '/').endsWith('web.js');
if (isWebMain && !IS_COMBINED) {
  console.log(`PORT from env: ${process.env.WEB_PORT}, PORT from process.env.PORT: ${process.env.PORT}, Final PORT: ${PORT}`);
  startServer(PORT);
}
