<?php

namespace App\Services;

use App\Enums\SchoolRole;
use App\Enums\TeamRole;
use App\Exceptions\StepSsoException;
use Illuminate\Support\Str;

class StepRoleMapper
{
    /** @var array<string, SchoolRole> */
    private const ROLE_MAP = [
        'super admin' => SchoolRole::SuperAdmin,
        'admin' => SchoolRole::Admin,
        'support' => SchoolRole::Support,
        'dean' => SchoolRole::Dean,
        'acad' => SchoolRole::Academic,
        'academic' => SchoolRole::Academic,
        'guidance' => SchoolRole::Guidance,
        'operation' => SchoolRole::Operations,
        'operations' => SchoolRole::Operations,
        'teacher' => SchoolRole::Teacher,
        'student' => SchoolRole::Student,
        'parent' => SchoolRole::Parent,
    ];

    /**
     * Resolve a deterministic primary chat role from all current STEP roles.
     *
     * @param  array<int, string>  $roles
     */
    public function primaryRole(array $roles): SchoolRole
    {
        $mapped = collect($roles)
            ->map(fn (string $role): ?SchoolRole => self::ROLE_MAP[$this->normalize($role)] ?? null)
            ->filter()
            ->unique(fn (SchoolRole $role): string => $role->value);

        foreach (self::ROLE_MAP as $role) {
            if ($mapped->contains($role)) {
                return $role;
            }
        }

        throw new StepSsoException('Your STEP role is not enabled for Messenger. Please contact your administrator.');
    }

    public function teamRole(SchoolRole $role): TeamRole
    {
        return match ($role) {
            SchoolRole::SuperAdmin, SchoolRole::Admin => TeamRole::Admin,
            default => TeamRole::Member,
        };
    }

    private function normalize(string $role): string
    {
        return Str::of($role)
            ->trim()
            ->lower()
            ->replace(['_', '-'], ' ')
            ->squish()
            ->value();
    }
}
