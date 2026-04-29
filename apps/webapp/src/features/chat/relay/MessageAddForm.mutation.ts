import { graphql } from "react-relay";

export const MessageAddFormAddMessageMutationNode = graphql`
  mutation MessageAddFormAddMessageMutation($input: NewMessageInput!) {
    addMessage(newMessageData: $input) {
      id
      author
      body
    }
  }
`;
