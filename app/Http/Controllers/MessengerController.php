<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\Team;
use App\Models\User;
use App\Support\MessagePayload;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class MessengerController extends Controller
{
    /**
     * Display the messenger web app.
     */
    public function __invoke(Request $request, Team $current_team): Response
    {
        $user = $request->user();
        $showArchived = $request->boolean('archived');

        $conversations = $user->conversations()
            ->where('conversations.team_id', $current_team->id)
            ->when(
                $showArchived,
                fn ($query) => $query->whereNotNull('conversation_participants.archived_at'),
                fn ($query) => $query->whereNull('conversation_participants.archived_at'),
            )
            ->with(['latestMessage.attachments', 'latestMessage.conversation.team', 'latestMessage.replyTo.sender:id,name', 'latestMessage.reactions.user:id,name', 'latestMessage.readers:id,name', 'latestMessage.sender:id,name,school_role', 'participants:id,name,email,school_role', 'schoolClass'])
            ->withCount('messages')
            ->orderByDesc('conversation_participants.pinned_at')
            ->orderByDesc('last_message_at')
            ->orderByDesc('conversations.updated_at')
            ->get()
            ->map(fn (Conversation $conversation) => $this->conversationPayload($conversation, $user->id));

        $requestedConversationId = $request->integer('conversation');
        $hasRequestedConversation = $requestedConversationId > 0
            && $conversations->contains(fn (array $conversation) => $conversation['id'] === $requestedConversationId);
        $activeConversationId = $hasRequestedConversation ? $requestedConversationId : null;

        $messages = $activeConversationId
            ? Message::query()
                ->where('conversation_id', $activeConversationId)
                ->with(['attachments', 'conversation.team', 'replyTo.sender:id,name', 'sender:id,name,school_role', 'reactions.user:id,name', 'readers:id,name'])
                ->oldest()
                ->limit(80)
                ->get()
                ->map(fn (Message $message) => MessagePayload::from($message, $user->id))
            : collect();

        return Inertia::render('messenger', [
            'apiBaseUrl' => "/api/teams/{$current_team->slug}",
            'workspace' => [
                'id' => $current_team->id,
                'name' => $current_team->name,
                'slug' => $current_team->slug,
            ],
            'contacts' => $current_team->members()
                ->where('users.id', '!=', $user->id)
                ->orderBy('name')
                ->get()
                ->map(fn (User $contact) => [
                    'id' => $contact->id,
                    'name' => $contact->name,
                    'email' => $contact->email,
                    'school_role' => $contact->school_role->value,
                ]),
            'conversations' => $conversations,
            'initialConversationId' => $activeConversationId,
            'initialMessages' => $messages,
            'archived' => $showArchived,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function conversationPayload(Conversation $conversation, int $userId): array
    {
        $participant = $conversation->participants
            ->firstWhere('id', '!=', $userId);
        $latestMessage = $conversation->latestMessage;
        $pivot = $conversation->getAttribute('pivot');
        $lastReadAt = DB::table('conversation_participants')
            ->where('conversation_id', $conversation->id)
            ->where('user_id', $userId)
            ->value('last_read_at');
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
            'participants' => $conversation->participants->map(fn ($participant) => [
                'id' => $participant->id,
                'name' => $participant->name,
                'email' => $participant->email,
                'school_role' => $participant->school_role->value,
                'conversation_role' => $participant->getAttribute('pivot')?->getAttribute('role'),
            ])->values(),
            'latest_message' => $latestMessage ? MessagePayload::from($latestMessage, $userId) : null,
            'pinned_message' => $this->pinnedMessagePayload($conversation, $userId),
            'messages_count' => $conversation->messages_count,
            'unread_count' => $conversation->messages()
                ->when($lastReadAt, fn ($query) => $query->where('created_at', '>', $lastReadAt))
                ->where('sender_id', '!=', $userId)
                ->count(),
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
