# Module Development Template

## Overview
This template provides a standardized structure for implementing modules across all phases of the Novel Event Timeline Analysis System. Following this template ensures consistency, maintainability, and adherence to project standards.

## Module Structure Template

### 1. File Header and Imports
```typescript
/**
 * @fileoverview [Brief description of module purpose]
 * @module [ModuleName]
 * @version 1.0.0
 * @author Novel Timeline Analysis System
 * @created [Date]
 * @updated [Date]
 */

// External dependencies
import { /* external imports */ } from 'external-package';

// Internal dependencies
import { /* internal types */ } from '../types';
import { /* internal utilities */ } from '../utils';
import { logger } from '../utils/logger';
import { /* other internal imports */ } from '../services';

// Type-only imports
import type { /* type imports */ } from '../types';
```

### 2. Type Definitions
```typescript
/**
 * Configuration interface for [ModuleName]
 */
export interface [ModuleName]Config {
  // Configuration properties with JSDoc comments
  maxRetries: number;
  timeout: number;
  enableFeature: boolean;
}

/**
 * Input interface for [ModuleName] operations
 */
export interface [ModuleName]Input {
  // Input properties with validation requirements
  data: string;
  options?: [ModuleName]Options;
}

/**
 * Result interface for [ModuleName] operations
 */
export interface [ModuleName]Result {
  success: boolean;
  data?: any;
  error?: string;
  metadata: {
    processingTime: number;
    timestamp: Date;
  };
}

/**
 * Options interface for fine-tuning behavior
 */
export interface [ModuleName]Options {
  verbose?: boolean;
  enableCaching?: boolean;
}
```

### 3. Constants and Configuration
```typescript
/**
 * Default configuration values
 */
const DEFAULT_CONFIG: [ModuleName]Config = {
  maxRetries: 3,
  timeout: 30000,
  enableFeature: true,
};

/**
 * Error messages used throughout the module
 */
const ERROR_MESSAGES = {
  INVALID_INPUT: 'Invalid input provided',
  PROCESSING_FAILED: 'Processing operation failed',
  TIMEOUT_EXCEEDED: 'Operation timed out',
} as const;

/**
 * Constants for business logic
 */
const PROCESSING_LIMITS = {
  MAX_BATCH_SIZE: 100,
  MIN_CONFIDENCE: 0.5,
  DEFAULT_CHUNK_SIZE: 1000,
} as const;
```

### 4. Main Class Implementation
```typescript
/**
 * [ModuleName] - [Brief description of class purpose]
 * 
 * This class handles [specific functionality] and provides
 * [key capabilities]. It follows the [pattern name] pattern
 * for [reason].
 * 
 * @example
 * ```typescript
 * const module = new [ModuleName](config);
 * const result = await module.process(input);
 * ```
 */
export class [ModuleName] {
  private config: [ModuleName]Config;
  private cache: Map<string, any>;
  private isInitialized: boolean;

  /**
   * Creates an instance of [ModuleName]
   * @param config - Configuration options
   * @param dependencies - Injected dependencies
   */
  constructor(
    config: Partial<[ModuleName]Config> = {},
    private dependencies: {
      logger: Logger;
      // other dependencies
    }
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
    this.isInitialized = false;
    
    this.validateConfig();
  }

  /**
   * Initialize the module with required setup
   * @throws {ConfigurationError} When configuration is invalid
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing [ModuleName]', { config: this.config });
      
      // Initialization logic here
      await this.setupResources();
      await this.validateDependencies();
      
      this.isInitialized = true;
      logger.info('[ModuleName] initialized successfully');
    } catch (error) {
      logger.error('[ModuleName] initialization failed', { error: error.message });
      throw new ConfigurationError(`Failed to initialize [ModuleName]: ${error.message}`);
    }
  }

  /**
   * Main processing method for the module
   * @param input - Input data to process
   * @param options - Optional processing options
   * @returns Promise resolving to processing result
   */
  async process(
    input: [ModuleName]Input,
    options: [ModuleName]Options = {}
  ): Promise<[ModuleName]Result> {
    const startTime = Date.now();
    
    try {
      // Pre-processing validation
      this.validateInput(input);
      this.ensureInitialized();
      
      logger.debug('[ModuleName] processing started', { 
        inputSize: JSON.stringify(input).length,
        options 
      });

      // Main processing logic
      const result = await this.executeProcessing(input, options);
      
      // Post-processing
      const finalResult = await this.postProcess(result, options);
      
      const processingTime = Date.now() - startTime;
      logger.info('[ModuleName] processing completed', { 
        processingTime,
        success: finalResult.success 
      });

      return {
        ...finalResult,
        metadata: {
          processingTime,
          timestamp: new Date(),
        },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('[ModuleName] processing failed', { 
        error: error.message,
        processingTime,
        input: this.sanitizeInputForLogging(input)
      });

      return {
        success: false,
        error: error.message,
        metadata: {
          processingTime,
          timestamp: new Date(),
        },
      };
    }
  }

  /**
   * Execute the core processing logic
   * @private
   */
  private async executeProcessing(
    input: [ModuleName]Input,
    options: [ModuleName]Options
  ): Promise<Partial<[ModuleName]Result>> {
    // Check cache first
    const cacheKey = this.generateCacheKey(input, options);
    if (options.enableCaching && this.cache.has(cacheKey)) {
      logger.debug('Returning cached result');
      return this.cache.get(cacheKey);
    }

    // Core business logic implementation
    const result = await this.performCoreLogic(input, options);
    
    // Cache the result if caching is enabled
    if (options.enableCaching) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Perform the core business logic
   * @private
   */
  private async performCoreLogic(
    input: [ModuleName]Input,
    options: [ModuleName]Options
  ): Promise<Partial<[ModuleName]Result>> {
    // Implementation specific to the module
    // This is where the main business logic goes
    
    // Example implementation:
    const processedData = await this.transformData(input.data);
    const validatedData = this.validateOutput(processedData);
    
    return {
      success: true,
      data: validatedData,
    };
  }

  /**
   * Post-process the results
   * @private
   */
  private async postProcess(
    result: Partial<[ModuleName]Result>,
    options: [ModuleName]Options
  ): Promise<[ModuleName]Result> {
    // Add any post-processing logic here
    // e.g., formatting, additional validation, metrics collection
    
    return result as [ModuleName]Result;
  }

  /**
   * Validate input data
   * @private
   */
  private validateInput(input: [ModuleName]Input): void {
    if (!input || typeof input !== 'object') {
      throw new ValidationError(ERROR_MESSAGES.INVALID_INPUT);
    }

    if (!input.data || typeof input.data !== 'string') {
      throw new ValidationError('Input data must be a non-empty string');
    }

    // Additional validation logic specific to the module
  }

  /**
   * Validate configuration
   * @private
   */
  private validateConfig(): void {
    if (this.config.maxRetries < 0) {
      throw new ConfigurationError('maxRetries must be non-negative');
    }

    if (this.config.timeout <= 0) {
      throw new ConfigurationError('timeout must be positive');
    }

    // Additional configuration validation
  }

  /**
   * Ensure module is initialized before processing
   * @private
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('[ModuleName] must be initialized before use');
    }
  }

  /**
   * Generate cache key for result caching
   * @private
   */
  private generateCacheKey(
    input: [ModuleName]Input,
    options: [ModuleName]Options
  ): string {
    return `${JSON.stringify(input)}_${JSON.stringify(options)}`;
  }

  /**
   * Sanitize input for safe logging (remove sensitive data)
   * @private
   */
  private sanitizeInputForLogging(input: [ModuleName]Input): any {
    // Remove or mask sensitive information before logging
    return {
      ...input,
      data: input.data ? `[${input.data.length} characters]` : 'null',
    };
  }

  /**
   * Setup required resources
   * @private
   */
  private async setupResources(): Promise<void> {
    // Initialize any required resources
    // e.g., database connections, external services, etc.
  }

  /**
   * Validate that all dependencies are available
   * @private
   */
  private async validateDependencies(): Promise<void> {
    if (!this.dependencies.logger) {
      throw new Error('Logger dependency is required');
    }
    
    // Validate other dependencies
  }

  /**
   * Transform input data (example helper method)
   * @private
   */
  private async transformData(data: string): Promise<any> {
    // Implementation specific to module needs
    return data.trim().toLowerCase();
  }

  /**
   * Validate output data
   * @private
   */
  private validateOutput(data: any): any {
    // Validate that output meets expected format
    if (!data) {
      throw new Error('Output validation failed: no data generated');
    }
    
    return data;
  }

  /**
   * Cleanup resources when module is no longer needed
   */
  async cleanup(): Promise<void> {
    try {
      logger.info('[ModuleName] cleanup started');
      
      // Clear cache
      this.cache.clear();
      
      // Close connections, release resources, etc.
      await this.releaseResources();
      
      this.isInitialized = false;
      logger.info('[ModuleName] cleanup completed');
    } catch (error) {
      logger.error('[ModuleName] cleanup failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Release allocated resources
   * @private
   */
  private async releaseResources(): Promise<void> {
    // Release any allocated resources
  }

  /**
   * Get current module statistics
   */
  getStats(): {
    cacheSize: number;
    isInitialized: boolean;
    config: [ModuleName]Config;
  } {
    return {
      cacheSize: this.cache.size,
      isInitialized: this.isInitialized,
      config: { ...this.config },
    };
  }
}
```

### 5. Helper Functions and Utilities
```typescript
/**
 * Helper function for [specific purpose]
 * @param param - Description of parameter
 * @returns Description of return value
 */
export function helperFunction(param: string): string {
  // Implementation
  return param.toUpperCase();
}

/**
 * Utility function for [specific purpose]
 * @param data - Input data
 * @param options - Processing options
 * @returns Processed result
 */
export async function utilityFunction(
  data: any,
  options: { timeout?: number } = {}
): Promise<any> {
  // Implementation with proper error handling
  try {
    // Processing logic
    return processedData;
  } catch (error) {
    logger.error('Utility function failed', { error: error.message });
    throw error;
  }
}
```

### 6. Error Classes
```typescript
/**
 * Custom error class for [ModuleName] specific errors
 */
export class [ModuleName]Error extends BaseError {
  constructor(message: string, public operation: string) {
    super(message, '[MODULE_NAME]_ERROR', 500);
    this.name = '[ModuleName]Error';
  }
}

/**
 * Validation error for input validation failures
 */
export class ValidationError extends [ModuleName]Error {
  constructor(message: string) {
    super(message, 'validation');
    this.name = 'ValidationError';
  }
}

/**
 * Configuration error for setup failures
 */
export class ConfigurationError extends [ModuleName]Error {
  constructor(message: string) {
    super(message, 'configuration');
    this.name = 'ConfigurationError';
  }
}
```

### 7. Factory Function (Optional)
```typescript
/**
 * Factory function to create configured [ModuleName] instances
 * @param config - Configuration options
 * @param dependencies - Required dependencies
 * @returns Configured module instance
 */
export function create[ModuleName](
  config: Partial<[ModuleName]Config> = {},
  dependencies?: any
): [ModuleName] {
  const defaultDependencies = {
    logger: logger,
    // other default dependencies
  };

  return new [ModuleName](config, { ...defaultDependencies, ...dependencies });
}
```

### 8. Module Exports
```typescript
// Export main class
export { [ModuleName] };

// Export types
export type {
  [ModuleName]Config,
  [ModuleName]Input,
  [ModuleName]Result,
  [ModuleName]Options,
};

// Export error classes
export {
  [ModuleName]Error,
  ValidationError,
  ConfigurationError,
};

// Export utility functions
export {
  helperFunction,
  utilityFunction,
  create[ModuleName],
};

// Default export
export default [ModuleName];
```

## Usage Example

### Basic Usage
```typescript
import { [ModuleName], create[ModuleName] } from './[module-name]';

// Create instance with default configuration
const module = create[ModuleName]();

// Initialize
await module.initialize();

// Process data
const result = await module.process({
  data: 'input data',
  options: { verbose: true }
});

// Check result
if (result.success) {
  console.log('Processing completed:', result.data);
} else {
  console.error('Processing failed:', result.error);
}

// Cleanup when done
await module.cleanup();
```

### Advanced Usage with Custom Configuration
```typescript
const module = new [ModuleName]({
  maxRetries: 5,
  timeout: 60000,
  enableFeature: false,
}, {
  logger: customLogger,
  // other dependencies
});

await module.initialize();

try {
  const result = await module.process(input, {
    enableCaching: true,
    verbose: true,
  });
  
  // Handle result
} catch (error) {
  // Handle error
} finally {
  await module.cleanup();
}
```

## Testing Template

### Unit Test Structure
```typescript
import { [ModuleName], [ModuleName]Config } from '../[module-name]';
import { createMockLogger } from '../../tests/mocks';

describe('[ModuleName]', () => {
  let module: [ModuleName];
  let mockLogger: jest.Mocked<Logger>;
  
  beforeEach(() => {
    mockLogger = createMockLogger();
    module = new [ModuleName]({}, { logger: mockLogger });
  });

  afterEach(async () => {
    await module.cleanup();
  });

  describe('initialization', () => {
    it('should initialize successfully with default config', async () => {
      await expect(module.initialize()).resolves.not.toThrow();
      expect(module.getStats().isInitialized).toBe(true);
    });

    it('should validate configuration during initialization', () => {
      const invalidModule = new [ModuleName]({ maxRetries: -1 });
      expect(() => invalidModule).toThrow('maxRetries must be non-negative');
    });
  });

  describe('processing', () => {
    beforeEach(async () => {
      await module.initialize();
    });

    it('should process valid input successfully', async () => {
      const input = { data: 'test data' };
      const result = await module.process(input);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.metadata.processingTime).toBeGreaterThan(0);
    });

    it('should handle invalid input gracefully', async () => {
      const input = { data: '' };
      const result = await module.process(input);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid input');
    });
  });
});
```

## Documentation Requirements

### JSDoc Standards
- All public methods must have JSDoc comments
- Include `@param` and `@returns` for all parameters and return values
- Use `@throws` to document possible exceptions
- Include `@example` for complex methods
- Use `@private` for internal methods

### README Section Template
```markdown
## [ModuleName]

Brief description of what this module does and why it's important.

### Features
- Feature 1
- Feature 2
- Feature 3

### Usage
```typescript
// Basic usage example
```

### Configuration
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| option1 | string | 'default' | Description |

### Error Handling
- `ValidationError`: Thrown when input validation fails
- `ConfigurationError`: Thrown when configuration is invalid

### Performance Considerations
- Note about memory usage
- Note about processing time
- Any limitations
```

## Code Quality Checklist

### Before Submitting
- [ ] All public methods have JSDoc documentation
- [ ] Input validation is implemented
- [ ] Error handling covers all edge cases
- [ ] Logging is added for important operations
- [ ] Unit tests cover all public methods
- [ ] Configuration is validated
- [ ] Resources are properly cleaned up
- [ ] Performance considerations are documented
- [ ] TypeScript strict mode passes
- [ ] ESLint rules pass without warnings

### Code Review Points
- [ ] Follows single responsibility principle
- [ ] Dependencies are properly injected
- [ ] No hardcoded values (use constants)
- [ ] Consistent naming conventions
- [ ] Proper error message formatting
- [ ] Async operations are handled correctly
- [ ] Memory leaks are prevented
- [ ] Security considerations are addressed

This template ensures consistent, maintainable, and well-documented modules across the entire project.