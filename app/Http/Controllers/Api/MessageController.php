<?php

namespace App\Http\Controllers\Api;

use App\Events\ConversationRead;
use App\Events\MessageCreated;
use App\Events\MessageReactionUpdated;
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
            ->with(['attachments', 'conversation.team', 'sender:id,name,school_role', 'reactions.user:id,name', 'readers:id,name'])
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
            ->whereHas('message', fn ($query) => $query->where('conversation_id', $conversation->id))
            ->latest()
            ->limit(120)
            ->get();

        $links = $conversation->messages()
            ->with('sender:id,name')
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

        broadcast(new MessageCreated($message->load(['attachments', 'conversation.team', 'sender:id,name,school_role', 'reactions.user:id,name', 'readers:id,name'])))->toOthers();

        return response()->json([
            'data' => MessagePayload::from($message, $request->user()->id),
        ], 201);
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
        abort_unless($message->conversation_id === $conversation->id && $attachment->message_id === $message->id, 404);
        abort_unless(Storage::disk($attachment->disk)->exists($attachment->path), 404);
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
