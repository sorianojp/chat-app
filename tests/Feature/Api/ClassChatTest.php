<?php

use App\Enums\TeamRole;
use App\Models\Conversation;
use App\Models\SchoolClass;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    config([
        'services.step_sso.base_url' => 'https://step.test',
        'services.step_sso.client_id' => 'chat-client-id',
        'services.step_sso.client_secret' => 'chat-client-secret',
        'services.step_sso.redirect_uri' => 'https://chat.test/auth/step/callback',
        'services.step_sso.scopes' => 'chat:identity chat:classes',
        'services.step_sso.team_name' => 'STEP Community',
        'services.step_sso.team_slug' => 'step-community',
    ]);
});

/**
 * Signs in through the STEP callback with the given identity and classes.
 *
 * @param  array<string, mixed>|int  $classes  The /sso/classes payload, or an HTTP status to fail with.
 */
function signInWithStep(string $sub, string $name, array $roles, array|int $classes): void
{
    // Fakes accumulate and the first match wins, so start fresh each time.
    Http::swap(new Factory);
    // Sanctum::actingAs() earlier in a test switches the default guard.
    auth()->shouldUse('web');
    Http::fake([
        'https://step.test/oauth/token' => Http::response(['access_token' => 'token']),
        'https://step.test/api/v1/sso/user' => Http::response(['data' => [
            'sub' => $sub,
            'name' => $name,
            'email' => "{$sub}@example.edu",
            'email_verified' => true,
            'roles' => $roles,
        ]]),
        'https://step.test/api/v1/sso/classes' => is_int($classes)
            ? Http::response(['message' => 'Forbidden'], $classes)
            : Http::response(['data' => $classes]),
    ]);

    test()->withSession([
        'step_sso.state' => 'valid-state',
        'step_sso.code_verifier' => 'valid-verifier',
    ])->get(route('step-sso.callback', ['code' => 'code', 'state' => 'valid-state']))
        ->assertRedirect();

    auth()->logout();
}

/**
 * @return array<string, mixed>
 */
function stepRoom(array $students = []): array
{
    return [
        'id' => '901',
        'name' => 'Data Structures',
        'subject' => 'DATA STRUCTURES',
        'section' => 'BSIT-2A',
        'year' => '2',
        'school_year' => '2026-2027',
        'semester' => '1',
        'role' => 'teacher',
        'students' => $students,
    ];
}

test('a teacher sign-in brings their STEP classes and rosters', function () {
    signInWithStep('t-1', 'Ana Teacher', ['Teacher'], [stepRoom([
        ['sub' => 's-1', 'name' => 'Ben Student'],
        ['sub' => 's-2', 'name' => 'Cara Student'],
    ])]);

    $teacher = User::query()->where('step_user_id', 't-1')->firstOrFail();
    $class = SchoolClass::query()->where('step_room_id', '901')->firstOrFail();

    expect($class->adviser_id)->toBe($teacher->id)
        ->and($class->section)->toBe('BSIT-2A')
        ->and($class->members()->pluck('role', 'step_user_id')->all())
        ->toEqual(['s-1' => 'student', 's-2' => 'student', 't-1' => 'teacher']);

    // Sign-in still works when STEP refuses the classes scope.
    signInWithStep('t-2', 'Old Token', ['Teacher'], 403);
    expect(User::query()->where('step_user_id', 't-2')->exists())->toBeTrue();
});

test('the teacher starts a class chat once and students join it as they sign in', function () {
    signInWithStep('s-1', 'Ben Student', ['Student'], []);
    signInWithStep('t-1', 'Ana Teacher', ['Teacher'], [stepRoom([
        ['sub' => 's-1', 'name' => 'Ben Student'],
        ['sub' => 's-2', 'name' => 'Cara Student'],
    ])]);
    $teacher = User::query()->where('step_user_id', 't-1')->firstOrFail();
    $team = Team::query()->where('slug', 'step-community')->firstOrFail();
    $class = SchoolClass::query()->where('step_room_id', '901')->firstOrFail();

    Sanctum::actingAs($teacher);
    $this->getJson("/api/teams/{$team->slug}/school-classes")
        ->assertOk()
        ->assertJsonPath('data.0.students_count', 2)
        ->assertJsonPath('data.0.joined_count', 1)
        ->assertJsonPath('data.0.conversation_id', null);

    $id = $this->postJson("/api/teams/{$team->slug}/school-classes/{$class->id}/conversation")
        ->assertCreated()
        ->assertJsonPath('data.title', 'Data Structures · BSIT-2A')
        ->assertJsonPath('data.school_class.id', $class->id)
        ->json('data.id');
    $this->postJson("/api/teams/{$team->slug}/school-classes/{$class->id}/conversation")
        ->assertOk()
        ->assertJsonPath('data.id', $id);

    $chat = Conversation::query()->findOrFail($id);
    expect($chat->participants()->pluck('role', 'step_user_id')->all())
        ->toEqual(['s-1' => 'member', 't-1' => 'owner']);

    // Cara signs in for the first time and lands in the chat.
    signInWithStep('s-2', 'Cara Student', ['Student'], [['id' => '901', 'role' => 'student']]);
    expect($chat->participants()->where('step_user_id', 's-2')->exists())->toBeTrue();

    // Ben leaves; signing in again does not put him back.
    $ben = User::query()->where('step_user_id', 's-1')->firstOrFail();
    $chat->participants()->detach($ben->id);
    signInWithStep('s-1', 'Ben Student', ['Student'], [['id' => '901', 'role' => 'student']]);
    expect($chat->participants()->whereKey($ben->id)->exists())->toBeFalse()
        ->and($chat->participants()->whereKey($teacher->id)->first()->pivot->role)->toBe('owner');
});

test('only the class teacher can start its chat or see it in their classes', function () {
    signInWithStep('t-1', 'Ana Teacher', ['Teacher'], [stepRoom()]);
    $class = SchoolClass::query()->where('step_room_id', '901')->firstOrFail();
    $team = $class->team;
    $other = User::factory()->create();
    $team->members()->attach($other, ['role' => TeamRole::Member->value]);

    Sanctum::actingAs($other);
    $this->getJson("/api/teams/{$team->slug}/school-classes")->assertOk()->assertJsonCount(0, 'data');
    $this->postJson("/api/teams/{$team->slug}/school-classes/{$class->id}/conversation")->assertForbidden();
});

test('ordinary group chats cannot be tagged with a class', function () {
    signInWithStep('t-1', 'Ana Teacher', ['Teacher'], [stepRoom()]);
    $class = SchoolClass::query()->where('step_room_id', '901')->firstOrFail();
    $team = $class->team;
    $student = User::factory()->create();
    $team->members()->attach($student, ['role' => TeamRole::Member->value]);
    $friend = User::factory()->create();
    $team->members()->attach($friend, ['role' => TeamRole::Member->value]);

    Sanctum::actingAs($student);
    $this->postJson("/api/teams/{$team->slug}/conversations", [
        'type' => 'group',
        'title' => 'Not the class',
        'school_class_id' => $class->id,
        'participant_ids' => [$friend->id],
    ])->assertCreated()->assertJsonPath('data.school_class', null);
});
