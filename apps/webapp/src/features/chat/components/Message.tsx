import { graphql, useFragment } from "react-relay";
import type { Message_item$key } from "./__generated__/Message_item.graphql";
import * as styles from "./Chat.css";

export default function MessageItem(props: { message: Message_item$key }) {
  const message = useFragment<Message_item$key>(
    graphql`
      fragment Message_item on Message {
        author
        body
      }
    `,
    props.message,
  );

  return (
    <li className={styles.message}>
      <span className={styles.messageAuthor}>
        {message.author ?? "Anonymous"}
      </span>
      <span className={styles.messageBody}>{message.body}</span>
    </li>
  );
}
