<?php

namespace App\Data;

use App\Exceptions\StepSsoException;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final readonly class StepIdentity
{
    /**
     * @param  array<int, string>  $roles
     */
    public function __construct(
        public string $id,
        public string $name,
        public string $email,
        public bool $emailVerified,
        public array $roles,
    ) {
        //
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public static function fromPayload(array $payload): self
    {
        try {
            $validated = Validator::make($payload, [
                'sub' => ['required', 'string', 'max:255'],
                'name' => ['required', 'string', 'max:255'],
                'email' => ['required', 'string', 'email', 'max:255'],
                'email_verified' => ['required', 'boolean'],
                'roles' => ['required', 'array', 'min:1'],
                'roles.*' => ['required', 'string', 'distinct', 'max:100'],
            ])->validate();
        } catch (ValidationException $exception) {
            throw new StepSsoException(
                'STEP returned an invalid identity profile. Please contact your administrator.',
                previous: $exception,
            );
        }

        $id = $validated['sub'] ?? null;
        $name = $validated['name'] ?? null;
        $email = $validated['email'] ?? null;
        $emailVerified = $validated['email_verified'] ?? null;
        $rawRoles = $validated['roles'] ?? null;

        if (! is_string($id)
            || ! is_string($name)
            || ! is_string($email)
            || ! is_bool($emailVerified)
            || ! is_array($rawRoles)) {
            throw new StepSsoException('STEP returned an invalid identity profile. Please contact your administrator.');
        }

        $rolesByKey = [];

        foreach ($rawRoles as $role) {
            if (! is_string($role)) {
                throw new StepSsoException('STEP returned an invalid identity profile. Please contact your administrator.');
            }

            $role = trim($role);

            if ($role !== '') {
                $rolesByKey[Str::lower($role)] = $role;
            }
        }

        $roles = array_values($rolesByKey);
        usort($roles, strcasecmp(...));

        if ($roles === []) {
            throw new StepSsoException('Your STEP account does not have a role that can access Messenger.');
        }

        return new self(
            id: $id,
            name: trim($name),
            email: Str::lower(trim($email)),
            emailVerified: $emailVerified,
            roles: $roles,
        );
    }
}
