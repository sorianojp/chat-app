<?php

namespace App\Services;

use App\Models\PushToken;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class FirebasePushService
{
    public function configured(): bool
    {
        return filled(config('services.firebase.project_id'))
            && filled(config('services.firebase.credentials'));
    }

    /**
     * @param  array<string, string>  $data
     */
    public function send(PushToken $pushToken, string $title, string $body, array $data): void
    {
        $projectId = (string) config('services.firebase.project_id');
        $response = Http::acceptJson()
            ->withToken($this->accessToken())
            ->timeout((int) config('services.firebase.timeout', 10))
            ->post("https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send", [
                'message' => [
                    'token' => $pushToken->token,
                    'notification' => [
                        'title' => $title,
                        'body' => $body,
                    ],
                    'data' => $data,
                    'android' => [
                        'priority' => 'HIGH',
                        'notification' => [
                            'channel_id' => 'uhoo_messages',
                            'sound' => 'default',
                        ],
                    ],
                    'apns' => [
                        'headers' => ['apns-priority' => '10'],
                        'payload' => [
                            'aps' => [
                                'sound' => 'default',
                                'thread-id' => 'conversation-'.$data['conversation_id'],
                            ],
                        ],
                    ],
                ],
            ]);

        if ($response->successful()) {
            return;
        }
        if ($this->isUnregistered($response)) {
            $pushToken->delete();

            return;
        }

        $response->throw();
    }

    private function accessToken(): string
    {
        $credentials = $this->credentials();
        $email = (string) ($credentials['client_email'] ?? '');

        return Cache::remember(
            'firebase:oauth:'.hash('sha256', $email),
            now()->addMinutes(50),
            function () use ($credentials, $email): string {
                $privateKey = (string) ($credentials['private_key'] ?? '');
                $tokenUri = (string) ($credentials['token_uri'] ?? 'https://oauth2.googleapis.com/token');
                if ($email === '' || $privateKey === '') {
                    throw new RuntimeException('The Firebase service account credentials are incomplete.');
                }

                $now = time();
                $header = $this->base64Url(json_encode(['alg' => 'RS256', 'typ' => 'JWT'], JSON_THROW_ON_ERROR));
                $claims = $this->base64Url(json_encode([
                    'iss' => $email,
                    'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
                    'aud' => $tokenUri,
                    'iat' => $now,
                    'exp' => $now + 3600,
                ], JSON_THROW_ON_ERROR));
                $unsigned = $header.'.'.$claims;
                $signature = '';
                $signed = openssl_sign($unsigned, $signature, $privateKey, OPENSSL_ALGO_SHA256);
                if (! $signed) {
                    throw new RuntimeException('Could not sign the Firebase service-account assertion.');
                }

                $response = Http::asForm()
                    ->timeout((int) config('services.firebase.timeout', 10))
                    ->post($tokenUri, [
                        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                        'assertion' => $unsigned.'.'.$this->base64Url($signature),
                    ])
                    ->throw();
                $token = $response->json('access_token');
                if (! is_string($token) || $token === '') {
                    throw new RuntimeException('Firebase did not return an OAuth access token.');
                }

                return $token;
            },
        );
    }

    /** @return array<string, mixed> */
    private function credentials(): array
    {
        $source = trim((string) config('services.firebase.credentials'));
        if (str_starts_with($source, '{')) {
            $json = $source;
        } else {
            $path = str_starts_with($source, DIRECTORY_SEPARATOR) ? $source : base_path($source);
            $json = is_readable($path) ? file_get_contents($path) : false;
        }
        if (! is_string($json)) {
            throw new RuntimeException('The Firebase service account credentials could not be read.');
        }
        $credentials = json_decode($json, true, flags: JSON_THROW_ON_ERROR);
        if (! is_array($credentials)) {
            throw new RuntimeException('The Firebase service account credentials are invalid.');
        }

        return $credentials;
    }

    private function base64Url(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private function isUnregistered(Response $response): bool
    {
        $details = $response->json('error.details');
        if (! is_array($details)) {
            return false;
        }

        foreach ($details as $detail) {
            if (is_array($detail) && ($detail['errorCode'] ?? null) === 'UNREGISTERED') {
                return true;
            }
        }

        return false;
    }
}
