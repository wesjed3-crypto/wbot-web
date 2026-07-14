const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getGuildConfig, setGuildConfig } = require('../services/guildService');

/**
 * GET /api/guilds/:guildId/invite-logger
 * Get invite logger configuration
 */
router.get('/api/guilds/:guildId/invite-logger', requireAuth, async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Verify user has access to this guild
    const hasAccess = req.session.userGuilds?.some(g => g.id === guildId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this guild' });
    }
    
    const config = await getGuildConfig(guildId);
    res.json(config.inviteLogger || {});
  } catch (error) {
    console.error('Error fetching invite logger config:', error);
    res.status(500).json({ error: 'Failed to fetch invite logger configuration' });
  }
});

/**
 * PUT /api/guilds/:guildId/invite-logger
 * Update invite logger configuration
 */
router.put('/api/guilds/:guildId/invite-logger', requireAuth, async (req, res) => {
  try {
    const { guildId } = req.params;
    const updates = req.body;
    
    // Verify user has access to this guild
    const hasAccess = req.session.userGuilds?.some(g => g.id === guildId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this guild' });
    }
    
    const config = await getGuildConfig(guildId);
    
    // Update invite logger config
    config.inviteLogger = {
      ...(config.inviteLogger || {}),
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    const updatedConfig = await setGuildConfig(guildId, { inviteLogger: config.inviteLogger });
    res.json({ success: true, inviteLogger: updatedConfig.inviteLogger });
  } catch (error) {
    console.error('Error updating invite logger config:', error);
    res.status(500).json({ error: 'Failed to update invite logger configuration' });
  }
});

module.exports = router;
