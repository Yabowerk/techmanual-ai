/**
 * Retrieval service
 * Implements hybrid retrieval using vector similarity and keyword search with reciprocal rank fusion
 */

import config from '../config/env.js';
import Chunk from '../models/Chunk.js';
import mongoose from 'mongoose';

/**
 * Perform vector similarity search using MongoDB Atlas Vector Search
 * @param {string} userId - User ID for data isolation
 * @param {string} documentId - Document ID to search within
 * @param {Array<number>} queryEmbedding - Query embedding vector (dimensions depend on provider)
 * @param {number} k - Number of results to return
 * @returns {Promise<Array<Object>>} - Array of similar chunks with scores
 * 
 * @example
 * const results = await vectorSearch(userId, docId, queryEmbedding, 10);
 * // Returns: [
 * //   { chunk: ChunkDocument, score: 0.85 },
 * //   { chunk: ChunkDocument, score: 0.82 },
 * //   ...
 * // ]
 */
export const vectorSearch = async (userId, documentId, queryEmbedding, k = 10) => {
  try {
    // Validate inputs
    if (!userId || !documentId) {
      throw new Error('userId and documentId are required');
    }

    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      throw new Error('queryEmbedding must be a non-empty array');
    }

    if (k <= 0) {
      throw new Error('k must be a positive number');
    }

    // Convert string IDs to ObjectId if needed
    const userObjectId = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;
    
    const docObjectId = mongoose.Types.ObjectId.isValid(documentId)
      ? new mongoose.Types.ObjectId(documentId)
      : documentId;

    console.log(`🔍 Starting vector search for document ${documentId} with k=${k}`);

    // Build MongoDB aggregation pipeline for vector search
    const pipeline = [
      {
        $vectorSearch: {
          index: config.VECTOR_INDEX_NAME,
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: Math.min(k * 10, 1000), // Search more candidates for better results, cap at 1000
          limit: k,
          filter: {
            userId: userObjectId,
            documentId: docObjectId
          }
        }
      },
      {
        $addFields: {
          score: { $meta: 'vectorSearchScore' }
        }
      },
      {
        $project: {
          embedding: 0 // Don't return embedding in results (too large)
        }
      },
      {
        $sort: { score: -1 }
      }
    ];

    // Execute the aggregation pipeline
    const results = await Chunk.aggregate(pipeline);

    console.log(`✨ Vector search returned ${results.length} results`);

    // Return formatted results with chunks and scores
    return results.map(result => ({
      chunk: result,
      score: result.score,
      searchType: 'vector'
    }));

  } catch (error) {
    console.error('❌ Vector search error:', error.message);
    
    // More specific error messages
    if (error.message.includes('$vectorSearch')) {
      throw new Error('Vector search index not found. Ensure vector index is created in MongoDB Atlas.');
    }
    
    throw new Error(`Vector search failed: ${error.message}`);
  }
};

/**
 * Perform keyword search using MongoDB Atlas Search
 * @param {string} userId - User ID for data isolation
 * @param {string} documentId - Document ID to search within
 * @param {string} queryText - Search query text
 * @param {number} k - Number of results to return
 * @returns {Promise<Array<Object>>} - Array of matching chunks with scores
 * 
 * @example
 * const results = await keywordSearch(userId, docId, "safety procedures", 10);
 * // Returns: [
 * //   { chunk: ChunkDocument, score: 4.2 },
 * //   { chunk: ChunkDocument, score: 3.8 },
 * //   ...
 * // ]
 */
export const keywordSearch = async (userId, documentId, queryText, k = 10) => {
  try {
    // Validate inputs
    if (!userId || !documentId) {
      throw new Error('userId and documentId are required');
    }

    if (!queryText || typeof queryText !== 'string' || queryText.trim().length === 0) {
      throw new Error('queryText must be a non-empty string');
    }

    if (k <= 0) {
      throw new Error('k must be a positive number');
    }

    // Convert string IDs to ObjectId if needed
    const userObjectId = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;
    
    const docObjectId = mongoose.Types.ObjectId.isValid(documentId)
      ? new mongoose.Types.ObjectId(documentId)
      : documentId;

    console.log(`🔎 Starting keyword search for "${queryText}" with k=${k}`);

    // Build MongoDB aggregation pipeline for keyword search
    const pipeline = [
      {
        $search: {
          index: config.SEARCH_INDEX_NAME,
          compound: {
            must: [
              {
                text: {
                  query: queryText,
                  path: 'text',
                  fuzzy: {
                    maxEdits: 1, // Allow 1 character edit (for typos)
                    prefixLength: 2 // Don't apply fuzzy to first 2 chars (more stable matching)
                  }
                }
              },
              {
                equals: { path: 'userId', value: userObjectId }
              },
              {
                equals: { path: 'documentId', value: docObjectId }
              }
            ]
          }
        }
      },
      {
        $addFields: {
          score: { $meta: 'searchScore' }
        }
      },
      {
        $limit: k
      },
      {
        $project: {
          embedding: 0 // Don't return embedding in results (too large)
        }
      },
      {
        $sort: { score: -1 }
      }
    ];

    // Execute the aggregation pipeline
    const results = await Chunk.aggregate(pipeline);

    console.log(`📄 Keyword search returned ${results.length} results`);

    // Return formatted results with chunks and scores
    return results.map(result => ({
      chunk: result,
      score: result.score,
      searchType: 'keyword'
    }));

  } catch (error) {
    console.error('❌ Keyword search error:', error.message);
    
    // More specific error messages
    if (error.message.includes('$search')) {
      throw new Error('Search index not found. Ensure text search index is created in MongoDB Atlas.');
    }
    
    throw new Error(`Keyword search failed: ${error.message}`);
  }
};

/**
 * Combine results from multiple searches using Reciprocal Rank Fusion (RRF)
 * @param {Array<Object>} listA - First ranked list of results (typically vector search)
 * @param {Array<Object>} listB - Second ranked list of results (typically keyword search)
 * @param {number} k - RRF constant (typically 60, higher = more balanced weighting)
 * @returns {Array<Object>} - Fused and re-ranked results sorted by RRF score
 * 
 * @example
 * const fusedResults = reciprocalRankFusion(vectorResults, keywordResults, 60);
 * // Returns combined and re-ranked results based on both similarity and keyword relevance
 * 
 * RRF Formula: score(d) = Σ(1 / (k + rank(d, list_i))) for all lists containing document d
 */
export const reciprocalRankFusion = (listA, listB, k = 60) => {
  try {
    // Validate inputs
    if (!Array.isArray(listA) || !Array.isArray(listB)) {
      throw new Error('Both listA and listB must be arrays');
    }

    if (k <= 0) {
      throw new Error('k must be a positive number');
    }

    console.log(`🔄 Starting RRF: combining ${listA.length} vector results with ${listB.length} keyword results`);

    // Create a map to track documents across both lists
    const documentScores = new Map();

    // Process first list (vector search results)
    listA.forEach((item, rank) => {
      if (!item || !item.chunk || !item.chunk._id) {
        console.warn(`⚠️  Skipping invalid item in listA at rank ${rank}`);
        return;
      }

      const docId = item.chunk._id.toString();
      const rrfScore = 1 / (k + rank + 1); // +1 because ranks are 0-indexed

      documentScores.set(docId, {
        chunk: item.chunk,
        rrfScore: rrfScore,
        vectorRank: rank + 1,
        vectorScore: item.score,
        keywordRank: null,
        keywordScore: null
      });
    });

    // Process second list (keyword search results)
    listB.forEach((item, rank) => {
      if (!item || !item.chunk || !item.chunk._id) {
        console.warn(`⚠️  Skipping invalid item in listB at rank ${rank}`);
        return;
      }

      const docId = item.chunk._id.toString();
      const rrfScore = 1 / (k + rank + 1);

      if (documentScores.has(docId)) {
        // Document appears in both lists - combine scores
        const existing = documentScores.get(docId);
        existing.rrfScore += rrfScore;
        existing.keywordRank = rank + 1;
        existing.keywordScore = item.score;
      } else {
        // Document only in keyword results
        documentScores.set(docId, {
          chunk: item.chunk,
          rrfScore: rrfScore,
          vectorRank: null,
          vectorScore: null,
          keywordRank: rank + 1,
          keywordScore: item.score
        });
      }
    });

    // Convert map to array and sort by RRF score
    const fusedResults = Array.from(documentScores.values())
      .sort((a, b) => b.rrfScore - a.rrfScore);

    console.log(`✨ RRF completed: ${fusedResults.length} unique documents after fusion`);
    console.log(`📊 Top 3 results:`, fusedResults.slice(0, 3).map(r => ({
      rrfScore: r.rrfScore.toFixed(4),
      vectorRank: r.vectorRank,
      keywordRank: r.keywordRank,
      text: r.chunk.text.substring(0, 50) + '...'
    })));

    return fusedResults;

  } catch (error) {
    console.error('❌ RRF error:', error.message);
    throw new Error(`Reciprocal Rank Fusion failed: ${error.message}`);
  }
};

/**
 * Perform hybrid retrieval combining vector similarity and keyword search
 * @param {string} userId - User ID for data isolation
 * @param {string} documentId - Document ID to search within
 * @param {string} question - User's question/query
 * @returns {Promise<Array<Object>>} - Array of most relevant chunks
 * 
 * @example
 * const relevantChunks = await hybridRetrieve(userId, docId, "How do I perform maintenance?");
 * // Returns top chunks combining semantic similarity and keyword relevance
 */
export const hybridRetrieve = async (userId, documentId, question) => {
  try {
    // Validate inputs
    if (!userId || !documentId || !question) {
      throw new Error('userId, documentId, and question are required');
    }

    if (typeof question !== 'string' || question.trim().length === 0) {
      throw new Error('question must be a non-empty string');
    }

    const k = 10; // Number of results from each search method
    const finalLimit = 5; // Final number of chunks to return for LLM context

    console.log(`🎯 Starting hybrid retrieval for question: "${question.substring(0, 80)}..."`);

    // Import embed service for generating query embeddings
    const { embedQuery } = await import('./embed.service.js');

    // STEP 1: Generate embedding for the question
    console.log(`📍 Step 1: Generating embedding for query...`);
    let queryEmbedding;
    try {
      queryEmbedding = await embedQuery(question);
      console.log(`✨ Generated query embedding (${queryEmbedding.length} dimensions)`);
    } catch (error) {
      console.error('❌ Failed to generate query embedding:', error.message);
      throw new Error(`Query embedding generation failed: ${error.message}`);
    }

    // STEP 2: Perform both searches in parallel for efficiency
    console.log(`📍 Step 2: Running vector and keyword searches in parallel...`);
    let vectorResults, keywordResults;
    
    try {
      [vectorResults, keywordResults] = await Promise.all([
        vectorSearch(userId, documentId, queryEmbedding, k),
        keywordSearch(userId, documentId, question, k)
      ]);
      console.log(`✨ Vector search: ${vectorResults.length} results, Keyword search: ${keywordResults.length} results`);
    } catch (error) {
      console.error('❌ Search execution failed:', error.message);
      throw new Error(`Search failed: ${error.message}`);
    }

    // Handle cases where one or both searches return empty results
    if (vectorResults.length === 0 && keywordResults.length === 0) {
      console.warn('⚠️  No results found from either search method');
      return [];
    }

    // STEP 3: Combine results using Reciprocal Rank Fusion
    console.log(`📍 Step 3: Combining results with Reciprocal Rank Fusion...`);
    let fusedResults;
    try {
      fusedResults = reciprocalRankFusion(vectorResults, keywordResults, 60);
      console.log(`✨ RRF produced ${fusedResults.length} unique results`);
    } catch (error) {
      console.error('❌ RRF failed:', error.message);
      throw new Error(`Result fusion failed: ${error.message}`);
    }

    // STEP 4: Extract top N chunks and prepare for LLM
    const topChunks = fusedResults.slice(0, finalLimit);
    
    console.log(`✅ Hybrid retrieval completed: returning ${topChunks.length} chunks for LLM context`);
    console.log(`📊 Selected chunks:`, topChunks.map((r, i) => ({
      rank: i + 1,
      rrfScore: r.rrfScore.toFixed(4),
      page: r.chunk.page,
      section: r.chunk.section || 'N/A'
    })));

    // Return just the chunks (without RRF metadata)
    return topChunks.map(result => result.chunk);

  } catch (error) {
    console.error('❌ Hybrid retrieval error:', error.message);
    throw new Error(`Hybrid retrieval failed: ${error.message}`);
  }
};

/**
 * Expand query with synonyms and technical terms for better keyword matching
 * @param {string} query - Original query text
 * @returns {string} - Expanded query with synonyms
 * 
 * @private
 */
const expandQuery = (query) => {
  // TODO: Implement query expansion for technical manuals
  // 
  // Expansion strategies:
  // 1. Technical synonym mapping (e.g., "repair" -> "maintenance", "fix")
  // 2. Abbreviation expansion (e.g., "PSI" -> "pounds per square inch")
  // 3. Common variations (e.g., "troubleshoot" -> "diagnose", "debug")
  // 4. Safety-related terms (e.g., "danger" -> "warning", "caution")
  // 
  // Example:
  // const synonymMap = {
  //   'repair': ['maintenance', 'fix', 'service'],
  //   'problem': ['issue', 'fault', 'malfunction'],
  //   'start': ['initialize', 'boot', 'power on']
  // };
  
  throw new Error('Query expansion not implemented yet');
};

/**
 * Re-rank results based on additional factors (recency, page numbers, etc.)
 * @param {Array<Object>} results - Initial search results
 * @param {Object} options - Re-ranking options
 * @returns {Array<Object>} - Re-ranked results
 * 
 * @private
 */
const reRankResults = (results, options = {}) => {
  // TODO: Implement additional re-ranking factors
  // 
  // Re-ranking factors:
  // 1. Page number preference (introduction vs appendix)
  // 2. Section type preference (procedures vs background)
  // 3. Content type (warnings/cautions get boosted for safety queries)
  // 4. Chunk completeness (prefer complete procedures)
  // 
  // This can help prioritize more actionable/relevant content
  
  throw new Error('Result re-ranking not implemented yet');
};