"use client"

import type { Node as NVLNode, Relationship as NVLEdge } from '@neo4j-nvl/base'
import { InteractiveNvlWrapper } from '@neo4j-nvl/react';
import { useGraphStore } from '@/lib/store/graph-store';
import type { EventNode } from '@/lib/db/events';
import type { GraphEdge } from '@/lib/store/graph-store';
import truncate from '@/lib/utils/truncate';

interface GraphCanvasProps {
  nodes: EventNode[];
  edges: Array<GraphEdge>;
  onNodeClick: (node: EventNode) => void;
  onEdgeClick: (edge: GraphEdge) => void;
}

/**
 * GraphCanvas component handles NVL rendering using React wrappers
 * Transforms Event nodes to NVL format for visualization
 */
export function GraphCanvas({
  nodes,
  edges,
  onNodeClick,
  onEdgeClick,
}: GraphCanvasProps) {
  const { selectedNode, selectedEdge } = useGraphStore();

  // Transform Event nodes to NVL format with conditional styling for selected node
  const nvlNodes = nodes.map((node) => {
    const isSelected = selectedNode?.id === node.id;

    return {
      id: node.id,
      labels: ["Event"],
      properties: {
        description: node.description,
        quote: node.quote,
        charRangeStart: node.charRangeStart,
        charRangeEnd: node.charRangeEnd,
        approximateDate: node.approximateDate,
        absoluteDate: node.absoluteDate,
      },
      // Style selected node differently
      color: isSelected ? "#3b82f6" : undefined, // Blue for selected, default for others
      size: 100,
      caption: truncate(node.description, 50),
    };
  });

  // Transform relationships to NVL format
  const nvlRelationships = edges.map((edge) => {
    const isSelected = selectedEdge?.id === edge.id;

    return {
      id: edge.id,
      from: edge.from,
      to: edge.to,
      type: edge.type,
      caption: edge.type, // Display the relationship type on the arrow
      properties: {
        sourceText: edge.sourceText,
      },
      color: isSelected ? "#3b82f6" : undefined, // Blue for selected, default for others
    };
  });

  return (
    <div className="w-full h-full">
      <InteractiveNvlWrapper
        nodes={nvlNodes}
        rels={nvlRelationships}
        nvlOptions={{
          layout: "d3Force",
          allowDynamicMinZoom: true,
          disableWebGL: true, // false requires worker script to load properly. This is a TODO
          instanceId: "event-graph",
        }}
        mouseEventCallbacks={{
          onNodeClick: (node: NVLNode) => {
            // Find the original Event node using the clicked node's id
            const eventNode = nodes.find((n) => n.id === node.id);
            if (eventNode) {
              onNodeClick(eventNode);
            }
          },
          onZoom: true, // Enable zoom with mouse wheel / pinch
          onPan: true, // Enable pan with click-and-drag
          onRelationshipClick: (edge: NVLEdge) => {
            // Find the original edge using the clicked edge's id
            console.log(`RELATION CLICK: ${JSON.stringify(edge)}`);
            console.log(`Edges are ${JSON.stringify(edges)}`);
            const eventEdge = edges.find((e) => e.id === edge.id);
            if (eventEdge) {
              console.log("IN IF");
              onEdgeClick(eventEdge);
            }
          }
        }}
      />
    </div>
  );
}
