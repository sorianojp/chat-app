<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MobileSessionController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'school_role' => $user->school_role->value,
                'current_team_id' => $user->current_team_id,
            ],
            'teams' => $user->teams()->orderBy('name')->get()->map(fn (Team $team) => [
                'id' => $team->id, 'name' => $team->name, 'slug' => $team->slug,
            ]),
            'realtime' => config('broadcasting.default') === 'reverb' ? [
                'key' => config('broadcasting.connections.reverb.key'),
                'host' => config('broadcasting.connections.reverb.options.host'),
                'port' => config('broadcasting.connections.reverb.options.port'),
                'scheme' => config('broadcasting.connections.reverb.options.scheme'),
            ] : null,
        ])->header('Cache-Control', 'no-store');
    }

    public function contacts(Request $request, Team $team): JsonResponse
    {
        abort_unless($request->user()?->teams()->whereKey($team->id)->exists(), 403);

        return response()->json($team->members()
            ->where('users.id', '!=', $request->user()->id)
            ->when($request->filled('search'), function ($query) use ($request) {
                $search = '%'.$request->string('search')->toString().'%';
                $query->where(fn ($query) => $query->where('name', 'like', $search)->orWhere('email', 'like', $search));
            })
            ->orderBy('name')
            ->paginate(100, ['users.id', 'name', 'email', 'school_role', 'last_seen_at']));
    }
}
