"use client"

import { InteractiveNvlWrapper } from '@neo4j-nvl/react';
import { useGraphStore } from '@/lib/store/graph-store';
import type { EventNode } from '@/lib/tools/databaseTools';
import truncate from '@/lib/utils/truncate';

interface GraphCanvasProps {
  nodes: EventNode[];
  edges: Array<{
    from: string;
    to: string;
    type: string;
    sourceText: string;
  }>;
  onNodeClick: (node: EventNode) => void;
}

/**
 * GraphCanvas component handles NVL rendering using React wrappers
 * Transforms Event nodes to NVL format for visualization
 */
export function GraphCanvas({ nodes, edges, onNodeClick }: GraphCanvasProps) {
  const { selectedNode } = useGraphStore();

  // Transform Event nodes to NVL format with conditional styling for selected node
  const nvlNodes = nodes.map(node => {
    const isSelected = selectedNode?.id === node.id;

    return {
      id: node.id,
      labels: ['Event'],
      properties: {
        description: node.description,
        quote: node.quote,
        charRangeStart: node.charRangeStart,
        charRangeEnd: node.charRangeEnd,
        approximateDate: node.approximateDate,
        absoluteDate: node.absoluteDate
      },
      // Style selected node differently
      color: isSelected ? '#3b82f6' : undefined, // Blue for selected, default for others
      caption: truncate(node.description, 50)
    };
  });

  // Transform relationships to NVL format
  const nvlRelationships = edges.map((edge, idx) => ({
    id: `rel-${idx}`,
    from: edge.from,
    to: edge.to,
    type: edge.type,
    properties: {
      sourceText: edge.sourceText
    }
  }));

  return (
    <div className="w-full h-full">
      <InteractiveNvlWrapper
        nodes={nvlNodes}
        rels={nvlRelationships}
        nvlOptions={{
          layout: 'force',
          allowDynamicMinZoom: true,
        }}
        mouseEventCallbacks={{
          onNodeClick: (node: any) => {
            // Find the original Event node using the clicked node's id
            const eventNode = nodes.find(n => n.id === node.id);
            if (eventNode) {
              onNodeClick(eventNode);
            }
          }
        }}
      />
    </div>
  );
}
