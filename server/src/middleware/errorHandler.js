import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import config from '../config/env.js';

/**
 * Convert error to ApiError instance
 * @param {Error} err - Original error
 * @returns {ApiError} - Standardized API error
 */
const convertToApiError = (err) => {
  let error = err;

  // Mongoose CastError (invalid ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    const message = 'Invalid ID format';
    error = ApiError.badRequest(message);
  }

  // Mongoose ValidationError
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map(e => e.message);
    const message = errors.join(', ');
    error = ApiError.badRequest(message);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    const message = field === 'email' 
      ? 'Email address is already registered'
      : 'Duplicate value entered';
    error = ApiError.conflict(message);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = ApiError.unauthorized('Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    error = ApiError.unauthorized('Token expired');
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = ApiError.payloadTooLarge(`File too large. Maximum size is ${config.MAX_UPLOAD_MB}MB`);
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    error = ApiError.badRequest('Too many files uploaded');
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = ApiError.badRequest('Unexpected file field');
  }

  // If it's not already an ApiError, make it one
  if (!(error instanceof ApiError)) {
    error = ApiError.internal('Something went wrong');
  }

  return error;
};

/**
 * Global error handler middleware
 * Converts all errors to standardized API error responses
 */
export const errorHandler = (err, req, res, next) => {
  let error = convertToApiError(err);

  // Log error details (but not in production for security)
  if (config.NODE_ENV === 'development') {
    console.error('Error details:', {
      name: err.name,
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  } else {
    // In production, only log non-operational errors
    if (!error.isOperational) {
      console.error('Unexpected error:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method
      });
    }
  }

  // Send error response
  res.status(error.statusCode || 500).json({
    error: {
      message: error.message,
      status: error.statusCode || 500,
      ...(config.NODE_ENV === 'development' && { stack: error.stack })
    }
  });
};

/**
 * 404 Not Found handler
 * Must be placed after all routes
 */
export const notFoundHandler = (req, res, next) => {
  const error = ApiError.notFound(`Route ${req.originalUrl} not found`);
  next(error);
};

/**
 * Async error catcher for unhandled promise rejections
 * Should be called during app initialization
 */
export const handleUncaughtErrors = () => {
  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    console.error('Error:', err);
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION! 💥 Shutting down...');
    console.error('Error:', err);
    process.exit(1);
  });

  // Handle SIGTERM (graceful shutdown)
  process.on('SIGTERM', () => {
    console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
    process.exit(0);
  });
};