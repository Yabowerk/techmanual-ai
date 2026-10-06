import { Router } from 'express';
import { register, login, logout, getMe, refreshToken } from '../controllers/auth.controller.js';
import validate, { schemas } from '../middleware/validate.js';
import requireAuth from '../middleware/requireAuth.js';
import { authLimiter } from '../middleware/rateLimiters.js';

const router = Router();

/**
 * Register new user
 * POST /api/auth/register
 * Public route with rate limiting
 * Body: { email, password, name? }
 */
router.post('/register', 
  authLimiter,
  validate({
    body: schemas.register
  }),
  register
);

/**
 * Login existing user  
 * POST /api/auth/login
 * Public route with rate limiting
 * Body: { email, password }
 */
router.post('/login',
  authLimiter,
  validate({
    body: schemas.login
  }),
  login
);

/**
 * Logout current user
 * POST /api/auth/logout
 * No authentication required (just clears cookie)
 */
router.post('/logout', logout);

/**
 * Get current user profile
 * GET /api/auth/me
 * Requires authentication
 */
router.get('/me', requireAuth, getMe);

/**
 * Refresh authentication token
 * POST /api/auth/refresh
 * Body: { refreshToken }
 */
router.post('/refresh', 
  validate({
    body: schemas.refreshToken
  }),
  refreshToken
);

export default router;