"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface QuestionsDisplayProps {
  title: string;
  content: string[];
  placeholder: string;
}

/**
 * Component for displaying multiple questions from an array
 * Formats questions as a numbered list in a read-only text area
 */
export function QuestionsDisplay({ 
  title, 
  content, 
  placeholder 
}: QuestionsDisplayProps) {
  // Format the questions array into a readable string
  const formattedContent = content.length > 0 
    ? content.map((question, index) => `${index + 1}. ${question}`).join('\n\n')
    : '';

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{title}</Label>
      <Textarea
        value={formattedContent}
        placeholder={placeholder}
        readOnly
        className="min-h-32 resize-none bg-muted/50 cursor-default"
      />
    </div>
  );
}