import { MessageSquare } from "lucide-react";

/**
 * Empty state component displayed when chat interface has no messages
 * Shows welcome message and helpful hints to get users started
 * Uses shadcn/ui Card and Typography components for consistent styling
 */
export function ChatInterfaceEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-96 px-4 text-center">
      <div className="mb-6">
        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-muted rounded-full">
          <MessageSquare className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
        <p className="text-muted-foreground max-w-md">
          Chat with AI to create deliverables, then get help preparing to present them to your stakeholders. You might learn something new along the way.
        </p>
      </div>
    </div>
  );
}