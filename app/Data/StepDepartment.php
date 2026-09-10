<?php

namespace App\Data;

use Illuminate\Support\Facades\Validator;

final readonly class StepDepartment
{
    public function __construct(
        public string $id,
        public string $code,
        public string $name,
    ) {
        //
    }

    /**
     * STEP omits the department for accounts that belong to neither a college nor
     * a course, so anything that does not validate is treated as "no department"
     * rather than as a failed sign-in.
     *
     * @param  mixed  $payload
     */
    public static function fromPayload($payload): ?self
    {
        if (! is_array($payload)) {
            return null;
        }

        $validator = Validator::make($payload, [
            'id' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:100'],
            'name' => ['required', 'string', 'max:255'],
        ]);

        if ($validator->fails()) {
            return null;
        }

        /** @var array{id: string, code: string, name: string} $validated */
        $validated = $validator->validated();

        $id = trim($validated['id']);
        $code = trim($validated['code']);
        $name = trim($validated['name']);

        if ($id === '' || $name === '') {
            return null;
        }

        return new self(id: $id, code: $code, name: $name);
    }
}
