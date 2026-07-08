<?php

namespace Database\Seeders;

use App\Enums\ConversationType;
use App\Enums\NoticeCategory;
use App\Enums\SchoolRole;
use App\Enums\TeamRole;
use App\Models\Conversation;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class MessengerDemoSeeder extends Seeder
{
    /**
     * Seed demo data for the messenger app.
     */
    public function run(): void
    {
        $school = Team::firstOrCreate(
            ['slug' => 'isudd-demo-school'],
            ['name' => 'ISuDD Demo School', 'is_personal' => false],
        );

        $superAdmin = $this->user('superadmin@example.com', 'System Admin', SchoolRole::SuperAdmin);
        $schoolAdmin = $this->user('admin@example.com', 'School Admin', SchoolRole::Admin);
        $teacher = $this->user('teacher@example.com', 'Mrs. Cruz', SchoolRole::Teacher);
        $parent = $this->user('parent@example.com', 'Maria Santos', SchoolRole::Parent);
        $john = $this->user('john@example.com', 'John Dela Cruz', SchoolRole::Parent);
        $liza = $this->user('liza@example.com', 'Liza Gomez', SchoolRole::Parent);
        $ana = $this->user('ana@example.com', 'Ana Reyes', SchoolRole::Parent);

        collect([
            [$superAdmin, TeamRole::Owner],
            [$schoolAdmin, TeamRole::Owner],
            [$teacher, TeamRole::Member],
            [$parent, TeamRole::Member],
            [$john, TeamRole::Member],
            [$liza, TeamRole::Member],
            [$ana, TeamRole::Member],
        ])->each(function (array $member) use ($school): void {
            [$user, $role] = $member;

            $school->members()->syncWithoutDetaching([
                $user->id => ['role' => $role->value],
            ]);

            $user->switchTeam($school);
        });

        $class = SchoolClass::updateOrCreate(
            [
                'team_id' => $school->id,
                'grade_level' => '10',
                'section' => 'A',
                'school_year' => '2025-2026',
            ],
            [
                'name' => 'Grade 10 - Section A',
                'adviser_id' => $teacher->id,
            ],
        );

        $student = Student::updateOrCreate(
            ['team_id' => $school->id, 'student_number' => 'G10A-001'],
            [
                'first_name' => 'Miguel',
                'last_name' => 'Santos',
                'grade_level' => '10',
                'section' => 'A',
                'status' => 'active',
            ],
        );

        $class->students()->syncWithoutDetaching([$student->id]);
        $student->guardians()->syncWithoutDetaching([
            $parent->id => ['relationship' => 'mother', 'is_primary' => true],
        ]);

        $direct = Conversation::firstOrCreate(
            [
                'team_id' => $school->id,
                'type' => ConversationType::Direct,
                'title' => null,
            ],
            [
                'school_class_id' => $class->id,
                'created_by' => $teacher->id,
            ],
        );

        $direct->participants()->syncWithoutDetaching([
            $teacher->id => ['role' => 'owner'],
            $parent->id => ['role' => 'member'],
        ]);

        if ($direct->messages()->doesntExist()) {
            $direct->messages()->createMany([
                [
                    'sender_id' => $parent->id,
                    'body' => "Good morning Ma'am, I would like to ask about my child's requirement for the upcoming activity.",
                    'created_at' => now()->subMinutes(55),
                    'updated_at' => now()->subMinutes(55),
                ],
                [
                    'sender_id' => $teacher->id,
                    'body' => "Good morning po! Sure, I'd be happy to help. Which activity are you referring to?",
                    'created_at' => now()->subMinutes(45),
                    'updated_at' => now()->subMinutes(45),
                ],
            ]);
        }

        $group = Conversation::firstOrCreate(
            [
                'team_id' => $school->id,
                'type' => ConversationType::Group,
                'title' => 'Grade 10 - Section A',
            ],
            [
                'school_class_id' => $class->id,
                'created_by' => $teacher->id,
            ],
        );

        $group->participants()->syncWithoutDetaching([
            $teacher->id => ['role' => 'owner'],
            $parent->id => ['role' => 'member'],
            $john->id => ['role' => 'member'],
            $liza->id => ['role' => 'member'],
            $ana->id => ['role' => 'member'],
        ]);

        if ($group->messages()->doesntExist()) {
            $message = $group->messages()->create([
                'sender_id' => $teacher->id,
                'body' => 'Good morning parents! This is a reminder that our PT Meeting is on May 25, 2025 at 2:00 PM. See you po!',
                'created_at' => now()->subMinutes(20),
                'updated_at' => now()->subMinutes(20),
            ]);

            $group->forceFill(['last_message_at' => $message->created_at])->save();
        }

        $school->notices()->firstOrCreate([
            'title' => 'School Announcement',
            'body' => 'Intramurals 2025 schedule',
        ], [
            'school_class_id' => $class->id,
            'author_id' => $teacher->id,
            'category' => NoticeCategory::Announcement,
            'published_at' => now(),
        ]);
    }

    private function user(string $email, string $name, SchoolRole $role): User
    {
        return User::updateOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'school_role' => $role,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ],
        );
    }
}
