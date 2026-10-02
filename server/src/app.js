import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import config from './config/env.js';
import apiRoutes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimiters.js';

/**
 * Create and configure Express application
 * @returns {express.Application} Configured Express app
 */
const createApp = () => {
  const app = express();

  // Trust proxy if behind a reverse proxy (for rate limiting and IP detection)
  app.set('trust proxy', 1);

  // Security middleware - helmet for security headers
  app.use(helmet({
    // Configure Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    // Allow cross-origin requests for API
    crossOriginEmbedderPolicy: false,
  }));

  // CORS configuration
  app.use(cors({
    origin: config.CLIENT_URL,
    credentials: true, // Allow cookies to be sent
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With', 
      'Content-Type', 
      'Accept',
      'Authorization',
      'Cache-Control'
    ],
    exposedHeaders: ['Set-Cookie'],
    maxAge: 86400, // 24 hours
  }));

  // Body parsing middleware
  app.use(express.json({ 
    limit: '10mb',
    strict: true
  }));
  
  app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb',
    parameterLimit: 50
  }));

  // Cookie parsing middleware
  app.use(cookieParser());

  // General rate limiting for all requests
  app.use(generalLimiter);

  // Request logging middleware (development only)
  if (config.NODE_ENV === 'development') {
    app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - ${req.ip}`);
      next();
    });
  }

  // Health check endpoint (before API routes for faster response)
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Mount API routes under /api prefix
  app.use('/api', apiRoutes);

  // Root endpoint redirect
  app.get('/', (req, res) => {
    res.json({
      message: 'TechManual AI API Server',
      status: 'running',
      version: '1.0.0',
      documentation: '/api',
      health: '/health'
    });
  });

  // Favicon handler (prevents 404s)
  app.get('/favicon.ico', (req, res) => {
    res.status(204).end();
  });

  // Robots.txt (prevent crawling)
  app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send('User-agent: *\nDisallow: /');
  });

  // 404 handler for undefined routes
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
};

// Export the app factory function
export default createApp;