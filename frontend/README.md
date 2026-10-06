# TechManual AI - Frontend

React + Tailwind CSS frontend for the TechManual AI RAG-powered technical manual chatbot.

## Features

- 🔐 **Authentication** - User login and registration
- 📄 **PDF Management** - Upload, manage, and browse technical manuals
- 🤖 **AI Chat** - Chat with documents using SSE streaming for real-time responses
- 📖 **PDF Viewer** - Interactive PDF viewer with page navigation and zoom controls
- 💬 **Chat History** - Persistent conversation history with page references
- 🎨 **Dark Theme** - Beautiful dark UI with Tailwind CSS

## Tech Stack

- **React 19** - UI framework
- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first CSS framework
- **Axios** - HTTP client
- **react-pdf** - PDF viewer component
- **react-icons** - Icon library

## Setup

### Prerequisites

- Node.js 16+ and npm
- Backend API running on `http://localhost:5000`

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file (or copy from `.env.example`):
```bash
cp .env.example .env
```

3. Update API URL in `.env` if needed:
```
VITE_API_URL=http://localhost:5000/api
```

### Development

Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Build

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Project Structure

```
src/
├── pages/              # Page components
│   ├── Auth.jsx       # Login/Register
│   ├── Dashboard.jsx  # Manual list and upload
│   └── DocumentWorkspace.jsx  # PDF viewer and chat
├── components/        # Reusable components
├── services/         # API services
│   ├── api.js       # Axios client
│   ├── authService.js
│   ├── docService.js
│   └── chatService.js # SSE streaming
├── hooks/            # Custom React hooks
│   ├── useAuth.js
│   ├── useChat.js
│   ├── useDocuments.js
│   └── usePDF.js
├── context/          # React Context
│   └── AppContext.jsx # Global state
├── utils/            # Helper functions
└── styles/           # CSS (Tailwind + custom)
```

## API Integration

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Documents
- `GET /api/docs` - List all documents
- `GET /api/docs/:id` - Get document details
- `GET /api/docs/:id/file` - Download PDF file
- `POST /api/upload` - Upload PDF
- `DELETE /api/docs/:id` - Delete document

### Chat
- `POST /api/chat/:docId` - Send message (SSE streaming)
- `GET /api/chat/:docId` - Get chat history
- `DELETE /api/chat/:docId` - Clear chat

## Error Handling

All errors are displayed as inline notifications at the top of the page. Errors auto-dismiss after 5 seconds.

Common errors:
- **401 Unauthorized** - Session expired, redirects to login
- **File validation** - PDF format and 20MB size limit enforced
- **Upload timeout** - 5-minute timeout for upload operations

## Keyboard Shortcuts

- **Arrow Left/Right** - Navigate PDF pages
- **Ctrl/Cmd + S** - Save chat (if implemented)

## Browser Support

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance

- Lazy PDF loading
- Debounced page navigation
- Cached chat history
- Optimized re-renders with React Context

## Future Enhancements

- [ ] Drag-and-drop file upload
- [ ] Multiple document chat
- [ ] Chat export/download
- [ ] Advanced search
- [ ] Document annotations
- [ ] Mobile app

## Troubleshooting

### API Connection Issues
- Verify backend is running on `http://localhost:5000`
- Check `.env` has correct `VITE_API_URL`
- Check browser console for CORS errors

### PDF Won't Load
- Ensure PDF file is valid and not corrupted
- Check file size (max 20MB)
- Try refreshing the page

### Chat Not Responding
- Check internet connection
- Verify backend API is working
- Look for errors in browser console

## Development Tips

- Use React DevTools for debugging state
- Check Network tab to monitor API calls
- Use Console for error messages
- Enable Tailwind IntelliSense in VS Code

## License

MIT
