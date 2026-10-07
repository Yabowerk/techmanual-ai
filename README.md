# TechManual AI

**Upload a technical manual, then ask it questions in plain English. Get answers with the exact page number.**

TechManual AI is a web app for people who work with big technical manuals, such as technicians and engineers. Instead of searching through hundreds of pages, you upload the PDF and chat with it. The app reads the manual, finds the right parts, and answers using only what the manual says. Every answer shows the page it came from, so you can check it yourself.

I built this project using **RAG (Retrieval-Augmented Generation)**. In simple words: the app first *finds* the most useful parts of your document, then asks an AI to *write* an answer using only those parts. This keeps the AI from making things up.

<img width="935" height="412" alt="manualweb" src="https://github.com/user-attachments/assets/e44d3b12-1739-4f14-9c27-52edd0916fc6" />


---

## Features

- **Secure accounts:** register and log in; every user sees only their own manuals
- **PDF upload:** drag and drop a manual (PDF, up to 20 MB)
- **Auto summary:** a short overview of what the manual is about
- **Chat with your document:** ask questions and get answers that stream in word by word
- **Page citations:** every answer shows clickable page numbers like `[page 87]`
- **PDF viewer:** click a citation and jump straight to that page of the original PDF
- **Honest answers:** if the manual does not contain the answer, the app says so instead of guessing
- **Hybrid search:** combines meaning-based search with exact keyword search, which works well for error codes and part numbers
- **Cost protection:** rate limits and a per-user upload limit

---

## How It Works

### 1. When you upload a manual

```
PDF upload -> read text page by page -> split into chunks -> create embeddings -> save in MongoDB
                                                                      |
                                                       AI writes a short summary
```

1. The server receives the PDF and saves the file.
2. The text is extracted page by page, so every piece keeps its page number.
3. The text is split into small **chunks** (one section or procedure at a time).
4. Each chunk is turned into an **embedding**, a list of numbers that represents its meaning.
5. Chunks and embeddings are stored in MongoDB, tagged with the user and the document.
6. The AI writes a short summary of the manual.

### 2. When you ask a question

```
Question -> embedding -> vector search + keyword search -> merge results -> rerank -> AI answer (streamed)
```

1. Your question is turned into an embedding.
2. **Vector search** finds chunks with a similar meaning.
3. **Keyword search** finds chunks with the exact words (like `E-42`).
4. The two result lists are merged using **Reciprocal Rank Fusion**.
5. A **reranker** picks the best few chunks.
6. The AI gets only those chunks and must answer from them, with page citations.
7. The answer streams to the browser using Server-Sent Events (SSE).

---

## Tech Stack

| Part | Technology |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, React Router, Context API |
| **PDF viewer** | react-pdf |
| **Backend** | Node.js, Express |
| **Database** | MongoDB Atlas (Vector Search and Atlas Search) |
| **Authentication** | JWT in an httpOnly cookie, bcrypt, zod validation |
| **Security** | helmet, cors, express-rate-limit |
| **File upload** | multer |
| **PDF parsing** | unpdf |
| **Embeddings** | OpenAI embeddings (or similar) |
| **Reranking** | Cohere Rerank |
| **AI answers** | Claude (Anthropic API), streamed |
| **Streaming** | Server-Sent Events (SSE) |

No RAG framework (like LangChain) is used. The retrieval logic is written by hand so every step is easy to follow.

---

## Project Structure

```
techmanual-ai/
  frontend/
    src/
      pages/        Auth.jsx  Dashboard.jsx  DocumentWorkspace.jsx
      components/   chat, PDF viewer, upload box, document list
      context/      AppContext.jsx
      hooks/        useAuth  useChat  useDocuments
      services/     api.js  authService.js  docService.js  chatService.js
  server/
    src/
      config/       environment variables and database connection
      models/       User  Document  Chunk  Chat
      middleware/   auth, validation, upload, rate limits, error handling
      routes/       auth  upload  docs  chat
      controllers/  thin handlers that call the services
      services/     parse  chunk  embed  ingest  retrieve  rerank  llm  storage
      utils/        prompts, SSE helpers, error helpers
    atlas-indexes/  vector-index.json  search-index.json
```

---

## API Routes

All routes start with `/api`.

| Method | Route | What it does |
|---|---|---|
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Log in (sets a secure cookie) |
| POST | `/api/auth/logout` | Log out |
| GET | `/api/auth/me` | Get the current user |
| POST | `/api/upload` | Upload a manual and start processing |
| GET | `/api/docs` | List my manuals |
| GET | `/api/docs/:id` | Get one manual (summary and status) |
| GET | `/api/docs/:id/file` | Stream the original PDF |
| DELETE | `/api/docs/:id` | Delete a manual and all its data |
| POST | `/api/chat/:docId` | Ask a question (streamed answer) |
| GET | `/api/chat/:docId` | Get saved chat history |

---

## Getting Started

### What you need

- Node.js 20 or newer
- A free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
- API keys for the embeddings, reranking, and AI services you use

### 1. Clone and install

```bash
git clone <your-repo-url>
cd techmanual-ai

cd server && npm install
cd ../frontend && npm install
```

### 2. Set environment variables

**`server/.env`**

| Variable | Description |
|---|---|
| `PORT` | Server port (for example 5000) |
| `NODE_ENV` | `development` or `production` |
| `CLIENT_URL` | Frontend URL, with no trailing slash |
| `MONGODB_URI` | Atlas connection string (include the database name) |
| `JWT_SECRET` | A long random secret |
| `ANTHROPIC_API_KEY` | For AI answers and summaries |
| `OPENAI_API_KEY` | For embeddings |
| `COHERE_API_KEY` | For reranking |
| `EMBEDDING_DIMENSIONS` | Must match your embedding model and your vector index |

**`frontend/.env`**

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend URL, including `/api` (for example `http://localhost:5000/api`) |

### 3. Create the two Atlas indexes

Search will not work until both indexes exist. In the Atlas UI, open **Search & Vector Search**, create each index on the `chunks` collection, and paste **only the contents** of the JSON file (no `name` or `definition` wrapper).

| Index | Type | Name | File |
|---|---|---|---|
| Vector | Vector Search | `chunk_vector_index` | `server/atlas-indexes/vector-index.json` |
| Keyword | Atlas Search | `chunk_text_index` | `server/atlas-indexes/search-index.json` |

The `numDimensions` value in the vector index must match your embedding model (for example 1536 for OpenAI `text-embedding-3-small`). Wait until both show **Active**.

### 4. Run the app

```bash
# Terminal 1: backend
cd server
npm run dev

# Terminal 2: frontend
cd frontend
npm run dev
```

Open the frontend URL (usually `http://localhost:5173`), register an account, and upload a manual.

---

## Deployment Notes

- **Cross-domain cookies:** if the frontend and backend are on different domains, the login cookie needs `secure: true` and `sameSite: "none"`. Behind a proxy such as Render, also use `app.set("trust proxy", 1)`.
- **Credentials:** every frontend request must send cookies (`withCredentials: true` in Axios).
- **Frontend build variables:** Vite reads `VITE_` variables at build time, so redeploy the frontend after changing them.
- **File storage:** hosts like Render have a temporary disk that is wiped on restart. Store uploaded PDFs in cloud storage (Cloudinary, Supabase Storage, or S3) so the PDF viewer keeps working.
- **Page refresh on the frontend:** add a rewrite rule so every route serves `index.html`.

---

## What I Learned

- How a RAG pipeline works from end to end: parsing, chunking, embeddings, retrieval, reranking, and grounded generation
- Why hybrid search (vector plus keyword) beats vector search alone for codes and part numbers
- Streaming AI responses to the browser with Server-Sent Events
- Securing user data: JWT in httpOnly cookies, rate limiting, and filtering every query by user
- Deploying a full-stack app, including cookies, CORS, and file storage problems

---
