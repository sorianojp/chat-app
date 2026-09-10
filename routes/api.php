<?php

use App\Http\Controllers\Api\ConversationController;
use App\Http\Controllers\Api\MessageController;
use App\Http\Controllers\Api\MobileAuthController;
use App\Http\Controllers\Api\MobileSessionController;
use App\Http\Controllers\Api\PresenceController;
use App\Http\Controllers\Api\SchoolClassController;
use App\Http\Controllers\Api\StudentController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Route;

Route::post('mobile/auth/start', [MobileAuthController::class, 'start'])->middleware('throttle:10,1');
Route::post('mobile/auth/exchange', [MobileAuthController::class, 'exchange'])->middleware('throttle:10,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('mobile/session', [MobileSessionController::class, 'show']);
    Route::delete('mobile/session', [MobileAuthController::class, 'destroy']);
    Route::post('mobile/broadcasting/auth', fn (Request $request) => Broadcast::auth($request));
    Route::prefix('teams/{team:slug}')->group(function () {
        Route::get('contacts', [MobileSessionController::class, 'contacts']);
        Route::post('presence', [PresenceController::class, 'store']);

        Route::get('school-classes', [SchoolClassController::class, 'index']);
        Route::get('students', [StudentController::class, 'index']);

        Route::get('conversations', [ConversationController::class, 'index']);
        Route::post('conversations', [ConversationController::class, 'store']);
        Route::patch('conversations/{conversation}', [ConversationController::class, 'update']);
        Route::post('conversations/{conversation}/photo', [ConversationController::class, 'updatePhoto']);
        Route::delete('conversations/{conversation}/photo', [ConversationController::class, 'destroyPhoto']);
        Route::get('conversations/{conversation}/photo', [ConversationController::class, 'showPhoto']);
        Route::patch('conversations/{conversation}/members/{user}/nickname', [ConversationController::class, 'updateNickname']);
        Route::delete('conversations/{conversation}', [ConversationController::class, 'destroy']);
        Route::patch('conversations/{conversation}/pin', [ConversationController::class, 'pin']);
        Route::patch('conversations/{conversation}/archive', [ConversationController::class, 'archive']);
        Route::patch('conversations/{conversation}/mute', [ConversationController::class, 'mute']);
        Route::patch('conversations/{conversation}/notifications', [ConversationController::class, 'notifications']);
        Route::post('conversations/{conversation}/members', [ConversationController::class, 'addMembers']);
        Route::delete('conversations/{conversation}/members/me', [ConversationController::class, 'leave']);
        Route::delete('conversations/{conversation}/members/{user}', [ConversationController::class, 'removeMember']);
        Route::get('conversations/{conversation}/messages', [MessageController::class, 'index']);
        Route::get('conversations/{conversation}/shared', [MessageController::class, 'shared']);
        Route::get('conversations/{conversation}/messages/pinned', [MessageController::class, 'pinned']);
        Route::post('conversations/{conversation}/messages', [MessageController::class, 'store']);
        Route::post('conversations/{conversation}/polls', [MessageController::class, 'storePoll']);
        Route::patch('conversations/{conversation}/messages/{message}/poll-vote', [MessageController::class, 'votePoll']);
        Route::post('conversations/{conversation}/events', [MessageController::class, 'storeEvent']);
        Route::patch('conversations/{conversation}/messages/{message}/rsvp', [MessageController::class, 'rsvp']);
        Route::patch('conversations/{conversation}/messages/{message}', [MessageController::class, 'update']);
        Route::delete('conversations/{conversation}/messages/{message}', [MessageController::class, 'destroy']);
        Route::post('conversations/{conversation}/messages/{message}/forward', [MessageController::class, 'forward']);
        Route::patch('conversations/{conversation}/messages/{message}/pin', [MessageController::class, 'pin']);
        Route::patch('conversations/{conversation}/messages/{message}/delivered', [MessageController::class, 'markDelivered']);
        Route::patch('conversations/{conversation}/messages/{message}/reaction', [MessageController::class, 'react']);
        Route::delete('conversations/{conversation}/messages/{message}/reaction', [MessageController::class, 'unreact']);
        Route::get('conversations/{conversation}/messages/{message}/attachments/{attachment}', [MessageController::class, 'downloadAttachment']);
        Route::get('conversations/{conversation}/messages/{message}/attachments/{attachment}/preview', [MessageController::class, 'previewAttachment']);
        Route::patch('conversations/{conversation}/read', [MessageController::class, 'markRead']);
        Route::get('conversations/{conversation}', [ConversationController::class, 'show']);
    });
});
