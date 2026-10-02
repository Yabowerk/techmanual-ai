/**
 * Embedding service
 * Generates vector embeddings for text chunks using Voyage AI's embedding models
 */

import config from '../config/env.js';

// Model configurations for Voyage AI
const VOYAGE_MODELS = {
  'voyage-3-large': { dimensions: 1024, maxTokens: 32000, batchSize: 64 },
  'voyage-3': { dimensions: 1024, maxTokens: 32000, batchSize: 128 },
  'voyage-3-lite': { dimensions: 512, maxTokens: 32000, batchSize: 128 },
  'voyage-code-3': { dimensions: 1024, maxTokens: 32000, batchSize: 128 }
};

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const MODEL_CONFIG = VOYAGE_MODELS[config.VOYAGE_MODEL];

if (!MODEL_CONFIG) {
  throw new Error(`Unsupported Voyage model: ${config.VOYAGE_MODEL}`);
}

/**
 * Generate embeddings for multiple text chunks (with batching for efficiency)
 * @param {Array<string>} texts - Array of text strings to embed
 * @returns {Promise<Array<Array<number>>>} - Array of embedding vectors
 * 
 * @example
 * const embeddings = await embedTexts([
 *   "This is the first chunk of text",
 *   "This is the second chunk of text"
 * ]);
 * // Returns: [[0.1, 0.2, ...], [0.3, 0.4, ...]] (each inner array has model dimensions)
 */
export const embedTexts = async (texts) => {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error('Texts must be a non-empty array');
  }

  const embeddings = [];
  const batchSize = MODEL_CONFIG.batchSize;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    
    // Preprocess the batch
    const processedBatch = batch.map(text => preprocessText(text));
    
    try {
      const batchEmbeddings = await retryWithBackoff(async () => {
        const response = await fetch(VOYAGE_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.VOYAGE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: config.VOYAGE_MODEL,
            input: processedBatch,
            input_type: 'document'  // Optimize for document indexing
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            `Voyage API error: ${response.status} - ${errorData.message || response.statusText}`
          );
        }

        return await response.json();
      });

      // Validate and collect embeddings
      for (const item of batchEmbeddings.data) {
        if (!isValidEmbedding(item.embedding)) {
          throw new Error(`Invalid embedding received for batch item ${item.index}`);
        }
        embeddings.push(item.embedding);
      }

    } catch (error) {
      console.error(`Failed to generate embeddings for batch ${i / batchSize + 1}:`, error);
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }

  return embeddings;
};

/**
 * Generate embedding for a single query text
 * @param {string} text - Query text to embed
 * @returns {Promise<Array<number>>} - Embedding vector
 * 
 * @example
 * const queryEmbedding = await embedQuery("How do I perform maintenance?");
 * // Returns: [0.1, 0.2, 0.3, ...] (model dimensions)
 */
export const embedQuery = async (text) => {
  if (!text || typeof text !== 'string') {
    throw new Error('Query text must be a non-empty string');
  }

  const preprocessedText = preprocessQuery(text);

  try {
    const response = await retryWithBackoff(async () => {
      const apiResponse = await fetch(VOYAGE_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.VOYAGE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.VOYAGE_MODEL,
          input: [preprocessedText],
          input_type: 'query'  // Optimize for query/retrieval
        })
      });

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json().catch(() => ({}));
        throw new Error(
          `Voyage API error: ${apiResponse.status} - ${errorData.message || apiResponse.statusText}`
        );
      }

      return await apiResponse.json();
    });

    const embedding = response.data[0].embedding;
    
    if (!isValidEmbedding(embedding)) {
      throw new Error('Invalid embedding received for query');
    }

    return embedding;

  } catch (error) {
    console.error('Failed to generate query embedding:', error);
    throw new Error(`Query embedding generation failed: ${error.message}`);
  }
};

/**
 * Preprocess text before embedding (cleanup, truncation, normalization)
 * @param {string} text - Raw text to preprocess
 * @returns {string} - Preprocessed text ready for embedding
 * 
 * @private
 */
const preprocessText = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Normalize whitespace and line breaks
  let processed = text
    .replace(/\s+/g, ' ')  // Multiple spaces to single space
    .replace(/\n+/g, '\n') // Multiple newlines to single newline
    .replace(/\t/g, ' ')   // Tabs to spaces
    .trim();

  // Remove or normalize common document artifacts
  processed = processed
    .replace(/^\s*Page\s+\d+\s*$/gm, '') // Remove page numbers
    .replace(/^\s*-+\s*$/gm, '')         // Remove separator lines
    .replace(/\u00A0/g, ' ')             // Non-breaking spaces to regular spaces
    .replace(/[^\x00-\x7F]/g, (char) => {
      // Keep common unicode characters, replace others
      const code = char.charCodeAt(0);
      if (code < 128 || (code >= 160 && code <= 255)) return char;
      return ' ';
    });

  // Estimate token count and truncate if necessary
  // Rough estimate: 1 token ≈ 4 characters for English text
  const estimatedTokens = processed.length / 4;
  const maxTokens = MODEL_CONFIG.maxTokens - 100; // Safety margin

  if (estimatedTokens > maxTokens) {
    const maxChars = maxTokens * 4;
    processed = processed.substring(0, maxChars);
    
    // Try to end at a sentence boundary
    const lastPeriod = processed.lastIndexOf('.');
    const lastNewline = processed.lastIndexOf('\n');
    const cutPoint = Math.max(lastPeriod, lastNewline);
    
    if (cutPoint > maxChars * 0.8) { // Only cut at sentence if we don't lose too much
      processed = processed.substring(0, cutPoint + 1);
    }
  }

  return processed.trim();
};

/**
 * Preprocess query text specifically for retrieval
 * @param {string} text - Raw query text
 * @returns {string} - Preprocessed query
 * 
 * @private
 */
const preprocessQuery = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Basic cleanup for queries
  let processed = text
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase(); // Queries benefit from normalization

  // Remove common query prefixes/suffixes that don't add semantic value
  processed = processed
    .replace(/^(how\s+)?(do\s+i|can\s+i|should\s+i)\s+/i, '')
    .replace(/\?+$/, ''); // Remove question marks

  // Truncate if too long (queries are usually shorter)
  const maxChars = MODEL_CONFIG.maxTokens * 2; // Less aggressive for queries
  if (processed.length > maxChars) {
    processed = processed.substring(0, maxChars).trim();
  }

  return processed;
};

/**
 * Validate embedding vector quality
 * @param {Array<number>} embedding - Embedding vector to validate
 * @returns {boolean} - True if embedding is valid
 * 
 * @private
 */
const isValidEmbedding = (embedding) => {
  // Check if it's an array with correct dimensions
  if (!Array.isArray(embedding) || embedding.length !== MODEL_CONFIG.dimensions) {
    return false;
  }

  // Check if all values are valid numbers
  if (!embedding.every(val => typeof val === 'number' && isFinite(val))) {
    return false;
  }

  // Check if it's not all zeros (indicates embedding failure)
  const isAllZeros = embedding.every(val => val === 0);
  if (isAllZeros) {
    return false;
  }

  // Check vector magnitude is reasonable
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude < 0.01 || magnitude > 100) { // Reasonable range for normalized embeddings
    return false;
  }

  return true;
};

/**
 * Calculate cosine similarity between two embeddings
 * @param {Array<number>} embedding1 - First embedding vector
 * @param {Array<number>} embedding2 - Second embedding vector
 * @returns {number} - Cosine similarity score (-1 to 1)
 * 
 * @example
 * const similarity = calculateCosineSimilarity(embedding1, embedding2);
 * // Returns: 0.85 (high similarity)
 */
export const calculateCosineSimilarity = (embedding1, embedding2) => {
  if (!Array.isArray(embedding1) || !Array.isArray(embedding2)) {
    throw new Error('Both arguments must be arrays');
  }

  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have the same length');
  }

  // Calculate dot product
  const dotProduct = embedding1.reduce((sum, a, i) => sum + a * embedding2[i], 0);

  // Calculate magnitudes
  const magnitudeA = Math.sqrt(embedding1.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(embedding2.reduce((sum, b) => sum + b * b, 0));

  // Avoid division by zero
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
};

/**
 * Retry logic for API calls with exponential backoff
 * @param {Function} apiCall - Function that makes the API call
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise} - Result of successful API call
 * 
 * @private
 */
const retryWithBackoff = async (apiCall, maxRetries = 3) => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        throw error;
      }

      // Check if error is retryable
      if (!isRetryableError(error)) {
        throw error;
      }

      // Calculate delay with jitter
      const baseDelay = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
      const jitter = Math.random() * 1000; // 0-1s random jitter
      const delay = baseDelay + jitter;

      console.warn(`API call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error.message);
      
      await sleep(delay);
    }
  }
};

/**
 * Check if an error is retryable
 * @param {Error} error - Error to check
 * @returns {boolean} - True if error should be retried
 * 
 * @private
 */
const isRetryableError = (error) => {
  // Network errors
  if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
    return true;
  }

  // Rate limit errors (429)
  if (error.message && error.message.includes('429')) {
    return true;
  }

  // Server errors (5xx)
  if (error.message && /5\d\d/.test(error.message)) {
    return true;
  }

  // Don't retry authentication errors (401, 403) or bad requests (400)
  if (error.message && (/401|403|400/.test(error.message))) {
    return false;
  }

  // Default to retry for unknown network-like errors
  return error.name === 'TypeError' && error.message.includes('fetch');
};

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Promise that resolves after delay
 * 
 * @private
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Get current model configuration
 * @returns {Object} - Model configuration object
 */
export const getModelConfig = () => ({
  provider: 'voyage',
  model: config.VOYAGE_MODEL,
  dimensions: MODEL_CONFIG.dimensions,
  maxTokens: MODEL_CONFIG.maxTokens,
  batchSize: MODEL_CONFIG.batchSize
});