<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;
use Illuminate\Support\Carbon;

/**
 * The conversation_participants pivot.
 *
 * Without this, the pivot's timestamp columns come back from the database as
 * raw strings, and every payload that serializes them reports null — so a
 * client can never tell that a conversation is pinned, muted or archived, and
 * therefore can never offer to undo it.
 *
 * @property Carbon|null $last_read_at
 * @property Carbon|null $pinned_at
 * @property Carbon|null $muted_at
 * @property Carbon|null $archived_at
 */
class ConversationParticipant extends Pivot
{
    protected $table = 'conversation_participants';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'last_read_at' => 'datetime',
            'pinned_at' => 'datetime',
            'muted_at' => 'datetime',
            'archived_at' => 'datetime',
        ];
    }
}
