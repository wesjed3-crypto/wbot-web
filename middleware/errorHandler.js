/**
 * Centralized error handling middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err);
  
  // Default error status
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  
  // Determine error message based on environment
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal Server Error' 
    : err.message || 'Internal Server Error';
  
  // Log error details in development
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${new Date().toISOString()}] ${err.stack}`);
  }
  
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}

/**
 * 404 Not Found middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
