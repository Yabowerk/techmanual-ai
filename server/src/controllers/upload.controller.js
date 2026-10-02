import User from '../models/User.js';
import Document from '../models/Document.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import config from '../config/env.js';
import { saveFile } from '../services/storage.service.js';
import { ingestDocument } from '../services/ingest.service.js';

/**
 * Upload and process a PDF document
 * POST /api/upload
 * Requires authentication
 * Content-Type: multipart/form-data
 * Field: file (PDF only, max 20MB)
 */
export const uploadDocument = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const file = req.file;

  // Validate file exists (should be caught by middleware, but double-check)
  if (!file) {
    throw ApiError.badRequest('No file uploaded. Please select a PDF file.');
  }

  // Validate file type (should be caught by multer filter, but double-check)
  if (file.mimetype !== 'application/pdf') {
    throw ApiError.badRequest('Only PDF files are allowed.');
  }

  // Check user's document limit
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.unauthorized('User not found');
  }

  // Count user's existing documents
  const documentCount = await Document.countDocuments({ userId });
  if (documentCount >= config.MAX_DOCS_PER_USER) {
    throw ApiError.forbidden(
      `Document limit exceeded. You can upload up to ${config.MAX_DOCS_PER_USER} documents. Please delete a document before uploading a new one.`
    );
  }

  try {
    // Save file to storage
    console.log(`📤 Saving uploaded file: ${file.originalname} (${file.size} bytes)`);
    const fileKey = await saveFile(file.buffer, file.originalname);

    // Create document record with "processing" status
    const document = new Document({
      userId,
      originalFilename: file.originalname,
      fileKey,
      status: 'uploaded' // Will be updated to 'processing' by ingestion service
    });

    await document.save();
    console.log(`📋 Created document record: ${document._id}`);

    // Start background ingestion process (don't await - this runs async)
    // The ingestion service will update the document status as it progresses
    ingestDocument({
      documentId: document._id.toString(),
      userId,
      buffer: file.buffer
    }).catch(error => {
      // Errors are handled within ingestDocument, but log here for visibility
      console.error(`❌ Ingestion process failed for document ${document._id}:`, error.message);
    });

    console.log(`🚀 Started background ingestion for document ${document._id}`);

    // Return 202 Accepted with document ID immediately
    // Client can poll the document status or use webhooks for completion notification
    res.status(202).json({
      message: 'File uploaded successfully. Processing started in background.',
      documentId: document._id,
      document: {
        id: document._id,
        title: document.title,
        originalFilename: document.originalFilename,
        status: document.status,
        createdAt: document.createdAt
      }
    });

  } catch (error) {
    // If storage fails, clean up any created records
    console.error('❌ Upload failed:', error);
    
    // Re-throw the error for proper error handling
    if (error instanceof ApiError) {
      throw error;
    } else {
      throw ApiError.internal('Failed to process uploaded file');
    }
  }
});

/**
 * Get upload progress/status for a document
 * GET /api/upload/status/:id
 * Requires authentication
 */
export const getUploadStatus = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const documentId = req.params.id;

  // Find document and verify ownership
  const document = await Document.findOne({ _id: documentId, userId });
  
  if (!document) {
    throw ApiError.notFound('Document not found');
  }

  // Return current status and progress information
  res.json({
    document: {
      id: document._id,
      title: document.title,
      originalFilename: document.originalFilename,
      status: document.status,
      pageCount: document.pageCount,
      summary: document.summary,
      errorMessage: document.errorMessage,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt
    }
  });
});

/**
 * Cancel an ongoing upload/processing
 * DELETE /api/upload/:id
 * Requires authentication
 */
export const cancelUpload = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const documentId = req.params.id;

  // Find document and verify ownership
  const document = await Document.findOne({ _id: documentId, userId });
  
  if (!document) {
    throw ApiError.notFound('Document not found');
  }

  // Only allow cancellation of documents that are still processing
  if (!['uploaded', 'processing'].includes(document.status)) {
    throw ApiError.badRequest('Cannot cancel a document that has finished processing');
  }

  try {
    // Update document status to indicate cancellation
    document.status = 'failed';
    document.errorMessage = 'Processing cancelled by user';
    await document.save();

    // Note: The actual background process cancellation would require more complex
    // implementation with process tracking and cancellation tokens.
    // For now, we just mark it as failed and let cleanup happen naturally.

    console.log(`🚫 Upload cancelled for document ${documentId}`);

    res.json({
      message: 'Upload cancelled successfully',
      documentId: document._id
    });

  } catch (error) {
    console.error('❌ Failed to cancel upload:', error);
    throw ApiError.internal('Failed to cancel upload');
  }
});

/**
 * Get user's upload statistics
 * GET /api/upload/stats
 * Requires authentication
 */
export const getUploadStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  try {
    // Get document counts by status
    const stats = await Document.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Convert to more readable format
    const statusCounts = {
      uploaded: 0,
      processing: 0,
      ready: 0,
      failed: 0
    };

    stats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
    });

    const totalDocuments = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

    res.json({
      totalDocuments,
      maxDocuments: config.MAX_DOCS_PER_USER,
      documentsRemaining: config.MAX_DOCS_PER_USER - totalDocuments,
      statusBreakdown: statusCounts
    });

  } catch (error) {
    console.error('❌ Failed to get upload stats:', error);
    throw ApiError.internal('Failed to retrieve upload statistics');
  }
});