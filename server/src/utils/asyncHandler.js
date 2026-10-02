/**
 * Higher-order function to wrap async controllers and catch errors
 * Eliminates the need for try-catch blocks in every controller
 * 
 * @param {Function} fn - Async controller function
 * @returns {Function} - Express middleware function
 */
const asyncHandler = (fn) => (req, res, next) => {
  // Execute the async function and catch any errors
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;