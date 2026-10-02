import rateLimit from 'express-rate-limit';
import ApiError from '../utils/ApiError.js';

/**
 * Custom error handler for rate limit exceeded
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const rateLimitHandler = (req, res, next) => {
  const error = ApiError.tooManyRequests(
    'Too many requests. Please try again later.'
  );
  next(error);
};

/**
 * Custom key generator to identify users for rate limiting
 * Uses user ID if authenticated, otherwise falls back to IP
 * @param {Object} req - Express request object
 * @returns {string} - Unique identifier for rate limiting
 */
const generateKey = (req) => {
  return req.user ? `user_${req.user.id}` : `ip_${req.ip}`;
};

/**
 * Rate limiter for authentication endpoints (register/login)
 * Prevents brute force attacks on authentication
 * 10 requests per 15 minutes per IP address
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  handler: rateLimitHandler,
  keyGenerator: (req) => req.ip, // Use IP for auth endpoints
});

/**
 * Rate limiter for file upload endpoints
 * Prevents abuse of upload functionality
 * 10 uploads per hour per user
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 uploads per hour
  message: 'Upload limit exceeded. You can upload up to 10 files per hour.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: generateKey, // Use user ID or IP
  skip: (req) => {
    // Skip rate limiting if no user (should not happen for upload endpoints)
    return !req.user;
  }
});

/**
 * Rate limiter for chat endpoints
 * Prevents excessive API usage and protects against abuse
 * 30 requests per 10 minutes per user
 */
export const chatLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30, // 30 requests per window
  message: 'Chat limit exceeded. Please wait before sending more messages.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: generateKey, // Use user ID or IP
  skip: (req) => {
    // Skip rate limiting if no user (should not happen for chat endpoints)
    return !req.user;
  }
});

/**
 * General API rate limiter for public endpoints
 * Provides basic protection against abuse
 * 100 requests per 15 minutes per IP
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => req.ip,
});

/**
 * Strict rate limiter for sensitive operations
 * Used for operations like password reset, account deletion, etc.
 * 5 requests per hour per IP
 */
export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour
  message: 'Too many sensitive requests. Please try again in an hour.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => req.ip,
});