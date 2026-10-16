import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';
import type { User } from '@/types';

export function UserInfo({
    user,
    showEmail = false,
    tone = 'default',
}: {
    user: User;
    showEmail?: boolean;
    tone?: 'default' | 'sidebar';
}) {
    const getInitials = useInitials();
    const showAvatar = Boolean(user.avatar && user.avatar !== '');

    return (
        <>
            <Avatar className="h-9 w-9 overflow-hidden rounded-full ring-2 ring-gold/70">
                {showAvatar ? (
                    <AvatarImage src={user.avatar} alt={user.name} />
                ) : null}
                <AvatarFallback
                    className={
                        tone === 'sidebar'
                            ? 'rounded-full bg-sidebar-accent text-sidebar-foreground'
                            : 'rounded-full bg-muted text-foreground'
                    }
                >
                    {getInitials(user.name)}
                </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                {showEmail ? (
                    <span
                        className={`truncate text-xs ${
                            tone === 'sidebar'
                                ? 'text-sidebar-foreground/65'
                                : 'text-muted-foreground'
                        }`}
                    >
                        {user.email}
                    </span>
                ) : null}
                {user.department ? (
                    <span
                        className={`truncate text-xs ${
                            tone === 'sidebar'
                                ? 'text-sidebar-foreground/65'
                                : 'text-muted-foreground'
                        }`}
                    >
                        {user.department.code || user.department.name}
                    </span>
                ) : null}
            </div>
        </>
    );
}
