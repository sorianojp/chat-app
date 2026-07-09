<?php

use App\Enums\ConversationType;
use App\Enums\TeamRole;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

function conversationForUsers(User $sender, User $recipient, Team $team): Conversation
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

test('conversation participants can send messages with attachments', function () {
    Storage::fake('local');

    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = conversationForUsers($sender, $recipient, $team);

    $response = $this
        ->actingAs($sender)
        ->post("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages", [
            'body' => 'Please check this file.',
            'attachments' => [
                UploadedFile::fake()->create('report.pdf', 64, 'application/pdf'),
            ],
        ]);

    $response
        ->assertCreated()
        ->assertJsonPath('data.body', 'Please check this file.')
        ->assertJsonPath('data.attachments.0.name', 'report.pdf')
        ->assertJsonPath('data.attachments.0.mime_type', 'application/pdf');

    $attachment = Message::firstOrFail()->attachments()->firstOrFail();

    Storage::disk('local')->assertExists($attachment->path);
});

test('messages can contain only attachments', function () {
    Storage::fake('local');

    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = conversationForUsers($sender, $recipient, $team);

    $response = $this
        ->actingAs($sender)
        ->post("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages", [
            'attachments' => [
                UploadedFile::fake()->create('requirements.docx', 24, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
            ],
        ]);

    $response
        ->assertCreated()
        ->assertJsonPath('data.type', 'attachment')
        ->assertJsonPath('data.body', '')
        ->assertJsonCount(1, 'data.attachments');
});

test('attachment downloads require conversation access', function () {
    Storage::fake('local');

    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $outsider = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = conversationForUsers($sender, $recipient, $team);

    $message = $conversation->messages()->create([
        'sender_id' => $sender->id,
        'type' => 'attachment',
        'body' => '',
    ]);

    Storage::disk('local')->put('message-attachments/test/report.pdf', 'report');

    $attachment = $message->attachments()->create([
        'disk' => 'local',
        'path' => 'message-attachments/test/report.pdf',
        'original_name' => 'report.pdf',
        'mime_type' => 'application/pdf',
        'size' => 6,
    ]);

    $this
        ->actingAs($recipient)
        ->get("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages/{$message->id}/attachments/{$attachment->id}")
        ->assertOk();

    $this
        ->actingAs($outsider)
        ->get("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages/{$message->id}/attachments/{$attachment->id}")
        ->assertForbidden();
});
