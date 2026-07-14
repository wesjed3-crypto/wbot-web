const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getGuildConfig, setGuildConfig, deleteGuildConfig } = require('../services/guildService');

/**
 * GET /api/guilds
 * Get user's guilds
 */
router.get('/api/guilds', requireAuth, async (req, res) => {
  try {
    // In a real implementation, we would fetch from Discord again
    // For now, we'll return from session if available
    if (req.session.userGuilds) {
      res.json(req.session.userGuilds);
    } else {
      res.status(401).json({ error: 'User session expired' });
    }
  } catch (error) {
    console.error('Error fetching guilds:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/guilds/:guildId/channels
 * Get guild channels
 */
router.get('/api/guilds/:guildId/channels', requireAuth, async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Verify user has access to this guild
    const hasAccess = req.session.userGuilds?.some(g => g.id === guildId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this guild' });
    }
    
    // Fetch from Discord API
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
      headers: {
        Authorization: `Bearer ${req.session.accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status}`);
    }
    
    const channels = await response.json();
    // Filter to text channels
    const textChannels = channels.filter(c => c.type === 0 || c.type === 5 || c.type === 10 || c.type === 11 || c.type === 12 || c.type === 13 || c.type === 14);
    res.json(textChannels);
  } catch (error) {
    console.error('Error fetching guild channels:', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

/**
 * GET /api/guilds/:guildId/roles
 * Get guild roles
 */
router.get('/api/guilds/:guildId/roles', requireAuth, async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Verify user has access to this guild
    const hasAccess = req.session.userGuilds?.some(g => g.id === guildId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this guild' });
    }
    
    // Fetch from Discord API
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
      headers: {
        Authorization: `Bearer ${req.session.accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status}`);
    }
    
    const roles = await response.json();
    // Sort by position (higher position = higher in hierarchy)
    roles.sort((a, b) => b.position - a.position);
    res.json(roles);
  } catch (error) {
    console.error('Error fetching guild roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

/**
 * GET /api/guilds/:guildId/config
 * Get guild configuration
 */
router.get('/api/guilds/:guildId/config', requireAuth, async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Verify user has access to this guild
    const hasAccess = req.session.userGuilds?.some(g => g.id === guildId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this guild' });
    }
    
    const config = await getGuildConfig(guildId);
    res.json(config);
  } catch (error) {
    console.error('Error fetching guild config:', error);
    res.status(500).json({ error: 'Failed to fetch guild configuration' });
  }
});

/**
 * PUT /api/guilds/:guildId/config
 * Update guild configuration
 */
router.put('/api/guilds/:guildId/config', requireAuth, async (req, res) => {
  try {
    const { guildId } = req.params;
    const configUpdates = req.body;
    
    // Verify user has access to this guild
    const hasAccess = req.session.userGuilds?.some(g => g.id === guildId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this guild' });
    }
    
    // Basic validation - ensure we're not trying to set invalid fields
    const allowedSections = [
      'logChannelId', 'mutedRoleId', 'logEvents', 'autoMod', 
      'punishments', 'welcome', 'farewell', 'antiNuke', 
      'tickets', 'reactionRoles', 'ticketPanels', 
      'inviteLogger', 'boostLogger', 'levelSystem', 'twitch'
    ];
    
    // Filter to only allowed sections
    const filteredUpdates = {};
    for (const [key, value] of Object.entries(configUpdates)) {
      if (allowedSections.includes(key)) {
        filteredUpdates[key] = value;
      }
    }
    
    const updatedConfig = await setGuildConfig(guildId, filteredUpdates);
    res.json({ success: true, config: updatedConfig });
  } catch (error) {
    console.error('Error updating guild config:', error);
    res.status(500).json({ error: 'Failed to update guild configuration' });
  }
});

module.exports = router;
