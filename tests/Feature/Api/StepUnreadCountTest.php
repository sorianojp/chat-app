<?php

use App\Enums\ConversationType;
use App\Models\Conversation;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    config(['services.step_sso.unread_api_key' => 'step-secret']);
});

/**
 * A direct chat between the reader (STEP user 501) and a sender.
 *
 * @return array{0: User, 1: User, 2: Conversation}
 */
function unreadFixture(): array
{
    $reader = User::factory()->create(['step_user_id' => '501']);
    $sender = User::factory()->create();
    $team = Team::factory()->create();

    $conversation = $team->conversations()->create([
        'created_by' => $sender->id,
        'type' => ConversationType::Direct,
    ]);
    $conversation->participants()->attach($sender, ['role' => 'owner']);
    $conversation->participants()->attach($reader, ['role' => 'member']);

    return [$reader, $sender, $conversation];
}

function unreadCount(?string $key = 'step-secret', string $sub = '501'): TestResponse
{
    return test()->getJson("/api/step/unread-count?sub={$sub}", $key === null ? [] : ['X-Api-Key' => $key]);
}

test('it rejects a missing or wrong key', function () {
    unreadCount(null)->assertUnauthorized();
    unreadCount('wrong')->assertUnauthorized();
});

test('it is closed when no key is configured', function () {
    config(['services.step_sso.unread_api_key' => '']);

    unreadCount('')->assertUnauthorized();
});

test('it requires the sub', function () {
    test()->getJson('/api/step/unread-count', ['X-Api-Key' => 'step-secret'])->assertStatus(422);
});

test('an unknown STEP user has nothing unread', function () {
    unreadCount(sub: '999')->assertOk()->assertExactJson(['count' => 0]);
});

test('it counts messages from others since the reader last read', function () {
    [$reader, $sender, $conversation] = unreadFixture();

    $this->travelTo(now()->subHour());
    $conversation->messages()->create(['sender_id' => $sender->id, 'type' => 'text', 'body' => 'Old']);
    $this->travelBack();

    DB::table('conversation_participants')
        ->where('conversation_id', $conversation->id)
        ->where('user_id', $reader->id)
        ->update(['last_read_at' => now()->subMinutes(30)]);

    $conversation->messages()->create(['sender_id' => $sender->id, 'type' => 'text', 'body' => 'New 1']);
    $conversation->messages()->create(['sender_id' => $sender->id, 'type' => 'text', 'body' => 'New 2']);
    $conversation->messages()->create(['sender_id' => $reader->id, 'type' => 'text', 'body' => 'My own reply']);
    $conversation->messages()->create(['sender_id' => $sender->id, 'type' => 'text', 'body' => 'Deleted'])->delete();

    unreadCount()->assertOk()->assertExactJson(['count' => 2]);
});

test('everything is unread in a chat the reader never opened', function () {
    [, $sender, $conversation] = unreadFixture();

    $conversation->messages()->create(['sender_id' => $sender->id, 'type' => 'text', 'body' => 'Hi']);

    unreadCount()->assertOk()->assertExactJson(['count' => 1]);
});

test('muted, archived and deleted conversations are left out', function (array $pivot) {
    [$reader, $sender, $conversation] = unreadFixture();

    $conversation->messages()->create(['sender_id' => $sender->id, 'type' => 'text', 'body' => 'Hi']);

    if ($pivot === []) {
        $conversation->delete();
    } else {
        DB::table('conversation_participants')
            ->where('conversation_id', $conversation->id)
            ->where('user_id', $reader->id)
            ->update($pivot);
    }

    unreadCount()->assertOk()->assertExactJson(['count' => 0]);
})->with([
    'muted' => [['muted_at' => now()]],
    'notifications muted' => [['notification_preference' => 'muted']],
    'archived' => [['archived_at' => now()]],
    'deleted' => [[]],
]);

test('chats the reader is not in do not count', function () {
    unreadFixture();
    [, $sender, $other] = otherUsersChatFixture();

    $other->messages()->create(['sender_id' => $sender->id, 'type' => 'text', 'body' => 'Not for 501']);

    unreadCount()->assertOk()->assertExactJson(['count' => 0]);
});

/**
 * A chat between two other users.
 *
 * @return array{0: User, 1: User, 2: Conversation}
 */
function otherUsersChatFixture(): array
{
    $a = User::factory()->create();
    $b = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = $team->conversations()->create(['created_by' => $b->id, 'type' => ConversationType::Direct]);
    $conversation->participants()->attach($a, ['role' => 'member']);
    $conversation->participants()->attach($b, ['role' => 'owner']);

    return [$a, $b, $conversation];
}
