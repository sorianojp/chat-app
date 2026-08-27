<?php

namespace App\Enums;

enum SchoolRole: string
{
    case SuperAdmin = 'super_admin';
    case Admin = 'admin';
    case Support = 'support';
    case Dean = 'dean';
    case Academic = 'academic';
    case Guidance = 'guidance';
    case Operations = 'operations';
    case Teacher = 'teacher';
    case Student = 'student';
    case Parent = 'parent';
}
