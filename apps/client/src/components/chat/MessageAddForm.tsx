import { useState } from "react";
import type { MessageAddFormAddMessageMutation } from "./__generated__/MessageAddFormAddMessageMutation.graphql";
import { graphql, useMutation } from "react-relay";
import { appendRootFieldRecordIfMissing } from "./store";

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
    useMutation<MessageAddFormAddMessageMutation>(graphql`
      mutation MessageAddFormAddMessageMutation($input: NewMessageInput!) {
        addMessage(newMessageData: $input) {
          id
          author
          body
        }
      }
    `);

  // Local form state
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");

  // Handle form submit
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body) return;
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
    });
    setBody("");
  };

  const isSubmitDisabled =
    isInFlight || disableBecauseLiveUpdatesAreRecovering;

  return (
    <form onSubmit={onSubmit}>
      <input
        type="text"
        placeholder="Your name (Optional)"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
      />
      <input
        type="text"
        placeholder="Message"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
      />
      <button type="submit" disabled={isSubmitDisabled}>
        {disableBecauseLiveUpdatesAreRecovering ? "Waiting..." : "Send"}
      </button>
      {disableBecauseLiveUpdatesAreRecovering ? (
        <p className="chat-form-note" role="status" aria-live="polite">
          {liveUpdatesUnavailableMessage ??
            "Sending is paused while live updates are unavailable."}
        </p>
      ) : null}
    </form>
  );
}
