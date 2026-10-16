import type { Dispatch, SetStateAction } from 'react';
import { apiFetch } from '@/features/messenger/lib/api';
import { sortConversations } from '@/features/messenger/lib/conversations';
import type {
    Conversation,
    ConversationMutationPayload,
    MessengerMessage,
    NotificationPreference,
} from '@/features/messenger/types';

/**
 * Conversation-level actions (pin, archive, mute, rename, photo, members, leave).
 * Each one calls the API and then applies the server's response to local state.
 */
export function useConversationActions({
    apiBaseUrl,
    setConversations,
    replaceConversation,
    appendMessage,
    removeConversationFromCurrentView,
}: {
    apiBaseUrl: string;
    setConversations: Dispatch<SetStateAction<Conversation[]>>;
    replaceConversation: (conversation: Conversation) => void;
    appendMessage: (message: MessengerMessage) => void;
    removeConversationFromCurrentView: (conversationId: number) => void;
}) {
    const conversationUrl = (conversation: Conversation, path = '') =>
        `${apiBaseUrl}/conversations/${conversation.id}${path}`;

    /** Applies an updated conversation (and any "X renamed the group" system message). */
    const applyMutation = async (response: Response) => {
        if (!response.ok) {
            return false;
        }

        const payload = (await response.json()) as ConversationMutationPayload;
        replaceConversation(payload.data);

        if (payload.system_message) {
            appendMessage(payload.system_message);
        }

        return true;
    };

    const toggleConversationPin = async (conversation: Conversation) => {
        const nextPinned = conversation.pinned_at === null;
        const response = await apiFetch(conversationUrl(conversation, '/pin'), {
            method: 'PATCH',
            json: { pinned: nextPinned },
        });

        if (!response.ok) {
            return;
        }

        const payload = (await response.json()) as {
            data: { pinned_at: string | null };
        };

        setConversations((items) =>
            sortConversations(
                items.map((item) =>
                    item.id === conversation.id
                        ? {
                              ...item,
                              pinned_at: payload.data.pinned_at,
                          }
                        : item,
                ),
            ),
        );
    };

    const moveConversationToArchiveState = async (
        conversation: Conversation,
        shouldArchive: boolean,
    ) => {
        const response = await apiFetch(
            conversationUrl(conversation, '/archive'),
            { method: 'PATCH', json: { archived: shouldArchive } },
        );

        if (!response.ok) {
            return;
        }

        removeConversationFromCurrentView(conversation.id);
    };

    const deleteArchivedConversation = async (conversation: Conversation) => {
        if (!window.confirm('Permanently delete this archived chat?')) {
            return;
        }

        const response = await apiFetch(conversationUrl(conversation), {
            method: 'DELETE',
        });

        if (!response.ok) {
            return;
        }

        removeConversationFromCurrentView(conversation.id);
    };

    const updateNotificationPreference = async (
        conversation: Conversation,
        preference: NotificationPreference,
    ) => {
        const response = await apiFetch(
            conversationUrl(conversation, '/notifications'),
            { method: 'PATCH', json: { preference } },
        );

        if (!response.ok) {
            return false;
        }

        const payload = (await response.json()) as {
            data: {
                muted_at: string | null;
                notification_preference: NotificationPreference;
            };
        };

        setConversations((items) =>
            items.map((item) =>
                item.id === conversation.id
                    ? {
                          ...item,
                          muted_at: payload.data.muted_at,
                          notification_preference:
                              payload.data.notification_preference,
                      }
                    : item,
            ),
        );

        return true;
    };

    const toggleConversationMute = async (conversation: Conversation) => {
        await updateNotificationPreference(
            conversation,
            conversation.notification_preference === 'muted' ? 'all' : 'muted',
        );
    };

    const renameConversation = async (
        conversation: Conversation,
        title: string,
    ) =>
        applyMutation(
            await apiFetch(conversationUrl(conversation), {
                method: 'PATCH',
                json: { title },
            }),
        );

    const updateConversationPhoto = async (
        conversation: Conversation,
        photo: File,
    ) => {
        const formData = new FormData();
        formData.append('photo', photo);

        return applyMutation(
            await apiFetch(conversationUrl(conversation, '/photo'), {
                method: 'POST',
                body: formData,
            }),
        );
    };

    const removeConversationPhoto = async (conversation: Conversation) =>
        applyMutation(
            await apiFetch(conversationUrl(conversation, '/photo'), {
                method: 'DELETE',
            }),
        );

    const updateParticipantNickname = async (
        conversation: Conversation,
        userId: number,
        nickname: string | null,
    ) =>
        applyMutation(
            await apiFetch(
                conversationUrl(conversation, `/members/${userId}/nickname`),
                { method: 'PATCH', json: { nickname } },
            ),
        );

    const addConversationMembers = async (
        conversation: Conversation,
        userIds: number[],
    ) =>
        applyMutation(
            await apiFetch(conversationUrl(conversation, '/members'), {
                method: 'POST',
                json: { user_ids: userIds },
            }),
        );

    const removeConversationMember = async (
        conversation: Conversation,
        userId: number,
    ) =>
        applyMutation(
            await apiFetch(
                conversationUrl(conversation, `/members/${userId}`),
                {
                    method: 'DELETE',
                },
            ),
        );

    const leaveConversation = async (conversation: Conversation) => {
        if (!window.confirm('Leave this group chat?')) {
            return false;
        }

        const response = await apiFetch(
            conversationUrl(conversation, '/members/me'),
            { method: 'DELETE' },
        );

        if (!response.ok) {
            return false;
        }

        removeConversationFromCurrentView(conversation.id);

        return true;
    };

    return {
        toggleConversationPin,
        moveConversationToArchiveState,
        deleteArchivedConversation,
        toggleConversationMute,
        updateNotificationPreference,
        renameConversation,
        updateConversationPhoto,
        removeConversationPhoto,
        updateParticipantNickname,
        addConversationMembers,
        removeConversationMember,
        leaveConversation,
    };
}
