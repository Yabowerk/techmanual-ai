import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true // Index for fast user-based queries
    },
    title: {
      type: String,
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    originalFilename: {
      type: String,
      required: [true, 'Original filename is required'],
      trim: true
    },
    fileKey: {
      type: String,
      required: [true, 'File key is required'],
      trim: true,
      unique: true // Ensure each file has a unique storage key
    },
    pageCount: {
      type: Number,
      min: [1, 'Page count must be at least 1']
    },
    summary: {
      type: String,
      default: '',
      maxlength: [2000, 'Summary cannot exceed 2000 characters']
    },
    status: {
      type: String,
      enum: {
        values: ['uploaded', 'processing', 'ready', 'failed'],
        message: 'Status must be one of: uploaded, processing, ready, failed'
      },
      default: 'uploaded',
      index: true // Index for filtering by status
    },
    errorMessage: {
      type: String,
      maxlength: [1000, 'Error message cannot exceed 1000 characters']
    }
  },
  {
    timestamps: true,
    toJSON: {
      // Include virtual fields and format output
      virtuals: true,
      transform: function(doc, ret) {
        // Don't expose internal fileKey in API responses
        delete ret.fileKey;
        return ret;
      }
    }
  }
);

// Compound indexes for efficient queries
documentSchema.index({ userId: 1, status: 1 });
documentSchema.index({ userId: 1, createdAt: -1 });

// Virtual for chunk count (useful for monitoring ingestion progress)
documentSchema.virtual('chunkCount', {
  ref: 'Chunk',
  localField: '_id',
  foreignField: 'documentId',
  count: true
});

// Virtual for chat count (useful for usage analytics)
documentSchema.virtual('chatCount', {
  ref: 'Chat',
  localField: '_id',
  foreignField: 'documentId',
  count: true
});

// Method to check if document is ready for chat
documentSchema.methods.isReady = function() {
  return this.status === 'ready';
};

// Method to mark document as failed with error message
documentSchema.methods.markAsFailed = function(errorMessage) {
  this.status = 'failed';
  this.errorMessage = errorMessage;
  return this.save();
};

// Method to mark document as ready with summary
documentSchema.methods.markAsReady = function(summary = '') {
  this.status = 'ready';
  this.summary = summary;
  this.errorMessage = undefined; // Clear any previous error
  return this.save();
};

// Static method to find user's documents
documentSchema.statics.findByUser = function(userId, options = {}) {
  const query = this.find({ userId });
  
  if (options.status) {
    query.where('status', options.status);
  }
  
  return query.sort({ createdAt: -1 });
};

// Pre-save middleware to set title from filename if not provided
documentSchema.pre('save', function(next) {
  if (!this.title && this.originalFilename) {
    // Remove file extension and clean up the filename for title
    this.title = this.originalFilename
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/[_-]/g, ' ')    // Replace underscores and hyphens with spaces
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim();
  }
  next();
});

const Document = mongoose.model('Document', documentSchema);

export default Document;