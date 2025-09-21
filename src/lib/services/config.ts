import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

interface Config {
  neo4j: {
    uri: string;
    user: string;
    password: string;
  };
  anthropic: {
    apiKey: string;
  };
  app: {
    nodeEnv: string;
    port: number;
  };
}

/**
 * Validates that all required environment variables are present
 * @throws {Error} If any required environment variables are missing
 */
function validateEnvironment(): void {
  const requiredVars = [
    'NEO4J_URI',
    'NEO4J_USER',
    'NEO4J_PASSWORD',
    'ANTHROPIC_API_KEY'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}\n` +
      'Please check your .env.local file and ensure all required variables are set.'
    );
  }
}

/**
 * Gets the application configuration from environment variables
 * @returns {Config} The application configuration object
 * @throws {Error} If required environment variables are missing
 */
export function getConfig(): Config {
  validateEnvironment();

  return {
    neo4j: {
      uri: process.env.NEO4J_URI!,
      user: process.env.NEO4J_USER!,
      password: process.env.NEO4J_PASSWORD!,
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY!,
    },
    app: {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: parseInt(process.env.PORT || '3000', 10),
    },
  };
}

/**
 * Gets a specific environment variable with optional default value
 * @param {string} key - The environment variable key
 * @param {string} defaultValue - Optional default value if the key is not found
 * @returns {string} The environment variable value or default
 */
export function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is not defined`);
  }
  return value;
}