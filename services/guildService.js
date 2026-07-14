const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { deepMerge } = require('../utils/helpers');
const { defaultGuildConfig } = require('../config/defaultConfig');

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'guild-configs.json');

// Mongoose model
const guildConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  config: { type: Object, default: () => ({ ...defaultGuildConfig }) }
}, { timestamps: true });

const GuildConfig = mongoose.models.GuildConfig || mongoose.model("GuildConfig", guildConfigSchema);

/**
 * Ensure MongoDB connection
 * @returns {Promise<boolean>} True if connected
 */
async function ensureMongo() {
  if (mongoose.connection.readyState === 1) return true;
  if (!process.env.MONGODB_URI) return false;
  
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000
    });
    return true;
  } catch (error) {
    console.warn('⚠️  MongoDB not available, using file storage:', error.message);
    return false;
  }
}

/**
 * Get guild configuration
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>} Guild configuration
 */
async function getGuildConfig(guildId) {
  try {
    const useMongo = await ensureMongo();
    
    if (useMongo && mongoose.connection.readyState === 1) {
      const doc = await GuildConfig.findOneAndUpdate(
        { guildId },
        { $setOnInsert: { config: { ...defaultGuildConfig } } },
        { upsert: true, new: true, upsert: true }
      );
      
      // Merge with defaults to ensure all fields exist
      return deepMerge(defaultGuildConfig, doc.config);
    }
    
    // Fallback to file storage
    return getGuildConfigFromFile(guildId);
  } catch (error) {
    console.warn('⚠️  Error reading guild config, using file storage:', error.message);
    return getGuildConfigFromFile(guildId);
  }
}

/**
 * Get guild configuration from file storage
 * @param {string} guildId - Discord guild ID
 * @returns {Object} Guild configuration
 */
function getGuildConfigFromFile(guildId) {
  try {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    let allConfigs = {};
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      allConfigs = JSON.parse(data);
    }
    
    if (!allConfigs[guildId]) {
      allConfigs[guildId] = { config: { ...defaultGuildConfig } };
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(allConfigs, null, 2));
    }
    
    return deepMerge(defaultGuildConfig, allConfigs[guildId].config);
  } catch (error) {
    console.error('Error reading guild config file:', error);
    return { ...defaultGuildConfig };
  }
}

/**
 * Set guild configuration
 * @param {string} guildId - Discord guild ID
 * @param {Object} config - Configuration to save
 * @returns {Promise<Object>} Saved configuration
 */
async function setGuildConfig(guildId, config) {
  try {
    const cleanConfig = deepMerge(defaultGuildConfig, config);
    const useMongo = await ensureMongo();
    
    if (useMongo && mongoose.connection.readyState === 1) {
      await GuildConfig.findOneAndUpdate(
        { guildId },
        { $set: { config: cleanConfig } },
        { upsert: true, new: true }
      );
    }
    
    // Always sync to file storage as backup
    await syncGuildConfigToFile(guildId, cleanConfig);
    
    // Sync with bot API if configured
    await syncWithBotAPI(guildId, cleanConfig);
    
    return cleanConfig;
  } catch (error) {
    console.error('Error setting guild config:', error);
    throw error;
  }
}

/**
 * Sync guild configuration to file storage
 * @param {string} guildId - Discord guild ID
 * @param {Object} config - Configuration to save
 */
async function syncGuildConfigToFile(guildId, config) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    let allConfigs = {};
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      allConfigs = JSON.parse(data);
    }
    
    allConfigs[guildId] = { config };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(allConfigs, null, 2));
  } catch (error) {
    console.error('Error syncing guild config to file:', error);
  }
}

/**
 * Sync configuration with bot API
 * @param {string} guildId - Discord guild ID
 * @param {Object} config - Configuration to sync
 */
async function syncWithBotAPI(guildId, config) {
  const botApiUrl = process.env.BOT_API_URL;
  const apiSecret = process.env.API_SECRET;
  
  if (!botApiUrl || !apiSecret) return;
  
  try {
    const response = await fetch(`${botApiUrl}/api/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': apiSecret
      },
      body: JSON.stringify({ guildId, config })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`⚠️  Bot API responded ${response.status}: ${errorText}`);
    } else {
      console.log(`✅ Config for guild ${guildId} synced with bot`);
    }
  } catch (error) {
    console.warn(`⚠️  Error connecting to bot API: ${error.message}`);
  }
}

/**
 * Delete guild configuration
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<void>}
 */
async function deleteGuildConfig(guildId) {
  try {
    const useMongo = await ensureMongo();
    
    if (useMongo && mongoose.connection.readyState === 1) {
      await GuildConfig.deleteOne({ guildId });
    }
    
    // Remove from file storage
    if (fs.existsSync(CONFIG_FILE)) {
      let allConfigs = {};
      try {
        const data = fs.readFileSync(CONFIG_FILE, 'utf8');
        allConfigs = JSON.parse(data);
      } catch (error) {
        allConfigs = {};
      }
      
      if (allConfigs[guildId]) {
        delete allConfigs[guildId];
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(allConfigs, null, 2));
      }
    }
    
    // Notify bot API
    await notifyBotAPIDelete(guildId);
  } catch (error) {
    console.error('Error deleting guild config:', error);
    throw error;
  }
}

/**
 * Notify bot API of guild deletion
 * @param {string} guildId - Discord guild ID
 */
async function notifyBotAPIDelete(guildId) {
  const botApiUrl = process.env.BOT_API_URL;
  const apiSecret = process.env.API_SECRET;
  
  if (!botApiUrl || !apiSecret) return;
  
  try {
    const response = await fetch(`${botApiUrl}/api/config/${guildId}`, {
      method: 'DELETE',
      headers: {
        'x-api-secret': apiSecret
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`⚠️  Bot API delete responded ${response.status}: ${errorText}`);
    }
  } catch (error) {
    console.warn(`⚠️  Error notifying bot API of deletion: ${error.message}`);
  }
}

module.exports = {
  getGuildConfig,
  setGuildConfig,
  deleteGuildConfig
};
