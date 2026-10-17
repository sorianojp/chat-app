<?php

use App\Enums\ConversationType;
use App\Enums\TeamRole;
use App\Models\Team;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('a direct chat link loads the newest messages in chronological order', function () {
    $viewer = User::factory()->create();
    $sender = User::factory()->create();
    $team = Team::factory()->create();
    $team->members()->attach($viewer, ['role' => TeamRole::Member->value]);
    $team->members()->attach($sender, ['role' => TeamRole::Member->value]);
    $conversation = $team->conversations()->create([
        'created_by' => $sender->id,
        'type' => ConversationType::Direct,
    ]);
    $conversation->participants()->attach($viewer, ['role' => 'member']);
    $conversation->participants()->attach($sender, ['role' => 'owner']);

    $messageIds = [];

    for ($number = 1; $number <= 82; $number++) {
        $messageIds[] = $conversation->messages()->create([
            'sender_id' => $sender->id,
            'type' => 'text',
            'body' => "Message {$number}",
        ])->id;
    }

    $this->actingAs($viewer)
        ->get(route('messenger', ['current_team' => $team->slug, 'conversation' => $conversation->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('messenger')
            ->where('initialConversationId', $conversation->id)
            ->has('initialMessages', 80)
            ->where('initialHasOlderMessages', true)
            ->where('initialMessages.0.id', $messageIds[2])
            ->where('initialMessages.79.id', $messageIds[81])
            ->where('conversations.0.unread_count', 82)
            ->where('conversations.0.last_read_at', null));
});
