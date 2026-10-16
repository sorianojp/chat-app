<?php

use App\Events\MessageCreated;
use App\Jobs\SendMessagePushNotification;
use App\Jobs\SendMessageWebPushNotification;
use App\Models\PushToken;
use App\Models\Team;
use App\Models\User;
use App\Models\WebPushSubscription;
use App\Services\FirebasePushService;
use App\Services\WebPushService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

test('a user can register refresh and remove an encrypted browser push subscription', function () {
    config([
        'services.web_push.public_key' => 'test-public-key',
        'services.web_push.private_key' => 'test-private-key',
    ]);
    $user = User::factory()->create();
    $endpoint = 'https://push.example.test/send/subscription-123';
    $payload = [
        'endpoint' => $endpoint,
        'keys' => [
            'p256dh' => str_repeat('public-key-', 8),
            'auth' => str_repeat('auth-key-', 3),
        ],
        'content_encoding' => 'aes128gcm',
    ];

    $this->putJson('/api/web-push/subscription', $payload)->assertUnauthorized();

    $this->actingAs($user)
        ->putJson('/api/web-push/subscription', $payload)
        ->assertCreated()
        ->assertJsonPath('data.registered', true);

    $subscription = WebPushSubscription::query()->sole();
    expect($subscription->endpoint)->toBe($endpoint)
        ->and($subscription->public_key)->toBe($payload['keys']['p256dh'])
        ->and($subscription->auth_token)->toBe($payload['keys']['auth'])
        ->and($subscription->getRawOriginal('endpoint'))->not->toBe($endpoint)
        ->and($subscription->endpoint_hash)->toBe(hash('sha256', $endpoint));

    $this->actingAs($user)
        ->putJson('/api/web-push/subscription', [
            ...$payload,
            'keys' => [
                ...$payload['keys'],
                'auth' => str_repeat('refreshed-', 3),
            ],
        ])
        ->assertOk();

    $this->assertDatabaseCount('web_push_subscriptions', 1);

    $this->actingAs($user)
        ->deleteJson('/api/web-push/subscription', ['endpoint' => $endpoint])
        ->assertOk()
        ->assertJsonPath('data.registered', false);

    $this->assertDatabaseCount('web_push_subscriptions', 0);
});

test('message events queue web push delivery for recipient browsers but not the sender', function () {
    config([
        'services.web_push.public_key' => 'test-public-key',
        'services.web_push.private_key' => 'test-private-key',
    ]);
    Queue::fake();
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = $team->conversations()->create([
        'type' => 'direct',
        'created_by' => $sender->id,
    ]);
    $conversation->participants()->attach([
        $sender->id => ['role' => 'owner'],
        $recipient->id => ['role' => 'member'],
    ]);
    $senderPush = WebPushSubscription::query()->create([
        'user_id' => $sender->id,
        'endpoint_hash' => hash('sha256', 'sender-web-push'),
        'endpoint' => 'https://push.example.test/sender',
        'public_key' => 'sender-public-key',
        'auth_token' => 'sender-auth-token',
        'content_encoding' => 'aes128gcm',
        'last_seen_at' => now(),
    ]);
    $recipientPush = WebPushSubscription::query()->create([
        'user_id' => $recipient->id,
        'endpoint_hash' => hash('sha256', 'recipient-web-push'),
        'endpoint' => 'https://push.example.test/recipient',
        'public_key' => 'recipient-public-key',
        'auth_token' => 'recipient-auth-token',
        'content_encoding' => 'aes128gcm',
        'last_seen_at' => now(),
    ]);
    $message = $conversation->messages()->create([
        'sender_id' => $sender->id,
        'type' => 'text',
        'body' => 'Class starts in ten minutes.',
    ]);

    event(new MessageCreated($message));

    Queue::assertPushed(
        SendMessageWebPushNotification::class,
        fn (SendMessageWebPushNotification $job): bool => $job->messageId === $message->id
            && $job->subscriptionId === $recipientPush->id,
    );
    Queue::assertNotPushed(
        SendMessageWebPushNotification::class,
        fn (SendMessageWebPushNotification $job): bool => $job->subscriptionId === $senderPush->id,
    );
});

test('queued web push delivery honors conversation notification preferences', function () {
    $sender = User::factory()->create(['name' => 'Maria Teacher']);
    $recipient = User::factory()->create();
    $team = Team::factory()->create(['slug' => 'science-school']);
    $conversation = $team->conversations()->create([
        'type' => 'group',
        'title' => 'Science 8',
        'created_by' => $sender->id,
    ]);
    $conversation->participants()->attach([
        $sender->id => ['role' => 'owner'],
        $recipient->id => ['role' => 'member', 'notification_preference' => 'muted'],
    ]);
    $subscription = WebPushSubscription::query()->create([
        'user_id' => $recipient->id,
        'endpoint_hash' => hash('sha256', 'recipient-web-push'),
        'endpoint' => 'https://push.example.test/recipient',
        'public_key' => 'recipient-public-key',
        'auth_token' => 'recipient-auth-token',
        'content_encoding' => 'aes128gcm',
        'last_seen_at' => now(),
    ]);
    $message = $conversation->messages()->create([
        'sender_id' => $sender->id,
        'type' => 'text',
        'body' => 'Please bring your lab notes.',
    ]);
    $webPush = Mockery::mock(WebPushService::class);
    $webPush->shouldReceive('configured')->twice()->andReturnTrue();
    $webPush->shouldReceive('send')
        ->once()
        ->withArgs(fn (WebPushSubscription $destination, array $payload): bool => $destination->is($subscription)
            && $payload['title'] === 'Science 8'
            && $payload['body'] === 'Maria Teacher: Please bring your lab notes.'
            && $payload['url'] === "/science-school/messenger?conversation={$conversation->id}");
    $job = new SendMessageWebPushNotification($message->id, $subscription->id);

    $job->handle($webPush);
    $conversation->participants()->updateExistingPivot($recipient->id, [
        'notification_preference' => 'all',
    ]);
    $job->handle($webPush);
});

test('a mobile session registers one encrypted push token and logout removes it', function () {
    $user = User::factory()->create();
    $accessToken = $user->createToken('Test phone');
    $firstToken = str_repeat('first-token-', 12);
    $secondToken = str_repeat('second-token-', 12);

    $this->putJson('/api/mobile/push-token', [
        'token' => $firstToken,
        'platform' => 'android',
        'device_name' => 'Test phone',
    ])->assertUnauthorized();

    $this->withToken($accessToken->plainTextToken)->putJson('/api/mobile/push-token', [
        'token' => $firstToken,
        'platform' => 'android',
        'device_name' => 'Test phone',
    ])->assertCreated()->assertJsonPath('data.registered', true);

    $registered = PushToken::query()->sole();
    expect($registered->token)->toBe($firstToken)
        ->and($registered->getRawOriginal('token'))->not->toBe($firstToken)
        ->and($registered->token_hash)->toBe(hash('sha256', $firstToken));

    $this->withToken($accessToken->plainTextToken)->putJson('/api/mobile/push-token', [
        'token' => $secondToken,
        'platform' => 'android',
    ])->assertCreated();
    $this->assertDatabaseCount('push_tokens', 1);
    $this->assertDatabaseHas('push_tokens', ['token_hash' => hash('sha256', $secondToken)]);

    $this->withToken($accessToken->plainTextToken)->deleteJson('/api/mobile/session')->assertOk();
    $this->assertDatabaseCount('push_tokens', 0);
});

test('message events queue push delivery for recipient devices but not the sender', function () {
    config([
        'services.firebase.project_id' => 'test-project',
        'services.firebase.credentials' => '{"configured":true}',
    ]);
    Queue::fake();
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = $team->conversations()->create([
        'type' => 'direct',
        'created_by' => $sender->id,
    ]);
    $conversation->participants()->attach([
        $sender->id => ['role' => 'owner'],
        $recipient->id => ['role' => 'member'],
    ]);
    $senderAccessToken = $sender->createToken('Sender phone')->accessToken;
    $recipientAccessToken = $recipient->createToken('Recipient phone')->accessToken;
    $senderPush = PushToken::query()->create([
        'user_id' => $sender->id,
        'personal_access_token_id' => $senderAccessToken->id,
        'token_hash' => hash('sha256', 'sender-push-token'),
        'token' => 'sender-push-token',
        'platform' => 'android',
        'last_seen_at' => now(),
    ]);
    $recipientPush = PushToken::query()->create([
        'user_id' => $recipient->id,
        'personal_access_token_id' => $recipientAccessToken->id,
        'token_hash' => hash('sha256', 'recipient-push-token'),
        'token' => 'recipient-push-token',
        'platform' => 'ios',
        'last_seen_at' => now(),
    ]);
    $message = $conversation->messages()->create([
        'sender_id' => $sender->id,
        'type' => 'text',
        'body' => 'Class starts in ten minutes.',
    ]);

    event(new MessageCreated($message));

    Queue::assertPushed(
        SendMessagePushNotification::class,
        fn (SendMessagePushNotification $job): bool => $job->messageId === $message->id
            && $job->pushTokenId === $recipientPush->id,
    );
    Queue::assertNotPushed(
        SendMessagePushNotification::class,
        fn (SendMessagePushNotification $job): bool => $job->pushTokenId === $senderPush->id,
    );
});

test('queued push delivery honors conversation notification preferences', function () {
    config([
        'services.firebase.project_id' => 'test-project',
        'services.firebase.credentials' => '{"configured":true}',
    ]);
    $sender = User::factory()->create(['name' => 'Maria Teacher']);
    $recipient = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = $team->conversations()->create([
        'type' => 'group',
        'title' => 'Science 8',
        'created_by' => $sender->id,
    ]);
    $conversation->participants()->attach([
        $sender->id => ['role' => 'owner'],
        $recipient->id => ['role' => 'member', 'notification_preference' => 'muted'],
    ]);
    $accessToken = $recipient->createToken('Phone')->accessToken;
    $pushToken = PushToken::query()->create([
        'user_id' => $recipient->id,
        'personal_access_token_id' => $accessToken->id,
        'token_hash' => hash('sha256', 'recipient-token'),
        'token' => 'recipient-token',
        'platform' => 'android',
        'last_seen_at' => now(),
    ]);
    $message = $conversation->messages()->create([
        'sender_id' => $sender->id,
        'type' => 'text',
        'body' => 'Please bring your lab notes.',
    ]);
    $firebase = Mockery::mock(FirebasePushService::class);
    $firebase->shouldReceive('configured')->twice()->andReturnTrue();
    $firebase->shouldReceive('send')
        ->once()
        ->withArgs(fn (PushToken $token, string $title, string $body, array $data): bool => $token->is($pushToken)
            && $title === 'Science 8'
            && $body === 'Maria Teacher: Please bring your lab notes.'
            && $data['conversation_id'] === (string) $conversation->id);
    $job = new SendMessagePushNotification($message->id, $pushToken->id);

    $job->handle($firebase);
    $conversation->participants()->updateExistingPivot($recipient->id, [
        'notification_preference' => 'all',
    ]);
    $job->handle($firebase);
});

test('firebase removes a token when FCM reports it as unregistered', function () {
    $privateKey = openssl_pkey_new(['private_key_bits' => 2048]);
    expect($privateKey)->not->toBeFalse();
    openssl_pkey_export($privateKey, $privateKeyPem);
    config([
        'services.firebase.project_id' => 'test-project',
        'services.firebase.credentials' => json_encode([
            'client_email' => 'firebase@test-project.iam.gserviceaccount.com',
            'private_key' => $privateKeyPem,
            'token_uri' => 'https://oauth2.googleapis.com/token',
        ], JSON_THROW_ON_ERROR),
    ]);
    Http::fake([
        'https://oauth2.googleapis.com/token' => Http::response(['access_token' => 'oauth-token']),
        'https://fcm.googleapis.com/*' => Http::response([
            'error' => [
                'details' => [[
                    '@type' => 'type.googleapis.com/google.firebase.fcm.v1.FcmError',
                    'errorCode' => 'UNREGISTERED',
                ]],
            ],
        ], 400),
    ]);
    $user = User::factory()->create();
    $accessToken = $user->createToken('Phone')->accessToken;
    $pushToken = PushToken::query()->create([
        'user_id' => $user->id,
        'personal_access_token_id' => $accessToken->id,
        'token_hash' => hash('sha256', 'expired-token'),
        'token' => 'expired-token',
        'platform' => 'android',
        'last_seen_at' => now(),
    ]);

    app(FirebasePushService::class)->send($pushToken, 'Test', 'Test body', [
        'conversation_id' => '1',
    ]);

    $this->assertDatabaseMissing('push_tokens', ['id' => $pushToken->id]);
    Http::assertSent(fn ($request): bool => $request->url() === 'https://fcm.googleapis.com/v1/projects/test-project/messages:send'
        && $request->hasHeader('Authorization', 'Bearer oauth-token'));
});
