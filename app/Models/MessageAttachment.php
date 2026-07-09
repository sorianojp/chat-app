<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $message_id
 * @property string $disk
 * @property string $path
 * @property string $original_name
 * @property string|null $mime_type
 * @property int $size
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Message $message
 */
#[Fillable(['message_id', 'disk', 'path', 'original_name', 'mime_type', 'size'])]
class MessageAttachment extends Model
{
    /**
     * Determine if the attachment can be previewed directly in the messenger.
     */
    public function isPreviewableMedia(): bool
    {
        return str_starts_with((string) $this->mime_type, 'image/')
            || str_starts_with((string) $this->mime_type, 'video/')
            || str_starts_with((string) $this->mime_type, 'audio/');
    }

    /**
     * Get the authenticated download URL for the attachment.
     */
    public function downloadUrl(?Message $message = null): string
    {
        $message ??= $this->message;

        return route('messenger.attachments.download', [
            'team' => $message->conversation->team,
            'conversation' => $message->conversation_id,
            'message' => $message->id,
            'attachment' => $this->id,
        ]);
    }

    /**
     * Get the authenticated inline preview URL for supported media.
     */
    public function previewUrl(?Message $message = null): ?string
    {
        if (! $this->isPreviewableMedia()) {
            return null;
        }

        $message ??= $this->message;

        return route('messenger.attachments.preview', [
            'team' => $message->conversation->team,
            'conversation' => $message->conversation_id,
            'message' => $message->id,
            'attachment' => $this->id,
        ]);
    }

    /**
     * Get the message that owns the attachment.
     *
     * @return BelongsTo<Message, $this>
     */
    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class);
    }
}
