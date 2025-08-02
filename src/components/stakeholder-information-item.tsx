"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface StakeholderInformationItemProps {
  title: string;
  value: string;
  placeholder: string;
}

/**
 * Component for displaying a single stakeholder information item
 * Contains a title and read-only text area showing the AI-set content
 */
export function StakeholderInformationItem({ 
  title, 
  value, 
  placeholder 
}: StakeholderInformationItemProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{title}</Label>
      <Textarea
        value={value}
        placeholder={placeholder}
        readOnly
        className="min-h-24 resize-none bg-muted/50 cursor-default"
      />
    </div>
  );
}