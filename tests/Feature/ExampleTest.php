<?php

test('redirects the root page to login', function () {
    $response = $this->get(route('home'));

    $response->assertRedirect(route('login'));
});

test('support page is available without signing in', function () {
    $this->get(route('support'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('support'));
});
