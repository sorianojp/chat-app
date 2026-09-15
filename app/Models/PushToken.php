<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * @property int $id
 * @property int $user_id
 * @property int $personal_access_token_id
 * @property string $token_hash
 * @property string $token
 * @property string $platform
 * @property string|null $device_name
 * @property Carbon $last_seen_at
 * @property-read User $user
 * @property-read PersonalAccessToken $accessToken
 */
#[Fillable(['user_id', 'personal_access_token_id', 'token_hash', 'token', 'platform', 'device_name', 'last_seen_at'])]
class PushToken extends Model
{
    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<PersonalAccessToken, $this> */
    public function accessToken(): BelongsTo
    {
        return $this->belongsTo(PersonalAccessToken::class, 'personal_access_token_id');
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'token' => 'encrypted',
            'last_seen_at' => 'datetime',
        ];
    }
}
