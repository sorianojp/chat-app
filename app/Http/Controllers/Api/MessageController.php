<?php

namespace App\Http\Controllers\Api;

use App\Events\MessageCreated;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreMessageRequest;
use App\Models\Conversation;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    /**
     * Display messages for a conversation.
     */
    public function index(Request $request, Team $team, Conversation $conversation): JsonResponse
    {
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);

        $messages = $conversation->messages()
            ->with(['sender:id,name,school_role'])
            ->latest()
            ->paginate(40);

        return response()->json($messages);
    }

    /**
     * Store a new message and broadcast it to conversation participants.
     */
    public function store(StoreMessageRequest $request, Team $team, Conversation $conversation): JsonResponse
    {
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);

        $message = $conversation->messages()->create([
            'sender_id' => $request->user()->id,
            'type' => $request->validated('type', 'text'),
            'body' => $request->validated('body'),
            'metadata' => $request->validated('metadata'),
        ]);

        $conversation->forceFill(['last_message_at' => $message->created_at])->save();
        $conversation->participants()->updateExistingPivot($request->user()->id, ['last_read_at' => now()]);

        broadcast(new MessageCreated($message))->toOthers();

        return response()->json([
            'data' => $message->load(['sender:id,name,school_role']),
        ], 201);
    }

    /**
     * Mark a conversation as read for the authenticated user.
     */
    public function markRead(Request $request, Team $team, Conversation $conversation): JsonResponse
    {
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);

        $conversation->participants()->updateExistingPivot($request->user()->id, ['last_read_at' => now()]);

        return response()->json(['data' => ['read' => true]]);
    }

    private function canAccessConversation(Request $request, Team $team, Conversation $conversation): bool
    {
        return $request->user() !== null
            && $conversation->team_id === $team->id
            && $request->user()->teams()->whereKey($team->id)->exists()
            && $conversation->participants()->whereKey($request->user()->id)->exists();
    }
}
