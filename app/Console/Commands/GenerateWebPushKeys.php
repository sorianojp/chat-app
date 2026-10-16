<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Minishlink\WebPush\VAPID;

class GenerateWebPushKeys extends Command
{
    protected $signature = 'webpush:generate-vapid {--force : Replace the existing local key pair}';

    protected $description = 'Generate a local VAPID key pair for browser push notifications';

    public function handle(): int
    {
        $path = storage_path('app/private/web-push-vapid.json');

        if (File::exists($path) && ! $this->option('force')) {
            $this->components->info('A local Web Push key pair already exists.');

            return self::SUCCESS;
        }

        $keys = VAPID::createVapidKeys();
        File::ensureDirectoryExists(dirname($path));
        File::put($path, json_encode($keys, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR).PHP_EOL);
        File::chmod($path, 0600);

        $this->components->info('Local Web Push VAPID keys generated.');
        $this->line('Public key: '.$keys['publicKey']);
        $this->newLine();
        $this->components->warn('For production, set WEB_PUSH_PUBLIC_KEY and WEB_PUSH_PRIVATE_KEY in the deployment environment.');

        return self::SUCCESS;
    }
}
