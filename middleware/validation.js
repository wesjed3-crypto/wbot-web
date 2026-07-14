const { validationResult } = require('express-validator');

/**
 * Validation result middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      errors: errors.array().map(err => ({ 
        field: err.param, 
        message: err.msg 
      })) 
    });
  }
  next();
}

/**
 * Validate Discord ID (snowflake)
 */
function validateDiscordId(fieldName) {
  return [
    require('express-validator').check(fieldName)
      .trim()
      .notEmpty().withMessage(`${fieldName} is required`)
      .matches(/^[0-9]{17,19}$/).withMessage(`${fieldName} must be a valid Discord ID`)
  ];
}

/**
 * Validate hex color
 */
function validateHexColor(fieldName) {
  return [
    require('express-validator').check(fieldName)
      .optional()
      .matches(/^#[0-9A-F]{6}$/i).withMessage(`${fieldName} must be a valid hex color (e.g., #FF5733)`)
  ];
}

/**
 * Validate non-empty string
 */
function validateString(fieldName, options = {}) {
  const checks = [
    require('express-validator').check(fieldName)
      .trim()
  ];
  
  if (!options.optional) {
    checks.push(
      require('express-validator').check(fieldName)
        .notEmpty().withMessage(`${fieldName} is required`)
    );
  }
  
  if (options.maxLength) {
    checks.push(
      require('express-validator').check(fieldName)
        .isLength({ max: options.maxLength })
        .withMessage(`${fieldName} must be at most ${options.maxLength} characters`)
    );
  }
  
  if (options.minLength) {
    checks.push(
      require('express-validator').check(fieldName)
        .isLength({ min: options.minLength })
        .withMessage(`${fieldName} must be at least ${options.minLength} characters`)
    );
  }
  
  return checks;
}

module.exports = {
  validateRequest,
  validateDiscordId,
  validateHexColor,
  validateString
};
