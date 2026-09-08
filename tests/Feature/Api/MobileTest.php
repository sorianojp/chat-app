<?php

use App\Enums\SchoolRole;
use App\Enums\TeamRole;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

function mobileChallenge(string $verifier): string
{
    return rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');
}

test('mobile STEP sign in returns a single use PKCE code and a working expiring token', function () {
    config([
        'services.step_sso.base_url' => 'https://step.test',
        'services.step_sso.client_id' => 'mobile-test',
        'services.step_sso.client_secret' => 'server-only-secret',
        'services.step_sso.redirect_uri' => 'http://localhost/auth/step/callback',
    ]);
    Http::fake([
        'https://step.test/oauth/token' => Http::response(['access_token' => 'step-token']),
        'https://step.test/api/v1/sso/user' => Http::response(['data' => [
            'sub' => 'mobile-42', 'name' => 'Mobile Teacher', 'email' => 'mobile@school.test',
            'email_verified' => true, 'roles' => ['Teacher'],
        ]]),
    ]);

    $verifier = str_repeat('v', 43);
    $start = $this->postJson('/api/mobile/auth/start', [
        'device_name' => 'Test phone', 'code_challenge' => mobileChallenge($verifier),
        'redirect_uri' => 'https://untrusted.example/callback',
    ])->assertOk()->assertHeader('Cache-Control', 'no-store, private')->json();

    $this->get($start['authorization_url'])->assertRedirect(route('step-sso.redirect'));
    $this->get($start['authorization_url'])->assertGone();
    $redirect = $this->get(route('step-sso.redirect'));
    parse_str((string) parse_url($redirect->headers->get('Location'), PHP_URL_QUERY), $oauth);
    $callback = $this->get(route('step-sso.callback', ['code' => 'step-code', 'state' => $oauth['state']]))->assertRedirect();
    $location = $callback->headers->get('Location');
    expect($location)->toStartWith('stepmessenger://auth?')->not->toContain('token=');
    parse_str((string) parse_url($location, PHP_URL_QUERY), $handoff);
    expect($handoff['state'])->toBe($start['state']);
    $this->assertDatabaseCount('personal_access_tokens', 0);
    Auth::logout();

    $this->postJson('/api/mobile/auth/exchange', ['code' => $handoff['code'], 'code_verifier' => str_repeat('x', 43)])->assertUnauthorized();
    $token = $this->postJson('/api/mobile/auth/exchange', ['code' => $handoff['code'], 'code_verifier' => $verifier])
        ->assertOk()->assertJsonStructure(['token', 'expires_at'])->json('token');
    $this->assertDatabaseCount('personal_access_tokens', 1);
    $this->postJson('/api/mobile/auth/exchange', ['code' => $handoff['code'], 'code_verifier' => $verifier])->assertUnauthorized();
    $this->withToken($token)->getJson('/api/mobile/session')->assertOk()
        ->assertJsonPath('user.name', 'Mobile Teacher')->assertJsonPath('user.school_role', 'teacher')
        ->assertJsonCount(1, 'teams')->assertJsonMissing(['client_secret' => 'server-only-secret']);
});

test('mobile broadcast authorization enforces conversation participation', function () {
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'test-key',
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.app_id' => '1',
    ]);
    // The application boot registered channels on the test null broadcaster.
    // Register the same production callbacks on the newly selected driver.
    require base_path('routes/channels.php');
    $member = User::factory()->create();
    $outsider = User::factory()->create();
    $team = Team::factory()->create();
    $team->members()->attach($member->id, ['role' => TeamRole::Member->value]);
    $conversation = $team->conversations()->create(['type' => 'direct', 'created_by' => $member->id]);
    $conversation->participants()->attach($member->id, ['role' => 'owner']);
    $body = ['socket_id' => '123.456', 'channel_name' => 'private-conversations.'.$conversation->id];
    $this->withToken($member->createToken('Phone')->plainTextToken)
        ->postJson('/api/mobile/broadcasting/auth', $body)->assertOk()->assertJsonStructure(['auth']);
    Auth::forgetGuards();
    $this->withToken($outsider->createToken('Phone')->plainTextToken)
        ->postJson('/api/mobile/broadcasting/auth', $body)->assertForbidden();
});

test('mobile handoff codes expire and never accept an arbitrary callback', function () {
    $user = User::factory()->create();
    $code = str_repeat('c', 64);
    $verifier = str_repeat('v', 43);
    Cache::put('mobile:code:'.hash('sha256', $code), [
        'code_challenge' => mobileChallenge($verifier), 'user_id' => $user->id, 'device_name' => 'Phone',
    ], now()->addSeconds(60));
    $this->travel(61)->seconds();
    $this->postJson('/api/mobile/auth/exchange', ['code' => $code, 'code_verifier' => $verifier])->assertUnauthorized();
    $this->assertDatabaseCount('personal_access_tokens', 0);
    $this->postJson('/api/mobile/auth/start', ['code_challenge' => 'invalid', 'device_name' => 'Phone'])->assertUnprocessable();
    $this->get('/auth/mobile/'.str_repeat('z', 64))->assertGone();
});

test('failed mobile SSO returns to the app without issuing a token', function () {
    $state = str_repeat('s', 64);
    $this->withSession([
        'step_sso.mobile' => ['state' => $state, 'code_challenge' => str_repeat('c', 43), 'device_name' => 'Phone'],
        'step_sso.state' => 'expected', 'step_sso.code_verifier' => 'verifier',
    ])->get(route('step-sso.callback', ['state' => 'wrong', 'code' => 'bad']))
        ->assertRedirect('stepmessenger://auth?error=sign_in_failed&state='.$state)
        ->assertSessionMissing('step_sso.mobile');
    $this->assertDatabaseCount('personal_access_tokens', 0);
});

test('mobile session requires authentication and logout revokes only this device', function () {
    $this->getJson('/api/mobile/session')->assertUnauthorized();
    $user = User::factory()->create();
    $phone = $user->createToken('Phone');
    $other = $user->createToken('Other device');
    $this->withToken($phone->plainTextToken)->deleteJson('/api/mobile/session')->assertOk();
    $this->assertDatabaseMissing('personal_access_tokens', ['id' => $phone->accessToken->id]);
    $this->assertDatabaseHas('personal_access_tokens', ['id' => $other->accessToken->id]);
    Auth::forgetGuards();
    $this->withToken($phone->plainTextToken)->getJson('/api/mobile/session')->assertUnauthorized();
});

test('mobile contacts and conversations are scoped to the authenticated school member', function () {
    $user = User::factory()->create(['school_role' => SchoolRole::Teacher]);
    $contact = User::factory()->create(['name' => 'Jane Classmate']);
    $outsider = User::factory()->create();
    $team = Team::factory()->create();
    $other = Team::factory()->create();
    $team->members()->attach([$user->id => ['role' => TeamRole::Member->value], $contact->id => ['role' => TeamRole::Member->value]]);
    $other->members()->attach($outsider->id, ['role' => TeamRole::Member->value]);
    $token = $user->createToken('Phone')->plainTextToken;
    $this->withToken($token)->getJson("/api/teams/{$team->slug}/contacts?search=Jane")->assertOk()
        ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $contact->id)->assertJsonMissingPath('data.0.password');
    $this->withToken($token)->getJson("/api/teams/{$other->slug}/contacts")->assertForbidden();

    $conversation = $this->withToken($token)->postJson("/api/teams/{$team->slug}/conversations", [
        'type' => 'direct', 'participant_ids' => [$contact->id],
    ])->assertCreated()->json('data.id');
    $this->withToken($token)->getJson("/api/teams/{$team->slug}/conversations")
        ->assertOk()->assertJsonPath('data.0.display_name', 'Jane Classmate')
        ->assertJsonPath('data.0.unread_count', 0)->assertJsonPath('data.0.permissions.can_pin_messages', true);
    $this->withToken($token)->getJson("/api/teams/{$team->slug}/conversations/{$conversation}")
        ->assertOk()->assertJsonPath('data.display_name', 'Jane Classmate');
    Auth::forgetGuards();
    $this->withToken($outsider->createToken('Phone')->plainTextToken)
        ->getJson("/api/teams/{$team->slug}/conversations/{$conversation}")->assertForbidden();
});
