import pino from 'pino';

/**
 * Creates a configured pino logger instance
 * Uses pino-pretty in development for readable output
 * Uses structured JSON logging in production
 *
 * @param {string} name - Logger name/component identifier
 * @returns {pino.Logger} Configured pino logger
 */
export function createLogger(name: string): pino.Logger {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const loggerConfig: pino.LoggerOptions = {
    name,
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  };

  // In development, use pino-pretty for readable console output
  if (isDevelopment) {
    loggerConfig.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
        messageFormat: '[{name}] {msg}',
        levelFirst: true,
      }
    };
  }

  return pino(loggerConfig);
}

/**
 * Default logger instance for general application use
 */
export const logger = createLogger('app');

/**
 * Specialized logger instances for different components
 */
export const loggers = {
  database: createLogger('database'),
  orchestrator: createLogger('orchestrator'),
  eventDetector: createLogger('event-detector'),
  novelReader: createLogger('novel-reader'),
  fileParser: createLogger('file-parser'),
  api: createLogger('api'),
} as const;