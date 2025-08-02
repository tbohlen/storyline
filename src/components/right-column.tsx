import { useClientStore } from "@/lib/store/client-store";
import { Deliverable } from "./deliverable";
import { DeliverableModeEmptyState } from "./deliverable-mode-empty-state";
import { StakeholderInformationContainer } from "./stakeholder-information-container";

/**
 * Right Column component that displays different content based on workflow step
 * - Step 1: Deliverable or empty state
 * - Steps 2-4: Stakeholder information container
 * - Steps 5-6: Deliverable for studying and practice
 */
export function RightColumn() {
  const { deliverable, workflowStep } = useClientStore();

  const renderContent = () => {
    if (!workflowStep) {
      return null;
    }

    // Steps 2-4: Show stakeholder information during stakeholder identification phases
    if (workflowStep.order >= 2 && workflowStep.order <= 4) {
      return <StakeholderInformationContainer />;
    }

    // Steps 1, 5-6: Show deliverable when available, otherwise empty state
    return deliverable ? (
      <Deliverable deliverable={deliverable} />
    ) : (
      <DeliverableModeEmptyState />
    );
  };

  return (
    <div className="w-1 border-l bg-muted/30 overflow-y-auto h-full w-full">
      {renderContent()}
    </div>
  );
}