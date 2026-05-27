/**
 * Röstintegration. Anropar Rust-kommandon som shellar ut till
 * whisper.cpp och piper. Om binärerna saknas returnerar Rust ett
 * "missing_binary"-fel — frontend visar då en mjuk uppmaning utan att
 * blockera text-flödet.
 */

import { invoke } from '@tauri-apps/api/core';

export interface VoiceAvailability {
  whisper: boolean;
  piper: boolean;
}

export interface VoiceError {
  kind: string;
  message: string;
}

export async function voiceAvailability(): Promise<VoiceAvailability> {
  try {
    return await invoke<VoiceAvailability>('voice_availability');
  } catch {
    return { whisper: false, piper: false };
  }
}

export interface VoiceSettings {
  whisperModelPath: string;
  piperVoicePath: string;
  language: string; // "es" eller "auto"
}

const DEFAULT_SETTINGS: VoiceSettings = {
  whisperModelPath: '',
  piperVoicePath: '',
  language: 'es'
};

const SETTINGS_KEY = 'lokale.voice_settings';

export function loadVoiceSettings(): VoiceSettings {
  if (typeof localStorage === 'undefined') return DEFAULT_SETTINGS;
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<VoiceSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveVoiceSettings(s: VoiceSettings): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

/**
 * Spelar in mikrofon tills caller stoppar. Returnerar en blob som WAV
 * (eller webm/opus om webbläsaren inte stöder wav direkt — vi konverterar
 * inte här, det får whisper hantera om möjligt).
 *
 * Implementationen är medvetet enkel: MediaRecorder default-format.
 * Whisper.cpp tar wav helst — om webbläsaren ger webm/opus skickar vi
 * det ändå och låter whisper avgöra. På macOS/Linux med moderna
 * ffmpeg/whisper.cpp-byggen brukar det fungera. Om inte: lägg till
 * konvertering här.
 */
export class Recorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = pickSupportedMimeType();
    this.mediaRecorder = new MediaRecorder(
      this.stream,
      mime ? { mimeType: mime } : undefined
    );
    this.chunks = [];
    this.mediaRecorder.addEventListener('dataavailable', (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    });
    this.mediaRecorder.start();
  }

  async stop(): Promise<Blob> {
    if (!this.mediaRecorder) throw new Error('Recorder not started');
    const rec = this.mediaRecorder;
    const done = new Promise<void>((resolve) => {
      rec.addEventListener('stop', () => resolve(), { once: true });
    });
    rec.stop();
    await done;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.mediaRecorder = null;
    return new Blob(this.chunks, { type: rec.mimeType || 'audio/webm' });
  }
}

function pickSupportedMimeType(): string | null {
  // Föredra wav om möjligt; annars webm/opus.
  const candidates = [
    'audio/wav',
    'audio/wave',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus'
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return null;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // Base64-koda i chunkar för att slippa stack-overflow på stora buffers.
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBlob(b64: string, mime = 'audio/wav'): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function transcribe(audio: Blob, settings: VoiceSettings): Promise<string> {
  const audio_base64 = await blobToBase64(audio);
  const result = await invoke<{ text: string }>('transcribe_audio', {
    args: {
      audio_base64,
      language: settings.language,
      model_path: settings.whisperModelPath
    }
  });
  return result.text;
}

export async function synthesize(text: string, settings: VoiceSettings): Promise<Blob> {
  const result = await invoke<{ audio_base64: string }>('synthesize_speech', {
    args: { text, voice_path: settings.piperVoicePath }
  });
  return base64ToBlob(result.audio_base64);
}

export async function speak(text: string, settings: VoiceSettings): Promise<void> {
  const blob = await synthesize(text, settings);
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  await new Promise<void>((resolve, reject) => {
    audio.addEventListener('ended', () => resolve(), { once: true });
    audio.addEventListener('error', () => reject(new Error('audio playback failed')), {
      once: true
    });
    audio.play().catch(reject);
  });
  URL.revokeObjectURL(url);
}
