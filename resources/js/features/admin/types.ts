export type Paginated<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
};

export type AdminUser = {
    id: number;
    name: string;
    email: string;
    school_role: string;
    last_seen_at: string | null;
    online: boolean;
    schools?: string[];
};

export type AdminConversation = {
    id: number;
    type: 'direct' | 'group' | 'announcement';
    title: string;
    school: string | null;
    participants_count: number;
    messages_count: number | null;
    last_message_at: string | null;
};

export type AdminMessage = {
    id: number;
    type: string;
    body: string;
    sender: { id: number; name: string } | null;
    created_at: string | null;
    unsent: boolean;
    deleted: boolean;
    attachments: {
        id: number;
        name: string;
        mime_type: string;
        size: number;
    }[];
};
