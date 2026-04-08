"use client";

import { X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { EventNode } from '@/lib/db/events';

interface NodeDetailsOverlayProps {
  node: EventNode | null;
  onClose: () => void;
}

/**
 * NodeDetailsOverlay displays selected node details in a bottom overlay
 * Shows description, quote, character range, and dates
 */
export function NodeDetailsOverlay({ node, onClose }: NodeDetailsOverlayProps) {
  if (!node) return null;

  return (
    <div className="absolute bottom-4 left-4 right-4 z-10">
      <Card className="shadow-lg backdrop-blur-sm bg-card/95">
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-3">
            <h3 className="font-semibold text-lg">{node.description}</h3>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              aria-label="Close details"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Quote
              </p>
              <p className="text-sm italic text-muted-foreground">
                &quot;{node.quote}&quot;
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Character Range
              </p>
              <p className="text-sm italic text-muted-foreground">
                {node.charRangeStart} - {node.charRangeEnd}
              </p>
            </div>

            {node.approximateDate && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Approximate Date
                </p>
                <p className="text-sm italic text-muted-foreground">
                  ~{node.approximateDate}
                </p>
              </div>
            )}

            {node.absoluteDate && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Exact Date
                </p>
                <p className="text-sm italic text-muted-foreground">
                  {node.absoluteDate}
                </p>
              </div>
            )}

            {node.masterEventName && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Matched Master Event
                </p>
                <p className="text-sm italic text-muted-foreground">
                  {node.masterEventName}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {node.spreadsheetId && !node.masterEventName && (
                <Badge variant="outline">
                  Master Event Id: {node.spreadsheetId}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
