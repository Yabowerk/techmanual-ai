import jwt from 'jsonwebtoken';
import ApiError from '../utils/ApiError.js';
import config from '../config/env.js';

/**
 * Authentication middleware
 * Verifies JWT token from cookie and attaches user to request
 */
const requireAuth = (req, res, next) => {
  try {
    // Extract token from cookie
    const token = req.cookies?.token;

    if (!token) {
      throw ApiError.unauthorized('Access token required');
    }

    // Verify the token
    const decoded = jwt.verify(token, config.JWT_SECRET);

    // Attach user info to request
    req.user = { id: decoded.id };

    next();
  } catch (error) {
    // Handle JWT-specific errors
    if (error.name === 'JsonWebTokenError') {
      return next(ApiError.unauthorized('Invalid token'));
    }
    
    if (error.name === 'TokenExpiredError') {
      return next(ApiError.unauthorized('Token expired'));
    }

    // Pass through other errors (like ApiError instances)
    next(error);
  }
};

export default requireAuth;