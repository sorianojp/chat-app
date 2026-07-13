<?php

use App\Enums\ConversationType;
use App\Enums\TeamRole;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\DB;

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

test('conversation participants can pin and mute conversations', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $team = Team::factory()->create();

    $team->members()->attach($sender, ['role' => TeamRole::Member->value]);
    $team->members()->attach($recipient, ['role' => TeamRole::Member->value]);

    $conversation = $team->conversations()->create([
        'created_by' => $sender->id,
        'type' => ConversationType::Direct,
    ]);
    $conversation->participants()->attach($sender, ['role' => 'owner']);
    $conversation->participants()->attach($recipient, ['role' => 'member']);

    $this
        ->actingAs($sender)
        ->patchJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/pin", [
            'pinned' => true,
        ])
        ->assertOk();

    $this
        ->actingAs($sender)
        ->patchJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/mute", [
            'muted' => true,
        ])
        ->assertOk();

    $participant = DB::table('conversation_participants')
        ->where('conversation_id', $conversation->id)
        ->where('user_id', $sender->id)
        ->first();

    expect($participant->pinned_at)->not->toBeNull();
    expect($participant->muted_at)->not->toBeNull();

    $this
        ->actingAs($sender)
        ->patchJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/pin", [
            'pinned' => false,
        ])
        ->assertOk()
        ->assertJsonPath('data.pinned_at', null);

    $this
        ->actingAs($sender)
        ->patchJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/mute", [
            'muted' => false,
        ])
        ->assertOk()
        ->assertJsonPath('data.muted_at', null);
});

test('conversation participants can archive restore and delete archived conversations', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $team = Team::factory()->create();

    $team->members()->attach($sender, ['role' => TeamRole::Member->value]);
    $team->members()->attach($recipient, ['role' => TeamRole::Member->value]);

    $conversation = $team->conversations()->create([
        'created_by' => $sender->id,
        'type' => ConversationType::Direct,
    ]);
    $conversation->participants()->attach($sender, ['role' => 'owner']);
    $conversation->participants()->attach($recipient, ['role' => 'member']);

    $this
        ->actingAs($sender)
        ->deleteJson("/api/teams/{$team->slug}/conversations/{$conversation->id}")
        ->assertUnprocessable();

    $this
        ->actingAs($sender)
        ->patchJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/archive", [
            'archived' => true,
        ])
        ->assertOk();

    $participant = DB::table('conversation_participants')
        ->where('conversation_id', $conversation->id)
        ->where('user_id', $sender->id)
        ->first();

    expect($participant->archived_at)->not->toBeNull();

    $this
        ->actingAs($sender)
        ->patchJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/archive", [
            'archived' => false,
        ])
        ->assertOk()
        ->assertJsonPath('data.archived_at', null);

    expect(
        DB::table('conversation_participants')
            ->where('conversation_id', $conversation->id)
            ->where('user_id', $sender->id)
            ->value('archived_at'),
    )->toBeNull();

    $this
        ->actingAs($sender)
        ->patchJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/archive", [
            'archived' => true,
        ])
        ->assertOk();

    $this
        ->actingAs($sender)
        ->deleteJson("/api/teams/{$team->slug}/conversations/{$conversation->id}")
        ->assertOk()
        ->assertJsonPath('data.deleted', true);

    $this->assertDatabaseMissing('conversation_participants', [
        'conversation_id' => $conversation->id,
        'user_id' => $sender->id,
    ]);

    $this->assertDatabaseHas('conversation_participants', [
        'conversation_id' => $conversation->id,
        'user_id' => $recipient->id,
    ]);
});

test('group owners can manage details and members', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $newMember = User::factory()->create();
    $team = Team::factory()->create();

    $team->members()->attach($owner, ['role' => TeamRole::Owner->value]);
    $team->members()->attach($member, ['role' => TeamRole::Member->value]);
    $team->members()->attach($newMember, ['role' => TeamRole::Member->value]);

    $conversation = $team->conversations()->create([
        'created_by' => $owner->id,
        'type' => ConversationType::Group,
        'title' => 'Old group name',
    ]);
    $conversation->participants()->attach($owner, ['role' => 'owner']);
    $conversation->participants()->attach($member, ['role' => 'member']);

    $this
        ->actingAs($owner)
        ->patchJson("/api/teams/{$team->slug}/conversations/{$conversation->id}", [
            'title' => 'Grade 10 Parents',
        ])
        ->assertOk()
        ->assertJsonPath('data.title', 'Grade 10 Parents')
        ->assertJsonPath('data.display_name', 'Grade 10 Parents')
        ->assertJsonPath('system_message.type', 'system')
        ->assertJsonPath('system_message.body', "{$owner->name} changed the group name to Grade 10 Parents.");

    $this
        ->actingAs($owner)
        ->postJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/members", [
            'user_ids' => [$newMember->id],
        ])
        ->assertOk()
        ->assertJsonCount(3, 'data.participants')
        ->assertJsonPath('system_message.type', 'system')
        ->assertJsonPath('system_message.body', "{$owner->name} added {$newMember->name} to the group.");

    $this->assertDatabaseHas('conversation_participants', [
        'conversation_id' => $conversation->id,
        'user_id' => $newMember->id,
        'role' => 'member',
        'notification_preference' => 'all',
    ]);

    $this
        ->actingAs($owner)
        ->deleteJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/members/{$member->id}")
        ->assertOk()
        ->assertJsonPath('system_message.type', 'system')
        ->assertJsonPath('system_message.body', "{$owner->name} removed {$member->name} from the group.");

    $this->assertDatabaseMissing('conversation_participants', [
        'conversation_id' => $conversation->id,
        'user_id' => $member->id,
    ]);

    $this->assertDatabaseHas('messages', [
        'conversation_id' => $conversation->id,
        'sender_id' => null,
        'type' => 'system',
        'body' => "{$owner->name} changed the group name to Grade 10 Parents.",
    ]);

    $this->assertDatabaseHas('messages', [
        'conversation_id' => $conversation->id,
        'sender_id' => null,
        'type' => 'system',
        'body' => "{$owner->name} added {$newMember->name} to the group.",
    ]);

    $this->assertDatabaseHas('messages', [
        'conversation_id' => $conversation->id,
        'sender_id' => null,
        'type' => 'system',
        'body' => "{$owner->name} removed {$member->name} from the group.",
    ]);
});

test('group members cannot manage group details or members', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $newMember = User::factory()->create();
    $team = Team::factory()->create();

    $team->members()->attach($owner, ['role' => TeamRole::Owner->value]);
    $team->members()->attach($member, ['role' => TeamRole::Member->value]);
    $team->members()->attach($newMember, ['role' => TeamRole::Member->value]);

    $conversation = $team->conversations()->create([
        'created_by' => $owner->id,
        'type' => ConversationType::Group,
        'title' => 'Grade 10 Parents',
    ]);
    $conversation->participants()->attach($owner, ['role' => 'owner']);
    $conversation->participants()->attach($member, ['role' => 'member']);

    $this
        ->actingAs($member)
        ->patchJson("/api/teams/{$team->slug}/conversations/{$conversation->id}", [
            'title' => 'Renamed by member',
        ])
        ->assertForbidden();

    $this
        ->actingAs($member)
        ->postJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/members", [
            'user_ids' => [$newMember->id],
        ])
        ->assertForbidden();

    $this
        ->actingAs($member)
        ->deleteJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/members/{$owner->id}")
        ->assertForbidden();
});

test('conversation participants can update notification preference and leave groups', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $team = Team::factory()->create();

    $team->members()->attach($owner, ['role' => TeamRole::Owner->value]);
    $team->members()->attach($member, ['role' => TeamRole::Member->value]);

    $conversation = $team->conversations()->create([
        'created_by' => $owner->id,
        'type' => ConversationType::Group,
        'title' => 'Grade 10 Parents',
    ]);
    $conversation->participants()->attach($owner, ['role' => 'owner']);
    $conversation->participants()->attach($member, ['role' => 'member']);

    $this
        ->actingAs($member)
        ->patchJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/notifications", [
            'preference' => 'mentions',
        ])
        ->assertOk()
        ->assertJsonPath('data.notification_preference', 'mentions')
        ->assertJsonPath('data.muted_at', null);

    $this->assertDatabaseHas('conversation_participants', [
        'conversation_id' => $conversation->id,
        'user_id' => $member->id,
        'notification_preference' => 'mentions',
        'muted_at' => null,
    ]);

    $this
        ->actingAs($member)
        ->deleteJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/members/me")
        ->assertOk()
        ->assertJsonPath('data.left', true)
        ->assertJsonPath('system_message.type', 'system')
        ->assertJsonPath('system_message.body', "{$member->name} left the group.");

    $this->assertDatabaseMissing('conversation_participants', [
        'conversation_id' => $conversation->id,
        'user_id' => $member->id,
    ]);

    $this->assertDatabaseHas('messages', [
        'conversation_id' => $conversation->id,
        'sender_id' => null,
        'type' => 'system',
        'body' => "{$member->name} left the group.",
    ]);
});
