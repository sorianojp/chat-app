<?php

use App\Jobs\SyncStepClassroomsJob;
use App\Models\Conversation;
use App\Models\SchoolClass;
use App\Services\SyncStepClassrooms;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    config()->set('services.step_sso.base_url', 'https://step.test');
    config()->set('services.step_sso.integration_token', 'directory-secret');
    config()->set('services.step_sso.webhook_secret', 'webhook-secret');
    config()->set('services.step_sso.team_name', 'STEP Messenger');
    config()->set('services.step_sso.team_slug', 'step-messenger');
});

function stepClassroomIdentity(string $id, string $name, string $email, string $role): array
{
    return [
        'sub' => $id,
        'name' => $name,
        'email' => $email,
        'email_verified' => true,
        'roles' => [$role],
        'department' => [
            'id' => '1',
            'code' => 'CCS',
            'name' => 'College of Computer Studies',
        ],
    ];
}

test('current STEP rooms create one managed group and reconcile its roster', function () {
    Http::fake([
        'https://step.test/api/v1/integrations/uhoo/classrooms*' => Http::response([
            'data' => [
                'school_year' => '2026-2027',
                'semester' => '1',
                'rooms' => [[
                    'id' => '42',
                    'class_code' => 'IT101',
                    'subject' => 'Introduction to Computing',
                    'section' => 'BSIT26-A',
                    'course' => 'BSIT',
                    'year' => '1',
                    'school_year' => '2026-2027',
                    'semester' => '1',
                    'teacher' => stepClassroomIdentity('10', 'Maria Teacher', 'teacher@school.test', 'Teacher'),
                    'students' => [
                        stepClassroomIdentity('20', 'Alex Student', 'alex@school.test', 'Student'),
                    ],
                ]],
            ],
        ]),
    ]);

    $first = app(SyncStepClassrooms::class)->handle();
    $second = app(SyncStepClassrooms::class)->handle();

    expect($first)->toMatchArray(['created' => 1, 'rooms' => 1])
        ->and($second)->toMatchArray(['created' => 0, 'updated' => 1, 'rooms' => 1]);

    $class = SchoolClass::query()->where('step_room_id', '42')->firstOrFail();
    $conversation = Conversation::query()->where('school_class_id', $class->id)->firstOrFail();

    expect($conversation->managed_by_step)->toBeTrue()
        ->and($conversation->participants()->count())->toBe(2)
        ->and($conversation->participants()->wherePivot('role', 'owner')->firstOrFail()->step_user_id)->toBe('10')
        ->and($conversation->participants()->wherePivot('role', 'member')->firstOrFail()->step_user_id)->toBe('20');
});

test('rooms outside the active STEP term are archived and locked without deleting history', function () {
    Http::fake([
        'https://step.test/api/v1/integrations/uhoo/classrooms*' => Http::sequence()
            ->push([
                'data' => [
                    'school_year' => '2026-2027',
                    'semester' => '1',
                    'rooms' => [[
                        'id' => '42',
                        'subject' => 'Algorithms',
                        'section' => 'BSIT26-A',
                        'year' => '2',
                        'school_year' => '2026-2027',
                        'semester' => '1',
                        'teacher' => stepClassroomIdentity('10', 'Maria Teacher', 'teacher@school.test', 'Teacher'),
                        'students' => [],
                    ]],
                ],
            ])
            ->push([
                'data' => [
                    'school_year' => '2026-2027',
                    'semester' => '2',
                    'rooms' => [],
                ],
            ]),
    ]);

    app(SyncStepClassrooms::class)->handle();
    $result = app(SyncStepClassrooms::class)->handle();

    $conversation = Conversation::query()->where('managed_by_step', true)->firstOrFail();

    expect($result['archived'])->toBe(1)
        ->and($conversation->refresh()->sync_status)->toBe('archived')
        ->and($conversation->locked_at)->not->toBeNull()
        ->and($conversation->archived_at)->not->toBeNull();

    $teacher = $conversation->participants()->where('step_user_id', '10')->firstOrFail();
    $this->actingAs($teacher)
        ->postJson("/api/teams/{$conversation->team->slug}/conversations/{$conversation->id}/messages", [
            'body' => 'This should not be sent.',
        ])
        ->assertUnprocessable()
        ->assertJsonPath('message', 'This classroom chat is archived and read-only.');
});

test('students who join an existing STEP room are added to its existing Uhoo group', function () {
    $room = fn (array $students): array => [
        'id' => '42',
        'subject' => 'Algorithms',
        'section' => 'BSIT26-A',
        'year' => '2',
        'school_year' => '2026-2027',
        'semester' => '1',
        'teacher' => stepClassroomIdentity('10', 'Maria Teacher', 'teacher@school.test', 'Teacher'),
        'students' => $students,
    ];
    $response = fn (array $students): array => ['data' => [
        'school_year' => '2026-2027',
        'semester' => '1',
        'rooms' => [$room($students)],
    ]];

    Http::fake([
        'https://step.test/api/v1/integrations/uhoo/classrooms*' => Http::sequence()
            ->push($response([]))
            ->push($response([
                stepClassroomIdentity('20', 'Alex Student', 'alex@school.test', 'Student'),
            ]))
            ->push($response([])),
    ]);

    app(SyncStepClassrooms::class)->handle();
    $conversationId = Conversation::query()->where('managed_by_step', true)->value('id');
    app(SyncStepClassrooms::class)->handle();

    $conversation = Conversation::query()->findOrFail($conversationId);

    expect(Conversation::query()->where('managed_by_step', true)->count())->toBe(1)
        ->and($conversation->participants()->count())->toBe(2)
        ->and($conversation->participants()->where('step_user_id', '20')->exists())->toBeTrue();

    app(SyncStepClassrooms::class)->handle();

    expect($conversation->participants()->count())->toBe(1)
        ->and($conversation->participants()->where('step_user_id', '20')->exists())->toBeFalse();
});

test('large STEP classroom feeds are synchronized page by page', function () {
    $room = fn (string $id): array => [
        'id' => $id,
        'subject' => "Subject {$id}",
        'section' => "Section {$id}",
        'year' => '1',
        'school_year' => '2026-2027',
        'semester' => '1',
        'teacher' => stepClassroomIdentity("teacher-{$id}", "Teacher {$id}", "teacher{$id}@school.test", 'Teacher'),
        'students' => [],
    ];

    Http::fake([
        'https://step.test/api/v1/integrations/uhoo/classrooms*' => Http::sequence()
            ->push(['data' => [
                'school_year' => '2026-2027',
                'semester' => '1',
                'rooms' => [$room('41')],
                'pagination' => ['has_more' => true, 'next_cursor' => 'cursor-2'],
            ]])
            ->push(['data' => [
                'school_year' => '2026-2027',
                'semester' => '1',
                'rooms' => [$room('42')],
                'pagination' => ['has_more' => false, 'next_cursor' => null],
            ]]),
    ]);

    $result = app(SyncStepClassrooms::class)->handle();

    expect($result)->toMatchArray(['created' => 2, 'rooms' => 2])
        ->and(Conversation::query()->where('managed_by_step', true)->count())->toBe(2);

    Http::assertSentCount(2);
    Http::assertSent(fn ($request): bool => str_contains($request->url(), 'cursor=cursor-2'));
});

test('signed STEP webhooks queue an immediate reconciliation', function () {
    Queue::fake();
    $body = json_encode(['event' => 'room.member.changed', 'room_id' => '42']);
    $timestamp = (string) now()->timestamp;
    $signature = hash_hmac('sha256', $timestamp.'.'.$body, 'webhook-secret');

    $this->call('POST', '/api/integrations/step/classrooms/sync', [], [], [], [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_X_STEP_TIMESTAMP' => $timestamp,
        'HTTP_X_STEP_SIGNATURE' => $signature,
    ], $body)->assertAccepted();

    Queue::assertPushed(
        SyncStepClassroomsJob::class,
        fn (SyncStepClassroomsJob $job): bool => $job->roomId === '42',
    );
});

test('unsigned STEP webhooks are rejected', function () {
    $this->postJson('/api/integrations/step/classrooms/sync', [
        'event' => 'room.changed',
        'room_id' => '42',
    ])->assertUnauthorized();
});
