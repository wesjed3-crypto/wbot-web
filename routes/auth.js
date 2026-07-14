const express = require('express');
const router = express.Router();
const { exchangeCodeForToken, getUserData, getUserGuilds } = require('../services/authService');
const { requireAuth } = require('../middleware/auth');

/**
 * GET /login
 * Redirect to Discord OAuth2
 */
router.get('/login', (req, res) => {
  const redirectUri = encodeURIComponent(process.env.DISCORD_REDIRECT_URI);
  const scope = encodeURIComponent('identify guilds');
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
  
  res.redirect(discordAuthUrl);
});

/**
 * GET /callback
 * Handle Discord OAuth2 callback
 */
router.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).send('Error: No code provided');
    }
    
    // Exchange code for token
    const tokenData = await exchangeCodeForToken(code);
    
    // Get user data
    const userData = await getUserData(tokenData.access_token);
    
    // Get user's guilds
    const userGuilds = await getUserGuilds(tokenData.access_token);
    
    // Store in session
    req.session.user = {
      id: userData.id,
      username: userData.username,
      discriminator: userData.discriminator,
      avatar: userData.avatar,
      global_name: userData.global_name
    };
    
    req.session.accessToken = tokenData.access_token;
    req.session.refreshToken = tokenData.refresh_token;
    req.session.expiresIn = tokenData.expires_in;
    req.session.userGuilds = userGuilds;
    
    // Redirect to home/dashboard
    res.redirect('/');
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Error during authentication');
  }
});

/**
 * GET /logout
 * Log out user
 */
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

/**
 * GET /api/status
 * Get authentication status
 */
router.get('/api/status', requireAuth, (req, res) => {
  res.json({
    loggedIn: !!req.session.user,
    user: req.session.user || null,
    isOwner: req.session.user && req.session.user.id === process.env.OWNER_ID,
    guildCount: req.session.userGuilds ? req.session.userGuilds.length : 0
  });
});

module.exports = router;
