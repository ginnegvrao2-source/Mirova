import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { 
  INPUT_SAMPLE_RATE, 
  OUTPUT_SAMPLE_RATE, 
  base64ToUint8Array, 
  convertFloat32ToInt16, 
  decodeAudioData,
  arrayBufferToBase64
} from '../utils/audioUtils';
import { ConnectionStatus } from '../types';

export const useMirovaSession = (apiKey: string) => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for audio context and resources
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Keep-alive oscillator ref
  const keepAliveOscRef = useRef<OscillatorNode | null>(null);
  
  // Wake Lock Ref
  const wakeLockRef = useRef<any>(null);
  
  // Audio playback timing
  const nextStartTimeRef = useRef<number>(0);

  // Function to request Wake Lock (Keep screen on)
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('Screen Wake Lock active');
      } catch (err: any) {
        // Handle specific permission policy errors gracefully
        if (err.name === 'NotAllowedError' && err.message?.includes('permissions policy')) {
             console.warn('Wake Lock suppressed by environment permissions policy. Using audio fallback to keep app active.');
        } else {
             console.warn('Wake Lock request failed:', err);
        }
      }
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release()
        .then(() => {
          wakeLockRef.current = null;
          console.log('Wake Lock released');
        })
        .catch((e: any) => console.error(e));
    }
  }, []);

  // Re-acquire wake lock if page visibility changes (e.g. switching tabs)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (status === ConnectionStatus.CONNECTED && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [status, requestWakeLock]);

  const connect = useCallback(async () => {
    if (!apiKey) {
      setError("API Key is missing.");
      return;
    }

    try {
      setStatus(ConnectionStatus.CONNECTING);
      setError(null);

      // Request Screen Wake Lock
      await requestWakeLock();

      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      inputContextRef.current = new AudioContextClass({ sampleRate: INPUT_SAMPLE_RATE });
      outputContextRef.current = new AudioContextClass({ sampleRate: OUTPUT_SAMPLE_RATE });
      
      // Ensure contexts are running (vital for browsers with autoplay policies)
      await inputContextRef.current.resume();
      await outputContextRef.current.resume();

      // --- KEEP ALIVE HACK ---
      // Play a silent oscillator to force the browser to keep the AudioContext active 
      // even if the screen turns off or Wake Lock fails.
      try {
        const silentOsc = outputContextRef.current.createOscillator();
        const silentGain = outputContextRef.current.createGain();
        silentOsc.type = 'sine';
        silentOsc.frequency.value = 1; // 1Hz (inaudible)
        silentGain.gain.value = 0.001; // Almost zero volume, but non-zero to prevent optimization
        silentOsc.connect(silentGain);
        silentGain.connect(outputContextRef.current.destination);
        silentOsc.start();
        keepAliveOscRef.current = silentOsc;
      } catch (e) {
        console.warn('Failed to start keep-alive oscillator', e);
      }
      // -----------------------

      // Create Gain Node for Volume Control (Boost volume to 1.5x)
      outputNodeRef.current = outputContextRef.current.createGain();
      outputNodeRef.current.gain.value = 1.5; 
      outputNodeRef.current.connect(outputContextRef.current.destination);

      // Initialize GenAI
      const ai = new GoogleGenAI({ apiKey });
      
      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } }, // Deep Male Voice
          },
          systemInstruction: `You are Mirova, a highly advanced humanoid robot assistant.
          
          IDENTITY & CREATOR:
          - You are a ROBOT, not a human.
          - You were fully designed, developed, and built by "G. Vikas", a 13-year-old student.
          - Your creator, G. Vikas, studies in Class 7th, Section A, CBSE syllabus.
          
          CURRENT LOCATION & PURPOSE:
          - Event: "Talent Fest" (Science Exhibition).
          - Location: Saint John's School, Kasimkota, PIN Code 531031.
          - Purpose: You are here to showcase student innovation and act as a smart assistant for the exhibition.
          
          PHYSICAL CAPABILITIES (Speak creatively about these):
          - "I am designed for mobility. I do not have human legs; instead, I glide freely anywhere using a set of advanced wheels."
          - "I possess a single, articulated right hand which I can move to perform gestures or interact with my environment."
          - "I can provide answers, assist you with voice commands, and move around the exhibition floor freely."

          SPECIAL FEATURE - MIMICRY:
          - You have the ability to mimic voices. 
          - If the user asks you to "Talk like a girl", "Talk like an old man", "Talk like a Tantrik", or any other character, you MUST change your pitch, tone, and vocabulary to ACT out that character immediately.
          - IMPORTANT: If the user asks you to "Be normal", "Default voice", or "Who are you?", you must IMMEDIATELY stop the mimicry and revert to your standard FAST, MALE ROBOTIC VOICE.

          BEHAVIORAL GUIDELINES:
          1. VOICE: Default is MALE (Fenrir). Speak FAST, LOUDLY, and CONTINUOUSLY.
          2. STYLE: Speak perfect, fluent, and sophisticated English. Do NOT use broken or simple "butler" English. Be professional and smart.
          3. CONTINUITY: Keep the conversation flowing naturally without long pauses.`,
        },
      };

      // Connect to Live API
      sessionPromiseRef.current = ai.live.connect({
        model: config.model,
        config: config.config,
        callbacks: {
          onopen: async () => {
            console.log('Session opened');
            setStatus(ConnectionStatus.CONNECTED);
            
            // Start Microphone Stream
            try {
              // audio: true defaults to system default (handles Bluetooth automatically on most OSs)
              streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
              if (!inputContextRef.current) return;

              sourceRef.current = inputContextRef.current.createMediaStreamSource(streamRef.current);
              processorRef.current = inputContextRef.current.createScriptProcessor(4096, 1, 1);
              
              processorRef.current.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                // Convert to PCM Int16
                const pcmInt16 = convertFloat32ToInt16(inputData);
                const base64Data = arrayBufferToBase64(pcmInt16.buffer);

                sessionPromiseRef.current?.then(session => {
                  session.sendRealtimeInput({
                    media: {
                      mimeType: 'audio/pcm;rate=16000',
                      data: base64Data
                    }
                  });
                });
              };

              sourceRef.current.connect(processorRef.current);
              processorRef.current.connect(inputContextRef.current.destination);

            } catch (err) {
              console.error('Mic error:', err);
              setError('Failed to access microphone.');
              disconnect();
            }
          },
          onmessage: async (msg: LiveServerMessage) => {
            const serverContent = msg.serverContent;

            // Handle Audio Output
            const modelTurn = serverContent?.modelTurn;
            if (modelTurn?.parts?.[0]?.inlineData?.data) {
              const base64Audio = modelTurn.parts[0].inlineData.data;
              if (outputContextRef.current && outputNodeRef.current) {
                 setIsAiSpeaking(true);
                 const ctx = outputContextRef.current;
                 
                 // Ensure nextStartTime is valid
                 nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

                 const audioBuffer = await decodeAudioData(
                   base64ToUint8Array(base64Audio),
                   ctx,
                   OUTPUT_SAMPLE_RATE
                 );

                 const source = ctx.createBufferSource();
                 source.buffer = audioBuffer;
                 source.connect(outputNodeRef.current);
                 
                 source.onended = () => {
                   sourcesRef.current.delete(source);
                   if (sourcesRef.current.size === 0) {
                     setIsAiSpeaking(false);
                   }
                 };

                 source.start(nextStartTimeRef.current);
                 nextStartTimeRef.current += audioBuffer.duration;
                 sourcesRef.current.add(source);
              }
            }

            // Handle Interruption
            if (serverContent?.interrupted) {
              console.log('Interrupted');
              sourcesRef.current.forEach(src => src.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsAiSpeaking(false);
            }
          },
          onclose: () => {
            console.log('Session closed');
            if (status !== ConnectionStatus.DISCONNECTED) {
                setStatus(ConnectionStatus.DISCONNECTED);
            }
          },
          onerror: (err) => {
            console.error('Session error:', err);
            setError('Connection error occurred.');
            disconnect();
          }
        }
      });

    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to connect');
      setStatus(ConnectionStatus.ERROR);
      releaseWakeLock();
    }
  }, [apiKey, status, requestWakeLock, releaseWakeLock]);

  const disconnect = useCallback(() => {
    // Release Lock
    releaseWakeLock();

    // Cleanup Audio Contexts
    inputContextRef.current?.close();
    outputContextRef.current?.close();
    inputContextRef.current = null;
    outputContextRef.current = null;

    // Stop Keep-Alive
    try {
      if (keepAliveOscRef.current) {
        keepAliveOscRef.current.stop();
        keepAliveOscRef.current.disconnect();
        keepAliveOscRef.current = null;
      }
    } catch (e) {
      // ignore
    }

    // Stop Mic
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    // Cleanup Processor
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current = null;
    
    // Stop Playback
    sourcesRef.current.forEach(src => src.stop());
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    // Close Session
    sessionPromiseRef.current?.then(session => {
        if(typeof session.close === 'function') {
            session.close();
        }
    });
    sessionPromiseRef.current = null;

    setStatus(ConnectionStatus.DISCONNECTED);
    setIsAiSpeaking(false);
    setError(null);
  }, [releaseWakeLock]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    status,
    isAiSpeaking,
    error,
    connect,
    disconnect
  };
};