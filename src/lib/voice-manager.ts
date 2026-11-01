export type VoiceLanguage = "en-IN" | "ta-IN" | "en-US" | "hi-IN";

export interface VoiceState {
  isSpeaking: boolean;
  language: VoiceLanguage;
}

class VoiceManager {
  private isSpeaking = false;
  private currentLanguage: VoiceLanguage = "en-IN";
  private listeners: Set<(state: VoiceState) => void> = new Set();
  private utterance: SpeechSynthesisUtterance | null = null;

  subscribe(listener: (state: VoiceState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.error("VoiceManager listener error:", err);
      }
    });
  }

  getState(): VoiceState {
    return {
      isSpeaking: this.isSpeaking,
      language: this.currentLanguage,
    };
  }

  cancel(): void {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.utterance = null;
    this.notify();
  }

  splitIntoSentences(text: string): string[] {
    if (!text) return [];
    // Clean markdown asterisks and hash marks for clean TTS
    const cleaned = text.replace(/[*_#`~[\]]/g, " ");
    const matches = cleaned.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g);
    return matches ? matches.map((s) => s.trim()).filter(Boolean) : [cleaned.trim()].filter(Boolean);
  }

  speakSentence(text: string, lang: VoiceLanguage | string = "en-IN", onEnd?: () => void): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      onEnd?.();
      return;
    }

    if (!text.trim()) {
      onEnd?.();
      return;
    }

    this.cancel();
    this.currentLanguage = (lang as VoiceLanguage) || "en-IN";
    this.isSpeaking = true;
    this.notify();

    const utterance = new SpeechSynthesisUtterance(text);
    this.utterance = utterance;
    utterance.lang = lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      this.isSpeaking = false;
      this.utterance = null;
      this.notify();
      onEnd?.();
    };

    utterance.onerror = (e) => {
      console.warn("SpeechSynthesis error:", e);
      this.isSpeaking = false;
      this.utterance = null;
      this.notify();
      onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  }
}

export const voiceManager = new VoiceManager();
