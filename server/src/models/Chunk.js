import mongoose from 'mongoose';
import config from '../config/env.js';

// Get embedding dimensions from config
const getEmbeddingDimensions = () => {
  if (config.EMBEDDING_PROVIDER === 'voyage') {
    return config.VOYAGE_DIMENSIONS;
  } else {
    return config.OPENAI_EMBEDDING_DIMENSIONS;
  }
};

const chunkSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true // Index for data isolation queries
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: [true, 'Document ID is required'],
      index: true // Index for document-based queries
    },
    text: {
      type: String,
      required: [true, 'Chunk text is required'],
      maxlength: [5000, 'Chunk text cannot exceed 5000 characters']
    },
    page: {
      type: Number,
      required: [true, 'Page number is required'],
      min: [1, 'Page number must be at least 1']
    },
    section: {
      type: String,
      default: '',
      trim: true,
      maxlength: [200, 'Section name cannot exceed 200 characters']
    },
    chunkIndex: {
      type: Number,
      required: [true, 'Chunk index is required'],
      min: [0, 'Chunk index must be non-negative']
    },
    embedding: {
      type: [Number],
      required: [true, 'Embedding vector is required'],
      validate: {
        validator: function(arr) {
          const expectedDimensions = getEmbeddingDimensions();
          return arr.length === expectedDimensions;
        },
        message: function() {
          const expectedDimensions = getEmbeddingDimensions();
          const provider = config.EMBEDDING_PROVIDER;
          return `Embedding must have exactly ${expectedDimensions} dimensions for ${provider} provider`;
        }
      },
      select: false // Never include embeddings in normal queries (too large)
    }
  },
  {
    timestamps: true,
    toJSON: {
      // Remove embedding from JSON output (too large for API responses)
      transform: function(doc, ret) {
        delete ret.embedding;
        return ret;
      }
    }
  }
);

// Compound indexes for efficient queries
chunkSchema.index({ userId: 1, documentId: 1 });
chunkSchema.index({ documentId: 1, page: 1, chunkIndex: 1 });
chunkSchema.index({ userId: 1, documentId: 1, page: 1 });

// Atlas Vector Search index will be created separately for the embedding field
// This is defined in atlas-indexes/vector-index.json

// Atlas Search (keyword) index will be created separately for the text field
// This is defined in atlas-indexes/search-index.json

// Method to get chunk with embedding (when needed for similarity search)
chunkSchema.methods.getWithEmbedding = function() {
  return this.model('Chunk').findById(this._id).select('+embedding');
};

// Static method to find chunks by document with text search capability
chunkSchema.statics.findByDocument = function(userId, documentId, options = {}) {
  const query = this.find({ 
    userId,
    documentId 
  });
  
  if (options.page) {
    query.where('page', options.page);
  }
  
  if (options.includeEmbedding) {
    query.select('+embedding');
  }
  
  return query.sort({ page: 1, chunkIndex: 1 });
};

// Static method to get chunks for a specific page range
chunkSchema.statics.findByPageRange = function(userId, documentId, startPage, endPage) {
  return this.find({
    userId,
    documentId,
    page: { $gte: startPage, $lte: endPage }
  }).sort({ page: 1, chunkIndex: 1 });
};

// Method to get chunk context (surrounding chunks for better context)
chunkSchema.methods.getContext = function(contextSize = 1) {
  const startIndex = Math.max(0, this.chunkIndex - contextSize);
  const endIndex = this.chunkIndex + contextSize;
  
  return this.model('Chunk').find({
    userId: this.userId,
    documentId: this.documentId,
    page: this.page,
    chunkIndex: { $gte: startIndex, $lte: endIndex }
  }).sort({ chunkIndex: 1 });
};

// Virtual for chunk position within document
chunkSchema.virtual('position').get(function() {
  return `Page ${this.page}, Chunk ${this.chunkIndex}`;
});

// Virtual for section display (fallback to page if no section)
chunkSchema.virtual('sectionDisplay').get(function() {
  return this.section || `Page ${this.page}`;
});

const Chunk = mongoose.model('Chunk', chunkSchema);

export default Chunk;