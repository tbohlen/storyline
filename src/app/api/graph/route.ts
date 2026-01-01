import { NextRequest, NextResponse } from 'next/server';
import { getAllEvents } from '@/lib/tools/databaseTools';
import { executeQuery } from '@/lib/services/database';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.api;

/**
 * GET /api/graph?filename=xyz
 * Fetches all Event nodes and relationships for visualization
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename) {
      logger.error('Graph endpoint called without filename parameter');
      return NextResponse.json(
        { error: 'filename parameter is required' },
        { status: 400 }
      );
    }

    logger.info({ filename }, 'Fetching graph data');

    // Get all event nodes for this novel
    const events = await getAllEvents(filename);

    // Get all relationships between events
    // (Using executeQuery since no helper exists for relationships)
    const relationshipsResult = await executeQuery(`
      MATCH (from:Event)-[r]->(to:Event)
      WHERE from.novelName = $novelName
      RETURN
        from.id as fromId,
        to.id as toId,
        type(r) as relationshipType,
        r.sourceText as sourceText
    `, { novelName: filename });

    const relationships = relationshipsResult.records.map(record => ({
      from: record.get('fromId'),
      to: record.get('toId'),
      type: record.get('relationshipType'),
      sourceText: record.get('sourceText')
    }));

    logger.info({
      filename,
      nodeCount: events.length,
      edgeCount: relationships.length
    }, 'Graph data fetched successfully');

    return NextResponse.json({
      nodes: events,
      edges: relationships,
      metadata: {
        nodeCount: events.length,
        edgeCount: relationships.length,
        novelName: filename
      }
    });

  } catch (error) {
    logger.error({ error }, 'Failed to fetch graph data');
    return NextResponse.json(
      {
        error: 'Failed to fetch graph data',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
