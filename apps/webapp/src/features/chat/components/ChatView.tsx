import { type ReactNode, type Ref } from "react";
import { Surface } from "../../../ui/Surface";
import { cx } from "../../../ui/classNames";
import * as styles from "./Chat.css";

export type ChatStatusTone = "warning" | "danger";

export type ChatViewProps = {
  messageItems: ReactNode;
  composer: ReactNode;
  messagesRef?: Ref<HTMLUListElement>;
  realtimeConnectionMessage?: string | null;
  realtimeConnectionTone?: ChatStatusTone;
};

export function ChatView({
  messageItems,
  composer,
  messagesRef,
  realtimeConnectionMessage = null,
  realtimeConnectionTone,
}: ChatViewProps) {
  const statusClass =
    realtimeConnectionTone === "warning"
      ? styles.chatStatusRetrying
      : realtimeConnectionTone === "danger"
        ? styles.chatStatusDisconnected
        : undefined;

  return (
    <Surface className={styles.chatSurface}>
      <div className={styles.chat}>
        <div className={styles.chatHeader}>
          <h1 className={styles.title}>Anonymous Chat</h1>
          <p className={styles.subtitle}>
            Messages are backed by Relay and GraphQL subscriptions.
          </p>
        </div>
        {realtimeConnectionMessage ? (
          <p
            className={cx(styles.chatStatus, statusClass)}
            role="status"
            aria-live="polite"
          >
            {realtimeConnectionMessage}
          </p>
        ) : null}
        <ul className={styles.messages} ref={messagesRef}>
          {messageItems}
        </ul>
        {composer}
      </div>
    </Surface>
  );
}
