import { Suspense } from "react";
import type { PreloadedQuery } from "react-relay";
import Chat from "../components/Chat";
import ChatPage from "../pages/ChatPage";
import type { ChatQuery } from "../relay/__generated__/ChatQuery.graphql";
import { PendingState } from "../../../ui/StatusState";

type ChatRouteComponentProps = {
  queryRef: PreloadedQuery<ChatQuery>;
};

export function ChatRouteComponent({ queryRef }: ChatRouteComponentProps) {
  return (
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
  );
}
