/**
 * Server-Sent Events (SSE) utility functions
 * Provides helpers for streaming real-time data to the client
 */

/**
 * Set up SSE headers for streaming response
 * @param {Response} res - Express response object
 */
export const setupSSE = (res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
  
  // Send initial connection confirmation
  res.write('data: {"type":"connected"}\n\n');
};

/**
 * Send an SSE event to the client
 * @param {Response} res - Express response object
 * @param {string} event - Event name (optional)
 * @param {Object|string} data - Data to send
 * @param {string} id - Event ID (optional)
 */
export const sendSSEEvent = (res, event = null, data = null, id = null) => {
  let message = '';
  
  if (id) {
    message += `id: ${id}\n`;
  }
  
  if (event) {
    message += `event: ${event}\n`;
  }
  
  if (data) {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    message += `data: ${dataString}\n`;
  }
  
  message += '\n';
  
  res.write(message);
};

/**
 * Send a token (for streaming chat responses)
 * @param {Response} res - Express response object
 * @param {string} token - Text token to send
 */
export const sendToken = (res, token) => {
  sendSSEEvent(res, 'token', { token });
};

/**
 * Send an error event
 * @param {Response} res - Express response object
 * @param {string} message - Error message
 */
export const sendError = (res, message) => {
  sendSSEEvent(res, 'error', { error: message });
};

/**
 * Send completion event and close the stream
 * @param {Response} res - Express response object
 * @param {Object} summary - Final response summary (optional)
 */
export const sendComplete = (res, summary = null) => {
  if (summary) {
    sendSSEEvent(res, 'complete', summary);
  } else {
    sendSSEEvent(res, 'complete', { status: 'done' });
  }
  
  res.end();
};

/**
 * Send a progress update
 * @param {Response} res - Express response object
 * @param {string} stage - Current processing stage
 * @param {string} message - Progress message
 */
export const sendProgress = (res, stage, message) => {
  sendSSEEvent(res, 'progress', { stage, message });
};

/**
 * Handle client disconnect gracefully
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} cleanup - Cleanup function to call on disconnect
 */
export const handleSSEDisconnect = (req, res, cleanup = null) => {
  // Handle client disconnect
  req.on('close', () => {
    console.log('SSE client disconnected');
    if (cleanup && typeof cleanup === 'function') {
      cleanup();
    }
  });
  
  // Handle connection error
  res.on('error', (err) => {
    console.error('SSE connection error:', err);
    if (cleanup && typeof cleanup === 'function') {
      cleanup();
    }
  });
};