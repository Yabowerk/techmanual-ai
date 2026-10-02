# TechManual AI Backend

A RAG (Retrieval-Augmented Generation) backend API for technical manual chat applications. Allows users to upload PDF manuals, automatically processes them with embeddings, and provides grounded chat responses with page citations.

## 🏗️ Architecture

- **Runtime**: Node.js 20+ with ES Modules
- **Framework**: Express.js
- **Database**: MongoDB Atlas with Mongoose
- **Authentication**: JWT with httpOnly cookies, bcrypt password hashing
- **File Processing**: PDF parsing, text chunking, vector embeddings
- **Search**: Hybrid vector similarity + keyword search with reranking
- **LLM**: Anthropic Claude with streaming responses
- **Security**: Helmet, CORS, rate limiting, input validation

## 📋 Prerequisites

- Node.js 20 or higher
- MongoDB Atlas account and cluster
- API keys for:
  - OpenAI (for embeddings)
  - Anthropic (for LLM responses)
  - Cohere (for reranking)

## 🚀 Quick Start

### 1. Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### 2. Environment Configuration

Edit `.env` with your configuration:

```env
# Server Configuration
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/techmanual-ai

# Authentication
JWT_SECRET=your-super-secret-jwt-key-here-change-in-production
JWT_EXPIRES_IN=7d

# AI Service API Keys
OPENAI_API_KEY=sk-your-openai-api-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here
COHERE_API_KEY=your-cohere-api-key-here

# AI Model Configuration
CLAUDE_MODEL=claude-3-5-sonnet-20241022
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536

# File Upload Limits
MAX_UPLOAD_MB=20
MAX_DOCS_PER_USER=5

# Rate Limiting
MAX_QUESTIONS_PER_DAY=50

# Atlas Index Names
VECTOR_INDEX_NAME=chunk_vector_index
SEARCH_INDEX_NAME=chunk_text_index
```

### 3. MongoDB Atlas Setup

#### Create Atlas Indexes

You must create these indexes in your MongoDB Atlas cluster for the search functionality to work:

1. **Vector Search Index** (for semantic similarity):
   - Go to Atlas → Database → Search → Create Index
   - Choose "Atlas Vector Search"
   - Database: `techmanual-ai`
   - Collection: `chunks`
   - Index Name: `chunk_vector_index`
   - Use the definition from `atlas-indexes/vector-index.json`

2. **Atlas Search Index** (for keyword search):
   - Go to Atlas → Database → Search → Create Index  
   - Choose "Atlas Search"
   - Database: `techmanual-ai`
   - Collection: `chunks`
   - Index Name: `chunk_text_index`
   - Use the definition from `atlas-indexes/search-index.json`

#### Detailed Index Creation Steps

**Vector Search Index:**
1. In Atlas UI: Database → Search → Create Index → Atlas Vector Search
2. Select your cluster and database
3. Collection: `chunks`
4. Index Name: `chunk_vector_index`
5. JSON Editor → paste content from `atlas-indexes/vector-index.json`
6. Create Index

**Atlas Search Index:**
1. In Atlas UI: Database → Search → Create Index → Atlas Search
2. Select your cluster and database  
3. Collection: `chunks`
4. Index Name: `chunk_text_index`
5. JSON Editor → paste content from `atlas-indexes/search-index.json`
6. Create Index

### 4. Start the Server

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:5000`

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Register new user | ❌ |
| POST | `/api/auth/login` | User login | ❌ |
| POST | `/api/auth/logout` | User logout | ❌ |
| GET | `/api/auth/me` | Get current user profile | ✅ |
| POST | `/api/auth/refresh` | Refresh auth token | ✅ |

### Document Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/upload` | Upload PDF document | ✅ |
| GET | `/api/upload/status/:id` | Get upload/processing status | ✅ |
| DELETE | `/api/upload/:id` | Cancel upload | ✅ |
| GET | `/api/upload/stats` | Get upload statistics | ✅ |
| GET | `/api/docs` | List user's documents | ✅ |
| GET | `/api/docs/:id` | Get document details | ✅ |
| GET | `/api/docs/:id/file` | Stream PDF file | ✅ |
| GET | `/api/docs/:id/chunks` | Get document chunks | ✅ |
| PATCH | `/api/docs/:id` | Update document metadata | ✅ |
| DELETE | `/api/docs/:id` | Delete document | ✅ |

### Chat

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/chat/:docId` | Chat with document (SSE) | ✅ |
| GET | `/api/chat/:docId` | Get chat history | ✅ |
| DELETE | `/api/chat/:docId` | Clear chat history | ✅ |
| GET | `/api/chat/stats` | Get chat statistics | ✅ |

### System

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/health` | Health check | ❌ |
| GET | `/api/status` | Detailed system status | ❌ |
| GET | `/api` | API documentation | ❌ |

## 🔧 Configuration Details

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | ❌ | 5000 | Server port |
| `NODE_ENV` | ❌ | development | Environment mode |
| `CLIENT_URL` | ✅ | - | Frontend URL for CORS |
| `MONGODB_URI` | ✅ | - | MongoDB Atlas connection string |
| `JWT_SECRET` | ✅ | - | JWT signing secret (min 32 chars) |
| `JWT_EXPIRES_IN` | ❌ | 7d | JWT expiration time |
| `OPENAI_API_KEY` | ✅ | - | OpenAI API key for embeddings |
| `ANTHROPIC_API_KEY` | ✅ | - | Anthropic API key for LLM |
| `COHERE_API_KEY` | ✅ | - | Cohere API key for reranking |
| `CLAUDE_MODEL` | ❌ | claude-3-5-sonnet-20241022 | Claude model name |
| `EMBEDDING_MODEL` | ❌ | text-embedding-3-small | OpenAI embedding model |
| `EMBEDDING_DIMENSIONS` | ❌ | 1536 | Embedding vector dimensions |
| `MAX_UPLOAD_MB` | ❌ | 20 | Max file upload size |
| `MAX_DOCS_PER_USER` | ❌ | 5 | Max documents per user |
| `MAX_QUESTIONS_PER_DAY` | ❌ | 50 | Rate limit for chat |

### Rate Limits

- **Auth endpoints**: 10 requests / 15 minutes per IP
- **Upload endpoints**: 10 requests / hour per user
- **Chat endpoints**: 30 requests / 10 minutes per user
- **General API**: 100 requests / 15 minutes per IP

## 🛠️ Development

### NPM Scripts

```bash
npm run dev      # Start development server with auto-restart
npm start        # Start production server
npm run lint     # Run ESLint
npm run format   # Format code with Prettier
```

### Project Structure

```
server/
├── src/
│   ├── config/           # Configuration and database connection
│   ├── models/           # Mongoose schemas
│   ├── middleware/       # Express middleware
│   ├── routes/           # API route definitions
│   ├── controllers/      # Route controllers
│   ├── services/         # Business logic services
│   ├── utils/            # Utility functions and helpers
│   ├── app.js           # Express app configuration
│   └── server.js        # Server entry point
├── atlas-indexes/        # MongoDB Atlas index definitions
├── uploads/             # Local file storage (gitignored)
├── .env.example         # Environment template
└── package.json         # Dependencies and scripts
```

## 🔄 Implementation Status

### ✅ Implemented (Working)

- **Authentication System**: Complete JWT auth with secure cookies
- **File Upload & Storage**: PDF upload with validation and local storage
- **Document Management**: CRUD operations with user isolation
- **Database Models**: User, Document, Chunk, Chat with proper indexes
- **Security**: Rate limiting, CORS, helmet, input validation
- **API Infrastructure**: Error handling, validation, SSE streaming
- **Chat Infrastructure**: Conversation management and history

### 🔨 To Be Implemented (Stubs Ready)

The following services have complete function signatures and detailed TODO documentation:

1. **PDF Parsing** (`src/services/parse.service.js`)
   - Integrate `unpdf` library for text extraction
   - Implement page-by-page text extraction
   - Handle metadata extraction

2. **Text Chunking** (`src/services/chunk.service.js`)
   - Section-aware text splitting
   - Preserve procedures and numbered steps
   - Target 500-800 tokens per chunk with overlap

3. **Embeddings** (`src/services/embed.service.js`)
   - OpenAI API integration with batching
   - Query embedding generation
   - Error handling and retries

4. **Hybrid Search** (`src/services/retrieve.service.js`)
   - MongoDB Atlas Vector Search integration
   - Atlas Search for keyword search
   - Reciprocal Rank Fusion (RRF) combination

5. **Reranking** (`src/services/rerank.service.js`)
   - Cohere rerank API integration
   - Relevance score optimization

6. **LLM Integration** (in chat controller)
   - Anthropic Claude API with streaming
   - Grounded response generation
   - Page citation extraction

## 🧪 Testing the API

### Health Check

```bash
curl http://localhost:5000/health
```

### Register User

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'
```

### Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  -c cookies.txt
```

### Upload Document

```bash
curl -X POST http://localhost:5000/api/upload \
  -b cookies.txt \
  -F "file=@manual.pdf"
```

### Get User Profile

```bash
curl http://localhost:5000/api/auth/me \
  -b cookies.txt
```

## 🔍 Troubleshooting

### Common Issues

**Server won't start:**
- Check if port 5000 is available
- Verify all required environment variables are set
- Ensure MongoDB connection string is correct

**PDF upload fails:**
- Verify file is actually a PDF
- Check file size is under the limit (20MB default)
- Ensure user hasn't exceeded document limit

**Database connection issues:**
- Verify MongoDB Atlas cluster is running
- Check IP whitelist in Atlas
- Confirm connection string format

**Authentication not working:**
- Ensure JWT_SECRET is set and sufficiently long
- Check CORS configuration matches your frontend URL
- Verify cookies are enabled in your client

### Logs and Debugging

The server provides detailed logging:
- Startup configuration and status
- API request logging (development mode)
- Error details with stack traces (development mode)
- Service status and next steps

## 📚 Next Steps

1. **Create Atlas Indexes**: Follow the setup instructions above
2. **Implement RAG Services**: Complete the stub services with actual API integrations
3. **Add LLM Integration**: Implement Claude streaming in the chat controller
4. **Testing**: Upload a PDF and test the complete pipeline
5. **Frontend Integration**: Connect your React/Vue/Angular frontend

## 🤝 Contributing

1. Follow ES Modules and async/await patterns
2. Use the existing error handling and validation patterns
3. Maintain data isolation (always filter by userId)
4. Add JSDoc comments for new functions
5. Update this README when adding new features

## 📄 License

ISC License - see LICENSE file for details.

---

**Built with ❤️ for technical teams working with complex manuals**