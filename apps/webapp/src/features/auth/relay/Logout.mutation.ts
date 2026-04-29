import { graphql } from "react-relay";

export const LogoutMutationNode = graphql`
  mutation LogoutMutation($input: RefreshInput) {
    logout(input: $input)
  }
`;
