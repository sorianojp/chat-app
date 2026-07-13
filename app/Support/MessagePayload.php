<?php

namespace App\Support;

use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\MessageReaction;
use App\Models\User;
use Illuminate\Database\Eloquent\Relations\Pivot;
use Illuminate\Support\Collection;

class MessagePayload
{
    /**
     * @return array<string, mixed>
     */
    public static function from(Message $message, ?int $currentUserId = null): array
    {
        $message->loadMissing([
            'attachments',
            'conversation.team',
            'replyTo.sender:id,name',
            'sender:id,name,school_role',
            'pinner:id,name',
            'reactions.user:id,name',
            'readers:id,name',
        ]);
        $isUnsent = $message->unsent_at !== null;

        return [
            'id' => $message->id,
            'conversation_id' => $message->conversation_id,
            'sender' => $message->sender ? [
                'id' => $message->sender->id,
                'name' => $message->sender->name,
                'school_role' => $message->sender->school_role->value,
            ] : null,
            'pinned_by' => $message->pinner ? [
                'id' => $message->pinner->id,
                'name' => $message->pinner->name,
            ] : null,
            'type' => $message->type,
            'body' => $isUnsent ? '' : $message->body,
            'metadata' => $isUnsent ? null : $message->metadata,
            'reply_to' => $isUnsent ? null : self::replyTo($message),
            'attachments' => $isUnsent ? [] : $message->attachments->map(fn (MessageAttachment $attachment) => [
                'id' => $attachment->id,
                'name' => $attachment->original_name,
                'mime_type' => $attachment->mime_type,
                'size' => $attachment->size,
                'url' => $attachment->downloadUrl($message),
                'preview_url' => $attachment->previewUrl($message),
            ])->values(),
            'reactions' => $isUnsent ? [] : self::reactions($message, $currentUserId),
            'read_by' => self::readers($message),
            'created_at' => $message->created_at?->toISOString(),
            'edited_at' => $message->edited_at?->toISOString(),
            'unsent_at' => $message->unsent_at?->toISOString(),
            'pinned_at' => $message->pinned_at?->toISOString(),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public static function reactions(Message $message, ?int $currentUserId = null): array
    {
        $message->loadMissing(['reactions.user:id,name']);

        return $message->reactions
            ->groupBy('emoji')
            ->map(fn (Collection $reactions, string $emoji) => [
                'emoji' => $emoji,
                'count' => $reactions->count(),
                'reacted_by_me' => $currentUserId !== null
                    && $reactions->contains(fn (MessageReaction $reaction) => $reaction->user_id === $currentUserId),
                'users' => $reactions
                    ->map(fn (MessageReaction $reaction) => [
                        'id' => $reaction->user->id,
                        'name' => $reaction->user->name,
                    ])
                    ->values(),
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private static function readers(Message $message): array
    {
        $message->loadMissing(['readers:id,name']);

        return $message->readers
            ->map(function (User $reader) {
                $pivot = $reader->getAttribute('pivot');

                if (! $pivot instanceof Pivot) {
                    return null;
                }

                return [
                    'id' => $reader->id,
                    'name' => $reader->name,
                    'read_at' => $pivot->getAttribute('read_at'),
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>|null
     */
    private static function replyTo(Message $message): ?array
    {
        $replyTo = $message->replyTo;

        if (! $replyTo instanceof Message) {
            return null;
        }

        return [
            'id' => $replyTo->id,
            'sender' => $replyTo->sender ? [
                'id' => $replyTo->sender->id,
                'name' => $replyTo->sender->name,
            ] : null,
            'body' => $replyTo->unsent_at ? '' : $replyTo->body,
            'attachment_count' => $replyTo->unsent_at ? 0 : $replyTo->attachments()->count(),
            'unsent_at' => $replyTo->unsent_at?->toISOString(),
        ];
    }
}
