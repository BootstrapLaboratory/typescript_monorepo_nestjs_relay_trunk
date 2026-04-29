import { useState } from "react";
import type { MessageAddFormAddMessageMutation } from "../relay/__generated__/MessageAddFormAddMessageMutation.graphql";
import { useMutation } from "react-relay";
import { appendRootFieldRecordIfMissing } from "../../../shared/relay/store";
import { Button } from "../../../ui/Button";
import { TextField } from "../../../ui/TextField";
import { cx } from "../../../ui/classNames";
import * as styles from "./MessageAddForm.css";
import { MessageAddFormAddMessageMutationNode } from "../relay/MessageAddForm.mutation";

type MessageAddFormProps = {
  disableBecauseLiveUpdatesAreRecovering?: boolean;
  liveUpdatesUnavailableMessage?: string | null;
};

export default function MessageAddForm({
  disableBecauseLiveUpdatesAreRecovering = false,
  liveUpdatesUnavailableMessage = null,
}: MessageAddFormProps) {
  // Set up the mutation
  const [commitAddMessage, isInFlight] =
    useMutation<MessageAddFormAddMessageMutation>(
      MessageAddFormAddMessageMutationNode,
    );

  // Local form state
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Handle form submit
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body) return;
    setSubmitError(null);
    commitAddMessage({
      variables: {
        input: {
          author: author || null,
          body,
        },
      },
      updater: (store) => {
        appendRootFieldRecordIfMissing(store, "addMessage", "getMessages");
      },
      onCompleted: () => {
        setBody("");
      },
      onError: (error) => {
        setSubmitError(
          error.message || "Could not send the message right now.",
        );
      },
    });
  };

  const isSubmitDisabled = isInFlight || disableBecauseLiveUpdatesAreRecovering;

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <TextField
        type="text"
        placeholder="Your name (Optional)"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
      />
      <TextField
        type="text"
        placeholder="Message"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
      />
      <Button type="submit" disabled={isSubmitDisabled}>
        {disableBecauseLiveUpdatesAreRecovering ? "Waiting..." : "Send"}
      </Button>
      {disableBecauseLiveUpdatesAreRecovering ? (
        <p className={styles.note} role="status" aria-live="polite">
          {liveUpdatesUnavailableMessage ??
            "Sending is paused while live updates are unavailable."}
        </p>
      ) : null}
      {submitError ? (
        <p className={cx(styles.note, styles.errorNote)} role="alert">
          Could not send the message. {submitError}
        </p>
      ) : null}
    </form>
  );
}
