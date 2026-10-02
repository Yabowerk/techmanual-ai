import mongoose from 'mongoose';
import config from './env.js';

/**
 * Connect to MongoDB Atlas database
 * @returns {Promise<void>}
 */
export const connectDB = async () => {
  try {
    // Configure mongoose options (modern Mongoose 8+ options)
    const options = {
      // Connection pool
      maxPoolSize: 10,
      minPoolSize: 1,
    };

    const conn = await mongoose.connect(config.MONGODB_URI, options);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Set up connection event listeners
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('📴 MongoDB connection closed through app termination');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during MongoDB disconnection:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    
    // Exit process with failure
    process.exit(1);
  }
};

/**
 * Close database connection
 * @returns {Promise<void>}
 */
export const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('📴 MongoDB connection closed');
  } catch (error) {
    console.error('❌ Error closing MongoDB connection:', error);
    throw error;
  }
};