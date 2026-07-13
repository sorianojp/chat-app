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

test('conversation participants can view shared media links and files', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = conversationForMessageInteractions($sender, $recipient, $team);

    $linkMessage = $conversation->messages()->create([
        'sender_id' => $sender->id,
        'type' => 'text',
        'body' => 'Please check https://example.com/forms.',
    ]);
    $mediaMessage = $conversation->messages()->create([
        'sender_id' => $sender->id,
        'type' => 'attachment',
        'body' => '',
    ]);
    $fileMessage = $conversation->messages()->create([
        'sender_id' => $recipient->id,
        'type' => 'attachment',
        'body' => '',
    ]);

    $mediaMessage->attachments()->create([
        'disk' => 'local',
        'path' => 'message-attachments/test/photo.jpg',
        'original_name' => 'photo.jpg',
        'mime_type' => 'image/jpeg',
        'size' => 100,
    ]);
    $fileMessage->attachments()->create([
        'disk' => 'local',
        'path' => 'message-attachments/test/guide.pdf',
        'original_name' => 'guide.pdf',
        'mime_type' => 'application/pdf',
        'size' => 200,
    ]);

    $response = $this
        ->actingAs($recipient)
        ->getJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/shared");

    $response
        ->assertOk()
        ->assertJsonPath('data.media.0.name', 'photo.jpg')
        ->assertJsonPath('data.files.0.name', 'guide.pdf')
        ->assertJsonPath('data.links.0.url', 'https://example.com/forms')
        ->assertJsonPath('data.links.0.host', 'example.com')
        ->assertJsonPath('data.links.0.message_id', $linkMessage->id);
});

test('shared content requires conversation access', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $outsider = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = conversationForMessageInteractions($sender, $recipient, $team);

    $this
        ->actingAs($outsider)
        ->getJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/shared")
        ->assertForbidden();
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

test('conversation participants can pin and unpin messages', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = conversationForMessageInteractions($sender, $recipient, $team);
    $message = $conversation->messages()->create([
        'sender_id' => $sender->id,
        'type' => 'text',
        'body' => 'Please keep this visible.',
    ]);

    $response = $this
        ->actingAs($recipient)
        ->patchJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages/{$message->id}/pin", [
            'pinned' => true,
        ]);

    $response
        ->assertOk()
        ->assertJsonPath('data.id', $message->id)
        ->assertJsonPath('data.pinned_by.id', $recipient->id);
    expect($response->json('data.pinned_at'))->not->toBeNull();

    $this->assertDatabaseHas('messages', [
        'id' => $message->id,
        'pinned_by' => $recipient->id,
    ]);
    expect($message->refresh()->pinned_at)->not->toBeNull();

    $this
        ->actingAs($sender)
        ->patchJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages/{$message->id}/pin", [
            'pinned' => false,
        ])
        ->assertOk()
        ->assertJsonPath('data.pinned_at', null)
        ->assertJsonPath('data.pinned_by', null);

    expect($message->refresh()->pinned_at)->toBeNull();
    expect($message->pinned_by)->toBeNull();
});

test('conversation participants can view pinned messages', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = conversationForMessageInteractions($sender, $recipient, $team);
    $olderPinned = $conversation->messages()->create([
        'sender_id' => $sender->id,
        'type' => 'text',
        'body' => 'Older pinned reminder.',
    ]);
    $olderPinned->forceFill([
        'pinned_at' => now()->subMinutes(10),
        'pinned_by' => $sender->id,
    ])->save();
    $latestPinned = $conversation->messages()->create([
        'sender_id' => $recipient->id,
        'type' => 'text',
        'body' => 'Latest pinned reminder.',
    ]);
    $latestPinned->forceFill([
        'pinned_at' => now(),
        'pinned_by' => $recipient->id,
    ])->save();
    $conversation->messages()->create([
        'sender_id' => $sender->id,
        'type' => 'text',
        'body' => 'Normal message.',
    ]);

    $response = $this
        ->actingAs($recipient)
        ->getJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages/pinned");

    $response
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.id', $latestPinned->id)
        ->assertJsonPath('data.0.pinned_by.id', $recipient->id)
        ->assertJsonPath('data.1.id', $olderPinned->id);
});

test('pinned messages require conversation access', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $outsider = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = conversationForMessageInteractions($sender, $recipient, $team);

    $this
        ->actingAs($outsider)
        ->getJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages/pinned")
        ->assertForbidden();
});

test('conversation participants cannot pin unsent or system messages', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = conversationForMessageInteractions($sender, $recipient, $team);
    $unsent = $conversation->messages()->create([
        'sender_id' => $sender->id,
        'type' => 'text',
        'body' => '',
    ]);
    $unsent->forceFill(['unsent_at' => now()])->save();
    $system = $conversation->messages()->create([
        'sender_id' => null,
        'type' => 'system',
        'body' => 'Maria changed the group name.',
    ]);

    $this
        ->actingAs($recipient)
        ->patchJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages/{$unsent->id}/pin", [
            'pinned' => true,
        ])
        ->assertUnprocessable();

    $this
        ->actingAs($recipient)
        ->patchJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages/{$system->id}/pin", [
            'pinned' => true,
        ])
        ->assertUnprocessable();
});

test('senders can reply to messages', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = conversationForMessageInteractions($sender, $recipient, $team);
    $original = $conversation->messages()->create([
        'sender_id' => $recipient->id,
        'type' => 'text',
        'body' => 'Please confirm this reminder.',
    ]);

    $response = $this
        ->actingAs($sender)
        ->postJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages", [
            'body' => 'Confirmed.',
            'reply_to_message_id' => $original->id,
        ]);

    $response
        ->assertCreated()
        ->assertJsonPath('data.reply_to.id', $original->id)
        ->assertJsonPath('data.reply_to.body', 'Please confirm this reminder.')
        ->assertJsonPath('data.reply_to.sender.id', $recipient->id);
});

test('conversation participants can forward messages to another conversation', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $otherRecipient = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = conversationForMessageInteractions($sender, $recipient, $team);

    $team->members()->attach($otherRecipient, ['role' => TeamRole::Member->value]);
    $targetConversation = $team->conversations()->create([
        'created_by' => $sender->id,
        'type' => ConversationType::Direct,
    ]);
    $targetConversation->participants()->attach($sender, ['role' => 'owner']);
    $targetConversation->participants()->attach($otherRecipient, ['role' => 'member']);

    $message = $conversation->messages()->create([
        'sender_id' => $recipient->id,
        'type' => 'text',
        'body' => 'Please forward this reminder.',
    ]);

    $response = $this
        ->actingAs($sender)
        ->postJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages/{$message->id}/forward", [
            'conversation_ids' => [$targetConversation->id],
        ]);

    $response
        ->assertCreated()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.conversation_id', $targetConversation->id)
        ->assertJsonPath('data.0.sender.id', $sender->id)
        ->assertJsonPath('data.0.body', 'Please forward this reminder.')
        ->assertJsonPath('data.0.metadata.forwarded_from_message_id', $message->id);

    $this->assertDatabaseHas('messages', [
        'conversation_id' => $targetConversation->id,
        'sender_id' => $sender->id,
        'body' => 'Please forward this reminder.',
    ]);
});

test('senders can edit their own text messages', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = conversationForMessageInteractions($sender, $recipient, $team);
    $message = $conversation->messages()->create([
        'sender_id' => $sender->id,
        'type' => 'text',
        'body' => 'Old reminder.',
    ]);

    $response = $this
        ->actingAs($sender)
        ->patchJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages/{$message->id}", [
            'body' => 'Updated reminder.',
        ]);

    $response
        ->assertOk()
        ->assertJsonPath('data.body', 'Updated reminder.');
    expect($response->json('data.edited_at'))->not->toBeNull();

    $this->assertDatabaseHas('messages', [
        'id' => $message->id,
        'body' => 'Updated reminder.',
    ]);
});

test('senders can unsend their own messages', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = conversationForMessageInteractions($sender, $recipient, $team);
    $message = $conversation->messages()->create([
        'sender_id' => $sender->id,
        'type' => 'text',
        'body' => 'Please remove this.',
    ]);
    $message->reactions()->create([
        'user_id' => $recipient->id,
        'emoji' => '✅',
    ]);

    $response = $this
        ->actingAs($sender)
        ->deleteJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages/{$message->id}");

    $response
        ->assertOk()
        ->assertJsonPath('data.body', '')
        ->assertJsonCount(0, 'data.reactions');
    expect($response->json('data.unsent_at'))->not->toBeNull();

    expect($message->refresh()->unsent_at)->not->toBeNull();
    $this->assertDatabaseMissing('message_reactions', [
        'message_id' => $message->id,
        'user_id' => $recipient->id,
    ]);
});

test('users cannot edit or unsend messages from another sender', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = conversationForMessageInteractions($sender, $recipient, $team);
    $message = $conversation->messages()->create([
        'sender_id' => $sender->id,
        'type' => 'text',
        'body' => 'Original.',
    ]);

    $this
        ->actingAs($recipient)
        ->patchJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages/{$message->id}", [
            'body' => 'Changed by recipient.',
        ])
        ->assertForbidden();

    $this
        ->actingAs($recipient)
        ->deleteJson("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages/{$message->id}")
        ->assertForbidden();
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
