// Default guild configuration
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
  },
  twitch: {
    enabled: false,
    linkedAccounts: [],
    channelId: "",
    roleToPing: "",
    message: "",
    embedEnabled: true,
    title: "🔴 {streamer} está en vivo!",
    description: "**{streamer}** ha empezado a streamear en Twitch!\n\n🎮 **Juego:** {game}\n📺 **Título:** {title}\n👀 **Míralo en:** https://twitch.tv/{streamer}",
    color: "#9146FF",
    showTimestamp: true,
    showImage: true
  }
};

module.exports = { defaultGuildConfig };
