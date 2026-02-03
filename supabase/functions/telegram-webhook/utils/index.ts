/**
 * Utils Index - Zentrale Exports
 */

// Telegram API
export {
  sendMessage,
  answerCallbackQuery,
  sendDocument,
  editMessageText,
  downloadTelegramFile,
  sendVoice,
} from "./telegram.ts";

// Session Management
export {
  getOrCreateSession,
  updateSession,
  resetSession,
  isSessionActive,
} from "./session.ts";

// Authentifizierung
export {
  getGemeldetVon,
  generateMangelNummer,
  generateNachtragNummer,
  isBauleiter,
  getKontaktByChatId,
  getKontaktByEmail,
  findNuKontakt,
} from "./auth.ts";

// Allgemeine Hilfsfunktionen
export {
  formatDate,
  extractATBS,
  extractProjectName,
  extractPhase,
  extractPhaseNumber,
  extractFieldText,
  extractDate,
  gewerkStatusEmoji,
  extractMondayText,
  getAusfuehrungStatus,
  countCheckboxes,
  normalizeAtbsSearch,
  createMapsUrl,
  getDaysOverdue,
  truncateText,
  padText,
  formatCurrency,
  base64ToUint8Array,
  generateFileId,
} from "./helpers.ts";

// OpenAI
export {
  transcribeVoice,
  parseAndTranslateMaengel,
  chatCompletion,
  analyzeImage,
} from "./openai.ts";

// LV-Matching (für Nachträge)
export {
  getLvTypFromProjekt,
  parseNachtragPositionen,
  matchLvPositionen,
  processNachtragBeschreibung,
} from "./lv_matching.ts";
