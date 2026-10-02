/**
 * Custom error class for API errors
 * Extends the built-in Error class with additional properties
 */
class ApiError extends Error {
  /**
   * Create an API error
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Error message
   * @param {boolean} isOperational - Whether error is operational (vs programming error)
   * @param {string} stack - Error stack trace
   */
  constructor(statusCode, message, isOperational = true, stack = '') {
    super(message);
    
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Create a 400 Bad Request error
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static badRequest(message = 'Bad Request') {
    return new ApiError(400, message);
  }

  /**
   * Create a 401 Unauthorized error
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }

  /**
   * Create a 403 Forbidden error
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }

  /**
   * Create a 404 Not Found error
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  /**
   * Create a 409 Conflict error
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static conflict(message = 'Conflict') {
    return new ApiError(409, message);
  }

  /**
   * Create a 413 Payload Too Large error
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static payloadTooLarge(message = 'Payload too large') {
    return new ApiError(413, message);
  }

  /**
   * Create a 422 Unprocessable Entity error
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static unprocessableEntity(message = 'Unprocessable Entity') {
    return new ApiError(422, message);
  }

  /**
   * Create a 429 Too Many Requests error
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static tooManyRequests(message = 'Too many requests') {
    return new ApiError(429, message);
  }

  /**
   * Create a 500 Internal Server Error
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static internal(message = 'Internal server error') {
    return new ApiError(500, message);
  }
}

export default ApiError;