import type { ProviderConfig } from '../../shared/types.js';

export async function transcribeWithWhisper(params: {
  config: ProviderConfig;
  audioBase64: string;
  audioMimeType?: string;
}): Promise<string> {
  const apiKey = params.config.apiKey?.trim();
  if (!apiKey) {
    throw new Error('缺少 API Key，无法调用 Whisper 语音转写。');
  }

  const baseUrl = (params.config.baseUrl || 'https://api.openai.com/v1')
    .trim()
    .replace(/\/+$/, '');
  const endpoint = `${baseUrl}/audio/transcriptions`;
  const model = params.config.sttModel?.trim() || 'whisper-1';

  const bytes = Buffer.from(params.audioBase64, 'base64');
  const mime = (params.audioMimeType || 'audio/wav').split(';')[0].trim();
  const ext = mime.includes('webm') ? 'webm' : mime.includes('mp3') ? 'mp3' : 'wav';

  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mime }), `speech.${ext}`);
  form.append('model', model);
  form.append('language', 'en');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`STT ${res.status}: ${bodyText.slice(0, 260)}`);
  }

  const data = JSON.parse(bodyText) as { text?: string };
  return (data.text || '').trim();
}
