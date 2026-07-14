const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getGuildConfig, setGuildConfig } = require('../services/guildService');

/**
 * GET /api/guilds/:guildId/reaction-roles
 * Get all reaction role panels for a guild
 */
router.get('/api/guilds/:guildId/reaction-roles', requireAuth, async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Verify user has access to this guild
    const hasAccess = req.session.userGuilds?.some(g => g.id === guildId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this guild' });
    }
    
    const config = await getGuildConfig(guildId);
    res.json(config.reactionRoles || []);
  } catch (error) {
    console.error('Error fetching reaction roles:', error);
    res.status(500).json({ error: 'Failed to fetch reaction roles' });
  }
});

/**
 * POST /api/guilds/:guildId/reaction-roles
 * Create a new reaction role panel
 */
router.post('/api/guilds/:guildId/reaction-roles', requireAuth, async (req, res) => {
  try {
    const { guildId } = req.params;
    const panelData = req.body;
    
    // Verify user has access to this guild
    const hasAccess = req.session.userGuilds?.some(g => g.id === guildId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this guild' });
    }
    
    // Validate required fields
    if (!panelData.channelId || !panelData.messageId) {
      return res.status(400).json({ error: 'Channel ID and Message ID are required' });
    }
    
    const config = await getGuildConfig(guildId);
    
    // Initialize reactionRoles array if it doesn't exist
    if (!Array.isArray(config.reactionRoles)) {
      config.reactionRoles = [];
    }
    
    // Add new panel with unique ID
    const newPanel = {
      id: Math.random().toString(36).substr(2, 9),
      ...panelData,
      createdAt: new Date().toISOString()
    };
    
    config.reactionRoles.push(newPanel);
    
    const updatedConfig = await setGuildConfig(guildId, { reactionRoles: config.reactionRoles });
    res.status(201).json({ success: true, panel: newPanel });
  } catch (error) {
    console.error('Error creating reaction role panel:', error);
    res.status(500).json({ error: 'Failed to create reaction role panel' });
  }
});

/**
 * PUT /api/guilds/:guildId/reaction-roles/:panelId
 * Update a reaction role panel
 */
router.put('/api/guilds/:guildId/reaction-roles/:panelId', requireAuth, async (req, res) => {
  try {
    const { guildId, panelId } = req.params;
    const updates = req.body;
    
    // Verify user has access to this guild
    const hasAccess = req.session.userGuilds?.some(g => g.id === guildId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this guild' });
    }
    
    const config = await getGuildConfig(guildId);
    
    // Find and update the panel
    const panelIndex = config.reactionRoles.findIndex(p => p.id === panelId);
    if (panelIndex === -1) {
      return res.status(404).json({ error: 'Reaction role panel not found' });
    }
    
    // Update the panel
    config.reactionRoles[panelIndex] = {
      ...config.reactionRoles[panelIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    const updatedConfig = await setGuildConfig(guildId, { reactionRoles: config.reactionRoles });
    res.json({ success: true, panel: config.reactionRoles[panelIndex] });
  } catch (error) {
    console.error('Error updating reaction role panel:', error);
    res.status(500).json({ error: 'Failed to update reaction role panel' });
  }
});

/**
 * DELETE /api/guilds/:guildId/reaction-roles/:panelId
 * Delete a reaction role panel
 */
router.delete('/api/guilds/:guildId/reaction-roles/:panelId', requireAuth, async (req, res) => {
  try {
    const { guildId, panelId } = req.params;
    
    // Verify user has access to this guild
    const hasAccess = req.session.userGuilds?.some(g => g.id === guildId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this guild' });
    }
    
    const config = await getGuildConfig(guildId);
    
    // Find and remove the panel
    const panelIndex = config.reactionRoles.findIndex(p => p.id === panelId);
    if (panelIndex === -1) {
      return res.status(404).json({ error: 'Reaction role panel not found' });
    }
    
    const [deletedPanel] = config.reactionRoles.splice(panelIndex, 1);
    
    const updatedConfig = await setGuildConfig(guildId, { reactionRoles: config.reactionRoles });
    res.json({ success: true, panel: deletedPanel });
  } catch (error) {
    console.error('Error deleting reaction role panel:', error);
    res.status(500).json({ error: 'Failed to delete reaction role panel' });
  }
});

/**
 * POST /api/guilds/:guildId/reaction-roles/:panelId/send
 * Send/publish a reaction role panel message
 */
router.post('/api/guilds/:guildId/reaction-roles/:panelId/send', requireAuth, async (req, res) => {
  try {
    const { guildId, panelId } = req.params;
    
    // Verify user has access to this guild
    const hasAccess = req.session.userGuilds?.some(g => g.id === guildId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this guild' });
    }
    
    // In a real implementation, this would:
    // 1. Get the panel configuration
    // 2. Use the bot's API to send a message to the specified channel
    // 3. Add the reactions as specified
    // 4. Update the panel with the message ID
    
    // For now, we'll just simulate success
    const config = await getGuildConfig(guildId);
    const panelIndex = config.reactionRoles.findIndex(p => p.id === panelId);
    
    if (panelIndex === -1) {
      return res.status(404).json({ error: 'Reaction role panel not found' });
    }
    
    // Simulate sending message (in reality, this would call bot API)
    const fakeMessageId = `msg_${Date.now()}`;
    config.reactionRoles[panelIndex].messageId = fakeMessageId;
    config.reactionRoles[panelIndex].sentAt = new Date().toISOString();
    
    await setGuildConfig(guildId, { reactionRoles: config.reactionRoles });
    
    res.json({ 
      success: true, 
      message: 'Reaction role panel sent successfully',
      messageId: fakeMessageId
    });
  } catch (error) {
    console.error('Error sending reaction role panel:', error);
    res.status(500).json({ error: 'Failed to send reaction role panel' });
  }
});

module.exports = router;
