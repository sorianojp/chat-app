<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\User;
use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Read-only oversight for super admins: every user's online status and any
 * conversation's messages. Opening a conversation is written to
 * admin_access_logs.
 */
class AdminController extends Controller
{
    /** Matches the apps' rule: seen within the last three minutes is online. */
    public const ONLINE_MINUTES = 3;

    public function users(Request $request): Response
    {
        $search = trim($request->string('search')->toString());
        $status = in_array($request->query('status'), ['online', 'offline'], true)
            ? $request->query('status')
            : 'all';
        $onlineSince = now()->subMinutes(self::ONLINE_MINUTES);

        $users = User::query()
            ->with('teams:id,name')
            ->when($search !== '', fn (Builder $query) => $query->where(
                fn (Builder $query) => $query
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%"),
            ))
            ->when($status === 'online', fn (Builder $query) => $query->where('last_seen_at', '>=', $onlineSince))
            ->when($status === 'offline', fn (Builder $query) => $query->where(
                fn (Builder $query) => $query->whereNull('last_seen_at')->orWhere('last_seen_at', '<', $onlineSince),
            ))
            ->orderByRaw('last_seen_at is null')
            ->orderByDesc('last_seen_at')
            ->orderBy('name')
            ->paginate(50)
            ->withQueryString()
            ->through(fn (User $user) => [
                ...$this->userSummary($user),
                'schools' => $user->teams->pluck('name')->values(),
            ]);

        return Inertia::render('admin/users', [
            'users' => $users,
            'filters' => ['search' => $search, 'status' => $status],
            'counts' => [
                'total' => User::count(),
                'online' => User::where('last_seen_at', '>=', $onlineSince)->count(),
            ],
        ]);
    }

    public function user(User $user): Response
    {
        $conversations = $user->conversations()
            ->with(['team:id,name', 'participants:id,name'])
            ->withCount('messages')
            ->orderByRaw('conversations.last_message_at is null')
            ->orderByDesc('conversations.last_message_at')
            ->paginate(50)
            ->through(fn (Conversation $conversation) => $this->conversationSummary($conversation, $user));

        return Inertia::render('admin/user', [
            'user' => [
                ...$this->userSummary($user),
                'schools' => $user->teams()->pluck('name')->values(),
            ],
            'conversations' => $conversations,
        ]);
    }

    public function conversation(Request $request, Conversation $conversation): Response
    {
        DB::table('admin_access_logs')->insert([
            'admin_id' => $request->user()->id,
            'action' => 'view_conversation',
            'subject_type' => 'conversation',
            'subject_id' => $conversation->id,
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);

        $conversation->load(['team:id,name', 'participants:id,name,email,school_role,last_seen_at']);

        $messages = $conversation->messages()
            ->withTrashed()
            ->with(['sender:id,name', 'attachments'])
            ->latest('id')
            ->paginate(50)
            ->through(fn (Message $message) => [
                'id' => $message->id,
                'type' => $message->type,
                'body' => $message->body,
                'sender' => $message->sender?->only(['id', 'name']),
                'created_at' => $message->created_at?->toISOString(),
                'unsent' => $message->unsent_at !== null,
                'deleted' => $message->deleted_at !== null,
                'attachments' => $message->attachments->map(fn (MessageAttachment $attachment) => [
                    'id' => $attachment->id,
                    'name' => $attachment->original_name,
                    'mime_type' => $attachment->mime_type,
                    'size' => $attachment->size,
                ])->values()->all(),
            ]);

        return Inertia::render('admin/conversation', [
            'conversation' => [
                ...$this->conversationSummary($conversation),
                'participants' => $conversation->participants
                    ->map(fn (User $participant) => $this->userSummary($participant))
                    ->values(),
            ],
            'messages' => $messages,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function userSummary(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'school_role' => $user->school_role->value,
            'last_seen_at' => $user->last_seen_at?->toISOString(),
            'online' => $user->last_seen_at !== null
                && $user->last_seen_at->gte(now()->subMinutes(self::ONLINE_MINUTES)),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function conversationSummary(Conversation $conversation, ?User $viewer = null): array
    {
        $others = $conversation->participants
            ->reject(fn (User $participant) => $participant->id === $viewer?->id)
            ->pluck('name');

        return [
            'id' => $conversation->id,
            'type' => $conversation->type->value,
            'title' => $conversation->title ?: ($others->take(4)->join(', ') ?: 'Conversation'),
            'school' => $conversation->team->name,
            'participants_count' => $conversation->participants->count(),
            'messages_count' => $conversation->messages_count ?? null,
            'last_message_at' => $conversation->last_message_at?->toISOString(),
        ];
    }
}
