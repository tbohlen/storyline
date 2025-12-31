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

type UploadState = 'idle' | 'selected' | 'uploading' | 'starting' | 'error';

export function FileUpload({ onFileUploaded, className }: FileUploadProps) {
  const router = useRouter();
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback((file: File) => {
    // Validate file type
    const allowedTypes = ['.docx', '.txt'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!allowedTypes.includes(fileExtension)) {
      setError('Please select a .docx or .txt file');
      setUploadState('error');
      return;
    }

    // Store file in state, don't upload yet
    setSelectedFile(file);
    setUploadState('selected');
    setError(null);
  }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const files = Array.from(event.dataTransfer.files);
    const file = files[0];

    if (!file) return;

    processFile(file);
  }, [processFile]);

  const handleStart = async () => {
    if (!selectedFile) return;

    setUploadState('uploading');
    setError(null);

    try {
      // Step 1: Upload the file
      const formData = new FormData();
      formData.append('file', selectedFile);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      const uploadResult = await uploadResponse.json();
      const filename = uploadResult.filename;

      onFileUploaded?.(filename);

      // Step 2: Start processing
      setUploadState('starting');

      const processResponse = await fetch('/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename }),
      });

      if (!processResponse.ok) {
        throw new Error(`Processing failed: ${processResponse.statusText}`);
      }

      // Step 3: Navigate to observer page with filename
      router.push(`/observer?filename=${encodeURIComponent(filename)}`);

    } catch (error) {
      console.error('Start processing error:', error);
      setError(error instanceof Error ? error.message : 'Failed to start processing');
      setUploadState('selected'); // Return to selected state for retry
    }
  };

  const getStateIcon = () => {
    switch (uploadState) {
      case 'uploading':
        return <Loader2 className="h-8 w-8 animate-spin text-blue-500" />;
      case 'starting':
        return <Loader2 className="h-8 w-8 animate-spin text-purple-500" />;
      case 'selected':
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
      case 'starting':
        return 'Starting analysis...';
      case 'selected':
        return `File selected: ${selectedFile?.name}`;
      case 'error':
        return error || 'Selection failed';
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
            uploadState === 'starting' && 'border-purple-300 bg-purple-50',
            uploadState === 'selected' && 'border-green-300 bg-green-50',
            uploadState === 'error' && 'border-red-300 bg-red-50'
          )}
        >
          <input
            type="file"
            accept=".docx,.txt"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
            disabled={uploadState === 'uploading' || uploadState === 'starting'}
          />
          <label htmlFor="file-upload" className="cursor-pointer block">
            <div className="flex flex-col items-center space-y-4">
              {getStateIcon()}
              <div>
                <p className="text-lg font-medium">{getStateText()}</p>
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

        {selectedFile && uploadState === 'selected' && (
          <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <File className="h-4 w-4 text-green-600 mr-2" />
                <span className="text-sm font-medium text-green-700">
                  Ready to process: {selectedFile.name}
                </span>
              </div>
              <Button
                onClick={handleStart}
                disabled={false}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                Start Analysis
              </Button>
            </div>
          </div>
        )}

        {(uploadState === 'uploading' || uploadState === 'starting') && (
          <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
            <div className="flex items-center">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600 mr-2" />
              <span className="text-sm font-medium text-blue-700">
                {uploadState === 'uploading' ? 'Uploading file...' : 'Starting analysis...'}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}