import { extractBearerToken } from './bearer-token';

describe('extractBearerToken', () => {
  it('returns a bearer token from a single authorization header', () => {
    expect(extractBearerToken('Bearer access-token')).toBe('access-token');
  });

  it('uses the first header value when multiple values are present', () => {
    expect(
      extractBearerToken(['Bearer first-token', 'Bearer second-token']),
    ).toBe('first-token');
  });

  it('returns null for missing or non-bearer authorization headers', () => {
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken('Basic access-token')).toBeNull();
    expect(extractBearerToken('Bearer')).toBeNull();
  });
});
