import { create } from 'zustand';
import type { EventNode } from '@/lib/db/events';

/**
 * Graph data structure returned from /api/graph
 */
export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: string;
  sourceText: string;
}
export interface GraphData {
  nodes: EventNode[];
  edges: Array<GraphEdge>;
  metadata: {
    nodeCount: number;
    edgeCount: number;
    novelName: string;
  };
}

/**
 * Zustand store for graph visualization state
 */
interface GraphStore {
  // Data
  graphData: GraphData | null;
  selectedNode: EventNode | null;
  selectedEdge: GraphEdge | null;

  // UI State
  loading: boolean;
  error: string | null;

  // Actions
  setGraphData: (data: GraphData) => void;
  setSelectedNode: (node: EventNode | null) => void;
  setSelectedEdge: (node: GraphEdge | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearSelectedNode: () => void;
  clearSelectedEdge: () => void;
}

/**
 * Graph store hook for managing graph visualization state
 */
export const useGraphStore = create<GraphStore>((set) => ({
  // Initial state
  graphData: null,
  selectedNode: null,
  selectedEdge: null,
  loading: true,
  error: null,

  // Actions
  setGraphData: (data) => set({ graphData: data }),
  setSelectedNode: (node) => set({ selectedNode: node, selectedEdge: null }),
  setSelectedEdge: (edge) => set({ selectedEdge: edge, selectedNode: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  clearSelectedNode: () => set({ selectedNode: null }),
  clearSelectedEdge: () => set({ selectedEdge: null }),
}));
