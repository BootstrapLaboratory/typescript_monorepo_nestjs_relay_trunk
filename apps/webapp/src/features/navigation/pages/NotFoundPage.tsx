import { Link } from "@tanstack/react-router";
import { Button } from "../../../ui/Button";
import { Surface } from "../../../ui/Surface";
import * as statusStyles from "../../../ui/status.css";

export function NotFoundPage() {
  return (
    <Surface tone="muted" className={statusStyles.statusPanel}>
      <div>
        <p className={statusStyles.eyebrow}>Page not found</p>
        <h1 className={statusStyles.statusTitle}>Unknown route</h1>
      </div>
      <p className={statusStyles.statusText}>
        This example web app currently exposes the chat page and the
        README-backed info page.
      </p>
      <div>
        <Button asChild variant="secondary">
          <Link to="/">Return to chat</Link>
        </Button>
      </div>
    </Surface>
  );
}
