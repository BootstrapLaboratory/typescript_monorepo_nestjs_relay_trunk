import {
  Inject,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import {
  SERVER_AUTH_EVENT_LOGIN_FAILED,
  SERVER_AUTH_EVENT_LOGIN_SUCCEEDED,
  SERVER_AUTH_EVENT_LOGOUT_FAILED,
  SERVER_AUTH_EVENT_LOGOUT_SUCCEEDED,
  SERVER_AUTH_EVENT_REFRESH_FAILED,
  SERVER_AUTH_EVENT_REFRESH_SUCCEEDED,
  SERVER_AUTH_EVENT_REGISTRATION_FAILED,
  SERVER_AUTH_EVENT_REGISTRATION_SUCCEEDED,
  SERVER_AUTH_EVENT_SESSIONS_REVOKE_FAILED,
  SERVER_AUTH_EVENT_SESSIONS_REVOKED,
  createServerAuthLifecycleEvent,
  createServerAuthLifecycleEventDispatcher,
  type Principal,
  type ServerAuthLifecycleEvent,
  type ServerAuthLifecycleEventDispatcher,
  type ServerAuthLifecycleEventHandler,
  type ServerAuthLifecycleEventMetadata,
  type ServerAuthLoginFailedEvent,
  type ServerAuthLoginSucceededEvent,
  type ServerAuthLogoutFailedEvent,
  type ServerAuthLogoutSucceededEvent,
  type ServerAuthRefreshFailedEvent,
  type ServerAuthRefreshSucceededEvent,
  type ServerAuthRegistrationFailedEvent,
  type ServerAuthRegistrationSucceededEvent,
  type ServerAuthSessionsRevokeFailedEvent,
  type ServerAuthSessionsRevokedEvent,
} from '@omgjs/labkit-server-auth';
import {
  logStructuredEvent,
  type StructuredLogDetails,
  type StructuredLogLevel,
} from '@omgjs/labkit-server-observability';

export const AUTH_LIFECYCLE_EVENT_HANDLERS = Symbol(
  'identity:auth-lifecycle-event-handlers',
);

export type AuthLifecycleEventHandler =
  ServerAuthLifecycleEventHandler<ServerAuthLifecycleEvent>;

@Injectable()
export class AuthLifecycleService {
  private readonly logger = new Logger(AuthLifecycleService.name);
  private readonly dispatchEvent: ServerAuthLifecycleEventDispatcher;

  constructor(
    @Optional()
    @Inject(AUTH_LIFECYCLE_EVENT_HANDLERS)
    eventHandlers?: readonly AuthLifecycleEventHandler[],
  ) {
    const dispatcher = createServerAuthLifecycleEventDispatcher({
      errorPolicy: 'continue',
      handlers: [
        (event) => this.logLifecycleEvent(event),
        ...(eventHandlers ?? []),
      ],
      onHandlerError: ({ error, event, handlerIndex }) => {
        logStructuredEvent(
          this.logger,
          'error',
          'auth_lifecycle_handler_failed',
          {
            authEvent: event.type,
            handlerIndex,
          },
          error,
        );
      },
    });

    this.dispatchEvent = dispatcher;
  }

  loginSucceeded(
    principal: Principal,
    metadata?: ServerAuthLifecycleEventMetadata,
  ): Promise<void> {
    return this.dispatch(
      createServerAuthLifecycleEvent<ServerAuthLoginSucceededEvent>({
        metadata,
        principal,
        type: SERVER_AUTH_EVENT_LOGIN_SUCCEEDED,
      }),
    );
  }

  loginFailed(error: unknown, provider?: string): Promise<void> {
    return this.dispatch(
      createServerAuthLifecycleEvent<ServerAuthLoginFailedEvent>({
        error,
        provider,
        reason: this.getErrorReason(error),
        type: SERVER_AUTH_EVENT_LOGIN_FAILED,
      }),
    );
  }

  registrationSucceeded(
    principal: Principal,
    metadata?: ServerAuthLifecycleEventMetadata,
  ): Promise<void> {
    return this.dispatch(
      createServerAuthLifecycleEvent<ServerAuthRegistrationSucceededEvent>({
        metadata,
        principal,
        type: SERVER_AUTH_EVENT_REGISTRATION_SUCCEEDED,
      }),
    );
  }

  registrationFailed(error: unknown, provider?: string): Promise<void> {
    return this.dispatch(
      createServerAuthLifecycleEvent<ServerAuthRegistrationFailedEvent>({
        error,
        provider,
        reason: this.getErrorReason(error),
        type: SERVER_AUTH_EVENT_REGISTRATION_FAILED,
      }),
    );
  }

  refreshSucceeded(
    principal: Principal,
    metadata?: ServerAuthLifecycleEventMetadata,
  ): Promise<void> {
    return this.dispatch(
      createServerAuthLifecycleEvent<ServerAuthRefreshSucceededEvent>({
        metadata,
        principal,
        type: SERVER_AUTH_EVENT_REFRESH_SUCCEEDED,
      }),
    );
  }

  refreshFailed(error: unknown): Promise<void> {
    return this.dispatch(
      createServerAuthLifecycleEvent<ServerAuthRefreshFailedEvent>({
        error,
        reason: this.getErrorReason(error),
        type: SERVER_AUTH_EVENT_REFRESH_FAILED,
      }),
    );
  }

  logoutSucceeded(
    principal: Principal | null | undefined,
    revoked: boolean,
  ): Promise<void> {
    return this.dispatch(
      createServerAuthLifecycleEvent<ServerAuthLogoutSucceededEvent>({
        metadata: {
          revoked,
        },
        principal: principal ?? undefined,
        type: SERVER_AUTH_EVENT_LOGOUT_SUCCEEDED,
      }),
    );
  }

  logoutFailed(error: unknown, principal?: Principal | null): Promise<void> {
    return this.dispatch(
      createServerAuthLifecycleEvent<ServerAuthLogoutFailedEvent>({
        error,
        provider: principal?.provider,
        reason: this.getErrorReason(error),
        subject: principal?.subject,
        type: SERVER_AUTH_EVENT_LOGOUT_FAILED,
      }),
    );
  }

  sessionsRevoked(principal: Principal): Promise<void> {
    return this.dispatch(
      createServerAuthLifecycleEvent<ServerAuthSessionsRevokedEvent>({
        principal,
        scope: 'principal',
        type: SERVER_AUTH_EVENT_SESSIONS_REVOKED,
      }),
    );
  }

  sessionsRevokeFailed(
    error: unknown,
    principal?: Principal | null,
  ): Promise<void> {
    return this.dispatch(
      createServerAuthLifecycleEvent<ServerAuthSessionsRevokeFailedEvent>({
        error,
        provider: principal?.provider,
        reason: this.getErrorReason(error),
        subject: principal?.subject,
        type: SERVER_AUTH_EVENT_SESSIONS_REVOKE_FAILED,
      }),
    );
  }

  private dispatch(event: ServerAuthLifecycleEvent): Promise<void> {
    return this.dispatchEvent(event);
  }

  private logLifecycleEvent(event: ServerAuthLifecycleEvent): void {
    logStructuredEvent(
      this.logger,
      this.getLogLevel(event),
      event.type,
      this.getLogDetails(event),
      'error' in event ? event.error : undefined,
    );
  }

  private getLogLevel(event: ServerAuthLifecycleEvent): StructuredLogLevel {
    if (this.isExpectedAuthLifecycleFailure(event)) {
      return 'log';
    }

    return event.type.endsWith('.failed') ||
      event.type.endsWith('.revoke-failed')
      ? 'warn'
      : 'log';
  }

  private isExpectedAuthLifecycleFailure(
    event: ServerAuthLifecycleEvent,
  ): boolean {
    if (
      !('error' in event) ||
      !(event.error instanceof UnauthorizedException)
    ) {
      return false;
    }

    return (
      event.type === SERVER_AUTH_EVENT_REFRESH_FAILED ||
      event.type === SERVER_AUTH_EVENT_LOGOUT_FAILED ||
      event.type === SERVER_AUTH_EVENT_SESSIONS_REVOKE_FAILED
    );
  }

  private getLogDetails(event: ServerAuthLifecycleEvent): StructuredLogDetails {
    const details: StructuredLogDetails = {
      occurredAt: event.occurredAt.toISOString(),
    };

    const principal = 'principal' in event ? event.principal : undefined;
    if (principal) {
      details.provider = principal.provider;
      details.subject = principal.subject;
      details.userId = principal.userId;
      if (principal.sessionId) {
        details.sessionId = principal.sessionId;
      }
    }

    if ('provider' in event && typeof event.provider === 'string') {
      details.provider = event.provider;
    }

    if ('subject' in event && typeof event.subject === 'string') {
      details.subject = event.subject;
    }

    if ('reason' in event && typeof event.reason === 'string') {
      details.reason = event.reason;
    }

    if ('scope' in event && typeof event.scope === 'string') {
      details.scope = event.scope;
    }

    if (event.metadata) {
      details.metadata = event.metadata;
    }

    return details;
  }

  private getErrorReason(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
