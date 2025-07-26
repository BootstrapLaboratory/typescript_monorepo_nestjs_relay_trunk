import type { ChatQuery } from "./__generated__/ChatQuery.graphql";
import { graphql, useLazyLoadQuery, useSubscription } from "react-relay";
import MessageItem from "./Message";
import MessageAddForm from "./MessageAddForm";
import { useMemo } from "react";
import type { ChatMessageAddedSubscription } from "./__generated__/ChatMessageAddedSubscription.graphql";
import type { GraphQLSubscriptionConfig } from "relay-runtime";

export default function Chat() {
  const data = useLazyLoadQuery<ChatQuery>(
    graphql`
      query ChatQuery {
        getMessages {
          id
          ...Message_item
        }
      }
    `,
    {},
  );

  const messages = data?.getMessages?.filter((m) => m != null);

  const subscriptionConfig: GraphQLSubscriptionConfig<ChatMessageAddedSubscription> =
    {
      subscription: graphql`
        subscription ChatMessageAddedSubscription {
          MessageAdded {
            id
            ...Message_item
          }
        }
      `,
      variables: {}, // now {} is the exact type Record<PropertyKey,never>
      updater: (store) => {
        const root = store.getRoot();
        const existing = root.getLinkedRecords("getMessages") ?? [];
        const incoming = store.getRootField("MessageAdded");
        if (incoming) {
          root.setLinkedRecords([...existing, incoming], "getMessages");
        }
      },
    };
  const subscriptionConfigMemo = useMemo(
    () => subscriptionConfig,
    [], // empty deps → same object forever
  );

  useSubscription<ChatMessageAddedSubscription>(subscriptionConfigMemo);

  return (
    <div className="card">
      <div className="chat">
        <h1>Anonymous Chat</h1>
        <ul className="messages">
          {messages.map((msg) => (
            <MessageItem key={msg.id} message={msg} />
          ))}
        </ul>
        <MessageAddForm />
      </div>
    </div>
  );
}
