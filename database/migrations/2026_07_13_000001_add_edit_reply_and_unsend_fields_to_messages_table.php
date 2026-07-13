<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->foreignId('reply_to_message_id')->nullable()->after('sender_id')->constrained('messages')->nullOnDelete();
            $table->timestamp('edited_at')->nullable()->after('metadata');
            $table->timestamp('unsent_at')->nullable()->after('edited_at');

            $table->index(['conversation_id', 'unsent_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropIndex(['conversation_id', 'unsent_at']);
            $table->dropConstrainedForeignId('reply_to_message_id');
            $table->dropColumn(['edited_at', 'unsent_at']);
        });
    }
};
