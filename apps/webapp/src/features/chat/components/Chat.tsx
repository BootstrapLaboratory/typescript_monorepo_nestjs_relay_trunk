import {
  usePreloadedQuery,
  useSubscription,
  type PreloadedQuery,
} from "react-relay";
import MessageItem from "./Message";
import MessageAddForm from "./MessageAddForm";
import { useMemo } from "react";
import type { ChatQuery } from "../relay/__generated__/ChatQuery.graphql";
import type { ChatMessageAddedSubscription } from "../relay/__generated__/ChatMessageAddedSubscription.graphql";
import type { GraphQLSubscriptionConfig } from "relay-runtime";
import { appendRootFieldRecordIfMissing } from "../../../shared/relay/store";
import {
  getRealtimeConnectionMessage,
  useRealtimeConnectionState,
} from "../../../shared/realtime/realtime-connection";
import { Surface } from "../../../ui/Surface";
import { cx } from "../../../ui/classNames";
import * as styles from "./Chat.css";
import { ChatPageQuery } from "../relay/Chat.query";
import { ChatMessageAddedSubscriptionNode } from "../relay/ChatMessageAdded.subscription";

type ChatProps = {
  queryRef: PreloadedQuery<ChatQuery>;
};

export default function Chat({ queryRef }: ChatProps) {
  const data = usePreloadedQuery<ChatQuery>(ChatPageQuery, queryRef);

  const messages = data.getMessages?.filter((m) => m != null) ?? [];
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

  const statusClass =
    realtimeConnectionState.status === "retrying"
      ? styles.chatStatusRetrying
      : realtimeConnectionState.status === "disconnected"
        ? styles.chatStatusDisconnected
        : undefined;

  return (
    <Surface tone="raised" className={styles.chatSurface}>
      <div className={styles.chat}>
        <h1 className={styles.title}>Anonymous Chat</h1>
        {realtimeConnectionMessage ? (
          <p
            className={cx(styles.chatStatus, statusClass)}
            role="status"
            aria-live="polite"
          >
            {realtimeConnectionMessage}
          </p>
        ) : null}
        <ul className={styles.messages}>
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
    </Surface>
  );
}
