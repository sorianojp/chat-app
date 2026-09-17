# Uhoo! mobile integration

The Flutter project lives in `../step_messenger`. It shares Laravel's users,
teams, conversations, permissions, attachments, and Reverb broadcasts.

## Backend setup

Install the Composer dependencies and apply the migrations. Push notification
registrations are encrypted at rest in `push_tokens` and tied to the Sanctum
session that registered them, so signing out removes that device registration.

Keep the existing STEP OAuth configuration described in [step-sso.md](step-sso.md).
The OAuth callback registered with STEP remains:

```text
https://your-messenger-host/auth/step/callback
```

The host must be reachable by the phone and match the deployed Laravel
server. Keep the OAuth client secret exclusively in Laravel. Do not put it
in Dart defines, the Flutter project, or the mobile app.

Use a persistent shared Laravel cache (database or Redis) in deployments
with multiple workers/instances. Do not use the `array` cache driver outside
tests. Browser sessions must also be shared across instances.

## Push notifications

Uhoo! uses Firebase Cloud Messaging (FCM) HTTP v1 for Android and iOS. Create
Android and iOS apps in one Firebase project using the existing application ID
and bundle ID, `com.arzatech.uhoo`.

On the Laravel server, download a service-account JSON file with permission to
send Firebase Cloud Messaging messages. Store it outside the public directory;
`storage/app/firebase-service-account.json` is ignored by Git. Configure:

```dotenv
FIREBASE_PROJECT_ID=your-firebase-project-id
GOOGLE_APPLICATION_CREDENTIALS=storage/app/firebase-service-account.json
```

Run the migration and a queue worker:

```sh
php artisan migrate
php artisan queue:work
```

The server queues one delivery per registered device, excludes the sender,
honors each participant's `all`, `mentions`, or `muted` preference, and removes
tokens that FCM reports as unregistered.

The production Android and iOS client identifiers for Firebase project
`uhoo-6b5c8` are configured in `lib/src/data/firebase_config.dart`, so normal
Flutter builds include push support automatically. To build against another
Firebase project, copy `firebase.example.json` to a platform-specific ignored
file, fill it with that project's public client values, and pass it to Flutter:

```sh
cp firebase.example.json firebase.android.json
flutter run --dart-define-from-file=firebase.android.json

cp firebase.example.json firebase.ios.json
flutter run --dart-define-from-file=firebase.ios.json
```

Use the same `--dart-define-from-file` argument for release builds when using
an alternate Firebase project.

In the Apple Developer portal and Xcode, enable the Push Notifications
capability for `com.arzatech.uhoo`, keep Background Modes > Remote notifications
enabled, and upload the APNs authentication key to Firebase. The Firebase SDKs
set this app's minimum iOS version to 15. Push notification delivery must be
tested on a physical iPhone; Apple simulators are not a full APNs acceptance
test.

The app requests notification permission after a successful sign-in, registers
and rotates its FCM token, shows notifications while in the foreground, and
opens the referenced conversation (switching workspace first when necessary)
when a notification is tapped.

## Sign-in protocol

1. Flutter generates a cryptographically random verifier and sends its
   SHA-256 base64url challenge with a device label to
   `POST /api/mobile/auth/start`.
2. Laravel returns a random state and a same-origin `/auth/mobile/{state}`
   browser URL. The start record expires after five minutes.
3. The browser continues through the existing STEP OAuth flow, including
   its own OAuth state and PKCE validation.
4. After verified STEP identity provisioning, Laravel returns the browser
   to `stepmessenger://auth` with a 60-second, single-use handoff code and
   the original mobile state. Bearer tokens are never placed in URLs.
5. Flutter verifies the callback state and exchanges the code plus its
   original verifier at `POST /api/mobile/auth/exchange`. The exchange is
   guarded by a cache lock and issues a Sanctum token with a 30-day expiry.
6. The device sends `Authorization: Bearer …` on API requests.

The custom callback is fixed in the server and both native platform
configurations. Arbitrary redirect URLs are not accepted. Normal web SSO
continues to redirect to the Uhoo! web app.

## Added endpoints

| Endpoint                                                                                                      | Purpose                                                         |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `POST /api/mobile/auth/start`                                                                                 | Begin a mobile login; rate limited                              |
| `GET /auth/mobile/{state}`                                                                                    | Enter the browser SSO flow                                      |
| `POST /api/mobile/auth/exchange`                                                                              | Redeem a verified code; rate limited                            |
| `GET /api/mobile/session`                                                                                     | Current user, permitted workspaces, public Reverb configuration |
| `DELETE /api/mobile/session`                                                                                  | Revoke only the current device token                            |
| `PUT /api/mobile/push-token`                                                                                  | Register or rotate this mobile session's FCM token              |
| `POST /api/mobile/broadcasting/auth`                                                                          | Authorize Reverb channels using Sanctum                         |
| `GET /api/teams/{team:slug}/contacts`                                                                         | Paginated directory with optional `search`                      |
| `GET /api/teams/{team:slug}/conversations/{conversation}/messages/{message}/attachments/{attachment}/preview` | Authenticated media preview                                     |

All session, directory, and broadcast endpoints require Sanctum authentication.
Contact access checks team membership. Existing conversation and attachment
controllers enforce membership and participation. Conversation listing and
show responses now expose display names, unread counts, permissions, and the
same personalized message payloads used by the web app.

## Live updates

Configure the existing Reverb connection and run its server:

```sh
php artisan reverb:start
```

Set `BROADCAST_CONNECTION=reverb` and the existing `REVERB_APP_*`,
`REVERB_HOST`, `REVERB_PORT`, and `REVERB_SCHEME` variables. The host and port
must be reachable from the phone. Production should use `https`/WSS. Only
the public app key and connection address are exposed to Flutter. Channel
authorization uses the existing `routes/channels.php` membership checks.
Typing uses Echo-compatible `client-typing` events on the existing
`presence-conversations.{id}` channels, with throttling and inactivity expiry.

The app fetches personalized API payloads after broadcast events, so reaction
selection and permissions are evaluated for the current device user. It
also refreshes conversations every 25 seconds and an open chat every 15
seconds while in the foreground. New conversation discovery therefore has
up to a 25-second fallback delay. FCM provides background message alerts.

## Validation

```sh
php artisan test
vendor/bin/pint --test
vendor/bin/phpstan analyse --memory-limit=512M
```

`tests/Feature/Api/MobileTest.php` covers the SSO handoff, verifier mismatch,
replay rejection, expiry, failed SSO, device revocation, and team isolation.
`tests/Feature/Api/PushNotificationTest.php` covers encrypted token rotation,
logout cleanup, recipient selection, preferences, FCM authorization, and stale
token cleanup.
A real STEP account and reachable deployment are needed for device SSO
acceptance testing; automated tests fake the upstream STEP identity service.

The isolated cross-client integration check is available from the Flutter
folder with `python3 tool/check_backend.py`. Its PHP seeding helper refuses
to run unless the database is the temporary SQLite database created by the
runner. The check does not change the development database or contact STEP.
