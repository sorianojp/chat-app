<?php

test('returns a successful response', function () {
    $response = $this->get(route('home'));

    $response->assertOk();
});

test('support page is available without signing in', function () {
    $this->get(route('support'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('support'));
});
