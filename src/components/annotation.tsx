"use client";

import { Button } from "@/components/ui/button";
import { PopoverContent } from "@/components/ui/popover";
import { Annotation as AnnotationType } from "@/lib/types/annotation";

interface AnnotationProps {
  annotation: AnnotationType;
  onClose?: () => void;
}

/**
 * Expandable text box that displays annotation details
 * Shows over the deliverable display as a popover
 */
export function Annotation({ annotation, onClose }: AnnotationProps) {
  return (
    <PopoverContent className="w-80 p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm">{annotation.title}</h4>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 rounded-full hover:bg-muted"
            onClick={onClose}
          >
            ×
          </Button>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {annotation.description}
        </p>
      </div>
    </PopoverContent>
  );
}