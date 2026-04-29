import * as statusStyles from "./status.css";
import { Surface } from "./Surface";

type PendingStateProps = {
  eyebrow?: string;
  title: string;
  message?: string;
};

export function PendingState({
  eyebrow = "Loading",
  title,
  message = "The page shell is ready while the remaining assets or data finish loading.",
}: PendingStateProps) {
  return (
    <Surface tone="muted" className={statusStyles.statusPanel} role="status">
      <div>
        <p className={statusStyles.eyebrow}>{eyebrow}</p>
        <h1 className={statusStyles.statusTitle}>{title}</h1>
      </div>
      <p className={statusStyles.statusText}>{message}</p>
    </Surface>
  );
}
