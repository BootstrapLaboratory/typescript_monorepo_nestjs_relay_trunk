import type { ChatQuery } from "./__generated__/ChatQuery.graphql";
import { graphql, useLazyLoadQuery, useSubscription } from "react-relay";
import MessageItem from "./Message";
import MessageAddForm from "./MessageAddForm";
import { useMemo } from "react";
import type { ChatMessageAddedSubscription } from "./__generated__/ChatMessageAddedSubscription.graphql";
import type { GraphQLSubscriptionConfig } from "relay-runtime";
import { appendRootFieldRecordIfMissing } from "./store";
import {
  getRealtimeConnectionMessage,
  useRealtimeConnectionState,
} from "../../realtime-connection";

export default function Chat() {
  const data = useLazyLoadQuery<ChatQuery>(
    graphql`
      query ChatQuery {
        getMessages {
          id
          ...Message_item
        }
      }
    `,
    {},
  );

  const messages = data?.getMessages?.filter((m) => m != null);
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
      subscription: graphql`
        subscription ChatMessageAddedSubscription {
          MessageAdded {
            id
            ...Message_item
          }
        }
      `,
      variables: {},
      updater: (store) => {
        appendRootFieldRecordIfMissing(store, "MessageAdded", "getMessages");
      },
    }),
    [],
  );

  useSubscription<ChatMessageAddedSubscription>(subscriptionConfig);

  return (
    <div className="card">
      <div className="chat">
        <h1>Anonymous Chat</h1>
        {realtimeConnectionMessage ? (
          <p
            className={`chat-status chat-status--${realtimeConnectionState.status}`}
            role="status"
            aria-live="polite"
          >
            {realtimeConnectionMessage}
          </p>
        ) : null}
        <ul className="messages">
          {messages.map((msg) => (
            <MessageItem key={msg.id} message={msg} />
          ))}
        </ul>
        <MessageAddForm
          disableBecauseLiveUpdatesAreRecovering={
            disableSendBecauseLiveUpdatesAreRecovering
          }
          liveUpdatesUnavailableMessage={realtimeConnectionMessage}
        />
      </div>
    </div>
  );
}
