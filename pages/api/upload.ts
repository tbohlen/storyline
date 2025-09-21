import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, File } from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

interface UploadedFileInfo {
  name: string;
  originalName: string;
  size: number;
  type: string;
}

interface UploadResponse {
  success: boolean;
  message?: string;
  file?: UploadedFileInfo;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const form = new IncomingForm({
    uploadDir: path.join(process.cwd(), 'data'),
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
  });

  try {
    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const [fields, files] = await form.parse(req);
    const uploadedFile = files.file?.[0] as File | undefined;

    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Validate file type
    const allowedExtensions = ['.txt', '.docx'];
    const fileExtension = path.extname(uploadedFile.originalFilename || '').toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      // Clean up uploaded file
      fs.unlinkSync(uploadedFile.filepath);
      return res.status(400).json({
        success: false,
        error: 'Invalid file type. Only .txt and .docx files are allowed.'
      });
    }

    // Generate a unique filename
    const timestamp = Date.now();
    const sanitizedName = uploadedFile.originalFilename?.replace(/[^a-zA-Z0-9.-]/g, '_') || 'uploaded_file';
    const newFileName = `${timestamp}_${sanitizedName}`;
    const newFilePath = path.join(uploadDir, newFileName);

    // Move file to final location
    fs.renameSync(uploadedFile.filepath, newFilePath);

    res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        name: newFileName,
        originalName: uploadedFile.originalFilename || 'unknown',
        size: uploadedFile.size,
        type: uploadedFile.mimetype || 'unknown'
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to upload file: ' + errorMessage
    });
  }
}