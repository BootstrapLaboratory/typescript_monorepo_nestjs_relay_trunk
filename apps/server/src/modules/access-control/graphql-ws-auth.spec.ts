import { extractGraphqlWsAuthorization } from './graphql-ws-auth';

describe('extractGraphqlWsAuthorization', () => {
  it('reads common authorization connection params', () => {
    expect(
      extractGraphqlWsAuthorization({
        authorization: 'Bearer access-token',
      }),
    ).toBe('Bearer access-token');

    expect(
      extractGraphqlWsAuthorization({
        Authorization: 'Bearer access-token',
      }),
    ).toBe('Bearer access-token');
  });

  it('supports accessToken connection params', () => {
    expect(
      extractGraphqlWsAuthorization({
        accessToken: 'access-token',
      }),
    ).toBe('Bearer access-token');
  });

  it('ignores missing or non-string connection params', () => {
    expect(extractGraphqlWsAuthorization(undefined)).toBeUndefined();
    expect(
      extractGraphqlWsAuthorization({
        accessToken: 123,
        authorization: ['Bearer access-token'],
      }),
    ).toBeUndefined();
  });
});
