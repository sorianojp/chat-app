<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PushToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Laravel\Sanctum\PersonalAccessToken;

class PushTokenController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'min:20', 'max:4096'],
            'platform' => ['required', Rule::in(['android', 'ios'])],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);
        $accessToken = $request->user()?->currentAccessToken();
        abort_unless($accessToken instanceof PersonalAccessToken, 401);
        $hash = hash('sha256', $data['token']);

        $pushToken = DB::transaction(function () use ($request, $accessToken, $data, $hash): PushToken {
            // A Sanctum token represents one app session. Token refresh must
            // replace its previous FCM registration to prevent duplicates.
            PushToken::query()
                ->where('personal_access_token_id', $accessToken->id)
                ->where('token_hash', '!=', $hash)
                ->delete();

            return PushToken::query()->updateOrCreate(
                ['token_hash' => $hash],
                [
                    'user_id' => $request->user()->id,
                    'personal_access_token_id' => $accessToken->id,
                    'token' => $data['token'],
                    'platform' => $data['platform'],
                    'device_name' => $data['device_name'] ?? null,
                    'last_seen_at' => now(),
                ],
            );
        });

        return response()->json([
            'data' => [
                'registered' => true,
                'platform' => $pushToken->platform,
            ],
        ], $pushToken->wasRecentlyCreated ? 201 : 200);
    }
}
