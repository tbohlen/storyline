"use client";

import { X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { EventNode } from '@/lib/tools/databaseTools';

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
            <h3 className="font-semibold text-lg">Event Details</h3>
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
              <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
              <p className="text-sm">{node.description}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Quote</p>
              <p className="text-sm italic text-muted-foreground">"{node.quote}"</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                Characters: {node.charRangeStart} - {node.charRangeEnd}
              </Badge>

              {node.approximateDate && (
                <Badge variant="outline">
                  ~{node.approximateDate}
                </Badge>
              )}

              {node.absoluteDate && (
                <Badge variant="outline">
                  Date: {node.absoluteDate}
                </Badge>
              )}

              {node.spreadsheetId && (
                <Badge variant="outline">
                  Type: {node.spreadsheetId}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
