<?php

namespace App\Enums;

enum NoticeCategory: string
{
    case Announcement = 'announcement';
    case Reminder = 'reminder';
    case Event = 'event';
    case Billing = 'billing';
}
