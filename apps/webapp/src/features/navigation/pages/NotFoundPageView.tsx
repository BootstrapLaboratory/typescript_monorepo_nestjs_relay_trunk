import { type ReactNode } from "react";
import { Surface } from "../../../ui/Surface";
import * as statusStyles from "../../../ui/status.css";

export type NotFoundPageViewProps = {
  returnAction: ReactNode;
};

export function NotFoundPageView({ returnAction }: NotFoundPageViewProps) {
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
      <div>{returnAction}</div>
    </Surface>
  );
}
