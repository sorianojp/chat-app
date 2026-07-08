<?php

namespace App\Http\Controllers\Api;

use App\Enums\SchoolRole;
use App\Events\NoticePublished;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreNoticeRequest;
use App\Models\Notice;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NoticeController extends Controller
{
    /**
     * Display notices for a school/team.
     */
    public function index(Request $request, Team $team): JsonResponse
    {
        abort_unless($this->belongsToTeam($request, $team), 403);

        $notices = $team->notices()
            ->with(['author:id,name,school_role', 'schoolClass'])
            ->when($request->filled('category'), fn ($query) => $query->where('category', $request->string('category')))
            ->where(function ($query) {
                $query->whereNull('published_at')->orWhere('published_at', '<=', now());
            })
            ->where(function ($query) {
                $query->whereNull('expires_at')->orWhere('expires_at', '>=', now());
            })
            ->latest('published_at')
            ->latest()
            ->paginate(25);

        return response()->json($notices);
    }

    /**
     * Store a notice and broadcast it to the school/team.
     */
    public function store(StoreNoticeRequest $request, Team $team): JsonResponse
    {
        abort_unless($this->belongsToTeam($request, $team), 403);
        abort_unless($this->canPublish($request), 403);

        $notice = $team->notices()->create([
            ...$request->validated(),
            'author_id' => $request->user()->id,
            'published_at' => $request->validated('published_at') ?? now(),
        ]);

        broadcast(new NoticePublished($notice))->toOthers();

        return response()->json([
            'data' => $notice->load(['author:id,name,school_role', 'schoolClass']),
        ], 201);
    }

    /**
     * Display one notice.
     */
    public function show(Request $request, Team $team, Notice $notice): JsonResponse
    {
        abort_unless($this->belongsToTeam($request, $team), 403);
        abort_unless($notice->team_id === $team->id, 404);

        return response()->json([
            'data' => $notice->load(['author:id,name,school_role', 'schoolClass']),
        ]);
    }

    private function belongsToTeam(Request $request, Team $team): bool
    {
        return $request->user()?->teams()->whereKey($team->id)->exists() ?? false;
    }

    private function canPublish(Request $request): bool
    {
        return in_array($request->user()?->school_role, [SchoolRole::Admin, SchoolRole::Teacher], true);
    }
}
