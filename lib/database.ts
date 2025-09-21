import neo4j, { Driver, Session } from 'neo4j-driver';
import config from './config';
import pino from 'pino';

const logger = pino();

let driver: Driver | null = null;

export function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(
      config.neo4j.uri,
      neo4j.auth.basic(config.neo4j.user, config.neo4j.password)
    );
  }
  return driver;
}

export async function testConnection(): Promise<string> {
  const session: Session = getDriver().session();
  try {
    const result = await session.run('RETURN "Neo4j connection successful" AS message');
    logger.info('Database connection test successful');
    return result.records[0].get('message');
  } catch (error) {
    logger.error({ error } + " " + JSON.stringify('Database connection failed:'));
    throw error;
  } finally {
    await session.close();
  }
}