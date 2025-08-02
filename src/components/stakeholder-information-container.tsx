"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StakeholderInformationItem } from "./stakeholder-information-item";
import { QuestionsDisplay } from "./questions-display";
import { useClientStore } from "@/lib/store/client-store";

/**
 * Container component for displaying stakeholder information
 * Shows stakeholder info, goals, and questions stacked vertically
 */
export function StakeholderInformationContainer() {
  const { stakeholders, goals, questions } = useClientStore();

  return (
    <Card className="m-4">
      <CardHeader>
        <CardTitle>Stakeholder Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <StakeholderInformationItem
          title="Stakeholders"
          value={stakeholders || ""}
          placeholder="Information about stakeholders will appear here..."
        />
        
        <StakeholderInformationItem
          title="Goals"
          value={goals || ""}
          placeholder="Stakeholder goals will appear here..."
        />
        
        <QuestionsDisplay
          title="Questions"
          content={questions || []}
          placeholder="Anticipated questions will appear here..."
        />
      </CardContent>
    </Card>
  );
}