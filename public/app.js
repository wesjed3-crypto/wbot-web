const state = {
  guilds: [],
  selectedGuild: null,
  isOwner: false,
  revealObserver: null,
  botGuilds: [] // Almacena todos los servidores del bot para el buscador interactivo
};

function initInteractiveSnow() {
  const hero = document.querySelector(".hero");
  let canvas = document.getElementById("snowflakeCanvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "snowflakeCanvas";
    canvas.setAttribute("aria-hidden", "true");
  }
  if (hero && canvas.parentElement !== hero) hero.prepend(canvas);
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  document.documentElement.dataset.snow = "ready";
  const pointer = {
    x: -9999,
    y: -9999,
    active: false
  };
  const flakes = [];
  let width = 0;
  let height = 0;
  let animationFrame = null;

  function flakeCount() {
    return Math.min(180, Math.max(90, Math.floor((width * height) / 11000)));
  }

  function createFlake(resetY = false) {
    const radius = Math.random() * 3.2 + 1.1;
    return {
      x: Math.random() * width,
      y: resetY ? -radius - Math.random() * 80 : Math.random() * height,
      radius,
      speed: Math.random() * .55 + .22,
      drift: Math.random() * .6 - .3,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: Math.random() * .018 + .006,
      opacity: Math.random() * .55 + .45
    };
  }

  function resizeSnow() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const bounds = (hero || document.body).getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const target = flakeCount();
    while (flakes.length < target) flakes.push(createFlake());
    while (flakes.length > target) flakes.pop();
  }

  function drawSnow() {
    ctx.clearRect(0, 0, width, height);

    for (const flake of flakes) {
      const dx = flake.x - pointer.x;
      const dy = flake.y - pointer.y;
      const distance = Math.hypot(dx, dy);

      if (pointer.active && distance < 120) {
        const force = (120 - distance) / 120;
        const angle = Math.atan2(dy, dx);
        flake.x += Math.cos(angle) * force * 2.2;
        flake.y += Math.sin(angle) * force * 1.35;
      }

      flake.wobble += flake.wobbleSpeed;
      flake.x += flake.drift + Math.sin(flake.wobble) * .22;
      flake.y += flake.speed;

      if (flake.y > height + flake.radius) {
        Object.assign(flake, createFlake(true));
      }
      if (flake.x < -20) flake.x = width + 20;
      if (flake.x > width + 20) flake.x = -20;

      ctx.beginPath();
      ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${flake.opacity})`;
      ctx.shadowColor = "rgba(139, 92, 246, .35)";
      ctx.shadowBlur = flake.radius * 3;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    animationFrame = requestAnimationFrame(drawSnow);
  }

  function startSnow() {
    cancelAnimationFrame(animationFrame);
    drawSnow();
  }

  window.addEventListener("resize", resizeSnow);
  window.addEventListener("mousemove", event => {
    const bounds = canvas.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
    pointer.active = true;
  });
  window.addEventListener("mouseleave", () => {
    pointer.active = false;
    pointer.x = -9999;
    pointer.y = -9999;
  });
  window.addEventListener("touchmove", event => {
    const touch = event.touches[0];
    if (!touch) return;
    const bounds = canvas.getBoundingClientRect();
    pointer.x = touch.clientX - bounds.left;
    pointer.y = touch.clientY - bounds.top;
    pointer.active = true;
  }, { passive: true });
  window.addEventListener("touchend", () => {
    pointer.active = false;
  });
  resizeSnow();
  startSnow();
}

function initMotionEffects() {
  const hero = document.querySelector(".hero");

  if (hero && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    hero.addEventListener("pointermove", event => {
      const bounds = hero.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 28;
      const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 20;
      hero.style.setProperty("--hero-parallax-x", `${x}px`);
      hero.style.setProperty("--hero-parallax-y", `${y}px`);
    });

    hero.addEventListener("pointerleave", () => {
      hero.style.setProperty("--hero-parallax-x", "0px");
      hero.style.setProperty("--hero-parallax-y", "0px");
    });
  }

  refreshScrollReveal();
}

function refreshScrollReveal() {
  if (state.revealObserver) {
    state.revealObserver.disconnect();
    state.revealObserver = null;
  }

  const revealTargets = [
    ...document.querySelectorAll(".features .section-heading, .feature-card, .owner-panel, .dashboard-section .section-heading, .dashboard-section .session-row, .server-selector-container, .panel")
  ].filter(element => !element.closest(".hidden") && !element.classList.contains("hidden"));

  revealTargets.forEach((element, index) => {
    element.classList.add("reveal-on-scroll");
    element.classList.remove("in-view");
    element.style.setProperty("--reveal-delay", `${Math.min(index % 6, 5) * 70}ms`);
  });

  if (!("IntersectionObserver" in window)) {
    revealTargets.forEach(element => element.classList.add("in-view"));
    return;
  }

  state.revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        state.revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.18,
    rootMargin: "0px 0px -14% 0px"
  });

  requestAnimationFrame(() => {
    revealTargets.forEach(element => state.revealObserver.observe(element));
  });
}

const elements = {
  brandName: document.querySelector("#brandName"),
  userName: document.querySelector("#userName"),
  loginButton: document.querySelector("#loginButton"),
  heroLoginButton: document.querySelector("#heroLoginButton"),
  logoutLink: document.querySelector("#logoutLink"),
  inviteButton: document.querySelector("#inviteButton"),
  ownerPanel: document.querySelector("#ownerPanel"),
  botState: document.querySelector("#botState"),
  guildList: document.querySelector("#guildList"),
  notice: document.querySelector("#notice"),
  configForm: document.querySelector("#configForm"),
  selectedGuild: document.querySelector("#selectedGuild"),
  selectedGuildIcon: document.querySelector("#selectedGuildIcon"),
  saveConfigBtn: document.querySelector("#saveConfigBtn"),
  botGuildsConsoleSection: document.querySelector("#botGuildsConsoleSection"),
  botGuildsList: document.querySelector("#botGuildsList"),
  botGuildsSearch: document.querySelector("#botGuildsSearch"),
  backToOwnerBtn: document.querySelector("#backToOwnerBtn"),
  toggleBotGuildsBtn: document.querySelector("#toggleBotGuildsBtn")
};

// Conector API principal
async function api(path, options = {}) {
  let response;

  try {
    response = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...options
    });
  } catch {
    throw new Error("No se pudo conectar con la web. Comprueba que `npm run web` sigue abierto.");
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Error de la API");
  }

  return response.json();
}

// Alertas secundarias del formulario
function setNotice(message, type = "info") {
  elements.notice.textContent = message;
  elements.notice.style.borderColor = type === "error" ? "var(--danger)" : "var(--border)";
  elements.notice.style.color = type === "error" ? "var(--danger)" : "var(--text-muted)";
}

// Ventanas emergentes elegantes (Toast)
function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  
  const toast = document.createElement("div");
  toast.className = `toast-message ${type === "error" ? "error" : ""}`;
  
  const icon = type === "success" ? "✅" : "❌";
  toast.innerHTML = `<span class="toast-icon">${icon}</span> <span class="toast-text">${message}</span>`;
  
  container.appendChild(toast);
  
  // Forzar reflujo para activar animación CSS
  setTimeout(() => {
    toast.classList.add("show");
  }, 10);
  
  // Desvanecer y retirar a los 3 segundos
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 3000);
}

// Estado del Bot
function setBotState(bot) {
  if (!elements.botState) return;
  const running = Boolean(bot?.running);
  if (bot?.combined) {
    elements.botState.textContent = "Estado: activo (Railway) · PID " + bot.pid;
    elements.botState.classList.add("online");
    document.querySelectorAll("[data-bot-action=stop]").forEach(b => b.disabled = true);
    return;
  }
  elements.botState.textContent = running
    ? `Estado: encendido${bot.pid ? ` · PID ${bot.pid}` : ""}`
    : "Estado: apagado";
  if (running) {
    elements.botState.classList.add("online");
  } else {
    elements.botState.classList.remove("online");
  }
}

// Ver Logs del Bot
async function loadBotLogs() {
  try {
    const data = await api("/api/admin/bot/logs");
    const logsEl = document.querySelector("#botLogs");
    if (logsEl) logsEl.textContent = data.log || "(sin logs)";
  } catch {
    const logsEl = document.querySelector("#botLogs");
    if (logsEl) logsEl.textContent = "(no se pudieron cargar los logs)";
  }
}

// Ejecutar Acciones del Bot (Iniciar/Parar/Reiniciar)
async function runBotAction(action) {
  setNotice("Ejecutando accion del bot...");

  try {
    const result = await api(`/api/admin/bot/${action}`, { method: "POST" });
    setBotState(result.bot);
    if (result.error) {
      setNotice(result.error, "error");
      showToast(result.error, "error");
      loadBotLogs();
    } else {
      setNotice(result.message || "Accion completada.");
      if (action === "restart") {
        showToast("Reiniciando contenedor...");
      } else {
        showToast(`Acción del bot "${action}" ejecutada.`);
      }
    }
  } catch (error) {
    setNotice(error.message, "error");
    showToast(error.message, "error");
    loadBotLogs();
  }
}

// Renderizado de Servidores en el Selector (Diseño Premium con Fotos)
function renderGuilds() {
  elements.guildList.innerHTML = "";

  state.guilds.forEach(guild => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `guild-card-btn${state.selectedGuild?.id === guild.id ? " active" : ""}`;
    
    const iconUrl = guild.icon 
      ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
      : "";
    const iconHTML = iconUrl
      ? `<img class="guild-card-btn-icon" src="${iconUrl}" alt="${guild.name}">`
      : `<div class="guild-card-btn-icon-placeholder">${guild.name[0] || "?"}</div>`;
      
    card.innerHTML = `
      ${iconHTML}
      <div class="guild-card-btn-info">
        <span class="guild-card-btn-name">${guild.name}</span>
        <span class="guild-card-btn-meta">${guild.owner ? "👑 Creador" : "🛠️ Admin"}</span>
      </div>
    `;
    
    card.addEventListener("click", () => selectGuild(guild, "user"));
    elements.guildList.append(card);
  });
}

// Poblar un select con opciones
function populateSelect(selectEl, options, selectedValue) {
  if (!selectEl) return;
  const currentValue = selectEl.value;
  selectEl.innerHTML = '<option value="">Seleccionar...</option>';
  options.forEach(opt => {
    const option = document.createElement("option");
    option.value = opt.id;
    option.textContent = `#${opt.name}`;
    selectEl.appendChild(option);
  });
  selectEl.value = selectedValue || currentValue || "";
}

// Poblar un select de roles
function populateRoleSelect(selectEl, options, selectedValue) {
  if (!selectEl) return;
  const currentValue = selectEl.value;
  selectEl.innerHTML = '<option value="">Seleccionar...</option>';
  options.forEach(opt => {
    const option = document.createElement("option");
    option.value = opt.id;
    option.textContent = `@${opt.name}`;
    selectEl.appendChild(option);
  });
  selectEl.value = selectedValue || currentValue || "";
}

let channelsCache = {};
let rolesCache = {};

async function loadGuildChannelsAndRoles(guildId) {
  try {
    const [channelData, roleData] = await Promise.all([
      api(`/api/guilds/${guildId}/channels`),
      api(`/api/guilds/${guildId}/roles`)
    ]);
    channelsCache[guildId] = channelData;
    rolesCache[guildId] = roleData;

    const form = elements.configForm;
    populateSelect(form.logChannelId, channelData.textChannels);
    populateSelect(form.welcomeChannelId, channelData.textChannels);
    populateSelect(form.farewellChannelId, channelData.textChannels);
    populateRoleSelect(form.mutedRoleId, roleData);
  } catch (error) {
    console.error("Error loading channels/roles:", error);
    showToast(error.message || "No se pudieron cargar canales/roles. ¿Token inválido?", "error");
  }
}

// Rellenar Campos del Formulario
function fillForm(config) {
  const form = elements.configForm;
  
  // General & Logs
  form.logChannelId.value = config.logChannelId || "";
  form.mutedRoleId.value = config.mutedRoleId || "";
  
  form.logMessageDelete.checked = Boolean(config.logEvents?.messageDelete);
  form.logMessageUpdate.checked = Boolean(config.logEvents?.messageUpdate);
  form.logGuildBanAdd.checked = Boolean(config.logEvents?.guildBanAdd);
  form.logGuildBanRemove.checked = Boolean(config.logEvents?.guildBanRemove);
  form.logKick.checked = Boolean(config.logEvents?.kick);
  form.logTimeout.checked = Boolean(config.logEvents?.timeout);
  form.logGuildMemberAdd.checked = Boolean(config.logEvents?.guildMemberAdd);
  form.logGuildMemberRemove.checked = Boolean(config.logEvents?.guildMemberRemove);

  // Automod
  form.blockInvites.checked = Boolean(config.autoMod.blockInvites);
  form.blockLinks.checked = Boolean(config.autoMod.blockLinks);
  form.blockBadWords.checked = Boolean(config.autoMod.blockBadWords);
  form.blockMassMentions.checked = Boolean(config.autoMod.blockMassMentions);
  form.blockSpam.checked = Boolean(config.autoMod.blockSpam);
  form.blockCaps.checked = Boolean(config.autoMod.blockCaps);
  
  form.minCapsLen.value = config.autoMod.minCapsLen || 12;
  form.spamMaxMessages.value = config.autoMod.spamMaxMessages || 6;
  form.spamWindowMs.value = config.autoMod.spamWindowMs || 8000;
  form.maxMentions.value = config.autoMod.maxMentions;
  form.maxCapsPercent.value = config.autoMod.maxCapsPercent;

  // Sanciones
  form.warnsForTimeout.value = config.punishments.warnsForTimeout;
  form.timeoutMinutes.value = config.punishments.timeoutMinutes;
  form.warnsForKick.value = config.punishments.warnsForKick;
  
  form.badWordsText.value = (config.autoMod.badWords || []).join("\n");

  // Bienvenidas
  form.welcomeChannelId.value = config.welcome?.channelId || "";
  form.welcomeEmbedEnabled.checked = Boolean(config.welcome?.embedEnabled);
  form.welcomeTitle.value = config.welcome?.title || "";
  form.welcomeDescription.value = config.welcome?.description || "";
  form.welcomeColor.value = config.welcome?.color || "#8b5cf6";
  form.welcomeThumbnail.checked = Boolean(config.welcome?.thumbnail);

  // Despedidas
  form.farewellChannelId.value = config.farewell?.channelId || "";
  form.farewellEmbedEnabled.checked = Boolean(config.farewell?.embedEnabled);
  form.farewellTitle.value = config.farewell?.title || "";
  form.farewellDescription.value = config.farewell?.description || "";
  form.farewellColor.value = config.farewell?.color || "#ef4444";
  form.farewellThumbnail.checked = Boolean(config.farewell?.thumbnail);

  // Antinuke
  form.antiNukeEnabled.checked = Boolean(config.antiNuke?.enabled);
  form.antiNukeMaxChannelDeletes.value = config.antiNuke?.maxChannelDeletes || 3;
  form.antiNukeMaxRoleDeletes.value = config.antiNuke?.maxRoleDeletes || 3;
  form.antiNukeMaxBans.value = config.antiNuke?.maxBans || 3;

  // Castigos por Warns
  window._punishmentWarnsCache = (config.punishmentWarns || []).map(p => ({ ...p }));
  renderPunishmentWarnsTable(window._punishmentWarnsCache);
}

function renderPunishmentWarnsTable(list) {
  const tbody = document.getElementById("punishmentWarnsTable");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!list || list.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="4" style="padding:16px;text-align:center;color:#94a3b8;">No hay castigos configurados.</td>';
    tbody.appendChild(tr);
    return;
  }
  const actionLabels = { timeout: "⏳ Timeout", kick: "👢 Expulsar", ban: "🔨 Banear" };
  list.forEach((p, i) => {
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #1e293b";
    tr.innerHTML = `
      <td style="padding:8px 4px;">${p.warns}</td>
      <td style="padding:8px 4px;">${actionLabels[p.action] || p.action}</td>
      <td style="padding:8px 4px;">${p.action === "timeout" ? (p.duration || 60) + " min" : "—"}</td>
      <td style="padding:8px 4px;"><button type="button" class="btn" data-remove-pw="${i}" style="background:#dc2626;font-size:12px;padding:2px 8px;">✕</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// Cambiar de Pestaña de Configuración
function switchTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
  document.querySelectorAll(".tab-content").forEach(content => {
    content.classList.toggle("hidden", content.id !== tabId);
  });
}

// Salir del Modo Consola (Volver a la vista principal)
function exitConsoleMode() {
  state.selectedGuild = null;
  renderGuilds();
  
  // Ocultar consolas
  elements.configForm.classList.add("hidden");
  
  if (state.consoleSource === "owner") {
    elements.botGuildsConsoleSection?.classList.remove("hidden");
  } else {
    elements.botGuildsConsoleSection?.classList.add("hidden");
    // Restaurar secciones principales
    document.querySelector("#home")?.classList.remove("hidden");
    document.querySelector("#features")?.classList.remove("hidden");
    document.querySelector(".session-row")?.classList.remove("hidden");
    document.querySelector("#serverSelectorContainer")?.classList.remove("hidden");
    document.querySelector(".section-heading.compact")?.classList.remove("hidden");
    
    if (state.isOwner) {
      document.querySelector("#ownerPanel")?.classList.remove("hidden");
    }
  }
  
  setNotice(state.guilds.length ? "Elige un servidor para configurarlo." : "No se encontraron servidores con wbot. ¡Invítalo primero con el botón de arriba!");
}

// Seleccionar Servidor y entrar en Modo Consola
async function selectGuild(guild, source = "user") {
  state.selectedGuild = guild;
  state.consoleSource = source; // Almacenar el origen
  renderGuilds();
  
  // Renderizar la foto del servidor en la cabecera de la consola
  if (elements.selectedGuildIcon) {
    elements.selectedGuildIcon.innerHTML = "";
    if (guild.icon) {
      const img = document.createElement("img");
      img.className = "guild-console-icon";
      img.src = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`;
      img.alt = guild.name;
      elements.selectedGuildIcon.appendChild(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "guild-console-icon-placeholder";
      placeholder.textContent = guild.name[0] || "?";
      elements.selectedGuildIcon.appendChild(placeholder);
    }
  }
  
  elements.selectedGuild.textContent = guild.name;
  
  // Ocultar landing
  document.querySelector("#home")?.classList.add("hidden");
  document.querySelector("#features")?.classList.add("hidden");
  document.querySelector("#ownerPanel")?.classList.add("hidden");
  document.querySelector(".session-row")?.classList.add("hidden");
  document.querySelector("#serverSelectorContainer")?.classList.add("hidden");
  document.querySelector(".section-heading.compact")?.classList.add("hidden");
  elements.botGuildsConsoleSection?.classList.add("hidden");
  
  // Mostrar formulario de consola y pestaña por defecto
  elements.configForm.classList.remove("hidden");
  switchTab("tab-general");
  
  // Resetear el color del botón guardar cambios a verde (sin cambios)
  elements.saveConfigBtn?.classList.remove("changed");
  
  setNotice("Cargando configuracion...");
 
  try {
    const config = await api(`/api/guilds/${guild.id}/config`);
    await loadGuildChannelsAndRoles(guild.id);
    fillForm(config);
    setNotice("Configuracion cargada. Cambia lo que necesites y guarda.");
  } catch (error) {
    setNotice(error.message, "error");
  }
}

// Leer Contenidos del Formulario
function readForm() {
  const form = elements.configForm;
  return {
    logChannelId: form.logChannelId.value,
    mutedRoleId: form.mutedRoleId.value,
    logEvents: {
      messageDelete: form.logMessageDelete.checked,
      messageUpdate: form.logMessageUpdate.checked,
      guildBanAdd: form.logGuildBanAdd.checked,
      guildBanRemove: form.logGuildBanRemove.checked,
      kick: form.logKick.checked,
      timeout: form.logTimeout.checked,
      guildMemberAdd: form.logGuildMemberAdd.checked,
      guildMemberRemove: form.logGuildMemberRemove.checked
    },
    autoMod: {
      blockInvites: form.blockInvites.checked,
      blockLinks: form.blockLinks.checked,
      blockBadWords: form.blockBadWords.checked,
      blockMassMentions: form.blockMassMentions.checked,
      blockSpam: form.blockSpam.checked,
      blockCaps: form.blockCaps.checked,
      maxMentions: Number(form.maxMentions.value),
      maxCapsPercent: Number(form.maxCapsPercent.value),
      minCapsLen: Number(form.minCapsLen.value),
      spamMaxMessages: Number(form.spamMaxMessages.value),
      spamWindowMs: Number(form.spamWindowMs.value),
      badWordsText: form.badWordsText.value
    },
    punishments: {
      warnsForTimeout: Number(form.warnsForTimeout.value),
      timeoutMinutes: Number(form.timeoutMinutes.value),
      warnsForKick: Number(form.warnsForKick.value)
    },
    welcome: {
      channelId: form.welcomeChannelId.value,
      embedEnabled: form.welcomeEmbedEnabled.checked,
      title: form.welcomeTitle.value,
      description: form.welcomeDescription.value,
      color: form.welcomeColor.value,
      thumbnail: form.welcomeThumbnail.checked
    },
    farewell: {
      channelId: form.farewellChannelId.value,
      embedEnabled: form.farewellEmbedEnabled.checked,
      title: form.farewellTitle.value,
      description: form.farewellDescription.value,
      color: form.farewellColor.value,
      thumbnail: form.farewellThumbnail.checked
    },
    antiNuke: {
      enabled: form.antiNukeEnabled.checked,
      maxChannelDeletes: Number(form.antiNukeMaxChannelDeletes.value),
      maxRoleDeletes: Number(form.antiNukeMaxRoleDeletes.value),
      maxBans: Number(form.antiNukeMaxBans.value)
    },
    punishmentWarns: window._punishmentWarnsCache || []
  };
}

// Renderizado de Servidores en el panel del Owner
function renderBotGuilds(filteredList = null) {
  const listEl = elements.botGuildsList;
  if (!listEl) return;
  listEl.innerHTML = "";
  
  const guildsToRender = filteredList !== null ? filteredList : state.botGuilds;
  
  if (guildsToRender.length === 0) {
    listEl.innerHTML = `<p class='loading-text'>${filteredList !== null ? "No se encontraron servidores." : "El bot no está en ningún servidor."}</p>`;
    return;
  }
  
  guildsToRender.forEach(bg => {
    const card = document.createElement("div");
    card.className = "bot-guild-card";
    card.style.cursor = "pointer";
    
    const iconUrl = bg.icon 
      ? `https://cdn.discordapp.com/icons/${bg.id}/${bg.icon}.png`
      : "";
    const iconHTML = iconUrl
      ? `<img class="guild-card-icon" src="${iconUrl}" alt="${bg.name}">`
      : `<div class="guild-card-icon-placeholder">${bg.name[0] || "?"}</div>`;
      
    const ownerAvatar = bg.owner?.avatar
      ? `https://cdn.discordapp.com/avatars/${bg.owner.id}/${bg.owner.avatar}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png";
      
    card.innerHTML = `
      <div class="guild-card-header">
        ${iconHTML}
        <div class="guild-card-info">
          <h4>${bg.name}</h4>
          <span class="guild-card-id">ID: ${bg.id}</span>
        </div>
      </div>
      <div class="guild-card-owner">
        <span class="owner-label">Creador / Owner:</span>
        <div class="owner-user-wrap">
          <img class="owner-avatar" src="${ownerAvatar}" alt="${bg.owner?.username || 'Desconocido'}">
          <div class="owner-info">
            <strong class="owner-name">${bg.owner ? (bg.owner.globalName || bg.owner.username) : 'Desconocido'}</strong>
            <span class="owner-id">ID: ${bg.owner ? bg.owner.id : 'N/A'}</span>
          </div>
        </div>
      </div>
      <div class="guild-card-action" style="margin-top: auto; border-top: 1px solid var(--border); padding-top: 10px; display: flex; justify-content: flex-end;">
        <span style="font-size: 12px; font-weight: 700; color: var(--accent); display: flex; align-items: center; gap: 4px;">⚙️ Configurar panel →</span>
      </div>
    `;
    
    card.addEventListener("click", () => {
      selectGuild(bg, "owner");
    });
    
    listEl.append(card);
  });
}

// ============ REACTION ROLES ============

let reactionRolesCache = [];

function renderReactionPanels() {
  const listEl = document.querySelector("#reactionPanelsList");
  if (!listEl) return;

  if (reactionRolesCache.length === 0) {
    listEl.innerHTML = `<p style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 24px;">No hay paneles creados aún. Crea uno nuevo con el botón de abajo.</p>`;
    return;
  }

  listEl.innerHTML = "";
  reactionRolesCache.forEach((panel, idx) => {
    const card = document.createElement("div");
    card.className = "panel";
    card.style.marginBottom = "12px";

    const sent = panel.messageId && panel.channelId;
    const reactCount = panel.reactions?.length || 0;

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <strong style="font-size: 16px;">${panel.embed?.title || "Sin título"}</strong>
          <span style="display: block; font-size: 12px; color: var(--text-dim); margin-top: 4px;">
            ${sent ? `✅ Enviado · <code>#${panel.channelId}</code>` : "📝 Borrador"}
            · ${reactCount} reacción(es)
          </span>
        </div>
        <div style="display: flex; gap: 6px;">
          <button type="button" class="button secondary" data-edit-panel="${panel.id}" style="font-size: 12px; height: 32px; padding: 0 12px;">✏️</button>
          <button type="button" class="button danger" data-delete-panel="${panel.id}" style="font-size: 12px; height: 32px; padding: 0 12px;">🗑️</button>
        </div>
      </div>
      <div style="margin-top: 10px; display: flex; gap: 6px;">
        <select data-panel-channel="${panel.id}" style="flex: 1;">
          <option value="">Canal...</option>
        </select>
        <button type="button" class="button primary" data-send-panel="${panel.id}" style="font-size: 12px; height: 32px; padding: 0 12px;">${sent ? "🔄 Actualizar" : "📨 Enviar"}</button>
      </div>
    `;

    listEl.appendChild(card);

    // Populate channel select
    const channelSelect = card.querySelector(`[data-panel-channel="${panel.id}"]`);
    if (channelSelect && channelsCache[state.selectedGuild?.id]) {
      const chData = channelsCache[state.selectedGuild.id];
      const allChs = [...(chData.textChannels || [])];
      allChs.forEach(ch => {
        const opt = document.createElement("option");
        opt.value = ch.id;
        opt.textContent = `#${ch.name}`;
        channelSelect.appendChild(opt);
      });
      if (panel.channelId) channelSelect.value = panel.channelId;
    }

    // Event listeners
    card.querySelector(`[data-edit-panel="${panel.id}"]`)?.addEventListener("click", () => editReactionPanel(panel.id));
    card.querySelector(`[data-delete-panel="${panel.id}"]`)?.addEventListener("click", () => deleteReactionPanel(panel.id));
    card.querySelector(`[data-send-panel="${panel.id}"]`)?.addEventListener("click", () => sendReactionPanel(panel.id));
    channelSelect?.addEventListener("change", async () => {
      await updateReactionPanel(panel.id, { channelId: channelSelect.value });
      showToast("Canal guardado");
    });
  });
}

async function loadReactionPanels() {
  if (!state.selectedGuild) return;
  try {
    reactionRolesCache = await api(`/api/guilds/${state.selectedGuild.id}/reaction-roles`);
    renderReactionPanels();
  } catch (error) {
    showToast("Error al cargar paneles: " + error.message, "error");
  }
}

async function createReactionPanel() {
  if (!state.selectedGuild) return;
  const defaultPanel = {
    embed: {
      title: "Reaction Roles",
      description: "Reacciona para obtener un rol.",
      color: "#8b5cf6",
      fields: [],
      imageUrl: "",
      thumbnailUrl: "",
      footer: ""
    },
    reactions: []
  };
  try {
    const panel = await api(`/api/guilds/${state.selectedGuild.id}/reaction-roles`, {
      method: "POST",
      body: JSON.stringify(defaultPanel)
    });
    reactionRolesCache.push(panel);
    renderReactionPanels();
    editReactionPanel(panel.id);
    showToast("Panel creado");
  } catch (error) {
    showToast("Error: " + error.message, "error");
  }
}

async function deleteReactionPanel(panelId) {
  if (!state.selectedGuild || !confirm("¿Eliminar este panel?")) return;
  try {
    await api(`/api/guilds/${state.selectedGuild.id}/reaction-roles/${panelId}`, { method: "DELETE" });
    reactionRolesCache = reactionRolesCache.filter(p => p.id !== panelId);
    renderReactionPanels();
    showToast("Panel eliminado");
  } catch (error) {
    showToast("Error: " + error.message, "error");
  }
}

async function updateReactionPanel(panelId, data) {
  if (!state.selectedGuild) return;
  try {
    const updated = await api(`/api/guilds/${state.selectedGuild.id}/reaction-roles/${panelId}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
    const idx = reactionRolesCache.findIndex(p => p.id === panelId);
    if (idx !== -1) reactionRolesCache[idx] = updated;
    renderReactionPanels();
    return updated;
  } catch (error) {
    showToast("Error: " + error.message, "error");
    return null;
  }
}

async function sendReactionPanel(panelId) {
  if (!state.selectedGuild) return;
  try {
    const result = await api(`/api/guilds/${state.selectedGuild.id}/reaction-roles/${panelId}/send`, { method: "POST" });
    const idx = reactionRolesCache.findIndex(p => p.id === panelId);
    if (idx !== -1) reactionRolesCache[idx] = result;
    renderReactionPanels();
    showToast("Panel enviado al canal");
  } catch (error) {
    showToast("Error: " + error.message, "error");
  }
}

function editReactionPanel(panelId) {
  const panel = reactionRolesCache.find(p => p.id === panelId);
  if (!panel) return;

  const listEl = document.querySelector("#reactionPanelsList");
  if (!listEl) return;

  const formContainer = document.createElement("div");
  formContainer.className = "panel";
  formContainer.style.marginBottom = "12px";
  formContainer.style.borderColor = "var(--accent)";
  formContainer.id = `editor-${panelId}`;

  const embed = panel.embed || {};
  const reactions = panel.reactions || [];

  let fieldsHtml = "";
  (embed.fields || []).forEach((f, i) => {
    fieldsHtml += `
      <div class="rr-field-row" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: end;">
        <input data-field-name="${i}" value="${escHtml(f.name)}" placeholder="Nombre" style="flex: 2;">
        <input data-field-value="${i}" value="${escHtml(f.value)}" placeholder="Valor" style="flex: 3;">
        <label style="flex: 0; flex-direction: row; gap: 4px; margin: 0; white-space: nowrap; font-size: 11px;">
          <input type="checkbox" data-field-inline="${i}" ${f.inline ? "checked" : ""}> inline
        </label>
        <button type="button" class="button danger" data-remove-field="${i}" style="font-size: 12px; height: 32px; padding: 0 8px;">✕</button>
      </div>`;
  });

  let reactionsHtml = "";
  reactions.forEach((r, i) => {
    reactionsHtml += `
      <div class="rr-reaction-row" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: end;">
        <input data-rr-emoji="${i}" value="${escHtml(r.emoji)}" placeholder="Emoji (✅ o <:name:id>)" style="flex: 1;">
        <select data-rr-role="${i}" style="flex: 2;">
          <option value="">Rol...</option>
        </select>
        <button type="button" class="button danger" data-remove-rr="${i}" style="font-size: 12px; height: 32px; padding: 0 8px;">✕</button>
      </div>`;
  });

  formContainer.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <h3 style="margin: 0;">✏️ Editar Panel</h3>
      <div style="display: flex; gap: 6px;">
        <button type="button" class="button secondary" data-close-editor="${panelId}" style="font-size: 12px; height: 32px; padding: 0 12px;">← Volver</button>
        <button type="button" class="button primary" data-save-editor="${panelId}" style="font-size: 12px; height: 32px; padding: 0 12px;">💾 Guardar</button>
      </div>
    </div>
    <label>Título <input id="rr-title" value="${escHtml(embed.title || "")}"></label>
    <label>Descripción <textarea id="rr-desc" rows="3">${escHtml(embed.description || "")}</textarea></label>
    <label>Color (HEX) <input id="rr-color" value="${embed.color || "#8b5cf6"}" placeholder="#8b5cf6"></label>
    <label>URL de Imagen <input id="rr-image" value="${escHtml(embed.imageUrl || "")}" placeholder="https://..."></label>
    <label>URL de Thumbnail <input id="rr-thumb" value="${escHtml(embed.thumbnailUrl || "")}" placeholder="https://..."></label>
    <label>Footer <input id="rr-footer" value="${escHtml(embed.footer || "")}" placeholder="by wesjed"></label>

    <div style="margin-top: 16px;">
      <strong style="font-size: 14px;">📋 Fields</strong>
      <div id="rr-fields-list" style="margin-top: 8px;">${fieldsHtml}</div>
      <button type="button" class="button secondary" id="addFieldBtn" style="font-size: 12px; height: 32px; padding: 0 12px; margin-top: 8px;">➕ Añadir Field</button>
    </div>

    <div style="margin-top: 16px;">
      <strong style="font-size: 14px;">🎭 Reacciones</strong>
      <p style="font-size: 12px; color: var(--text-dim); margin: 4px 0 8px;">Emoji + Rol que se asignará al reaccionar.</p>
      <div id="rr-reactions-list" style="margin-top: 8px;">${reactionsHtml}</div>
      <button type="button" class="button secondary" id="addRrBtn" style="font-size: 12px; height: 32px; padding: 0 12px; margin-top: 8px;">➕ Añadir Reacción</button>
    </div>
  `;

  // Insert editor at top of list
  if (listEl.firstChild) {
    listEl.insertBefore(formContainer, listEl.firstChild);
  } else {
    listEl.appendChild(formContainer);
  }

  // Populate role selects in reactions
  const roleData = rolesCache[state.selectedGuild?.id] || [];
  formContainer.querySelectorAll("[data-rr-role]").forEach(sel => {
    const idx = parseInt(sel.dataset.rrRole);
    sel.innerHTML = '<option value="">Rol...</option>';
    roleData.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = `@${r.name}`;
      sel.appendChild(opt);
    });
    if (reactions[idx]?.roleId) sel.value = reactions[idx].roleId;
  });

  // Event listeners
  formContainer.querySelector(`[data-close-editor="${panelId}"]`)?.addEventListener("click", () => renderReactionPanels());
  formContainer.querySelector(`[data-save-editor="${panelId}"]`)?.addEventListener("click", () => saveReactionPanelEditor(panelId));

  formContainer.querySelector("#addFieldBtn")?.addEventListener("click", () => {
    const fieldList = formContainer.querySelector("#rr-fields-list");
    const idx = fieldList.querySelectorAll(".rr-field-row").length;
    const row = document.createElement("div");
    row.className = "rr-field-row";
    row.style.cssText = "display: flex; gap: 8px; margin-bottom: 8px; align-items: end;";
    row.innerHTML = `
      <input data-field-name="${idx}" placeholder="Nombre" style="flex: 2;">
      <input data-field-value="${idx}" placeholder="Valor" style="flex: 3;">
      <label style="flex: 0; flex-direction: row; gap: 4px; margin: 0; white-space: nowrap; font-size: 11px;">
        <input type="checkbox" data-field-inline="${idx}"> inline
      </label>
      <button type="button" class="button danger" data-remove-field="${idx}" style="font-size: 12px; height: 32px; padding: 0 8px;">✕</button>`;
    row.querySelector(`[data-remove-field="${idx}"]`).addEventListener("click", () => row.remove());
    fieldList.appendChild(row);
  });

  formContainer.querySelector("#addRrBtn")?.addEventListener("click", () => {
    const rrList = formContainer.querySelector("#rr-reactions-list");
    const idx = rrList.querySelectorAll(".rr-reaction-row").length;
    const row = document.createElement("div");
    row.className = "rr-reaction-row";
    row.style.cssText = "display: flex; gap: 8px; margin-bottom: 8px; align-items: end;";
    row.innerHTML = `
      <input data-rr-emoji="${idx}" placeholder="Emoji (✅ o <:name:id>)" style="flex: 1;">
      <select data-rr-role="${idx}" style="flex: 2;"><option value="">Rol...</option></select>
      <button type="button" class="button danger" data-remove-rr="${idx}" style="font-size: 12px; height: 32px; padding: 0 8px;">✕</button>`;
    const roleSel = row.querySelector(`[data-rr-role="${idx}"]`);
    roleData.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = `@${r.name}`;
      roleSel.appendChild(opt);
    });
    row.querySelector(`[data-remove-rr="${idx}"]`).addEventListener("click", () => row.remove());
    rrList.appendChild(row);
  });

  // Remove field/reaction listeners
  formContainer.querySelectorAll("[data-remove-field]").forEach(btn => {
    btn.addEventListener("click", () => btn.closest(".rr-field-row").remove());
  });
  formContainer.querySelectorAll("[data-remove-rr]").forEach(btn => {
    btn.addEventListener("click", () => btn.closest(".rr-reaction-row").remove());
  });
}

function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function saveReactionPanelEditor(panelId) {
  const editor = document.getElementById(`editor-${panelId}`);
  if (!editor) return;

  const fields = [];
  editor.querySelectorAll(".rr-field-row").forEach(row => {
    const nameInput = row.querySelector("[data-field-name]");
    const valueInput = row.querySelector("[data-field-value]");
    const inlineCheck = row.querySelector("[data-field-inline]");
    if (nameInput && valueInput) {
      fields.push({ name: nameInput.value, value: valueInput.value, inline: inlineCheck?.checked || false });
    }
  });

  const reactions = [];
  editor.querySelectorAll(".rr-reaction-row").forEach(row => {
    const emojiInput = row.querySelector("[data-rr-emoji]");
    const roleSelect = row.querySelector("[data-rr-role]");
    if (emojiInput && roleSelect && emojiInput.value && roleSelect.value) {
      reactions.push({ emoji: emojiInput.value, roleId: roleSelect.value });
    }
  });

  const data = {
    embed: {
      title: editor.querySelector("#rr-title")?.value || "",
      description: editor.querySelector("#rr-desc")?.value || "",
      color: editor.querySelector("#rr-color")?.value || "#8b5cf6",
      fields,
      imageUrl: editor.querySelector("#rr-image")?.value || "",
      thumbnailUrl: editor.querySelector("#rr-thumb")?.value || "",
      footer: editor.querySelector("#rr-footer")?.value || ""
    },
    reactions
  };

  const result = await updateReactionPanel(panelId, data);
  if (result) {
    renderReactionPanels();
    showToast("Panel guardado");
  }
}

// ============ TICKET PANELS ============

let ticketPanelsCache = [];

function renderTicketPanels() {
  const listEl = document.querySelector("#ticketPanelsList");
  if (!listEl) return;

  if (ticketPanelsCache.length === 0) {
    listEl.innerHTML = `<p style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 24px;">No hay paneles de tickets creados aún.</p>`;
    return;
  }

  listEl.innerHTML = "";
  ticketPanelsCache.forEach((panel, idx) => {
    const card = document.createElement("div");
    card.className = "panel";
    card.style.marginBottom = "12px";

    const sent = panel.messageId && panel.channelId;
    const btnCount = panel.buttons?.length || 0;

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <strong style="font-size: 16px;">${panel.embed?.title || "Sin título"}</strong>
          <span style="display: block; font-size: 12px; color: var(--text-dim); margin-top: 4px;">
            ${sent ? "✅ Enviado" : "📝 Borrador"}
            · ${btnCount} botón(es)
          </span>
        </div>
        <div style="display: flex; gap: 6px;">
          <button type="button" class="button secondary" data-edit-tp="${panel.id}" style="font-size: 12px; height: 32px; padding: 0 12px;">✏️</button>
          <button type="button" class="button danger" data-delete-tp="${panel.id}" style="font-size: 12px; height: 32px; padding: 0 12px;">🗑️</button>
        </div>
      </div>
      <div style="margin-top: 10px; display: flex; gap: 6px;">
        <select data-tp-channel="${panel.id}" style="flex: 1;">
          <option value="">Canal...</option>
        </select>
        <button type="button" class="button primary" data-send-tp="${panel.id}" style="font-size: 12px; height: 32px; padding: 0 12px;">${sent ? "🔄 Actualizar" : "📨 Enviar"}</button>
      </div>
    `;

    listEl.appendChild(card);

    const channelSelect = card.querySelector(`[data-tp-channel="${panel.id}"]`);
    if (channelSelect && channelsCache[state.selectedGuild?.id]) {
      const chData = channelsCache[state.selectedGuild.id];
      const allChs = [...(chData.textChannels || [])];
      allChs.forEach(ch => {
        const opt = document.createElement("option");
        opt.value = ch.id;
        opt.textContent = `#${ch.name}`;
        channelSelect.appendChild(opt);
      });
      if (panel.channelId) channelSelect.value = panel.channelId;
    }

    card.querySelector(`[data-edit-tp="${panel.id}"]`)?.addEventListener("click", () => editTicketPanel(panel.id));
    card.querySelector(`[data-delete-tp="${panel.id}"]`)?.addEventListener("click", () => deleteTicketPanel(panel.id));
    card.querySelector(`[data-send-tp="${panel.id}"]`)?.addEventListener("click", () => sendTicketPanel(panel.id));
    channelSelect?.addEventListener("change", async () => {
      await updateTicketPanel(panel.id, { channelId: channelSelect.value });
      showToast("Canal guardado");
    });
  });
}

async function loadTicketPanels() {
  if (!state.selectedGuild) return;
  try {
    ticketPanelsCache = await api(`/api/guilds/${state.selectedGuild.id}/ticket-panels`);
    renderTicketPanels();
  } catch (error) {
    showToast("Error al cargar paneles: " + error.message, "error");
  }
}

async function createTicketPanel() {
  if (!state.selectedGuild) return;
  const defaultPanel = {
    embed: {
      title: "Sistema de Tickets",
      description: "Haz clic en un botón para crear un ticket.",
      color: "#8b5cf6",
      fields: [],
      imageUrl: "",
      thumbnailUrl: "",
      footer: "by wesjed"
    },
    buttons: []
  };
  try {
    const panel = await api(`/api/guilds/${state.selectedGuild.id}/ticket-panels`, {
      method: "POST",
      body: JSON.stringify(defaultPanel)
    });
    ticketPanelsCache.push(panel);
    renderTicketPanels();
    editTicketPanel(panel.id);
    showToast("Panel creado");
  } catch (error) {
    showToast("Error: " + error.message, "error");
  }
}

async function deleteTicketPanel(panelId) {
  if (!state.selectedGuild || !confirm("¿Eliminar este panel?")) return;
  try {
    await api(`/api/guilds/${state.selectedGuild.id}/ticket-panels/${panelId}`, { method: "DELETE" });
    ticketPanelsCache = ticketPanelsCache.filter(p => p.id !== panelId);
    renderTicketPanels();
    showToast("Panel eliminado");
  } catch (error) {
    showToast("Error: " + error.message, "error");
  }
}

async function updateTicketPanel(panelId, data) {
  if (!state.selectedGuild) return;
  try {
    const updated = await api(`/api/guilds/${state.selectedGuild.id}/ticket-panels/${panelId}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
    const idx = ticketPanelsCache.findIndex(p => p.id === panelId);
    if (idx !== -1) ticketPanelsCache[idx] = updated;
    renderTicketPanels();
    return updated;
  } catch (error) {
    showToast("Error: " + error.message, "error");
    return null;
  }
}

async function sendTicketPanel(panelId) {
  if (!state.selectedGuild) return;
  try {
    const result = await api(`/api/guilds/${state.selectedGuild.id}/ticket-panels/${panelId}/send`, { method: "POST" });
    const idx = ticketPanelsCache.findIndex(p => p.id === panelId);
    if (idx !== -1) ticketPanelsCache[idx] = result;
    renderTicketPanels();
    showToast("Panel enviado");
  } catch (error) {
    showToast("Error: " + error.message, "error");
  }
}

function editTicketPanel(panelId) {
  const panel = ticketPanelsCache.find(p => p.id === panelId);
  if (!panel) return;

  const listEl = document.querySelector("#ticketPanelsList");
  if (!listEl) return;

  const formContainer = document.createElement("div");
  formContainer.className = "panel";
  formContainer.style.marginBottom = "12px";
  formContainer.style.borderColor = "var(--accent)";
  formContainer.id = `tp-editor-${panelId}`;

  const embed = panel.embed || {};
  const buttons = panel.buttons || [];

  let fieldsHtml = "";
  (embed.fields || []).forEach((f, i) => {
    fieldsHtml += `
      <div class="tp-field-row" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: end;">
        <input data-tpf-name="${i}" value="${escHtml(f.name)}" placeholder="Nombre" style="flex: 2;">
        <input data-tpf-value="${i}" value="${escHtml(f.value)}" placeholder="Valor" style="flex: 3;">
        <label style="flex: 0; flex-direction: row; gap: 4px; margin: 0; white-space: nowrap; font-size: 11px;">
          <input type="checkbox" data-tpf-inline="${i}" ${f.inline ? "checked" : ""}> inline
        </label>
        <button type="button" class="button danger" data-remove-tpf="${i}" style="font-size: 12px; height: 32px; padding: 0 8px;">✕</button>
      </div>`;
  });

  let buttonsHtml = "";
  buttons.forEach((b, i) => {
    buttonsHtml += `
      <div class="tp-btn-row" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: end; flex-wrap: wrap;">
        <input data-tpb-label="${i}" value="${escHtml(b.label)}" placeholder="Etiqueta" style="flex: 1; min-width: 80px;">
        <input data-tpb-emoji="${i}" value="${escHtml(b.emoji)}" placeholder="🎫" style="flex: 0 0 50px;">
        <select data-tpb-category="${i}" style="flex: 2; min-width: 120px;"><option value="">Categoría...</option></select>
        <select data-tpb-role="${i}" style="flex: 2; min-width: 120px;"><option value="">Rol soporte...</option></select>
        <input data-tpb-msg="${i}" value="${escHtml(b.welcomeMessage || "")}" placeholder="Mensaje de bienvenida" style="flex: 3; min-width: 150px;">
        <button type="button" class="button danger" data-remove-tpb="${i}" style="font-size: 12px; height: 32px; padding: 0 8px;">✕</button>
      </div>`;
  });

  const roleData = rolesCache[state.selectedGuild?.id] || [];
  const chData = channelsCache[state.selectedGuild?.id];

  formContainer.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <h3 style="margin: 0;">✏️ Editar Panel de Tickets</h3>
      <div style="display: flex; gap: 6px;">
        <button type="button" class="button secondary" data-close-tp-editor="${panelId}" style="font-size: 12px; height: 32px; padding: 0 12px;">← Volver</button>
        <button type="button" class="button primary" data-save-tp-editor="${panelId}" style="font-size: 12px; height: 32px; padding: 0 12px;">💾 Guardar</button>
      </div>
    </div>
    <label>Título <input id="tp-title" value="${escHtml(embed.title || "")}"></label>
    <label>Descripción <textarea id="tp-desc" rows="3">${escHtml(embed.description || "")}</textarea></label>
    <label>Color (HEX) <input id="tp-color" value="${embed.color || "#8b5cf6"}" placeholder="#8b5cf6"></label>
    <label>URL de Imagen <input id="tp-image" value="${escHtml(embed.imageUrl || "")}" placeholder="https://..."></label>
    <label>URL de Thumbnail <input id="tp-thumb" value="${escHtml(embed.thumbnailUrl || "")}" placeholder="https://..."></label>
    <label>Footer <input id="tp-footer" value="${escHtml(embed.footer || "")}" placeholder="by wesjed"></label>

    <div style="margin-top: 16px;">
      <strong style="font-size: 14px;">📋 Fields</strong>
      <div id="tp-fields-list" style="margin-top: 8px;">${fieldsHtml}</div>
      <button type="button" class="button secondary" id="addTpFieldBtn" style="font-size: 12px; height: 32px; padding: 0 12px; margin-top: 8px;">➕ Añadir Field</button>
    </div>

    <div style="margin-top: 16px;">
      <strong style="font-size: 14px;">🔘 Botones de Ticket</strong>
      <p style="font-size: 12px; color: var(--text-dim); margin: 4px 0 8px;">Cada botón crea un ticket en la categoría que elijas. Puedes añadir varios botones para diferentes tipos de ticket (soporte, reporte, etc.).</p>
      <div id="tp-buttons-list" style="margin-top: 8px;">${buttonsHtml}</div>
      <button type="button" class="button secondary" id="addTpBtnBtn" style="font-size: 12px; height: 32px; padding: 0 12px; margin-top: 8px;">➕ Añadir Botón</button>
    </div>
  `;

  if (listEl.firstChild) {
    listEl.insertBefore(formContainer, listEl.firstChild);
  } else {
    listEl.appendChild(formContainer);
  }

  // Populate category + role selects
  formContainer.querySelectorAll("[data-tpb-category]").forEach(sel => {
    const i = parseInt(sel.dataset.tpbCategory);
    sel.innerHTML = '<option value="">Categoría...</option>';
    if (chData?.categories) {
      chData.categories.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = `📁 ${c.name}`;
        sel.appendChild(opt);
      });
    }
    if (buttons[i]?.categoryId) sel.value = buttons[i].categoryId;
  });

  formContainer.querySelectorAll("[data-tpb-role]").forEach(sel => {
    const i = parseInt(sel.dataset.tpbRole);
    sel.innerHTML = '<option value="">Rol soporte...</option>';
    roleData.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = `@${r.name}`;
      sel.appendChild(opt);
    });
    if (buttons[i]?.supportRoleId) sel.value = buttons[i].supportRoleId;
  });

  // Event listeners
  formContainer.querySelector(`[data-close-tp-editor="${panelId}"]`)?.addEventListener("click", () => renderTicketPanels());
  formContainer.querySelector(`[data-save-tp-editor="${panelId}"]`)?.addEventListener("click", () => saveTicketPanelEditor(panelId));

  formContainer.querySelector("#addTpFieldBtn")?.addEventListener("click", () => {
    const fieldList = formContainer.querySelector("#tp-fields-list");
    const idx = fieldList.querySelectorAll(".tp-field-row").length;
    const row = document.createElement("div");
    row.className = "tp-field-row";
    row.style.cssText = "display: flex; gap: 8px; margin-bottom: 8px; align-items: end;";
    row.innerHTML = `
      <input data-tpf-name="${idx}" placeholder="Nombre" style="flex: 2;">
      <input data-tpf-value="${idx}" placeholder="Valor" style="flex: 3;">
      <label style="flex: 0; flex-direction: row; gap: 4px; margin: 0; white-space: nowrap; font-size: 11px;">
        <input type="checkbox" data-tpf-inline="${idx}"> inline
      </label>
      <button type="button" class="button danger" data-remove-tpf="${idx}" style="font-size: 12px; height: 32px; padding: 0 8px;">✕</button>`;
    row.querySelector(`[data-remove-tpf="${idx}"]`).addEventListener("click", () => row.remove());
    fieldList.appendChild(row);
  });

  formContainer.querySelector("#addTpBtnBtn")?.addEventListener("click", () => {
    const btnList = formContainer.querySelector("#tp-buttons-list");
    const idx = btnList.querySelectorAll(".tp-btn-row").length;
    const row = document.createElement("div");
    row.className = "tp-btn-row";
    row.style.cssText = "display: flex; gap: 8px; margin-bottom: 8px; align-items: end; flex-wrap: wrap;";
    row.innerHTML = `
      <input data-tpb-label="${idx}" placeholder="Etiqueta" style="flex: 1; min-width: 80px;">
      <input data-tpb-emoji="${idx}" placeholder="🎫" style="flex: 0 0 50px;">
      <select data-tpb-category="${idx}" style="flex: 2; min-width: 120px;"><option value="">Categoría...</option></select>
      <select data-tpb-role="${idx}" style="flex: 2; min-width: 120px;"><option value="">Rol soporte...</option></select>
      <input data-tpb-msg="${idx}" placeholder="Mensaje de bienvenida" style="flex: 3; min-width: 150px;">
      <button type="button" class="button danger" data-remove-tpb="${idx}" style="font-size: 12px; height: 32px; padding: 0 8px;">✕</button>`;
    const catSel = row.querySelector(`[data-tpb-category="${idx}"]`);
    if (chData?.categories) {
      chData.categories.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = `📁 ${c.name}`;
        catSel.appendChild(opt);
      });
    }
    const roleSel = row.querySelector(`[data-tpb-role="${idx}"]`);
    roleData.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = `@${r.name}`;
      roleSel.appendChild(opt);
    });
    row.querySelector(`[data-remove-tpb="${idx}"]`).addEventListener("click", () => row.remove());
    btnList.appendChild(row);
  });

  formContainer.querySelectorAll("[data-remove-tpf]").forEach(btn => {
    btn.addEventListener("click", () => btn.closest(".tp-field-row").remove());
  });
  formContainer.querySelectorAll("[data-remove-tpb]").forEach(btn => {
    btn.addEventListener("click", () => btn.closest(".tp-btn-row").remove());
  });
}

async function saveTicketPanelEditor(panelId) {
  const editor = document.getElementById(`tp-editor-${panelId}`);
  if (!editor) return;

  const fields = [];
  editor.querySelectorAll(".tp-field-row").forEach(row => {
    const nameInput = row.querySelector("[data-tpf-name]");
    const valueInput = row.querySelector("[data-tpf-value]");
    const inlineCheck = row.querySelector("[data-tpf-inline]");
    if (nameInput && valueInput) {
      fields.push({ name: nameInput.value, value: valueInput.value, inline: inlineCheck?.checked || false });
    }
  });

  const buttons = [];
  editor.querySelectorAll(".tp-btn-row").forEach(row => {
    const labelInput = row.querySelector("[data-tpb-label]");
    const emojiInput = row.querySelector("[data-tpb-emoji]");
    const catSelect = row.querySelector("[data-tpb-category]");
    const roleSelect = row.querySelector("[data-tpb-role]");
    const msgInput = row.querySelector("[data-tpb-msg]");
    if (labelInput && labelInput.value) {
      buttons.push({
        label: labelInput.value,
        emoji: emojiInput?.value || "",
        categoryId: catSelect?.value || "",
        supportRoleId: roleSelect?.value || "",
        welcomeMessage: msgInput?.value || ""
      });
    }
  });

  const data = {
    embed: {
      title: editor.querySelector("#tp-title")?.value || "",
      description: editor.querySelector("#tp-desc")?.value || "",
      color: editor.querySelector("#tp-color")?.value || "#8b5cf6",
      fields,
      imageUrl: editor.querySelector("#tp-image")?.value || "",
      thumbnailUrl: editor.querySelector("#tp-thumb")?.value || "",
      footer: editor.querySelector("#tp-footer")?.value || ""
    },
    buttons
  };

  const result = await updateTicketPanel(panelId, data);
  if (result) {
    renderTicketPanels();
    showToast("Panel guardado");
  }
}

// Guardar Configuración
elements.configForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!state.selectedGuild) return;

  setNotice("Guardando cambios...");
  elements.saveConfigBtn?.classList.add("loading");

  try {
    const config = await api(`/api/guilds/${state.selectedGuild.id}/config`, {
      method: "PUT",
      body: JSON.stringify(readForm())
    });
    fillForm(config);
    elements.saveConfigBtn?.classList.remove("changed", "loading");
    setNotice("Cambios guardados. El bot usara esta configuracion.");
    showToast("Los cambios han sido aplicados correctamente! 🎉");
  } catch (error) {
    elements.saveConfigBtn?.classList.remove("loading");
    setNotice(error.message, "error");
    showToast(error.message, "error");
  }
});

// Inicialización Principal
async function init() {
  let status;

  try {
    status = await api("/api/status");
  } catch (error) {
    elements.logoutLink.classList.add("hidden");
    setNotice(error.message, "error");
    return;
  }

  state.isOwner = status.isOwner;

  if (status.siteName) {
    document.title = status.siteName;
    elements.brandName.textContent = status.siteName;
  }

  elements.inviteButton.href = status.inviteUrl;

  document.querySelectorAll("[data-bot-action]").forEach(button => {
    button.addEventListener("click", () => runBotAction(button.dataset.botAction));
  });

  // Inicializar pestañas de la consola
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.tab);
      if (btn.dataset.tab === "tab-reaction-roles" && state.selectedGuild) {
        loadReactionPanels();
      }
      if (btn.dataset.tab === "tab-tickets" && state.selectedGuild) {
        loadTicketPanels();
      }
    });
  });

  // Inicializar botón de regreso
  document.querySelector("#backToGuildsBtn")?.addEventListener("click", exitConsoleMode);

  // Control de Cambios en el Formulario (Verde -> Rojo)
  elements.configForm?.addEventListener("input", () => {
    elements.saveConfigBtn?.classList.add("changed");
  });
  elements.configForm?.addEventListener("change", () => {
    elements.saveConfigBtn?.classList.add("changed");
  });

  // Castigos por Warns: Añadir
  document.getElementById("addPunishmentBtn")?.addEventListener("click", () => {
    const warns = parseInt(document.getElementById("newPWarns")?.value);
    const action = document.getElementById("newPAction")?.value;
    const duration = parseInt(document.getElementById("newPDuration")?.value) || null;

    if (!warns || warns < 1 || warns > 50) {
      showToast("Ingresa un número de warns válido (1-50)", "error");
      return;
    }

    let current = [...(window._punishmentWarnsCache || [])];
    const existing = current.findIndex(p => p.warns === warns);
    const entry = { warns, action, duration: action === "timeout" ? duration : null };

    if (existing !== -1) {
      current[existing] = entry;
    } else {
      current.push(entry);
    }
    current.sort((a, b) => a.warns - b.warns);
    window._punishmentWarnsCache = current;
    renderPunishmentWarnsTable(current);
    elements.saveConfigBtn?.classList.add("changed");

    document.getElementById("newPWarns").value = "";
    document.getElementById("newPDuration").value = "";
  });

  // Castigos por Warns: Eliminar (delegación)
  document.getElementById("punishmentWarnsTable")?.addEventListener("click", e => {
    const btn = e.target.closest("[data-remove-pw]");
    if (!btn) return;
    const idx = parseInt(btn.dataset.removePw);
    let current = [...(window._punishmentWarnsCache || [])];
    if (idx >= 0 && idx < current.length) {
      current.splice(idx, 1);
      window._punishmentWarnsCache = current;
      renderPunishmentWarnsTable(current);
      elements.saveConfigBtn?.classList.add("changed");
    }
  });

  // Interceptar navegación de todos los enlaces de anclaje (incluyendo nav-links y el botón "Ver panel" en Hero)
  document.querySelectorAll("a[href^='#']").forEach(link => {
    link.addEventListener("click", event => {
      const href = link.getAttribute("href");
      
      if (href === "#home") {
        event.preventDefault();
        exitConsoleMode();
        document.querySelector("#home")?.scrollIntoView({ behavior: "smooth" });
      } else if (href === "#features") {
        event.preventDefault();
        exitConsoleMode();
        document.querySelector("#features")?.scrollIntoView({ behavior: "smooth" });
      } else if (href === "#dashboard") {
        event.preventDefault();
        exitConsoleMode(); // Reset to server list when clicking Dashboard or Ver panel
        document.querySelector("#dashboard")?.scrollIntoView({ behavior: "smooth" });
      } else if (href === "#automod") {
        event.preventDefault();
        if (state.selectedGuild) {
          switchTab("tab-automod");
          elements.configForm?.scrollIntoView({ behavior: "smooth" });
        } else {
          exitConsoleMode();
          document.querySelector("#dashboard")?.scrollIntoView({ behavior: "smooth" });
          setNotice("⚠️ Elige un servidor primero para editar sus filtros de Automod.");
          showToast("Elige un servidor para editar Automod", "error");
        }
      }
    });
  });

  // Soporte del Creador (abre directamente la pestaña Soporte de la consola)
  document.querySelector("#ownerSupportBtn")?.addEventListener("click", () => {
    if (state.guilds.length > 0) {
      selectGuild(state.guilds[0]);
      switchTab("tab-support");
    } else {
      elements.configForm.classList.remove("hidden");
      document.querySelector("#home")?.classList.add("hidden");
      document.querySelector("#features")?.classList.add("hidden");
      document.querySelector("#ownerPanel")?.classList.add("hidden");
      document.querySelector(".session-row")?.classList.add("hidden");
      switchTab("tab-support");
    }
  });

  // Crear panel de reaction roles
  document.querySelector("#createReactionPanelBtn")?.addEventListener("click", createReactionPanel);
  document.querySelector("#createTicketPanelBtn")?.addEventListener("click", createTicketPanel);

  // Consola de Servidores del Bot dedicada (Propietario)
  elements.toggleBotGuildsBtn?.addEventListener("click", async () => {
    document.querySelector("#home")?.classList.add("hidden");
    document.querySelector("#features")?.classList.add("hidden");
    document.querySelector("#ownerPanel")?.classList.add("hidden");
    document.querySelector(".session-row")?.classList.add("hidden");
    document.querySelector(".section-heading.compact")?.classList.add("hidden");
    elements.configForm?.classList.add("hidden");
    
    elements.botGuildsConsoleSection?.classList.remove("hidden");
    
    // Limpiar buscador
    if (elements.botGuildsSearch) elements.botGuildsSearch.value = "";
    
    const listEl = elements.botGuildsList;
    if (listEl) listEl.innerHTML = "<p class='loading-text'>Cargando servidores del bot...</p>";
    
    try {
      state.botGuilds = await api("/api/admin/bot/guilds");
      renderBotGuilds();
    } catch (error) {
      if (listEl) {
        listEl.innerHTML = `<p class='error-text'>Error al cargar servidores: ${error.message}</p>`;
      }
    }
  });

  // Volver de la consola de servidores del bot
  elements.backToOwnerBtn?.addEventListener("click", () => {
    state.selectedGuild = null;
    state.consoleSource = "user";
    renderGuilds();
    elements.configForm?.classList.add("hidden");
    elements.botGuildsConsoleSection?.classList.add("hidden");
    document.querySelector("#home")?.classList.remove("hidden");
    document.querySelector("#features")?.classList.remove("hidden");
    document.querySelector("#ownerPanel")?.classList.remove("hidden");
    document.querySelector(".session-row")?.classList.remove("hidden");
    document.querySelector("#serverSelectorContainer")?.classList.remove("hidden");
    document.querySelector(".section-heading.compact")?.classList.remove("hidden");
    setNotice(state.guilds.length ? "Elige un servidor para configurarlo." : "No se encontraron servidores con wbot. ¡Invítalo primero con el botón de arriba!");
  });

  // Buscador interactivo en tiempo real de los servidores
  elements.botGuildsSearch?.addEventListener("input", e => {
    const query = e.target.value.toLowerCase().trim();
    if (!query) {
      renderBotGuilds();
      return;
    }
    const filtered = state.botGuilds.filter(bg => {
      const nameMatch = bg.name.toLowerCase().includes(query);
      const idMatch = bg.id.toString().includes(query);
      const ownerName = bg.owner ? (bg.owner.globalName || bg.owner.username || "") : "";
      const ownerMatch = ownerName.toLowerCase().includes(query);
      const ownerId = bg.owner ? bg.owner.id.toString() : "";
      const ownerIdMatch = ownerId.includes(query);
      return nameMatch || idMatch || ownerMatch || ownerIdMatch;
    });
    renderBotGuilds(filtered);
  });

  // Botón de Ver Logs
  document.querySelector("#viewBotLogsBtn")?.addEventListener("click", () => {
    const container = document.querySelector("#botLogsContainer");
    if (container) {
      container.classList.toggle("hidden");
      if (!container.classList.contains("hidden")) loadBotLogs();
    }
  });

  document.querySelector("#refreshBotLogsBtn")?.addEventListener("click", loadBotLogs);

  if (!status.loggedIn) {
    elements.logoutLink.classList.add("hidden");
    const params = new URLSearchParams(location.search);
    if (params.get("setup") === "missing-secret") {
      setNotice("Falta DISCORD_CLIENT_SECRET en .env. Rellenalo para activar el login.", "error");
    }
    return;
  }

  elements.loginButton.classList.add("hidden");
  elements.heroLoginButton.classList.add("hidden");
  elements.logoutLink.classList.remove("hidden");
  elements.userName.textContent = status.user.globalName || status.user.username;

  if (status.isOwner) {
    elements.ownerPanel.classList.remove("hidden");
    setBotState(status.bot);
  }

  try {
    state.guilds = await api("/api/guilds");
    renderGuilds();
    setNotice(state.guilds.length 
      ? "Elige un servidor para configurarlo." 
      : "No se encontraron servidores con wbot. ¡Invítalo primero con el botón de arriba!");
  } catch (error) {
    setNotice(error.message, "error");
  }
}

initInteractiveSnow();
initMotionEffects();
init().catch(() => setNotice("No se pudo cargar el panel. Reinicia la web con `npm run web`.", "error"));
