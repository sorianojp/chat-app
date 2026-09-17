<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SyncStepClassroomsJob;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StepClassroomWebhookController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $secret = trim((string) config('services.step_sso.webhook_secret'));
        $timestamp = $request->header('X-STEP-Timestamp');
        $signature = $request->header('X-STEP-Signature');

        abort_if($secret === '' || ! is_string($timestamp) || ! is_string($signature), 401);
        abort_if(! ctype_digit($timestamp) || abs(time() - (int) $timestamp) > 300, 401);

        $expected = hash_hmac('sha256', $timestamp.'.'.$request->getContent(), $secret);
        abort_unless(hash_equals($expected, $signature), 401);

        $request->validate([
            'event' => ['required', 'string', 'in:room.changed,room.member.changed,term.changed'],
            'room_id' => ['nullable', 'string', 'max:255'],
        ]);

        SyncStepClassroomsJob::dispatch();

        return response()->json(['accepted' => true], 202);
    }
}
