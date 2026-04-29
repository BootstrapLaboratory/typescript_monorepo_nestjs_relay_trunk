import { graphql } from "react-relay";

export const RefreshMutationNode = graphql`
  mutation RefreshMutation($input: RefreshInput) {
    refresh(input: $input) {
      accessToken
      accessTokenExpiresAt
      refreshToken
      refreshTokenExpiresAt
      principal {
        userId
        subject
        provider
        displayName
        roles
        permissions
      }
    }
  }
`;
