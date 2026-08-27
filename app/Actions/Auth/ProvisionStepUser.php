<?php

namespace App\Actions\Auth;

use App\Data\StepIdentity;
use App\Exceptions\StepSsoException;
use App\Models\Team;
use App\Models\User;
use App\Services\StepRoleMapper;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProvisionStepUser
{
    private const STEP_TEAM_SOURCE = 'step-v2';

    public function __construct(private StepRoleMapper $roleMapper)
    {
        //
    }

    public function handle(StepIdentity $identity): User
    {
        $schoolRole = $this->roleMapper->primaryRole($identity->roles);

        return DB::transaction(function () use ($identity, $schoolRole): User {
            $user = User::query()
                ->where('step_user_id', $identity->id)
                ->lockForUpdate()
                ->first();
            $alreadyLinked = $user !== null;

            $emailOwner = User::query()
                ->whereRaw('LOWER(email) = ?', [$identity->email])
                ->lockForUpdate()
                ->first();

            if ($user && $emailOwner && ! $emailOwner->is($user)) {
                throw new StepSsoException('This STEP email is already linked to a different Messenger account.');
            }

            if (! $user && $emailOwner) {
                if ($emailOwner->step_user_id !== null && $emailOwner->step_user_id !== $identity->id) {
                    throw new StepSsoException('This STEP email is already linked to a different Messenger account.');
                }

                $user = $emailOwner;
            }

            $user ??= new User;

            if (! $user->exists) {
                $user->password = Str::random(64);
            }

            $user->forceFill([
                'step_user_id' => $identity->id,
                'name' => $identity->name,
                'email' => $identity->email,
                'email_verified_at' => $identity->emailVerified
                    ? ($user->email_verified_at ?? now())
                    : null,
                'step_roles' => $identity->roles,
                'step_roles_synced_at' => now(),
                'school_role' => $schoolRole,
            ])->save();

            $team = $this->stepTeam();
            $hadStepMembership = $user->belongsToTeam($team);
            $team->memberships()->updateOrCreate(
                ['user_id' => $user->id],
                ['role' => $this->roleMapper->teamRole($schoolRole)],
            );

            if (! $alreadyLinked
                || ! $hadStepMembership
                || ! $user->currentTeam
                || ! $user->belongsToTeam($user->currentTeam)) {
                $user->switchTeam($team);
            }

            return $user->refresh()->load('currentTeam');
        });
    }

    private function stepTeam(): Team
    {
        $name = trim((string) config('services.step_sso.team_name', 'STEP Messenger'));
        $slug = Str::slug((string) config('services.step_sso.team_slug', 'step-messenger'));

        if ($name === '' || $slug === '') {
            throw new StepSsoException('STEP Messenger workspace is not configured correctly.');
        }

        $team = Team::withTrashed()
            ->where('external_source', self::STEP_TEAM_SOURCE)
            ->first();

        if (! $team) {
            $team = Team::withTrashed()->where('slug', $slug)->first();

            if ($team?->external_source !== null) {
                throw new StepSsoException('STEP Messenger workspace conflicts with an existing team.');
            }
        }

        if (! $team) {
            return Team::create([
                'name' => $name,
                'slug' => $slug,
                'external_source' => self::STEP_TEAM_SOURCE,
                'is_personal' => false,
            ]);
        }

        if ($team->trashed()) {
            $team->restore();
        }

        $team->update([
            'external_source' => self::STEP_TEAM_SOURCE,
            'is_personal' => false,
        ]);

        return $team;
    }
}
