const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getGuildConfig, setGuildConfig } = require('../services/guildService');

/**
 * GET /api/guilds/:guildId/boost-logger
 * Get boost logger configuration
 */
router.get('/api/guilds/:guildId/boost-logger', requireAuth, async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Verify user has access to this guild
    const hasAccess = req.session.userGuilds?.some(g => g.id === guildId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this guild' });
    }
    
    const config = await getGuildConfig(guildId);
    res.json(config.boostLogger || {});
  } catch (error) {
    console.error('Error fetching boost logger config:', error);
    res.status(500).json({ error: 'Failed to fetch boost logger configuration' });
  }
});

/**
 * PUT /api/guilds/:guildId/boost-logger
 * Update boost logger configuration
 */
router.put('/api/guilds/:guildId/boost-logger', requireAuth, async (req, res) => {
  try {
    const { guildId } = req.params;
    const updates = req.body;
    
    // Verify user has access to this guild
    const hasAccess = req.session.userGuilds?.some(g => g.id === guildId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this guild' });
    }
    
    const config = await getGuildConfig(guildId);
    
    // Update boost logger config
    config.boostLogger = {
      ...(config.boostLogger || {}),
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    const updatedConfig = await setGuildConfig(guildId, { boostLogger: config.boostLogger });
    res.json({ success: true, boostLogger: updatedConfig.boostLogger });
  } catch (error) {
    console.error('Error updating boost logger config:', error);
    res.status(500).json({ error: 'Failed to update boost logger configuration' });
  }
});

module.exports = router;
