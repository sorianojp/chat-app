<?php

use App\Enums\ConversationType;
use App\Enums\TeamRole;
use App\Models\Conversation;
use App\Models\Team;
use App\Models\User;

function savedMessagesChat(Team $team, User ...$people): Conversation
{
    foreach ($people as $person) {
        $team->members()->attach($person, ['role' => TeamRole::Member->value]);
    }

    $conversation = $team->conversations()->create([
        'created_by' => $people[0]->id,
        'type' => ConversationType::Group,
        'title' => 'Science Club',
    ]);

    foreach ($people as $index => $person) {
        $conversation->participants()->attach($person, ['role' => $index === 0 ? 'owner' : 'member']);
    }

    return $conversation;
}

test('saving a message lists it in Saved and marks it saved for that user only', function () {
    $alex = User::factory()->create();
    $jane = User::factory()->create(['name' => 'Jane Teacher']);
    $team = Team::factory()->create();
    $chat = savedMessagesChat($team, $alex, $jane);
    $message = $chat->messages()->create(['sender_id' => $jane->id, 'type' => 'text', 'body' => 'Quiz on Friday']);
    $url = "/api/teams/{$team->slug}/conversations/{$chat->id}/messages/{$message->id}/save";

    $this->actingAs($alex)->putJson($url)->assertOk()->assertJsonPath('data.saved', true);
    $this->actingAs($alex)->putJson($url)->assertOk();

    $this->actingAs($alex)->getJson("/api/teams/{$team->slug}/saved-messages")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.conversation.display_name', 'Science Club')
        ->assertJsonPath('data.0.message.body', 'Quiz on Friday')
        ->assertJsonPath('data.0.message.saved_by_me', true);
    $this->actingAs($alex)->getJson("/api/teams/{$team->slug}/conversations/{$chat->id}/messages")
        ->assertJsonPath('data.0.saved_by_me', true);
    $this->actingAs($jane)->getJson("/api/teams/{$team->slug}/conversations/{$chat->id}/messages")
        ->assertJsonPath('data.0.saved_by_me', false);
    $this->actingAs($jane)->getJson("/api/teams/{$team->slug}/saved-messages")
        ->assertJsonCount(0, 'data');

    $this->actingAs($alex)->deleteJson($url)->assertOk()->assertJsonPath('data.saved', false);
    $this->actingAs($alex)->getJson("/api/teams/{$team->slug}/saved-messages")
        ->assertJsonCount(0, 'data');
});

test('unsent messages and chats you left drop out of Saved', function () {
    $alex = User::factory()->create();
    $jane = User::factory()->create();
    $team = Team::factory()->create();
    $chat = savedMessagesChat($team, $alex, $jane);
    $kept = $chat->messages()->create(['sender_id' => $jane->id, 'type' => 'text', 'body' => 'Keep']);
    $unsent = $chat->messages()->create(['sender_id' => $jane->id, 'type' => 'text', 'body' => 'Oops']);
    $other = savedMessagesChat(Team::factory()->create(), User::factory()->create(), $alex);
    $left = $other->messages()->create(['sender_id' => $alex->id, 'type' => 'text', 'body' => 'Elsewhere']);
    $alex->savedMessages()->attach([$kept->id, $unsent->id, $left->id]);

    $unsent->forceFill(['unsent_at' => now()])->save();

    $this->actingAs($alex)->getJson("/api/teams/{$team->slug}/saved-messages")
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.message.id', $kept->id);

    $chat->participants()->detach($alex->id);
    $this->actingAs($alex)->getJson("/api/teams/{$team->slug}/saved-messages")
        ->assertJsonCount(0, 'data');
});

test('only participants can save, and unsent messages cannot be saved', function () {
    $alex = User::factory()->create();
    $jane = User::factory()->create();
    $outsider = User::factory()->create();
    $team = Team::factory()->create();
    $chat = savedMessagesChat($team, $alex, $jane);
    $team->members()->attach($outsider, ['role' => TeamRole::Member->value]);
    $message = $chat->messages()->create(['sender_id' => $jane->id, 'type' => 'text', 'body' => 'Hi']);
    $url = "/api/teams/{$team->slug}/conversations/{$chat->id}/messages/{$message->id}/save";

    $this->actingAs($outsider)->putJson($url)->assertForbidden();

    $message->forceFill(['unsent_at' => now()])->save();
    $this->actingAs($alex)->putJson($url)->assertUnprocessable();
});
