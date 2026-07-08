<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class MessengerController extends Controller
{
    /**
     * Display the messenger web app.
     */
    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        $team = $user->currentTeam ?? $user->teams()->orderBy('teams.name')->first();

        abort_if($team === null, 404);

        $conversations = $user->conversations()
            ->where('conversations.team_id', $team->id)
            ->with(['latestMessage.sender:id,name,school_role', 'participants:id,name,email,school_role', 'schoolClass'])
            ->withCount('messages')
            ->orderByDesc('last_message_at')
            ->orderByDesc('conversations.updated_at')
            ->get()
            ->map(fn (Conversation $conversation) => $this->conversationPayload($conversation, $user->id));

        $activeConversationId = $conversations->first()['id'] ?? null;

        $messages = $activeConversationId
            ? Message::query()
                ->where('conversation_id', $activeConversationId)
                ->with(['sender:id,name,school_role'])
                ->oldest()
                ->limit(80)
                ->get()
                ->map(fn (Message $message) => $this->messagePayload($message))
            : collect();

        return Inertia::render('messenger', [
            'apiBaseUrl' => "/api/teams/{$team->slug}",
            'conversations' => $conversations,
            'initialMessages' => $messages,
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
            ])->values(),
            'latest_message' => $latestMessage ? $this->messagePayload($latestMessage) : null,
            'messages_count' => $conversation->messages_count,
            'unread_count' => $conversation->messages()
                ->when($lastReadAt, fn ($query) => $query->where('created_at', '>', $lastReadAt))
                ->where('sender_id', '!=', $userId)
                ->count(),
            'last_message_at' => $conversation->last_message_at?->toISOString(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function messagePayload(Message $message): array
    {
        return [
            'id' => $message->id,
            'conversation_id' => $message->conversation_id,
            'sender' => $message->sender ? [
                'id' => $message->sender->id,
                'name' => $message->sender->name,
                'school_role' => $message->sender->school_role->value,
            ] : null,
            'type' => $message->type,
            'body' => $message->body,
            'metadata' => $message->metadata,
            'created_at' => $message->created_at?->toISOString(),
        ];
    }
}
