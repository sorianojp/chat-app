<?php

namespace App\Http\Controllers\Api;

use App\Enums\ConversationType;
use App\Http\Controllers\Controller;
use App\Models\SchoolClass;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SchoolClassController extends Controller
{
    /**
     * The STEP classes the signed-in user teaches, for starting class chats.
     */
    public function index(Request $request, Team $team): JsonResponse
    {
        abort_unless($this->belongsToTeam($request, $team), 403);

        $classes = $team->schoolClasses()
            ->where('adviser_id', $request->user()->id)
            ->whereNotNull('step_room_id')
            ->with(['members' => fn ($query) => $query
                ->where('role', 'student')
                ->select(['id', 'school_class_id', 'step_user_id']),
            ])
            ->with(['conversations' => fn ($query) => $query
                ->where('type', ConversationType::Group)
                ->whereHas('participants', fn ($query) => $query->whereKey($request->user()->id))
                ->select(['id', 'school_class_id']),
            ])
            ->orderBy('name')
            ->orderBy('section')
            ->get();

        // Students on these rosters who already have a Uhoo! account.
        $joined = $team->members()
            ->whereIn('step_user_id', $classes->flatMap->members->pluck('step_user_id')->unique())
            ->pluck('step_user_id')
            ->flip();

        return response()->json([
            'data' => $classes->map(fn (SchoolClass $class): array => [
                'id' => $class->id,
                'name' => $class->name,
                'subject' => $class->subject,
                'section' => $class->section,
                'school_year' => $class->school_year,
                'semester' => $class->semester,
                'students_count' => $class->members->count(),
                'joined_count' => $class->members
                    ->filter(fn ($member): bool => $joined->has($member->step_user_id))
                    ->count(),
                'conversation_id' => $class->conversations->first()?->id,
            ])->values(),
        ]);
    }

    private function belongsToTeam(Request $request, Team $team): bool
    {
        return $request->user()?->teams()->whereKey($team->id)->exists() ?? false;
    }
}
