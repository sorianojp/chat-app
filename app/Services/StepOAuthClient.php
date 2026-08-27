<?php

namespace App\Services;

use App\Data\StepIdentity;
use App\Exceptions\StepSsoException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class StepOAuthClient
{
    public function authorizationUrl(string $state, string $codeChallenge): string
    {
        return $this->url('/oauth/authorize').'?'.http_build_query([
            'client_id' => $this->requiredConfig('client_id'),
            'redirect_uri' => $this->redirectUri(),
            'response_type' => 'code',
            'scope' => $this->scopes(),
            'state' => $state,
            'code_challenge' => $codeChallenge,
            'code_challenge_method' => 'S256',
        ], '', '&', PHP_QUERY_RFC3986);
    }

    public function exchangeCode(string $code, string $codeVerifier): string
    {
        try {
            $response = Http::asForm()
                ->acceptJson()
                ->timeout($this->timeout())
                ->post($this->url('/oauth/token'), [
                    'grant_type' => 'authorization_code',
                    'client_id' => $this->requiredConfig('client_id'),
                    'client_secret' => $this->requiredConfig('client_secret'),
                    'redirect_uri' => $this->redirectUri(),
                    'code' => $code,
                    'code_verifier' => $codeVerifier,
                ]);
        } catch (ConnectionException $exception) {
            throw new StepSsoException('STEP is temporarily unavailable. Please try again.', previous: $exception);
        }

        $accessToken = $response->json('access_token');

        if (! $response->successful() || ! is_string($accessToken) || $accessToken === '') {
            throw new StepSsoException('STEP could not complete sign-in. Please try again.');
        }

        return $accessToken;
    }

    public function identity(string $accessToken): StepIdentity
    {
        try {
            $response = Http::acceptJson()
                ->withToken($accessToken)
                ->timeout($this->timeout())
                ->get($this->url('/api/v1/sso/user'));
        } catch (ConnectionException $exception) {
            throw new StepSsoException('STEP is temporarily unavailable. Please try again.', previous: $exception);
        }

        if (! $response->successful()) {
            Log::warning('STEP SSO identity request failed.', [
                'status' => $response->status(),
                'content_type' => $response->header('Content-Type'),
            ]);

            throw new StepSsoException('STEP could not load your account. Please try again.');
        }

        $payload = $response->json('data', $response->json());

        if (! is_array($payload)) {
            throw new StepSsoException('STEP returned an invalid identity profile. Please contact your administrator.');
        }

        return StepIdentity::fromPayload($payload);
    }

    private function url(string $path): string
    {
        $baseUrl = rtrim($this->requiredConfig('base_url'), '/');

        if (! filter_var($baseUrl, FILTER_VALIDATE_URL) || ! in_array(parse_url($baseUrl, PHP_URL_SCHEME), ['http', 'https'], true)) {
            throw new StepSsoException('STEP SSO is not configured correctly.');
        }

        return $baseUrl.'/'.ltrim($path, '/');
    }

    private function redirectUri(): string
    {
        $configured = config('services.step_sso.redirect_uri');

        return is_string($configured) && $configured !== ''
            ? $configured
            : route('step-sso.callback');
    }

    private function scopes(): string
    {
        $scopes = config('services.step_sso.scopes', 'chat:identity');

        return is_string($scopes) && trim($scopes) !== '' ? trim($scopes) : 'chat:identity';
    }

    private function timeout(): int
    {
        return max(1, (int) config('services.step_sso.timeout', 10));
    }

    private function requiredConfig(string $key): string
    {
        $value = config("services.step_sso.{$key}");

        if (! is_string($value) || trim($value) === '') {
            throw new StepSsoException('STEP SSO is not configured correctly.');
        }

        return trim($value);
    }
}
