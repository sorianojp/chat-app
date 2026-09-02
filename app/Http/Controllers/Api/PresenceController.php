<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PresenceController extends Controller
{
    /**
     * Record that the authenticated team member is still active.
     */
    public function store(Request $request, Team $team): JsonResponse
    {
        abort_unless(
            $team->members()->whereKey($request->user()->id)->exists(),
            403,
        );

        $lastSeenAt = now();

        $request->user()->forceFill(['last_seen_at' => $lastSeenAt])->saveQuietly();

        return response()->json([
            'data' => [
                'last_seen_at' => $lastSeenAt->toISOString(),
            ],
        ]);
    }
}
