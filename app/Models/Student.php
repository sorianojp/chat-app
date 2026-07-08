<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $team_id
 * @property string|null $student_number
 * @property string $first_name
 * @property string|null $middle_name
 * @property string $last_name
 * @property string $grade_level
 * @property string $section
 * @property string $status
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read string $full_name
 * @property-read Collection<int, SchoolClass> $classes
 * @property-read Collection<int, User> $guardians
 * @property-read Team $team
 */
#[Fillable(['team_id', 'student_number', 'first_name', 'middle_name', 'last_name', 'grade_level', 'section', 'status'])]
class Student extends Model
{
    /**
     * Get the student full name.
     */
    public function getFullNameAttribute(): string
    {
        return trim("{$this->first_name} {$this->middle_name} {$this->last_name}");
    }

    /**
     * Get the school/team that owns the student.
     *
     * @return BelongsTo<Team, $this>
     */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /**
     * Get the student's classes.
     *
     * @return BelongsToMany<SchoolClass, $this>
     */
    public function classes(): BelongsToMany
    {
        return $this->belongsToMany(SchoolClass::class)->withTimestamps();
    }

    /**
     * Get parent / guardian accounts linked to the student.
     *
     * @return BelongsToMany<User, $this>
     */
    public function guardians(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'student_guardians')
            ->withPivot(['relationship', 'is_primary'])
            ->withTimestamps();
    }
}
