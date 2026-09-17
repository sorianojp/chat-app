<?php

use App\Jobs\SyncStepClassroomsJob;
use App\Models\TeamInvitation;
use App\Services\SyncStepClassrooms;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('step:sync-classrooms', function (SyncStepClassrooms $sync) {
    $result = $sync->handle();
    $this->info(sprintf(
        'STEP classrooms synchronized: %d created, %d updated, %d archived.',
        $result['created'],
        $result['updated'],
        $result['archived'],
    ));
})->purpose('Synchronize current-term STEP classrooms and Uhoo group chats');

Schedule::job(new SyncStepClassroomsJob)
    ->everyFifteenMinutes()
    ->withoutOverlapping()
    ->when(fn (): bool => filled(config('services.step_sso.base_url'))
        && filled(config('services.step_sso.integration_token')))
    ->description('Synchronize current STEP classroom chats');

Schedule::call(function () {
    TeamInvitation::query()
        ->whereNotNull('expires_at')
        ->where('expires_at', '<', now())
        ->delete();
})->daily()->description('Delete expired team invitations');
