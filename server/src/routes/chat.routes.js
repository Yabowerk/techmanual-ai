import { Router } from 'express';
import { 
  streamChat, 
  getChatHistory, 
  clearChatHistory, 
  getChatStats,
  regenerateWelcomeMessage
} from '../controllers/chat.controller.js';
import validate, { schemas } from '../middleware/validate.js';
import requireAuth from '../middleware/requireAuth.js';
import { chatLimiter } from '../middleware/rateLimiters.js';

const router = Router();

// All chat routes require authentication
router.use(requireAuth);

/**
 * Get user's chat statistics
 * GET /api/chat/stats
 * Returns aggregate chat usage statistics
 */
router.get('/stats', getChatStats);

/**
 * Stream chat response for a document
 * POST /api/chat/:docId
 * Body: { question }
 * Returns: Server-Sent Events stream
 * Rate limited per user
 */
router.post('/:docId',
  chatLimiter,
  validate({
    params: schemas.chatParams,
    body: schemas.chatMessage
  }),
  streamChat
);

/**
 * Get chat history for a document
 * GET /api/chat/:docId
 * Returns conversation history and document info
 */
router.get('/:docId',
  validate({
    params: schemas.chatParams
  }),
  getChatHistory
);

/**
 * Clear chat history for a document
 * DELETE /api/chat/:docId
 * Removes all messages but keeps the chat record
 */
router.delete('/:docId',
  validate({
    params: schemas.chatParams
  }),
  clearChatHistory
);

/**
 * Regenerate welcome message for a document
 * POST /api/chat/:docId/welcome
 * Useful for documents processed before this feature was added
 */
router.post('/:docId/welcome',
  validate({
    params: schemas.chatParams
  }),
  regenerateWelcomeMessage
);

export default router;