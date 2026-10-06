import { z } from 'zod';
import ApiError from '../utils/ApiError.js';

/**
 * Generic validation middleware factory using Zod
 * @param {Object} schemas - Object containing validation schemas for body, params, query
 * @param {z.ZodSchema} schemas.body - Schema for request body validation
 * @param {z.ZodSchema} schemas.params - Schema for route parameters validation
 * @param {z.ZodSchema} schemas.query - Schema for query parameters validation
 * @returns {Function} - Express middleware function
 */
const validate = (schemas) => {
  return (req, res, next) => {
    try {
      const validationErrors = [];

      // Validate request body
      if (schemas.body) {
        try {
          req.body = schemas.body.parse(req.body);
        } catch (error) {
          if (error instanceof z.ZodError) {
            error.errors.forEach(err => {
              validationErrors.push(`Body.${err.path.join('.')}: ${err.message}`);
            });
          }
        }
      }

      // Validate route parameters
      if (schemas.params) {
        try {
          req.params = schemas.params.parse(req.params);
        } catch (error) {
          if (error instanceof z.ZodError) {
            error.errors.forEach(err => {
              validationErrors.push(`Params.${err.path.join('.')}: ${err.message}`);
            });
          }
        }
      }

      // Validate query parameters
      if (schemas.query) {
        try {
          req.query = schemas.query.parse(req.query);
        } catch (error) {
          if (error instanceof z.ZodError) {
            error.errors.forEach(err => {
              validationErrors.push(`Query.${err.path.join('.')}: ${err.message}`);
            });
          }
        }
      }

      // If there are validation errors, throw a bad request error
      if (validationErrors.length > 0) {
        throw ApiError.badRequest(`Validation failed: ${validationErrors.join(', ')}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Common validation schemas
 */
export const schemas = {
  // MongoDB ObjectId validation
  objectId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format'),

  // Authentication schemas
  register: z.object({
    email: z.string()
      .email('Invalid email format')
      .min(1, 'Email is required')
      .max(100, 'Email too long')
      .toLowerCase(),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password too long'),
    name: z.string()
      .min(1, 'Name is required')
      .max(100, 'Name too long')
      .trim()
      .optional()
  }),

  login: z.object({
    email: z.string()
      .email('Invalid email format')
      .min(1, 'Email is required')
      .toLowerCase(),
    password: z.string()
      .min(1, 'Password is required')
  }),

  refreshToken: z.object({
    refreshToken: z.string()
      .min(1, 'Refresh token is required')
  }),

  // Chat schemas
  chatMessage: z.object({
    question: z.string()
      .min(1, 'Question is required')
      .max(1000, 'Question too long')
      .trim()
  }),

  // Document parameter schemas
  documentParams: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid document ID')
  }),

  // Chat parameter schemas
  chatParams: z.object({
    docId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid document ID')
  }),

  // Query schemas
  documentQuery: z.object({
    status: z.enum(['uploaded', 'processing', 'ready', 'failed']).optional(),
    page: z.string()
      .transform(val => parseInt(val))
      .refine(val => val > 0, 'Page must be positive')
      .optional(),
    limit: z.string()
      .transform(val => parseInt(val))
      .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100')
      .optional()
  }).optional()
};

export default validate;