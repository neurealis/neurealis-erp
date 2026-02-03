/**
 * Telegram API Utilities
 */
import { TELEGRAM_TOKEN } from "../constants.ts";
import type { FileDownloadResult } from "../types.ts";

/**
 * Sendet eine Nachricht an einen Telegram-Chat
 */
export async function sendMessage(
  chatId: number,
  text: string,
  options?: { reply_markup?: unknown; parse_mode?: string }
): Promise<Response> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: options?.parse_mode || "HTML"
  };
  if (options?.reply_markup) body.reply_markup = options.reply_markup;

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    console.error("Telegram sendMessage error:", await response.text());
  }
  return response;
}

/**
 * Beantwortet einen Callback-Query
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string
): Promise<void> {
  await fetch(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || ""
      }),
    }
  );
}

/**
 * Sendet ein Dokument an einen Telegram-Chat
 */
export async function sendDocument(
  chatId: number,
  fileBuffer: Uint8Array,
  filename: string,
  caption?: string
): Promise<Response> {
  const formData = new FormData();
  formData.append('chat_id', chatId.toString());
  formData.append('document', new Blob([fileBuffer]), filename);
  if (caption) formData.append('caption', caption);
  formData.append('parse_mode', 'HTML');

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    console.error('Telegram sendDocument error:', await response.text());
  }
  return response;
}

/**
 * Bearbeitet eine bestehende Nachricht
 */
export async function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  options?: { reply_markup?: unknown }
): Promise<void> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML"
  };
  if (options?.reply_markup) body.reply_markup = options.reply_markup;

  await fetch(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

/**
 * Lädt eine Datei von Telegram herunter
 */
export async function downloadTelegramFile(
  fileId: string
): Promise<FileDownloadResult | null> {
  try {
    // 1. Hole Datei-Pfad
    const fileResp = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId }),
      }
    );
    const fileData = await fileResp.json();
    const filePath = fileData.result?.file_path;
    if (!filePath) return null;

    // 2. Lade Datei herunter
    const downloadResp = await fetch(
      `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`
    );
    const arrayBuffer = await downloadResp.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // 3. Konvertiere zu Base64
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    // 4. Bestimme MIME-Type
    const mimeType = filePath.endsWith('.png')
      ? 'image/png'
      : filePath.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';

    return { base64, mimeType };
  } catch (e) {
    console.error('Error downloading file:', e);
    return null;
  }
}

/**
 * Sendet eine Sprachnachricht an einen Telegram-Chat
 */
export async function sendVoice(
  chatId: number,
  audioBuffer: Uint8Array,
  filename: string = "audio.ogg"
): Promise<Response> {
  const formData = new FormData();
  formData.append('chat_id', chatId.toString());
  formData.append('voice', new Blob([audioBuffer], { type: 'audio/ogg' }), filename);

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendVoice`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    console.error('Telegram sendVoice error:', await response.text());
  }
  return response;
}
