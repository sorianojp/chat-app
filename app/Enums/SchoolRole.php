<?php

namespace App\Enums;

enum SchoolRole: string
{
    case SuperAdmin = 'super_admin';
    case Admin = 'admin';
    case Teacher = 'teacher';
    case Parent = 'parent';
}
