<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->string('photo_disk')->nullable()->after('title');
            $table->string('photo_path')->nullable()->after('photo_disk');
        });

        Schema::table('conversation_participants', function (Blueprint $table) {
            $table->string('nickname', 80)->nullable()->after('role');
        });

        Schema::create('message_poll_votes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->uuid('option_id');
            $table->timestamps();

            $table->unique(['message_id', 'user_id', 'option_id']);
            $table->index(['message_id', 'option_id']);
        });

        Schema::create('message_event_rsvps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('status', 20);
            $table->timestamps();

            $table->unique(['message_id', 'user_id']);
            $table->index(['message_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('message_event_rsvps');
        Schema::dropIfExists('message_poll_votes');

        Schema::table('conversation_participants', function (Blueprint $table) {
            $table->dropColumn('nickname');
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->dropColumn(['photo_disk', 'photo_path']);
        });
    }
};
