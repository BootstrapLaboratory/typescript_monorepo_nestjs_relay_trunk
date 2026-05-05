import { lazy, Suspense } from "react";
import { PendingState } from "../../../ui/StatusState";

const ProjectReadmePage = lazy(() => import("../pages/ProjectInfoPage"));

export function InfoRouteComponent() {
  return (
    <Suspense
      fallback={
        <PendingState
          eyebrow="Loading docs"
          title="Preparing the project guide"
          message="The documentation bundle loads separately so the chat page stays lighter on first visit."
        />
      }
    >
      <ProjectReadmePage />
    </Suspense>
  );
}
