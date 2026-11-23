# RoastPal · 毒舌英语搭子

受近期海外爆火的 **Pingo AI** 启发的英语口语练习 Web 应用：支持**自由插拔自己的 API Key**，既能像真人搭子一样自然聊天，也能根据你调节的毒舌烈度（Lv.1 ~ Lv.5）在抓到中式英语、时态错误或塑料发音时当场开喷、并手把手给出地道 Native 表达。

## 核心亮点

- **多平台 API Key 全兼容**
  - **Google Gemini（推荐）**：原生接入 `gemini-3.8-live` 低延迟双向语音连麦（支持情感感知 Affective Dialog）、`gemini-4-hydrogen` 原生音频听音纠错、以及 `gemini-3.8-flash-lite-tts` 情绪配音。
  - **OpenAI 官方**：支持 `gpt-4o-realtime-preview` 实时语音连麦、Whisper 语音识别与 `gpt-4o-mini-tts` 表情朗读。
  - **DeepSeek / 通义千问 / 硅基流动 / 豆包 / OpenRouter / 中转站**：全兼容 OpenAI `/chat/completions`，并自动搭配免费的浏览器端语音识别（Web Speech API）与自然英语 TTS，省钱直连也能爽练口语。
- **内置 4 种搭子性格 + 5 档毒舌烈度 + 自定义捏人**
  - `Maya · 纽约毒舌闺蜜`、`Gordon · 魔鬼口语教练`、`Leo · 加州松弛铁哥们`、`Claire · 硅谷毒舌 VP`。
- **双模式语音交互**
  - **对讲精练模式**：点击说话（支持空格键快捷键），每轮自动产出中文吐槽翻译 + 红绿对比纠错卡片（Chinglish / 语法 / 用词 / 发音 / 语气），一键听地道版或立即跟读。
  - **实时连麦模式**：打开麦克风直接与 Gemini Live / OpenAI Realtime 打电话式接话、支持随时打断插话，挂断/每轮结束后台自动异步生成纠错卡片。
- **黑历史错题本（Hall of Shame）+ 鞭尸特训**
  - 持久化记录你反复犯的中式英语，不仅可随时复盘标记已掌握，搭子还会在后续聊天与「💀 黑历史鞭尸特训」模式中主动翻旧账抽考你。
- **内置试玩模式**：无需填写任何 API Key 即可直接输入/语音试玩吐槽纠错流程。

## 本地运行

```bash
npm install
npm run dev
```

启动后访问前端页面：**http://localhost:5188**（后端 API 与 WebSocket 代理在 `http://localhost:3188`）。

生产构建运行：

```bash
npm run build
npm start
```
