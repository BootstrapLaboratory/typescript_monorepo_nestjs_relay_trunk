import { type FormEvent } from "react";
import { Button } from "../../../ui/Button";
import { TextField } from "../../../ui/TextField";
import { cx } from "../../../ui/classNames";
import * as styles from "./MessageAddForm.css";

export type MessageAddFormViewProps = {
  authorValue: string;
  bodyValue: string;
  isAuthorLocked: boolean;
  isSubmitting: boolean;
  disableBecauseLiveUpdatesAreRecovering?: boolean;
  liveUpdatesUnavailableMessage?: string | null;
  submitError?: string | null;
  onAuthorChange: (author: string) => void;
  onBodyChange: (body: string) => void;
  onSubmit: () => void;
};

export function MessageAddFormView({
  authorValue,
  bodyValue,
  isAuthorLocked,
  isSubmitting,
  disableBecauseLiveUpdatesAreRecovering = false,
  liveUpdatesUnavailableMessage = null,
  submitError = null,
  onAuthorChange,
  onBodyChange,
  onSubmit,
}: MessageAddFormViewProps) {
  const isSubmitDisabled = isSubmitting || disableBecauseLiveUpdatesAreRecovering;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form className={styles.form} aria-busy={isSubmitting} onSubmit={handleSubmit}>
      <TextField
        type="text"
        placeholder="Your name (Optional)"
        value={authorValue}
        disabled={isAuthorLocked}
        onChange={(event) => onAuthorChange(event.target.value)}
      />
      <TextField
        type="text"
        placeholder="Message"
        value={bodyValue}
        onChange={(event) => onBodyChange(event.target.value)}
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
