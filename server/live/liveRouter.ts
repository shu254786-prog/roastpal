import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import type { ProviderConfig, RoastLevel } from '../../shared/types.js';
import { getPersonaById, getScenarioById, getUnmasteredMistakes } from '../storage.js';
import { createGeminiLiveBridge, type LiveSessionHandler } from './geminiLive.js';
import { createOpenAIRealtimeBridge } from './openaiRealtime.js';

interface ClientLiveMessage {
  type: 'start' | 'audio' | 'audio_end' | 'text' | 'stop';
  config?: ProviderConfig;
  personaId?: string;
  scenarioId?: string;
  roastLevel?: RoastLevel;
  data?: string;
  text?: string;
}

export function attachLiveWebSocketServer(httpServer: {
  on: (event: 'upgrade', listener: (req: IncomingMessage, socket: Duplex, head: Buffer) => void) => void;
}): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const pathname = (req.url || '').split('?')[0];
    if (pathname !== '/ws/live') {
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws: WebSocket) => {
    let activeHandler: LiveSessionHandler | null = null;

    const sendError = (message: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'error', message }));
      }
    };

    ws.on('message', async (raw) => {
      let msg: ClientLiveMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientLiveMessage;
      } catch {
        sendError('无效的 WebSocket 消息格式');
        return;
      }

      if (msg.type === 'start') {
        if (activeHandler) {
          activeHandler.close();
          activeHandler = null;
        }
        const config = msg.config;
        if (!config || !config.apiKey?.trim()) {
          sendError('请先在设置中填写 API Key（Gemini 或 OpenAI）后再开启实时连麦。');
          return;
        }

        try {
          const [persona, scenario, pastMistakes] = await Promise.all([
            getPersonaById(msg.personaId || 'maya'),
            getScenarioById(msg.scenarioId || 'free-chat'),
            getUnmasteredMistakes(6),
          ]);
          const roastLevel: RoastLevel = msg.roastLevel || persona.defaultRoastLevel || 3;

          if (config.provider === 'gemini') {
            activeHandler = await createGeminiLiveBridge({
              ws,
              config,
              persona,
              scenario,
              roastLevel,
              pastMistakes,
            });
          } else if (config.provider === 'openai') {
            activeHandler = await createOpenAIRealtimeBridge({
              ws,
              config,
              persona,
              scenario,
              roastLevel,
              pastMistakes,
            });
          } else {
            sendError(
              '当前所选服务商不支持端到端实时连麦，请切换为「对讲模式」或换用 Gemini / OpenAI API Key。',
            );
          }
        } catch (err) {
          sendError(err instanceof Error ? err.message : '启动实时连麦失败');
        }
        return;
      }

      if (!activeHandler) return;

      if (msg.type === 'audio' && msg.data) {
        activeHandler.sendAudioChunk(msg.data);
      } else if (msg.type === 'audio_end') {
        activeHandler.endAudioInput();
      } else if (msg.type === 'text' && msg.text) {
        activeHandler.sendText(msg.text);
      } else if (msg.type === 'stop') {
        activeHandler.close();
        activeHandler = null;
      }
    });

    ws.on('close', () => {
      if (activeHandler) {
        activeHandler.close();
        activeHandler = null;
      }
    });
  });
}
