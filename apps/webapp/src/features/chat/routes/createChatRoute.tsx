import type { ChatQuery } from "../relay/__generated__/ChatQuery.graphql";
import { ChatQueryNode } from "../relay/Chat.query";
import { createRelayQueryRoute } from "../../../app/routing/createRelayQueryRoute";
import type { AppRouteParent } from "../../../app/router-context";
import { ChatRouteComponent } from "./ChatRouteComponent";

export function createChatRoute(parentRoute: AppRouteParent) {
  return createRelayQueryRoute<"/", ChatQuery>({
    document: ChatQueryNode,
    variables: {},
    fetchPolicy: "store-or-network",
    parentRoute,
    path: "/",
    gcTime: 0,
    render: (queryRef) => <ChatRouteComponent queryRef={queryRef} />,
  });
}
