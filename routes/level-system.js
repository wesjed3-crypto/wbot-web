const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getGuildConfig, setGuildConfig } = require('../services/guildService');

/**
 * GET /api/guilds/:guildId/level-system
 * Get level system configuration
 */
router.get('/api/guilds/:guildId/level-system', requireAuth, async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Verify user has access to this guild
    const hasAccess = req.session.userGuilds?.some(g => g.id === guildId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this guild' });
    }
    
    const config = await getGuildConfig(guildId);
    res.json(config.levelSystem || {});
  } catch (error) {
    console.error('Error fetching level system config:', error);
    res.status(500).json({ error: 'Failed to fetch level system configuration' });
  }
});

/**
 * PUT /api/guilds/:guildId/level-system
 * Update level system configuration
 */
router.put('/api/guilds/:guildId/level-system', requireAuth, async (req, res) => {
  try {
    const { guildId } = req.params;
    const updates = req.body;
    
    // Verify user has access to this guild
    const hasAccess = req.session.userGuilds?.some(g => g.id === guildId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this guild' });
    }
    
    const config = await getGuildConfig(guildId);
    
    // Update level system config
    config.levelSystem = {
      ...(config.levelSystem || {}),
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    const updatedConfig = await setGuildConfig(guildId, { levelSystem: config.levelSystem });
    res.json({ success: true, levelSystem: updatedConfig.levelSystem });
  } catch (error) {
    console.error('Error updating level system config:', error);
    res.status(500).json({ error: 'Failed to update level system configuration' });
  }
});

module.exports = router;
