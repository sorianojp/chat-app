<?php

use App\Actions\Auth\ProvisionStepUser;
use App\Data\StepIdentity;
use App\Enums\SchoolRole;
use App\Enums\TeamRole;
use App\Models\Team;
use App\Models\TeamInvitation;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    config([
        'services.step_sso.base_url' => 'https://step.test',
        'services.step_sso.client_id' => 'chat-client-id',
        'services.step_sso.client_secret' => 'chat-client-secret',
        'services.step_sso.redirect_uri' => 'https://chat.test/auth/step/callback',
        'services.step_sso.scopes' => 'chat:identity',
        'services.step_sso.team_name' => 'STEP Community',
        'services.step_sso.team_slug' => 'step-community',
    ]);
});

test('STEP-only login screen can be rendered', function () {
    $this->get(route('login'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/login')
            ->where('stepSsoUrl', route('step-sso.redirect'))
            ->where('teamInvitation', null),
        );
});

test('login screen preserves a valid team invitation for SSO', function () {
    $owner = User::factory()->create();
    $team = Team::factory()->create(['name' => 'Laravel Team']);
    $team->members()->attach($owner, ['role' => TeamRole::Owner->value]);
    $invitation = TeamInvitation::factory()->create([
        'team_id' => $team->id,
        'email' => 'invited@example.com',
        'invited_by' => $owner->id,
    ]);

    $this->get(route('login', ['invitation' => $invitation->code]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/login')
            ->where('teamInvitation.code', $invitation->code)
            ->where('teamInvitation.teamName', 'Laravel Team')
            ->where('stepSsoUrl', route('step-sso.redirect', ['invitation' => $invitation->code])),
        );
});

test('SSO redirect includes state scope callback and PKCE challenge', function () {
    $response = $this->get(route('step-sso.redirect'));

    $response->assertRedirect();
    $location = $response->headers->get('Location');
    parse_str((string) parse_url($location, PHP_URL_QUERY), $query);

    expect(parse_url($location, PHP_URL_HOST))->toBe('step.test')
        ->and(parse_url($location, PHP_URL_PATH))->toBe('/oauth/authorize')
        ->and($query['client_id'])->toBe('chat-client-id')
        ->and($query['redirect_uri'])->toBe('https://chat.test/auth/step/callback')
        ->and($query['response_type'])->toBe('code')
        ->and($query['scope'])->toBe('chat:identity')
        ->and($query['state'])->toBeString()->not->toBeEmpty()
        ->and($query['code_challenge_method'])->toBe('S256')
        ->and($query['code_challenge'])->toBeString()->not->toBeEmpty();

    $response->assertSessionHas('step_sso.state', $query['state']);
    $response->assertSessionHas('step_sso.code_verifier');
});

test('SSO callback provisions the STEP user roles and shared team', function () {
    Http::fake([
        'https://step.test/oauth/token' => Http::response([
            'access_token' => 'step-access-token',
            'token_type' => 'Bearer',
        ]),
        'https://step.test/api/v1/sso/user' => Http::response(['data' => [
            'sub' => 'step-42',
            'name' => 'Jane Teacher',
            'email' => 'JANE@EXAMPLE.EDU',
            'email_verified' => true,
            'roles' => ['Student', 'Teacher'],
        ]]),
    ]);

    $response = $this->withSession([
        'step_sso.state' => 'valid-state',
        'step_sso.code_verifier' => 'valid-verifier',
    ])->get(route('step-sso.callback', [
        'code' => 'authorization-code',
        'state' => 'valid-state',
    ]));

    $user = User::query()->where('step_user_id', 'step-42')->firstOrFail();
    $team = Team::query()->where('slug', 'step-community')->firstOrFail();

    $this->assertAuthenticatedAs($user);
    $response->assertRedirect(route('messenger', ['current_team' => 'step-community']));
    expect($user->name)->toBe('Jane Teacher')
        ->and($user->email)->toBe('jane@example.edu')
        ->and($user->school_role)->toBe(SchoolRole::Teacher)
        ->and($user->step_roles)->toBe(['Student', 'Teacher'])
        ->and($user->step_roles_synced_at)->not->toBeNull()
        ->and($user->email_verified_at)->not->toBeNull()
        ->and(Hash::needsRehash($user->password))->toBeFalse()
        ->and($user->current_team_id)->toBe($team->id)
        ->and($team->external_source)->toBe('step-v2');

    $this->assertDatabaseHas('team_members', [
        'team_id' => $team->id,
        'user_id' => $user->id,
        'role' => TeamRole::Member->value,
    ]);

    Http::assertSent(fn (Request $request) => $request->url() === 'https://step.test/oauth/token'
        && $request['grant_type'] === 'authorization_code'
        && $request['client_secret'] === 'chat-client-secret'
        && $request['code_verifier'] === 'valid-verifier');
    Http::assertSent(fn (Request $request) => $request->url() === 'https://step.test/api/v1/sso/user'
        && $request->hasHeader('Authorization', 'Bearer step-access-token'));
});

test('repeated SSO synchronizes profile and role without duplicating the user', function () {
    $user = User::factory()->create([
        'step_user_id' => 'step-42',
        'name' => 'Old Name',
        'email' => 'old@example.edu',
        'school_role' => SchoolRole::Student,
        'step_roles' => ['Student'],
    ]);

    Http::fake([
        'https://step.test/oauth/token' => Http::response(['access_token' => 'token']),
        'https://step.test/api/v1/sso/user' => Http::response(['data' => [
            'sub' => 'step-42',
            'name' => 'Updated Admin',
            'email' => 'admin@example.edu',
            'email_verified' => true,
            'roles' => ['Admin', 'Teacher'],
        ]]),
    ]);

    $this->withSession([
        'step_sso.state' => 'valid-state',
        'step_sso.code_verifier' => 'valid-verifier',
    ])->get(route('step-sso.callback', [
        'code' => 'code',
        'state' => 'valid-state',
    ]))->assertRedirect();

    $user->refresh();

    expect(User::query()->where('step_user_id', 'step-42')->count())->toBe(1)
        ->and($user->name)->toBe('Updated Admin')
        ->and($user->email)->toBe('admin@example.edu')
        ->and($user->school_role)->toBe(SchoolRole::Admin)
        ->and($user->step_roles)->toBe(['Admin', 'Teacher']);

    $this->assertDatabaseHas('team_members', [
        'team_id' => Team::query()->where('slug', 'step-community')->value('id'),
        'user_id' => $user->id,
        'role' => TeamRole::Admin->value,
    ]);
});

test('first SSO safely links an existing local account with the same email', function () {
    $legacy = User::factory()->create(['email' => 'legacy@example.edu']);

    Http::fake([
        'https://step.test/oauth/token' => Http::response(['access_token' => 'token']),
        'https://step.test/api/v1/sso/user' => Http::response(['data' => [
            'sub' => 'step-legacy',
            'name' => 'STEP Name',
            'email' => 'legacy@example.edu',
            'email_verified' => true,
            'roles' => ['Student'],
        ]]),
    ]);

    $this->withSession([
        'step_sso.state' => 'state',
        'step_sso.code_verifier' => 'verifier',
    ])->get(route('step-sso.callback', ['code' => 'code', 'state' => 'state']))
        ->assertRedirect(route('messenger', ['current_team' => 'step-community']));

    expect(User::count())->toBe(1)
        ->and($legacy->fresh()->step_user_id)->toBe('step-legacy')
        ->and($legacy->fresh()->school_role)->toBe(SchoolRole::Student);
});

test('the STEP workspace remains stable when an administrator renames it', function () {
    $provisioner = app(ProvisionStepUser::class);
    $firstUser = $provisioner->handle(new StepIdentity(
        id: 'step-1',
        name: 'First User',
        email: 'first@example.edu',
        emailVerified: true,
        roles: ['Admin'],
    ));
    $team = $firstUser->currentTeam;

    $team->update(['name' => 'Renamed STEP Community']);

    $secondUser = $provisioner->handle(new StepIdentity(
        id: 'step-2',
        name: 'Second User',
        email: 'second@example.edu',
        emailVerified: true,
        roles: ['Student'],
    ));

    expect(Team::query()->where('external_source', 'step-v2')->count())->toBe(1)
        ->and($secondUser->current_team_id)->toBe($team->id)
        ->and($team->fresh()->slug)->toBe('renamed-step-community');
});

test('SSO rejects an email already linked to a different STEP identity', function () {
    User::factory()->create([
        'step_user_id' => 'another-step-user',
        'email' => 'claimed@example.edu',
    ]);

    Http::fake([
        'https://step.test/oauth/token' => Http::response(['access_token' => 'token']),
        'https://step.test/api/v1/sso/user' => Http::response(['data' => [
            'sub' => 'step-42',
            'name' => 'Claimed User',
            'email' => 'claimed@example.edu',
            'email_verified' => true,
            'roles' => ['Student'],
        ]]),
    ]);

    $this->withSession([
        'step_sso.state' => 'state',
        'step_sso.code_verifier' => 'verifier',
    ])->get(route('step-sso.callback', ['code' => 'code', 'state' => 'state']))
        ->assertRedirect(route('login'))
        ->assertSessionHas('sso_error', 'This STEP email is already linked to a different Messenger account.');

    $this->assertGuest();
    expect(User::count())->toBe(1);
});

test('SSO rejects unsupported STEP roles without creating a user', function () {
    Http::fake([
        'https://step.test/oauth/token' => Http::response(['access_token' => 'token']),
        'https://step.test/api/v1/sso/user' => Http::response(['data' => [
            'sub' => 'step-42',
            'name' => 'Unknown Role',
            'email' => 'unknown@example.edu',
            'email_verified' => true,
            'roles' => ['Unmapped Role'],
        ]]),
    ]);

    $this->withSession([
        'step_sso.state' => 'state',
        'step_sso.code_verifier' => 'verifier',
    ])->get(route('step-sso.callback', ['code' => 'code', 'state' => 'state']))
        ->assertRedirect(route('login'))
        ->assertSessionHas('sso_error');

    $this->assertGuest();
    expect(User::count())->toBe(0);
});

test('SSO callback rejects mismatched state before contacting STEP', function () {
    Http::fake();

    $this->withSession([
        'step_sso.state' => 'expected-state',
        'step_sso.code_verifier' => 'verifier',
    ])->get(route('step-sso.callback', [
        'code' => 'code',
        'state' => 'wrong-state',
    ]))->assertRedirect(route('login'))
        ->assertSessionHas('sso_error');

    Http::assertNothingSent();
    $this->assertGuest();
});

test('local logout invalidates the chat session', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('logout'))
        ->assertRedirect(route('home'));

    $this->assertGuest();
});
