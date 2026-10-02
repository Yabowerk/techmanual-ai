import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import ApiError from '../utils/ApiError.js';

/**
 * Local file storage service
 * Handles saving, retrieving, and deleting PDF files on the local filesystem
 */

// Storage directory path (relative to project root)
const STORAGE_DIR = path.join(process.cwd(), 'uploads');

/**
 * Ensure storage directory exists
 * Creates the uploads directory if it doesn't exist
 */
const ensureStorageDir = async () => {
  try {
    await fs.access(STORAGE_DIR);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
      console.log(`📁 Created storage directory: ${STORAGE_DIR}`);
    } else {
      throw error;
    }
  }
};

/**
 * Generate a unique file key for storage
 * @param {string} originalFilename - Original filename from upload
 * @returns {string} - Unique file key
 */
const generateFileKey = (originalFilename) => {
  const uuid = uuidv4();
  const ext = path.extname(originalFilename);
  return `${uuid}${ext}`;
};

/**
 * Get the full file path from a file key
 * @param {string} fileKey - File key
 * @returns {string} - Full file path
 */
const getFilePath = (fileKey) => {
  return path.join(STORAGE_DIR, fileKey);
};

/**
 * Save a file buffer to local storage
 * @param {Buffer} buffer - File buffer from multer
 * @param {string} originalFilename - Original filename
 * @returns {Promise<string>} - File key for the saved file
 */
export const saveFile = async (buffer, originalFilename) => {
  try {
    // Ensure storage directory exists
    await ensureStorageDir();

    // Generate unique file key
    const fileKey = generateFileKey(originalFilename);
    const filePath = getFilePath(fileKey);

    // Write buffer to file
    await fs.writeFile(filePath, buffer);

    console.log(`💾 File saved: ${fileKey} (${buffer.length} bytes)`);
    return fileKey;

  } catch (error) {
    console.error('Error saving file:', error);
    throw ApiError.internal('Failed to save file');
  }
};

/**
 * Get a readable stream for a file
 * @param {string} fileKey - File key
 * @returns {Promise<ReadableStream>} - Readable stream for the file
 */
export const getFileStream = async (fileKey) => {
  try {
    const filePath = getFilePath(fileKey);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw ApiError.notFound('File not found');
      }
      throw error;
    }

    // Return readable stream
    return createReadStream(filePath);

  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Error getting file stream:', error);
    throw ApiError.internal('Failed to retrieve file');
  }
};

/**
 * Get file information (size, exists, etc.)
 * @param {string} fileKey - File key
 * @returns {Promise<Object>} - File stats
 */
export const getFileInfo = async (fileKey) => {
  try {
    const filePath = getFilePath(fileKey);
    const stats = await fs.stat(filePath);
    
    return {
      exists: true,
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime
    };

  } catch (error) {
    if (error.code === 'ENOENT') {
      return { exists: false };
    }
    console.error('Error getting file info:', error);
    throw ApiError.internal('Failed to get file information');
  }
};

/**
 * Delete a file from storage
 * @param {string} fileKey - File key
 * @returns {Promise<boolean>} - True if file was deleted, false if it didn't exist
 */
export const deleteFile = async (fileKey) => {
  try {
    const filePath = getFilePath(fileKey);

    // Try to delete the file
    await fs.unlink(filePath);
    console.log(`🗑️  File deleted: ${fileKey}`);
    return true;

  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, which is fine
      console.log(`📄 File not found for deletion: ${fileKey}`);
      return false;
    }
    
    console.error('Error deleting file:', error);
    throw ApiError.internal('Failed to delete file');
  }
};

/**
 * Clean up orphaned files (files not referenced in the database)
 * This is a maintenance function that can be run periodically
 * @param {Array<string>} activeFileKeys - Array of file keys that should be kept
 * @returns {Promise<Object>} - Cleanup results
 */
export const cleanupOrphanedFiles = async (activeFileKeys = []) => {
  try {
    await ensureStorageDir();
    
    const files = await fs.readdir(STORAGE_DIR);
    const activeSet = new Set(activeFileKeys);
    
    let deletedCount = 0;
    let errorCount = 0;
    const deletedFiles = [];

    for (const file of files) {
      if (!activeSet.has(file)) {
        try {
          await fs.unlink(path.join(STORAGE_DIR, file));
          deletedFiles.push(file);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete orphaned file ${file}:`, error);
          errorCount++;
        }
      }
    }

    console.log(`🧹 Cleanup completed: ${deletedCount} files deleted, ${errorCount} errors`);
    
    return {
      totalFiles: files.length,
      activeFiles: activeFileKeys.length,
      deletedCount,
      errorCount,
      deletedFiles
    };

  } catch (error) {
    console.error('Error during cleanup:', error);
    throw ApiError.internal('Failed to cleanup orphaned files');
  }
};

/**
 * Get storage statistics
 * @returns {Promise<Object>} - Storage usage statistics
 */
export const getStorageStats = async () => {
  try {
    await ensureStorageDir();
    
    const files = await fs.readdir(STORAGE_DIR);
    let totalSize = 0;
    let fileCount = 0;

    for (const file of files) {
      try {
        const stats = await fs.stat(path.join(STORAGE_DIR, file));
        totalSize += stats.size;
        fileCount++;
      } catch (error) {
        // Skip files that can't be accessed
        console.warn(`Could not stat file ${file}:`, error.message);
      }
    }

    return {
      fileCount,
      totalSize,
      totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
      storageDir: STORAGE_DIR
    };

  } catch (error) {
    console.error('Error getting storage stats:', error);
    throw ApiError.internal('Failed to get storage statistics');
  }
};

/**
 * Validate file key format
 * @param {string} fileKey - File key to validate
 * @returns {boolean} - True if valid
 */
export const isValidFileKey = (fileKey) => {
  // UUID v4 format with .pdf extension
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/i;
  return uuidRegex.test(fileKey);
};

// Initialize storage directory on module load
ensureStorageDir().catch(console.error);