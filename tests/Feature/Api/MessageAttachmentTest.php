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

    $message = Message::firstOrFail();
    $attachment = $message->attachments()->firstOrFail();

    expect($response->json('data.attachments.0.url'))->toBe(route('messenger.attachments.download', [
        'team' => $team,
        'conversation' => $conversation,
        'message' => $message,
        'attachment' => $attachment,
    ]));
    expect($response->json('data.attachments.0.preview_url'))->toBeNull();
    expect($attachment->path)->toStartWith('message-attachments/documents/');

    Storage::disk('local')->assertExists($attachment->path);
});

test('attachments are grouped into storage folders by file type', function () {
    Storage::fake('local');

    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = conversationForUsers($sender, $recipient, $team);

    $this
        ->actingAs($sender)
        ->post("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages", [
            'attachments' => [
                UploadedFile::fake()->create('photo.jpg', 16, 'image/jpeg'),
                UploadedFile::fake()->create('clip.mp4', 16, 'video/mp4'),
                UploadedFile::fake()->create('voice.mp3', 16, 'audio/mpeg'),
                UploadedFile::fake()->create('documents.zip', 16, 'application/zip'),
                UploadedFile::fake()->create('notes.txt', 16, 'text/plain'),
            ],
        ])
        ->assertCreated();

    $paths = Message::firstOrFail()
        ->attachments()
        ->pluck('path', 'original_name');

    expect($paths['photo.jpg'])->toStartWith('message-attachments/images/')
        ->and($paths['clip.mp4'])->toStartWith('message-attachments/videos/')
        ->and($paths['voice.mp3'])->toStartWith('message-attachments/audio/')
        ->and($paths['documents.zip'])->toStartWith('message-attachments/archives/')
        ->and($paths['notes.txt'])->toStartWith('message-attachments/documents/');
});

test('attachments use the configured default filesystem disk', function () {
    config(['filesystems.default' => 's3']);
    Storage::fake('s3');

    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = conversationForUsers($sender, $recipient, $team);

    $this
        ->actingAs($sender)
        ->post("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages", [
            'attachments' => [
                UploadedFile::fake()->create('spaces-report.pdf', 64, 'application/pdf'),
            ],
        ])
        ->assertCreated();

    $attachment = Message::firstOrFail()->attachments()->firstOrFail();

    expect($attachment->disk)->toBe('s3');
    Storage::disk('s3')->assertExists($attachment->path);
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

test('attachments can be up to twenty megabytes', function () {
    Storage::fake('local');

    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = conversationForUsers($sender, $recipient, $team);

    $this
        ->actingAs($sender)
        ->post("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages", [
            'attachments' => [
                UploadedFile::fake()->create('large-report.pdf', 20 * 1024, 'application/pdf'),
            ],
        ])
        ->assertCreated()
        ->assertJsonPath('data.attachments.0.name', 'large-report.pdf');

    $this
        ->actingAs($sender)
        ->post("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages", [
            'attachments' => [
                UploadedFile::fake()->create('too-large.pdf', (20 * 1024) + 1, 'application/pdf'),
            ],
        ])
        ->assertUnprocessable()
        ->assertInvalid('attachments.0');
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
        ->get(route('messenger.attachments.download', [
            'team' => $team,
            'conversation' => $conversation,
            'message' => $message,
            'attachment' => $attachment,
        ]))
        ->assertOk();

    $this
        ->actingAs($outsider)
        ->get(route('messenger.attachments.download', [
            'team' => $team,
            'conversation' => $conversation,
            'message' => $message,
            'attachment' => $attachment,
        ]))
        ->assertForbidden();
});

test('media attachments include an inline preview url', function () {
    Storage::fake('local');

    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $team = Team::factory()->create();
    $conversation = conversationForUsers($sender, $recipient, $team);

    $response = $this
        ->actingAs($sender)
        ->post("/api/teams/{$team->slug}/conversations/{$conversation->id}/messages", [
            'attachments' => [
                UploadedFile::fake()->create('voice.mp3', 16, 'audio/mpeg'),
            ],
        ]);

    $message = Message::firstOrFail();
    $attachment = $message->attachments()->firstOrFail();

    expect($response->json('data.attachments.0.preview_url'))->toBe(route('messenger.attachments.preview', [
        'team' => $team,
        'conversation' => $conversation,
        'message' => $message,
        'attachment' => $attachment,
    ]));

    $preview = $this
        ->actingAs($recipient)
        ->get(route('messenger.attachments.preview', [
            'team' => $team,
            'conversation' => $conversation,
            'message' => $message,
            'attachment' => $attachment,
        ]));

    $preview->assertOk();
    expect($preview->headers->get('content-disposition'))->toContain('inline');
});
