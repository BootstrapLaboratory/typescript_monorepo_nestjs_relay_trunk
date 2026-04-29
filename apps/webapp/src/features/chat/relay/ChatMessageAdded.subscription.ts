import { graphql } from "react-relay";

export const ChatMessageAddedSubscriptionNode = graphql`
  subscription ChatMessageAddedSubscription {
    MessageAdded {
      id
      ...Message_item
    }
  }
`;
