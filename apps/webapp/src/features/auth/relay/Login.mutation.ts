import { graphql } from "react-relay";

export const LoginMutationNode = graphql`
  mutation LoginMutation($input: LoginInput!) {
    login(input: $input) {
      accessToken
      accessTokenExpiresAt
      refreshToken
      refreshTokenExpiresAt
      principal {
        userId
        subject
        provider
        roles
        permissions
      }
    }
  }
`;
