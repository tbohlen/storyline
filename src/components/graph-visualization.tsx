"use client"

import { useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Network } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGraphStore } from '@/lib/store/graph-store';
import { NodeDetailsOverlay } from './node-details-overlay';
import { EdgeDetailsOverlay } from './edge-details-overlay';

// Dynamically import GraphCanvas with no SSR
const GraphCanvas = dynamic(
  () => import('./graph-canvas').then(mod => mod.GraphCanvas),
  { ssr: false, loading: () => <div className="w-full h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div> }
);

interface GraphVisualizationProps {
  filename: string;
  className?: string;
}

/**
 * GraphVisualization is the main coordinator component
 * Fetches graph data, listens to SSE for updates, and composes child components
 */
export function GraphVisualization({ filename, className }: GraphVisualizationProps) {
  const {
    graphData,
    selectedNode,
    selectedEdge,
    loading,
    error,
    setGraphData,
    setSelectedNode,
    setSelectedEdge,
    setLoading,
    setError,
    clearSelectedNode,
    clearSelectedEdge,
  } = useGraphStore();

  /**
   * Fetch graph data from API
   */
  const fetchGraphData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/graph?filename=${encodeURIComponent(filename)}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch graph: ${response.statusText}`);
      }

      const data = await response.json();
      setGraphData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load graph');
    } finally {
      setLoading(false);
    }
  }, [filename, setGraphData, setLoading, setError]);

  // Fetch graph data on mount
  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  // Listen to SSE stream for updates
  useEffect(() => {
    if (!filename) return;

    const eventSource = new EventSource(
      `/api/stream?filename=${encodeURIComponent(filename)}`
    );

    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // Check if message has parts (UIMessage format)
        if (message.parts && Array.isArray(message.parts)) {
          for (const part of message.parts) {
            // Refresh graph when events or relationships are created
            if (
              part.type === 'tool-create_event' &&
              part.state === 'output-available'
            ) {
              fetchGraphData();
              break;
            }

            if (
              part.type === 'tool-create_relationship' &&
              part.state === 'output-available'
            ) {
              fetchGraphData();
              break;
            }

            // Refresh when processing completes
            if (
              part.type === 'data-status' &&
              part.data?.status === 'completed'
            ) {
              fetchGraphData();
              break;
            }
          }
        }
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [fetchGraphData, filename]);

  return (
    <div className={cn('h-full flex flex-col', className)}>
      <div className="px-4 py-3 flex items-center justify-between border-b border-border">
        <div className="flex items-center space-x-2">
          <Network className="h-5 w-5" />
          <span className="text-lg font-semibold">Event Timeline Graph</span>
        </div>
        {graphData && (
          <div className="flex items-center space-x-2">
            <Badge variant="outline">{graphData.metadata.nodeCount} nodes</Badge>
            <Badge variant="outline">{graphData.metadata.edgeCount} edges</Badge>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden relative">
        {loading && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground">Loading graph...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="h-full flex items-center justify-center p-4">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && graphData && (
          <>
            {graphData.nodes.length === 0 ? (
              <div className="h-full flex items-center justify-center p-4">
                <div className="text-center">
                  <Network className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    No events detected yet. Processing in progress...
                  </p>
                </div>
              </div>
            ) : (
              <>
                <GraphCanvas
                  nodes={graphData.nodes}
                  edges={graphData.edges}
                  onNodeClick={(node) => setSelectedNode(node)}
                  onEdgeClick={(edge) => setSelectedEdge(edge)}
                />

                <NodeDetailsOverlay
                  node={selectedNode}
                  onClose={() => clearSelectedNode()}
                />

                <EdgeDetailsOverlay
                  edge={selectedEdge}
                  onClose={() => clearSelectedEdge()}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
