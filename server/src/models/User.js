import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function(email) {
          return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email);
        },
        message: 'Please enter a valid email address'
      }
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false // Never include in queries by default
    },
    name: {
      type: String,
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    }
  },
  {
    timestamps: true,
    toJSON: {
      // Remove sensitive fields from JSON output
      transform: function(doc, ret) {
        delete ret.passwordHash;
        return ret;
      }
    }
  }
);

// Index for faster email lookups during authentication
userSchema.index({ email: 1 });

// Virtual for user's document count (useful for enforcing limits)
userSchema.virtual('documentCount', {
  ref: 'Document',
  localField: '_id',
  foreignField: 'userId',
  count: true
});

// Method to check if user has reached document limit
userSchema.methods.hasReachedDocumentLimit = async function(maxDocs) {
  const count = await this.model('Document').countDocuments({ userId: this._id });
  return count >= maxDocs;
};

// Static method to find user by email (for authentication)
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() }).select('+passwordHash');
};

const User = mongoose.model('User', userSchema);

export default User;