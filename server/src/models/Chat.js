import mongoose from 'mongoose';

// Schema for individual chat messages
const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: {
        values: ['user', 'assistant'],
        message: 'Role must be either user or assistant'
      },
      required: [true, 'Message role is required']
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      maxlength: [10000, 'Message content cannot exceed 10000 characters']
    },
    citations: [{
      page: {
        type: Number,
        required: true,
        min: [1, 'Page number must be at least 1']
      },
      chunkId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chunk',
        required: true
      }
    }],
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: true // Enable _id for messages to allow easy reference
  }
);

// Main chat schema
const chatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true // Index for data isolation queries
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: [true, 'Document ID is required'],
      index: true // Index for document-based queries
    },
    messages: {
      type: [messageSchema],
      default: [],
      validate: {
        validator: function(messages) {
          return messages.length <= 100; // Limit conversation length
        },
        message: 'Chat cannot have more than 100 messages'
      }
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true
    }
  }
);

// Compound indexes for efficient queries
chatSchema.index({ userId: 1, documentId: 1 });
chatSchema.index({ userId: 1, updatedAt: -1 });

// Virtual for message count
chatSchema.virtual('messageCount').get(function() {
  return this.messages.length;
});

// Virtual for last message timestamp
chatSchema.virtual('lastMessageAt').get(function() {
  if (this.messages.length === 0) return null;
  return this.messages[this.messages.length - 1].createdAt;
});

// Method to add a user message
chatSchema.methods.addUserMessage = function(content) {
  this.messages.push({
    role: 'user',
    content: content.trim(),
    citations: []
  });
  return this.save();
};

// Method to add an assistant message with citations
chatSchema.methods.addAssistantMessage = function(content, citations = []) {
  this.messages.push({
    role: 'assistant',
    content: content.trim(),
    citations: citations
  });
  return this.save();
};

// Method to get recent conversation history (for context)
chatSchema.methods.getRecentHistory = function(limit = 10) {
  const recentMessages = this.messages.slice(-limit);
  return recentMessages.map(msg => ({
    role: msg.role,
    content: msg.content,
    createdAt: msg.createdAt
  }));
};

// Method to get conversation summary for token optimization
chatSchema.methods.getSummaryHistory = function(limit = 6) {
  const recentMessages = this.messages.slice(-limit);
  return recentMessages.map(msg => ({
    role: msg.role,
    content: msg.content.substring(0, 500) // Truncate long messages
  }));
};

// Static method to find or create chat for user and document
chatSchema.statics.findOrCreateChat = async function(userId, documentId) {
  let chat = await this.findOne({ userId, documentId });
  
  if (!chat) {
    // Import Document model to get summary
    const Document = mongoose.model('Document');
    const document = await Document.findById(documentId);
    
    // Create new chat
    chat = new this({ userId, documentId, messages: [] });
    
    // Add welcome message with document summary if document is ready
    if (document && document.status === 'ready' && document.summary) {
      const welcomeMessage = ` **Welcome to your technical manual assistant!**

Here's what this manual covers:

${document.summary}

---

 **I can help you with:**
• Finding specific procedures and instructions
• Explaining safety requirements and warnings  
• Locating troubleshooting information
• Understanding technical specifications
• Answering questions about equipment operation

💡 **Ask me anything about this manual - I'll provide answers with exact page references!**`;

      chat.messages.push({
        role: 'assistant',
        content: welcomeMessage,
        citations: [],
        createdAt: new Date()
      });
    }
    
    await chat.save();
  }
  
  return chat;
};

// Static method to find user's chats
chatSchema.statics.findByUser = function(userId, options = {}) {
  const query = this.find({ userId });
  
  if (options.documentId) {
    query.where('documentId', options.documentId);
  }
  
  return query.sort({ updatedAt: -1 });
};

// Method to check if this is the first user interaction (only welcome message exists)
chatSchema.methods.isFirstInteraction = function() {
  // If there's exactly 1 message and it's from assistant, it's the welcome message
  return this.messages.length === 1 && this.messages[0].role === 'assistant';
};

// Method to clear conversation history (keep the chat but remove messages)
chatSchema.methods.clearHistory = function() {
  this.messages = [];
  return this.save();
};

// Method to clear conversation but keep welcome message
chatSchema.methods.clearUserHistory = function() {
  // Keep only the first assistant message (welcome message) if it exists
  const welcomeMessage = this.messages.find(msg => msg.role === 'assistant');
  this.messages = welcomeMessage ? [welcomeMessage] : [];
  return this.save();
};

// Pre-save middleware to update timestamps and validate
chatSchema.pre('save', function(next) {
  // Update the updatedAt timestamp when new messages are added
  if (this.isModified('messages')) {
    this.updatedAt = new Date();
  }
  
  // Ensure messages are in chronological order
  this.messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  
  next();
});

// Virtual populate for document information
chatSchema.virtual('document', {
  ref: 'Document',
  localField: 'documentId',
  foreignField: '_id',
  justOne: true
});

const Chat = mongoose.model('Chat', chatSchema);

export default Chat;