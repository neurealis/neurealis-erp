import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * audio-briefing-generate v3.0 - Umfassendes Audio-Briefing für Bauleiter
 *
 * v3.0 FIXES:
 * - verify_jwt: false (kann von telegram-webhook aufgerufen werden)
 * - bauleiter_email → bl_email (Spalten-Umbenennung L144)
 *
 * Features:
 * - Gruppierung nach Auftraggeber (VBW, GWS, Privat, etc.)
 * - Pro Baustelle: Status, Mängel, Nachträge
 * - Mängel mit NU-Nachweis (BL muss bestätigen)
 * - Mängel ohne NU-Reaktion
 * - Fehlende Nachweise
 * - Baustellen die diese Woche fertig werden
 * - Offene Angebote / Bedarfsanalysen
 * - Persönliche Erinnerungen
 * - Override: Briefing für Person X an Person Y senden
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const TELEGRAM_TOKEN = Deno.env.get("TELEGRAM_NEUREALIS_BOT")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════

interface Bauleiter {
  email: string;
  name: string;
  vorname: string;
  telegram_chat_id: number;
}

interface Projekt {
  atbs_nummer: string;
  name: string;
  auftraggeber: string;
  adresse: string;
  baustart: string | null;
  bauende: string | null;
  status_projekt: string;
  status_nua: string | null;
  budget: number | null;
  nu_firma: string | null;
}

interface Mangel {
  mangel_nr: string;
  projekt_nr: string;
  art_des_mangels: string;
  beschreibung_mangel: string;
  nachunternehmer: string;
  status_mangel: string;
  datum_frist: string;
  fotos_nachweis_nu: string | null;
  tage_ueberfaellig: number;
}

interface Nachtrag {
  nachtrag_nr: string;
  atbs_nummer: string;
  titel: string;
  status: string;
  betrag_kunde_netto: number | null;
}

interface Termin {
  atbs_nummer: string;
  name: string;
  auftraggeber: string;
  termin_art: string;
  datum: string;
}

interface Erinnerung {
  id: string;
  titel: string;
  faellig_am: string;
}

// ════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

function formatDate(date: Date): string {
  return date.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  } catch {
    return dateStr;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function getWeekBoundaries(): { start: string; end: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split("T")[0],
    end: sunday.toISOString().split("T")[0],
  };
}

function extractAuftraggeber(name: string): string {
  if (!name) return "Sonstige";
  const parts = name.split("|");
  if (parts.length > 0) {
    const ag = parts[0].trim().toUpperCase();
    if (ag.includes("VBW")) return "VBW";
    if (ag.includes("GWS")) return "GWS";
    if (ag.includes("COVIVIO")) return "Covivio";
    if (ag.includes("VONOVIA")) return "Vonovia";
    if (ag.includes("PRIVAT")) return "Privat";
  }
  return "Sonstige";
}

function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

// ════════════════════════════════════════════════════════════════════════════
// DATA LOADING
// ════════════════════════════════════════════════════════════════════════════

async function getBauleiter(email: string): Promise<Bauleiter | null> {
  const { data, error } = await supabase
    .from("kontakte")
    .select("email, vorname, nachname, telegram_chat_id")
    .eq("email", email)
    .not("telegram_chat_id", "is", null)
    .single();

  if (error || !data) {
    console.error("Bauleiter nicht gefunden:", error);
    return null;
  }

  return {
    email: data.email,
    name: `${data.vorname} ${data.nachname}`.trim(),
    vorname: data.vorname || "Bauleiter",
    telegram_chat_id: Number(data.telegram_chat_id),
  };
}

async function getAktiveProjekte(bauleiterEmail: string): Promise<Projekt[]> {
  // FIX v3: bl_email statt bauleiter_email (L144)
  const { data, error } = await supabase
    .from("monday_bauprozess")
    .select("atbs_nummer, name, auftraggeber, adresse, baustart, bauende, status_projekt, status_nua, budget, nu_firma")
    .eq("bl_email", bauleiterEmail)
    .in("status_projekt", ["(2) Angebot", "(3) Vorbereitung", "(4) Umsetzung"])
    .order("name", { ascending: true });

  if (error) {
    console.error("Error loading Projekte:", error);
    return [];
  }
  return data || [];
}

async function getAlleMaengel(bauleiterEmail: string): Promise<Mangel[]> {
  // FIX v3: bl_email statt bauleiter_email (L144)
  const { data: projekte } = await supabase
    .from("monday_bauprozess")
    .select("atbs_nummer")
    .eq("bl_email", bauleiterEmail);

  if (!projekte || projekte.length === 0) return [];

  const atbsNummern = projekte.map((p) => p.atbs_nummer);

  const { data, error } = await supabase
    .from("maengel_fertigstellung")
    .select("mangel_nr, projekt_nr, art_des_mangels, beschreibung_mangel, nachunternehmer, status_mangel, datum_frist, fotos_nachweis_nu")
    .in("projekt_nr", atbsNummern)
    .not("status_mangel", "in", "(Abgenommen,Abgeschlossen,Erledigt,Geschlossen)")
    .order("datum_frist", { ascending: true });

  if (error) {
    console.error("Error loading Mängel:", error);
    return [];
  }

  const today = new Date();
  return (data || []).map((m) => {
    const frist = m.datum_frist ? new Date(m.datum_frist) : null;
    const tageUeberfaellig = frist && frist < today
      ? Math.floor((today.getTime() - frist.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    return { ...m, tage_ueberfaellig: tageUeberfaellig };
  });
}

async function getOffeneNachtraege(bauleiterEmail: string): Promise<Nachtrag[]> {
  // FIX v3: bl_email statt bauleiter_email (L144)
  const { data: projekte } = await supabase
    .from("monday_bauprozess")
    .select("atbs_nummer")
    .eq("bl_email", bauleiterEmail);

  if (!projekte || projekte.length === 0) return [];

  const atbsNummern = projekte.map((p) => p.atbs_nummer);

  const { data, error } = await supabase
    .from("nachtraege")
    .select("nachtrag_nr, atbs_nummer, titel, status, betrag_kunde_netto")
    .in("atbs_nummer", atbsNummern)
    .in("status", ["(0) Offen / Preis eingeben", "(1) In Prüfung", "(2) Genehmigt - nicht beauftragt"]);

  if (error) {
    console.error("Error loading Nachträge:", error);
    return [];
  }
  return data || [];
}

async function getTermine(bauleiterEmail: string, isWeekly: boolean): Promise<Termin[]> {
  const today = getTodayStr();
  const { start: weekStart, end: weekEnd } = getWeekBoundaries();
  const dateStart = isWeekly ? weekStart : today;
  const dateEnd = isWeekly ? weekEnd : today;

  const termine: Termin[] = [];

  // FIX v3: bl_email statt bauleiter_email (L144)
  // Baustart
  const { data: baustart } = await supabase
    .from("monday_bauprozess")
    .select("atbs_nummer, name, auftraggeber, baustart")
    .eq("bl_email", bauleiterEmail)
    .gte("baustart", dateStart)
    .lte("baustart", dateEnd);

  (baustart || []).forEach((p) => {
    if (p.baustart) {
      termine.push({ atbs_nummer: p.atbs_nummer, name: p.name, auftraggeber: p.auftraggeber || "", termin_art: "Baustart", datum: p.baustart });
    }
  });

  // Bauende
  const { data: bauende } = await supabase
    .from("monday_bauprozess")
    .select("atbs_nummer, name, auftraggeber, bauende")
    .eq("bl_email", bauleiterEmail)
    .gte("bauende", dateStart)
    .lte("bauende", dateEnd);

  (bauende || []).forEach((p) => {
    if (p.bauende) {
      termine.push({ atbs_nummer: p.atbs_nummer, name: p.name, auftraggeber: p.auftraggeber || "", termin_art: "Bauende", datum: p.bauende });
    }
  });

  // Kundenabnahme
  const { data: kundenabnahme } = await supabase
    .from("monday_bauprozess")
    .select("atbs_nummer, name, auftraggeber, datum_kundenabnahme")
    .eq("bl_email", bauleiterEmail)
    .gte("datum_kundenabnahme", dateStart)
    .lte("datum_kundenabnahme", dateEnd);

  (kundenabnahme || []).forEach((p) => {
    if (p.datum_kundenabnahme) {
      termine.push({ atbs_nummer: p.atbs_nummer, name: p.name, auftraggeber: p.auftraggeber || "", termin_art: "Kundenabnahme", datum: p.datum_kundenabnahme });
    }
  });

  termine.sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime());
  return termine;
}

async function getErinnerungen(bauleiterEmail: string): Promise<Erinnerung[]> {
  const today = getTodayStr();
  const { end: weekEnd } = getWeekBoundaries();

  const { data, error } = await supabase
    .from("erinnerungen")
    .select("id, titel, faellig_am")
    .eq("erstellt_von", bauleiterEmail)
    .eq("erledigt", false)
    .lte("faellig_am", weekEnd)
    .order("faellig_am", { ascending: true });

  if (error) {
    console.error("Error loading Erinnerungen:", error);
    return [];
  }
  return data || [];
}

async function getFehlendNachweise(bauleiterEmail: string): Promise<{ projekt: string; nachweisTyp: string }[]> {
  // FIX v3: bl_email statt bauleiter_email (L144)
  const { data: projekte } = await supabase
    .from("monday_bauprozess")
    .select("atbs_nummer, name, ausfuehrung_elektrik, ausfuehrung_bad")
    .eq("bl_email", bauleiterEmail)
    .eq("status_projekt", "(4) Umsetzung");

  if (!projekte || projekte.length === 0) return [];

  const fehlend: { projekt: string; nachweisTyp: string }[] = [];

  for (const p of projekte) {
    // Prüfe ob Elektrik-Nachweis fehlt
    if (p.ausfuehrung_elektrik === "Komplett" || p.ausfuehrung_elektrik === "Teil-Modernisierung") {
      const { data: nachweisElekt } = await supabase
        .from("dokumente")
        .select("id")
        .eq("atbs_nummer", p.atbs_nummer)
        .eq("art_des_dokuments", "NACHWEIS-ELEKT")
        .limit(1);

      if (!nachweisElekt || nachweisElekt.length === 0) {
        fehlend.push({ projekt: p.atbs_nummer, nachweisTyp: "Rohinstallation Elektrik" });
      }
    }

    // Prüfe ob Bad-Nachweis fehlt
    if (p.ausfuehrung_bad && p.ausfuehrung_bad.includes("Komplett")) {
      const { data: nachweisAbdicht } = await supabase
        .from("dokumente")
        .select("id")
        .eq("atbs_nummer", p.atbs_nummer)
        .eq("art_des_dokuments", "NACHWEIS-ABDICHT")
        .limit(1);

      if (!nachweisAbdicht || nachweisAbdicht.length === 0) {
        fehlend.push({ projekt: p.atbs_nummer, nachweisTyp: "Abdichtung Bad" });
      }
    }
  }

  return fehlend;
}

// ════════════════════════════════════════════════════════════════════════════
// SKRIPT GENERATION
// ════════════════════════════════════════════════════════════════════════════

function generateUmfassendesBriefing(
  bauleiterName: string,
  projekte: Projekt[],
  maengel: Mangel[],
  nachtraege: Nachtrag[],
  termine: Termin[],
  erinnerungen: Erinnerung[],
  fehlendNachweise: { projekt: string; nachweisTyp: string }[],
  isMonday: boolean
): string {
  const today = new Date();
  const datumText = formatDate(today);
  const wochentag = today.toLocaleDateString("de-DE", { weekday: "long" });

  let skript = "";

  // BEGRÜSSUNG
  if (isMonday) {
    skript += `Guten Morgen ${bauleiterName}! Hier ist dein Wochen-Briefing für ${datumText}. `;
    skript += `Lass uns einen Überblick über deine Baustellen und anstehenden Aufgaben verschaffen.\n\n`;
  } else {
    skript += `Guten Morgen ${bauleiterName}! Hier ist dein Tages-Briefing für ${wochentag}, den ${datumText}.\n\n`;
  }

  // TERMINE
  if (termine.length > 0) {
    skript += isMonday ? `Zuerst zu deinen Terminen diese Woche:\n` : `Deine Termine heute:\n`;
    termine.forEach((t) => {
      skript += `${t.termin_art} bei ${t.atbs_nummer}${isMonday ? ` am ${formatDateShort(t.datum)}` : ""}. `;
    });
    skript += "\n\n";
  }

  // BAUSTELLEN NACH AUFTRAGGEBER
  const aktiveProjekte = projekte.filter((p) =>
    p.status_projekt?.includes("(3)") || p.status_projekt?.includes("(4)")
  );

  const projektNachAG = groupBy(aktiveProjekte, (p) => extractAuftraggeber(p.name));
  const agReihenfolge = ["VBW", "GWS", "Covivio", "Vonovia", "Privat", "Sonstige"];

  skript += `Nun zu deinen ${aktiveProjekte.length} aktiven Baustellen:\n\n`;

  for (const ag of agReihenfolge) {
    const agProjekte = projektNachAG[ag];
    if (!agProjekte || agProjekte.length === 0) continue;

    skript += `Bauvorhaben ${ag}:\n`;

    for (const p of agProjekte) {
      const projektMaengel = maengel.filter((m) => m.projekt_nr === p.atbs_nummer);
      const offeneMaengel = projektMaengel.length;
      const ueberfaelligeMaengel = projektMaengel.filter((m) => m.tage_ueberfaellig > 0).length;
      const projektNachtraege = nachtraege.filter((n) => n.atbs_nummer === p.atbs_nummer);
      const offeneNachtraege = projektNachtraege.length;

      skript += `${p.atbs_nummer}: `;

      if (p.status_projekt?.includes("(4)")) {
        skript += "In Umsetzung. ";
      } else if (p.status_projekt?.includes("(3)")) {
        skript += "In Vorbereitung. ";
      }

      if (p.bauende) {
        const bauendeDate = new Date(p.bauende);
        const { end } = getWeekBoundaries();
        if (bauendeDate <= new Date(end)) {
          skript += `Bauende geplant am ${formatDateShort(p.bauende)}. `;
        }
      }

      if (offeneMaengel > 0) {
        skript += `${offeneMaengel} offene Mängel`;
        if (ueberfaelligeMaengel > 0) {
          skript += `, davon ${ueberfaelligeMaengel} überfällig`;
        }
        skript += ". ";
      }

      if (offeneNachtraege > 0) {
        skript += `${offeneNachtraege} offene Nachträge. `;
      }

      skript += "\n";
    }
    skript += "\n";
  }

  // MÄNGEL MIT NU-NACHWEIS (BL MUSS BESTÄTIGEN)
  const maengelMitNachweis = maengel.filter((m) => m.fotos_nachweis_nu && m.fotos_nachweis_nu.length > 0);
  if (maengelMitNachweis.length > 0) {
    skript += `Achtung: ${maengelMitNachweis.length} Mängel warten auf deine Bestätigung. Der Nachunternehmer hat bereits Nachweise hochgeladen:\n`;
    maengelMitNachweis.slice(0, 5).forEach((m) => {
      skript += `${m.projekt_nr}: ${m.art_des_mangels || "Mangel"}. `;
    });
    skript += "\n\n";
  }

  // ÜBERFÄLLIGE MÄNGEL OHNE NU-REAKTION
  const maengelOhneNachweis = maengel.filter((m) => m.tage_ueberfaellig > 0 && (!m.fotos_nachweis_nu || m.fotos_nachweis_nu.length === 0));
  if (maengelOhneNachweis.length > 0) {
    skript += `${maengelOhneNachweis.length} überfällige Mängel ohne Reaktion vom Nachunternehmer:\n`;
    maengelOhneNachweis.slice(0, 5).forEach((m) => {
      skript += `${m.projekt_nr}: ${m.art_des_mangels || "Mangel"}, ${m.tage_ueberfaellig} Tage überfällig. `;
    });
    skript += "\n\n";
  }

  // FEHLENDE NACHWEISE
  if (fehlendNachweise.length > 0) {
    skript += `Bei ${fehlendNachweise.length} Projekten fehlen noch Nachweise:\n`;
    const gruppiert = groupBy(fehlendNachweise, (f) => f.projekt);
    Object.entries(gruppiert).slice(0, 5).forEach(([projekt, nachweise]) => {
      const typen = nachweise.map((n) => n.nachweisTyp).join(", ");
      skript += `${projekt}: ${typen}. `;
    });
    skript += "\n\n";
  }

  // OFFENE NACHTRÄGE GESAMT
  if (nachtraege.length > 0) {
    skript += `Insgesamt hast du ${nachtraege.length} offene Nachträge.\n\n`;
  }

  // PROJEKTE IN PHASE 2 OHNE NUA
  const ohneNUA = projekte.filter((p) =>
    p.status_projekt?.includes("(2)") && (!p.status_nua || p.status_nua === "" || p.status_nua === "Offen")
  );
  if (ohneNUA.length > 0) {
    skript += `Bei ${ohneNUA.length} Projekten in Phase 2 fehlt noch die Nachunternehmer-Vergabe: `;
    ohneNUA.slice(0, 3).forEach((p) => {
      skript += `${p.atbs_nummer}, `;
    });
    skript = skript.replace(/, $/, ". ");
    skript += "\n\n";
  }

  // ERINNERUNGEN
  if (erinnerungen.length > 0) {
    skript += `Du hast ${erinnerungen.length} persönliche Erinnerungen:\n`;
    erinnerungen.slice(0, 3).forEach((e) => {
      skript += `${e.titel}, fällig am ${formatDateShort(e.faellig_am)}. `;
    });
    skript += "\n\n";
  }

  // ABSCHLUSS
  if (isMonday) {
    skript += `Das war dein Wochen-Briefing. Einen produktiven Start in die Woche!`;
  } else {
    skript += `Das war dein Tages-Briefing. Viel Erfolg heute!`;
  }

  return skript.trim();
}

// ════════════════════════════════════════════════════════════════════════════
// OPENAI TTS
// ════════════════════════════════════════════════════════════════════════════

async function generateAudio(skript: string): Promise<ArrayBuffer> {
  console.log(`Generating audio for ${skript.length} characters...`);

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1-hd",
      voice: "nova",
      input: skript,
      response_format: "mp3",
      speed: 0.75,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI TTS API error: ${response.status} - ${errorText}`);
  }

  return await response.arrayBuffer();
}

// ════════════════════════════════════════════════════════════════════════════
// STORAGE & TELEGRAM
// ════════════════════════════════════════════════════════════════════════════

async function uploadToStorage(email: string, dateStr: string, audioBuffer: ArrayBuffer): Promise<string> {
  const filename = `briefings/${email}/${dateStr}_briefing.mp3`;

  await supabase.storage.from("audio").upload(filename, audioBuffer, {
    contentType: "audio/mpeg",
    upsert: true,
  });

  const { data: urlData } = supabase.storage.from("audio").getPublicUrl(filename);
  return urlData.publicUrl;
}

async function sendTelegramAudio(
  chatId: number,
  audioBuffer: ArrayBuffer,
  caption: string,
  title: string
): Promise<number | null> {
  const formData = new FormData();
  formData.append("chat_id", chatId.toString());
  formData.append("audio", new Blob([audioBuffer], { type: "audio/mpeg" }), "briefing.mp3");
  formData.append("caption", caption.substring(0, 1024));
  formData.append("title", title);
  formData.append("performer", "neurealis ERP");
  formData.append("parse_mode", "HTML");

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendAudio`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    console.error("Telegram error:", await response.text());
    return null;
  }

  const result = await response.json();
  return result.result?.message_id || null;
}

async function trackBriefing(
  email: string,
  dateStr: string,
  isMonday: boolean,
  audioUrl: string,
  wordCount: number,
  messageId: number | null,
  skript: string
): Promise<void> {
  await supabase.from("audio_briefings").upsert(
    {
      bauleiter_email: email,
      briefing_date: dateStr,
      is_monday: isMonday,
      audio_url: audioUrl,
      word_count: wordCount,
      generated_at: new Date().toISOString(),
      sent_at: messageId ? new Date().toISOString() : null,
      telegram_message_id: messageId,
      skript: skript,
    },
    { onConflict: "bauleiter_email,briefing_date" }
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ════════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const bauleiterEmail: string = body.bauleiter_email || "dirk.jansen@neurealis.de";
    const sendToEmail: string = body.send_to_email || bauleiterEmail;
    const force: boolean = body.force === true;
    const forceMonday: boolean = body.force_monday === true;

    console.log(`audio-briefing-generate v3: bauleiter=${bauleiterEmail}, sendTo=${sendToEmail}, force=${force}, forceMonday=${forceMonday}`);

    const dateStr = getTodayStr();
    const isMonday = forceMonday || new Date().getDay() === 1;

    // Bauleiter-Daten laden
    const bauleiter = await getBauleiter(bauleiterEmail);
    if (!bauleiter) {
      console.log(`Bauleiter ${bauleiterEmail} nicht in kontakte, nutze Fallback`);
    }
    const bauleiterName = bauleiter?.vorname || bauleiterEmail.split("@")[0].split(".")[0];

    // Empfänger ermitteln
    const sendTo = await getBauleiter(sendToEmail);
    if (!sendTo) {
      return new Response(
        JSON.stringify({ success: false, error: `Empfänger ${sendToEmail} nicht gefunden oder ohne Telegram` }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Alle Daten parallel laden
    const [projekte, maengel, nachtraege, termine, erinnerungen, fehlendNachweise] = await Promise.all([
      getAktiveProjekte(bauleiterEmail),
      getAlleMaengel(bauleiterEmail),
      getOffeneNachtraege(bauleiterEmail),
      getTermine(bauleiterEmail, isMonday),
      getErinnerungen(bauleiterEmail),
      getFehlendNachweise(bauleiterEmail),
    ]);

    console.log(`Daten geladen: ${projekte.length} Projekte, ${maengel.length} Mängel, ${nachtraege.length} Nachträge`);

    // Skript generieren
    const skript = generateUmfassendesBriefing(
      bauleiterName,
      projekte,
      maengel,
      nachtraege,
      termine,
      erinnerungen,
      fehlendNachweise,
      isMonday
    );

    const wordCount = skript.split(/\s+/).length;
    console.log(`Skript generiert: ${wordCount} Wörter`);

    // Audio generieren
    const audioBuffer = await generateAudio(skript);
    console.log(`Audio generiert: ${audioBuffer.byteLength} bytes`);

    // Upload
    const audioUrl = await uploadToStorage(bauleiterEmail, dateStr, audioBuffer);

    // Caption
    const aktiveProjekte = projekte.filter((p) => p.status_projekt?.includes("(3)") || p.status_projekt?.includes("(4)"));
    const caption = [
      `<b>${isMonday ? "Wochen" : "Tages"}-Briefing für ${bauleiterName}</b>`,
      `📅 ${dateStr}`,
      `🏗️ ${aktiveProjekte.length} Baustellen | ⚠️ ${maengel.length} Mängel | 📋 ${nachtraege.length} Nachträge`,
    ].join("\n");

    // An Telegram senden
    const messageId = await sendTelegramAudio(
      sendTo.telegram_chat_id,
      audioBuffer,
      caption,
      `${isMonday ? "Wochen" : "Tages"}-Briefing ${bauleiterName}`
    );

    // Tracking
    await trackBriefing(bauleiterEmail, dateStr, isMonday, audioUrl, wordCount, messageId, skript);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Briefing für ${bauleiterName} generiert und an ${sendTo.name} gesendet`,
        word_count: wordCount,
        telegram_message_id: messageId,
        skript_preview: skript.substring(0, 500) + "...",
      }),
      { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
