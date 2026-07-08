<?php

use App\Enums\ConversationType;
use App\Enums\TeamRole;
use App\Models\Team;
use App\Models\User;

test('team members can create direct conversations', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $team = Team::factory()->create();

    $team->members()->attach($sender, ['role' => TeamRole::Member->value]);
    $team->members()->attach($recipient, ['role' => TeamRole::Member->value]);

    $response = $this
        ->actingAs($sender)
        ->postJson("/api/teams/{$team->slug}/conversations", [
            'type' => ConversationType::Direct->value,
            'participant_ids' => [$recipient->id],
        ]);

    $response
        ->assertCreated()
        ->assertJsonPath('data.type', ConversationType::Direct->value)
        ->assertJsonPath('data.display_name', $recipient->name)
        ->assertJsonCount(2, 'data.participants');

    $this->assertDatabaseHas('conversation_participants', [
        'user_id' => $sender->id,
        'role' => 'owner',
    ]);

    $this->assertDatabaseHas('conversation_participants', [
        'user_id' => $recipient->id,
        'role' => 'member',
    ]);
});

test('conversation participants must belong to the team', function () {
    $sender = User::factory()->create();
    $outsider = User::factory()->create();
    $team = Team::factory()->create();

    $team->members()->attach($sender, ['role' => TeamRole::Member->value]);

    $response = $this
        ->actingAs($sender)
        ->postJson("/api/teams/{$team->slug}/conversations", [
            'type' => ConversationType::Direct->value,
            'participant_ids' => [$outsider->id],
        ]);

    $response
        ->assertUnprocessable()
        ->assertJsonValidationErrors('participant_ids');
});
