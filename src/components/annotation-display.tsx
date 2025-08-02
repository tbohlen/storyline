"use client";

import { Popover } from "@/components/ui/popover";
import { AnnotationButton } from "./annotation-button";
import { Annotation } from "./annotation";
import { Annotation as AnnotationType } from "@/lib/types/annotation";
import { useClientStore } from "@/lib/store/client-store";

interface AnnotationDisplayProps {
  annotation: AnnotationType;
  annotationNumber: number;
}

/**
 * Complete annotation display component that combines the button and popover
 * Uses selectedAnnotation store for state management
 */
export function AnnotationDisplay({ 
  annotation, 
  annotationNumber 
}: AnnotationDisplayProps) {
  const { selectedAnnotation, setSelectedAnnotation } = useClientStore();
  const isOpen = selectedAnnotation?.id === annotation.id;

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setSelectedAnnotation(annotation);
    } else {
      setSelectedAnnotation(null);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <AnnotationButton 
        annotationNumber={annotationNumber}
        isActive={isOpen}
      />
      <Annotation 
        annotation={annotation} 
        onClose={() => setSelectedAnnotation(null)}
      />
    </Popover>
  );
}