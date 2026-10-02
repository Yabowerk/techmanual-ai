/**
 * LLM prompts for TechManual AI
 * Contains system prompts and context building functions
 */

/**
 * System prompt for Claude to answer questions based only on manual excerpts
 * Instructs the model to be grounded, cite pages, and admit when information is missing
 */
export const ANSWER_SYSTEM_PROMPT = `You are a technical assistant helping users with equipment manuals. Your role is to provide accurate, safe, and helpful answers based ONLY on the provided manual excerpts.

CRITICAL INSTRUCTIONS:
1. ONLY use information from the provided manual excerpts - never use outside knowledge
2. ALWAYS cite every claim with [page N] where N is the page number from the excerpts
3. If multiple pages contain relevant information, cite all: [page 12, page 45]
4. Include any WARNING, CAUTION, DANGER, or NOTICE text found in the excerpts alongside procedures
5. Present step-by-step procedures as numbered lists for clarity
6. If the excerpts do not contain enough information to answer the question, respond exactly: "This manual doesn't cover that."
7. Never make assumptions or fill in gaps with general knowledge
8. Be precise and specific - avoid vague or general statements

SAFETY REQUIREMENTS:
- Always include safety warnings from the manual text
- Highlight any prerequisites or required tools mentioned
- Note any environmental conditions or limitations specified
- If safety information is incomplete, mention this limitation

RESPONSE FORMAT:
- Start with a direct answer when possible
- Use numbered lists for procedures
- Include relevant warnings in **bold**
- End with page citations for all information used
- Be concise but complete

Remember: Your credibility comes from being accurate and honest about the manual's coverage, not from trying to answer everything.`;

/**
 * System prompt for document summarization
 * Instructs the model to create concise summaries of technical manuals
 */
export const SUMMARY_PROMPT = `Analyze the provided technical manual content and create a comprehensive summary in under 200 words.

Include:
1. What equipment or system this manual covers (model, type, purpose)
2. Main sections and topics covered
3. Key operational procedures or functions
4. Important safety considerations mentioned
5. Target audience (technicians, operators, maintenance staff, etc.)

Format:
- Start with a clear identification of the equipment/system
- Use bullet points for main sections
- Highlight critical safety or operational notes
- Keep it concise and informative

Focus on giving readers a clear understanding of what they can expect to find in this manual and its primary use cases.`;

/**
 * Build context string from chunks for LLM input
 * Formats chunks with page numbers and section headers for optimal LLM parsing
 * 
 * @param {Array} chunks - Array of chunk objects with text, page, and section properties
 * @returns {string} - Formatted context string
 */
export const buildContext = (chunks) => {
  if (!chunks || chunks.length === 0) {
    return 'No relevant information found in the manual.';
  }

  const contextBlocks = chunks.map((chunk, index) => {
    const pageInfo = `[page ${chunk.page}${chunk.section ? ` | section ${chunk.section}` : ''}]`;
    const separator = index > 0 ? '\n---\n\n' : '';
    
    return `${separator}${pageInfo}\n${chunk.text.trim()}`;
  });

  return contextBlocks.join('');
};

/**
 * Build context for document summarization
 * Creates a formatted string of all document chunks for summary generation
 * 
 * @param {Array} chunks - Array of all chunks from the document
 * @returns {string} - Formatted content for summarization
 */
export const buildSummaryContext = (chunks) => {
  if (!chunks || chunks.length === 0) {
    return 'No content available for summarization.';
  }

  // Group chunks by page for better organization
  const pageGroups = chunks.reduce((acc, chunk) => {
    const page = chunk.page;
    if (!acc[page]) {
      acc[page] = [];
    }
    acc[page].push(chunk);
    return acc;
  }, {});

  // Build summary context with page organization
  const pages = Object.keys(pageGroups)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .map(pageNum => {
      const pageChunks = pageGroups[pageNum];
      const pageContent = pageChunks.map(chunk => chunk.text.trim()).join(' ');
      return `=== Page ${pageNum} ===\n${pageContent}`;
    });

  return pages.join('\n\n');
};

/**
 * Create a user prompt for question answering
 * Combines the user's question with formatted context
 * 
 * @param {string} question - User's question
 * @param {Array} chunks - Relevant chunks for context
 * @param {Array} history - Previous conversation messages (optional)
 * @returns {string} - Complete user prompt
 */
export const buildQuestionPrompt = (question, chunks, history = []) => {
  let prompt = '';

  // Add conversation history if provided
  if (history && history.length > 0) {
    prompt += 'Previous conversation:\n';
    history.slice(-6).forEach(msg => { // Only include last 6 messages to avoid token limits
      prompt += `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}\n`;
    });
    prompt += '\n---\n\n';
  }

  // Add current question
  prompt += `Question: ${question}\n\n`;

  // Add manual context
  prompt += 'Relevant manual excerpts:\n';
  prompt += buildContext(chunks);

  return prompt;
};