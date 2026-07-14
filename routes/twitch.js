const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getGuildConfig, setGuildConfig } = require('../services/guildService');

/**
 * GET /api/guilds/:guildId/twitch
 * Get Twitch integration configuration
 */
router.get('/api/guilds/:guildId/twitch', requireAuth, async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Verify user has access to this guild
    const hasAccess = req.session.userGuilds?.some(g => g.id === guildId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this guild' });
    }
    
    const config = await getGuildConfig(guildId);
    res.json(config.twitch || {});
  } catch (error) {
    console.error('Error fetching twitch config:', error);
    res.status(500).json({ error: 'Failed to fetch Twitch configuration' });
  }
});

/**
 * PUT /api/guilds/:guildId/twitch
 * Update Twitch integration configuration
 */
router.put('/api/guilds/:guildId/twitch', requireAuth, async (req, res) => {
  try {
    const { guildId } = req.params;
    const updates = req.body;
    
    // Verify user has access to this guild
    const hasAccess = req.session.userGuilds?.some(g => g.id === guildId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this guild' });
    }
    
    const config = await getGuildConfig(guildId);
    
    // Update twitch config
    config.twitch = {
      ...(config.twitch || {}),
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    const updatedConfig = await setGuildConfig(guildId, { twitch: config.twitch });
    res.json({ success: true, twitch: updatedConfig.twitch });
  } catch (error) {
    console.error('Error updating twitch config:', error);
    res.status(500).json({ error: 'Failed to update Twitch configuration' });
  }
});

/**
 * POST /api/guilds/:guildId/twitch/account
 * Add a Twitch account to monitor
 */
router.post('/api/guilds/:guildId/twitch/account', requireAuth, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { username } = req.body;
    
    // Verify user has access to this guild
    const hasAccess = req.session.userGuilds?.some(g => g.id === guildId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this guild' });
    }
    
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Twitch username is required' });
    }
    
    const config = await getGuildConfig(guildId);
    
    // Initialize linkedAccounts array if it doesn't exist
    if (!Array.isArray(config.twitch.linkedAccounts)) {
      config.twitch.linkedAccounts = [];
    }
    
    // Check if account already exists
    const exists = config.twitch.linkedAccounts.some(acc => 
      acc.username.toLowerCase() === username.toLowerCase()
    );
    
    if (exists) {
      return res.status(400).json({ error: 'Twitch account already being monitored' });
    }
    
    // Add new account
    config.twitch.linkedAccounts.push({
      username: username.trim(),
      addedAt: new Date().toISOString()
    });
    
    const updatedConfig = await setGuildConfig(guildId, { twitch: config.twitch });
    res.status(201).json({ 
      success: true, 
      message: 'Twitch account added successfully',
      account: { username: username.trim() }
    });
  } catch (error) {
    console.error('Error adding Twitch account:', error);
    res.status(500).json({ error: 'Failed to add Twitch account' });
  }
});

/**
 * DELETE /api/guilds/:guildId/twitch/account/:username
 * Remove a Twitch account from monitoring
 */
router.delete('/api/guilds/:guildId/twitch/account/:username', requireAuth, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { username } = req.params;
    
    // Verify user has access to this guild
    const hasAccess = req.session.userGuilds?.some(g => g.id === guildId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this guild' });
    }
    
    if (!username) {
      return res.status(400).json({ error: 'Twitch username is required' });
    }
    
    const config = await getGuildConfig(guildId);
    
    // Filter out the account to remove
    const initialLength = config.twitch.linkedAccounts?.length || 0;
    config.twitch.linkedAccounts = (config.twitch.linkedAccounts || []).filter(acc => 
      acc.username.toLowerCase() !== username.toLowerCase()
    );
    
    const removed = initialLength !== (config.twitch.linkedAccounts?.length || 0);
    
    if (!removed) {
      return res.status(404).json({ error: 'Twitch account not found in monitoring list' });
    }
    
    const updatedConfig = await setGuildConfig(guildId, { twitch: config.twitch });
    res.json({ 
      success: true, 
      message: 'Twitch account removed successfully',
      removedUsername: username
    });
  } catch (error) {
    console.error('Error removing Twitch account:', error);
    res.status(500).json({ error: 'Failed to remove Twitch account' });
  }
});

module.exports = router;
