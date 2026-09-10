<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('step_department_id')->nullable()->after('step_roles_synced_at');
            $table->string('step_department_code')->nullable()->after('step_department_id');
            $table->string('step_department_name')->nullable()->after('step_department_code');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['step_department_id', 'step_department_code', 'step_department_name']);
        });
    }
};
