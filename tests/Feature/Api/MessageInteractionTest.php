<?php

use App\Enums\ConversationType;
use App\Enums\TeamRole;
use App\Models\Conversation;
use App\Models\Team;
use App\Models\User;

function conversationForMessageInteractions(User $sender, User $recipient, Team $team): Conversation
{
    $team->members()->attach($sender, ['role' => TeamRole::Member->value]);
    $team->members()->attach($recipient, ['role' => TeamRole::Member->value]);

    $conversation = $team->conversations()->create([
        'created_by' => $sender->id,
        'type' => ConversationType::Direct,
    ]);

    $conversation->participants()->attach($sender, ['role' => 'owner']);
    $conversation->participants()->attach($recipient, ['role' => 'member']);

    return $conversation;
}

test('conversation participants can search messages by body and attachment name', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = conversationForMessageInteractions($sender, $recipient, $team);

    $matchedByBody = $conversation->messages()->create([
        'sender_id' => $sender->id,
        'type' => 'text',
        'body' => 'Please bring the science project tomorrow.',
    ]);
    $matchedByAttachment = $conversation->messages()->create([
        'sender_id' => $recipient->id,
        'type' => 'attachment',
        'body' => '',
    ]);
    $conversation->messages()->create([
        'sender_id' => $sender->id,
        'type' => 'text',
        'body' => 'Lunch schedule is ready.',
    ]);
    $matchedByAttachment->attachments()->create([
        'disk' => 'local',
        'path' => 'message-attachments/test/permission-slip.pdf',
        'original_name' => 'permission-slip.pdf',
        'mime_type' => 'application/pdf',
        'size' => 10,
    ]);

    $bodyResponse = $this
        ->actingAs($recipient)
        ->getJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages?search=science");

    $bodyResponse
        ->assertOk()
        ->assertJsonPath('data.0.id', $matchedByBody->id);

    $attachmentResponse = $this
        ->actingAs($sender)
        ->getJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages?search=permission");

    $attachmentResponse
        ->assertOk()
        ->assertJsonPath('data.0.id', $matchedByAttachment->id);
});

test('conversation participants can add update and remove reactions', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = conversationForMessageInteractions($sender, $recipient, $team);
    $message = $conversation->messages()->create([
        'sender_id' => $sender->id,
        'type' => 'text',
        'body' => 'Reminder received.',
    ]);

    $this
        ->actingAs($recipient)
        ->patchJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages/{$message->id}/reaction", [
            'emoji' => '✅',
        ])
        ->assertOk()
        ->assertJsonPath('data.reactions.0.emoji', '✅')
        ->assertJsonPath('data.reactions.0.count', 1)
        ->assertJsonPath('data.reactions.0.reacted_by_me', true);

    $this->assertDatabaseHas('message_reactions', [
        'message_id' => $message->id,
        'user_id' => $recipient->id,
        'emoji' => '✅',
    ]);

    $this
        ->actingAs($recipient)
        ->patchJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages/{$message->id}/reaction", [
            'emoji' => '🙏',
        ])
        ->assertOk()
        ->assertJsonPath('data.reactions.0.emoji', '🙏');

    $this
        ->actingAs($recipient)
        ->deleteJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages/{$message->id}/reaction")
        ->assertOk()
        ->assertJsonCount(0, 'data.reactions');
});

test('marking a conversation as read creates message read receipts', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = conversationForMessageInteractions($sender, $recipient, $team);
    $message = $conversation->messages()->create([
        'sender_id' => $sender->id,
        'type' => 'text',
        'body' => 'Please confirm.',
    ]);
    $ownMessage = $conversation->messages()->create([
        'sender_id' => $recipient->id,
        'type' => 'text',
        'body' => 'I will check.',
    ]);

    $this
        ->actingAs($recipient)
        ->patchJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/read")
        ->assertOk();

    $this->assertDatabaseHas('message_reads', [
        'message_id' => $message->id,
        'user_id' => $recipient->id,
    ]);
    $this->assertDatabaseMissing('message_reads', [
        'message_id' => $ownMessage->id,
        'user_id' => $recipient->id,
    ]);

    $response = $this
        ->actingAs($sender)
        ->getJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages");

    $response
        ->assertOk()
        ->assertJsonPath('data.1.id', $message->id)
        ->assertJsonPath('data.1.read_by.0.id', $recipient->id);
});
