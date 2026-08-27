<?php

use App\Models\User;

test('local registration is unavailable', function () {
    $this->get('/register')->assertNotFound();

    $this->post('/register', [
        'name' => 'Local User',
        'email' => 'local@example.edu',
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertNotFound();

    expect(User::count())->toBe(0);
    $this->assertGuest();
});

test('all local credential authentication endpoints are unavailable', function () {
    $this->post('/login', [
        'email' => 'local@example.edu',
        'password' => 'password',
    ])->assertMethodNotAllowed();

    $this->get('/forgot-password')->assertNotFound();
    $this->post('/forgot-password')->assertNotFound();
    $this->get('/user/confirm-password')->assertNotFound();
    $this->post('/user/confirm-password')->assertNotFound();
    $this->get('/two-factor-challenge')->assertNotFound();
    $this->post('/two-factor-challenge')->assertNotFound();
});
