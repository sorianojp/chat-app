<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreConversationRequest;
use App\Models\Conversation;
use App\Models\Team;
use App\Models\User;
use App\Support\MessagePayload;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

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
        $requestedParticipantIds = $request->collect('participant_ids')
            ->map(fn (mixed $participantId): int => (int) $participantId)
            ->unique()
            ->values();

        $teamParticipantIds = $team->members()
            ->whereKey($requestedParticipantIds)
            ->pluck('users.id')
            ->map(fn (mixed $participantId): int => (int) $participantId)
            ->values();

        if ($teamParticipantIds->count() !== $requestedParticipantIds->count()) {
            throw ValidationException::withMessages([
                'participant_ids' => __('All conversation participants must belong to this team.'),
            ]);
        }

        $participantIds = $requestedParticipantIds
            ->push($request->user()->id)
            ->unique()
            ->values()
            ->all();

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

        $conversation->load(['latestMessage.attachments', 'latestMessage.conversation.team', 'latestMessage.replyTo.sender:id,name', 'latestMessage.reactions.user:id,name', 'latestMessage.readers:id,name', 'latestMessage.sender:id,name,school_role', 'participants:id,name,email,school_role', 'schoolClass'])
            ->loadCount('messages');

        return response()->json([
            'data' => $this->conversationPayload($conversation, $request->user()->id),
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

    /**
     * @return array<string, mixed>
     */
    private function conversationPayload(Conversation $conversation, int $userId): array
    {
        /** @var Collection<int, User> $participants */
        $participants = $conversation->participants;
        $participant = $participants->firstWhere('id', '!=', $userId);
        $latestMessage = $conversation->latestMessage;
        $displayName = $conversation->title;

        if ($displayName === null && $participant !== null) {
            $displayName = $participant->name;
        }

        return [
            'id' => $conversation->id,
            'type' => $conversation->type->value,
            'title' => $conversation->title,
            'display_name' => $displayName ?? 'Conversation',
            'school_class' => $conversation->schoolClass ? [
                'id' => $conversation->schoolClass->id,
                'name' => $conversation->schoolClass->name,
            ] : null,
            'participants' => $participants->map(fn ($participant) => [
                'id' => $participant->id,
                'name' => $participant->name,
                'email' => $participant->email,
                'school_role' => $participant->school_role->value,
            ])->values(),
            'latest_message' => $latestMessage ? MessagePayload::from($latestMessage, $userId) : null,
            'messages_count' => $conversation->messages_count,
            'unread_count' => 0,
            'last_message_at' => $conversation->last_message_at?->toISOString(),
        ];
    }
}
