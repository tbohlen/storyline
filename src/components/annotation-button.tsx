"use client";

import { Button } from "@/components/ui/button";
import { PopoverTrigger } from "@/components/ui/popover";

interface AnnotationButtonProps {
  annotationNumber: number;
  isActive?: boolean;
}

/**
 * Small circular button with a number that shows annotation locations
 * Acts as a PopoverTrigger for the annotation display
 */
export function AnnotationButton({ 
  annotationNumber, 
  isActive = false 
}: AnnotationButtonProps) {
  return (
    <PopoverTrigger asChild>
      <Button
        size="sm"
        variant={isActive ? "default" : "secondary"}
        className="h-6 w-6 p-0 rounded-full text-xs font-medium relative inline-flex items-center justify-center relative -top-1 mx-1"
      >
        {annotationNumber}
      </Button>
    </PopoverTrigger>
  );
}