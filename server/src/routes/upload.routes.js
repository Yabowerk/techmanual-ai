import { Router } from 'express';
import { uploadDocument, getUploadStatus, cancelUpload, getUploadStats } from '../controllers/upload.controller.js';
import upload, { handleUploadErrors, validateFileExists } from '../middleware/upload.js';
import validate, { schemas } from '../middleware/validate.js';
import requireAuth from '../middleware/requireAuth.js';
import { uploadLimiter } from '../middleware/rateLimiters.js';

const router = Router();

// All upload routes require authentication
router.use(requireAuth);

/**
 * Upload a PDF document
 * POST /api/upload
 * Content-Type: multipart/form-data
 * Field: file (PDF only, max 20MB)
 * Rate limited per user
 */
router.post('/',
  uploadLimiter,
  upload.single('file'),
  handleUploadErrors,
  validateFileExists,
  uploadDocument
);

/**
 * Get upload status for a specific document
 * GET /api/upload/status/:id
 * Returns processing status and progress
 */
router.get('/status/:id',
  validate({
    params: schemas.documentParams
  }),
  getUploadStatus
);

/**
 * Cancel an ongoing upload/processing
 * DELETE /api/upload/:id
 * Only works for documents in 'uploaded' or 'processing' status
 */
router.delete('/:id',
  validate({
    params: schemas.documentParams
  }),
  cancelUpload
);

/**
 * Get user's upload statistics
 * GET /api/upload/stats
 * Returns document counts by status and limits
 */
router.get('/stats', getUploadStats);

export default router;