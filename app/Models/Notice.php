<?php

namespace App\Models;

use App\Enums\NoticeCategory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $team_id
 * @property int|null $school_class_id
 * @property int|null $author_id
 * @property NoticeCategory $category
 * @property string $title
 * @property string $body
 * @property Carbon|null $published_at
 * @property Carbon|null $expires_at
 * @property array<string, mixed>|null $metadata
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 * @property-read User|null $author
 * @property-read SchoolClass|null $schoolClass
 * @property-read Team $team
 */
#[Fillable(['team_id', 'school_class_id', 'author_id', 'category', 'title', 'body', 'published_at', 'expires_at', 'metadata'])]
class Notice extends Model
{
    use SoftDeletes;

    /**
     * Get the school/team that owns the notice.
     *
     * @return BelongsTo<Team, $this>
     */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /**
     * Get the class this notice belongs to.
     *
     * @return BelongsTo<SchoolClass, $this>
     */
    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class);
    }

    /**
     * Get the notice author.
     *
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'category' => NoticeCategory::class,
            'published_at' => 'datetime',
            'expires_at' => 'datetime',
            'metadata' => 'array',
        ];
    }
}
