<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('school_classes', function (Blueprint $table) {
            // MySQL may use the composite unique index below to support the
            // team_id foreign key. Give the foreign key its own index before
            // removing that uniqueness constraint.
            $table->index('team_id');
        });

        Schema::table('school_classes', function (Blueprint $table) {
            $table->dropUnique(['team_id', 'grade_level', 'section', 'school_year']);
        });

        Schema::table('school_classes', function (Blueprint $table) {
            $table->string('step_room_id')->nullable()->unique()->after('id');
            $table->string('semester')->nullable()->after('school_year');
            $table->string('sync_status')->default('active')->after('semester');
            $table->timestamp('last_synced_at')->nullable()->after('sync_status');
            $table->timestamp('ended_at')->nullable()->after('last_synced_at');
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->boolean('managed_by_step')->default(false)->after('school_class_id');
            $table->string('sync_status')->default('active')->after('managed_by_step');
            $table->timestamp('locked_at')->nullable()->after('sync_status');
            $table->timestamp('archived_at')->nullable()->after('locked_at');
        });
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->dropColumn(['managed_by_step', 'sync_status', 'locked_at', 'archived_at']);
        });

        Schema::table('school_classes', function (Blueprint $table) {
            $table->dropUnique(['step_room_id']);
            $table->dropColumn(['step_room_id', 'semester', 'sync_status', 'last_synced_at', 'ended_at']);
            $table->unique(['team_id', 'grade_level', 'section', 'school_year']);
        });

        Schema::table('school_classes', function (Blueprint $table) {
            $table->dropIndex(['team_id']);
        });
    }
};
