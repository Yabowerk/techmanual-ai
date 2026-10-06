import { Router } from 'express';
import { 
  getDocuments, 
  getDocument, 
  getFile, 
  deleteDocument, 
  getDocumentChunks, 
  updateDocument 
} from '../controllers/docs.controller.js';
import validate, { schemas } from '../middleware/validate.js';
import requireAuth from '../middleware/requireAuth.js';
import { z } from 'zod';

const router = Router();

// All document routes require authentication
router.use(requireAuth);

/**
 * Get all user's documents
 * GET /api/docs
 * Query: status?, page?, limit?
 */
router.get('/',
  validate({
    query: schemas.documentQuery
  }),
  getDocuments
);

/**
 * Get specific document details
 * GET /api/docs/:id
 */
router.get('/:id',
  validate({
    params: schemas.documentParams
  }),
  getDocument
);

/**
 * Handle CORS preflight for file endpoint specifically
 * OPTIONS /api/docs/:id/file
 */
router.options('/:id/file', (req, res) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Content-Disposition, Content-Length, Accept-Ranges');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  res.status(200).end();
});

/**
 * Stream PDF file for viewing
 * GET /api/docs/:id/file
 * Returns PDF file as stream with appropriate headers
 */
router.get('/:id/file',
  validate({
    params: schemas.documentParams
  }),
  getFile
);

/**
 * Get document chunks (for debugging/inspection)
 * GET /api/docs/:id/chunks
 * Query: page?, limit?
 */
router.get('/:id/chunks',
  validate({
    params: schemas.documentParams,
    query: z.object({
      page: z.string()
        .transform(val => parseInt(val))
        .refine(val => val > 0, 'Page must be positive')
        .optional(),
      limit: z.string()
        .transform(val => parseInt(val))
        .refine(val => val > 0 && val <= 50, 'Limit must be between 1 and 50')
        .optional()
    }).optional()
  }),
  getDocumentChunks
);

/**
 * Update document metadata
 * PATCH /api/docs/:id
 * Body: { title }
 */
router.patch('/:id',
  validate({
    params: schemas.documentParams,
    body: z.object({
      title: z.string()
        .min(1, 'Title is required')
        .max(200, 'Title too long')
        .trim()
    })
  }),
  updateDocument
);

/**
 * Delete document and all associated data
 * DELETE /api/docs/:id
 * Removes document, chunks, chats, and physical file
 */
router.delete('/:id',
  validate({
    params: schemas.documentParams
  }),
  deleteDocument
);

export default router;