/**
 * Document ingestion service
 * Orchestrates the complete pipeline: PDF parsing -> chunking -> embedding -> storage
 */

import Document from '../models/Document.js';
import Chunk from '../models/Chunk.js';
import { extractPages } from './parse.service.js';
import { chunkPages } from './chunk.service.js';
import { embedTexts } from './embed.service.js';

/**
 * Orchestrate the complete document ingestion pipeline
 * @param {Object} params - Ingestion parameters
 * @param {string} params.documentId - Document ID in database
 * @param {string} params.userId - User ID for data isolation
 * @param {Buffer} params.buffer - PDF file buffer
 * @returns {Promise<void>} - Resolves when ingestion is complete
 * 
 * This function runs the complete pipeline but does not block the upload response.
 * It updates the document status throughout the process and handles all errors gracefully.
 */
export const ingestDocument = async ({ documentId, userId, buffer }) => {
  let document;
  
  try {
    console.log(`📋 Starting ingestion for document ${documentId}`);
    
    // Get the document record
    document = await Document.findById(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }
    
    // Verify ownership for security
    if (document.userId.toString() !== userId) {
      throw new Error(`Document ${documentId} does not belong to user ${userId}`);
    }
    
    // Update status to processing
    document.status = 'processing';
    await document.save();
    console.log(`📄 Document ${documentId} marked as processing`);
    
    // STEP 1: Parse PDF to extract text by pages
    console.log(`🔍 Step 1: Parsing PDF for document ${documentId}`);
    const pages = await extractPages(buffer);
    console.log(`📖 Extracted ${pages.length} pages from document`);
    
    // Update document with page count
    document.pageCount = pages.length;
    await document.save();
    
    // STEP 2: Chunk the pages into smaller pieces
    console.log(`✂️  Step 2: Chunking pages for document ${documentId}`);
    const chunks = chunkPages(pages);
    console.log(`📝 Created ${chunks.length} chunks from ${pages.length} pages`);
    
    // STEP 3: Generate embeddings for all chunks
    console.log(`🧠 Step 3: Generating embeddings for ${chunks.length} chunks`);
    const chunkTexts = chunks.map(chunk => chunk.text);
    const embeddings = await embedTexts(chunkTexts);
    console.log(`✨ Generated ${embeddings.length} embeddings`);
    
    // STEP 4: Save chunks to database
    console.log(`💾 Step 4: Saving chunks to database`);
    const chunkDocuments = chunks.map((chunk, index) => ({
      userId,
      documentId,
      text: chunk.text,
      page: chunk.page,
      section: chunk.section || '',
      chunkIndex: chunk.chunkIndex,
      embedding: embeddings[index]
    }));
    
    await Chunk.insertMany(chunkDocuments);
    console.log(`✅ Saved ${chunkDocuments.length} chunks to database`);
    
    // STEP 5: Generate document summary
    console.log(`📋 Step 5: Generating document summary`);
    const summary = await generateDocumentSummary(chunks);
    console.log(`📄 Generated summary: ${summary.substring(0, 100)}...`);
    
    // STEP 6: Mark document as ready
    await document.markAsReady(summary);
    console.log(`🎉 Document ${documentId} ingestion completed successfully`);
    
  } catch (error) {
    console.error(`❌ Ingestion failed for document ${documentId}:`, error.message);
    
    // Mark document as failed with error message
    if (document) {
      await document.markAsFailed(error.message);
    }
    
    // Clean up any partially created chunks
    try {
      await Chunk.deleteMany({ documentId, userId });
      console.log(`🧹 Cleaned up partial chunks for document ${documentId}`);
    } catch (cleanupError) {
      console.error(`❌ Failed to cleanup chunks for document ${documentId}:`, cleanupError.message);
    }
    
    // Don't throw the error - we want this to fail gracefully
    // The document status will indicate the failure
  }
};

/**
 * Generate a document summary from chunks using smart sampling to minimize LLM token usage
 * @param {Array<Object>} chunks - Array of chunk objects
 * @returns {Promise<string>} - Document summary
 * 
 * @private
 */
const generateDocumentSummary = async (chunks) => {
  try {
    console.log(`📋 Starting smart document summarization for ${chunks.length} chunks`);
    
    // First, try LLM-based smart summarization
    const llmSummary = await generateSmartSummary(chunks);
    if (llmSummary) {
      console.log(`✅ Generated LLM-based summary: ${llmSummary.substring(0, 100)}...`);
      return llmSummary;
    }
    
    // Fallback to text analysis if LLM fails
    console.log(`⚠️  LLM summarization failed, falling back to text analysis`);
    return generateTextAnalysisSummary(chunks);
    
  } catch (error) {
    console.error(`❌ Summarization error:`, error.message);
    // Always fall back to text analysis
    return generateTextAnalysisSummary(chunks);
  }
};

/**
 * Generate summary using LLM with smart sampling (token-efficient)
 * @param {Array<Object>} chunks - Array of chunk objects
 * @returns {Promise<string|null>} - LLM-generated summary or null if failed
 * 
 * @private
 */
const generateSmartSummary = async (chunks) => {
  if (!chunks || chunks.length === 0) {
    return null;
  }

  try {
    // SMART SAMPLING: Select only the most important chunks
    const sampleChunks = selectSampleChunks(chunks);
    
    if (sampleChunks.length === 0) {
      console.log(`⚠️  No sample chunks selected for summarization`);
      return null;
    }

    // Combine sample text
    const sampleText = sampleChunks
      .map(chunk => `[Page ${chunk.page}] ${chunk.text}`)
      .join('\n\n');

    // Ensure we don't exceed token limits (rough estimate)
    if (sampleText.length > 12000) { // ~3000 tokens max
      console.log(`⚠️  Sample text too long (${sampleText.length} chars), truncating`);
      const truncatedText = sampleText.substring(0, 12000) + '\n\n[Document continues...]';
      return await callLLMForSummary(truncatedText);
    }

    console.log(`🧠 Sending ${sampleChunks.length} sample chunks to LLM (${sampleText.length} chars)`);
    return await callLLMForSummary(sampleText);

  } catch (error) {
    console.error(`❌ Smart summarization failed:`, error.message);
    return null;
  }
};

/**
 * Select the most important chunks for summarization (token-efficient sampling)
 * @param {Array<Object>} chunks - All chunks
 * @returns {Array<Object>} - Selected sample chunks
 * 
 * @private
 */
const selectSampleChunks = (chunks) => {
  const sampleChunks = [];
  
  // 1. Always include first 2-3 chunks (intro/overview)
  const introChunks = chunks.slice(0, 3);
  sampleChunks.push(...introChunks);
  
  // 2. Find and include safety-related chunks (critical for manuals)
  const safetyKeywords = ['safety', 'warning', 'caution', 'danger', 'notice', 'precaution'];
  const safetyChunks = chunks.filter(chunk => {
    const text = chunk.text.toLowerCase();
    return safetyKeywords.some(keyword => text.includes(keyword));
  }).slice(0, 2); // Limit to 2 safety chunks
  
  // Add safety chunks that aren't already included
  safetyChunks.forEach(chunk => {
    if (!sampleChunks.find(s => s.chunkIndex === chunk.chunkIndex)) {
      sampleChunks.push(chunk);
    }
  });
  
  // 3. Find overview/introduction sections
  const overviewKeywords = ['overview', 'introduction', 'about', 'description', 'summary'];
  const overviewChunks = chunks.filter(chunk => {
    const text = chunk.text.toLowerCase();
    const section = (chunk.section || '').toLowerCase();
    return overviewKeywords.some(keyword => 
      text.includes(keyword) || section.includes(keyword)
    );
  }).slice(0, 2); // Limit to 2 overview chunks
  
  // Add overview chunks that aren't already included
  overviewChunks.forEach(chunk => {
    if (!sampleChunks.find(s => s.chunkIndex === chunk.chunkIndex)) {
      sampleChunks.push(chunk);
    }
  });
  
  // 4. If we still have room, add chunks with section headers
  const maxSampleChunks = 8; // Maximum chunks to avoid token overuse
  if (sampleChunks.length < maxSampleChunks) {
    const sectionHeaderChunks = chunks.filter(chunk => {
      if (sampleChunks.find(s => s.chunkIndex === chunk.chunkIndex)) return false;
      
      const section = chunk.section || '';
      // Look for chunks that start sections
      return section && section.length > 0 && section.length < 80;
    }).slice(0, maxSampleChunks - sampleChunks.length);
    
    sampleChunks.push(...sectionHeaderChunks);
  }
  
  // Sort by original order to maintain document flow
  const sortedSamples = sampleChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
  
  console.log(`📝 Selected ${sortedSamples.length} sample chunks from ${chunks.length} total chunks`);
  console.log(`📍 Sample chunks: pages ${sortedSamples.map(c => c.page).join(', ')}`);
  
  return sortedSamples;
};

/**
 * Call LLM service for document summarization
 * @param {string} documentText - Sample text to summarize
 * @returns {Promise<string>} - Generated summary
 * 
 * @private
 */
const callLLMForSummary = async (documentText) => {
  const { summarizeDocument } = await import('./llm.service.js');
  
  const prompt = `Create a VERY BRIEF summary in EXACTLY 3 LINES for this technical manual. Each line should be one short sentence with an emoji at the start.

Line 1: What equipment or system this manual covers (emoji: 🔧)
Line 2: What main purpose or operation it describes (emoji: 🎯)
Line 3: Key procedures or use cases (emoji: 📋)

DO NOT write paragraphs. DO NOT exceed 3 lines. Be extremely concise.

Document sample:
${documentText}`;

  return await summarizeDocument(prompt);
};

/**
 * Generate summary using text analysis (fallback, no LLM tokens used)
 * @param {Array<Object>} chunks - Array of chunk objects
 * @returns {string} - Analysis-based summary
 * 
 * @private
 */
const generateTextAnalysisSummary = (chunks) => {
  const totalChunks = chunks.length;
  const pageCount = Math.max(...chunks.map(c => c.page));
  const sections = [...new Set(chunks.map(c => c.section).filter(Boolean))];
  
  // Analyze content types
  const analysis = analyzeDocumentContent(chunks);
  
  let summary = `Technical Manual - ${pageCount} pages, ${totalChunks} sections`;
  
  if (analysis.detectedEquipment.length > 0) {
    summary += `\n\n🔧 Equipment: ${analysis.detectedEquipment.slice(0, 3).join(', ')}`;
  }
  
  if (sections.length > 0) {
    summary += `\n\n📋 Main sections: ${sections.slice(0, 5).join(', ')}`;
    if (sections.length > 5) {
      summary += ` and ${sections.length - 5} others`;
    }
  }
  
  if (analysis.hasSafety) {
    summary += `\n\n⚠️  Includes safety information and precautions`;
  }
  
  if (analysis.hasProcedures) {
    summary += `\n\n🛠️  Contains step-by-step procedures and instructions`;
  }
  
  if (analysis.keyTopics.length > 0) {
    summary += `\n\n🎯 Key topics: ${analysis.keyTopics.slice(0, 4).join(', ')}`;
  }
  
  console.log(`📋 Generated text analysis summary`);
  return summary;
};

/**
 * Analyze document content to extract key information
 * @param {Array<Object>} chunks - Array of chunk objects
 * @returns {Object} - Analysis results
 * 
 * @private
 */
const analyzeDocumentContent = (chunks) => {
  const allText = chunks.map(c => c.text.toLowerCase()).join(' ');
  
  // Detect equipment types
  const equipmentPatterns = [
    /(?:manual for|operating|maintenance|service)\s+(?:the\s+)?([a-z][a-z0-9\s-]+(?:system|unit|equipment|device|machine|motor|pump|generator|controller|panel))/gi,
    /(?:model|part|serial)\s*(?:number|no\.?|#)?\s*:?\s*([a-z0-9-]+)/gi
  ];
  
  const detectedEquipment = new Set();
  equipmentPatterns.forEach(pattern => {
    const matches = allText.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const clean = match.replace(/^(manual for|operating|maintenance|service)\s*/i, '').trim();
        if (clean.length > 3 && clean.length < 50) {
          detectedEquipment.add(clean);
        }
      });
    }
  });
  
  // Detect key topics
  const topicKeywords = {
    'Installation': ['install', 'setup', 'mounting', 'connection'],
    'Operation': ['operate', 'start', 'stop', 'run', 'control'],
    'Maintenance': ['maintain', 'service', 'clean', 'inspect', 'replace'],
    'Safety': ['safety', 'warning', 'caution', 'danger', 'hazard'],
    'Troubleshooting': ['troubleshoot', 'problem', 'error', 'fault', 'repair'],
    'Specifications': ['specification', 'dimension', 'rating', 'capacity', 'technical']
  };
  
  const keyTopics = [];
  Object.entries(topicKeywords).forEach(([topic, keywords]) => {
    if (keywords.some(keyword => allText.includes(keyword))) {
      keyTopics.push(topic);
    }
  });
  
  return {
    detectedEquipment: Array.from(detectedEquipment),
    keyTopics,
    hasSafety: ['safety', 'warning', 'caution', 'danger'].some(word => allText.includes(word)),
    hasProcedures: ['step', 'procedure', 'instruction', 'process'].some(word => allText.includes(word)) || /\d+\.\s/.test(allText)
  };
};

/**
 * Validate ingestion parameters
 * @param {Object} params - Parameters to validate
 * @returns {boolean} - True if parameters are valid
 * 
 * @private
 */
const validateIngestionParams = (params) => {
  // TODO: Implement parameter validation
  // 
  // Validation checks:
  // 1. documentId is valid ObjectId
  // 2. userId is valid ObjectId
  // 3. buffer exists and is not empty
  // 4. buffer appears to be a valid PDF
  // 5. buffer size is within limits
  
  const { documentId, userId, buffer } = params;
  
  if (!documentId || !userId || !buffer) {
    throw new Error('Missing required ingestion parameters');
  }
  
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Invalid or empty buffer provided');
  }
  
  return true;
};

/**
 * Monitor ingestion progress and update status
 * @param {string} documentId - Document ID
 * @param {string} stage - Current processing stage
 * @param {Object} progress - Progress information
 * 
 * @private
 */
const updateIngestionProgress = async (documentId, stage, progress = {}) => {
  // TODO: Implement progress tracking
  // 
  // This could be used to:
  // 1. Update document with current processing stage
  // 2. Store progress information for user display
  // 3. Send real-time updates via websockets/SSE
  // 4. Log detailed progress for debugging
  // 
  // Example stages:
  // - 'parsing' - Extracting text from PDF
  // - 'chunking' - Breaking text into chunks
  // - 'embedding' - Generating embeddings
  // - 'storing' - Saving to database
  // - 'summarizing' - Generating summary
  
  console.log(`📊 Document ${documentId}: ${stage}`, progress);
};

/**
 * Estimate processing time for a document
 * @param {Buffer} buffer - PDF buffer
 * @returns {number} - Estimated processing time in seconds
 * 
 * @private
 */
const estimateProcessingTime = (buffer) => {
  // TODO: Implement processing time estimation
  // 
  // Estimation factors:
  // 1. File size (larger files take longer)
  // 2. Estimated page count (more pages = more chunks = more embeddings)
  // 3. Current API rate limits and quotas
  // 4. Historical processing times for similar documents
  // 
  // This could be used to:
  // - Set user expectations
  // - Implement intelligent queuing
  // - Detect stuck processes
  
  const fileSizeMB = buffer.length / (1024 * 1024);
  const estimatedPages = Math.ceil(fileSizeMB * 10); // Rough estimate
  const estimatedSeconds = estimatedPages * 2; // 2 seconds per page estimate
  
  return Math.max(30, Math.min(estimatedSeconds, 300)); // Between 30s and 5min
};

/**
 * Clean up failed ingestion artifacts
 * @param {string} documentId - Document ID
 * @param {string} userId - User ID
 * 
 * @private
 */
const cleanupFailedIngestion = async (documentId, userId) => {
  try {
    // Remove any chunks that were created
    await Chunk.deleteMany({ documentId, userId });
    
    // Could also remove the document itself, but we keep it to show the failure
    // This allows users to see what failed and potentially retry
    
    console.log(`🧹 Cleaned up failed ingestion for document ${documentId}`);
  } catch (error) {
    console.error(`❌ Failed to cleanup ingestion artifacts:`, error);
  }
};