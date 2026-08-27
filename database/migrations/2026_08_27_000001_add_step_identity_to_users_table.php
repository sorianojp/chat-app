<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('teams', function (Blueprint $table) {
            $table->string('external_source')->nullable()->unique()->after('slug');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('step_user_id')->nullable()->unique()->after('id');
            $table->json('step_roles')->nullable()->after('school_role');
            $table->timestamp('step_roles_synced_at')->nullable()->after('step_roles');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['step_user_id']);
            $table->dropColumn(['step_user_id', 'step_roles', 'step_roles_synced_at']);
        });

        Schema::table('teams', function (Blueprint $table) {
            $table->dropUnique(['external_source']);
            $table->dropColumn('external_source');
        });
    }
};
