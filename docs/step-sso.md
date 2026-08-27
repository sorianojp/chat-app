# STEP v2 SSO runbook

STEP v2 is the OAuth 2.0 identity provider. Messenger is a confidential
authorization-code client and keeps its own Laravel session after STEP signs
the user in.

Sanctum remains enabled in both applications for their existing first-party
APIs. Passport is only used by STEP for the Messenger SSO flow.

## 1. Deploy STEP v2

Run the Passport migrations and create persistent signing keys:

```bash
cd step-v2
php artisan migrate --force
php artisan passport:keys
```

Keep `storage/oauth-private.key` and `storage/oauth-public.key` persistent and
secret across deployments. Do not commit them. `PASSPORT_PRIVATE_KEY` and
`PASSPORT_PUBLIC_KEY` may be used instead when the deployment platform stores
multiline secrets.

Create one confidential client per Messenger environment. The redirect URI
must match Messenger exactly:

```bash
php artisan passport:client \
  --name="STEP Messenger" \
  --redirect_uri="https://chat.example.edu/auth/step/callback" \
  --no-interaction
```

Copy the displayed client ID and client secret immediately. Passport stores a
hash of the secret and will not display the plaintext again.

## 2. Configure Messenger

Add these values to the chat-app environment:

```dotenv
STEP_SSO_BASE_URL=https://step.example.edu
STEP_SSO_CLIENT_ID=<passport-client-id>
STEP_SSO_CLIENT_SECRET=<passport-client-secret>
STEP_SSO_REDIRECT_URI=https://chat.example.edu/auth/step/callback
STEP_SSO_SCOPES=chat:identity
STEP_SSO_TIMEOUT=10
STEP_SSO_TEAM_NAME="STEP Messenger"
STEP_SSO_TEAM_SLUG=step-messenger
STEP_SSO_ACCOUNT_URL=https://step.example.edu
```

Then deploy the user identity columns and refresh cached configuration:

```bash
cd chat-app
php artisan migrate --force
php artisan optimize:clear
php artisan config:cache
```

Do not expose the client secret through a `VITE_` variable. The configured team
slug is used to create or adopt the initial shared workspace; Messenger then
tracks that workspace by its immutable `external_source` marker.

## Role synchronization

Messenger stores every current STEP role in `users.step_roles` and derives one
primary `school_role` for existing authorization checks. Precedence is:

1. Super Admin
2. Admin
3. Support
4. Dean
5. Acad / Academic
6. Guidance
7. Operation / Operations
8. Teacher
9. Student
10. Parent

Super Admin and Admin receive the shared team's `admin` membership. Every
other recognized role receives `member`. Unknown roles are retained when the
user also has a recognized role; an account with only unknown roles is denied
access instead of receiving an unsafe fallback role.

Name, email, verification state, roles, and shared-team membership are updated
on every successful SSO login. Existing pre-SSO Messenger users are linked by
email only when that local account is not already linked to another STEP ID.

## Expected behavior

- `GET` and `POST /register` are unavailable.
- Local password, password-reset, passkey, two-factor, and email-verification
  authentication routes are unavailable.
- Profile identity fields are read-only in Messenger and link back to STEP.
- Messenger logout ends only the Messenger session; Passport does not provide
  STEP-wide single logout.
- User creation is just-in-time. A STEP user appears in Messenger after their
  first successful SSO login. A complete pre-populated directory would require
  a separate scheduled sync or webhook.

## Verification

```bash
cd step-v2
vendor/bin/phpunit tests/Unit/PassportSsoContractTest.php

cd ../chat-app
php artisan test
npm run lint:check
npm run format:check
npm run types:check
npm run build
```
