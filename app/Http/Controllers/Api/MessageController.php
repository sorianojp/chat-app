<?php

namespace App\Http\Controllers\Api;

use App\Events\ConversationRead;
use App\Events\MessageCreated;
use App\Events\MessageReactionUpdated;
use App\Events\MessageUpdated;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreMessageRequest;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\Team;
use App\Support\MessagePayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MessageController extends Controller
{
    /**
     * Display messages for a conversation.
     */
    public function index(Request $request, Team $team, Conversation $conversation): JsonResponse
    {
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);

        $messages = $conversation->messages()
            ->with(['attachments', 'conversation.team', 'replyTo.sender:id,name', 'sender:id,name,school_role', 'reactions.user:id,name', 'readers:id,name'])
            ->when($request->string('search')->isNotEmpty(), function ($query) use ($request) {
                $search = $request->string('search')->toString();

                $query->where(function ($query) use ($search) {
                    $query
                        ->where('body', 'like', "%{$search}%")
                        ->orWhereHas('attachments', fn ($query) => $query->where('original_name', 'like', "%{$search}%"));
                });
            })
            ->latest()
            ->paginate(40)
            ->through(fn (Message $message) => MessagePayload::from($message, $request->user()->id));

        return response()->json($messages);
    }

    /**
     * Display shared media, links, and files for a conversation.
     */
    public function shared(Request $request, Team $team, Conversation $conversation): JsonResponse
    {
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);

        $attachments = MessageAttachment::query()
            ->with(['message.conversation.team', 'message.sender:id,name'])
            ->whereHas('message', fn ($query) => $query
                ->where('conversation_id', $conversation->id)
                ->whereNull('unsent_at'))
            ->latest()
            ->limit(120)
            ->get();

        $links = $conversation->messages()
            ->with('sender:id,name')
            ->whereNull('unsent_at')
            ->where('body', 'like', '%http%')
            ->latest()
            ->limit(120)
            ->get()
            ->flatMap(fn (Message $message) => $this->linkPayloads($message))
            ->values()
            ->take(60);

        return response()->json([
            'data' => [
                'media' => $attachments
                    ->filter(fn (MessageAttachment $attachment) => $attachment->isPreviewableMedia())
                    ->map(fn (MessageAttachment $attachment) => $this->sharedAttachmentPayload($attachment))
                    ->values(),
                'files' => $attachments
                    ->reject(fn (MessageAttachment $attachment) => $attachment->isPreviewableMedia())
                    ->map(fn (MessageAttachment $attachment) => $this->sharedAttachmentPayload($attachment))
                    ->values(),
                'links' => $links,
            ],
        ]);
    }

    /**
     * Display pinned messages for a conversation.
     */
    public function pinned(Request $request, Team $team, Conversation $conversation): JsonResponse
    {
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);

        $messages = $conversation->messages()
            ->with(['attachments', 'conversation.team', 'pinner:id,name', 'replyTo.sender:id,name', 'sender:id,name,school_role', 'reactions.user:id,name', 'readers:id,name'])
            ->whereNotNull('pinned_at')
            ->whereNull('unsent_at')
            ->latest('pinned_at')
            ->limit(50)
            ->get()
            ->map(fn (Message $message) => MessagePayload::from($message, $request->user()->id))
            ->values();

        return response()->json(['data' => $messages]);
    }

    /**
     * Store a new message and broadcast it to conversation participants.
     */
    public function store(StoreMessageRequest $request, Team $team, Conversation $conversation): JsonResponse
    {
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);

        $message = DB::transaction(function () use ($request, $conversation): Message {
            $attachments = $request->file('attachments', []);
            $hasAttachments = count($attachments) > 0;

            $message = $conversation->messages()->create([
                'sender_id' => $request->user()->id,
                'reply_to_message_id' => $this->replyToMessageId($request, $conversation),
                'type' => $request->validated('type', $hasAttachments ? 'attachment' : 'text'),
                'body' => $request->validated('body') ?? '',
                'metadata' => $request->validated('metadata'),
            ]);

            foreach ($attachments as $attachment) {
                $path = $attachment->store("message-attachments/{$conversation->team_id}/{$conversation->id}", 'local');

                $message->attachments()->create([
                    'disk' => 'local',
                    'path' => $path,
                    'original_name' => $attachment->getClientOriginalName(),
                    'mime_type' => $attachment->getClientMimeType(),
                    'size' => $attachment->getSize(),
                ]);
            }

            return $message;
        });

        $conversation->forceFill(['last_message_at' => $message->created_at])->save();
        $conversation->participants()->updateExistingPivot($request->user()->id, ['last_read_at' => now()]);

        broadcast(new MessageCreated($message->load(['attachments', 'conversation.team', 'replyTo.sender:id,name', 'sender:id,name,school_role', 'reactions.user:id,name', 'readers:id,name'])))->toOthers();

        return response()->json([
            'data' => MessagePayload::from($message, $request->user()->id),
        ], 201);
    }

    /**
     * Edit an existing message owned by the authenticated user.
     */
    public function update(Request $request, Team $team, Conversation $conversation, Message $message): JsonResponse
    {
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);
        $this->ensureMessageBelongsToConversation($conversation, $message);
        abort_unless($message->sender_id === $request->user()->id, 403);
        abort_if($message->unsent_at !== null, 422, 'Unsent messages cannot be edited.');

        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $message->forceFill([
            'body' => $data['body'],
            'edited_at' => now(),
        ])->save();

        $message->load(['attachments', 'conversation.team', 'replyTo.sender:id,name', 'sender:id,name,school_role', 'reactions.user:id,name', 'readers:id,name']);

        broadcast(new MessageUpdated($message))->toOthers();

        return response()->json([
            'data' => MessagePayload::from($message, $request->user()->id),
        ]);
    }

    /**
     * Unsend an existing message owned by the authenticated user.
     */
    public function destroy(Request $request, Team $team, Conversation $conversation, Message $message): JsonResponse
    {
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);
        $this->ensureMessageBelongsToConversation($conversation, $message);
        abort_unless($message->sender_id === $request->user()->id, 403);

        if ($message->unsent_at === null) {
            DB::transaction(function () use ($message) {
                $message->reactions()->delete();
                $message->forceFill([
                    'body' => '',
                    'metadata' => null,
                    'edited_at' => null,
                    'unsent_at' => now(),
                    'pinned_at' => null,
                    'pinned_by' => null,
                ])->save();
            });
        }

        $message->load(['attachments', 'conversation.team', 'replyTo.sender:id,name', 'sender:id,name,school_role', 'reactions.user:id,name', 'readers:id,name']);

        broadcast(new MessageUpdated($message))->toOthers();

        return response()->json([
            'data' => MessagePayload::from($message, $request->user()->id),
        ]);
    }

    /**
     * Forward a message to one or more conversations.
     */
    public function forward(Request $request, Team $team, Conversation $conversation, Message $message): JsonResponse
    {
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);
        $this->ensureMessageBelongsToConversation($conversation, $message);
        abort_if($message->unsent_at !== null, 422, 'Unsent messages cannot be forwarded.');

        $data = $request->validate([
            'conversation_ids' => ['required', 'array', 'min:1', 'max:10'],
            'conversation_ids.*' => ['integer', 'distinct'],
        ]);

        $targetConversations = Conversation::query()
            ->where('team_id', $team->id)
            ->whereIn('id', $data['conversation_ids'])
            ->whereHas('participants', fn ($query) => $query->whereKey($request->user()->id))
            ->get();

        abort_unless($targetConversations->count() === count($data['conversation_ids']), 422, 'All target conversations must be available to you.');

        $message->load(['attachments', 'conversation.team']);

        $forwardedMessages = DB::transaction(function () use ($message, $request, $targetConversations) {
            return $targetConversations->map(function (Conversation $targetConversation) use ($message, $request): Message {
                $forwardedMessage = $targetConversation->messages()->create([
                    'sender_id' => $request->user()->id,
                    'type' => $message->attachments->isNotEmpty() ? 'attachment' : $message->type,
                    'body' => $message->body,
                    'metadata' => array_filter([
                        ...(is_array($message->metadata) ? $message->metadata : []),
                        'forwarded_from_message_id' => $message->id,
                    ]),
                ]);

                foreach ($message->attachments as $attachment) {
                    abort_unless(Storage::disk($attachment->disk)->exists($attachment->path), 404);

                    $path = "message-attachments/{$targetConversation->team_id}/{$targetConversation->id}/".Str::uuid().'-'.$attachment->original_name;
                    Storage::disk($attachment->disk)->copy($attachment->path, $path);

                    $forwardedMessage->attachments()->create([
                        'disk' => $attachment->disk,
                        'path' => $path,
                        'original_name' => $attachment->original_name,
                        'mime_type' => $attachment->mime_type,
                        'size' => $attachment->size,
                    ]);
                }

                $targetConversation->forceFill(['last_message_at' => $forwardedMessage->created_at])->save();
                $targetConversation->participants()->updateExistingPivot($request->user()->id, ['last_read_at' => now()]);

                return $forwardedMessage;
            });
        });

        $forwardedMessages->each(function (Message $forwardedMessage) {
            broadcast(new MessageCreated($forwardedMessage->load(['attachments', 'conversation.team', 'replyTo.sender:id,name', 'sender:id,name,school_role', 'reactions.user:id,name', 'readers:id,name'])))->toOthers();
        });

        return response()->json([
            'data' => $forwardedMessages
                ->map(fn (Message $forwardedMessage) => MessagePayload::from($forwardedMessage, $request->user()->id))
                ->values(),
        ], 201);
    }

    /**
     * Pin or unpin a message in a conversation.
     */
    public function pin(Request $request, Team $team, Conversation $conversation, Message $message): JsonResponse
    {
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);
        $this->ensureMessageBelongsToConversation($conversation, $message);
        abort_if($message->unsent_at !== null, 422, 'Unsent messages cannot be pinned.');
        abort_if($message->type === 'system', 422, 'System messages cannot be pinned.');

        $data = $request->validate([
            'pinned' => ['required', 'boolean'],
        ]);

        $message->forceFill([
            'pinned_at' => $data['pinned'] ? now() : null,
            'pinned_by' => $data['pinned'] ? $request->user()->id : null,
        ])->save();

        $message->load(['attachments', 'conversation.team', 'pinner:id,name', 'replyTo.sender:id,name', 'sender:id,name,school_role', 'reactions.user:id,name', 'readers:id,name']);

        broadcast(new MessageUpdated($message))->toOthers();

        return response()->json([
            'data' => MessagePayload::from($message, $request->user()->id),
        ]);
    }

    /**
     * Download an attachment from a conversation the user can access.
     */
    public function downloadAttachment(Request $request, Team $team, Conversation $conversation, Message $message, MessageAttachment $attachment): StreamedResponse
    {
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);
        $this->ensureAttachmentBelongsToMessage($conversation, $message, $attachment);

        return Storage::disk($attachment->disk)->download(
            $attachment->path,
            $attachment->original_name,
            ['Content-Type' => $attachment->mime_type ?? 'application/octet-stream'],
        );
    }

    /**
     * Preview supported media attachments inside a conversation.
     */
    public function previewAttachment(Request $request, Team $team, Conversation $conversation, Message $message, MessageAttachment $attachment): StreamedResponse
    {
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);
        $this->ensureAttachmentBelongsToMessage($conversation, $message, $attachment);
        abort_unless($attachment->isPreviewableMedia(), 404);

        return Storage::disk($attachment->disk)->response(
            $attachment->path,
            $attachment->original_name,
            ['Content-Type' => $attachment->mime_type ?? 'application/octet-stream'],
        );
    }

    /**
     * Mark a conversation as read for the authenticated user.
     */
    public function markRead(Request $request, Team $team, Conversation $conversation): JsonResponse
    {
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);

        $readAt = now();

        DB::transaction(function () use ($conversation, $request, $readAt) {
            $conversation->participants()->updateExistingPivot($request->user()->id, ['last_read_at' => $readAt]);

            $conversation->messages()
                ->where('sender_id', '!=', $request->user()->id)
                ->where('created_at', '<=', $readAt)
                ->pluck('id')
                ->chunk(500)
                ->each(function ($messageIds) use ($request, $readAt) {
                    DB::table('message_reads')->insertOrIgnore(
                        $messageIds->map(fn (int $messageId) => [
                            'message_id' => $messageId,
                            'user_id' => $request->user()->id,
                            'read_at' => $readAt,
                        ])->all(),
                    );
                });
        });

        broadcast(new ConversationRead(
            conversationId: $conversation->id,
            userId: $request->user()->id,
            readAt: $readAt->toISOString(),
        ))->toOthers();

        return response()->json(['data' => ['read' => true]]);
    }

    /**
     * Add or update the authenticated user's reaction to a message.
     */
    public function react(Request $request, Team $team, Conversation $conversation, Message $message): JsonResponse
    {
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);
        abort_unless($message->conversation_id === $conversation->id, 404);
        abort_if($message->unsent_at !== null, 422, 'Unsent messages cannot receive reactions.');

        $data = $request->validate([
            'emoji' => ['required', 'string', Rule::in(['👍', '❤️', '😂', '😮', '🙏', '✅'])],
        ]);

        $message->reactions()->updateOrCreate(
            ['user_id' => $request->user()->id],
            ['emoji' => $data['emoji']],
        );

        $message->load(['reactions.user:id,name']);
        $reactions = MessagePayload::reactions($message, $request->user()->id);

        broadcast(new MessageReactionUpdated(
            conversationId: $conversation->id,
            messageId: $message->id,
            reactions: MessagePayload::reactions($message),
        ))->toOthers();

        return response()->json(['data' => ['reactions' => $reactions]]);
    }

    /**
     * Remove the authenticated user's reaction from a message.
     */
    public function unreact(Request $request, Team $team, Conversation $conversation, Message $message): JsonResponse
    {
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);
        abort_unless($message->conversation_id === $conversation->id, 404);
        abort_if($message->unsent_at !== null, 422, 'Unsent messages cannot receive reactions.');

        $message->reactions()->where('user_id', $request->user()->id)->delete();

        $message->load(['reactions.user:id,name']);
        $reactions = MessagePayload::reactions($message, $request->user()->id);

        broadcast(new MessageReactionUpdated(
            conversationId: $conversation->id,
            messageId: $message->id,
            reactions: MessagePayload::reactions($message),
        ))->toOthers();

        return response()->json(['data' => ['reactions' => $reactions]]);
    }

    private function canAccessConversation(Request $request, Team $team, Conversation $conversation): bool
    {
        return $request->user() !== null
            && $conversation->team_id === $team->id
            && $request->user()->teams()->whereKey($team->id)->exists()
            && $conversation->participants()->whereKey($request->user()->id)->exists();
    }

    private function ensureAttachmentBelongsToMessage(Conversation $conversation, Message $message, MessageAttachment $attachment): void
    {
        $this->ensureMessageBelongsToConversation($conversation, $message);
        abort_unless($attachment->message_id === $message->id, 404);
        abort_unless(Storage::disk($attachment->disk)->exists($attachment->path), 404);
    }

    private function ensureMessageBelongsToConversation(Conversation $conversation, Message $message): void
    {
        abort_unless($message->conversation_id === $conversation->id, 404);
    }

    private function replyToMessageId(StoreMessageRequest $request, Conversation $conversation): ?int
    {
        $replyToMessageId = $request->validated('reply_to_message_id');

        if (! $replyToMessageId) {
            return null;
        }

        $exists = $conversation->messages()
            ->whereKey($replyToMessageId)
            ->whereNull('unsent_at')
            ->exists();

        abort_unless($exists, 422, 'Reply target must belong to this conversation.');

        return (int) $replyToMessageId;
    }

    /**
     * @return array<string, mixed>
     */
    private function sharedAttachmentPayload(MessageAttachment $attachment): array
    {
        return [
            'id' => $attachment->id,
            'message_id' => $attachment->message_id,
            'name' => $attachment->original_name,
            'mime_type' => $attachment->mime_type,
            'size' => $attachment->size,
            'url' => $attachment->downloadUrl($attachment->message),
            'preview_url' => $attachment->previewUrl($attachment->message),
            'created_at' => $attachment->created_at?->toISOString(),
            'sender' => $attachment->message->sender ? [
                'id' => $attachment->message->sender->id,
                'name' => $attachment->message->sender->name,
            ] : null,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function linkPayloads(Message $message): array
    {
        preg_match_all('/https?:\/\/[^\s<>"\']+/i', $message->body, $matches);

        return collect($matches[0])
            ->unique()
            ->map(function (string $url) use ($message) {
                $cleanUrl = rtrim($url, '.,);]');

                return [
                    'url' => $cleanUrl,
                    'host' => parse_url($cleanUrl, PHP_URL_HOST) ?: $cleanUrl,
                    'message_id' => $message->id,
                    'created_at' => $message->created_at?->toISOString(),
                    'sender' => $message->sender ? [
                        'id' => $message->sender->id,
                        'name' => $message->sender->name,
                    ] : null,
                ];
            })
            ->values()
            ->all();
    }
}
