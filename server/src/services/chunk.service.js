/**
 * Text chunking service
 * Splits document pages into smaller, semantically meaningful chunks for embedding
 */

// Configuration constants for chunking behavior
const CHUNK_CONFIG = {
  TARGET_SIZE: 600,        // Target tokens per chunk (sweet spot for embeddings)
  MIN_SIZE: 200,           // Minimum tokens to avoid tiny chunks
  MAX_SIZE: 800,           // Maximum tokens to stay within embedding limits
  OVERLAP_SIZE: 75,        // Tokens of overlap between consecutive chunks
  TOKENS_PER_WORD: 1.3,    // Average tokens per word for English text
  MAX_CHUNK_LENGTH: 4000   // Maximum character length for chunks (safety limit)
};

/**
 * Split document pages into chunks suitable for embedding and retrieval
 * @param {Array<{page: number, text: string}>} pages - Array of pages with text content
 * @returns {Array<{text: string, page: number, section: string, chunkIndex: number}>} - Array of text chunks
 * 
 * @example
 * const chunks = chunkPages([
 *   { page: 1, text: "Chapter 1: Introduction\nThis manual covers..." },
 *   { page: 2, text: "Safety Precautions\n1. Always wear..." }
 * ]);
 * // Returns: [
 * //   { text: "Chapter 1: Introduction\nThis manual covers...", page: 1, section: "Chapter 1", chunkIndex: 0 },
 * //   { text: "Safety Precautions\n1. Always wear...", page: 2, section: "Safety Precautions", chunkIndex: 0 },
 * //   ...
 * // ]
 */
export const chunkPages = (pages) => {
  console.log(`📄 Starting chunking process for ${pages.length} pages`);
  
  if (!pages || pages.length === 0) {
    console.warn('⚠️  No pages provided for chunking');
    return [];
  }

  const chunks = [];
  let globalChunkIndex = 0;
  let previousChunkText = ''; // For overlap between pages

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pages[pageIndex];
    
    if (!page.text || page.text.trim().length === 0) {
      console.log(`⚠️  Page ${page.page} is empty, skipping`);
      continue;
    }

    console.log(`📝 Processing page ${page.page} (${page.text.length} chars)`);
    
    try {
      const pageChunks = splitPageIntoChunks(page, previousChunkText);
      
      pageChunks.forEach(chunk => {
        if (isValidChunk(chunk)) {
          chunks.push({
            text: chunk.text,
            page: page.page,
            section: chunk.section || extractSectionTitle(chunk.text),
            chunkIndex: globalChunkIndex++
          });
          
          // Update previous chunk text for next page overlap
          previousChunkText = chunk.text;
        }
      });
      
    } catch (error) {
      console.error(`❌ Failed to chunk page ${page.page}:`, error.message);
      // Create a single chunk from the entire page as fallback
      if (page.text.length <= CHUNK_CONFIG.MAX_CHUNK_LENGTH) {
        chunks.push({
          text: page.text,
          page: page.page,
          section: extractSectionTitle(page.text),
          chunkIndex: globalChunkIndex++
        });
      }
    }
  }

  console.log(`✅ Created ${chunks.length} chunks from ${pages.length} pages`);
  
  // Add overlap between chunks for better context
  const chunksWithOverlap = addChunkOverlap(chunks);
  
  return chunksWithOverlap;
};

/**
 * Extract section title from text chunk
 * @param {string} text - Text content to analyze
 * @returns {string} - Detected section title or empty string
 * 
 * @private
 */
const extractSectionTitle = (text) => {
  if (!text || typeof text !== 'string' || text.length === 0) {
    return '';
  }

  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  if (lines.length === 0) return '';

  const firstLine = lines[0];
  
  // Pattern 1: ALL CAPS headings (common in technical manuals)
  // Example: "SAFETY PRECAUTIONS", "INSTALLATION INSTRUCTIONS"
  if (firstLine.length > 2 && firstLine.length < 80) {
    const upperCaseRatio = (firstLine.match(/[A-Z]/g) || []).length / firstLine.replace(/\s/g, '').length;
    if (upperCaseRatio > 0.7) {
      return firstLine;
    }
  }
  
  // Pattern 2: Numbered sections
  // Example: "1.0 Introduction", "2.3 Safety Guidelines", "Chapter 5: Maintenance"
  const numberedSection = firstLine.match(/^(\d+\.?\d*\s+|Chapter\s+\d+:?\s*|Section\s+\d+:?\s*|Part\s+\d+:?\s*)(.+)/i);
  if (numberedSection && numberedSection[2]) {
    return numberedSection[0].trim();
  }
  
  // Pattern 3: Title Case headings that are short and descriptive
  // Example: "Installation Overview", "Safety Requirements"
  if (firstLine.length > 5 && firstLine.length < 60) {
    const titleCasePattern = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/;
    const commonHeadings = /^(introduction|overview|safety|installation|operation|maintenance|troubleshooting|specifications|warranty|appendix)/i;
    
    if (titleCasePattern.test(firstLine) || commonHeadings.test(firstLine)) {
      return firstLine;
    }
  }
  
  // Pattern 4: Detect warning/caution blocks as sections
  const warningPattern = /^(WARNING|CAUTION|DANGER|NOTICE|IMPORTANT):?\s*/i;
  if (warningPattern.test(firstLine)) {
    return firstLine.match(warningPattern)[1].toUpperCase();
  }
  
  // No section detected
  return '';
};

/**
 * Split a single page into appropriately sized chunks
 * @param {Object} page - Page object with text content
 * @param {string} previousChunkText - Text from previous chunk for overlap
 * @returns {Array<{text: string, section: string}>} - Array of chunks for this page
 * 
 * @private
 */
const splitPageIntoChunks = (page, previousChunkText = '') => {
  const pageText = page.text.trim();
  if (!pageText) return [];

  // Step 1: Split into paragraphs while preserving structure
  const sections = splitIntoSections(pageText);
  const chunks = [];
  let currentChunk = '';
  let currentSection = '';

  for (const section of sections) {
    const sectionTokens = estimateTokenCount(section.text);
    const currentTokens = estimateTokenCount(currentChunk);

    // If this section contains procedures, try to keep it intact
    if (containsProcedure(section.text)) {
      // If current chunk + section would be too large, finalize current chunk
      if (currentTokens > 0 && currentTokens + sectionTokens > CHUNK_CONFIG.MAX_SIZE) {
        if (currentChunk.trim()) {
          chunks.push({
            text: currentChunk.trim(),
            section: currentSection
          });
        }
        currentChunk = '';
        currentSection = section.title || extractSectionTitle(section.text);
      }

      // If the entire procedure section fits in chunk size, add it
      if (sectionTokens <= CHUNK_CONFIG.MAX_SIZE) {
        if (!currentSection && section.title) {
          currentSection = section.title;
        }
        currentChunk += (currentChunk ? '\n\n' : '') + section.text;
      } else {
        // Procedure is too large, need to split it carefully
        const procedureChunks = splitLargeProcedure(section.text);
        for (const procChunk of procedureChunks) {
          chunks.push({
            text: procChunk,
            section: section.title || extractSectionTitle(procChunk)
          });
        }
      }
    } else {
      // Regular text - use normal chunking strategy
      if (currentTokens + sectionTokens > CHUNK_CONFIG.TARGET_SIZE && currentChunk.trim()) {
        chunks.push({
          text: currentChunk.trim(),
          section: currentSection
        });
        currentChunk = '';
        currentSection = section.title || extractSectionTitle(section.text);
      }

      if (!currentSection && section.title) {
        currentSection = section.title;
      }
      currentChunk += (currentChunk ? '\n\n' : '') + section.text;
    }

    // If current chunk is getting too large, finalize it
    if (estimateTokenCount(currentChunk) > CHUNK_CONFIG.MAX_SIZE) {
      if (currentChunk.trim()) {
        chunks.push({
          text: currentChunk.trim(),
          section: currentSection
        });
      }
      currentChunk = '';
      currentSection = '';
    }
  }

  // Add any remaining text as the final chunk
  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk.trim(),
      section: currentSection
    });
  }

  // Filter out chunks that are too small (unless they're the only chunk)
  const validChunks = chunks.length > 1 
    ? chunks.filter(chunk => estimateTokenCount(chunk.text) >= CHUNK_CONFIG.MIN_SIZE || containsProcedure(chunk.text))
    : chunks;

  return validChunks;
};

/**
 * Estimate token count for text (rough approximation)
 * @param {string} text - Text to count tokens for
 * @returns {number} - Estimated token count
 * 
 * @private
 */
const estimateTokenCount = (text) => {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  // Basic tokenization approximation
  // Split by whitespace to get word count
  const words = text.trim().split(/\s+/).filter(word => word.length > 0);
  
  // Account for punctuation and subword tokens
  // English text typically has ~1.3 tokens per word due to:
  // - Contractions (don't -> do, n't)
  // - Compound words being split
  // - Punctuation as separate tokens
  const tokenEstimate = Math.ceil(words.length * CHUNK_CONFIG.TOKENS_PER_WORD);
  
  return tokenEstimate;
};

/**
 * Check if text contains a procedure or numbered list
 * @param {string} text - Text to analyze
 * @returns {boolean} - True if text contains procedures
 * 
 * @private
 */
const containsProcedure = (text) => {
  if (!text || typeof text !== 'string') {
    return false;
  }

  // Pattern 1: Numbered steps (1., 2., 3., etc.)
  const numberedSteps = /^\s*\d+\.\s/gm;
  const numberedMatches = text.match(numberedSteps);
  if (numberedMatches && numberedMatches.length >= 2) {
    return true;
  }

  // Pattern 2: Lettered steps (a., b., c., etc.)
  const letteredSteps = /^\s*[a-z]\.\s/gim;
  const letteredMatches = text.match(letteredSteps);
  if (letteredMatches && letteredMatches.length >= 2) {
    return true;
  }

  // Pattern 3: Roman numeral steps (i., ii., iii., etc.)
  const romanSteps = /^\s*[ivx]+\.\s/gim;
  const romanMatches = text.match(romanSteps);
  if (romanMatches && romanMatches.length >= 2) {
    return true;
  }

  // Pattern 4: Bullet points with procedural language
  const bulletPoints = /^\s*[•·▪▫-]\s+/gm;
  const bulletMatches = text.match(bulletPoints);
  if (bulletMatches && bulletMatches.length >= 2) {
    // Check for procedural verbs (common in instructions)
    const proceduralVerbs = /(remove|install|connect|disconnect|turn|press|push|pull|open|close|adjust|check|verify|ensure|place|position|align|tighten|loosen)/i;
    if (proceduralVerbs.test(text)) {
      return true;
    }
  }

  // Pattern 5: Sequential language indicators
  const sequentialWords = /(first|second|third|next|then|finally|after|before|step|procedure)/gi;
  const sequentialMatches = text.match(sequentialWords);
  if (sequentialMatches && sequentialMatches.length >= 2) {
    return true;
  }

  // Pattern 6: "Step X" format
  const stepFormat = /step\s+\d+/gi;
  if (stepFormat.test(text)) {
    return true;
  }

  return false;
};

/**
 * Add overlap between consecutive chunks for better context
 * @param {Array} chunks - Array of chunks to add overlap to
 * @returns {Array} - Chunks with overlap added
 * 
 * @private
 */
const addChunkOverlap = (chunks) => {
  if (!chunks || chunks.length <= 1) {
    return chunks;
  }

  const chunksWithOverlap = [chunks[0]]; // First chunk doesn't need overlap

  for (let i = 1; i < chunks.length; i++) {
    const currentChunk = chunks[i];
    const previousChunk = chunks[i - 1];

    // Only add overlap if chunks are from the same page
    if (currentChunk.page === previousChunk.page) {
      const overlap = extractOverlapText(previousChunk.text, CHUNK_CONFIG.OVERLAP_SIZE);
      
      if (overlap) {
        const overlappedText = overlap + '\n\n' + currentChunk.text;
        
        // Make sure we don't exceed maximum chunk size
        if (overlappedText.length <= CHUNK_CONFIG.MAX_CHUNK_LENGTH) {
          chunksWithOverlap.push({
            ...currentChunk,
            text: overlappedText
          });
        } else {
          chunksWithOverlap.push(currentChunk);
        }
      } else {
        chunksWithOverlap.push(currentChunk);
      }
    } else {
      chunksWithOverlap.push(currentChunk);
    }
  }

  return chunksWithOverlap;
};

/**
 * Validate chunk quality and size
 * @param {Object} chunk - Chunk to validate
 * @returns {boolean} - True if chunk is valid
 * 
 * @private
 */
const isValidChunk = (chunk) => {
  if (!chunk || !chunk.text || typeof chunk.text !== 'string') {
    return false;
  }

  const text = chunk.text.trim();
  
  // Check minimum length (avoid tiny chunks unless they contain procedures)
  if (text.length < 50 && !containsProcedure(text)) {
    return false;
  }

  // Check maximum length (stay within embedding limits)
  if (text.length > CHUNK_CONFIG.MAX_CHUNK_LENGTH) {
    return false;
  }

  // Check token count
  const tokenCount = estimateTokenCount(text);
  if (tokenCount < 20 && !containsProcedure(text)) {
    return false;
  }

  if (tokenCount > CHUNK_CONFIG.MAX_SIZE * 1.2) { // 20% buffer
    return false;
  }

  // Check if contains meaningful content (not just whitespace/formatting)
  const meaningfulContent = text.replace(/[\s\n\r\t]+/g, ' ').trim();
  if (meaningfulContent.length < 10) {
    return false;
  }

  // Check if not just repeated characters or formatting
  const uniqueChars = new Set(text.toLowerCase().replace(/\s/g, ''));
  if (uniqueChars.size < 5) {
    return false;
  }

  return true;
};

/**
 * Split text into logical sections based on structure
 * @param {string} text - Text to split into sections
 * @returns {Array<{text: string, title: string}>} - Array of text sections
 * 
 * @private
 */
const splitIntoSections = (text) => {
  const sections = [];
  const lines = text.split('\n');
  let currentSection = '';
  let currentTitle = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Check if this line looks like a section header
    const detectedTitle = extractSectionTitle(trimmedLine);
    
    if (detectedTitle && currentSection.trim()) {
      // Start a new section
      sections.push({
        text: currentSection.trim(),
        title: currentTitle
      });
      currentSection = line + '\n';
      currentTitle = detectedTitle;
    } else if (detectedTitle && !currentSection.trim()) {
      // This is the first section
      currentSection = line + '\n';
      currentTitle = detectedTitle;
    } else {
      // Continue current section
      currentSection += line + '\n';
    }
  }

  // Add the last section
  if (currentSection.trim()) {
    sections.push({
      text: currentSection.trim(),
      title: currentTitle
    });
  }

  // If no sections were detected, treat the entire text as one section
  if (sections.length === 0) {
    sections.push({
      text: text,
      title: extractSectionTitle(text)
    });
  }

  return sections;
};

/**
 * Split large procedures that exceed chunk size limits
 * @param {string} procedureText - Text containing procedures to split
 * @returns {Array<string>} - Array of procedure chunks
 * 
 * @private
 */
const splitLargeProcedure = (procedureText) => {
  const chunks = [];
  const lines = procedureText.split('\n');
  let currentChunk = '';

  for (const line of lines) {
    const testChunk = currentChunk + (currentChunk ? '\n' : '') + line;
    
    // If adding this line would exceed the limit, start a new chunk
    if (estimateTokenCount(testChunk) > CHUNK_CONFIG.MAX_SIZE && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = line;
    } else {
      currentChunk = testChunk;
    }
  }

  // Add the last chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
};

/**
 * Extract overlap text from the end of a chunk
 * @param {string} text - Text to extract overlap from
 * @param {number} targetTokens - Target number of tokens for overlap
 * @returns {string} - Overlap text
 * 
 * @private
 */
const extractOverlapText = (text, targetTokens) => {
  if (!text || targetTokens <= 0) {
    return '';
  }

  // Split into sentences and work backwards
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim());
  if (sentences.length === 0) return '';

  let overlap = '';
  let tokenCount = 0;

  for (let i = sentences.length - 1; i >= 0; i--) {
    const sentence = sentences[i];
    const sentenceTokens = estimateTokenCount(sentence);
    
    if (tokenCount + sentenceTokens <= targetTokens) {
      overlap = sentence + (overlap ? ' ' + overlap : '');
      tokenCount += sentenceTokens;
    } else {
      break;
    }
  }

  return overlap.trim();
};