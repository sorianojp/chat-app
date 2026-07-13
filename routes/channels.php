<?php

use App\Models\Conversation;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('conversations.{conversationId}', function (User $user, int $conversationId) {
    $canJoin = Conversation::query()
        ->whereKey($conversationId)
        ->whereHas('participants', fn ($query) => $query->whereKey($user->id))
        ->exists();

    if (! $canJoin) {
        return false;
    }

    return [
        'id' => $user->id,
        'name' => $user->name,
        'email' => $user->email,
        'school_role' => $user->school_role->value,
    ];
});

Broadcast::channel('teams.{teamId}.notices', function (User $user, int $teamId) {
    return Team::query()
        ->whereKey($teamId)
        ->whereHas('members', fn ($query) => $query->whereKey($user->id))
        ->exists();
});

Broadcast::channel('teams.{teamId}.presence', function (User $user, int $teamId) {
    $canJoin = Team::query()
        ->whereKey($teamId)
        ->whereHas('members', fn ($query) => $query->whereKey($user->id))
        ->exists();

    if (! $canJoin) {
        return false;
    }

    return [
        'id' => $user->id,
        'name' => $user->name,
        'email' => $user->email,
        'school_role' => $user->school_role->value,
    ];
});
