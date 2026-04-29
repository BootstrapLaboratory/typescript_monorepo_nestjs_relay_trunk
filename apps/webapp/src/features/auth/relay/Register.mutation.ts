import { graphql } from "react-relay";

export const RegisterMutationNode = graphql`
  mutation RegisterMutation($input: RegisterInput!) {
    register(input: $input) {
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
