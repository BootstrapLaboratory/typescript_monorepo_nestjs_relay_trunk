import { useState } from "react";
import type { MessageAddFormAddMessageMutation } from "../relay/__generated__/MessageAddFormAddMessageMutation.graphql";
import { useMutation } from "react-relay";
import {
  getPrincipalDisplayName,
  useAuthState,
} from "../../../shared/auth/session";
import { appendRootFieldRecordIfMissing } from "../../../shared/relay/store";
import { MessageAddFormAddMessageMutationNode } from "../relay/MessageAddForm.mutation";
import { MessageAddFormView } from "./MessageAddFormView";

type MessageAddFormProps = {
  disableBecauseLiveUpdatesAreRecovering?: boolean;
  liveUpdatesUnavailableMessage?: string | null;
};

export default function MessageAddForm({
  disableBecauseLiveUpdatesAreRecovering = false,
  liveUpdatesUnavailableMessage = null,
}: MessageAddFormProps) {
  const authState = useAuthState();
  // Set up the mutation
  const [commitAddMessage, isInFlight] =
    useMutation<MessageAddFormAddMessageMutation>(
      MessageAddFormAddMessageMutationNode,
    );

  // Local form state
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const authenticatedAuthor =
    authState.status === "authenticated"
      ? getPrincipalDisplayName(authState.session.principal)
      : null;
  const authorValue = authenticatedAuthor ?? author;

  function handleSubmit() {
    if (!body) return;
    setSubmitError(null);
    commitAddMessage({
      variables: {
        input: {
          author: authorValue || null,
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
  }

  return (
    <MessageAddFormView
      authorValue={authorValue}
      bodyValue={body}
      isAuthorLocked={authenticatedAuthor !== null}
      isSubmitting={isInFlight}
      disableBecauseLiveUpdatesAreRecovering={
        disableBecauseLiveUpdatesAreRecovering
      }
      liveUpdatesUnavailableMessage={liveUpdatesUnavailableMessage}
      submitError={submitError}
      onAuthorChange={setAuthor}
      onBodyChange={setBody}
      onSubmit={handleSubmit}
    />
  );
}
