<?php

namespace App\Support;

use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\MessageDelivery;
use App\Models\MessageMention;
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
            'deliveries.user:id,name',
            'mentions.user:id,name',
            'pollVotes.user:id,name',
            'eventRsvps.user:id,name',
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
            'poll' => $isUnsent ? null : self::poll($message, $currentUserId),
            'event' => $isUnsent ? null : self::event($message, $currentUserId),
            'reply_to' => $isUnsent ? null : self::replyTo($message),
            'attachments' => $isUnsent ? [] : $message->attachments->map(fn (MessageAttachment $attachment) => [
                'id' => $attachment->id,
                'name' => $attachment->original_name,
                'mime_type' => $attachment->mime_type,
                'size' => $attachment->size,
                'url' => $attachment->downloadUrl($message),
                'preview_url' => $attachment->previewUrl($message),
            ])->values(),
            'mentions' => $isUnsent ? [] : self::mentions($message),
            'mentions_me' => $isUnsent ? false : self::mentionsMe($message, $currentUserId),
            'mentions_everyone' => $isUnsent ? false : $message->mentions->contains(fn (MessageMention $mention) => $mention->type === 'everyone'),
            'delivered_to' => self::deliveries($message),
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
    private static function mentions(Message $message): array
    {
        $message->loadMissing(['mentions.user:id,name']);

        return $message->mentions
            ->map(fn (MessageMention $mention) => [
                'id' => $mention->user->id,
                'name' => $mention->user->name,
                'type' => $mention->type,
            ])
            ->values()
            ->all();
    }

    private static function mentionsMe(Message $message, ?int $currentUserId): bool
    {
        if ($currentUserId === null) {
            return false;
        }

        $message->loadMissing(['mentions']);

        return $message->mentions->contains(fn (MessageMention $mention) => $mention->user_id === $currentUserId);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private static function deliveries(Message $message): array
    {
        $message->loadMissing(['deliveries.user:id,name']);

        return $message->deliveries
            ->map(fn (MessageDelivery $delivery) => [
                'id' => $delivery->user->id,
                'name' => $delivery->user->name,
                'delivered_at' => $delivery->delivered_at->toISOString(),
            ])
            ->values()
            ->all();
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

    /**
     * @return array<string, mixed>|null
     */
    private static function poll(Message $message, ?int $currentUserId): ?array
    {
        $poll = $message->metadata['poll'] ?? null;

        if ($message->type !== 'poll' || ! is_array($poll)) {
            return null;
        }

        $message->loadMissing(['pollVotes.user:id,name']);
        $votes = $message->pollVotes->groupBy('option_id');

        return [
            'question' => (string) ($poll['question'] ?? $message->body),
            'allow_multiple' => (bool) ($poll['allow_multiple'] ?? false),
            'closes_at' => $poll['closes_at'] ?? null,
            'total_voters' => $message->pollVotes->pluck('user_id')->unique()->count(),
            'options' => collect($poll['options'] ?? [])->map(function (array $option) use ($votes, $currentUserId) {
                $optionVotes = $votes->get($option['id'], collect());

                return [
                    'id' => $option['id'],
                    'label' => $option['label'],
                    'vote_count' => $optionVotes->count(),
                    'voted_by_me' => $currentUserId !== null && $optionVotes->contains('user_id', $currentUserId),
                    'voters' => $optionVotes->map(fn ($vote) => [
                        'id' => $vote->user->id,
                        'name' => $vote->user->name,
                    ])->values(),
                ];
            })->values(),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private static function event(Message $message, ?int $currentUserId): ?array
    {
        $event = $message->metadata['event'] ?? null;

        if ($message->type !== 'event' || ! is_array($event)) {
            return null;
        }

        $message->loadMissing(['eventRsvps.user:id,name']);

        return [
            'title' => (string) ($event['title'] ?? $message->body),
            'description' => $event['description'] ?? null,
            'starts_at' => $event['starts_at'] ?? null,
            'location' => $event['location'] ?? null,
            'my_response' => $currentUserId !== null
                ? $message->eventRsvps->firstWhere('user_id', $currentUserId)?->status
                : null,
            'responses' => collect(['attending', 'maybe', 'declined'])->mapWithKeys(fn (string $status) => [
                $status => $message->eventRsvps
                    ->where('status', $status)
                    ->map(fn ($rsvp) => [
                        'id' => $rsvp->user->id,
                        'name' => $rsvp->user->name,
                    ])->values(),
            ]),
        ];
    }
}
