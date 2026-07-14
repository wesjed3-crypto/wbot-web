const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getGuildConfig, setGuildConfig } = require('../services/guildService');

/**
 * GET /api/guilds/:guildId/ticket-panels
 * Get all ticket panels for a guild
 */
router.get('/api/guilds/:guildId/ticket-panels', requireAuth, async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Verify user has access to this guild
    const hasAccess = req.session.userGuilds?.some(g => g.id === guildId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this guild' });
    }
    
    const config = await getGuildConfig(guildId);
    res.json(config.ticketPanels || []);
  } catch (error) {
    console.error('Error fetching ticket panels:', error);
    res.status(500).json({ error: 'Failed to fetch ticket panels' });
  }
});

/**
 * POST /api/guilds/:guildId/ticket-panels
 * Create a new ticket panel
 */
router.post('/api/guilds/:guildId/ticket-panels', requireAuth, async (req, res) => {
  try {
    const { guildId } = req.params;
    const panelData = req.body;
    
    // Verify user has access to this guild
    const hasAccess = req.session.userGuilds?.some(g => g.id === guildId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this guild' });
    }
    
    // Validate required fields
    if (!panelData.channelId || !panelData.categoryId) {
      return res.status(400).json({ error: 'Channel ID and Category ID are required' });
    }
    
    const config = await getGuildConfig(guildId);
    
    // Initialize ticketPanels array if it doesn't exist
    if (!Array.isArray(config.ticketPanels)) {
      config.ticketPanels = [];
    }
    
    // Add new panel with unique ID
    const newPanel = {
      id: Math.random().toString(36).substr(2, 9),
      ...panelData,
      createdAt: new Date().toISOString()
    };
    
    config.ticketPanels.push(newPanel);
    
    const updatedConfig = await setGuildConfig(guildId, { ticketPanels: config.ticketPanels });
    res.status(201).json({ success: true, panel: newPanel });
  } catch (error) {
    console.error('Error creating ticket panel:', error);
    res.status(500).json({ error: 'Failed to create ticket panel' });
  }
});

/**
 * PUT /api/guilds/:guildId/ticket-panels/:panelId
 * Update a ticket panel
 */
router.put('/api/guilds/:guildId/ticket-panels/:panelId', requireAuth, async (req, res) => {
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
    const panelIndex = config.ticketPanels.findIndex(p => p.id === panelId);
    if (panelIndex === -1) {
      return res.status(404).json({ error: 'Ticket panel not found' });
    }
    
    // Update the panel
    config.ticketPanels[panelIndex] = {
      ...config.ticketPanels[panelIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    const updatedConfig = await setGuildConfig(guildId, { ticketPanels: config.ticketPanels });
    res.json({ success: true, panel: config.ticketPanels[panelIndex] });
  } catch (error) {
    console.error('Error updating ticket panel:', error);
    res.status(500).json({ error: 'Failed to update ticket panel' });
  }
});

/**
 * DELETE /api/guilds/:guildId/ticket-panels/:panelId
 * Delete a ticket panel
 */
router.delete('/api/guilds/:guildId/ticket-panels/:panelId', requireAuth, async (req, res) => {
  try {
    const { guildId, panelId } = req.params;
    
    // Verify user has access to this guild
    const hasAccess = req.session.userGuilds?.some(g => g.id === guildId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this guild' });
    }
    
    const config = await getGuildConfig(guildId);
    
    // Find and remove the panel
    const panelIndex = config.ticketPanels.findIndex(p => p.id === panelId);
    if (panelIndex === -1) {
      return res.status(404).json({ error: 'Ticket panel not found' });
    }
    
    const [deletedPanel] = config.ticketPanels.splice(panelIndex, 1);
    
    const updatedConfig = await setGuildConfig(guildId, { ticketPanels: config.ticketPanels });
    res.json({ success: true, panel: deletedPanel });
  } catch (error) {
    console.error('Error deleting ticket panel:', error);
    res.status(500).json({ error: 'Failed to delete ticket panel' });
  }
});

/**
 * POST /api/guilds/:guildId/ticket-panels/:panelId/send
 * Send/publish a ticket panel message
 */
router.post('/api/guilds/:guildId/ticket-panels/:panelId/send', requireAuth, async (req, res) => {
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
    // 3. Add the buttons/actions as specified
    // 4. Update the panel with the message ID
    
    // For now, we'll just simulate success
    const config = await getGuildConfig(guildId);
    const panelIndex = config.ticketPanels.findIndex(p => p.id === panelId);
    
    if (panelIndex === -1) {
      return res.status(404).json({ error: 'Ticket panel not found' });
    }
    
    // Simulate sending message (in reality, this would call bot API)
    const fakeMessageId = `msg_${Date.now()}`;
    config.ticketPanels[panelIndex].messageId = fakeMessageId;
    config.ticketPanels[panelIndex].sentAt = new Date().toISOString();
    
    await setGuildConfig(guildId, { ticketPanels: config.ticketPanels });
    
    res.json({ 
      success: true, 
      message: 'Ticket panel sent successfully',
      messageId: fakeMessageId
    });
  } catch (error) {
    console.error('Error sending ticket panel:', error);
    res.status(500).json({ error: 'Failed to send ticket panel' });
  }
});

module.exports = router;
