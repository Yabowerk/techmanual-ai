import Document from '../models/Document.js';
import Chunk from '../models/Chunk.js';
import Chat from '../models/Chat.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { getFileStream, deleteFile } from '../services/storage.service.js';

/**
 * Get all documents for the authenticated user
 * GET /api/docs
 * Query params: status?, page?, limit?
 */
export const getDocuments = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { status, page = 1, limit = 20 } = req.query;

  // Build query with user isolation
  const query = { userId };
  
  if (status) {
    query.status = status;
  }

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Execute query with pagination
  const [documents, totalCount] = await Promise.all([
    Document.find(query)
      .select('-fileKey') // Don't expose internal file keys
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Document.countDocuments(query)
  ]);

  // Calculate pagination info
  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  res.json({
    documents: documents.map(doc => ({
      id: doc._id,
      title: doc.title,
      originalFilename: doc.originalFilename,
      status: doc.status,
      pageCount: doc.pageCount,
      summary: doc.summary,
      errorMessage: doc.errorMessage,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    })),
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalCount,
      limit: parseInt(limit),
      hasNextPage,
      hasPrevPage
    }
  });
});

/**
 * Get a specific document by ID
 * GET /api/docs/:id
 */
export const getDocument = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const documentId = req.params.id;

  // Find document with user isolation
  const document = await Document.findOne({ _id: documentId, userId });

  if (!document) {
    throw ApiError.notFound('Document not found');
  }

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
 * Stream the PDF file for viewing
 * GET /api/docs/:id/file
 * Returns the original PDF file as a stream
 */
export const getFile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const documentId = req.params.id;

  // Find document with user isolation and include fileKey
  const document = await Document.findOne({ _id: documentId, userId }).select('+fileKey');

  if (!document) {
    throw ApiError.notFound('Document not found');
  }

  if (!document.fileKey) {
    throw ApiError.notFound('File not found for this document');
  }

  try {
    // Get file stream from storage service
    const fileStream = await getFileStream(document.fileKey);

    // Set appropriate headers for PDF viewing
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${document.originalFilename}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour

    // Stream the file to the client
    fileStream.pipe(res);

    // Handle stream errors
    fileStream.on('error', (error) => {
      console.error(`❌ Error streaming file ${document.fileKey}:`, error);
      if (!res.headersSent) {
        res.status(500).json({
          error: {
            message: 'Failed to retrieve file',
            status: 500
          }
        });
      }
    });

    console.log(`📄 Streaming file ${document.fileKey} for user ${userId}`);

  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error(`❌ Failed to get file stream for ${document.fileKey}:`, error);
    throw ApiError.internal('Failed to retrieve file');
  }
});

/**
 * Delete a document and all associated data
 * DELETE /api/docs/:id
 * Removes document, chunks, chats, and the physical file
 */
export const deleteDocument = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const documentId = req.params.id;

  // Find document with user isolation and include fileKey
  const document = await Document.findOne({ _id: documentId, userId }).select('+fileKey');

  if (!document) {
    throw ApiError.notFound('Document not found');
  }

  try {
    console.log(`🗑️  Starting deletion of document ${documentId}`);

    // Delete in parallel for efficiency
    const deletionPromises = [
      // Delete all chunks associated with this document
      Chunk.deleteMany({ documentId, userId }),
      
      // Delete all chats associated with this document
      Chat.deleteMany({ documentId, userId }),
      
      // Delete the physical file from storage
      document.fileKey ? deleteFile(document.fileKey) : Promise.resolve(),
      
      // Delete the document record itself
      Document.findByIdAndDelete(documentId)
    ];

    const [chunksResult, chatsResult, fileDeleted, documentDeleted] = await Promise.all(deletionPromises);

    console.log(`✅ Document deletion completed:`, {
      documentId,
      chunksDeleted: chunksResult.deletedCount,
      chatsDeleted: chatsResult.deletedCount,
      fileDeleted,
      documentDeleted: !!documentDeleted
    });

    res.json({
      message: 'Document deleted successfully',
      deletionSummary: {
        document: !!documentDeleted,
        chunks: chunksResult.deletedCount,
        chats: chatsResult.deletedCount,
        file: fileDeleted
      }
    });

  } catch (error) {
    console.error(`❌ Failed to delete document ${documentId}:`, error);
    throw ApiError.internal('Failed to delete document. Some data may remain.');
  }
});

/**
 * Get document chunks (for debugging/inspection)
 * GET /api/docs/:id/chunks
 * Query params: page?, limit?
 */
export const getDocumentChunks = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const documentId = req.params.id;
  const { page = 1, limit = 10 } = req.query;

  // First verify the document exists and belongs to the user
  const document = await Document.findOne({ _id: documentId, userId });
  if (!document) {
    throw ApiError.notFound('Document not found');
  }

  // Only allow viewing chunks for ready documents
  if (document.status !== 'ready') {
    throw ApiError.badRequest('Document is not ready. Chunks are only available for processed documents.');
  }

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Get chunks with pagination (excluding embeddings)
  const [chunks, totalCount] = await Promise.all([
    Chunk.find({ documentId, userId })
      .select('-embedding') // Don't include embedding vectors in response
      .sort({ page: 1, chunkIndex: 1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Chunk.countDocuments({ documentId, userId })
  ]);

  // Calculate pagination info
  const totalPages = Math.ceil(totalCount / limit);

  res.json({
    chunks: chunks.map(chunk => ({
      id: chunk._id,
      text: chunk.text,
      page: chunk.page,
      section: chunk.section,
      chunkIndex: chunk.chunkIndex,
      createdAt: chunk.createdAt
    })),
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalCount,
      limit: parseInt(limit),
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    },
    document: {
      id: document._id,
      title: document.title,
      status: document.status
    }
  });
});

/**
 * Update document metadata (title only)
 * PATCH /api/docs/:id
 * Body: { title }
 */
export const updateDocument = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const documentId = req.params.id;
  const { title } = req.body;

  // Find and update document with user isolation
  const document = await Document.findOneAndUpdate(
    { _id: documentId, userId },
    { title: title.trim() },
    { new: true, runValidators: true }
  );

  if (!document) {
    throw ApiError.notFound('Document not found');
  }

  res.json({
    message: 'Document updated successfully',
    document: {
      id: document._id,
      title: document.title,
      originalFilename: document.originalFilename,
      status: document.status,
      updatedAt: document.updatedAt
    }
  });
});