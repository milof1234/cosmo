import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY не настроен на сервере.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '25mb' }));

  app.post('/api/gemini/summarize-voice', async (req, res) => {
    try {
      const { audioUrl, duration } = req.body || {};

      if (!audioUrl || typeof audioUrl !== 'string') {
        res.status(400).json({ error: 'Аудиозапись не найдена для анализа.' });
        return;
      }

      let mimeType = 'audio/webm';
      let base64Data = audioUrl;

      if (audioUrl.startsWith('data:')) {
        const commaIndex = audioUrl.indexOf(',');
        if (commaIndex !== -1) {
          const header = audioUrl.slice(5, commaIndex);
          const semiIndex = header.indexOf(';');
          const extractedMime = semiIndex !== -1 ? header.slice(0, semiIndex) : header;
          if (extractedMime) {
            mimeType = extractedMime;
          }
          base64Data = audioUrl.slice(commaIndex + 1);
        }
      }

      base64Data = base64Data.trim();

      if (!base64Data) {
        res.status(400).json({ error: 'Пустые аудиоданные в голосовом сообщении.' });
        return;
      }

      const audioPart = {
        inlineData: {
          mimeType,
          data: base64Data
        }
      };

      const promptText =
        `Проанализируй это голосовое сообщение${duration ? ` (длительность ~${duration} сек.)` : ''}. ` +
        `Сначала распознай речь, а затем напиши краткую, точную и информативную сводку (резюме) на русском языке (1–3 предложения). ` +
        `Если в аудиозаписи есть конкретные вопросы, задачи или договорённости, выдели их. ` +
        `Если запись слишком короткая, содержит только тишину, фоновый шум или синтетический тестовый сигнал без разборчивой речи, вежливо укажи, что в голосовом сообщении нет разборчивой речи (короткая или тестовая аудиозапись).`;

      const ai = getGenAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
          parts: [audioPart, { text: promptText }]
        }
      });

      const summary = response.text?.trim() || 'Не удалось извлечь текст из голосового сообщения.';
      res.json({ summary });
    } catch (error) {
      console.error('Gemini voice summarize error:', error);
      const message = error instanceof Error ? error.message : 'Ошибка при анализе голосового сообщения через Gemini API.';
      res.status(500).json({
        error: message
      });
    }
  });

  app.post('/api/gemini/voice-assistant', async (req, res) => {
    try {
      const {
        audioUrl,
        textCommand,
        contacts = [],
        groups = [],
        folders = [],
        activeChatTitle = ''
      } = req.body || {};

      if (!audioUrl && !textCommand) {
        res.status(400).json({ error: 'Не передана голосовая запись или текст команды.' });
        return;
      }

      const parts = [];

      if (audioUrl && typeof audioUrl === 'string') {
        let mimeType = 'audio/webm';
        let base64Data = audioUrl;

        if (audioUrl.startsWith('data:')) {
          const commaIndex = audioUrl.indexOf(',');
          if (commaIndex !== -1) {
            const header = audioUrl.slice(5, commaIndex);
            const semiIndex = header.indexOf(';');
            const extractedMime = semiIndex !== -1 ? header.slice(0, semiIndex) : header;
            if (extractedMime) {
              mimeType = extractedMime;
            }
            base64Data = audioUrl.slice(commaIndex + 1);
          }
        }

        base64Data = base64Data.trim();
        if (base64Data) {
          parts.push({
            inlineData: {
              mimeType,
              data: base64Data
            }
          });
        }
      }

      const contactsContext = Array.isArray(contacts)
        ? contacts
            .map((c) => `- ID: "${c.id}", Name: "${c.name}", Username: "@${c.username || ''}"`)
            .join('\n')
        : '';

      const groupsContext = Array.isArray(groups)
        ? groups.map((g) => `- ID: "${g.id}", Group Name: "${g.name}"`).join('\n')
        : '';

      const foldersContext = Array.isArray(folders)
        ? folders.map((f) => `- ID: "${f.id}", Folder Name: "${f.name}"`).join('\n')
        : '';

      const instructionPrompt = `You are the Voice Assistant for CosmoChat messenger.
Your job is to transcribe the user's voice input (if audio is attached) or read the provided text command, and convert it into a structured command to execute in the app.

Available Contacts (Direct Chats):
${contactsContext || '(none)'}

Available Groups:
${groupsContext || '(none)'}

Available Folders:
${foldersContext || '(none)'}

Currently Active Chat: "${activeChatTitle || 'None'}"
${textCommand ? `\nRecognized / Provided Command Text: "${textCommand}"` : ''}

Supported Actions ("action" field):
1. "send_message": User wants to send a message to a contact, a group, or the current active chat (e.g., "Send message to Alex: Hello!", "Отправь сообщение Ивану Привет как дела", "Напиши в чат Привет всем").
   - Match the recipient against Available Contacts or Available Groups (fuzzy match by name or username, including Russian name inflections like "Ивану" -> "Иван", "Марии" -> "Мария").
   - Set "targetId" to the matched contact/group ID if found, "targetName" to the recipient name, "isGroup" to true if it's a group, and "messageText" to the message body to send.
2. "change_theme": User wants to change the chat/app theme, wallpaper, or bubble color (e.g., "Change theme to dark", "Поставь темную тему", "Смени тему на киберпанк", "Change theme to matrix", "Set bubble color to emerald").
   - Set "themePreset" to one of: "dark", "midnight", "cyberpunk", "aurora", "sunset", "ocean", "matrix", "royal", "emerald", "indigo", "rose", "amber", "violet", "sky".
3. "open_chat": User wants to open or switch to a chat with a user or group (e.g., "Open chat with Alex", "Открой чат с Марией").
   - Set "targetId", "targetName", and "isGroup".
4. "create_folder": User wants to create a new chat folder (e.g., "Create folder Work Projects", "Создай папку Учеба").
   - Set "folderName" to the name of the folder.
5. "open_analytics": User wants to view chat statistics/analytics (e.g., "Show analytics", "Открой аналитику чата", "Покажи статистику").
6. "export_chat": User wants to export chat history (e.g., "Export chat to JSON", "Экспортируй чат в txt").
   - Set "exportFormat" to "json" or "txt".
7. "general_reply": Any other question or command, or if the audio is silent/unclear.

Always populate "transcript" with the exact transcribed text of what the user said (or the provided textCommand), and "assistantReply" with a concise, helpful confirmation in Russian (or English if the user spoke English).`;

      parts.push({ text: instructionPrompt });

      const ai = getGenAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transcript: {
                type: Type.STRING,
                description: 'Transcribed text of the voice command.'
              },
              action: {
                type: Type.STRING,
                description:
                  'One of: send_message, change_theme, open_chat, create_folder, open_analytics, export_chat, general_reply'
              },
              targetId: {
                type: Type.STRING,
                description: 'Matched user ID or group ID if applicable, or empty string.'
              },
              targetName: {
                type: Type.STRING,
                description: 'Name of the target user or group if applicable, or empty string.'
              },
              isGroup: {
                type: Type.BOOLEAN,
                description: 'True if the target is a group.'
              },
              messageText: {
                type: Type.STRING,
                description: 'Message text to send when action is send_message.'
              },
              themePreset: {
                type: Type.STRING,
                description:
                  'Theme or color identifier when action is change_theme (e.g., dark, midnight, cyberpunk, aurora, sunset, ocean, matrix, royal, emerald, indigo, rose, amber).'
              },
              folderName: {
                type: Type.STRING,
                description: 'Folder name when action is create_folder.'
              },
              exportFormat: {
                type: Type.STRING,
                description: 'txt or json when action is export_chat.'
              },
              assistantReply: {
                type: Type.STRING,
                description: 'Friendly confirmation message to show to the user.'
              }
            },
            required: ['transcript', 'action', 'assistantReply']
          }
        }
      });

      const rawText = response.text?.trim() || '{}';
      let parsed = {};
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = {
          transcript: textCommand || 'Голосовая команда',
          action: 'general_reply',
          assistantReply: rawText || 'Команда обработана.'
        };
      }

      res.json(parsed);
    } catch (error) {
      console.error('Gemini voice assistant error:', error);
      const message = error instanceof Error ? error.message : 'Ошибка при обработке голосовой команды через Gemini API.';
      res.status(500).json({
        error: message
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.get('/cosmochat.html', (_req, res) => {
      res.sendFile(path.join(__dirname, 'cosmochat.html'));
    });
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
