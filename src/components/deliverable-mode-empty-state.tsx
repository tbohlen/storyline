import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Deliverable Mode Empty State component
 * Shows information about deliverable mode and its benefits
 */
export function DeliverableModeEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <Card className="w-full max-w-md mb-6">
        <CardHeader className="text-center">
          <CardTitle>Deliverable Mode</CardTitle>
          <CardDescription>
            Prepare to confidently share your work with stakeholders and become an expert in your deliverable
          </CardDescription>
        </CardHeader>
      </Card>
      
      <div className="w-full max-w-md space-y-4">
        <div>
          <h3 className="font-medium mb-2">How it works</h3>
          <ol className="text-sm text-muted-foreground space-y-1">
            <li>1. Create your deliverable with AI assistance</li>
            <li>2. Identify stakeholders and anticipate their questions</li>
            <li>3. Study key decisions and practice your presentation</li>
          </ol>
        </div>

        <div className="pt-2 border-t">
          <p className="text-sm text-muted-foreground">
            Start by asking the AI to help you create a report, presentation, or any other deliverable.
          </p>
        </div>
      </div>
    </div>
  );
}