const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');

/**
 * Exchange Discord authorization code for access token
 * @param {string} code - Authorization code from Discord
 * @returns {Promise<Object>} Token data
 */
async function exchangeCodeForToken(code) {
  const tokenUrl = 'https://discord.com/api/oauth2/token';
  const params = new URLSearchParams();
  params.append('client_id', process.env.CLIENT_ID);
  params.append('client_secret', process.env.DISCORD_CLIENT_SECRET);
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('redirect_uri', process.env.DISCORD_REDIRECT_URI);
  params.append('scope', 'identify guilds');

  try {
    const response = await axios.post(tokenUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to exchange code for token: ${error.message}`);
  }
}

/**
 * Get user data from Discord using access token
 * @param {string} accessToken - Discord access token
 * @returns {Promise<Object>} User data
 */
async function getUserData(accessToken) {
  try {
    const response = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get user data: ${error.message}`);
  }
}

/**
 * Get user's guilds from Discord
 * @param {string} accessToken - Discord access token
 * @returns {Promise<Array>} Array of guilds
 */
async function getUserGuilds(accessToken) {
  try {
    const response = await axios.get('https://discord.com/api/users/@me/guilds', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get user guilds: ${error.message}`);
  }
}

module.exports = {
  exchangeCodeForToken,
  getUserData,
  getUserGuilds
};
