import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.api;

/**
 * POST /api/upload
 * Handles file uploads for novels (.docx and .txt files)
 * Stores files in the /data directory for processing
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['.docx', '.txt'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = allowedTypes.some(ext => fileName.endsWith(ext));

    if (!hasValidExtension) {
      return NextResponse.json(
        { error: 'Invalid file type. Only .docx and .txt files are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB.' },
        { status: 400 }
      );
    }

    // Ensure data directory exists
    const dataDir = join(process.cwd(), 'data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    // Generate safe filename with timestamp to avoid conflicts
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
    const baseName = fileName.substring(0, fileName.lastIndexOf('.')).replace(/[^a-zA-Z0-9-_]/g, '_');
    const safeFileName = `${baseName}_${timestamp}${fileExtension}`;

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filePath = join(dataDir, safeFileName);
    await writeFile(filePath, buffer);

    logger.info({
      filename: safeFileName,
      originalName: file.name,
      size: file.size
    }, 'File uploaded successfully');

    return NextResponse.json({
      success: true,
      filename: safeFileName,
      originalName: file.name,
      size: file.size,
      type: file.type,
      path: filePath
    });

  } catch (error) {
    logger.error({ error }, 'File upload error');

    return NextResponse.json(
      {
        error: 'Failed to upload file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/upload
 * Returns information about uploaded files
 */
export async function GET() {
  try {
    const dataDir = join(process.cwd(), 'data');

    if (!existsSync(dataDir)) {
      return NextResponse.json({
        files: [],
        message: 'No uploads directory found'
      });
    }

    // This is a simple endpoint - could be expanded to list files
    return NextResponse.json({
      message: 'Upload endpoint ready',
      supportedTypes: ['.docx', '.txt'],
      maxSize: '50MB'
    });

  } catch (error) {
    logger.error({ error}, 'Error checking upload status');

    return NextResponse.json(
      {
        error: 'Failed to check upload status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}