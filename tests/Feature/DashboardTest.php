<?php

use App\Models\User;

test('guests are redirected to the login page from the old dashboard URL', function () {
    $user = User::factory()->create();
    $team = $user->currentTeam;

    $this
        ->get(route('dashboard', ['current_team' => $team->slug]))
        ->assertRedirect(route('login'));
});

test('old dashboard URL redirects authenticated users to messenger', function () {
    $user = User::factory()->create();
    $team = $user->currentTeam;

    $this
        ->actingAs($user)
        ->get(route('dashboard', ['current_team' => $team->slug]))
        ->assertRedirect(route('messenger', ['current_team' => $team->slug]));
});
