import { graphql } from "react-relay";

export const ChatPageQuery = graphql`
  query ChatQuery {
    getMessages {
      id
      ...Message_item
    }
  }
`;
