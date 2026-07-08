<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SchoolClassController extends Controller
{
    /**
     * Display classes for a school/team.
     */
    public function index(Request $request, Team $team): JsonResponse
    {
        abort_unless($this->belongsToTeam($request, $team), 403);

        $classes = $team->schoolClasses()
            ->with(['adviser:id,name,email'])
            ->withCount('students')
            ->orderBy('grade_level')
            ->orderBy('section')
            ->get();

        return response()->json(['data' => $classes]);
    }

    private function belongsToTeam(Request $request, Team $team): bool
    {
        return $request->user()?->teams()->whereKey($team->id)->exists() ?? false;
    }
}
