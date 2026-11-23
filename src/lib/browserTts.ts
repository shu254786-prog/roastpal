export function isBrowserTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function pickBestEnglishVoice(personaId?: string): SpeechSynthesisVoice | null {
  if (!isBrowserTtsSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  const enVoices = voices.filter((v) => /^en[-_]/i.test(v.lang));
  if (!enVoices.length) return null;

  const preferMale = personaId === 'gordon' || personaId === 'leo';

  const scored = enVoices.map((v) => {
    let score = 0;
    const name = v.name.toLowerCase();
    if (name.includes('natural') || name.includes('online')) score += 50;
    if (name.includes('google us english') || name.includes('google uk english')) score += 40;
    if (v.lang === 'en-US') score += 15;
    if (preferMale && /(guy|andrew|ryan|christopher|daniel|davis|george|male)/i.test(name)) score += 20;
    if (!preferMale && /(aria|jenny|ava|emma|samantha|victoria|female)/i.test(name)) score += 20;
    return { voice: v, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.voice || enVoices[0];
}

export function stopBrowserSpeech(): void {
  if (isBrowserTtsSupported()) {
    window.speechSynthesis.cancel();
  }
}

export function speakWithBrowserTts(params: {
  text: string;
  personaId?: string;
  onStart?: () => void;
  onEnd?: () => void;
}): void {
  if (!isBrowserTtsSupported()) {
    params.onEnd?.();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(params.text);
  utterance.lang = 'en-US';
  const voice = pickBestEnglishVoice(params.personaId);
  if (voice) utterance.voice = voice;

  if (params.personaId === 'maya') {
    utterance.rate = 1.08;
    utterance.pitch = 1.08;
  } else if (params.personaId === 'gordon') {
    utterance.rate = 1.05;
    utterance.pitch = 0.9;
  } else if (params.personaId === 'leo') {
    utterance.rate = 0.98;
    utterance.pitch = 0.96;
  } else {
    utterance.rate = 1.02;
    utterance.pitch = 1.0;
  }

  utterance.onstart = () => params.onStart?.();
  utterance.onend = () => params.onEnd?.();
  utterance.onerror = () => params.onEnd?.();
  window.speechSynthesis.speak(utterance);
}
