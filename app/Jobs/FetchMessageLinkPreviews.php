<?php

namespace App\Jobs;

use App\Events\MessageUpdated;
use App\Models\Message;
use App\Services\LinkPreviewService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class FetchMessageLinkPreviews implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 30;

    public function __construct(
        public readonly int $messageId,
        public readonly string $body,
    ) {}

    public function handle(LinkPreviewService $linkPreviewService): void
    {
        $linkPreviews = $linkPreviewService->previewsFor($this->body);

        if ($linkPreviews === []) {
            return;
        }

        $message = Message::query()->find($this->messageId);

        // Skip stale work: the message was unsent or edited after this job was queued.
        if ($message === null || $message->unsent_at !== null || $message->body !== $this->body) {
            return;
        }

        $message->forceFill([
            'metadata' => [...($message->metadata ?? []), 'link_previews' => $linkPreviews],
        ])->save();

        broadcast(new MessageUpdated($message));
    }
}
