import { Router } from 'express';
import authRoutes from './auth.routes.js';
import uploadRoutes from './upload.routes.js';
import docsRoutes from './docs.routes.js';
import chatRoutes from './chat.routes.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = Router();

/**
 * Health check endpoint
 * GET /api/health
 * Public endpoint to check if the API is running
 */
router.get('/health', asyncHandler(async (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
}));

/**
 * API status endpoint with more detailed information
 * GET /api/status
 * Public endpoint for monitoring and debugging
 */
router.get('/status', asyncHandler(async (req, res) => {
  const memoryUsage = process.memoryUsage();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    system: {
      platform: process.platform,
      nodeVersion: process.version,
      memoryUsage: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
      }
    },
    services: {
      database: 'connected', // This could be enhanced to actually check DB connection
      storage: 'available',
      embedding: 'configured', // Could check if API keys are present
      llm: 'configured',
      rerank: 'configured'
    }
  });
}));

/**
 * Mount all API routes
 */

// Authentication routes
router.use('/auth', authRoutes);

// File upload routes  
router.use('/upload', uploadRoutes);

// Document management routes
router.use('/docs', docsRoutes);

// Chat/conversation routes
router.use('/chat', chatRoutes);

/**
 * API root endpoint
 * GET /api/
 * Provides information about available endpoints
 */
router.get('/', asyncHandler(async (req, res) => {
  res.json({
    message: 'TechManual AI API',
    version: '1.0.0',
    description: 'RAG-powered technical manual chat API',
    endpoints: {
      health: 'GET /api/health - Health check',
      status: 'GET /api/status - Detailed system status',
      auth: {
        register: 'POST /api/auth/register - Register new user',
        login: 'POST /api/auth/login - User login',
        logout: 'POST /api/auth/logout - User logout',
        me: 'GET /api/auth/me - Get current user profile',
        refresh: 'POST /api/auth/refresh - Refresh auth token'
      },
      upload: {
        upload: 'POST /api/upload - Upload PDF document',
        status: 'GET /api/upload/status/:id - Get upload status',
        cancel: 'DELETE /api/upload/:id - Cancel upload',
        stats: 'GET /api/upload/stats - Get upload statistics'
      },
      docs: {
        list: 'GET /api/docs - List user documents',
        get: 'GET /api/docs/:id - Get document details',
        file: 'GET /api/docs/:id/file - Stream PDF file',
        chunks: 'GET /api/docs/:id/chunks - Get document chunks',
        update: 'PATCH /api/docs/:id - Update document',
        delete: 'DELETE /api/docs/:id - Delete document'
      },
      chat: {
        chat: 'POST /api/chat/:docId - Chat with document (SSE)',
        history: 'GET /api/chat/:docId - Get chat history',
        clear: 'DELETE /api/chat/:docId - Clear chat history',
        stats: 'GET /api/chat/stats - Get chat statistics'
      }
    },
    documentation: 'https://github.com/yourusername/techmanual-ai/blob/main/README.md'
  });
}));

export default router;