<?php

use App\Models\TeamInvitation;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('users can view invitations sent to their email address', function () {
    $user = User::factory()->create(['email' => 'parent@example.com']);

    TeamInvitation::factory()->create([
        'email' => 'PARENT@example.com',
        'created_at' => now()->subDays(3),
    ]);

    TeamInvitation::factory()->accepted()->create([
        'email' => 'parent@example.com',
        'created_at' => now()->subDays(2),
    ]);

    TeamInvitation::factory()->expired()->create([
        'email' => 'parent@example.com',
        'created_at' => now()->subDay(),
    ]);

    TeamInvitation::factory()->create([
        'email' => 'someone@example.com',
    ]);

    $response = $this
        ->actingAs($user)
        ->get(route('invitations.index'));

    $response
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('invitations/index')
            ->has('invitations', 3)
            ->where('invitations.0.status', 'expired')
            ->where('invitations.1.status', 'accepted')
            ->where('invitations.2.status', 'pending')
        );
});

test('guests cannot view invitations page', function () {
    $this
        ->get(route('invitations.index'))
        ->assertRedirect(route('login'));
});
