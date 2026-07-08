<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreConversationRequest;
use App\Models\Conversation;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConversationController extends Controller
{
    /**
     * Display conversations for the authenticated user.
     */
    public function index(Request $request, Team $team): JsonResponse
    {
        abort_unless($this->belongsToTeam($request, $team), 403);

        $conversations = $request->user()
            ->conversations()
            ->where('conversations.team_id', $team->id)
            ->with(['latestMessage.sender:id,name', 'participants:id,name,email,school_role'])
            ->withCount('messages')
            ->orderByDesc('last_message_at')
            ->paginate(25);

        return response()->json($conversations);
    }

    /**
     * Store a new conversation.
     */
    public function store(StoreConversationRequest $request, Team $team): JsonResponse
    {
        abort_unless($this->belongsToTeam($request, $team), 403);

        $data = $request->validated();
        $participantIds = [];

        foreach ($data['participant_ids'] as $participantId) {
            $participantIds[] = (int) $participantId;
        }

        $participantIds[] = $request->user()->id;
        $participantIds = array_values(array_unique($participantIds));

        $conversation = $team->conversations()->create([
            'school_class_id' => $data['school_class_id'] ?? null,
            'created_by' => $request->user()->id,
            'type' => $data['type'],
            'title' => $data['title'] ?? null,
        ]);

        $conversation->participants()->sync(array_reduce(
            $participantIds,
            fn (array $participants, int $userId): array => $participants + [
                $userId => ['role' => $userId === $request->user()->id ? 'owner' : 'member'],
            ],
            [],
        ));

        return response()->json([
            'data' => $conversation->load(['participants:id,name,email,school_role', 'schoolClass']),
        ], 201);
    }

    /**
     * Display a conversation.
     */
    public function show(Request $request, Team $team, Conversation $conversation): JsonResponse
    {
        abort_unless($this->belongsToTeam($request, $team), 403);
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);

        return response()->json([
            'data' => $conversation->load(['participants:id,name,email,school_role', 'schoolClass']),
        ]);
    }

    private function belongsToTeam(Request $request, Team $team): bool
    {
        return $request->user()?->teams()->whereKey($team->id)->exists() ?? false;
    }

    private function canAccessConversation(Request $request, Team $team, Conversation $conversation): bool
    {
        return $conversation->team_id === $team->id
            && $conversation->participants()->whereKey($request->user()->id)->exists();
    }
}
