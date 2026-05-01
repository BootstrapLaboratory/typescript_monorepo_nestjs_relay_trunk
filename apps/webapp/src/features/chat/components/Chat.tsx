import {
  usePreloadedQuery,
  useSubscription,
  type PreloadedQuery,
} from "react-relay";
import MessageItem from "./Message";
import MessageAddForm from "./MessageAddForm";
import { useLayoutEffect, useMemo, useRef } from "react";
import type { ChatQuery } from "../relay/__generated__/ChatQuery.graphql";
import type { ChatMessageAddedSubscription } from "../relay/__generated__/ChatMessageAddedSubscription.graphql";
import type { GraphQLSubscriptionConfig } from "relay-runtime";
import { appendRootFieldRecordIfMissing } from "../../../shared/relay/store";
import {
  getRealtimeConnectionMessage,
  type GraphqlWsConnectionStatus,
  useRealtimeConnectionState,
} from "../../../shared/realtime/realtime-connection";
import { ChatPageQuery } from "../relay/Chat.query";
import { ChatMessageAddedSubscriptionNode } from "../relay/ChatMessageAdded.subscription";
import { ChatView, type ChatStatusTone } from "./ChatView";

type ChatProps = {
  queryRef: PreloadedQuery<ChatQuery>;
};

function getChatStatusTone(
  status: GraphqlWsConnectionStatus,
): ChatStatusTone | undefined {
  if (status === "retrying") {
    return "warning";
  }

  if (status === "disconnected") {
    return "danger";
  }

  return undefined;
}

export default function Chat({ queryRef }: ChatProps) {
  const data = usePreloadedQuery<ChatQuery>(ChatPageQuery, queryRef);
  const messagesRef = useRef<HTMLUListElement>(null);

  const messages = data.getMessages?.filter((m) => m != null) ?? [];
  const lastMessageId = messages[messages.length - 1]?.id ?? null;
  const realtimeConnectionState = useRealtimeConnectionState();
  const realtimeConnectionMessage = getRealtimeConnectionMessage(
    realtimeConnectionState,
  );
  const disableSendBecauseLiveUpdatesAreRecovering =
    !realtimeConnectionState.browserOnline ||
    realtimeConnectionState.status === "retrying" ||
    realtimeConnectionState.status === "disconnected";

  const subscriptionConfig = useMemo<
    GraphQLSubscriptionConfig<ChatMessageAddedSubscription>
  >(
    () => ({
      subscription: ChatMessageAddedSubscriptionNode,
      variables: {},
      updater: (store) => {
        appendRootFieldRecordIfMissing(store, "MessageAdded", "getMessages");
      },
    }),
    [],
  );

  useSubscription<ChatMessageAddedSubscription>(subscriptionConfig);

  useLayoutEffect(() => {
    const messagesElement = messagesRef.current;
    if (!messagesElement) {
      return;
    }

    messagesElement.scrollTop = messagesElement.scrollHeight;
  }, [messages.length, lastMessageId]);

  return (
    <ChatView
      messagesRef={messagesRef}
      realtimeConnectionMessage={realtimeConnectionMessage}
      realtimeConnectionTone={getChatStatusTone(realtimeConnectionState.status)}
      messageItems={
        <>
          {messages.map((msg) => (
            <MessageItem key={msg.id} message={msg} />
          ))}
        </>
      }
      composer={
        <MessageAddForm
          disableBecauseLiveUpdatesAreRecovering={
            disableSendBecauseLiveUpdatesAreRecovering
          }
          liveUpdatesUnavailableMessage={realtimeConnectionMessage}
        />
      }
    />
  );
}
