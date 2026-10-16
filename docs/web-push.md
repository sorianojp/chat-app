# Web push notifications

Uhoo can deliver message notifications after the Messenger tab is closed. The
browser subscribes through `public/notification-sw.js`, and Laravel queues one
delivery job for each subscribed recipient browser.

## Production setup

Generate one VAPID key pair and keep it stable across deployments:

```bash
php artisan webpush:generate-vapid
```

Copy the generated public key and the private key from
`storage/app/private/web-push-vapid.json` into the deployment secrets:

```dotenv
WEB_PUSH_SUBJECT=https://chat.example.edu
WEB_PUSH_PUBLIC_KEY=
WEB_PUSH_PRIVATE_KEY=
WEB_PUSH_TTL=300
```

The private key must never be served to the browser or committed to source
control. Web push also requires HTTPS outside localhost.

Run migrations and keep a Laravel queue worker running:

```bash
php artisan migrate --force
php artisan queue:work --tries=3
```

Each conversation's `all`, `mentions`, or `muted` preference is checked again
when the queued job runs. Expired browser subscriptions are removed when their
push service returns HTTP 404 or 410.
