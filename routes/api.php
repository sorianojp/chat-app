<?php

use App\Http\Controllers\Api\ConversationController;
use App\Http\Controllers\Api\MessageController;
use App\Http\Controllers\Api\NoticeController;
use App\Http\Controllers\Api\SchoolClassController;
use App\Http\Controllers\Api\StudentController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::prefix('teams/{team:slug}')->group(function () {
        Route::get('school-classes', [SchoolClassController::class, 'index']);
        Route::get('students', [StudentController::class, 'index']);

        Route::get('conversations', [ConversationController::class, 'index']);
        Route::post('conversations', [ConversationController::class, 'store']);
        Route::patch('conversations/{conversation}', [ConversationController::class, 'update']);
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
        Route::patch('conversations/{conversation}/messages/{message}', [MessageController::class, 'update']);
        Route::delete('conversations/{conversation}/messages/{message}', [MessageController::class, 'destroy']);
        Route::post('conversations/{conversation}/messages/{message}/forward', [MessageController::class, 'forward']);
        Route::patch('conversations/{conversation}/messages/{message}/pin', [MessageController::class, 'pin']);
        Route::patch('conversations/{conversation}/messages/{message}/reaction', [MessageController::class, 'react']);
        Route::delete('conversations/{conversation}/messages/{message}/reaction', [MessageController::class, 'unreact']);
        Route::get('conversations/{conversation}/messages/{message}/attachments/{attachment}', [MessageController::class, 'downloadAttachment']);
        Route::patch('conversations/{conversation}/read', [MessageController::class, 'markRead']);
        Route::get('conversations/{conversation}', [ConversationController::class, 'show']);

        Route::get('notices', [NoticeController::class, 'index']);
        Route::post('notices', [NoticeController::class, 'store']);
        Route::get('notices/{notice}', [NoticeController::class, 'show']);
    });
});
