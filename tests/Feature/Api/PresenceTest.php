<?php

use App\Enums\TeamRole;
use App\Models\Team;
use App\Models\User;

test('team members can update their last seen timestamp', function () {
    $user = User::factory()->create(['last_seen_at' => null]);
    $team = Team::factory()->create();

    $team->members()->attach($user, ['role' => TeamRole::Member->value]);

    $this
        ->actingAs($user)
        ->postJson("/api/teams/{$team->slug}/presence")
        ->assertOk()
        ->assertJsonStructure(['data' => ['last_seen_at']]);

    expect($user->fresh()->last_seen_at)->not->toBeNull();
});

test('users cannot update presence for a team they do not belong to', function () {
    $user = User::factory()->create(['last_seen_at' => null]);
    $team = Team::factory()->create();

    $this
        ->actingAs($user)
        ->postJson("/api/teams/{$team->slug}/presence")
        ->assertForbidden();

    expect($user->fresh()->last_seen_at)->toBeNull();
});
