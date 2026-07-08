<?php

namespace App\Enums;

enum SchoolRole: string
{
    case Admin = 'admin';
    case Teacher = 'teacher';
    case Parent = 'parent';
}
