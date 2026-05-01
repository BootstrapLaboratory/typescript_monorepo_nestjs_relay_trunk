import { Link } from "@tanstack/react-router";
import { Button } from "../../../ui/Button";
import { NotFoundPageView } from "./NotFoundPageView";

export function NotFoundPage() {
  return (
    <NotFoundPageView
      returnAction={
        <Button asChild variant="secondary">
          <Link to="/">Return to chat</Link>
        </Button>
      }
    />
  );
}
