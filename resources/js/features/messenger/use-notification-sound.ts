import { useCallback, useEffect, useRef } from 'react';
import type { WindowWithWebAudio } from '@/features/messenger/types';

/**
 * Plays a short notification chime. Browsers keep audio suspended until the
 * first user gesture, so the context is unlocked on the first pointer or key press.
 */
export function useNotificationSound() {
    const notificationAudioContextRef = useRef<AudioContext | null>(null);

    const ensureNotificationAudioContext = useCallback(() => {
        if (typeof window === 'undefined') {
            return null;
        }

        if (notificationAudioContextRef.current) {
            return notificationAudioContextRef.current;
        }

        const AudioContextConstructor =
            window.AudioContext ??
            (window as WindowWithWebAudio).webkitAudioContext;

        if (!AudioContextConstructor) {
            return null;
        }

        notificationAudioContextRef.current = new AudioContextConstructor();

        return notificationAudioContextRef.current;
    }, []);

    const unlockNotificationAudio = useCallback(() => {
        const audioContext = ensureNotificationAudioContext();

        if (audioContext?.state === 'suspended') {
            void audioContext.resume();
        }
    }, [ensureNotificationAudioContext]);

    useEffect(() => {
        window.addEventListener('pointerdown', unlockNotificationAudio, {
            once: true,
        });
        window.addEventListener('keydown', unlockNotificationAudio, {
            once: true,
        });

        return () => {
            window.removeEventListener('pointerdown', unlockNotificationAudio);
            window.removeEventListener('keydown', unlockNotificationAudio);
        };
    }, [unlockNotificationAudio]);

    return useCallback(() => {
        const audioContext = ensureNotificationAudioContext();

        if (!audioContext) {
            return;
        }

        const playTone = () => {
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            const now = audioContext.currentTime;

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, now);
            oscillator.frequency.exponentialRampToValueAtTime(1320, now + 0.08);

            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.045, now + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

            oscillator.connect(gain);
            gain.connect(audioContext.destination);
            oscillator.start(now);
            oscillator.stop(now + 0.2);
        };

        if (audioContext.state === 'suspended') {
            void audioContext
                .resume()
                .then(playTone)
                .catch(() => {});

            return;
        }

        playTone();
    }, [ensureNotificationAudioContext]);
}
