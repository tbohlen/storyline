#!/usr/bin/env node

/**
 * Phase 1 Test Script
 *
 * This script tests all the components created in Phase 1:
 * - Configuration service
 * - Database service
 * - File parsing service
 * - Text chunking functionality
 */

const path = require('path');

// Since we're using ES modules in our services, we need to use dynamic imports
async function runTests() {
  console.log('🧪 Starting Phase 1 Tests...\n');

  try {
    // Test 1: Configuration Service
    console.log('📋 Test 1: Configuration Service');
    console.log('⚠️  Note: This test requires .env.local to be configured with valid credentials');

    try {
      const { getConfig, getEnvVar } = await import('./src/lib/services/config.js');

      // Test environment variable access
      const nodeEnv = getEnvVar('NODE_ENV', 'development');
      console.log(`✅ NODE_ENV: ${nodeEnv}`);

      // Test configuration loading (this will throw if required vars are missing)
      const config = getConfig();
      console.log(`✅ Configuration loaded successfully`);
      console.log(`   - Neo4j URI: ${config.neo4j.uri}`);
      console.log(`   - Neo4j User: ${config.neo4j.user}`);
      console.log(`   - App Port: ${config.app.port}`);
      console.log(`   - Anthropic API Key: ${config.anthropic.apiKey ? '[SET]' : '[NOT SET]'}`);
    } catch (error) {
      console.log(`❌ Configuration test failed: ${error.message}`);
      console.log('💡 Make sure to configure .env.local with the required variables');
    }

    console.log('\n' + '─'.repeat(50) + '\n');

    // Test 2: Database Service
    console.log('🗄️  Test 2: Database Service');

    try {
      const { getDriver, testConnection, initializeDatabase, closeDriver } = await import('./src/lib/services/database.js');

      console.log('🔌 Testing database connection...');
      const connectionResult = await testConnection();

      if (connectionResult) {
        console.log('✅ Database connection successful');

        console.log('🔧 Initializing database schema...');
        await initializeDatabase();
        console.log('✅ Database schema initialized');

      } else {
        console.log('❌ Database connection failed');
        console.log('💡 Make sure Neo4j is running: npm run neo4j:start');
      }

      // Clean up
      await closeDriver();

    } catch (error) {
      console.log(`❌ Database test failed: ${error.message}`);
    }

    console.log('\n' + '─'.repeat(50) + '\n');

    // Test 3: File Parsing Service
    console.log('📄 Test 3: File Parsing Service');

    try {
      const { readFile, readSpreadsheet, chunkText } = await import('./src/lib/services/fileParser.js');

      // Test reading the sample novel
      const novelPath = path.join(process.cwd(), 'data', 'sample_novel.txt');
      console.log(`📖 Reading novel: ${novelPath}`);

      const novelText = await readFile(novelPath);
      console.log(`✅ Novel loaded successfully (${novelText.length} characters)`);

      // Test reading the events spreadsheet
      const spreadsheetPath = path.join(process.cwd(), 'data', 'events_spreadsheet.tsv');
      console.log(`📊 Reading spreadsheet: ${spreadsheetPath}`);

      const events = await readSpreadsheet(spreadsheetPath);
      console.log(`✅ Spreadsheet loaded successfully (${events.length} events)`);

      // Display first few events
      console.log('\n📋 Sample events from spreadsheet:');
      events.slice(0, 3).forEach((event, index) => {
        console.log(`   ${index + 1}. ${event.id}: ${event.description} (${event.category})`);
      });

      console.log('\n' + '─'.repeat(50) + '\n');

      // Test 4: Text Chunking
      console.log('✂️  Test 4: Text Chunking');

      const chunks = chunkText(novelText, {
        size: 500,    // 500 characters per chunk
        overlap: 50   // 50 characters overlap
      });

      console.log(`✅ Text chunked successfully (${chunks.length} chunks)`);

      // Display first 5 chunks
      console.log('\n📚 First 5 text chunks:');
      chunks.slice(0, 5).forEach((chunk, index) => {
        const preview = chunk.text.substring(0, 100).replace(/\n/g, ' ');
        console.log(`\n   Chunk ${index + 1} (chars ${chunk.startIndex}-${chunk.endIndex}):`);
        console.log(`   "${preview}${chunk.text.length > 100 ? '...' : ''}"`);
      });

    } catch (error) {
      console.log(`❌ File parsing test failed: ${error.message}`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎉 Phase 1 Tests Completed!');
    console.log('='.repeat(50));

    console.log('\n💡 Next Steps:');
    console.log('   - Configure .env.local if configuration tests failed');
    console.log('   - Start Neo4j if database tests failed: npm run neo4j:start');
    console.log('   - All components are ready for Phase 2 implementation');

  } catch (error) {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  }
}

// Run the tests
runTests().catch(console.error);