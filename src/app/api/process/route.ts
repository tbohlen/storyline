import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { existsSync } from 'fs';
import { Orchestrator } from '@/lib/services/orchestrator';
import { messageStoreExists } from '@/lib/services/message-store';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.api;

// Store running orchestrator instances (in production, use Redis or similar)
const runningProcesses = new Map<string, Orchestrator>();

/**
 * POST /api/process
 * Starts the orchestrator to process a novel file
 * Expects: { filename: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename } = body;

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }

    // Validate file exists
    const dataDir = join(process.cwd(), 'data');
    const novelPath = join(dataDir, filename);

    if (!existsSync(novelPath)) {
      return NextResponse.json(
        { error: `File not found: ${filename}` },
        { status: 404 }
      );
    }

    // Conditionally load master events spreadsheet based on environment variable
    const useMasterEvents = process.env.USE_MASTER_EVENTS === 'true';
    const masterEventsPath = process.env.MASTER_EVENTS_PATH || 'event-timeline.csv';

    let spreadsheetPath: string | undefined;

    if (useMasterEvents) {
      const spreadsheetFullPath = join(dataDir, masterEventsPath);

      // Check if file exists
      if (existsSync(spreadsheetFullPath)) {
        spreadsheetPath = spreadsheetFullPath;
        logger.info({ spreadsheetPath }, 'Using master events spreadsheet');
      } else {
        logger.warn({
          expectedPath: spreadsheetFullPath
        }, 'Master events enabled but file not found, proceeding without it');
        spreadsheetPath = undefined;
      }
    } else {
      logger.info('Master events spreadsheet disabled via environment variable');
      spreadsheetPath = undefined;
    }

    // Check if already processing this file
    if (runningProcesses.has(filename)) {
      const orchestrator = runningProcesses.get(filename)!;
      if (orchestrator.isProcessing()) {
        return NextResponse.json(
          {
            error: 'File is already being processed',
            stats: orchestrator.getStats()
          },
          { status: 409 }
        );
      }
    }

    // Prevent reprocessing a file that already has a completed analysis
    if (messageStoreExists(filename)) {
      return NextResponse.json(
        { error: 'File has already been processed. Reprocessing is not supported.' },
        { status: 409 }
      );
    }

    // Create and initialize orchestrator
    const orchestrator = new Orchestrator(novelPath, spreadsheetPath, {
      chunkSize: 1500,      // Larger chunks for better context
      overlapSize: 300,     // Good overlap to catch events at boundaries
      maxRetries: 3
    });

    // Store the orchestrator instance
    runningProcesses.set(filename, orchestrator);

    logger.info({ filename }, 'Starting orchestrator for file');

    // Initialize orchestrator (this loads the novel and prepares agents)
    await orchestrator.initialize();

    // Start processing in the background (don't await)
    orchestrator.processNovel()
      .then((finalStats) => {
        logger.info({ filename, finalStats }, 'Processing completed for file');
        // Keep the orchestrator around for status queries
      })
      .catch((error) => {
        logger.error({ filename, error }, 'Processing failed for file');
        // Keep the orchestrator around so we can see the error in stats
      });

    return NextResponse.json({
      success: true,
      message: 'Processing started',
      filename,
      processId: filename, // Using filename as process ID for simplicity
      initialStats: orchestrator.getStats(),
      config: orchestrator.getConfig()
    });

  } catch (error) {
    logger.error({ error }, 'Process start error');

    return NextResponse.json(
      {
        error: 'Failed to start processing',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/process?filename=xyz
 * Gets the status of a running process
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename) {
      // Return list of all running processes
      const processes = Array.from(runningProcesses.entries()).map(([name, orchestrator]) => ({
        filename: name,
        stats: orchestrator.getStats(),
        isProcessing: orchestrator.isProcessing()
      }));

      return NextResponse.json({
        processes,
        count: processes.length
      });
    }

    // Return specific process status
    const orchestrator = runningProcesses.get(filename);

    if (!orchestrator) {
      return NextResponse.json(
        { error: `No process found for file: ${filename}` },
        { status: 404 }
      );
    }

    const stats = orchestrator.getStats();
    const previewText = orchestrator.getPreviewText(150);

    return NextResponse.json({
      filename,
      stats,
      previewText,
      isProcessing: orchestrator.isProcessing(),
      config: orchestrator.getConfig(),
      novelName: orchestrator.getNovelName()
    });

  } catch (error) {
    logger.error({ error }, 'Process status error');

    return NextResponse.json(
      {
        error: 'Failed to get process status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/process?filename=xyz
 * Stops and cleans up a running process
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename parameter is required' },
        { status: 400 }
      );
    }

    const orchestrator = runningProcesses.get(filename);

    if (!orchestrator) {
      return NextResponse.json(
        { error: `No process found for file: ${filename}` },
        { status: 404 }
      );
    }

    // Remove from running processes
    runningProcesses.delete(filename);

    // Note: The orchestrator doesn't have a stop method yet,
    // but we can remove it from our tracking
    const finalStats = orchestrator.getStats();

    logger.info({ filename }, 'Process cleanup completed for file');

    return NextResponse.json({
      success: true,
      message: 'Process cleaned up',
      filename,
      finalStats
    });

  } catch (error) {
    logger.error({ error }, 'Process cleanup error');

    return NextResponse.json(
      {
        error: 'Failed to cleanup process',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}