import type { NextApiRequest, NextApiResponse } from 'next';
import { processNovel, ProcessingOptions, ProcessingResult } from '../../lib/main';
import path from 'path';

interface ProcessingStatus {
  isProcessing: boolean;
  currentNovel?: string | null;
  novelNumber?: number;
  progress: number;
  startTime?: Date | null;
  completedAt?: Date;
  options?: ProcessingOptions;
  result?: ProcessingResult;
  error?: string;
}

interface ProcessRequest {
  novelNumber?: number;
  novelFileName: string;
  options?: ProcessingOptions;
}

interface ProcessResponse {
  success: boolean;
  message?: string;
  status?: ProcessingStatus;
  error?: string;
}

// Store processing status in memory (in production, use Redis or database)
let processingStatus: ProcessingStatus = {
  isProcessing: false,
  currentNovel: null,
  progress: 0,
  startTime: null
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProcessResponse>
) {
  if (req.method === 'POST') {
    const { novelNumber = 1, novelFileName, options = {} } = req.body as ProcessRequest;

    // Check if already processing
    if (processingStatus.isProcessing) {
      return res.status(409).json({
        success: false,
        error: 'Already processing a novel',
        status: processingStatus
      });
    }

    // Validate input
    if (!novelFileName) {
      return res.status(400).json({
        success: false,
        error: 'novelFileName is required'
      });
    }

    const novelPath = path.join(process.cwd(), 'data', novelFileName);

    // Start processing asynchronously
    processingStatus = {
      isProcessing: true,
      currentNovel: novelFileName,
      novelNumber,
      progress: 0,
      startTime: new Date(),
      options
    };

    // Process in background
    processNovelAsync(novelPath, novelNumber, options);

    // Return immediately with 202 Accepted
    res.status(202).json({
      success: true,
      message: 'Processing started',
      status: processingStatus
    });

  } else if (req.method === 'GET') {
    // Return current processing status
    res.status(200).json({
      success: true,
      status: processingStatus
    });

  } else {
    res.setHeader('Allow', ['POST', 'GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

async function processNovelAsync(
  novelPath: string,
  novelNumber: number,
  options: ProcessingOptions
): Promise<void> {
  try {
    console.log('Starting background novel processing...');

    const result = await processNovel(novelPath, novelNumber, {
      ...options,
      maxChunks: options.maxChunks || 5, // Limit for demo
      delayBetweenChunks: options.delayBetweenChunks || 100
    });

    processingStatus = {
      isProcessing: false,
      currentNovel: null,
      progress: 100,
      startTime: processingStatus.startTime,
      completedAt: new Date(),
      result
    };

    console.log('Background processing completed:', result.success ? 'SUCCESS' : 'FAILED');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    processingStatus = {
      isProcessing: false,
      currentNovel: null,
      progress: 0,
      startTime: processingStatus.startTime,
      completedAt: new Date(),
      error: errorMessage
    };

    console.error('Background processing failed:', error);
  }
}