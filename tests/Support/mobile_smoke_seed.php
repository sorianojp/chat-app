<?php

// Invoked only by step_messenger/tool/check_backend.py against its temporary DB.
use App\Enums\SchoolRole;
use App\Models\Team;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;

require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$root = getenv('STEP_SMOKE_DIR');

if (! is_string($root) || ! is_dir($root) || ! str_starts_with(basename($root), 'step-mobile-check-')
    || ! $app->environment('testing') || config('database.default') !== 'sqlite'
    || config('database.connections.sqlite.database') !== $root.'/database.sqlite') {
    throw new RuntimeException('This helper requires the isolated smoke-test database.');
}

Artisan::call('migrate', ['--force' => true]);
$alice = User::factory()->create(['name' => 'Smoke Alice', 'school_role' => SchoolRole::Teacher]);
$bob = User::factory()->create(['name' => 'Smoke Bob']);
$outsider = User::factory()->create(['name' => 'Smoke Outsider']);
$team = Team::factory()->create(['name' => 'Isolated mobile test', 'slug' => 'mobile-smoke']);
$team->members()->attach([$alice->id => ['role' => 'member'], $bob->id => ['role' => 'member']]);
$conversation = $team->conversations()->create(['type' => 'direct', 'created_by' => $alice->id]);
$conversation->participants()->attach([$alice->id => ['role' => 'owner'], $bob->id => ['role' => 'member']]);
for ($index = 0; $index < 45; $index++) {
    $conversation->messages()->create([
        'sender_id' => $alice->id, 'body' => 'History '.$index, 'type' => 'text',
        'created_at' => now()->subSeconds(60 - $index),
    ]);
}
$conversation->update(['last_message_at' => now()]);
$fixtures = [
    'base_url' => config('app.url'), 'conversation_id' => $conversation->id,
    'team_slug' => $team->slug, 'team_id' => $team->id,
];
foreach (['alice' => $alice, 'bob' => $bob, 'outsider' => $outsider] as $name => $user) {
    $fixtures[$name] = ['id' => $user->id, 'name' => $user->name,
        'token' => $user->createToken('Isolated smoke test', ['*'], now()->addMinutes(10))->plainTextToken];
}
file_put_contents($root.'/fixture.json', json_encode($fixtures, JSON_THROW_ON_ERROR));
