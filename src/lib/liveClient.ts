import type { LiveServerEvent, ProviderConfig, RoastLevel } from '../../shared/types.js';

export class LiveSessionClient {
  private ws: WebSocket | null = null;
  private onEvent: (ev: LiveServerEvent) => void;
  private onCloseCb?: () => void;

  constructor(onEvent: (ev: LiveServerEvent) => void, onClose?: () => void) {
    this.onEvent = onEvent;
    this.onCloseCb = onClose;
  }

  connect(params: {
    config: ProviderConfig;
    personaId: string;
    scenarioId: string;
    roastLevel: RoastLevel;
  }): void {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws/live`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.ws?.send(
        JSON.stringify({
          type: 'start',
          config: params.config,
          personaId: params.personaId,
          scenarioId: params.scenarioId,
          roastLevel: params.roastLevel,
        }),
      );
    };

    this.ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data as string) as LiveServerEvent;
        this.onEvent(parsed);
      } catch {
        // ignore non-json frames
      }
    };

    this.ws.onerror = () => {
      this.onEvent({ type: 'error', message: '实时连麦 WebSocket 连接出错' });
    };

    this.ws.onclose = () => {
      this.onCloseCb?.();
    };
  }

  sendAudioChunk(base64Pcm16k: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'audio', data: base64Pcm16k }));
    }
  }

  endAudioInput(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'audio_end' }));
    }
  }

  sendText(text: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'text', text }));
    }
  }

  close(): void {
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'stop' }));
      }
      this.ws.close();
      this.ws = null;
    }
  }
}
