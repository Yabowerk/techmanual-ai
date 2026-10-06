import Document from '../models/Document.js';
import Chat from '../models/Chat.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { setupSSE, sendSSEEvent, sendToken, sendError, sendComplete, sendProgress, handleSSEDisconnect } from '../utils/sse.js';
import { hybridRetrieve } from '../services/retrieve.service.js';
import { rerank } from '../services/rerank.service.js';
import { buildQuestionPrompt, buildContext } from '../utils/prompts.js';
import { streamChatResponse } from '../services/llm.service.js';


/**
 * Stream chat response for a document
 * POST /api/chat/:docId
 * Body: { question }
 * Streams response via Server-Sent Events
 */
export const streamChat = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const documentId = req.params.docId;
  const { question } = req.body;

  // Verify document exists and belongs to user
  const document = await Document.findOne({ _id: documentId, userId });
  
  if (!document) {
    throw ApiError.notFound('Document not found');
  }

  // Only allow chat with ready documents
  if (document.status !== 'ready') {
    throw ApiError.badRequest(`Document is not ready for chat. Current status: ${document.status}`);
  }

  // Set up SSE headers
  setupSSE(res);

  // Handle client disconnect gracefully
  let isDisconnected = false;
  handleSSEDisconnect(req, res, () => {
    isDisconnected = true;
  });

  try {
    // Find or create chat conversation
    const chat = await Chat.findOrCreateChat(userId, documentId);
    
    // Add user message to conversation
    await chat.addUserMessage(question);
    sendProgress(res, 'message_saved', 'Question saved');

    if (isDisconnected) return;

    // STEP 1: Retrieve relevant chunks
    sendProgress(res, 'retrieving', 'Finding relevant information...');
    
    let relevantChunks;
    try {
      relevantChunks = await hybridRetrieve(userId, documentId, question);
    } catch (error) {
      sendProgress(res, 'retrieval_placeholder', 'Using placeholder response');
      
      // Send a placeholder response
      const placeholderResponse = `I apologize, but the retrieval and LLM services are not yet fully implemented.`;

      // Simulate streaming response
      const words = placeholderResponse.split(' ');
      for (let i = 0; i < words.length; i++) {
        if (isDisconnected) return;
        
        sendToken(res, words[i] + ' ');
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await chat.addAssistantMessage(placeholderResponse, []);
      
      sendComplete(res, {
        message: 'Response completed (placeholder)',
        tokensGenerated: words.length,
        citationsFound: 0
      });
      return;
    }

    if (isDisconnected) return;

    // STEP 2: Re-rank chunks for better relevance
    sendProgress(res, 'reranking', 'Improving relevance...');
    
    let rankedChunks;
    try {
      rankedChunks = await rerank(question, relevantChunks, 5);
    } catch (error) {
      // Fallback to original order if reranking fails
      rankedChunks = relevantChunks.slice(0, 5).map(chunk => ({ chunk, relevanceScore: 0.8 }));
    }

    if (isDisconnected) return;

    // STEP 3: Generate response using LLM
    sendProgress(res, 'generating', 'Generating response...');
    
    try {
      // Get conversation history for context
      const history = chat.getSummaryHistory(6);

      // Build the prompt
      const chunks = rankedChunks.map(r => r.chunk);
      const prompt = buildQuestionPrompt(question, chunks, history);

      // Prepare citations from the chunks
      const citations = chunks.slice(0, 3).map(chunk => ({
        page: chunk.page,
        chunkId: chunk._id
      }));

      // Stream the LLM response
      const fullResponse = await streamChatResponse(res, prompt, chunks);

      // Validate response before saving
      if (!fullResponse || fullResponse.trim().length === 0) {
        const fallbackResponse = "I apologize, but I was unable to generate a response. Please try rephrasing your question.";
        await chat.addAssistantMessage(fallbackResponse, citations);
      } else {
        // Save assistant response to chat history
        await chat.addAssistantMessage(fullResponse, citations);
      }

      sendComplete(res, {
        message: 'Response completed',
        tokensGenerated: 0,
        citationsFound: citations.length,
        chunksUsed: chunks.length
      });

    } catch (error) {
      console.error(`❌ Chat generation error:`, error);
      sendError(res, 'Failed to generate response');
    }

  } catch (error) {
    console.error(`❌ Chat error for document ${documentId}:`, error);
    
    if (!isDisconnected) {
      sendError(res, error.message || 'An error occurred');
    }
  }
});

/**
 * Get chat history for a document
 * GET /api/chat/:docId
 */
export const getChatHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const documentId = req.params.docId;

  // Verify document exists and belongs to user
  const document = await Document.findOne({ _id: documentId, userId });
  
  if (!document) {
    throw ApiError.notFound('Document not found');
  }

  // Find existing chat or return empty history
  const chat = await Chat.findOne({ userId, documentId }).populate('documentId', 'title originalFilename summary');
  
  if (!chat) {
    return res.json({
      messages: [],
      document: {
        id: document._id,
        title: document.title,
        originalFilename: document.originalFilename,
        status: document.status,
        summary: document.summary
      }
    });
  }

  console.log(`📜 Returning chat history for document ${documentId}: ${chat.messages.length} messages`);
  
  // Return chat history
  res.json({
    messages: chat.messages.map(msg => ({
      id: msg._id,
      role: msg.role,
      content: msg.content,
      citations: msg.citations,
      createdAt: msg.createdAt
    })),
    document: {
      id: document._id,
      title: document.title,
      originalFilename: document.originalFilename,
      status: document.status,
      summary: document.summary
    },
    conversationStats: {
      messageCount: chat.messages.length,
      userMessageCount: chat.getUserMessageCount(),
      isFirstInteraction: chat.isFirstInteraction(),
      lastMessageAt: chat.lastMessageAt,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt
    }
  });
});

/**
 * Clear chat history for a document
 * DELETE /api/chat/:docId
 */
export const clearChatHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const documentId = req.params.docId;

  // Verify document exists and belongs to user
  const document = await Document.findOne({ _id: documentId, userId });
  
  if (!document) {
    throw ApiError.notFound('Document not found');
  }

  // Find and clear chat history (but keep welcome message)
  const chat = await Chat.findOne({ userId, documentId });
  
  if (chat) {
    await chat.clearUserHistory(); // This preserves the welcome message
    console.log(`🧹 Cleared user chat history for document ${documentId} (kept welcome message)`);
  }

  res.json({
    message: 'Chat history cleared successfully',
    documentId: document._id,
    note: 'Welcome message with document summary has been preserved'
  });
});

/**
 * Get chat statistics for user
 * GET /api/chat/stats
 */
export const getChatStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  try {
    // Aggregate chat statistics
    const stats = await Chat.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalConversations: { $sum: 1 },
          totalMessages: { $sum: { $size: '$messages' } },
          avgMessagesPerConversation: { $avg: { $size: '$messages' } },
          lastActivity: { $max: '$updatedAt' }
        }
      }
    ]);

    const result = stats[0] || {
      totalConversations: 0,
      totalMessages: 0,
      avgMessagesPerConversation: 0,
      lastActivity: null
    };

    // Get conversations by document
    const conversationsByDocument = await Chat.find({ userId })
      .populate('documentId', 'title originalFilename')
      .select('documentId messages.length updatedAt')
      .sort({ updatedAt: -1 })
      .limit(10);

    res.json({
      totalConversations: result.totalConversations,
      totalMessages: result.totalMessages,
      avgMessagesPerConversation: Math.round(result.avgMessagesPerConversation * 100) / 100,
      lastActivity: result.lastActivity,
      recentConversations: conversationsByDocument.map(chat => ({
        documentId: chat.documentId._id,
        documentTitle: chat.documentId.title,
        messageCount: chat.messages.length,
        lastActivity: chat.updatedAt
      }))
    });

  } catch (error) {
    console.error('❌ Failed to get chat stats:', error);
    throw ApiError.internal('Failed to retrieve chat statistics');
  }
});

/**
 * Regenerate welcome message for a document
 * POST /api/chat/:docId/welcome
 */
export const regenerateWelcomeMessage = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const documentId = req.params.docId;

  // Verify document exists and belongs to user
  const document = await Document.findOne({ _id: documentId, userId });
  
  if (!document) {
    throw ApiError.notFound('Document not found');
  }

  if (document.status !== 'ready' || !document.summary) {
    throw ApiError.badRequest('Document must be ready and have a summary to generate welcome message');
  }

  // Find or create chat
  let chat = await Chat.findOne({ userId, documentId });
  
  if (!chat) {
    // Create new chat with welcome message (will be added automatically)
    chat = await Chat.findOrCreateChat(userId, documentId);
  } else {
    // Remove existing welcome message (first assistant message if no user messages)
    if (chat.getUserMessageCount() === 0 && chat.messages.length > 0 && chat.messages[0].role === 'assistant') {
      chat.messages.shift(); // Remove first message
    }
    
    // Add new welcome message
    const welcomeMessage = `👋 **Welcome to your technical manual assistant!**

Here's what this manual covers:

${document.summary}

---

🤖 **I can help you with:**
• Finding specific procedures and instructions
• Explaining safety requirements and warnings  
• Locating troubleshooting information
• Understanding technical specifications
• Answering questions about equipment operation

💡 **Ask me anything about this manual - I'll provide answers with exact page references!**`;

    chat.messages.unshift({
      role: 'assistant',
      content: welcomeMessage,
      citations: [],
      createdAt: new Date()
    });
    
    await chat.save();
  }

  console.log(`🔄 Regenerated welcome message for document ${documentId}`);

  res.json({
    message: 'Welcome message regenerated successfully',
    documentId: document._id,
    welcomeMessage: chat.messages[0].content
  });
});