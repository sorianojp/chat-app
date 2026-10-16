<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WebPushSubscription;
use App\Services\WebPushService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class WebPushSubscriptionController extends Controller
{
    public function config(WebPushService $webPush): JsonResponse
    {
        return response()->json([
            'data' => [
                'enabled' => $webPush->configured(),
                'public_key' => $webPush->publicKey(),
            ],
        ]);
    }

    public function update(Request $request, WebPushService $webPush): JsonResponse
    {
        abort_unless($webPush->configured(), 503, 'Background browser alerts are not configured.');

        $data = $request->validate([
            'endpoint' => ['required', 'url:http,https', 'max:2048'],
            'keys' => ['required', 'array'],
            'keys.p256dh' => ['required', 'string', 'max:255'],
            'keys.auth' => ['required', 'string', 'max:255'],
            'content_encoding' => ['required', Rule::in(['aesgcm', 'aes128gcm'])],
        ]);
        $hash = hash('sha256', $data['endpoint']);

        $subscription = WebPushSubscription::query()->updateOrCreate(
            ['endpoint_hash' => $hash],
            [
                'user_id' => $request->user()->id,
                'endpoint' => $data['endpoint'],
                'public_key' => $data['keys']['p256dh'],
                'auth_token' => $data['keys']['auth'],
                'content_encoding' => $data['content_encoding'],
                'user_agent' => $request->userAgent(),
                'last_seen_at' => now(),
            ],
        );

        return response()->json([
            'data' => ['registered' => true],
        ], $subscription->wasRecentlyCreated ? 201 : 200);
    }

    public function destroy(Request $request): JsonResponse
    {
        $data = $request->validate([
            'endpoint' => ['required', 'url:http,https', 'max:2048'],
        ]);

        WebPushSubscription::query()
            ->where('user_id', $request->user()->id)
            ->where('endpoint_hash', hash('sha256', $data['endpoint']))
            ->delete();

        return response()->json(['data' => ['registered' => false]]);
    }
}
