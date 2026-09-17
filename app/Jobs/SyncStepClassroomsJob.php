<?php

namespace App\Jobs;

use App\Services\SyncStepClassrooms;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SyncStepClassroomsJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    public int $uniqueFor = 60;

    /** @var array<int, int> */
    public array $backoff = [15, 60, 300, 900];

    public function handle(SyncStepClassrooms $sync): void
    {
        $sync->handle();
    }
}
