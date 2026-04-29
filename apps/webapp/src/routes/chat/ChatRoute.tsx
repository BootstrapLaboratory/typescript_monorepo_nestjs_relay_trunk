import { Suspense } from "react";
import type { PreloadedQuery } from "react-relay";
import type { ChatQuery } from "../../features/chat/relay/__generated__/ChatQuery.graphql";
import Chat from "../../features/chat/components/Chat";
import ChatPage from "../../features/chat/pages/ChatPage";
import { RouteErrorBoundary } from "../../app/RouteErrorBoundary";
import { PendingState } from "../../ui/StatusState";

type ChatRouteProps = {
  queryRef: PreloadedQuery<ChatQuery>;
};

export function ChatRoute({ queryRef }: ChatRouteProps) {
  return (
    <RouteErrorBoundary pathname="/">
      <ChatPage
        chat={
          <Suspense
            fallback={
              <PendingState
                eyebrow="Loading chat"
                title="Connecting to messages"
                message="The route has switched already. Messages will appear as soon as Relay finishes the query."
              />
            }
          >
            <Chat queryRef={queryRef} />
          </Suspense>
        }
      />
    </RouteErrorBoundary>
  );
}
