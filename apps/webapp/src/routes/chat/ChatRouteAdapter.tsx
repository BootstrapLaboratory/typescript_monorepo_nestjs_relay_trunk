import { useLoaderData } from "@tanstack/react-router";
import { ChatRoute } from "./ChatRoute";

export function ChatRouteAdapter() {
  const { queryRef } = useLoaderData({ from: "/" });

  return <ChatRoute queryRef={queryRef} />;
}
