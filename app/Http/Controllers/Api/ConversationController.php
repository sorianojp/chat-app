<?php

namespace App\Http\Controllers\Api;

use App\Enums\ConversationType;
use App\Events\MessageCreated;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreConversationRequest;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Team;
use App\Models\User;
use App\Support\MessagePayload;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ConversationController extends Controller
{
    /**
     * Display conversations for the authenticated user.
     */
    public function index(Request $request, Team $team): JsonResponse
    {
        abort_unless($this->belongsToTeam($request, $team), 403);

        $showArchived = $request->boolean('archived');

        $conversations = $request->user()
            ->conversations()
            ->where('conversations.team_id', $team->id)
            ->when(
                $showArchived,
                fn ($query) => $query->whereNotNull('conversation_participants.archived_at'),
                fn ($query) => $query->whereNull('conversation_participants.archived_at'),
            )
            ->with(['latestMessage.sender:id,name', 'participants:id,name,email,school_role'])
            ->withCount('messages')
            ->orderByDesc('conversation_participants.pinned_at')
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

    /**
     * Pin or unpin a conversation for the authenticated user.
     */
    public function pin(Request $request, Team $team, Conversation $conversation): JsonResponse
    {
        abort_unless($this->belongsToTeam($request, $team), 403);
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);

        $data = $request->validate([
            'pinned' => ['required', 'boolean'],
        ]);

        $pinnedAt = $data['pinned'] ? now() : null;

        $conversation->participants()->updateExistingPivot($request->user()->id, [
            'pinned_at' => $pinnedAt,
        ]);

        return response()->json([
            'data' => [
                'pinned_at' => $pinnedAt?->toISOString(),
            ],
        ]);
    }

    /**
     * Mute or unmute a conversation for the authenticated user.
     */
    public function mute(Request $request, Team $team, Conversation $conversation): JsonResponse
    {
        abort_unless($this->belongsToTeam($request, $team), 403);
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);

        $data = $request->validate([
            'muted' => ['required', 'boolean'],
        ]);

        $mutedAt = $data['muted'] ? now() : null;

        $conversation->participants()->updateExistingPivot($request->user()->id, [
            'muted_at' => $mutedAt,
            'notification_preference' => $data['muted'] ? 'muted' : 'all',
        ]);

        return response()->json([
            'data' => [
                'muted_at' => $mutedAt?->toISOString(),
                'notification_preference' => $data['muted'] ? 'muted' : 'all',
            ],
        ]);
    }

    /**
     * Archive or restore a conversation for the authenticated user.
     */
    public function archive(Request $request, Team $team, Conversation $conversation): JsonResponse
    {
        abort_unless($this->belongsToTeam($request, $team), 403);
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);

        $data = $request->validate([
            'archived' => ['required', 'boolean'],
        ]);
        $archivedAt = $data['archived'] ? now() : null;

        $conversation->participants()->updateExistingPivot($request->user()->id, [
            'archived_at' => $archivedAt,
        ]);

        return response()->json([
            'data' => [
                'archived_at' => $archivedAt?->toISOString(),
            ],
        ]);
    }

    /**
     * Permanently remove an archived conversation from the authenticated user's mailbox.
     */
    public function destroy(Request $request, Team $team, Conversation $conversation): JsonResponse
    {
        abort_unless($this->belongsToTeam($request, $team), 403);
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);

        $participant = $conversation->participants()
            ->whereKey($request->user()->id)
            ->firstOrFail();
        abort_unless($participant->getAttribute('pivot')?->getAttribute('archived_at') !== null, 422, 'Only archived conversations can be deleted.');

        $conversation->participants()->detach($request->user()->id);

        if (! $conversation->participants()->exists()) {
            $conversation->delete();
        }

        return response()->json(['data' => ['deleted' => true]]);
    }

    /**
     * Update notification preference for the authenticated user.
     */
    public function notifications(Request $request, Team $team, Conversation $conversation): JsonResponse
    {
        abort_unless($this->belongsToTeam($request, $team), 403);
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);

        $data = $request->validate([
            'preference' => ['required', Rule::in(['all', 'mentions', 'muted'])],
        ]);
        $mutedAt = $data['preference'] === 'muted' ? now() : null;

        $conversation->participants()->updateExistingPivot($request->user()->id, [
            'notification_preference' => $data['preference'],
            'muted_at' => $mutedAt,
        ]);

        return response()->json([
            'data' => [
                'notification_preference' => $data['preference'],
                'muted_at' => $mutedAt?->toISOString(),
            ],
        ]);
    }

    /**
     * Rename a group conversation.
     */
    public function update(Request $request, Team $team, Conversation $conversation): JsonResponse
    {
        abort_unless($this->belongsToTeam($request, $team), 403);
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);
        abort_unless($conversation->type === ConversationType::Group, 404);
        abort_unless($this->canManageConversation($request, $conversation), 403);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:160'],
        ]);

        $oldTitle = $conversation->title ?? 'Conversation';

        $conversation->forceFill(['title' => $data['title']])->save();
        $systemMessage = $this->createSystemMessage(
            $conversation,
            "{$request->user()->name} changed the group name to {$data['title']}.",
            'conversation_renamed',
            $request->user(),
            [
                'old_title' => $oldTitle,
                'new_title' => $data['title'],
            ],
        );

        return response()->json([
            'data' => $this->conversationPayload($this->conversationForUser($request, $conversation), $request->user()->id),
            'system_message' => MessagePayload::from($systemMessage, $request->user()->id),
        ]);
    }

    /**
     * Add members to a group conversation.
     */
    public function addMembers(Request $request, Team $team, Conversation $conversation): JsonResponse
    {
        abort_unless($this->belongsToTeam($request, $team), 403);
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);
        abort_unless($conversation->type === ConversationType::Group, 404);
        abort_unless($this->canManageConversation($request, $conversation), 403);

        $data = $request->validate([
            'user_ids' => ['required', 'array', 'min:1', 'max:20'],
            'user_ids.*' => ['integer', 'distinct', 'exists:users,id'],
        ]);
        $userIds = collect($data['user_ids'])->map(fn (mixed $userId): int => (int) $userId)->values();
        $teamMemberIds = $team->members()
            ->whereKey($userIds)
            ->pluck('users.id')
            ->map(fn (mixed $userId): int => (int) $userId);

        if ($teamMemberIds->count() !== $userIds->count()) {
            throw ValidationException::withMessages([
                'user_ids' => __('All new members must belong to this team.'),
            ]);
        }

        $existingParticipantIds = $conversation->participants()
            ->whereKey($teamMemberIds)
            ->pluck('users.id')
            ->map(fn (mixed $userId): int => (int) $userId);
        $newMemberIds = $teamMemberIds->diff($existingParticipantIds)->values();
        $newMembers = $team->members()
            ->whereKey($newMemberIds)
            ->get(['users.id', 'users.name']);

        $conversation->participants()->syncWithoutDetaching(
            $teamMemberIds
                ->mapWithKeys(fn (int $userId): array => [
                    $userId => ['role' => 'member', 'notification_preference' => 'all'],
                ])
                ->all(),
        );
        $systemMessage = $newMembers->isNotEmpty()
            ? $this->createSystemMessage(
                $conversation,
                "{$request->user()->name} added {$this->namesList($newMembers)} to the group.",
                'members_added',
                $request->user(),
                ['member_ids' => $newMembers->pluck('id')->values()->all()],
            )
            : null;

        return response()->json([
            'data' => $this->conversationPayload($this->conversationForUser($request, $conversation), $request->user()->id),
            'system_message' => $systemMessage ? MessagePayload::from($systemMessage, $request->user()->id) : null,
        ]);
    }

    /**
     * Remove a member from a group conversation.
     */
    public function removeMember(Request $request, Team $team, Conversation $conversation, User $user): JsonResponse
    {
        abort_unless($this->belongsToTeam($request, $team), 403);
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);
        abort_unless($conversation->type === ConversationType::Group, 404);
        abort_unless($this->canManageConversation($request, $conversation), 403);
        abort_if($user->id === $request->user()->id, 422, 'Use leave conversation instead.');
        abort_unless($conversation->participants()->whereKey($user->id)->exists(), 404);

        $conversation->participants()->detach($user->id);
        $systemMessage = $this->createSystemMessage(
            $conversation,
            "{$request->user()->name} removed {$user->name} from the group.",
            'member_removed',
            $request->user(),
            ['member_id' => $user->id],
        );

        return response()->json([
            'data' => $this->conversationPayload($this->conversationForUser($request, $conversation), $request->user()->id),
            'system_message' => MessagePayload::from($systemMessage, $request->user()->id),
        ]);
    }

    /**
     * Leave a group conversation.
     */
    public function leave(Request $request, Team $team, Conversation $conversation): JsonResponse
    {
        abort_unless($this->belongsToTeam($request, $team), 403);
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);
        abort_unless($conversation->type === ConversationType::Group, 404);

        $conversation->participants()->detach($request->user()->id);
        $systemMessage = $this->createSystemMessage(
            $conversation,
            "{$request->user()->name} left the group.",
            'member_left',
            $request->user(),
        );

        return response()->json([
            'data' => ['left' => true],
            'system_message' => MessagePayload::from($systemMessage, $request->user()->id),
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

    private function canManageConversation(Request $request, Conversation $conversation): bool
    {
        return $conversation->participants()
            ->whereKey($request->user()->id)
            ->wherePivot('role', 'owner')
            ->exists();
    }

    private function conversationForUser(Request $request, Conversation $conversation): Conversation
    {
        return $request->user()
            ->conversations()
            ->whereKey($conversation->id)
            ->with(['latestMessage.attachments', 'latestMessage.conversation.team', 'latestMessage.replyTo.sender:id,name', 'latestMessage.reactions.user:id,name', 'latestMessage.readers:id,name', 'latestMessage.sender:id,name,school_role', 'participants:id,name,email,school_role', 'schoolClass'])
            ->withCount('messages')
            ->firstOrFail();
    }

    /**
     * @param  array<string, mixed>  $metadata
     */
    private function createSystemMessage(Conversation $conversation, string $body, string $event, ?User $actor = null, array $metadata = []): Message
    {
        $message = $conversation->messages()->create([
            'sender_id' => null,
            'type' => 'system',
            'body' => $body,
            'metadata' => array_filter([
                'event' => $event,
                'actor_id' => $actor?->id,
                ...$metadata,
            ], fn (mixed $value): bool => $value !== null),
        ]);

        $conversation->forceFill(['last_message_at' => $message->created_at])->save();
        $message->load(['attachments', 'conversation.team', 'replyTo.sender:id,name', 'sender:id,name,school_role', 'reactions.user:id,name', 'readers:id,name']);

        broadcast(new MessageCreated($message))->toOthers();

        return $message;
    }

    /**
     * @param  Collection<int, User>  $users
     */
    private function namesList(Collection $users): string
    {
        $names = $users->pluck('name')->values();

        if ($names->count() <= 2) {
            return $names->join(' and ');
        }

        return $names->take(2)->join(', ').' and '.($names->count() - 2).' others';
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
        $pivot = $conversation->getAttribute('pivot');
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
                'conversation_role' => $participant->getAttribute('pivot')?->getAttribute('role'),
            ])->values(),
            'latest_message' => $latestMessage ? MessagePayload::from($latestMessage, $userId) : null,
            'pinned_message' => $this->pinnedMessagePayload($conversation, $userId),
            'messages_count' => $conversation->messages_count,
            'unread_count' => 0,
            'last_message_at' => $conversation->last_message_at?->toISOString(),
            'pinned_at' => $this->pivotTimestamp($pivot?->getAttribute('pinned_at')),
            'muted_at' => $this->pivotTimestamp($pivot?->getAttribute('muted_at')),
            'archived_at' => $this->pivotTimestamp($pivot?->getAttribute('archived_at')),
            'notification_preference' => $pivot?->getAttribute('notification_preference') ?? 'all',
        ];
    }

    private function pivotTimestamp(mixed $value): ?string
    {
        return $value instanceof CarbonInterface ? $value->toISOString() : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function pinnedMessagePayload(Conversation $conversation, int $userId): ?array
    {
        $message = $conversation->messages()
            ->whereNotNull('pinned_at')
            ->whereNull('unsent_at')
            ->with(['attachments', 'conversation.team', 'pinner:id,name', 'replyTo.sender:id,name', 'sender:id,name,school_role', 'reactions.user:id,name', 'readers:id,name'])
            ->latest('pinned_at')
            ->first();

        return $message ? MessagePayload::from($message, $userId) : null;
    }
}
