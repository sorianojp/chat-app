<?php

namespace App\Actions\Classes;

use App\Enums\ConversationType;
use App\Models\Conversation;
use App\Models\SchoolClass;
use App\Models\SchoolClassMember;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Mirrors a user's current STEP classes into Uhoo! at sign-in.
 *
 * Teachers bring the class and its roster; students only confirm the classes
 * they are in. Anyone on a roster who has a Uhoo! account is added to the
 * class chat once (when the chat is created, or on their first sign-in after
 * it exists) and never re-added after leaving it.
 */
class SyncStepClasses
{
    /**
     * @param  list<array<string, mixed>>  $classes  The `data` list from STEP's /api/v1/sso/classes.
     */
    public function handle(User $user, Team $team, array $classes): void
    {
        if ($user->step_user_id === null) {
            return;
        }

        DB::transaction(function () use ($user, $team, $classes): void {
            foreach ($classes as $class) {
                $roomId = is_scalar($class['id'] ?? null) ? (string) $class['id'] : '';

                if ($roomId === '') {
                    continue;
                }

                match ($class['role'] ?? null) {
                    'teacher' => $this->syncTaughtClass($user, $team, $roomId, $class),
                    'student' => $this->syncEnrolment($user, $team, $roomId),
                    default => null,
                };
            }
        });
    }

    /**
     * Adds everyone on the class roster who has a Uhoo! account and has not
     * been added before to the class chats, and marks them as added.
     */
    public function addRosterToChats(SchoolClass $schoolClass): void
    {
        $pending = $schoolClass->members()->whereNull('added_at')->get();
        $conversations = $this->classConversations($schoolClass);

        if ($pending->isEmpty() || $conversations->isEmpty()) {
            return;
        }

        $users = $schoolClass->team->members()
            ->whereIn('step_user_id', $pending->pluck('step_user_id'))
            ->get(['users.id', 'users.step_user_id']);

        foreach ($conversations as $conversation) {
            // attach(), not syncWithoutDetaching(): existing participants keep
            // their role (the teacher stays owner) and their preferences.
            $existing = $conversation->participants()->pluck('users.id');
            $conversation->participants()->attach(
                $users->whereNotIn('id', $existing)->mapWithKeys(fn (User $member): array => [
                    $member->id => ['role' => 'member', 'notification_preference' => 'all'],
                ])->all(),
            );
        }

        $schoolClass->members()
            ->whereIn('step_user_id', $users->pluck('step_user_id'))
            ->update(['added_at' => now()]);
    }

    /**
     * @param  array<string, mixed>  $class
     */
    private function syncTaughtClass(User $teacher, Team $team, string $roomId, array $class): void
    {
        $schoolClass = SchoolClass::query()->updateOrCreate(
            ['team_id' => $team->id, 'step_room_id' => $roomId],
            [
                'adviser_id' => $teacher->id,
                'name' => $this->text($class['name'] ?? null, 'Class'),
                'subject' => $this->text($class['subject'] ?? null) ?: null,
                'grade_level' => $this->text($class['year'] ?? null),
                'section' => $this->text($class['section'] ?? null),
                'school_year' => $this->text($class['school_year'] ?? null),
                'semester' => $this->text($class['semester'] ?? null) ?: null,
            ],
        );

        $roster = collect(is_array($class['students'] ?? null) ? $class['students'] : [])
            ->filter(fn (mixed $student): bool => is_array($student) && is_scalar($student['sub'] ?? null))
            ->mapWithKeys(fn (array $student): array => [
                (string) $student['sub'] => ['name' => $this->text($student['name'] ?? null, 'Student'), 'role' => 'student'],
            ])
            ->put((string) $teacher->step_user_id, ['name' => $teacher->name, 'role' => 'teacher']);

        // Students who left the STEP class leave the roster. They stay in the
        // chat unless the teacher removes them.
        $schoolClass->members()->whereNotIn('step_user_id', $roster->keys())->delete();

        foreach ($roster as $stepUserId => $member) {
            SchoolClassMember::query()->updateOrCreate(
                ['school_class_id' => $schoolClass->id, 'step_user_id' => (string) $stepUserId],
                $member,
            );
        }

        $this->addRosterToChats($schoolClass);
    }

    private function syncEnrolment(User $student, Team $team, string $roomId): void
    {
        $schoolClass = SchoolClass::query()
            ->where('team_id', $team->id)
            ->where('step_room_id', $roomId)
            ->first();

        // The class arrives with its teacher's next sign-in.
        if ($schoolClass === null) {
            return;
        }

        SchoolClassMember::query()->firstOrCreate(
            ['school_class_id' => $schoolClass->id, 'step_user_id' => (string) $student->step_user_id],
            ['name' => $student->name, 'role' => 'student'],
        );

        $this->addRosterToChats($schoolClass);
    }

    /**
     * @return Collection<int, Conversation>
     */
    private function classConversations(SchoolClass $schoolClass): Collection
    {
        return $schoolClass->conversations()
            ->where('type', ConversationType::Group)
            ->get();
    }

    private function text(mixed $value, string $fallback = ''): string
    {
        $text = is_scalar($value) ? trim((string) $value) : '';

        return mb_substr($text !== '' ? $text : $fallback, 0, 255);
    }
}
