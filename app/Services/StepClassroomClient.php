<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class StepClassroomClient
{
    /**
     * @return array{school_year: string, semester: string, rooms: array<int, array<string, mixed>>}
     */
    public function currentClassrooms(): array
    {
        $baseUrl = rtrim((string) config('services.step_sso.base_url'), '/');
        $token = trim((string) config('services.step_sso.integration_token'));

        if ($baseUrl === '' || $token === '') {
            throw new RuntimeException('STEP classroom synchronization is not configured.');
        }

        try {
            $response = Http::acceptJson()
                ->withToken($token)
                ->timeout((int) config('services.step_sso.timeout', 10))
                ->retry(2, 250)
                ->get("{$baseUrl}/api/v1/integrations/uhoo/classrooms");
        } catch (ConnectionException $exception) {
            throw new RuntimeException('STEP classroom synchronization is unavailable.', previous: $exception);
        }

        if (! $response->successful()) {
            throw new RuntimeException("STEP classroom synchronization failed with status {$response->status()}.");
        }

        $data = $response->json('data');

        if (! is_array($data)
            || ! is_string($data['school_year'] ?? null)
            || ! is_string($data['semester'] ?? null)
            || ! is_array($data['rooms'] ?? null)) {
            throw new RuntimeException('STEP returned an invalid classroom synchronization payload.');
        }

        return [
            'school_year' => $data['school_year'],
            'semester' => $data['semester'],
            'rooms' => array_values($data['rooms']),
        ];
    }
}
