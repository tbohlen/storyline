"use client";

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, File, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileUploaded?: (filename: string) => void;
  className?: string;
}

type UploadState = 'idle' | 'uploading' | 'uploaded' | 'error';

export function FileUpload({ onFileUploaded, className }: FileUploadProps) {
  const router = useRouter();
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['.docx', '.txt'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!allowedTypes.includes(fileExtension)) {
      setError('Please select a .docx or .txt file');
      setUploadState('error');
      return;
    }

    setUploadState('uploading');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();

      setUploadedFile(result.filename);
      setUploadState('uploaded');
      onFileUploaded?.(result.filename);

    } catch (error) {
      console.error('Upload error:', error);
      setError(error instanceof Error ? error.message : 'Upload failed');
      setUploadState('error');
    }
  }, [onFileUploaded]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const files = Array.from(event.dataTransfer.files);
    const file = files[0];

    if (!file) return;

    // Create a synthetic event to reuse existing logic
    const syntheticEvent = {
      target: { files: [file] }
    } as React.ChangeEvent<HTMLInputElement>;

    await handleFileChange(syntheticEvent);
  }, [handleFileChange]);

  const handleStart = async () => {
    if (!uploadedFile) return;

    setIsStarting(true);
    setError(null);

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename: uploadedFile }),
      });

      if (!response.ok) {
        throw new Error(`Processing failed: ${response.statusText}`);
      }

      // Navigate to observer page
      router.push('/observer');

    } catch (error) {
      console.error('Start processing error:', error);
      setError(error instanceof Error ? error.message : 'Failed to start processing');
      setIsStarting(false);
    }
  };

  const getStateIcon = () => {
    switch (uploadState) {
      case 'uploading':
        return <Loader2 className="h-8 w-8 animate-spin text-blue-500" />;
      case 'uploaded':
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-8 w-8 text-red-500" />;
      default:
        return <Upload className="h-8 w-8 text-gray-400" />;
    }
  };

  const getStateText = () => {
    switch (uploadState) {
      case 'uploading':
        return 'Uploading file...';
      case 'uploaded':
        return `File uploaded: ${uploadedFile}`;
      case 'error':
        return error || 'Upload failed';
      default:
        return 'Click to select a file or drag and drop';
    }
  };

  return (
    <Card className={cn('w-full max-w-2xl', className)}>
      <CardHeader>
        <CardTitle>Upload Novel</CardTitle>
        <CardDescription>
          Upload a .docx or .txt file containing your novel for timeline analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
            uploadState === 'idle' && 'border-gray-300 hover:border-gray-400',
            uploadState === 'uploading' && 'border-blue-300 bg-blue-50',
            uploadState === 'uploaded' && 'border-green-300 bg-green-50',
            uploadState === 'error' && 'border-red-300 bg-red-50'
          )}
        >
          <input
            type="file"
            accept=".docx,.txt"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
            disabled={uploadState === 'uploading' || isStarting}
          />
          <label htmlFor="file-upload" className="cursor-pointer block">
            <div className="flex flex-col items-center space-y-4">
              {getStateIcon()}
              <div>
                <p className="text-lg font-medium">{getStateText()}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Supported formats: .docx, .txt
                </p>
              </div>
            </div>
          </label>
        </div>

        {error && (
          <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {uploadedFile && (
          <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <File className="h-4 w-4 text-green-600 mr-2" />
                <span className="text-sm font-medium text-green-700">
                  Ready to process: {uploadedFile}
                </span>
              </div>
              <Button
                onClick={handleStart}
                disabled={isStarting}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Starting...
                  </>
                ) : (
                  'Start Analysis'
                )}
              </Button>
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 space-y-1">
          <p>• The novel will be analyzed for significant events and timeline inconsistencies</p>
          <p>• Processing may take several minutes depending on file size</p>
          <p>• You'll be redirected to the observer page to watch the analysis in real-time</p>
        </div>
      </CardContent>
    </Card>
  );
}