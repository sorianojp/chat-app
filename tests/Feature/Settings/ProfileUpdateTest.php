<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('STEP profile page is read only', function () {
    $user = User::factory()->create([
        'step_user_id' => 'step-42',
        'step_roles' => ['Teacher'],
    ]);

    config(['services.step_sso.account_url' => 'https://step.test/account']);

    $this->actingAs($user)
        ->get(route('profile.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/profile')
            ->where('stepAccountUrl', 'https://step.test/account'),
        );
});

test('local profile mutation account deletion and security routes are unavailable', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch('/settings/profile', [
            'name' => 'Changed Locally',
            'email' => 'changed@example.edu',
        ])->assertMethodNotAllowed();

    $this->actingAs($user)
        ->delete('/settings/profile', ['password' => 'password'])
        ->assertMethodNotAllowed();

    $this->actingAs($user)->get('/settings/security')->assertNotFound();
    $this->actingAs($user)->put('/settings/password')->assertNotFound();

    expect($user->fresh()->name)->not->toBe('Changed Locally');
});
