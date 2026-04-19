# Cloud Run Monitoring Setup

This guide covers the monitoring and alerting setup for the deployed Cloud Run
backend.

It is focused on:

- Cloud Run service health via an uptime check
- log-based backend failure alerts for:
  - bootstrap failures
  - database connection failures
  - Redis / pubsub failures

For runtime operations after setup, also see:

- [OPERATIONS.md](OPERATIONS.md)

## What The Helper Scripts Create

The monitoring setup is split into two scripts:

- [create-monitoring-email-channel.sh](../scripts/create-monitoring-email-channel.sh)
  - optional convenience helper
  - creates or reuses one Cloud Monitoring email notification channel
- [setup-monitoring-alerts.sh](../scripts/setup-monitoring-alerts.sh)
  - enables the required Monitoring / Logging APIs
  - creates or updates an uptime check for `https://<cloud-run-service>/health`
  - creates or updates log-based metrics
  - recreates the alert policies so reruns stay idempotent

## Config Inputs

These scripts load:

- [deploy/cloudrun/config/.env](../config/.env)
- [deploy/cloudrun/config/.env.local](../config/.env.local)

Optional monitoring-specific values:

```dotenv
MONITORING_NOTIFICATION_CHANNELS=""
MONITORING_EMAIL_ADDRESS=""
MONITORING_UPTIME_DISPLAY_NAME=""
MONITORING_UPTIME_PATH="/health"
```

Recommended usage:

- if you already have Cloud Monitoring notification channels, set:
  - `MONITORING_NOTIFICATION_CHANNELS`
- if you want one simple email path first, set:
  - `MONITORING_EMAIL_ADDRESS`

`MONITORING_NOTIFICATION_CHANNELS` should be a comma-separated list of channel
resource names or channel IDs. Examples:

```dotenv
MONITORING_NOTIFICATION_CHANNELS="projects/my-project/notificationChannels/1234567890"
```

or:

```dotenv
MONITORING_NOTIFICATION_CHANNELS="1234567890,9876543210"
```

## Step 1: Optional Email Channel

If you want email notifications and don't already have a channel:

```bash
bash deploy/cloudrun/scripts/create-monitoring-email-channel.sh
```

This helper:

- reuses the existing email channel if one already exists for the same address
- otherwise creates it
- prints the Cloud Monitoring `verificationStatus`

Important:

- email channels can require verification before they deliver alerts reliably
- if the channel is not verified yet, finish the verification flow from the
  email inbox first

## Step 2: Create Or Update Monitoring Resources

Run:

```bash
bash deploy/cloudrun/scripts/setup-monitoring-alerts.sh
```

This creates or updates:

- one uptime check for the current Cloud Run service `/health` endpoint
- log-based metrics:
  - `cloudrun_backend_bootstrap_failures`
  - `cloudrun_backend_database_failures`
  - `cloudrun_backend_redis_pubsub_failures`
- alert policies:
  - `<service> Cloud Run health`
  - `<service> backend critical failures`

If notification channels are configured, they are attached to those policies.

If no notification channels are configured:

- the alert policies are still created
- incidents still show up in Cloud Monitoring
- no external email / Slack / webhook notifications are sent yet

## What Each Alert Covers

### Cloud Run Health

The uptime-check alert watches:

- `https://<service-url>/health`

This catches:

- service unavailability
- unhealthy revisions that stop serving correctly
- many crash-loop style failures from the outside-in

### Backend Critical Failures

The log-based alert watches for these structured backend events:

- `app_bootstrap_failed`
- `database_connect_failed`
- `redis_client_error`
- `chat_pubsub_init_failed`
- `chat_pubsub_publish_failed`
- `chat_pubsub_deliver_failed`
- `chat_pubsub_deliver_parse_failed`

That gives you direct visibility into:

- Cloud Run startup failures
- Neon connection / availability problems as seen by the app
- Redis / pubsub operational failures

## List What Was Created

Load the shared config first:

```bash
source deploy/cloudrun/scripts/load-env.sh
```

List uptime checks:

```bash
gcloud monitoring uptime list-configs --project "${PROJECT_ID}"
```

List log-based metrics:

```bash
gcloud logging metrics list --project "${PROJECT_ID}"
```

List alert policies:

```bash
gcloud monitoring policies list --project "${PROJECT_ID}"
```

List notification channels:

```bash
gcloud beta monitoring channels list --project "${PROJECT_ID}"
```

## Cleanup Or Recreate

The setup script is designed to be safe to rerun:

- uptime check: create once, then update
- log-based metrics: create once, then update
- alert policies: delete matching display names, then recreate

If you later change your notification channels:

1. update `MONITORING_NOTIFICATION_CHANNELS` or `MONITORING_EMAIL_ADDRESS`
2. rerun:

```bash
bash deploy/cloudrun/scripts/setup-monitoring-alerts.sh
```

## Practical Validation

After setup, a good lightweight validation is:

1. Confirm the uptime check exists and shows green.
2. Confirm the two alert policies exist.
3. If you attached an email channel, verify it is marked verified.
4. Open [OPERATIONS.md](OPERATIONS.md) and run one of the log queries so you
   know where to look when an incident opens.

I do not recommend forcing a real production outage just to test alerts unless
you specifically want an end-to-end notification drill.

## Official Docs

- Create public uptime checks:
  https://cloud.google.com/monitoring/uptime-checks
- Create alerting policies for uptime checks:
  https://docs.cloud.google.com/monitoring/uptime-checks/uptime-alerting-policies
- Sample alerting policies in JSON:
  https://docs.cloud.google.com/monitoring/alerts/policies-in-json
- Log-based metrics overview:
  https://docs.cloud.google.com/logging/docs/logs-based-metrics
- Configure notifications for log-based metrics:
  https://docs.cloud.google.com/logging/docs/logs-based-metrics/charts-and-alerts
- Create and manage notification channels by API / CLI:
  https://docs.cloud.google.com/monitoring/alerts/using-channels-api
