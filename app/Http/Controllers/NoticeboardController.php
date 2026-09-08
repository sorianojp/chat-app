<?php

namespace App\Http\Controllers;

use App\Models\Team;
use Inertia\Inertia;
use Inertia\Response;

class NoticeboardController extends Controller
{
    /**
     * Display the school noticeboard web app.
     */
    public function __invoke(Team $current_team): Response
    {
        return Inertia::render('notices', [
            'apiBaseUrl' => "/api/teams/{$current_team->slug}",
            'workspace' => [
                'id' => $current_team->id,
                'name' => $current_team->name,
                'slug' => $current_team->slug,
            ],
        ]);
    }
}
