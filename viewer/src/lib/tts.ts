export interface VoiceConfig {
  pitch: number;
  rate: number;
  voiceName?: string;
}

export const CLAUDE_VOICE: VoiceConfig = { pitch: 0.9, rate: 0.85 };
export const GEMINI_VOICE: VoiceConfig = { pitch: 1.1, rate: 0.95 };

class TTSManager {
  private synth: SpeechSynthesis;

  constructor() {
    this.synth = window.speechSynthesis;
  }

  speak(text: string, config: VoiceConfig, onEnd?: () => void, onBoundary?: (event: SpeechSynthesisEvent) => void) {
    this.stop();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = config.pitch;
    utterance.rate = config.rate;
    
    // Attempt to find a good voice
    const voices = this.synth.getVoices();
    if (config.voiceName) {
      const preferredVoice = voices.find(v => v.name.includes(config.voiceName!));
      if (preferredVoice) utterance.voice = preferredVoice;
    } else if (voices.length > 0) {
      const samantha = voices.find(v => v.name === 'Samantha');
      const daniel = voices.find(v => v.name === 'Daniel');
      if (config.pitch < 1 && daniel) utterance.voice = daniel;
      else if (config.pitch >= 1 && samantha) utterance.voice = samantha;
    }

    utterance.onend = () => {
      if (onEnd) onEnd();
    };

    utterance.onboundary = (event) => {
      if (onBoundary) onBoundary(event);
    };

    this.synth.speak(utterance);
  }

  stop() {
    this.synth.cancel();
  }

  pause() {
    this.synth.pause();
  }

  resume() {
    this.synth.resume();
  }
}

export const tts = new TTSManager();
