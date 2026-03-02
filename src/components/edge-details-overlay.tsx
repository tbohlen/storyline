"use client";

import { X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { GraphEdge } from '@/lib/store/graph-store';

interface EdgeDetailsOverlayProps {
  edge: GraphEdge | null;
  onClose: () => void;
}

/**
 * EdgeDetailsOverlay displays selected edge details in a bottom overlay
 * Shows description, quote, character range, and dates
 */
export function EdgeDetailsOverlay({ edge, onClose }: EdgeDetailsOverlayProps) {
  if (!edge) return null;

  return (
    <div className="absolute bottom-4 left-4 right-4 z-10">
      <Card className="shadow-lg backdrop-blur-sm bg-card/95">
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-3">
            <h3 className="font-semibold text-lg">Event Details</h3>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              aria-label="Close details"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Quote:
            </p>
            <p className="text-sm italic text-muted-foreground">
              &quot;{edge.sourceText}&quot;
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
