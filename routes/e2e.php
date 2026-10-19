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
    Route::post('scenario', function (Request $request) {
        $isGroup = $request->input('type') === 'group';
        $alice = User::factory()->create(['name' => 'Alice Teacher']);
        $bob = User::factory()->create(['name' => 'Bob Parent']);
        $members = [$alice, $bob];

        if ($isGroup) {
            $members[] = User::factory()->create(['name' => 'Carol Parent']);
        }

        $team = Team::factory()->create();

        foreach ($members as $member) {
            $team->members()->attach($member, [
                'role' => $member->is($alice) ? TeamRole::Owner->value : TeamRole::Member->value,
            ]);
            $member->forceFill(['current_team_id' => $team->id])->save();
        }

        $conversation = $team->conversations()->create([
            'created_by' => $alice->id,
            'type' => $isGroup ? ConversationType::Group : ConversationType::Direct,
            'title' => $isGroup ? 'Planning' : null,
        ]);

        foreach ($members as $member) {
            $conversation->participants()->attach($member, ['role' => $member->is($alice) ? 'owner' : 'member']);
        }

        // Note: range(1, 0) would count down, so loop explicitly.
        for ($number = 1; $number <= min($request->integer('messages'), 500); $number++) {
            $conversation->messages()->create([
                'sender_id' => $bob->id,
                'type' => 'text',
                'body' => "History message {$number}",
            ]);
        }

        if ($request->integer('messages') > 0) {
            // Seeded history counts as read, so the chat opens at the bottom
            // (opening at an unread divider near the top would auto-load older pages).
            $conversation->participants()->updateExistingPivot($alice->id, ['last_read_at' => now()]);
        }

        if ($request->boolean('pin_oldest')) {
            $conversation->messages()->oldest('id')->first()?->forceFill([
                'pinned_at' => now(),
                'pinned_by' => $alice->id,
            ])->save();
        }

        if ($request->boolean('second_chat')) {
            $dana = User::factory()->create(['name' => 'Dana Parent']);
            $team->members()->attach($dana, ['role' => TeamRole::Member->value]);
            $secondChat = $team->conversations()->create([
                'created_by' => $alice->id,
                'type' => ConversationType::Direct,
            ]);
            $secondChat->participants()->attach($alice, ['role' => 'owner']);
            $secondChat->participants()->attach($dana, ['role' => 'member']);
        }

        return response()->json([
            'alice' => ['id' => $alice->id, 'name' => $alice->name],
            'bob' => ['id' => $bob->id, 'name' => $bob->name],
            'team' => ['slug' => $team->slug],
            'conversation' => ['id' => $conversation->id],
            'dana' => isset($dana) ? ['id' => $dana->id, 'name' => $dana->name] : null,
            'second_conversation' => isset($secondChat) ? ['id' => $secondChat->id] : null,
            'url' => route('messenger', ['current_team' => $team->slug, 'conversation' => $conversation->id], false),
        ]);
    });

    Route::middleware('web')->get('login/{user}', function (Request $request, User $user) {
        Auth::login($user);
        $request->session()->regenerate();

        return redirect($request->query('redirect', '/'));
    });
});
