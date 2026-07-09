<?php

namespace App\Http\Controllers\Api;

use App\Events\MessageCreated;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreMessageRequest;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
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
            ->with(['attachments', 'sender:id,name,school_role'])
            ->latest()
            ->paginate(40)
            ->through(fn (Message $message) => $this->messagePayload($message));

        return response()->json($messages);
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

        broadcast(new MessageCreated($message->load(['attachments', 'sender:id,name,school_role'])))->toOthers();

        return response()->json([
            'data' => $this->messagePayload($message->load(['attachments', 'sender:id,name,school_role'])),
        ], 201);
    }

    /**
     * Download an attachment from a conversation the user can access.
     */
    public function downloadAttachment(Request $request, Team $team, Conversation $conversation, Message $message, MessageAttachment $attachment): StreamedResponse
    {
        abort_unless($this->canAccessConversation($request, $team, $conversation), 403);
        abort_unless($message->conversation_id === $conversation->id && $attachment->message_id === $message->id, 404);
        abort_unless(Storage::disk($attachment->disk)->exists($attachment->path), 404);

        return Storage::disk($attachment->disk)->download(
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
            'attachments' => $message->attachments->map(fn (MessageAttachment $attachment) => [
                'id' => $attachment->id,
                'name' => $attachment->original_name,
                'mime_type' => $attachment->mime_type,
                'size' => $attachment->size,
                'url' => url("/api/teams/{$message->conversation->team->slug}/conversations/{$message->conversation_id}/messages/{$message->id}/attachments/{$attachment->id}"),
            ])->values(),
            'created_at' => $message->created_at?->toISOString(),
        ];
    }
}
