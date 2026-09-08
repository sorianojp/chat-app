<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;

class MobileAuthController extends Controller
{
    public const SESSION_KEY = 'step_sso.mobile';

    public function start(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code_challenge' => ['required', 'string', 'regex:/^[A-Za-z0-9_-]{43}$/'],
            'device_name' => ['required', 'string', 'max:100'],
        ]);
        $state = Str::random(64);
        Cache::put('mobile:start:'.$state, [...$data, 'state' => $state], now()->addMinutes(5));

        return response()->json([
            'state' => $state,
            'authorization_url' => route('mobile.authorize', ['state' => $state]),
        ])->header('Cache-Control', 'no-store');
    }

    public function authorize(Request $request, string $state): RedirectResponse
    {
        $data = Cache::pull('mobile:start:'.$state);
        abort_unless(is_array($data), 410, 'This sign-in request has expired. Please return to the app and try again.');
        $request->session()->put(self::SESSION_KEY, $data);

        return to_route('step-sso.redirect');
    }

    public static function complete(Request $request, User $user): ?RedirectResponse
    {
        $data = $request->session()->pull(self::SESSION_KEY);
        if (! is_array($data)) {
            return null;
        }

        $code = Str::random(64);
        Cache::put('mobile:code:'.hash('sha256', $code), [
            ...$data,
            'user_id' => $user->id,
        ], now()->addSeconds(60));

        return redirect()->away('stepmessenger://auth?'.http_build_query([
            'code' => $code,
            'state' => $data['state'],
        ]))->header('Cache-Control', 'no-store');
    }

    public static function fail(Request $request): ?RedirectResponse
    {
        $data = $request->session()->pull(self::SESSION_KEY);
        if (! is_array($data)) {
            return null;
        }

        return redirect()->away('stepmessenger://auth?'.http_build_query([
            'error' => 'sign_in_failed',
            'state' => $data['state'],
        ]))->header('Cache-Control', 'no-store');
    }

    public function exchange(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'size:64'],
            'code_verifier' => ['required', 'string', 'regex:/^[A-Za-z0-9._~-]{43,128}$/'],
        ]);
        $key = 'mobile:code:'.hash('sha256', $validated['code']);

        return Cache::lock($key.':lock', 10)->block(3, function () use ($validated, $key): JsonResponse {
            $data = Cache::get($key);
            $challenge = rtrim(strtr(base64_encode(hash('sha256', $validated['code_verifier'], true)), '+/', '-_'), '=');
            abort_unless(is_array($data) && hash_equals($data['code_challenge'], $challenge), 401, 'The sign-in request expired or was invalid.');
            Cache::forget($key);
            $user = User::query()->whereKey($data['user_id'])->firstOrFail();
            $expiresAt = now()->addDays(30);
            $token = $user->createToken($data['device_name'], ['*'], $expiresAt);

            return response()->json([
                'token' => $token->plainTextToken,
                'expires_at' => $expiresAt->toISOString(),
            ])->header('Cache-Control', 'no-store');
        });
    }

    public function destroy(Request $request): JsonResponse
    {
        $token = $request->user()?->currentAccessToken();
        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }

        return response()->json(['message' => 'Signed out.']);
    }
}
