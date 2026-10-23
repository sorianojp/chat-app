<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $team_id
 * @property string|null $step_room_id
 * @property int|null $adviser_id
 * @property string $name
 * @property string|null $subject
 * @property string $grade_level
 * @property string $section
 * @property string $school_year
 * @property string|null $semester
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User|null $adviser
 * @property-read Collection<int, Conversation> $conversations
 * @property-read Collection<int, SchoolClassMember> $members
 * @property-read Collection<int, Student> $students
 * @property-read Team $team
 */
#[Fillable(['team_id', 'step_room_id', 'adviser_id', 'name', 'subject', 'grade_level', 'section', 'school_year', 'semester'])]
class SchoolClass extends Model
{
    /**
     * Get the school/team that owns the class.
     *
     * @return BelongsTo<Team, $this>
     */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /**
     * Get the class adviser.
     *
     * @return BelongsTo<User, $this>
     */
    public function adviser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'adviser_id');
    }

    /**
     * Get the STEP roster for the class.
     *
     * @return HasMany<SchoolClassMember, $this>
     */
    public function members(): HasMany
    {
        return $this->hasMany(SchoolClassMember::class);
    }

    /**
     * Get the students enrolled in the class.
     *
     * @return BelongsToMany<Student, $this>
     */
    public function students(): BelongsToMany
    {
        return $this->belongsToMany(Student::class)->withTimestamps();
    }

    /**
     * Get conversations scoped to this class.
     *
     * @return HasMany<Conversation, $this>
     */
    public function conversations(): HasMany
    {
        return $this->hasMany(Conversation::class);
    }
}
