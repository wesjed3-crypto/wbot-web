/**
 * Middleware to check if user is authenticated
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function requireAuth(req, res, next) {
  if (!req.session.user || !req.session.accessToken) {
    return res.status(401).json({ error: "No has iniciado sesión." });
  }
  next();
}

/**
 * Middleware to check if user is the bot owner
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function requireOwner(req, res, next) {
  if (!req.session.user || req.session.user.id !== process.env.OWNER_ID) {
    return res.status(403).json({ error: "Solo el propietario puede usar este panel." });
  }
  next();
}

/**
 * Middleware to check if user has access to a specific guild
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function requireGuildAccess(req, res, next) {
  const { guildId } = req.params;
  
  if (!req.session.user || !req.session.accessToken) {
    return res.status(401).json({ error: "No has iniciado sesión." });
  }
  
  // Check if user has access to this guild
  const hasAccess = req.session.userGuilds?.some(g => g.id === guildId);
  if (!hasAccess) {
    return res.status(403).json({ error: "No tienes acceso a este servidor." });
  }
  
  next();
}

module.exports = {
  requireAuth,
  requireOwner,
  requireGuildAccess
};
