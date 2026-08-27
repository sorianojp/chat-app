<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Auth\ProvisionStepUser;
use App\Exceptions\StepSsoException;
use App\Http\Controllers\Controller;
use App\Models\TeamInvitation;
use App\Services\StepOAuthClient;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class StepSsoController extends Controller
{
    private const SESSION_STATE = 'step_sso.state';

    private const SESSION_VERIFIER = 'step_sso.code_verifier';

    private const SESSION_INVITATION = 'step_sso.invitation';

    public function login(Request $request): Response|RedirectResponse
    {
        if ($request->user()?->currentTeam) {
            return to_route('messenger', ['current_team' => $request->user()->currentTeam->slug]);
        }

        $invitation = $this->teamInvitation($request->query('invitation'));

        return Inertia::render('auth/login', [
            'status' => $request->session()->get('status'),
            'ssoError' => $request->session()->get('sso_error'),
            'stepSsoUrl' => route('step-sso.redirect', [
                'invitation' => $invitation['code'] ?? null,
            ]),
            'teamInvitation' => $invitation,
        ]);
    }

    public function redirect(Request $request, StepOAuthClient $client): RedirectResponse
    {
        $state = Str::random(64);
        $verifier = Str::random(96);
        $challenge = rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');
        $invitation = $this->teamInvitation($request->query('invitation'));

        $request->session()->put([
            self::SESSION_STATE => $state,
            self::SESSION_VERIFIER => $verifier,
            self::SESSION_INVITATION => $invitation['code'] ?? null,
        ]);

        try {
            return redirect()->away($client->authorizationUrl($state, $challenge));
        } catch (StepSsoException $exception) {
            $this->clearSsoSession($request);

            return $this->failed($exception->getMessage());
        }
    }

    public function callback(
        Request $request,
        StepOAuthClient $client,
        ProvisionStepUser $provisioner,
    ): RedirectResponse {
        $expectedState = $request->session()->pull(self::SESSION_STATE);
        $verifier = $request->session()->pull(self::SESSION_VERIFIER);
        $invitation = $request->session()->pull(self::SESSION_INVITATION);
        $state = $request->query('state');

        if (! is_string($expectedState) || ! is_string($state) || ! hash_equals($expectedState, $state)) {
            return $this->failed('The STEP sign-in request expired or was invalid. Please try again.');
        }

        if ($request->query('error') !== null) {
            return $this->failed(
                $request->query('error') === 'access_denied'
                    ? 'STEP sign-in was cancelled.'
                    : 'STEP could not complete sign-in. Please try again.',
            );
        }

        $code = $request->query('code');

        if (! is_string($code) || $code === '' || ! is_string($verifier) || $verifier === '') {
            return $this->failed('The STEP sign-in request expired or was invalid. Please try again.');
        }

        try {
            $accessToken = $client->exchangeCode($code, $verifier);
            $identity = $client->identity($accessToken);
            $user = $provisioner->handle($identity);
        } catch (StepSsoException $exception) {
            return $this->failed($exception->getMessage());
        }

        Auth::login($user);
        $request->session()->regenerate();

        if (is_string($invitation) && $this->teamInvitation($invitation, $user->email)) {
            return to_route('invitations.index')
                ->with('status', 'Signed in with STEP. Review your pending invitation below.');
        }

        return to_route('messenger', ['current_team' => $user->currentTeam->slug]);
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return to_route('home');
    }

    /**
     * @return array{code: string, teamName: string}|null
     */
    private function teamInvitation(mixed $code, ?string $email = null): ?array
    {
        if (! is_string($code) || $code === '') {
            return null;
        }

        $invitation = TeamInvitation::query()
            ->with('team')
            ->where('code', $code)
            ->whereNull('accepted_at')
            ->where(fn ($query) => $query
                ->whereNull('expires_at')
                ->orWhere('expires_at', '>=', now()))
            ->when($email, fn ($query) => $query->whereRaw('LOWER(email) = ?', [Str::lower($email)]))
            ->first();

        return $invitation ? [
            'code' => $invitation->code,
            'teamName' => $invitation->team->name,
        ] : null;
    }

    private function clearSsoSession(Request $request): void
    {
        $request->session()->forget([
            self::SESSION_STATE,
            self::SESSION_VERIFIER,
            self::SESSION_INVITATION,
        ]);
    }

    private function failed(string $message): RedirectResponse
    {
        return to_route('login')->with('sso_error', $message);
    }
}
