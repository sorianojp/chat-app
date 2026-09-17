<?php

namespace App\Services;

use App\Actions\Auth\ProvisionStepUser;
use App\Data\StepIdentity;
use App\Enums\ConversationType;
use App\Exceptions\StepSsoException;
use App\Models\Conversation;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

class SyncStepClassrooms
{
    public function __construct(
        private StepClassroomClient $client,
        private ProvisionStepUser $provisioner,
    ) {}

    /**
     * @return array{created: int, updated: int, archived: int, rooms: int}
     */
    public function handle(): array
    {
        $payload = $this->client->currentClassrooms();
        $team = $this->provisioner->stepTeam();

        $activeRoomIds = [];
        $created = 0;
        $updated = 0;

        foreach ($payload['rooms'] as $room) {
            if (blank($room['id'] ?? null)) {
                continue;
            }

            $stepRoomId = (string) $room['id'];
            $activeRoomIds[] = $stepRoomId;

            DB::transaction(function () use ($team, $room, $stepRoomId, $payload, &$created, &$updated): void {
                $teacher = $this->provisionIdentity($room['teacher'] ?? null);
                $students = collect(is_array($room['students'] ?? null) ? $room['students'] : [])
                    ->map(function (mixed $identity) use ($stepRoomId): ?User {
                        try {
                            return $this->provisionIdentity($identity);
                        } catch (StepSsoException $exception) {
                            Log::warning('A STEP classroom student could not be provisioned in Uhoo.', [
                                'step_room_id' => $stepRoomId,
                                'step_user_id' => is_array($identity) ? ($identity['sub'] ?? null) : null,
                                'reason' => $exception->getMessage(),
                            ]);

                            return null;
                        }
                    })
                    ->filter()
                    ->unique('id')
                    ->values();

                if (! $teacher) {
                    throw new RuntimeException("STEP room {$stepRoomId} does not have a valid teacher.");
                }

                $schoolClass = SchoolClass::query()->where('step_room_id', $stepRoomId)->lockForUpdate()->first();
                $wasRecentlyCreated = $schoolClass === null;
                $schoolClass ??= new SchoolClass(['team_id' => $team->id, 'step_room_id' => $stepRoomId]);
                $schoolClass->fill([
                    'team_id' => $team->id,
                    'adviser_id' => $teacher->id,
                    'name' => $this->roomTitle($room),
                    'grade_level' => (string) ($room['year'] ?? $room['course'] ?? 'N/A'),
                    'section' => (string) ($room['section'] ?? 'N/A'),
                    'school_year' => (string) ($room['school_year'] ?? $payload['school_year']),
                    'semester' => (string) ($room['semester'] ?? $payload['semester']),
                    'sync_status' => 'active',
                    'last_synced_at' => now(),
                    'ended_at' => null,
                ])->save();

                $conversation = Conversation::query()
                    ->where('school_class_id', $schoolClass->id)
                    ->where('managed_by_step', true)
                    ->lockForUpdate()
                    ->first();
                $conversation ??= new Conversation([
                    'team_id' => $team->id,
                    'school_class_id' => $schoolClass->id,
                    'managed_by_step' => true,
                ]);
                $conversation->fill([
                    'team_id' => $team->id,
                    'school_class_id' => $schoolClass->id,
                    'created_by' => $teacher->id,
                    'type' => ConversationType::Group,
                    'title' => $this->roomTitle($room),
                    'managed_by_step' => true,
                    'sync_status' => 'active',
                    'locked_at' => null,
                    'archived_at' => null,
                ])->save();

                $participants = $students
                    ->mapWithKeys(fn (User $student): array => [$student->id => [
                        'role' => 'member',
                        'archived_at' => null,
                    ]])
                    ->put($teacher->id, ['role' => 'owner', 'archived_at' => null])
                    ->all();
                $conversation->participants()->sync($participants);

                $wasRecentlyCreated ? $created++ : $updated++;
            });
        }

        $staleClasses = SchoolClass::query()
            ->where('team_id', $team->id)
            ->whereNotNull('step_room_id')
            ->where('sync_status', 'active')
            ->when(
                $activeRoomIds === [],
                fn ($query) => $query,
                fn ($query) => $query->whereNotIn('step_room_id', $activeRoomIds),
            )
            ->get();

        foreach ($staleClasses as $schoolClass) {
            DB::transaction(function () use ($schoolClass): void {
                $endedAt = now();
                $schoolClass->update([
                    'sync_status' => 'archived',
                    'last_synced_at' => $endedAt,
                    'ended_at' => $endedAt,
                ]);
                $schoolClass->conversations()
                    ->where('managed_by_step', true)
                    ->update([
                        'sync_status' => 'archived',
                        'locked_at' => $endedAt,
                        'archived_at' => $endedAt,
                    ]);
            });
        }

        return [
            'created' => $created,
            'updated' => $updated,
            'archived' => $staleClasses->count(),
            'rooms' => count($activeRoomIds),
        ];
    }

    private function provisionIdentity(mixed $payload): ?User
    {
        if (! is_array($payload)) {
            return null;
        }

        return $this->provisioner->handle(StepIdentity::fromPayload($payload));
    }

    /** @param array<string, mixed> $room */
    private function roomTitle(array $room): string
    {
        $parts = collect([$room['class_code'] ?? null, $room['subject'] ?? $room['name'] ?? null, $room['section'] ?? null])
            ->filter(fn (mixed $part): bool => is_scalar($part) && trim((string) $part) !== '')
            ->map(fn (mixed $part): string => Str::squish((string) $part))
            ->unique()
            ->values();

        return Str::limit($parts->join(' · ') ?: 'STEP Classroom', 160, '');
    }
}
