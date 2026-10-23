<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('school_classes', function (Blueprint $table) {
            $table->string('step_room_id')->nullable()->after('team_id');
            $table->string('subject')->nullable()->after('name');
            $table->string('semester')->nullable()->after('school_year');
            // Created first: MySQL needs an index on team_id for its foreign key.
            $table->unique(['team_id', 'step_room_id']);
        });

        Schema::table('school_classes', function (Blueprint $table) {
            // STEP rooms share a section and school year across subjects, so
            // the old (team, grade, section, year) uniqueness no longer holds.
            $table->dropUnique(['team_id', 'grade_level', 'section', 'school_year']);
        });

        // The class roster as STEP reported it, keyed by STEP user id so that
        // students who have not signed in to Uhoo! yet can join later.
        Schema::create('school_class_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_class_id')->constrained()->cascadeOnDelete();
            $table->string('step_user_id');
            $table->string('name');
            $table->string('role', 20);
            // When Uhoo! put this person in the class chat. Set once, so
            // someone who leaves the chat is not re-added on their next sign-in.
            $table->timestamp('added_at')->nullable();
            $table->timestamps();

            $table->unique(['school_class_id', 'step_user_id']);
            $table->index('step_user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('school_class_members');

        Schema::table('school_classes', function (Blueprint $table) {
            $table->unique(['team_id', 'grade_level', 'section', 'school_year']);
        });

        Schema::table('school_classes', function (Blueprint $table) {
            $table->dropUnique(['team_id', 'step_room_id']);
            $table->dropColumn(['step_room_id', 'subject', 'semester']);
        });
    }
};
