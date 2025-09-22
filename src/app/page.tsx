"use client";

import { FileUpload } from "@/components/file-upload";

/**
 * Home page component for uploading novels and starting analysis
 * Provides a clean interface for file upload and orchestrator initiation
 */
export default function HomePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">S</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Storyline Analysis</h1>
              <p className="text-muted-foreground">
                AI-powered timeline analysis for novels and story series
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl space-y-8">
          {/* Welcome Section */}
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold tracking-tight">
              Analyze Your Novel's Timeline
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Upload your novel and let our AI agents identify significant events,
              map temporal relationships, and detect potential timeline inconsistencies.
            </p>
          </div>

          {/* Upload Component */}
          <div className="flex justify-center">
            <FileUpload className="w-full max-w-2xl" />
          </div>

          {/* Instructions */}
          <div className="bg-muted/50 rounded-lg p-6 space-y-4">
            <h3 className="font-semibold text-lg">How it works</h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start">
                <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mr-3 mt-0.5 flex-shrink-0">
                  1
                </span>
                <span>Upload your novel in .docx or .txt format</span>
              </li>
              <li className="flex items-start">
                <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mr-3 mt-0.5 flex-shrink-0">
                  2
                </span>
                <span>Click "Start Analysis" to begin AI-powered event detection</span>
              </li>
              <li className="flex items-start">
                <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mr-3 mt-0.5 flex-shrink-0">
                  3
                </span>
                <span>Watch the analysis process in real-time on the observer page</span>
              </li>
              <li className="flex items-start">
                <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mr-3 mt-0.5 flex-shrink-0">
                  4
                </span>
                <span>Review the generated timeline graph and event relationships</span>
              </li>
            </ol>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-16">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>Powered by Claude AI and Neo4j graph database</p>
            <p>Supports .docx and .txt novel formats</p>
          </div>
        </div>
      </footer>
    </div>
  );
}