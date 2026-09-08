<?php

use App\Enums\NoticeCategory;
use App\Enums\SchoolRole;
use App\Models\User;

test('team members can view current notices by category', function () {
    $user = User::factory()->create();
    $team = $user->currentTeam;

    $announcement = $team->notices()->create([
        'author_id' => $user->id,
        'category' => NoticeCategory::Announcement,
        'title' => 'Enrollment schedule',
        'body' => 'Enrollment opens on Monday.',
        'published_at' => now()->subMinute(),
    ]);

    $team->notices()->create([
        'author_id' => $user->id,
        'category' => NoticeCategory::Event,
        'title' => 'Expired event',
        'body' => 'This event has ended.',
        'published_at' => now()->subWeek(),
        'expires_at' => now()->subDay(),
    ]);

    $this
        ->actingAs($user)
        ->getJson("/api/teams/{$team->slug}/notices?category=announcement")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $announcement->id)
        ->assertJsonPath('data.0.category', NoticeCategory::Announcement->value)
        ->assertJsonPath('data.0.author.id', $user->id);
});

test('teachers and admins can publish notices while students cannot', function () {
    $teacher = User::factory()->create(['school_role' => SchoolRole::Teacher]);
    $teacherTeam = $teacher->currentTeam;

    $this
        ->actingAs($teacher)
        ->postJson("/api/teams/{$teacherTeam->slug}/notices", [
            'category' => NoticeCategory::Reminder->value,
            'title' => 'Bring your ID',
            'body' => 'Students should bring their school ID tomorrow.',
        ])
        ->assertCreated()
        ->assertJsonPath('data.category', NoticeCategory::Reminder->value)
        ->assertJsonPath('data.author.id', $teacher->id);

    $this->assertDatabaseHas('notices', [
        'team_id' => $teacherTeam->id,
        'author_id' => $teacher->id,
        'title' => 'Bring your ID',
    ]);

    $student = User::factory()->create(['school_role' => SchoolRole::Student]);

    $this
        ->actingAs($student)
        ->postJson("/api/teams/{$student->currentTeam->slug}/notices", [
            'category' => NoticeCategory::Announcement->value,
            'title' => 'Unauthorized notice',
            'body' => 'Students cannot publish this.',
        ])
        ->assertForbidden();
});

test('users cannot read notices from teams they do not belong to', function () {
    $member = User::factory()->create();
    $outsider = User::factory()->create();

    $this
        ->actingAs($outsider)
        ->getJson("/api/teams/{$member->currentTeam->slug}/notices")
        ->assertForbidden();
});
