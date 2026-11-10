<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Message;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Unread message count for a STEP user, for the badge on STEP's Uhoo! button.
 * Called server-to-server by STEP with the shared STEP_UNREAD_API_KEY. Muted
 * and archived conversations are left out, matching what the user is notified about.
 */
class StepUnreadCountController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $key = (string) config('services.step_sso.unread_api_key');

        abort_if($key === '' || ! hash_equals($key, (string) $request->header('X-Api-Key')), 401);

        $sub = $request->query('sub');

        abort_unless(is_string($sub) && $sub !== '', 422, 'The sub query parameter is required.');

        $userId = User::query()->where('step_user_id', $sub)->value('id');

        if ($userId === null) {
            return response()->json(['count' => 0]);
        }

        $count = Message::query()
            ->join('conversation_participants', function (JoinClause $join) use ($userId): void {
                $join->on('conversation_participants.conversation_id', '=', 'messages.conversation_id')
                    ->where('conversation_participants.user_id', $userId);
            })
            ->whereHas('conversation')
            ->whereNull('conversation_participants.archived_at')
            ->whereNull('conversation_participants.muted_at')
            ->where('conversation_participants.notification_preference', '!=', 'muted')
            ->where('messages.sender_id', '!=', $userId)
            ->where(function (Builder $query): void {
                $query->whereNull('conversation_participants.last_read_at')
                    ->orWhereColumn('messages.created_at', '>', 'conversation_participants.last_read_at');
            })
            ->count();

        return response()->json(['count' => $count]);
    }
}
