import * as styles from "./Chat.css";

export type MessageViewProps = {
  author?: string | null;
  body: string;
};

export function MessageView({ author, body }: MessageViewProps) {
  return (
    <li className={styles.message}>
      <span className={styles.messageAuthor}>
        {author?.trim() || "Anonymous"}
      </span>
      <span className={styles.messageBody}>{body}</span>
    </li>
  );
}
