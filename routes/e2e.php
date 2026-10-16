<?php

/*
|--------------------------------------------------------------------------
| End-to-end test routes
|--------------------------------------------------------------------------
|
| Only registered when APP_ENV=e2e (see bootstrap/app.php). They let the
| Playwright suite sign in without STEP SSO and set up fresh data per test.
|
*/

use App\Enums\ConversationType;
use App\Enums\TeamRole;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

Route::prefix('_e2e')->group(function () {
    Route::post('scenario', function () {
        $alice = User::factory()->create(['name' => 'Alice Teacher']);
        $bob = User::factory()->create(['name' => 'Bob Parent']);
        $team = Team::factory()->create();
        $team->members()->attach($alice, ['role' => TeamRole::Owner->value]);
        $team->members()->attach($bob, ['role' => TeamRole::Member->value]);
        $alice->forceFill(['current_team_id' => $team->id])->save();
        $bob->forceFill(['current_team_id' => $team->id])->save();

        $conversation = $team->conversations()->create([
            'created_by' => $alice->id,
            'type' => ConversationType::Direct,
        ]);
        $conversation->participants()->attach($alice, ['role' => 'owner']);
        $conversation->participants()->attach($bob, ['role' => 'member']);

        return response()->json([
            'alice' => ['id' => $alice->id, 'name' => $alice->name],
            'bob' => ['id' => $bob->id, 'name' => $bob->name],
            'team' => ['slug' => $team->slug],
            'conversation' => ['id' => $conversation->id],
            'url' => route('messenger', ['current_team' => $team->slug, 'conversation' => $conversation->id], false),
        ]);
    });

    Route::middleware('web')->get('login/{user}', function (Request $request, User $user) {
        Auth::login($user);
        $request->session()->regenerate();

        return redirect($request->query('redirect', '/'));
    });
});
