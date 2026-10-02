import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import config from '../config/env.js';

/**
 * Register a new user
 * POST /api/auth/register
 * Body: { email, password, name? }
 */
export const register = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw ApiError.conflict('Email address is already registered');
  }

  // Hash password with cost factor 12
  const passwordHash = await bcrypt.hash(password, 12);

  // Create user (name is optional as per requirements)
  const userData = {
    email,
    passwordHash
  };

  if (name) {
    userData.name = name;
  }

  const user = new User(userData);
  await user.save();

  // Generate JWT token
  const token = jwt.sign(
    { id: user._id },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );

  // Set cookie with security flags
  const cookieOptions = {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax', // Use 'none' + secure only if frontend and backend on different domains
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
  };

  res.cookie('token', token, cookieOptions);

  // Return user without sensitive data
  res.status(201).json({
    message: 'User registered successfully',
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt
    }
  });
});

/**
 * Login existing user
 * POST /api/auth/login
 * Body: { email, password }
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user and include password hash for verification
  const user = await User.findByEmail(email);
  
  // Generic error message for security (don't reveal if email exists)
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  
  if (!isPasswordValid) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  // Generate JWT token
  const token = jwt.sign(
    { id: user._id },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );

  // Set cookie with security flags
  const cookieOptions = {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax', // Use 'none' + secure only if frontend and backend on different domains
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
  };

  res.cookie('token', token, cookieOptions);

  // Return user without sensitive data
  res.json({
    message: 'Login successful',
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt
    }
  });
});

/**
 * Logout user
 * POST /api/auth/logout
 */
export const logout = asyncHandler(async (req, res) => {
  // Clear the authentication cookie
  res.clearCookie('token', {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax'
  });

  res.json({
    message: 'Logout successful'
  });
});

/**
 * Get current user profile
 * GET /api/auth/me
 * Requires authentication
 */
export const getMe = asyncHandler(async (req, res) => {
  // Get user ID from middleware (req.user is set by requireAuth middleware)
  const userId = req.user.id;

  // Fetch user data (password hash is excluded by default)
  const user = await User.findById(userId);

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  // Return user profile
  res.json({
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }
  });
});

/**
 * Refresh authentication token
 * POST /api/auth/refresh
 * Requires authentication
 */
export const refreshToken = asyncHandler(async (req, res) => {
  // Get user ID from current token (set by requireAuth middleware)
  const userId = req.user.id;

  // Verify user still exists
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.unauthorized('User not found');
  }

  // Generate new JWT token
  const token = jwt.sign(
    { id: user._id },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );

  // Set new cookie
  const cookieOptions = {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
  };

  res.cookie('token', token, cookieOptions);

  res.json({
    message: 'Token refreshed successfully'
  });
});