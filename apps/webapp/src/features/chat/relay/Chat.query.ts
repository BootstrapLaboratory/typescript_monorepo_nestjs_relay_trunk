import { graphql } from "react-relay";

export const ChatQueryNode = graphql`
  query ChatQuery {
    getMessages {
      id
      ...Message_item
    }
  }
`;
