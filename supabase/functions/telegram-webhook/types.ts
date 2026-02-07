/**
 * TypeScript Interfaces für telegram-webhook
 */

// Session-Daten aus telegram_sessions Tabelle
export interface Session {
  chat_id: number;
  user_id?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  aktueller_modus?: string | null;
  modus_daten?: ModusDaten;
  aktuelles_bv_id?: string | null;
  pending_fotos?: PendingFoto[];
  last_activity?: string;

  // Kontext für Folge-Eingaben ("noch einer", "nein, im Bad")
  letzte_aktion?: LetzteAktion;

  // Projekt-Memory (letzte 5, neueste zuerst)
  projekt_historie?: ProjektHistorieEintrag[];

  // Erkannte Sprache für Multi-Language
  user_sprache?: UserSprache;

  // Pending Foto (wenn Foto ohne Text gesendet)
  pending_foto?: PendingFotoEinfach;
}

// Letzte Aktion für Kontext-Awareness
export interface LetzteAktion {
  typ: 'mangel' | 'nachtrag' | 'nachweis' | 'status';
  id?: string;           // z.B. "ATBS-456-M12"
  projekt_nr?: string;   // ATBS-456
  timestamp: string;     // ISO Date
}

// Eintrag in der Projekt-Historie
export interface ProjektHistorieEintrag {
  atbs: string;
  name?: string;
  timestamp: string;
}

// Unterstützte Sprachen
export type UserSprache = 'DE' | 'RU' | 'HU' | 'RO' | 'PL';

// Pending Foto (einfach, ohne Media-Group)
export interface PendingFotoEinfach {
  file_id: string;
  timestamp: string;
}

// Modus-spezifische Daten
export interface ModusDaten {
  // Allgemein
  projekt_nr?: string;
  projekt_name?: string;
  projekt_phase?: string;

  // Aufmaß
  space_id?: string;
  atbs_nummer?: string;
  project_name?: string;
  model_id?: string;

  // Bedarfsanalyse
  bedarfsanalyse_id?: string;
  draft_id?: string;
  photo_file_ids?: string[];

  // Mangel
  mangel_fotos?: string[];
  created_maengel?: CreatedMangel[];

  // Nachtrag
  nachtrag_fotos?: string[];
  nachtrag_id?: string;
  nachtrag_nr?: string;

  // Nachweis
  nachweis_typ?: string | null;

  // Abnahme
  abnahme_typ?: string | null;
  abnahme_dokumenttyp?: string | null;
  abnahme_label?: string | null;

  // Multi-Foto-Upload
  pending_media_group_id?: string | null;
  pending_media_group_start?: number | null;

  // Foto zu bestehendem Eintrag hinzufügen
  pending_foto_file_id?: string | null;
  pending_target_typ?: 'nachtrag' | 'mangel' | null;
  pending_target_id?: string | null;
}

// Projekt aus monday_bauprozess
export interface Projekt {
  id: string;
  name?: string;
  atbs_nummer?: string;
  status_projekt?: string;
  auftraggeber?: string;
  adresse?: string;
  column_values?: Record<string, unknown>;

  // NU-Daten (nu_ Präfix)
  nu_firma?: string;
  nu_ansprechpartner?: string;
  nu_telefon?: string;
  nu_email?: string;

  // BL-Daten (bl_ Präfix)
  bl_name?: string;
  bl_email?: string;
  bl_telefon?: string;

  // AG-Daten (ag_ Präfix)
  ag_telefon?: string;

  // Termine
  baustart?: string;
  bauende?: string;
  datum_kundenabnahme?: string;
  budget?: number;

  // Links
  sharepoint_link?: string;
  hero_projekt_id?: string;
}

// Mangel aus maengel_fertigstellung
export interface Mangel {
  id: string;
  projekt_nr: string;
  mangel_id?: string;
  beschreibung_mangel?: string;
  art_des_mangels?: string;
  status_mangel?: string;
  datum_meldung?: string;
  datum_frist?: string;
  erinnerung_status?: string;
  fotos_mangel?: FotoReference[];
}

// Nachtrag aus nachtraege
export interface Nachtrag {
  id: string;
  atbs_nummer: string;
  nachtrag_nr?: string;
  beschreibung?: string;
  status?: string;
  betrag_netto?: number;
  gemeldet_von?: string;
  melder_name?: string;
  foto_urls?: string[];
  created_at?: string;
}

// Nachweis (in fotos Tabelle)
export interface Nachweis {
  id?: string;
  atbs_nummer?: string;
  bauvorhaben_id?: string;
  kategorie: string;
  nachweis_typ?: string;
  datei_url?: string;
  datei_name?: string;
  mime_type?: string;
  quelle?: string;
}

// Pending-Foto für Multi-Upload
export interface PendingFoto {
  file_id: string;
  media_group_id: string;
  received_at: number;
}

// Erstellter Mangel (temporär)
export interface CreatedMangel {
  id: string;
  mangel_id?: string;
  mangel_nr?: string;
  beschreibung?: string;
  gewerk?: string;
}

// Foto-Referenz
export interface FotoReference {
  url: string;
  filename: string;
}

// Kontakt aus kontakte Tabelle
export interface Kontakt {
  id: string;
  vorname?: string;
  nachname?: string;
  rolle?: string;
  email?: string;
  firma?: string;
  telefon_mobil?: string;
  telegram_chat_id?: number;
  telegram_verified?: boolean;
  telegram_enabled?: boolean;
  // Bot-Permissions
  bot_kann_maengel?: boolean;
  bot_kann_nachtraege?: boolean;
  bot_kann_bestellungen?: boolean;
  bot_kann_fotos?: boolean;
  bot_kann_status?: boolean;
}

// Bot-Permissions Interface
export interface BotPermissions {
  bot_kann_maengel: boolean;
  bot_kann_nachtraege: boolean;
  bot_kann_bestellungen: boolean;
  bot_kann_fotos: boolean;
  bot_kann_status: boolean;
}

// Bot-Permission-Keys als Type
export type BotPermissionKey = keyof BotPermissions;

// Telegram Access Check Result
export interface TelegramAccessResult {
  allowed: boolean;
  kontakt?: Kontakt;
  reason?: 'not_found' | 'disabled' | 'phone_mismatch' | 'ok';
}

// Telegram Update
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: CallbackQuery;
  _internal?: string;
  bedarfsanalyse_id?: string;
  chat_id?: number;
}

export interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
    type: string;
  };
  from?: TelegramUser;
  text?: string;
  caption?: string; // Beschriftung für Fotos/Videos/Dokumente
  photo?: TelegramPhoto[];
  voice?: TelegramVoice;
  document?: TelegramDocument;
  media_group_id?: string;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface TelegramPhoto {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface CallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

// Bedarfsanalyse
export interface Bedarfsanalyse {
  id: string;
  auftraggeber?: string;
  pauschal_groesse?: string;
  status?: string;
  ocr_structured?: {
    properties?: Record<string, unknown>;
  };
  telegram_message_id?: string;
}

// Angebots-Draft
export interface AngebotsDraft {
  id: string;
  bedarfsanalyse_id?: string;
  lv_typ?: string;
  status?: string;
  summe_netto?: number;
  summe_brutto?: number;
  odoo_order_id?: string;
  odoo_url?: string;
}

// Angebots-Position
export interface AngebotsPosition {
  id: string;
  draft_id: string;
  position_nr: number;
  lv_position_id?: string;
  checkbox_key?: string;
  menge: number;
  einheit?: string;
  einzelpreis: number;
  gesamtpreis: number;
  confidence?: number;
  needs_review?: boolean;
  review_status?: string;
  notiz?: string;
  lv_positionen?: LvPosition;
}

// LV-Position
export interface LvPosition {
  id: string;
  bezeichnung?: string;
  artikelnummer?: string;
  lv_typ?: string;
  einheit?: string;
  preis?: number;
}

// Aufmaß-Daten
export interface AufmassData {
  id?: string;
  atbs_nummer: string;
  total_netto_m2?: number;
  total_brutto_m2?: number;
  rooms?: AufmassRoom[];
  created_at?: string;
}

export interface AufmassRoom {
  name: string;
  area_netto?: number;
  width?: number;
  length?: number;
}

// Matterport Space
export interface MatterportSpace {
  id: string;
  atbs_nummer?: string;
  project_name?: string;
  address?: string;
  city?: string;
  client_type?: string;
  matterport_model_id?: string;
  direct_link?: string;
}

// Dokument
export interface Dokument {
  id: string;
  atbs_nummer?: string;
  art_des_dokuments?: string;
  dokument_nr?: string;
  datei_url?: string;
  datei_name?: string;
  notizen?: string;
  quelle?: string;
  datum_erstellt?: string;
}

// Gemeldet-Von Ergebnis
export interface GemeldetVonResult {
  gemeldet_von: string;
  melder_name: string;
}

// Parsed Mängel von GPT
export interface ParsedMaengel {
  maengel: Array<{
    beschreibung_de: string;
    gewerk?: string;
  }>;
  detected_language: string;
}

// Favorit-Projekt
export interface ProjektFavorit {
  id: string;
  atbs: string;
  name: string;
}

// File Download Result
export interface FileDownloadResult {
  base64: string;
  mimeType: string;
}

// Gewerk-Kombiniert Config
export interface GewerkKombiniertConfig {
  label: string;
  icon: string;
  statusId: string;
  ausfuehrungId: string;
}

// Ausführungsart-Spalten Config
export interface AusfuehrungsartSpaltenConfig {
  label: string;
  icon: string;
  id: string;
}

// Ausführungs-Status
export interface AusfuehrungStatus {
  emoji: string;
  text: string;
}

// Nachtrag-Position mit LV-Match
export interface NachtragPosition {
  original_text: string;
  beschreibung: string;
  gewerk: string;
  menge: number;
  einheit: string;
  lv_position_id?: string;
  artikelnummer?: string;
  bezeichnung?: string;
  einzelpreis?: number;
  gesamtpreis?: number;
  similarity?: number;
  matched_via?: 'learning' | 'embedding' | 'none' | 'error';  // Wie wurde gematcht?
  matched_lv_typ?: string;  // Aus welchem LV wurde gematcht?
}
