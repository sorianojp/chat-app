import { useCallback, useEffect, useRef, useState } from 'react';

// Leave room for multipart overhead under the app's 20 MB POST limit.
export const MAX_VOICE_NOTE_BYTES = 18 * 1024 * 1024;
export const MAX_VOICE_NOTE_SECONDS = 5 * 60;

export type VoiceRecorderStatus =
    'idle' | 'requesting' | 'recording' | 'finishing';

// AAC in MP4 first: it is the one format the iOS app (AVPlayer) can play.
// Browsers that cannot record it fall back to WebM/Ogg.
const MIME_TYPES = [
    'audio/mp4;codecs=mp4a.40.2',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
];

function recordingExtension(mimeType: string): string {
    if (mimeType.includes('mp4')) {
        return 'm4a';
    }

    if (mimeType.includes('ogg')) {
        return 'ogg';
    }

    return 'webm';
}

function microphoneError(error: unknown): string {
    if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
            return 'Microphone access was denied. Allow it in your browser settings and try again.';
        }

        if (error.name === 'NotFoundError') {
            return 'No microphone was found on this device.';
        }

        if (error.name === 'NotReadableError') {
            return 'The microphone is in use by another app. Close it and try again.';
        }
    }

    return 'Could not start recording. Please try again.';
}

export function useVoiceRecorder(onRecorded: (file: File) => void) {
    const [status, setStatus] = useState<VoiceRecorderStatus>('idle');
    const [seconds, setSeconds] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const bytesRef = useRef(0);
    const timerRef = useRef<number | null>(null);
    const limitTimerRef = useRef<number | null>(null);
    const startedAtRef = useRef(0);
    const requestTokenRef = useRef(0);
    const busyRef = useRef(false);
    const discardRef = useRef(false);
    const disposedRef = useRef(false);

    const clearTimers = useCallback(() => {
        if (timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
        }

        if (limitTimerRef.current !== null) {
            window.clearTimeout(limitTimerRef.current);
            limitTimerRef.current = null;
        }
    }, []);

    const releaseStream = useCallback(() => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
    }, []);

    const stop = useCallback(() => {
        const recorder = recorderRef.current;

        if (!recorder || recorder.state === 'inactive') {
            return;
        }

        clearTimers();

        if (!disposedRef.current) {
            setStatus('finishing');
        }

        recorder.stop();
    }, [clearTimers]);

    const cancel = useCallback(() => {
        requestTokenRef.current += 1;
        discardRef.current = true;
        clearTimers();

        if (recorderRef.current?.state !== 'inactive') {
            recorderRef.current?.stop();
        }

        releaseStream();
        busyRef.current = false;
        setStatus('idle');
        setSeconds(0);
        setError(null);
    }, [clearTimers, releaseStream]);

    const start = useCallback(async () => {
        if (busyRef.current) {
            return;
        }

        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
            setError(
                'Voice recording needs a supported browser and HTTPS or localhost.',
            );

            return;
        }

        busyRef.current = true;
        discardRef.current = false;
        chunksRef.current = [];
        bytesRef.current = 0;
        setSeconds(0);
        setError(null);
        setStatus('requesting');
        const requestToken = ++requestTokenRef.current;
        let stream: MediaStream | null = null;

        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                },
                video: false,
            });

            if (
                disposedRef.current ||
                requestToken !== requestTokenRef.current
            ) {
                stream.getTracks().forEach((track) => track.stop());

                return;
            }

            streamRef.current = stream;
            const mimeType = MIME_TYPES.find((type) =>
                MediaRecorder.isTypeSupported(type),
            );
            const recorder = new MediaRecorder(
                stream,
                mimeType ? { mimeType } : undefined,
            );
            recorderRef.current = recorder;

            recorder.ondataavailable = (event: BlobEvent) => {
                if (event.data.size === 0 || discardRef.current) {
                    return;
                }

                bytesRef.current += event.data.size;

                if (bytesRef.current > MAX_VOICE_NOTE_BYTES) {
                    discardRef.current = true;
                    setError('Voice notes must be smaller than 18 MB.');
                    stop();

                    return;
                }

                chunksRef.current.push(event.data);
            };

            recorder.onerror = () => {
                discardRef.current = true;
                setError('Recording stopped unexpectedly. Please try again.');
                stop();
            };

            recorder.onstop = () => {
                clearTimers();
                releaseStream();
                recorderRef.current = null;
                busyRef.current = false;

                if (disposedRef.current) {
                    return;
                }

                setStatus('idle');

                if (discardRef.current) {
                    return;
                }

                const recordedMimeType =
                    recorder.mimeType || chunksRef.current[0]?.type || '';
                const blob = new Blob(chunksRef.current, {
                    type: recordedMimeType,
                });

                if (blob.size === 0) {
                    setError('No audio was captured. Please try again.');

                    return;
                }

                if (blob.size > MAX_VOICE_NOTE_BYTES) {
                    setError('Voice notes must be smaller than 18 MB.');

                    return;
                }

                const extension = recordingExtension(recordedMimeType);
                const file = new File(
                    [blob],
                    `voice-note-${new Date().toISOString().replaceAll(':', '-')}.${extension}`,
                    { type: recordedMimeType.split(';')[0] || 'audio/webm' },
                );

                onRecorded(file);
            };

            recorder.start(1000);
            startedAtRef.current = Date.now();
            setStatus('recording');
            timerRef.current = window.setInterval(() => {
                setSeconds(
                    Math.min(
                        MAX_VOICE_NOTE_SECONDS,
                        Math.floor((Date.now() - startedAtRef.current) / 1000),
                    ),
                );
            }, 1000);
            limitTimerRef.current = window.setTimeout(
                stop,
                MAX_VOICE_NOTE_SECONDS * 1000,
            );
        } catch (recordingError) {
            stream?.getTracks().forEach((track) => track.stop());
            releaseStream();
            clearTimers();
            recorderRef.current = null;
            busyRef.current = false;

            if (
                !disposedRef.current &&
                requestToken === requestTokenRef.current
            ) {
                setStatus('idle');
                setError(microphoneError(recordingError));
            }
        }
    }, [clearTimers, onRecorded, releaseStream, stop]);

    useEffect(() => {
        disposedRef.current = false;

        return () => {
            disposedRef.current = true;
            requestTokenRef.current += 1;
            discardRef.current = true;
            clearTimers();

            if (recorderRef.current?.state !== 'inactive') {
                recorderRef.current?.stop();
            }

            releaseStream();
        };
    }, [clearTimers, releaseStream]);

    return { status, seconds, error, start, stop, cancel };
}
