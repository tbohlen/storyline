import neo4j, { Driver, Session, Result } from 'neo4j-driver';
import { getConfig } from './config';
import { loggers } from '../utils/logger';

const logger = loggers.database;

let driver: Driver | null = null;

/**
 * Initializes and returns the Neo4j driver instance
 * @returns {Driver} The Neo4j driver instance
 */
export function getDriver(): Driver {
  if (!driver) {
    const config = getConfig();

    try {
      driver = neo4j.driver(
        config.neo4j.uri,
        neo4j.auth.basic(config.neo4j.user, config.neo4j.password),
        {
          // Connection configuration
          maxConnectionLifetime: 60000, // 1 minute
          maxConnectionPoolSize: 50,
          connectionAcquisitionTimeout: 60000, // 1 minute
          disableLosslessIntegers: true, // Return numbers as JavaScript numbers
        }
      );

      logger.info(`Neo4j driver initialized - uri: ${config.neo4j.uri}`);
    } catch (error) {
      logger.error(`Failed to initialize Neo4j driver: ${error}`);
      throw new Error(`Failed to initialize Neo4j driver: ${error}`);
    }
  }

  return driver;
}

/**
 * Tests the connection to the Neo4j database
 * @returns {Promise<boolean>} True if connection is successful, false otherwise
 */
export async function testConnection(): Promise<boolean> {
  const driver = getDriver();
  let session: Session | null = null;

  try {
    session = driver.session();

    // Run a simple query to test connectivity
    const result = await session.run('RETURN 1 as test');

    if (result.records.length > 0 && result.records[0].get('test') === 1) {
      logger.info('Neo4j database connection test successful');
      return true;
    } else {
      logger.error('Neo4j database connection test failed: Unexpected result');
      return false;
    }
  } catch (error) {
    logger.error(`Neo4j database connection test failed: ${error}`);
    return false;
  } finally {
    if (session) {
      await session.close();
    }
  }
}

/**
 * Creates a new session for database operations
 * @returns {Session} A new Neo4j session
 */
export function createSession(): Session {
  const driver = getDriver();
  return driver.session();
}

/**
 * Executes a Cypher query with parameters
 * @param {string} cypher - The Cypher query to execute
 * @param {Record<string, any>} parameters - Parameters for the query
 * @returns {Promise<Result>} The query result
 */
export async function executeQuery(
  cypher: string,
  parameters: Record<string, unknown> = {}
): Promise<Result> {
  const session = createSession();

  try {
    logger.debug(`Executing Cypher query: ${cypher} with parameters: ${JSON.stringify(parameters)}`);
    const result = await session.run(cypher, parameters);
    logger.debug(`Query executed successfully - recordCount: ${result.records.length}`);
    return result;
  } catch (error) {
    logger.error(`Failed to execute Cypher query: ${cypher} with parameters: ${JSON.stringify(parameters)} - error: ${error}`);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Closes the Neo4j driver connection
 * @returns {Promise<void>}
 */
export async function closeDriver(): Promise<void> {
  if (driver) {
    try {
      await driver.close();
      driver = null;
      logger.info('Neo4j driver closed successfully');
    } catch (error) {
      logger.error(`Error closing Neo4j driver: ${error}`);
      throw error;
    }
  }
}

/**
 * Ensures the database has the required constraints and indexes for the Event nodes
 * @returns {Promise<void>}
 */
export async function initializeDatabase(): Promise<void> {
  try {
    logger.info('Initializing database schema');

    // Create unique constraint on Event.id
    await executeQuery(
      'CREATE CONSTRAINT event_id_unique IF NOT EXISTS FOR (e:Event) REQUIRE e.id IS UNIQUE'
    );

    // Create index on Event.spreadsheetId for faster lookups
    await executeQuery(
      'CREATE INDEX event_spreadsheet_id IF NOT EXISTS FOR (e:Event) ON (e.spreadsheetId)'
    );

    // Create index on Event.novelName for faster lookups
    await executeQuery(
      'CREATE INDEX event_novel_name IF NOT EXISTS FOR (e:Event) ON (e.novelName)'
    );

    // Create index on Event.charRangeStart for temporal ordering
    await executeQuery(
      'CREATE INDEX event_char_range_start IF NOT EXISTS FOR (e:Event) ON (e.charRangeStart)'
    );

    logger.info('Database schema initialization completed');
  } catch (error) {
    logger.error(`Failed to initialize database schema: ${error}`);
    throw new Error(`Database initialization failed: ${error}`);
  }
}

/**
 * Clears all Event nodes and relationships from the database
 * WARNING: This will delete all data in the graph
 * @returns {Promise<void>}
 */
export async function clearDatabase(): Promise<void> {
  try {
    logger.warn('Clearing all data from database');

    // Delete all relationships first
    await executeQuery('MATCH ()-[r]-() DELETE r');

    // Then delete all nodes
    await executeQuery('MATCH (n) DELETE n');

    logger.info('Database cleared successfully');
  } catch (error) {
    logger.error(`Failed to clear database: ${error}`);
    throw error;
  }
}