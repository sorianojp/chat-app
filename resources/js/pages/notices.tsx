import { Head, usePage } from '@inertiajs/react';
import { NoticesPanel } from '@/features/messenger/components/notices-panel';
import type { User } from '@/types';

type NoticeboardPageProps = {
    apiBaseUrl: string;
    workspace: {
        id: number;
        name: string;
        slug: string;
    };
};

export default function Notices({
    apiBaseUrl,
    workspace,
}: NoticeboardPageProps) {
    const { auth } = usePage<{ auth: { user: User } }>().props;

    return (
        <>
            <Head title="Notices" />
            <NoticesPanel
                apiBaseUrl={apiBaseUrl}
                canPublish={['admin', 'teacher'].includes(
                    auth.user.school_role,
                )}
                workspaceId={workspace.id}
                workspaceName={workspace.name}
            />
        </>
    );
}

Notices.layout = (props: { workspace?: { slug: string } }) => ({
    breadcrumbs: [
        {
            title: 'Notices',
            href: props.workspace ? `/${props.workspace.slug}/notices` : '/',
        },
    ],
});
