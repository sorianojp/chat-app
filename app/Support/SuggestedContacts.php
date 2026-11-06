<?php

namespace App\Support;

use App\Enums\ConversationType;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class SuggestedContacts
{
    public const LIMIT = 5;

    /**
     * IDs of the people the user most recently messaged one-to-one in this
     * school, newest first. Shown in the new-message picker before searching.
     *
     * @return Collection<int, int>
     */
    public static function ids(User $user, Team $team): Collection
    {
        return DB::table('conversation_participants as mine')
            ->join('conversations', 'conversations.id', '=', 'mine.conversation_id')
            ->join('conversation_participants as theirs', function ($join) use ($user) {
                $join->on('theirs.conversation_id', '=', 'conversations.id')
                    ->where('theirs.user_id', '!=', $user->id);
            })
            ->join('team_members', function ($join) use ($team) {
                $join->on('team_members.user_id', '=', 'theirs.user_id')
                    ->where('team_members.team_id', $team->id);
            })
            ->where('mine.user_id', $user->id)
            ->where('conversations.team_id', $team->id)
            ->where('conversations.type', ConversationType::Direct->value)
            ->whereNotNull('conversations.last_message_at')
            ->orderByDesc('conversations.last_message_at')
            ->limit(self::LIMIT * 4)
            ->pluck('theirs.user_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->take(self::LIMIT)
            ->values();
    }
}
