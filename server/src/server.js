import createApp from './app.js';
import { connectDB } from './config/db.js';
import { handleUncaughtErrors } from './middleware/errorHandler.js';
import config from './config/env.js';

/**
 * Start the TechManual AI server
 */
const startServer = async () => {
  try {
    console.log('🚀 Starting TechManual AI Server...\n');

    // Handle uncaught errors gracefully
    handleUncaughtErrors();

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await connectDB();

    // Create Express application
    console.log('⚙️  Setting up Express application...');
    const app = createApp();

    // Start the server
    const server = app.listen(config.PORT, () => {
      console.log('\n🎉 TechManual AI Server Started Successfully!\n');
      console.log('📋 Server Information:');
      console.log(`   • Environment: ${config.NODE_ENV}`);
      console.log(`   • Port: ${config.PORT}`);
      console.log(`   • URL: http://localhost:${config.PORT}`);
      console.log(`   • Health Check: http://localhost:${config.PORT}/health`);
      console.log(`   • API Documentation: http://localhost:${config.PORT}/api`);
      console.log(`   • Client URL: ${config.CLIENT_URL}`);
      console.log('\n🔧 Configuration:');
      console.log(`   • Max Upload Size: ${config.MAX_UPLOAD_MB}MB`);
      console.log(`   • Max Documents per User: ${config.MAX_DOCS_PER_USER}`);
      console.log(`   • Max Questions per Day: ${config.MAX_QUESTIONS_PER_DAY}`);
      console.log(`   • Embedding Model: ${config.EMBEDDING_MODEL} (${config.EMBEDDING_DIMENSIONS}D)`);
      console.log(`   • LLM Model: ${config.CLAUDE_MODEL}`);
      console.log('\n🔑 API Keys Status:');
      console.log(`   • OpenAI: ${config.OPENAI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
      console.log(`   • Anthropic: ${config.ANTHROPIC_API_KEY ? '✅ Configured' : '❌ Missing'}`);
      console.log(`   • Cohere: ${config.COHERE_API_KEY ? '✅ Configured' : '❌ Missing'}`);
      console.log('\n📝 Available Endpoints:');
      console.log('   Authentication:');
      console.log('     POST /api/auth/register - Register new user');
      console.log('     POST /api/auth/login - User login');
      console.log('     POST /api/auth/logout - User logout');
      console.log('     GET  /api/auth/me - Get user profile');
      console.log('   Document Management:');
      console.log('     POST /api/upload - Upload PDF document');
      console.log('     GET  /api/docs - List user documents');
      console.log('     GET  /api/docs/:id - Get document details');
      console.log('     GET  /api/docs/:id/file - Stream PDF file');
      console.log('     DELETE /api/docs/:id - Delete document');
      console.log('   Chat:');
      console.log('     POST /api/chat/:docId - Chat with document (SSE)');
      console.log('     GET  /api/chat/:docId - Get chat history');
      console.log('\n🔄 Services Status:');
      console.log('   ✅ Authentication - Fully implemented');
      console.log('   ✅ File Upload & Storage - Fully implemented');
      console.log('   ✅ Document Management - Fully implemented');
      console.log('   ✅ Chat Infrastructure - Fully implemented');
      console.log('   ✅ PDF Parsing - Fully implemented (unpdf with text cleaning)');
      console.log('   ✅ Text Chunking - Fully implemented (section-aware splitting with procedure detection)');
      console.log('   🔨 Embeddings - Stub (implement OpenAI integration)');
      console.log('   🔨 Vector Search - Stub (implement Atlas Vector Search)');
      console.log('   🔨 Reranking - Stub (implement Cohere integration)');
      console.log('   🔨 LLM Generation - Stub (implement Claude streaming)');
      console.log('\n📚 Next Steps:');
      console.log('   1. Create Atlas Vector Search and Search indexes');
      console.log('   2. Implement the stub services (parse, chunk, embed, retrieve, rerank)');
      console.log('   3. Add your LLM integration in the chat controller');
      console.log('   4. Test the complete RAG pipeline');
      console.log('\n🎯 Ready to serve requests!');
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal) => {
      console.log(`\n📴 Received ${signal}. Starting graceful shutdown...`);
      
      server.close(async () => {
        console.log('🔌 HTTP server closed');
        
        try {
          // Close database connection
          await import('mongoose').then(mongoose => mongoose.default.connection.close());
          console.log('🗄️  Database connection closed');
          
          console.log('✅ Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        console.error('⏰ Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    };

    // Listen for shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    
    // Log specific error details for debugging
    if (error.code === 'EADDRINUSE') {
      console.error(`   Port ${config.PORT} is already in use. Please use a different port.`);
    } else if (error.name === 'MongoNetworkError') {
      console.error('   Failed to connect to MongoDB. Check your MONGODB_URI.');
    } else if (error.name === 'ZodError') {
      console.error('   Configuration error. Check your environment variables.');
    }
    
    process.exit(1);
  }
};

// Start the server
startServer();