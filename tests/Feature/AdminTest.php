<?php

use App\Enums\ConversationType;
use App\Enums\SchoolRole;
use App\Enums\TeamRole;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

function adminConversationFixture(): array
{
    $team = Team::factory()->create();
    $alice = User::factory()->create(['name' => 'Alice', 'last_seen_at' => now()->subMinute()]);
    $bob = User::factory()->create(['name' => 'Bob', 'last_seen_at' => now()->subHour()]);
    $team->members()->attach([$alice->id => ['role' => TeamRole::Member->value], $bob->id => ['role' => TeamRole::Member->value]]);
    $conversation = $team->conversations()->create(['created_by' => $alice->id, 'type' => ConversationType::Direct, 'last_message_at' => now()]);
    $conversation->participants()->attach([$alice->id => ['role' => 'owner'], $bob->id => ['role' => 'member']]);
    $conversation->messages()->create(['sender_id' => $alice->id, 'type' => 'text', 'body' => 'Private hello']);

    return [$alice, $bob, $conversation];
}

test('only super admins can open the admin area', function () {
    [$alice, , $conversation] = adminConversationFixture();
    $schoolAdmin = User::factory()->create(['school_role' => SchoolRole::Admin]);

    foreach ([$alice, $schoolAdmin] as $user) {
        $this->actingAs($user)->get('/admin/users')->assertForbidden();
        $this->actingAs($user)->get("/admin/users/{$alice->id}")->assertForbidden();
        $this->actingAs($user)->get("/admin/conversations/{$conversation->id}")->assertForbidden();
    }

    expect(DB::table('admin_access_logs')->count())->toBe(0);
});

test('super admins see every user with online status and can filter by it', function () {
    [$alice, $bob] = adminConversationFixture();
    $admin = User::factory()->create(['school_role' => SchoolRole::SuperAdmin]);

    $this->actingAs($admin)->get('/admin/users')->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/users')
            ->where('counts.total', 3)
            ->where('counts.online', 1)
            ->where('users.data.0.id', $alice->id)
            ->where('users.data.0.online', true)
            ->where('users.data.1.id', $bob->id)
            ->where('users.data.1.online', false));

    $this->actingAs($admin)->get('/admin/users?status=online')->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('users.data', 1)->where('users.data.0.id', $alice->id));
    $this->actingAs($admin)->get('/admin/users?status=offline&search=Bob')->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('users.data', 1)->where('users.data.0.id', $bob->id));
});

test('super admins can read a conversation and the access is logged', function () {
    [$alice, , $conversation] = adminConversationFixture();
    $admin = User::factory()->create(['school_role' => SchoolRole::SuperAdmin]);

    $this->actingAs($admin)->get("/admin/users/{$alice->id}")->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/user')
            ->where('conversations.data.0.id', $conversation->id)
            ->where('conversations.data.0.title', 'Bob')
            ->where('conversations.data.0.messages_count', 1));

    $this->actingAs($admin)->get("/admin/conversations/{$conversation->id}")->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/conversation')
            ->has('conversation.participants', 2)
            ->where('messages.data.0.body', 'Private hello')
            ->where('messages.data.0.sender.name', 'Alice'));

    expect(DB::table('admin_access_logs')->where([
        'admin_id' => $admin->id,
        'action' => 'view_conversation',
        'subject_id' => $conversation->id,
    ])->count())->toBe(1);
});
