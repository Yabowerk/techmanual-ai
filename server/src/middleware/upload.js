import multer from 'multer';
import ApiError from '../utils/ApiError.js';
import config from '../config/env.js';

/**
 * File filter function to allow only PDF files
 * @param {Object} req - Express request object
 * @param {Object} file - Multer file object
 * @param {Function} cb - Callback function
 */
const fileFilter = (req, file, cb) => {
  // Check MIME type
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(ApiError.badRequest('Only PDF files are allowed'), false);
  }
};

/**
 * Multer configuration for PDF uploads
 * Uses memory storage to handle files in memory (not saved to disk here)
 */
const upload = multer({
  // Use memory storage to keep files in buffer
  storage: multer.memoryStorage(),
  
  // File size limit (convert MB to bytes)
  limits: {
    fileSize: config.MAX_UPLOAD_MB * 1024 * 1024,
    files: 1, // Only allow one file at a time
    fields: 10 // Limit number of form fields
  },
  
  // File filter to allow only PDFs
  fileFilter: fileFilter
});

/**
 * Error handler for multer errors
 * Converts multer errors to ApiError instances
 */
export const handleUploadErrors = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return next(ApiError.payloadTooLarge(
          `File too large. Maximum size allowed is ${config.MAX_UPLOAD_MB}MB`
        ));
      
      case 'LIMIT_FILE_COUNT':
        return next(ApiError.badRequest('Only one file is allowed'));
      
      case 'LIMIT_FIELD_COUNT':
        return next(ApiError.badRequest('Too many form fields'));
      
      case 'LIMIT_UNEXPECTED_FILE':
        return next(ApiError.badRequest('Unexpected file field. Use "file" as the field name'));
      
      default:
        return next(ApiError.badRequest(`Upload error: ${error.message}`));
    }
  }
  
  // Pass through non-multer errors
  next(error);
};

/**
 * Middleware to validate uploaded file exists
 */
export const validateFileExists = (req, res, next) => {
  if (!req.file) {
    return next(ApiError.badRequest('No file uploaded. Please select a PDF file'));
  }
  
  // Validate file buffer exists and has content
  if (!req.file.buffer || req.file.buffer.length === 0) {
    return next(ApiError.badRequest('Uploaded file is empty'));
  }
  
  next();
};

/**
 * Export the configured upload middleware
 * Use as: upload.single('file') for single file upload with field name 'file'
 */
export default upload;