<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A person on a STEP class roster, identified by their STEP user id.
 *
 * @property int $id
 * @property int $school_class_id
 * @property string $step_user_id
 * @property string $name
 * @property string $role
 * @property Carbon|null $added_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read SchoolClass $schoolClass
 */
#[Fillable(['school_class_id', 'step_user_id', 'name', 'role', 'added_at'])]
class SchoolClassMember extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['added_at' => 'datetime'];
    }

    /**
     * Get the class this roster entry belongs to.
     *
     * @return BelongsTo<SchoolClass, $this>
     */
    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class);
    }
}
