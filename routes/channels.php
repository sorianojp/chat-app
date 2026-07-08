<?php

use App\Models\Conversation;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('conversations.{conversationId}', function (User $user, int $conversationId) {
    return Conversation::query()
        ->whereKey($conversationId)
        ->whereHas('participants', fn ($query) => $query->whereKey($user->id))
        ->exists();
});

Broadcast::channel('teams.{teamId}.notices', function (User $user, int $teamId) {
    return Team::query()
        ->whereKey($teamId)
        ->whereHas('members', fn ($query) => $query->whereKey($user->id))
        ->exists();
});
