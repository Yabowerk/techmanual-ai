import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Define the schema for environment variables
const envSchema = z.object({
  PORT: z.string().default('5000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_URL: z.string().url(),
  
  // Database
  MONGODB_URI: z.string().min(1, 'MongoDB URI is required'),
  
  // Authentication
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  
  // AI Service API Keys
  OPENAI_API_KEY: z.string().optional(),
  //ANTHROPIC_API_KEY: z.string().min(1, 'Anthropic API key is required'),
  COHERE_API_KEY: z.string().min(1, 'Cohere API key is required'),
  VOYAGE_API_KEY: z.string().min(1, 'Voyage API key is required'),
  
  // AI Model Configuration
  CLAUDE_MODEL: z.string().default('claude-3-5-sonnet-20241022'),
  EMBEDDING_PROVIDER: z.enum(['voyage', 'openai']).default('voyage'),
  VOYAGE_MODEL: z.string().default('voyage-3'),
  VOYAGE_DIMENSIONS: z.string().default('1024').transform(Number),
  // Legacy OpenAI config (if switching back)
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  OPENAI_EMBEDDING_DIMENSIONS: z.string().default('1536').transform(Number),
  
  // File Upload Limits
  MAX_UPLOAD_MB: z.string().default('20').transform(Number),
  MAX_DOCS_PER_USER: z.string().default('5').transform(Number),
  
  // Rate Limiting
  MAX_QUESTIONS_PER_DAY: z.string().default('50').transform(Number),
  
  // Atlas Index Names
  VECTOR_INDEX_NAME: z.string().default('chunk_vector_index'),
  SEARCH_INDEX_NAME: z.string().default('chunk_text_index'),
});

// Validate environment variables
let config;

try {
  config = envSchema.parse(process.env);
} catch (error) {
  console.error('❌ Invalid environment configuration:');
  
  if (error instanceof z.ZodError) {
    error.errors.forEach((err) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
  } else {
    console.error(error.message);
  }
  
  console.error('\n💡 Please check your .env file and ensure all required variables are set.');
  console.error('📝 Refer to .env.example for the complete list of required variables.\n');
  
  process.exit(1);
}

// Freeze the config object to prevent modifications
export default Object.freeze(config);