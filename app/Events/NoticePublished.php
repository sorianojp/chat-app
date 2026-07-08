<?php

namespace App\Events;

use App\Models\Notice;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NoticePublished implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Notice $notice)
    {
        $this->notice->loadMissing(['author', 'schoolClass']);
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("teams.{$this->notice->team_id}.notices"),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'notice.published';
    }

    /**
     * Get the data to broadcast.
     *
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'notice' => [
                'id' => $this->notice->id,
                'team_id' => $this->notice->team_id,
                'school_class' => $this->notice->schoolClass ? [
                    'id' => $this->notice->schoolClass->id,
                    'name' => $this->notice->schoolClass->name,
                ] : null,
                'author' => $this->notice->author ? [
                    'id' => $this->notice->author->id,
                    'name' => $this->notice->author->name,
                ] : null,
                'category' => $this->notice->category->value,
                'title' => $this->notice->title,
                'body' => $this->notice->body,
                'published_at' => $this->notice->published_at?->toISOString(),
            ],
        ];
    }
}
