import { lazy, Suspense } from "react";
import { RouteErrorBoundary } from "../../app/RouteErrorBoundary";
import { PendingState } from "../../ui/StatusState";

const ProjectReadmePage = lazy(
  () => import("../../features/project-info/pages/ProjectInfoPage"),
);

export function InfoRoute() {
  return (
    <RouteErrorBoundary pathname="/info">
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
    </RouteErrorBoundary>
  );
}
