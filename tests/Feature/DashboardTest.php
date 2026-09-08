<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

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

test('team members can open the web noticeboard', function () {
    $user = User::factory()->create();
    $team = $user->currentTeam;

    $this
        ->withoutVite()
        ->actingAs($user)
        ->get(route('notices', ['current_team' => $team->slug]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('notices')
            ->where('apiBaseUrl', "/api/teams/{$team->slug}")
            ->where('workspace.id', $team->id)
            ->where('workspace.name', $team->name)
            ->where('workspace.slug', $team->slug));
});
