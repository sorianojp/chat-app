<?php

use App\Enums\ConversationType;
use App\Enums\TeamRole;
use App\Models\Conversation;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

function interactiveConversation(User $owner, User $member, Team $team, ConversationType $type = ConversationType::Group): Conversation
{
    $team->members()->attach($owner, ['role' => TeamRole::Owner->value]);
    $team->members()->attach($member, ['role' => TeamRole::Member->value]);

    $conversation = $team->conversations()->create([
        'created_by' => $owner->id,
        'type' => $type,
        'title' => $type === ConversationType::Group ? 'Planning' : null,
    ]);
    $conversation->participants()->attach($owner, ['role' => 'owner']);
    $conversation->participants()->attach($member, ['role' => 'member']);

    return $conversation;
}

test('participants can create polls and vote', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = interactiveConversation($owner, $member, $team);

    $created = $this->actingAs($owner)->postJson(
        "/api/teams/{$team->slug}/conversations/{$conversation->id}/polls",
        [
            'question' => 'Which date works?',
            'options' => ['Monday', 'Tuesday'],
            'allow_multiple' => false,
        ],
    );

    $created
        ->assertCreated()
        ->assertJsonPath('data.type', 'poll')
        ->assertJsonPath('data.poll.question', 'Which date works?')
        ->assertJsonCount(2, 'data.poll.options');

    $messageId = $created->json('data.id');
    $optionId = $created->json('data.poll.options.0.id');

    $this->actingAs($member)
        ->patchJson(
            "/api/teams/{$team->slug}/conversations/{$conversation->id}/messages/{$messageId}/poll-vote",
            ['option_ids' => [$optionId]],
        )
        ->assertOk()
        ->assertJsonPath('data.poll.options.0.vote_count', 1)
        ->assertJsonPath('data.poll.options.0.voted_by_me', true)
        ->assertJsonPath('data.poll.total_voters', 1);
});

test('participants can create events and update their rsvp', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = interactiveConversation($owner, $member, $team);

    $created = $this->actingAs($owner)->postJson(
        "/api/teams/{$team->slug}/conversations/{$conversation->id}/events",
        [
            'title' => 'Parents meeting',
            'description' => 'Quarterly progress review',
            'starts_at' => now()->addDay()->toISOString(),
            'location' => 'Room 201',
        ],
    );

    $created
        ->assertCreated()
        ->assertJsonPath('data.type', 'event')
        ->assertJsonPath('data.event.title', 'Parents meeting')
        ->assertJsonPath('data.event.location', 'Room 201');

    $messageId = $created->json('data.id');

    $this->actingAs($member)
        ->patchJson(
            "/api/teams/{$team->slug}/conversations/{$conversation->id}/messages/{$messageId}/rsvp",
            ['status' => 'attending'],
        )
        ->assertOk()
        ->assertJsonPath('data.event.my_response', 'attending')
        ->assertJsonCount(1, 'data.event.responses.attending');
});

test('group owners can update the photo and participant nicknames', function () {
    Storage::fake('local');
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = interactiveConversation($owner, $member, $team);

    $this->actingAs($owner)
        ->post("/api/teams/{$team->slug}/conversations/{$conversation->id}/photo", [
            'photo' => UploadedFile::fake()->image('group.jpg', 300, 300),
        ])
        ->assertOk()
        ->assertJsonPath('data.photo_url', fn ($value) => is_string($value));

    $conversation->refresh();
    Storage::disk('local')->assertExists($conversation->photo_path);

    $this->actingAs($owner)
        ->patchJson(
            "/api/teams/{$team->slug}/conversations/{$conversation->id}/members/{$member->id}/nickname",
            ['nickname' => 'Class Representative'],
        )
        ->assertOk()
        ->assertJsonPath(
            'data.participants.1.nickname',
            fn ($value) => $value === null || $value === 'Class Representative',
        );

    expect(DB::table('conversation_participants')
        ->where('conversation_id', $conversation->id)
        ->where('user_id', $member->id)
        ->value('nickname'))->toBe('Class Representative');

    $this->actingAs($member)
        ->deleteJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/photo")
        ->assertForbidden();
});

test('messages store rich previews for public links', function () {
    config(['messenger.fetch_link_previews_in_tests' => true]);
    Http::fake([
        'http://93.184.216.34/page' => Http::response(<<<'HTML'
            <html><head>
            <meta property="og:title" content="Permission Form">
            <meta property="og:description" content="Submit the school permission form online.">
            <title>Fallback title</title>
            </head></html>
            HTML, 200, ['Content-Type' => 'text/html']),
    ]);
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = interactiveConversation($owner, $member, $team, ConversationType::Direct);

    $this->actingAs($owner)
        ->postJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages", [
            'body' => 'Open http://93.184.216.34/page',
        ])
        ->assertCreated()
        ->assertJsonPath('data.metadata.link_previews.0.title', 'Permission Form')
        ->assertJsonPath('data.metadata.link_previews.0.description', 'Submit the school permission form online.');
});
