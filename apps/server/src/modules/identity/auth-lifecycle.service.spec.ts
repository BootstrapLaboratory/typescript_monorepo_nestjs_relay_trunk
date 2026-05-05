import { Logger, UnauthorizedException } from '@nestjs/common';
import {
  SERVER_AUTH_EVENT_REFRESH_FAILED,
  SERVER_AUTH_EVENT_LOGIN_SUCCEEDED,
  SERVER_AUTH_EVENT_REFRESH_SUCCEEDED,
  type Principal,
  type ServerAuthLifecycleEvent,
} from '@omgjs/labkit-server-auth';
import { AuthLifecycleService } from './auth-lifecycle.service';

const principal: Principal = {
  permissions: ['chat:read'],
  provider: 'local',
  roles: ['user'],
  sessionId: 'session-1',
  subject: 'local:user-1',
  userId: 'user-1',
};

describe('AuthLifecycleService', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('dispatches secret-free success events to app handlers', async () => {
    const events: ServerAuthLifecycleEvent[] = [];
    const service = new AuthLifecycleService([
      (event) => {
        events.push(event);
      },
    ]);

    await service.loginSucceeded(principal);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      principal,
      type: SERVER_AUTH_EVENT_LOGIN_SUCCEEDED,
    });
    expect(events[0]?.occurredAt).toBeInstanceOf(Date);
    expect(logSpy).toHaveBeenCalledTimes(1);

    const logMessage = String(logSpy.mock.calls[0]?.[0]);
    expect(logMessage).toContain('server-auth.login.succeeded');
    expect(logMessage).not.toContain('accessToken');
    expect(logMessage).not.toContain('refreshToken');
  });

  it('continues app handlers after handler failures', async () => {
    const calls: string[] = [];
    const service = new AuthLifecycleService([
      () => {
        calls.push('first');
        throw new Error('handler failed');
      },
      (event) => {
        calls.push(`second:${event.type}`);
      },
    ]);

    await service.refreshSucceeded(principal);

    expect(calls).toEqual([
      'first',
      `second:${SERVER_AUTH_EVENT_REFRESH_SUCCEEDED}`,
    ]);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('logs expected refresh authorization failures at log level', async () => {
    const service = new AuthLifecycleService();

    await service.refreshFailed(
      new UnauthorizedException('Refresh token has been revoked'),
    );

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();

    const logMessage = String(logSpy.mock.calls[0]?.[0]);
    expect(logMessage).toContain(SERVER_AUTH_EVENT_REFRESH_FAILED);
    expect(logMessage).toContain('Refresh token has been revoked');
  });

  it('logs expected logout authorization failures at log level', async () => {
    const service = new AuthLifecycleService();

    await service.logoutFailed(
      new UnauthorizedException('Refresh token cookie is required'),
      null,
    );

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('keeps unexpected refresh failures at warn level', async () => {
    const service = new AuthLifecycleService();

    await service.refreshFailed(new Error('database unavailable'));

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
