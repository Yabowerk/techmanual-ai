/**
 * LLM Service - OpenRouter integration
 * Handles streaming chat responses with OpenRouter API
 */

import { sendToken } from '../utils/sse.js';

/**
 * System prompt for TechManual AI assistant
 */
const SYSTEM_PROMPT = `You are a technical assistant helping users with equipment manuals. Your role is to provide accurate, safe, and helpful answers based ONLY on the provided manual excerpts.

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
 * Stream chat response to client via SSE
 * Calls OpenRouter API with streaming and forwards tokens to client
 * 
 * @param {Object} res - Express response object for SSE streaming
 * @param {string} userPrompt - The complete prompt with manual context
 * @param {Array} chunks - The chunks used for context (for citations)
 * @returns {Promise<string>} - The full response text
 */
export const streamChatResponse = async (res, userPrompt, chunks) => {
  try {
    // Prepare request body
    const requestBody = {
      model: 'openai/gpt-4o-mini', // Using reliable OpenAI model
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      stream: true,
      temperature: 0.7,
      max_tokens: 2000
    };

    // Make request to OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5001',
        'X-Title': 'TechManual AI'
      },
      body: JSON.stringify(requestBody)
    }).catch(error => {
      console.error('❌ Fetch error details:', error);
      throw error;
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ OpenRouter API error (${response.status}):`, errorText);
      throw new Error(`OpenRouter API failed: ${response.status} - ${errorText}`);
    }

    let fullResponse = '';

    // Handle streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            
            if (data === '[DONE]') {
              break;
            }

            if (data === '') continue;

            try {
              const json = JSON.parse(data);
              
              // Handle error in streaming response
              if (json.error) {
                console.error(`❌ Streaming error:`, json.error);
                throw new Error(`Streaming error: ${json.error.message}`);
              }
              
              const content = json.choices?.[0]?.delta?.content || '';
              
              if (content) {
                fullResponse += content;
                
                // Send token to client via SSE
                await sendToken(res, content);
              }
            } catch (parseError) {
              // Skip non-JSON lines or comments - silently ignore
              if (data.startsWith('{')) {
                console.debug(`Parse error in stream chunk:`, parseError.message);
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    console.log(`✅ OpenRouter response completed`);
    return fullResponse;

  } catch (error) {
    console.error(`❌ OpenRouter API error:`, error.message);
    throw new Error(`LLM API failed: ${error.message}`);
  }
};

/**
 * Get model name for current configuration
 */
export const getModelName = () => {
  return process.env.LLM_MODEL || 'openai/gpt-4o-mini';
};

/**
 * Summarize document content using LLM (non-streaming)
 * Used for document summarization during ingestion
 * 
 * @param {string} prompt - The summarization prompt with document content
 * @returns {Promise<string>} - Generated summary
 */
export const summarizeDocument = async (prompt) => {
  try {
    console.log(`📝 Calling OpenRouter for document summarization...`);

    // Prepare request body (non-streaming for clean text response)
    const requestBody = {
      model: 'openai/gpt-4o-mini', // Using cost-effective model
      messages: [
        {
          role: 'system',
          content: 'You are a technical writing assistant. Create a VERY BRIEF summary of technical manuals in exactly 3 lines. Each line should be concise and start with an emoji. Format: Line 1: Equipment/Type, Line 2: Main Purpose, Line 3: Key Use Cases. Do NOT add paragraphs, do NOT exceed 3 lines.'
        },
        { role: 'user', content: prompt }
      ],
      stream: false, // Non-streaming for clean response
      temperature: 0.3, // Lower temperature for more consistent summaries
      max_tokens: 150 // Limit summary length to force brevity
    };

    // Make request to OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5001',
        'X-Title': 'TechManual AI'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ OpenRouter summarization error (${response.status}):`, errorText);
      throw new Error(`OpenRouter API failed: ${response.status}`);
    }

    const result = await response.json();
    
    // Handle error in response
    if (result.error) {
      console.error(`❌ Summarization API error:`, result.error);
      throw new Error(`API error: ${result.error.message}`);
    }

    const summary = result.choices?.[0]?.message?.content || '';
    
    if (!summary || summary.trim().length === 0) {
      throw new Error('Empty response from summarization API');
    }

    console.log(`✅ Generated summary (${summary.length} chars): ${summary.substring(0, 100)}...`);
    return summary.trim();

  } catch (error) {
    console.error(`❌ Document summarization failed:`, error.message);
    throw new Error(`Summarization failed: ${error.message}`);
  }
};
