<?php

use App\Http\Controllers\Api\MessageController as ApiMessageController;
use App\Http\Controllers\MessengerController;
use App\Http\Controllers\Teams\TeamInvitationController;
use App\Http\Middleware\EnsureTeamMembership;
use App\Models\Team;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::prefix('{current_team}')
    ->middleware(['auth', 'verified', EnsureTeamMembership::class])
    ->group(function () {
        Route::get('dashboard', fn (Team $current_team) => to_route('messenger', ['current_team' => $current_team->slug]))->name('dashboard');
        Route::get('messenger', MessengerController::class)->name('messenger');
    });

Route::prefix('teams/{team:slug}')
    ->middleware(['auth', 'verified', EnsureTeamMembership::class])
    ->group(function () {
        Route::get('conversations/{conversation}/messages/{message}/attachments/{attachment}', [ApiMessageController::class, 'downloadAttachment'])
            ->name('messenger.attachments.download');
        Route::get('conversations/{conversation}/messages/{message}/attachments/{attachment}/preview', [ApiMessageController::class, 'previewAttachment'])
            ->name('messenger.attachments.preview');
    });

Route::middleware(['auth'])->group(function () {
    Route::get('invitations', [TeamInvitationController::class, 'index'])->name('invitations.index');
    Route::get('invitations/{invitation}/accept', [TeamInvitationController::class, 'accept'])->name('invitations.accept');
    Route::delete('invitations/{invitation}', [TeamInvitationController::class, 'decline'])->name('invitations.decline');
});

require __DIR__.'/settings.php';
