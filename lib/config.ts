import 'dotenv/config';

export interface Neo4jConfig {
  uri: string;
  user: string;
  password: string;
}

export interface Config {
  port: number;
  neo4j: Neo4jConfig;
  anthropicApiKey: string | undefined;
}

const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'password'
  },
  anthropicApiKey: process.env.ANTHROPIC_API_KEY
};

export default config;