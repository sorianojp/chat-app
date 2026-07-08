import { Head } from '@inertiajs/react';
import {
    ArrowLeft,
    Bell,
    CalendarDays,
    Check,
    CheckCheck,
    ChevronRight,
    CircleUserRound,
    Edit3,
    GraduationCap,
    Headphones,
    Info,
    Megaphone,
    Menu,
    MessageCircle,
    Mic,
    MoreVertical,
    Paperclip,
    Phone,
    Plus,
    Search,
    Send,
    Settings,
    Smile,
    UserRound,
    UsersRound,
} from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';

type View = 'chats' | 'contacts' | 'groups' | 'notices' | 'more';
type ThreadKind = 'parent' | 'group';

type Thread = {
    id: string;
    kind: ThreadKind;
    name: string;
    subtitle: string;
    time: string;
    unread?: number;
    color: string;
    initials: string;
    online?: boolean;
};

type Message = {
    author?: string;
    body: string;
    mine?: boolean;
    time: string;
    status?: 'sent' | 'read';
    reaction?: string;
};

type Notice = {
    title: string;
    body: string;
    time: string;
    icon: ReactNode;
    unread?: boolean;
};

const filters = ['All', 'Unread', 'Groups', 'Parents'];

const threads: Thread[] = [
    {
        id: 'maria',
        kind: 'parent',
        name: 'Parent: Maria Santos',
        subtitle: "Good morning Ma'am, I would like...",
        time: '8:20 AM',
        unread: 2,
        color: 'bg-rose-500',
        initials: 'MS',
        online: true,
    },
    {
        id: 'grade10',
        kind: 'group',
        name: 'Grade 10 - Section A',
        subtitle: "Mrs. Cruz: Don't forget our PT...",
        time: '6:48 AM',
        unread: 5,
        color: 'bg-sky-600',
        initials: '10',
    },
    {
        id: 'john',
        kind: 'parent',
        name: 'Parent: John Dela Cruz',
        subtitle: 'Thank you very much!',
        time: 'Yesterday',
        color: 'bg-emerald-600',
        initials: 'JD',
    },
    {
        id: 'grade11',
        kind: 'group',
        name: 'Grade 11 - Parents Group',
        subtitle: "Mr. Reyes: Here's the schedule...",
        time: 'Yesterday',
        unread: 3,
        color: 'bg-violet-600',
        initials: '11',
    },
    {
        id: 'liza',
        kind: 'parent',
        name: 'Parent: Liza Gomez',
        subtitle: 'Noted po. Salamat!',
        time: 'Monday',
        color: 'bg-amber-500',
        initials: 'LG',
    },
    {
        id: 'grade12',
        kind: 'group',
        name: 'Grade 12 - Section B',
        subtitle: 'Mrs. Cruz: Reminder: Career...',
        time: 'Monday',
        color: 'bg-cyan-600',
        initials: '12',
    },
];

const parentMessages: Message[] = [
    {
        body: "Good morning Ma'am, I would like to ask about my child's requirement for the upcoming activity.",
        time: '8:20 AM',
    },
    {
        body: "Good morning po! Sure, I'd be happy to help. Which activity are you referring to?",
        mine: true,
        time: '9:11 AM',
        status: 'read',
    },
    {
        body: 'The research presentation next week.',
        time: '9:22 AM',
    },
    {
        body: "For the research presentation, they need to submit the outline by this Friday. I'll send the details here.",
        mine: true,
        time: '9:31 AM',
        status: 'read',
    },
    {
        body: 'Thank you very much!',
        time: '9:45 AM',
        reaction: '1',
    },
];

const groupMessages: Message[] = [
    {
        author: 'Mrs. Cruz',
        body: 'Good morning parents! This is a reminder that our PT Meeting is on May 25, 2025 at 2:00 PM. See you po!',
        time: '8:45 AM',
        reaction: '8',
    },
    {
        author: 'Mr. Dela Pena',
        body: "Thank you for the reminder, Ma'am.",
        time: '8:46 AM',
        reaction: '2',
    },
    {
        author: 'Parent: Ana Reyes',
        body: 'Noted po. Thank you!',
        time: '8:47 AM',
        reaction: '1',
    },
    {
        body: 'See you po on Sunday!',
        mine: true,
        time: '8:48 AM',
        status: 'read',
    },
];

const groups = [
    {
        name: 'Grade 10 - Section A',
        members: '25 members',
        color: 'bg-violet-600',
        muted: false,
    },
    {
        name: 'Grade 11 - Parents Group',
        members: '32 members',
        color: 'bg-emerald-600',
        muted: true,
    },
    {
        name: 'Grade 12 - Section B',
        members: '28 members',
        color: 'bg-fuchsia-600',
        muted: false,
    },
    {
        name: 'SHS - STEM Parents',
        members: '30 members',
        color: 'bg-amber-500',
        muted: false,
    },
    {
        name: 'School Announcements',
        members: 'All parents',
        color: 'bg-sky-600',
        muted: true,
    },
];

const notices: Notice[] = [
    {
        title: 'School Announcement',
        body: 'Intramurals 2025 schedule',
        time: '9:00 AM',
        icon: <Megaphone className="size-5" />,
        unread: true,
    },
    {
        title: 'Tuition Reminder',
        body: '2nd Quarter payment is due',
        time: 'Wednesday',
        icon: <CalendarDays className="size-5" />,
    },
    {
        title: 'Event',
        body: 'Career Guidance Webinar',
        time: 'May 20',
        icon: <CalendarDays className="size-5" />,
        unread: true,
    },
    {
        title: 'Class Reminder',
        body: 'Bring your project materials',
        time: 'May 19',
        icon: <Bell className="size-5" />,
    },
];

const parents = [
    ['Maria Santos', 'MS', 'bg-rose-500', true],
    ['John Dela Cruz', 'JD', 'bg-emerald-600', true],
    ['Liza Gomez', 'LG', 'bg-amber-500', false],
    ['Ana Reyes', 'AR', 'bg-fuchsia-600', true],
] as const;

export default function Welcome() {
    const [view, setView] = useState<View>('chats');
    const [activeThreadId, setActiveThreadId] = useState('maria');
    const [composerOpen, setComposerOpen] = useState(false);
    const [groupWizardOpen, setGroupWizardOpen] = useState(false);
    const [selectedParents, setSelectedParents] = useState([
        'Maria Santos',
        'John Dela Cruz',
        'Ana Reyes',
    ]);

    const activeThread = useMemo(
        () =>
            threads.find((thread) => thread.id === activeThreadId) ??
            threads[0],
        [activeThreadId],
    );

    const openThread = (id: string) => {
        setActiveThreadId(id);
        setView('chats');
        setComposerOpen(false);
        setGroupWizardOpen(false);
    };

    const openGroups = () => {
        setView('groups');
        setComposerOpen(false);
        setGroupWizardOpen(false);
    };

    const openComposer = () => {
        setComposerOpen(true);
        setGroupWizardOpen(false);
    };

    const openGroupWizard = () => {
        setGroupWizardOpen(true);
        setComposerOpen(false);
    };

    return (
        <>
            <Head title="ISuDD Messenger" />
            <main className="min-h-screen bg-[#eef4fb] text-slate-950">
                <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:px-8">
                    <BrandPanel />
                    <section className="grid flex-1 gap-5 lg:grid-cols-[minmax(310px,360px)_1fr]">
                        <PhoneShell>
                            {composerOpen ? (
                                <NewMessageScreen
                                    onBack={() => setComposerOpen(false)}
                                    onNewGroup={openGroupWizard}
                                />
                            ) : groupWizardOpen ? (
                                <NewGroupScreen
                                    selectedParents={selectedParents}
                                    setSelectedParents={setSelectedParents}
                                    onBack={() => setGroupWizardOpen(false)}
                                />
                            ) : (
                                <AppScreen
                                    activeThread={activeThread}
                                    onComposer={openComposer}
                                    onGroupWizard={openGroupWizard}
                                    onOpenThread={openThread}
                                    onViewChange={setView}
                                    view={view}
                                />
                            )}
                        </PhoneShell>
                        <div className="grid gap-5 xl:grid-cols-2">
                            <PreviewPanel title="Individual Chat">
                                <ChatConversation
                                    thread={threads[0]}
                                    messages={parentMessages}
                                    compact={false}
                                />
                            </PreviewPanel>
                            <PreviewPanel title="Group Conversation">
                                <ChatConversation
                                    thread={threads[1]}
                                    messages={groupMessages}
                                    compact={false}
                                />
                            </PreviewPanel>
                            <PreviewPanel title="Groups">
                                <GroupsScreen
                                    onNewGroup={openGroupWizard}
                                    embedded
                                />
                            </PreviewPanel>
                            <PreviewPanel title="Notices">
                                <NoticesScreen embedded />
                            </PreviewPanel>
                        </div>
                    </section>
                </div>
            </main>
        </>
    );
}

function BrandPanel() {
    return (
        <aside className="flex flex-col items-center justify-center gap-6 rounded-[2rem] bg-white px-8 py-10 text-center shadow-[0_24px_80px_rgba(15,49,93,0.12)] lg:min-h-[760px] lg:w-72">
            <div className="flex size-28 items-center justify-center rounded-[1.6rem] bg-[#0054b8] text-white shadow-[0_18px_35px_rgba(0,84,184,0.28)]">
                <div className="relative">
                    <GraduationCap
                        className="mx-auto mb-[-6px] size-16"
                        strokeWidth={2.2}
                    />
                    <div className="mx-auto grid size-14 grid-cols-2 place-items-center rounded-full border-[5px] border-white">
                        <span className="size-2.5 rounded-full bg-white" />
                        <span className="size-2.5 rounded-full bg-white" />
                    </div>
                </div>
            </div>
            <div>
                <h1 className="text-4xl font-black tracking-[0.02em] text-[#073b75]">
                    ISuDD
                </h1>
                <p className="text-lg font-bold tracking-[0.16em] text-[#163c66]">
                    MESSENGER
                </p>
            </div>
            <p className="max-w-52 text-base leading-7 text-balance text-slate-600">
                Simple communication between school and parents.
            </p>
        </aside>
    );
}

function PhoneShell({ children }: { children: ReactNode }) {
    return (
        <div className="mx-auto w-full max-w-[390px]">
            <div className="rounded-[2rem] bg-slate-950 p-2 shadow-[0_24px_80px_rgba(15,49,93,0.2)]">
                <div className="h-[780px] overflow-hidden rounded-[1.5rem] bg-[#f5f8fc] ring-1 ring-slate-900/5">
                    {children}
                </div>
            </div>
        </div>
    );
}

function AppScreen({
    activeThread,
    onComposer,
    onGroupWizard,
    onOpenThread,
    onViewChange,
    view,
}: {
    activeThread: Thread;
    onComposer: () => void;
    onGroupWizard: () => void;
    onOpenThread: (id: string) => void;
    onViewChange: (view: View) => void;
    view: View;
}) {
    return (
        <div className="flex h-full flex-col">
            {view === 'chats' && (
                <>
                    <TopBar
                        title="ISuDD Messenger"
                        action={
                            <IconButton
                                label="New message"
                                onClick={onComposer}
                            >
                                <Edit3 className="size-5" />
                            </IconButton>
                        }
                        showLogo
                    />
                    <ChatList
                        activeThreadId={activeThread.id}
                        onOpenThread={onOpenThread}
                    />
                </>
            )}
            {view === 'contacts' && (
                <>
                    <TopBar
                        title="Contacts"
                        action={
                            <IconButton
                                label="New message"
                                onClick={onComposer}
                            >
                                <Edit3 className="size-5" />
                            </IconButton>
                        }
                    />
                    <ContactsScreen onOpenThread={onOpenThread} />
                </>
            )}
            {view === 'groups' && (
                <>
                    <TopBar
                        title="Groups"
                        action={
                            <IconButton
                                label="New group"
                                onClick={onGroupWizard}
                            >
                                <Plus className="size-5" />
                            </IconButton>
                        }
                    />
                    <GroupsScreen onNewGroup={onGroupWizard} />
                </>
            )}
            {view === 'notices' && (
                <>
                    <TopBar title="Notices" />
                    <NoticesScreen />
                </>
            )}
            {view === 'more' && (
                <>
                    <TopBar title="More" />
                    <MoreScreen />
                </>
            )}
            <TabBar active={view} onChange={onViewChange} />
        </div>
    );
}

function TopBar({
    action,
    showLogo = false,
    title,
}: {
    action?: ReactNode;
    showLogo?: boolean;
    title: string;
}) {
    return (
        <header className="flex h-20 shrink-0 items-end justify-between bg-[#003f88] px-4 pb-3 text-white">
            <div className="flex min-w-0 items-center gap-3">
                {showLogo && (
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                        <GraduationCap className="size-6" />
                    </span>
                )}
                <h2 className="truncate text-lg font-semibold">{title}</h2>
            </div>
            {action}
        </header>
    );
}

function ChatList({
    activeThreadId,
    onOpenThread,
}: {
    activeThreadId: string;
    onOpenThread: (id: string) => void;
}) {
    return (
        <div className="min-h-0 flex-1 overflow-y-auto bg-white">
            <div className="space-y-4 p-4">
                <SearchInput placeholder="Search" />
                <div className="grid grid-cols-4 rounded-full bg-slate-100 p-1 text-xs font-medium text-slate-500">
                    {filters.map((filter) => (
                        <button
                            className={`rounded-full px-2 py-2 ${filter === 'All' ? 'bg-white text-[#003f88] shadow-sm' : ''}`}
                            key={filter}
                            type="button"
                        >
                            {filter}
                        </button>
                    ))}
                </div>
            </div>
            <div className="divide-y divide-slate-100">
                {threads.map((thread) => (
                    <button
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${activeThreadId === thread.id ? 'bg-sky-50' : 'bg-white hover:bg-slate-50'}`}
                        key={thread.id}
                        onClick={() => onOpenThread(thread.id)}
                        type="button"
                    >
                        <Avatar
                            color={thread.color}
                            initials={thread.initials}
                            online={thread.online}
                            group={thread.kind === 'group'}
                        />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                    {thread.name}
                                </p>
                                <span className="shrink-0 text-[11px] text-slate-400">
                                    {thread.time}
                                </span>
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-2">
                                <p className="truncate text-xs text-slate-500">
                                    {thread.subtitle}
                                </p>
                                {thread.unread && (
                                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#0054b8] text-[10px] font-bold text-white">
                                        {thread.unread}
                                    </span>
                                )}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

function ChatConversation({
    compact = true,
    messages,
    thread,
}: {
    compact?: boolean;
    messages: Message[];
    thread: Thread;
}) {
    return (
        <div
            className={`flex h-full min-h-0 flex-col bg-[#edf3fb] ${compact ? '' : 'rounded-xl'}`}
        >
            <ChatHeader thread={thread} />
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5">
                <div className="mx-auto w-fit rounded-full bg-white/80 px-3 py-1 text-[11px] font-medium text-slate-500">
                    May 22, 2025
                </div>
                {messages.map((message, index) => (
                    <MessageBubble
                        key={`${message.body}-${index}`}
                        message={message}
                    />
                ))}
            </div>
            <Composer />
        </div>
    );
}

function ChatHeader({ thread }: { thread: Thread }) {
    return (
        <header className="flex h-20 shrink-0 items-end gap-3 bg-[#003f88] px-3 pb-3 text-white">
            <IconButton label="Back">
                <ArrowLeft className="size-5" />
            </IconButton>
            <Avatar
                color={thread.color}
                initials={thread.initials}
                online={thread.online}
                group={thread.kind === 'group'}
                small
            />
            <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold">
                    {thread.name}
                </h2>
                <p className="text-[11px] text-white/70">
                    {thread.kind === 'group'
                        ? '25 members'
                        : thread.online
                          ? 'Online'
                          : 'Away'}
                </p>
            </div>
            <IconButton label="Call">
                <Phone className="size-5" />
            </IconButton>
            <IconButton label="More">
                <MoreVertical className="size-5" />
            </IconButton>
        </header>
    );
}

function MessageBubble({ message }: { message: Message }) {
    return (
        <div
            className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`}
        >
            <div
                className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    message.mine
                        ? 'rounded-br-sm bg-[#cfe8ff] text-slate-900'
                        : 'rounded-bl-sm bg-white text-slate-900'
                }`}
            >
                {message.author && (
                    <p className="mb-1 text-xs font-semibold text-[#006b57]">
                        {message.author}
                    </p>
                )}
                <p className="leading-5">{message.body}</p>
                <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500">
                    {message.reaction && (
                        <span className="mr-auto inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                            <Check className="size-3 text-amber-500" />
                            {message.reaction}
                        </span>
                    )}
                    <span>{message.time}</span>
                    {message.status === 'read' && (
                        <CheckCheck className="size-3 text-[#0054b8]" />
                    )}
                </div>
            </div>
        </div>
    );
}

function Composer() {
    return (
        <div className="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-white px-3 py-3">
            <button
                className="grid size-9 place-items-center rounded-full bg-[#003f88] text-white"
                type="button"
            >
                <Plus className="size-5" />
            </button>
            <div className="flex h-10 min-w-0 flex-1 items-center rounded-full bg-slate-100 px-3 text-xs text-slate-400">
                Type a message...
            </div>
            <button
                className="grid size-9 place-items-center rounded-full text-slate-500"
                type="button"
            >
                <Smile className="size-5" />
            </button>
            <button
                className="grid size-9 place-items-center rounded-full text-slate-500"
                type="button"
            >
                <Mic className="size-5" />
            </button>
        </div>
    );
}

function GroupsScreen({
    embedded = false,
    onNewGroup,
}: {
    embedded?: boolean;
    onNewGroup?: () => void;
}) {
    return (
        <div
            className={`min-h-0 flex-1 overflow-y-auto bg-white ${embedded ? 'rounded-xl' : ''}`}
        >
            <div className="space-y-4 p-4">
                <SearchInput placeholder="Search groups" />
                <div className="space-y-2">
                    {groups.map((group) => (
                        <button
                            className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left transition hover:bg-slate-50"
                            key={group.name}
                            onClick={
                                group.name.includes('Grade 10')
                                    ? () => undefined
                                    : undefined
                            }
                            type="button"
                        >
                            <Avatar
                                color={group.color}
                                group
                                initials={group.name.slice(6, 8).trim() || 'A'}
                            />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                    {group.name}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {group.members}
                                </p>
                            </div>
                            {group.muted && (
                                <Bell className="size-4 text-slate-300" />
                            )}
                        </button>
                    ))}
                </div>
                {onNewGroup && (
                    <button
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#003f88] px-4 py-3 text-sm font-semibold text-white shadow-sm"
                        onClick={onNewGroup}
                        type="button"
                    >
                        <Plus className="size-4" />
                        New Group
                    </button>
                )}
            </div>
        </div>
    );
}

function NoticesScreen({ embedded = false }: { embedded?: boolean }) {
    return (
        <div
            className={`min-h-0 flex-1 overflow-y-auto bg-white ${embedded ? 'rounded-xl' : ''}`}
        >
            <div className="divide-y divide-slate-100 p-3">
                {notices.map((notice) => (
                    <button
                        className="flex w-full items-center gap-3 px-1 py-4 text-left"
                        key={notice.title}
                        type="button"
                    >
                        <span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-700">
                            {notice.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-slate-900">
                                {notice.title}
                            </span>
                            <span className="block truncate text-xs text-slate-500">
                                {notice.body}
                            </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-2 text-[11px] text-slate-400">
                            {notice.time}
                            {notice.unread && (
                                <span className="size-2 rounded-full bg-[#0054b8]" />
                            )}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}

function ContactsScreen({
    onOpenThread,
}: {
    onOpenThread: (id: string) => void;
}) {
    return (
        <div className="min-h-0 flex-1 overflow-y-auto bg-white p-4">
            <SearchInput placeholder="Search parents" />
            <div className="mt-4 space-y-2">
                {threads
                    .filter((thread) => thread.kind === 'parent')
                    .map((thread) => (
                        <button
                            className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-slate-50"
                            key={thread.id}
                            onClick={() => onOpenThread(thread.id)}
                            type="button"
                        >
                            <Avatar
                                color={thread.color}
                                initials={thread.initials}
                                online={thread.online}
                            />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">
                                    {thread.name.replace('Parent: ', '')}
                                </p>
                                <p className="text-xs text-slate-500">
                                    Linked parent account
                                </p>
                            </div>
                            <ChevronRight className="size-4 text-slate-300" />
                        </button>
                    ))}
            </div>
        </div>
    );
}

function MoreScreen() {
    const items = [
        {
            icon: <UsersRound className="size-5" />,
            title: 'My Children',
            subtitle: 'View linked students',
        },
        {
            icon: <Settings className="size-5" />,
            title: 'Account Settings',
            subtitle: 'Edit your profile',
        },
        {
            icon: <Headphones className="size-5" />,
            title: 'Help & Support',
            subtitle: 'FAQs and support center',
        },
        {
            icon: <Info className="size-5" />,
            title: 'About ISuDD Messenger',
            subtitle: 'Version 1.0.0',
        },
    ];

    return (
        <div className="min-h-0 flex-1 overflow-y-auto bg-white">
            <div className="flex items-center gap-3 border-b border-slate-100 p-4">
                <Avatar color="bg-rose-500" initials="MS" />
                <div>
                    <p className="text-sm font-semibold">Maria Santos</p>
                    <p className="text-xs text-slate-500">Parent</p>
                </div>
            </div>
            <div className="divide-y divide-slate-100">
                {items.map((item) => (
                    <button
                        className="flex w-full items-center gap-3 px-4 py-4 text-left"
                        key={item.title}
                        type="button"
                    >
                        <span className="text-slate-500">{item.icon}</span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-slate-900">
                                {item.title}
                            </span>
                            <span className="block text-xs text-slate-500">
                                {item.subtitle}
                            </span>
                        </span>
                        <ChevronRight className="size-4 text-slate-300" />
                    </button>
                ))}
            </div>
        </div>
    );
}

function NewMessageScreen({
    onBack,
    onNewGroup,
}: {
    onBack: () => void;
    onNewGroup: () => void;
}) {
    return (
        <div className="flex h-full flex-col bg-white">
            <header className="flex h-20 shrink-0 items-end justify-between bg-[#003f88] px-4 pb-3 text-white">
                <h2 className="text-lg font-semibold">New Message</h2>
                <button
                    className="text-sm font-medium text-white/85"
                    onClick={onBack}
                    type="button"
                >
                    Cancel
                </button>
            </header>
            <div className="p-5">
                <button
                    className="flex w-full items-center gap-4 rounded-xl p-3 text-left hover:bg-slate-50"
                    type="button"
                >
                    <span className="grid size-12 place-items-center rounded-2xl bg-sky-100 text-[#0054b8]">
                        <UserRound className="size-6" />
                    </span>
                    <span>
                        <span className="block text-sm font-semibold text-slate-900">
                            New Individual Chat
                        </span>
                        <span className="text-xs text-slate-500">
                            Message a parent privately
                        </span>
                    </span>
                </button>
                <button
                    className="flex w-full items-center gap-4 rounded-xl p-3 text-left hover:bg-slate-50"
                    onClick={onNewGroup}
                    type="button"
                >
                    <span className="grid size-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
                        <UsersRound className="size-6" />
                    </span>
                    <span>
                        <span className="block text-sm font-semibold text-slate-900">
                            New Group Chat
                        </span>
                        <span className="text-xs text-slate-500">
                            Create a group for parents
                        </span>
                    </span>
                </button>
                <button
                    className="flex w-full items-center gap-4 rounded-xl p-3 text-left hover:bg-slate-50"
                    type="button"
                >
                    <span className="grid size-12 place-items-center rounded-2xl bg-amber-100 text-amber-700">
                        <Megaphone className="size-6" />
                    </span>
                    <span>
                        <span className="block text-sm font-semibold text-slate-900">
                            New Announcement
                        </span>
                        <span className="text-xs text-slate-500">
                            Send an announcement
                        </span>
                    </span>
                </button>
            </div>
        </div>
    );
}

function NewGroupScreen({
    onBack,
    selectedParents,
    setSelectedParents,
}: {
    onBack: () => void;
    selectedParents: string[];
    setSelectedParents: (parents: string[]) => void;
}) {
    const toggleParent = (name: string) => {
        setSelectedParents(
            selectedParents.includes(name)
                ? selectedParents.filter((parent) => parent !== name)
                : [...selectedParents, name],
        );
    };

    return (
        <div className="flex h-full flex-col bg-white">
            <header className="flex h-20 shrink-0 items-end justify-between bg-[#003f88] px-3 pb-3 text-white">
                <button
                    className="grid size-9 place-items-center rounded-full hover:bg-white/10"
                    onClick={onBack}
                    type="button"
                >
                    <ArrowLeft className="size-5" />
                </button>
                <h2 className="text-lg font-semibold">New Group</h2>
                <button
                    className="text-sm font-medium text-white/85"
                    onClick={onBack}
                    type="button"
                >
                    Done
                </button>
            </header>
            <div className="space-y-5 p-5">
                <div className="mx-auto grid size-20 place-items-center rounded-full bg-sky-100 text-[#0054b8]">
                    <UsersRound className="size-9" />
                </div>
                <label className="block text-xs font-semibold tracking-wide text-slate-400 uppercase">
                    Group Name
                    <input
                        className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold tracking-normal text-slate-900 normal-case outline-none focus:border-[#0054b8]"
                        defaultValue="Grade 11 - Section A Parents"
                    />
                </label>
                <label className="block text-xs font-semibold tracking-wide text-slate-400 uppercase">
                    Description
                    <textarea
                        className="mt-2 h-20 w-full resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm font-medium tracking-normal text-slate-900 normal-case outline-none focus:border-[#0054b8]"
                        defaultValue="Official group for parents of Grade 11 - Section A"
                    />
                </label>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-100 p-4">
                <SearchInput placeholder="Search parents" />
                <div className="mt-3 space-y-1">
                    {parents.map(([name, initials, color]) => {
                        const selected = selectedParents.includes(name);

                        return (
                            <button
                                className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-slate-50"
                                key={name}
                                onClick={() => toggleParent(name)}
                                type="button"
                            >
                                <Avatar color={color} initials={initials} />
                                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                                    {name}
                                </span>
                                <span
                                    className={`grid size-6 place-items-center rounded-full border ${selected ? 'border-[#0054b8] bg-[#0054b8] text-white' : 'border-slate-200 text-transparent'}`}
                                >
                                    <Check className="size-4" />
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function PreviewPanel({
    children,
    title,
}: {
    children: ReactNode;
    title: string;
}) {
    return (
        <article className="min-h-[360px] overflow-hidden rounded-[1.5rem] bg-white shadow-[0_16px_45px_rgba(15,49,93,0.12)]">
            <div className="flex h-12 items-center justify-between border-b border-slate-100 px-4">
                <h3 className="text-sm font-semibold text-slate-800">
                    {title}
                </h3>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <div className="h-[348px] bg-[#f5f8fc]">{children}</div>
        </article>
    );
}

function SearchInput({ placeholder }: { placeholder: string }) {
    return (
        <label className="flex h-11 items-center gap-2 rounded-xl bg-slate-100 px-3 text-slate-400">
            <Search className="size-4" />
            <input
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                placeholder={placeholder}
                type="search"
            />
        </label>
    );
}

function TabBar({
    active,
    onChange,
}: {
    active: View;
    onChange: (view: View) => void;
}) {
    const tabs: Array<{ icon: ReactNode; label: string; view: View }> = [
        {
            icon: <MessageCircle className="size-5" />,
            label: 'Chats',
            view: 'chats',
        },
        {
            icon: <CircleUserRound className="size-5" />,
            label: 'Contacts',
            view: 'contacts',
        },
        {
            icon: <UsersRound className="size-5" />,
            label: 'Groups',
            view: 'groups',
        },
        {
            icon: <Bell className="size-5" />,
            label: 'Notices',
            view: 'notices',
        },
        { icon: <Menu className="size-5" />, label: 'More', view: 'more' },
    ];

    return (
        <nav className="grid h-16 shrink-0 grid-cols-5 border-t border-slate-200 bg-white">
            {tabs.map((tab) => (
                <button
                    className={`flex flex-col items-center justify-center gap-1 text-[10px] font-medium ${active === tab.view ? 'text-[#003f88]' : 'text-slate-400'}`}
                    key={tab.view}
                    onClick={() => onChange(tab.view)}
                    type="button"
                >
                    {tab.icon}
                    {tab.label}
                </button>
            ))}
        </nav>
    );
}

function Avatar({
    color,
    group = false,
    initials,
    online = false,
    small = false,
}: {
    color: string;
    group?: boolean;
    initials: string;
    online?: boolean;
    small?: boolean;
}) {
    return (
        <span
            className={`relative grid ${small ? 'size-9' : 'size-12'} shrink-0 place-items-center rounded-full ${color} text-sm font-bold text-white shadow-sm`}
        >
            {group ? (
                <UsersRound className={small ? 'size-5' : 'size-6'} />
            ) : (
                initials
            )}
            {online && (
                <span className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-white bg-emerald-500" />
            )}
        </span>
    );
}

function IconButton({
    children,
    label,
    onClick,
}: {
    children: ReactNode;
    label: string;
    onClick?: () => void;
}) {
    return (
        <button
            aria-label={label}
            className="grid size-9 shrink-0 place-items-center rounded-full text-white transition hover:bg-white/10"
            onClick={onClick}
            type="button"
        >
            {children}
        </button>
    );
}
