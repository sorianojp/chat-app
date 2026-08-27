<?php

use App\Enums\SchoolRole;
use App\Enums\TeamRole;
use App\Exceptions\StepSsoException;
use App\Services\StepRoleMapper;

test('STEP roles map to matching chat roles', function (string $stepRole, SchoolRole $expected) {
    expect((new StepRoleMapper)->primaryRole([$stepRole]))->toBe($expected);
})->with([
    ['Super Admin', SchoolRole::SuperAdmin],
    ['Admin', SchoolRole::Admin],
    ['Support', SchoolRole::Support],
    ['Dean', SchoolRole::Dean],
    ['Acad', SchoolRole::Academic],
    ['Guidance', SchoolRole::Guidance],
    ['Operation', SchoolRole::Operations],
    ['Teacher', SchoolRole::Teacher],
    ['Student', SchoolRole::Student],
]);

test('higher priority STEP role wins deterministically', function () {
    expect((new StepRoleMapper)->primaryRole(['Student', 'Teacher', 'Admin']))
        ->toBe(SchoolRole::Admin);
});

test('only STEP administrators receive shared team administration', function () {
    $mapper = new StepRoleMapper;

    expect($mapper->teamRole(SchoolRole::SuperAdmin))->toBe(TeamRole::Admin)
        ->and($mapper->teamRole(SchoolRole::Admin))->toBe(TeamRole::Admin)
        ->and($mapper->teamRole(SchoolRole::Dean))->toBe(TeamRole::Member)
        ->and($mapper->teamRole(SchoolRole::Teacher))->toBe(TeamRole::Member)
        ->and($mapper->teamRole(SchoolRole::Student))->toBe(TeamRole::Member);
});

test('unknown-only STEP roles are rejected', function () {
    (new StepRoleMapper)->primaryRole(['Unknown']);
})->throws(StepSsoException::class);
