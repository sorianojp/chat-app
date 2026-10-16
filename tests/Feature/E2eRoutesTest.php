<?php

use App\Models\User;

test('end-to-end helper routes are not registered outside the e2e environment', function () {
    $user = User::factory()->create();

    $this->post('/_e2e/scenario')->assertNotFound();
    $this->get("/_e2e/login/{$user->id}")->assertNotFound();
    $this->assertGuest();
});
