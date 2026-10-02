/**
 * Simple test script for LLM service
 */
import dotenv from 'dotenv';
import { streamChatResponse } from './src/services/llm.service.js';

// Load environment variables
dotenv.config();

// Mock SSE response object
const mockRes = {
  write: (data) => {
    console.log('SSE Data:', data);
  },
  flush: () => {
    console.log('SSE Flush called');
  }
};

// Test prompt
const testPrompt = `Based on the following manual excerpts, answer the user's question.

MANUAL EXCERPTS:
[Page 15] To change the oil in your engine:
1. Warm up the engine for 2-3 minutes
2. Turn off the engine and wait 5 minutes
3. Remove the drain plug with a 17mm wrench
4. Allow oil to drain completely (15-20 minutes)
5. Replace the drain plug and tighten to 25 ft-lbs
6. Remove old oil filter and install new one
7. Add 4.2 quarts of SAE 10W-30 oil

USER QUESTION: How do I change the oil?`;

async function testLLMService() {
  try {
    console.log('🧪 Testing LLM Service...');
    console.log('🔑 API Key loaded:', process.env.OPENROUTER_API_KEY ? 'Yes' : 'No');
    console.log('📝 Prompt:', testPrompt.substring(0, 100) + '...');
    
    const response = await streamChatResponse(mockRes, testPrompt, []);
    
    console.log('\n✅ Test completed successfully!');
    console.log('📄 Full response:', response);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testLLMService();