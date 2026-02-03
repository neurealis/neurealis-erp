/**
 * Start & Menu Handlers
 * Hauptmenü, Baustellen-Auswahl, Projekt-Navigation
 */

import { sendMessage, answerCallbackQuery } from '../utils/telegram.ts';
import { getOrCreateSession, updateSession } from '../utils/session.ts';
import { supabase, SUPABASE_URL, SUPABASE_KEY } from '../constants.ts';
import { formatPhoneLink } from '../utils/helpers.ts';

// Phase-Labels für die Anzeige
const PHASE_LABELS: Record<number, string> = {
  0: '(0) Bedarfsanalyse',
  1: '(1) Angebotsphase',
  2: '(2) Auftrag erhalten',
  3: '(3) Vorbereitung',
  4: '(4) Umsetzung',
  5: '(5) Rechnungsstellung',
  7: '(7) Abgeschlossen',
  9: '(9) Nicht erhalten'
};

// ============================================
// Helper: Datum formatieren
// ============================================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ============================================
// Tages-Dashboard für Bauleiter
// ============================================

export async function getBauleiterDashboard(chatId: number): Promise<string | null> {
  try {
    // Prüfe ob der User ein Bauleiter ist
    const { data: kontakt } = await supabase
      .from('kontakte')
      .select('vorname, nachname, rolle')
      .eq('telegram_chat_id', chatId)
      .single();

    // Nur für Bauleiter (BL) oder Holger Neumann Dashboard zeigen
    const isBauleiter = kontakt?.rolle?.toUpperCase() === 'BL' ||
      (kontakt?.vorname?.toLowerCase() === 'holger' && kontakt?.nachname?.toLowerCase() === 'neumann');

    if (!isBauleiter) return null;

    // Überfällige Mängel abfragen
    const { data: ueberfaelligeMaengel, count: mangelCount } = await supabase
      .from('maengel_fertigstellung')
      .select('id, projekt_nr, beschreibung_mangel, datum_frist', { count: 'exact' })
      .lt('datum_frist', new Date().toISOString().split('T')[0])
      .not('status_mangel', 'in', '(Abgenommen,Abgeschlossen,Erledigt,Geschlossen)')
      .order('datum_frist', { ascending: true })
      .limit(3);

    // Offene Nachträge abfragen
    const { data: offeneNachtraege, count: nachtragCount } = await supabase
      .from('nachtraege')
      .select('id, atbs_nummer, beschreibung, betrag_netto', { count: 'exact' })
      .in('status', ['Gemeldet', 'In Prüfung']);

    // Summe der offenen Nachträge
    const summaNetto = (offeneNachtraege || []).reduce((sum, n) => sum + (Number(n.betrag_netto) || 0), 0);

    // Dashboard-Text erstellen
    let dashboard = `<b>📊 Tages-Dashboard</b>\n`;
    dashboard += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Überfällige Mängel
    dashboard += `<b>⚠️ Überfällige Mängel: ${mangelCount || 0}</b>\n`;
    if (ueberfaelligeMaengel && ueberfaelligeMaengel.length > 0) {
      for (const m of ueberfaelligeMaengel) {
        const frist = new Date(m.datum_frist);
        const heute = new Date();
        const tageUeberfaellig = Math.floor((heute.getTime() - frist.getTime()) / (1000 * 60 * 60 * 24));
        const beschreibung = (m.beschreibung_mangel || '').substring(0, 30);
        dashboard += `  • ${m.projekt_nr}: ${beschreibung}${beschreibung.length >= 30 ? '...' : ''}\n`;
        dashboard += `    <i>(${tageUeberfaellig} Tage überfällig)</i>\n`;
      }
      if ((mangelCount || 0) > 3) {
        dashboard += `  <i>... und ${(mangelCount || 0) - 3} weitere</i>\n`;
      }
    } else {
      dashboard += `  <i>Keine überfälligen Mängel 🎉</i>\n`;
    }

    dashboard += `\n`;

    // Offene Nachträge
    dashboard += `<b>📋 Offene Nachträge: ${nachtragCount || 0}</b>\n`;
    if (summaNetto > 0) {
      dashboard += `  Summe netto: <b>${summaNetto.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</b>\n`;
    } else {
      dashboard += `  <i>Keine offenen Nachträge</i>\n`;
    }

    dashboard += `\n━━━━━━━━━━━━━━━━━━━━\n`;

    return dashboard;
  } catch (e) {
    console.error('Dashboard error:', e);
    return null;
  }
}

// ============================================
// Projekt-Favoriten (Top 3 aktive Projekte)
// ============================================

export async function getProjektFavoriten(): Promise<Array<{id: string, atbs: string, name: string}>> {
  try {
    // Letzte Aktivität basierend auf neuesten Mängeln und Nachträgen
    const { data: maengelProjekte } = await supabase
      .from('maengel_fertigstellung')
      .select('projekt_nr')
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: nachtragProjekte } = await supabase
      .from('nachtraege')
      .select('atbs_nummer')
      .order('created_at', { ascending: false })
      .limit(10);

    // Sammle einzigartige ATBS-Nummern nach Aktivität
    const aktiveProjekte = new Map<string, number>();

    (maengelProjekte || []).forEach((m, idx) => {
      const atbs = m.projekt_nr;
      if (atbs && !aktiveProjekte.has(atbs)) {
        aktiveProjekte.set(atbs, idx);
      }
    });

    (nachtragProjekte || []).forEach((n, idx) => {
      const atbs = n.atbs_nummer;
      if (atbs) {
        const existing = aktiveProjekte.get(atbs);
        if (existing === undefined || idx < existing) {
          aktiveProjekte.set(atbs, idx);
        }
      }
    });

    // Sortiere nach Aktivität und nimm Top 3
    const sortedAtbs = Array.from(aktiveProjekte.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(0, 5)
      .map(([atbs]) => atbs);

    if (sortedAtbs.length === 0) return [];

    // Hole Projekt-Details aus monday_bauprozess
    const { data: projekte } = await supabase
      .from('monday_bauprozess')
      .select('id, atbs_nummer, name, status_projekt')
      .in('atbs_nummer', sortedAtbs)
      .or('status_projekt.like.(3)%,status_projekt.like.(4)%');

    if (!projekte || projekte.length === 0) return [];

    // Sortiere nach Original-Aktivitätsreihenfolge und nimm Top 3
    const result = projekte
      .sort((a, b) => {
        const idxA = sortedAtbs.indexOf(a.atbs_nummer || '');
        const idxB = sortedAtbs.indexOf(b.atbs_nummer || '');
        return idxA - idxB;
      })
      .slice(0, 3)
      .map(p => ({
        id: p.id,
        atbs: p.atbs_nummer || p.id.substring(0, 8),
        name: p.name || ''
      }));

    return result;
  } catch (e) {
    console.error('Favoriten error:', e);
    return [];
  }
}

// ============================================
// handleStart - Hauptmenü
// ============================================

export async function handleStart(chatId: number, session: any) {
  const name = session?.first_name || "Benutzer";
  await updateSession(chatId, { aktueller_modus: null, modus_daten: {}, aktuelles_bv_id: null });

  // Tages-Dashboard für Bauleiter
  const dashboard = await getBauleiterDashboard(chatId);

  // Projekt-Favoriten laden
  const favoriten = await getProjektFavoriten();

  // Basis-Buttons
  const buttons: any[][] = [];

  // Favoriten als Top-Buttons (wenn vorhanden)
  if (favoriten.length > 0) {
    buttons.push([{ text: "⭐ Letzte Projekte:", callback_data: "noop" }]);
    for (const fav of favoriten) {
      const displayName = fav.name ? `${fav.atbs}: ${fav.name.substring(0, 25)}` : fav.atbs;
      buttons.push([{ text: `  ${displayName}`, callback_data: `bau:open:${fav.id}` }]);
    }
  }

  // Standard-Menü-Buttons (Reihenfolge optimiert für Bauleiter)
  buttons.push([{ text: "🔍 ATBS direkt eingeben", callback_data: "mode_atbs_direkt" }]);
  buttons.push([{ text: "🏗️ Baustelle öffnen", callback_data: "mode_baustelle" }]);
  buttons.push([{ text: "📊 Aufmaß erstellen/ansehen", callback_data: "mode_aufmass" }]);

  // Audio-Briefing Button (nur für Bauleiter - wenn Dashboard angezeigt wird)
  if (dashboard) {
    buttons.push([{ text: "🎙️ Audio-Briefing abrufen", callback_data: "briefing:generate" }]);
  }

  // Bedarfsanalyse ans Ende (seltener genutzt)
  buttons.push([{ text: "📝 Bedarfsanalyse → Angebot", callback_data: "mode_bedarfsanalyse" }]);

  // Nachricht zusammenbauen
  let messageText = `<b>Willkommen beim neurealis Bot!</b>\n\n`;
  messageText += `Hallo ${name}!\n\n`;

  if (dashboard) {
    messageText += dashboard + `\n`;
  }

  messageText += `Was möchtest du tun?`;

  await sendMessage(chatId, messageText, { reply_markup: { inline_keyboard: buttons } });
}

// ============================================
// showBaustellenMenu - Baustellen-Menü
// ============================================

export async function showBaustellenMenu(chatId: number, session: any) {
  const bvId = session?.aktuelles_bv_id;
  const projektNr = session?.modus_daten?.projekt_nr;
  const projektName = session?.modus_daten?.projekt_name;

  if (bvId && projektNr) {
    await sendMessage(chatId,
      `<b>🏗️ Baustelle: ${projektNr}</b>\n` +
      `${projektName || ''}\n\n` +
      `Was möchtest du tun?`,
      { reply_markup: { inline_keyboard: [
        [{ text: "🔧 Mangel melden", callback_data: "bau:mangel" }],
        [{ text: "📋 Nachtrag erfassen", callback_data: "bau:nachtrag" }],
        [{ text: "📸 Nachweis hochladen", callback_data: "bau:nachweis" }],
        [{ text: "📝 Bericht erstellen", callback_data: "bau:bericht" }],
        [{ text: "📄 Abnahmeprotokoll", callback_data: "bau:abnahme" }],
        [{ text: "📊 Status & Gewerke", callback_data: "bau:status" }],
        [{ text: "❌ Projekt schließen", callback_data: "bau:close" }],
        [{ text: "⬅️ Hauptmenü", callback_data: "main_menu" }]
      ] } }
    );
  } else {
    // Auswahl-Methode anzeigen
    await updateSession(chatId, { aktueller_modus: 'baustelle_auswahl', modus_daten: {} });
    await sendMessage(chatId,
      `<b>🏗️ Baustelle öffnen</b>\n\n` +
      `Wie möchtest du ein Projekt finden?`,
      { reply_markup: { inline_keyboard: [
        [{ text: "📁 Nach Phase filtern", callback_data: "bau:select_method:phase" }],
        [{ text: "🔍 ATBS-Nummer eingeben", callback_data: "bau:select_method:atbs" }],
        [{ text: "📋 Alle aktiven Projekte", callback_data: "bau:list" }],
        [{ text: "⬅️ Hauptmenü", callback_data: "main_menu" }]
      ] } }
    );
  }
}

// ============================================
// showPhaseSelection - Phasen-Auswahl
// ============================================

export async function showPhaseSelection(chatId: number) {
  await updateSession(chatId, { aktueller_modus: 'baustelle_phase_wahl', modus_daten: {} });
  await sendMessage(chatId,
    `<b>📁 Phase auswählen</b>\n\n` +
    `Welche Phase möchtest du filtern?`,
    { reply_markup: { inline_keyboard: [
      [{ text: "🔍 (0) Bedarfsanalyse", callback_data: "phase:0" }],
      [{ text: "📝 (1) Angebotsphase", callback_data: "phase:1" }],
      [{ text: "✅ (2) Auftrag erhalten", callback_data: "phase:2" }],
      [{ text: "🔧 (3) Vorbereitung", callback_data: "phase:3" }],
      [{ text: "🏗️ (4) Umsetzung", callback_data: "phase:4" }],
      [{ text: "💰 (5) Rechnungsstellung", callback_data: "phase:5" }],
      [{ text: "🏁 (7) Abgeschlossen", callback_data: "phase:7" }],
      [{ text: "❌ (9) Nicht erhalten", callback_data: "phase:9" }],
      [{ text: "⬅️ Zurück", callback_data: "mode_baustelle" }]
    ] } }
  );
}

// ============================================
// listProjekteByPhase - Projekte nach Phase filtern
// ============================================

export async function listProjekteByPhase(chatId: number, phaseNumber: number, page: number = 0) {
  const PAGE_SIZE = 15;
  const phaseLabel = PHASE_LABELS[phaseNumber] || `(${phaseNumber})`;

  // Direkt in DB filtern mit LIKE auf Phase-Nummer
  const { data: projekte, error, count } = await supabase
    .from('monday_bauprozess')
    .select('id, name, atbs_nummer, status_projekt, auftraggeber, adresse', { count: 'exact' })
    .like('status_projekt', `(${phaseNumber})%`)
    .order('updated_at', { ascending: false });

  if (error || !projekte || projekte.length === 0) {
    await sendMessage(chatId,
      `Keine Projekte in Phase ${phaseLabel} gefunden.`,
      { reply_markup: { inline_keyboard: [
        [{ text: "⬅️ Andere Phase wählen", callback_data: "bau:select_method:phase" }],
        [{ text: "⬅️ Hauptmenü", callback_data: "main_menu" }]
      ] } }
    );
    return;
  }

  // Pagination
  const totalPages = Math.ceil(projekte.length / PAGE_SIZE);
  const startIdx = page * PAGE_SIZE;
  const pageItems = projekte.slice(startIdx, startIdx + PAGE_SIZE);

  const buttons: any[][] = pageItems.map(p => {
    const atbs = p.atbs_nummer || p.id.substring(0, 8);
    const name = p.name || p.adresse || '';
    return [{ text: `${atbs}: ${name}`, callback_data: `bau:open:${p.id}` }];
  });

  // Pagination-Buttons
  const navButtons: any[] = [];
  if (page > 0) {
    navButtons.push({ text: "⬅️ Zurück", callback_data: `phase:${phaseNumber}:${page - 1}` });
  }
  if (page < totalPages - 1) {
    navButtons.push({ text: "Weiter ➡️", callback_data: `phase:${phaseNumber}:${page + 1}` });
  }
  if (navButtons.length > 0) {
    buttons.push(navButtons);
  }

  buttons.push([{ text: "📁 Andere Phase", callback_data: "bau:select_method:phase" }]);
  buttons.push([{ text: "⬅️ Hauptmenü", callback_data: "main_menu" }]);

  const pageInfo = totalPages > 1 ? ` (Seite ${page + 1}/${totalPages})` : '';
  await sendMessage(chatId,
    `<b>${phaseLabel}</b>\n` +
    `${projekte.length} Projekte${pageInfo}:`,
    { reply_markup: { inline_keyboard: buttons } }
  );
}

// ============================================
// startAtbsDirectInput - ATBS-Schnellzugriff Modus
// ============================================

export async function startAtbsDirectInput(chatId: number) {
  await updateSession(chatId, { aktueller_modus: 'atbs_direkt', modus_daten: {} });
  await sendMessage(chatId,
    `<b>🔍 ATBS direkt eingeben</b>\n\n` +
    `Gib die ATBS-Nummer ein (z.B. ATBS-448 oder nur 448):`,
    { reply_markup: { inline_keyboard: [
      [{ text: "⬅️ Hauptmenü", callback_data: "main_menu" }]
    ] } }
  );
}

// ============================================
// listActiveProjekte - Alle aktiven Projekte
// ============================================

export async function listActiveProjekte(chatId: number, page: number = 0) {
  const PAGE_SIZE = 15;

  // Aktive Phasen: (2) Auftrag, (3) Vorbereitung, (4) Umsetzung
  const { data: projekte, error } = await supabase
    .from('monday_bauprozess')
    .select('id, name, atbs_nummer, status_projekt, adresse')
    .or('status_projekt.like.(2)%,status_projekt.like.(3)%,status_projekt.like.(4)%')
    .order('updated_at', { ascending: false });

  if (error || !projekte || projekte.length === 0) {
    await sendMessage(chatId, 'Keine aktiven Baustellen gefunden.');
    return;
  }

  // Pagination
  const totalPages = Math.ceil(projekte.length / PAGE_SIZE);
  const startIdx = page * PAGE_SIZE;
  const pageItems = projekte.slice(startIdx, startIdx + PAGE_SIZE);

  const buttons: any[][] = pageItems.map(p => {
    const atbs = p.atbs_nummer || p.id.substring(0, 8);
    const name = p.name || p.adresse || '';
    return [{ text: `${atbs}: ${name}`, callback_data: `bau:open:${p.id}` }];
  });

  // Pagination-Buttons
  const navButtons: any[] = [];
  if (page > 0) {
    navButtons.push({ text: "⬅️ Zurück", callback_data: `bau:list:${page - 1}` });
  }
  if (page < totalPages - 1) {
    navButtons.push({ text: "Weiter ➡️", callback_data: `bau:list:${page + 1}` });
  }
  if (navButtons.length > 0) {
    buttons.push(navButtons);
  }

  buttons.push([{ text: "📁 Nach Phase filtern", callback_data: "bau:select_method:phase" }]);
  buttons.push([{ text: "⬅️ Hauptmenü", callback_data: "main_menu" }]);

  const pageInfo = totalPages > 1 ? ` (Seite ${page + 1}/${totalPages})` : '';
  await sendMessage(chatId,
    `<b>Aktive Baustellen (${projekte.length})${pageInfo}:</b>`,
    { reply_markup: { inline_keyboard: buttons } }
  );
}

// ============================================
// findProjektFuzzy - Fuzzy-Suche für One-Shot Commands
// ============================================

/**
 * Sucht Projekt nach ATBS, Name oder Adresse (Fuzzy)
 * Gibt gefundenes Projekt oder mehrere Treffer zurück
 */
export async function findProjektFuzzy(searchTerm: string): Promise<{
  found: boolean;
  projekt?: any;
  multiple?: any[];
}> {
  // 1. Exakte ATBS-Suche (448, ATBS-448, ATBS 448)
  const atbsMatch = searchTerm.match(/(?:ATBS[- ]?)?(\d{3,4})/i);
  if (atbsMatch) {
    const atbs = `ATBS-${atbsMatch[1]}`;
    const { data } = await supabase
      .from('monday_bauprozess')
      .select('*')
      .eq('atbs_nummer', atbs)
      .single();

    if (data) {
      console.log(`[findProjektFuzzy] Exakter ATBS-Match: ${atbs}`);
      return { found: true, projekt: data };
    }
  }

  // 2. Fuzzy-Suche in Name und Adresse
  const cleanSearch = searchTerm.replace(/[^\wäöüßÄÖÜ\s-]/gi, '').trim();
  if (!cleanSearch || cleanSearch.length < 2) {
    return { found: false };
  }

  const { data: results } = await supabase
    .from('monday_bauprozess')
    .select('*')
    .or(`name.ilike.%${cleanSearch}%,adresse.ilike.%${cleanSearch}%,projektname_komplett.ilike.%${cleanSearch}%`)
    .limit(5);

  if (!results || results.length === 0) {
    console.log(`[findProjektFuzzy] Keine Treffer für: ${cleanSearch}`);
    return { found: false };
  }

  if (results.length === 1) {
    console.log(`[findProjektFuzzy] Einzeltreffer: ${results[0].atbs_nummer}`);
    return { found: true, projekt: results[0] };
  }

  // Mehrere Treffer - User muss wählen
  console.log(`[findProjektFuzzy] Mehrere Treffer (${results.length}) für: ${cleanSearch}`);
  return { found: false, multiple: results };
}

// ============================================
// searchAndOpenProjekt - Projekt suchen und öffnen
// ============================================

export async function searchAndOpenProjekt(chatId: number, searchTerm: string) {
  // Normalisiere Suchbegriff: "448", "ATBS-448", "ATBS 448" -> "ATBS-448"
  let term = searchTerm.trim().toUpperCase();
  term = term.replace(/^ATBS[- ]?/i, '');
  const atbsSearch = `ATBS-${term}`;

  // Direkt in DB suchen nach ATBS oder Name
  // NEU v3: kunde_vorname, kunde_nachname, kunde_typ statt falsch gemappte Felder
  const { data: matches } = await supabase
    .from('monday_bauprozess')
    .select('id, name, atbs_nummer, status_projekt, auftraggeber, adresse, bl_name, nu_firma, nu_ansprechpartner, nu_telefon, nu_email, ag_name, ag_email, ag_telefon, datum_kundenabnahme, budget, baustart, bauende, bl_email, bl_telefon, sharepoint_link, hero_projekt_id, kunde_vorname, kunde_nachname, kunde_typ')
    .or(`atbs_nummer.ilike.%${term}%,name.ilike.%${term}%`)
    .limit(20);

  if (!matches || matches.length === 0) {
    await sendMessage(chatId,
      `Kein Projekt gefunden für "${searchTerm}".\n\nVersuche eine ATBS-Nummer (z.B. ATBS-448 oder 448).`,
      { reply_markup: { inline_keyboard: [
        [{ text: "🔍 Nochmal suchen", callback_data: "bau:select_method:atbs" }],
        [{ text: "⬅️ Hauptmenü", callback_data: "main_menu" }]
      ] } }
    );
    return;
  }

  if (matches.length === 1) {
    await openProjekt(chatId, matches[0]);
  } else {
    const buttons = matches.slice(0, 15).map(p => {
      const atbs = p.atbs_nummer || p.id.substring(0, 8);
      const name = p.name || p.adresse || '';
      return [{ text: `${atbs}: ${name}`, callback_data: `bau:open:${p.id}` }];
    });
    buttons.push([{ text: "⬅️ Abbrechen", callback_data: "mode_baustelle" }]);

    await sendMessage(chatId,
      `<b>${matches.length} Projekte gefunden:</b>`,
      { reply_markup: { inline_keyboard: buttons } }
    );
  }
}

// ============================================
// openProjekt - Projekt öffnen und Details anzeigen
// ============================================

export async function openProjekt(chatId: number, projekt: any) {
  const atbs = projekt.atbs_nummer || projekt.id.substring(0, 8);
  const projektName = projekt.name || projekt.adresse || '';
  const phase = projekt.status_projekt || '?';
  const nuFirma = projekt.nu_firma || '-';
  const nuAnsprechpartner = projekt.nu_ansprechpartner || '';
  const nuTelefon = projekt.nu_telefon || '';
  const nuEmail = projekt.nu_email || '';
  const auftraggeber = (projekt.auftraggeber || '-').toLowerCase();
  const telefonKunde = projekt.ag_telefon || '';
  const bvStart = projekt.baustart ? formatDate(projekt.baustart) : '-';
  const bvEndeNuPlan = projekt.bauende ? formatDate(projekt.bauende) : '-';
  const bvEndeKunde = projekt.datum_kundenabnahme ? formatDate(projekt.datum_kundenabnahme) : '-';
  const adresse = projekt.adresse || '';

  // Erstelle Google Maps Link aus der Adresse
  const adresseClean = adresse.split('|')[0]?.trim() || adresse;
  const mapsUrl = adresseClean ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresseClean)}` : '';

  // NEU v3: Kundenname aus den korrigierten Feldern
  // Priorität: kunde_vorname + kunde_nachname > ag_name (falls keine Anrede)
  const kundeVorname = projekt.kunde_vorname || '';
  const kundeNachname = projekt.kunde_nachname || '';
  const kundeAnrede = projekt.ag_name || ''; // ag_name enthält nur Anrede (Herr/Frau)

  // Baue Kundennamen zusammen
  let kundeNameFull = '';
  if (kundeVorname || kundeNachname) {
    // Neue Felder vorhanden - nutzen
    kundeNameFull = `${kundeVorname} ${kundeNachname}`.trim();
  } else if (kundeAnrede && !['herr', 'frau', 'hr', 'fr'].includes(kundeAnrede.toLowerCase().trim())) {
    // ag_name enthält echten Namen (Fallback für alte Daten)
    kundeNameFull = kundeAnrede;
  }

  const telefonKundeLink = formatPhoneLink(telefonKunde);
  const isPrivat = auftraggeber === 'privat' || auftraggeber === 'neurealis';

  let kundeDisplay = '';
  if (isPrivat) {
    // Privatkunde: [Vorname Nachname] [Telefon]
    kundeDisplay = kundeNameFull || '(Name fehlt in Monday)';
    if (telefonKundeLink) kundeDisplay += ` ${telefonKundeLink}`;
  } else {
    // Geschäftskunde: [Auftraggeber] [Vorname Nachname] [Telefon]
    const agDisplay = projekt.auftraggeber || '';
    kundeDisplay = kundeNameFull ? `${agDisplay} - ${kundeNameFull}`.trim() : agDisplay;
    if (telefonKundeLink) kundeDisplay += ` ${telefonKundeLink}`;
  }

  // Zähle offene Mängel und Nachträge
  const { count: mangelCount } = await supabase
    .from('maengel_fertigstellung')
    .select('*', { count: 'exact', head: true })
    .eq('projekt_nr', atbs)
    .not('status_mangel', 'in', '(Abgenommen,Geschlossen)');

  const { count: nachtragCount } = await supabase
    .from('nachtraege')
    .select('*', { count: 'exact', head: true })
    .eq('atbs_nummer', atbs)
    .in('status', ['Gemeldet', 'In Prüfung']);

  await updateSession(chatId, {
    aktuelles_bv_id: projekt.id,
    aktueller_modus: 'baustelle',
    modus_daten: {
      projekt_nr: atbs,
      projekt_name: projektName,
      projekt_phase: phase
    }
  });

  // Kompakte Projekt-Info Anzeige
  let infoText = `<b>Projekt: ${atbs}</b>\n`;
  infoText += `${projektName}\n`;
  if (mapsUrl) {
    infoText += `📍 <a href="${mapsUrl}">Route öffnen</a>\n`;
  }
  infoText += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  infoText += `📍 Phase: ${phase}\n`;
  infoText += `👤 Kunde: ${kundeDisplay}\n`;
  // NU: Firma - Ansprechpartner (Telefon) oder "nicht zugeordnet"
  let nuDisplay = '';
  const nuFirmaValid = nuFirma && nuFirma !== '-' && nuFirma.trim() !== '';
  if (nuFirmaValid) {
    nuDisplay = nuFirma;
    if (nuAnsprechpartner) nuDisplay += ` - ${nuAnsprechpartner}`;
    const nuTelefonLink = formatPhoneLink(nuTelefon);
    if (nuTelefonLink) nuDisplay += ` ${nuTelefonLink}`;
  } else {
    nuDisplay = 'nicht zugeordnet';
  }
  infoText += `🔧 NU: ${nuDisplay}\n\n`;
  infoText += `📅 Termine:\n`;
  infoText += `   BV Start: ${bvStart}\n`;
  infoText += `   BV Ende NU Plan: ${bvEndeNuPlan}\n`;
  infoText += `   BV Ende Kunde: ${bvEndeKunde}\n\n`;
  infoText += `⚠️ Offen: ${mangelCount || 0} Mängel | ${nachtragCount || 0} Nachträge\n`;
  infoText += `━━━━━━━━━━━━━━━━━━━━`;

  await sendMessage(chatId, infoText, {
    reply_markup: { inline_keyboard: [
      [{ text: "🔧 Mangel melden", callback_data: "bau:mangel" }],
      [{ text: "📋 Nachtrag erfassen", callback_data: "bau:nachtrag" }],
      [{ text: "📸 Nachweis hochladen", callback_data: "bau:nachweis" }],
      [{ text: "📝 Bericht erstellen", callback_data: "bau:bericht" }],
      [{ text: "📄 Abnahmeprotokoll", callback_data: "bau:abnahme" }],
      [{ text: "📊 Status & Gewerke", callback_data: "bau:status" }],
      [{ text: "❌ Projekt schließen", callback_data: "bau:close" }]
    ] }
  });
}

// ============================================
// closeProjekt - Projekt schließen
// ============================================

export async function closeProjekt(chatId: number) {
  await updateSession(chatId, {
    aktuelles_bv_id: null,
    aktueller_modus: null,
    modus_daten: {}
  });
  await sendMessage(chatId, '✅ Projekt geschlossen.\n\n/start für Hauptmenü.');
}

// ============================================
// handleHelp - Hilfe anzeigen
// ============================================

export async function handleHelp(chatId: number) {
  await sendMessage(chatId,
    `<b>Befehle:</b>\n\n` +
    `/start - Hauptmenü\n` +
    `/hilfe - Diese Hilfe\n` +
    `/status - Aktueller Status\n` +
    `/abbrechen - Aktuellen Vorgang abbrechen\n` +
    `/sync - Matterport-Projekte synchronisieren\n` +
    `/briefing - Audio-Briefing abrufen (nur Bauleiter)\n\n` +
    `<b>Aufmaß-Modus:</b>\n` +
    `ATBS-Nummer oder Adresse eingeben → Projekt suchen\n` +
    `CSV hochladen → Excel-Aufmaß\n\n` +
    `<b>Bedarfsanalyse-Modus:</b>\n` +
    `Foto(s) senden → OCR → Angebot → Review → Odoo-Export\n\n` +
    `<b>Baustellen-Modus:</b>\n` +
    `Projekt öffnen → Mängel, Nachträge, Nachweise erfassen`
  );
}

// ============================================
// handleSync - Matterport-Sync
// ============================================

export async function handleSync(chatId: number) {
  await sendMessage(chatId, `⏳ Synchronisiere Matterport-Projekte...`);
  try {
    const fnUrl = `${SUPABASE_URL}/functions/v1/sync-matterport-projects`;
    const response = await fetch(fnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: '{}',
    });
    const result = await response.json();
    if (result.success) {
      await sendMessage(chatId,
        `<b>Sync abgeschlossen</b>\n\n` +
        `Gesamt in Matterport: ${result.total_in_matterport}\n` +
        `Neu: ${result.created}\n` +
        `Aktualisiert: ${result.updated}\n` +
        `Unverändert: ${result.synced}`);
    } else {
      await sendMessage(chatId, `Sync-Fehler: ${result.error}`);
    }
  } catch (e) {
    await sendMessage(chatId, `Sync-Fehler: ${(e as Error).message}`);
  }
}

// ============================================
// handleStatus - Status anzeigen
// ============================================

export async function handleStatus(chatId: number, session: any) {
  const modus = session?.aktueller_modus || 'keiner';
  const daten = session?.modus_daten || {};
  const bvId = session?.aktuelles_bv_id;
  let text = `<b>Status:</b>\n\nModus: ${modus}\n`;
  if (bvId) text += `Geöffnetes Projekt: ${daten.projekt_nr || bvId}\n`;
  if (daten.atbs_nummer) text += `ATBS: ${daten.atbs_nummer}\n`;
  if (daten.draft_id) text += `Angebot-Draft: ${daten.draft_id}\n`;
  if (daten.bedarfsanalyse_id) text += `Bedarfsanalyse: ${daten.bedarfsanalyse_id}\n`;
  if (daten.photo_file_ids) text += `Fotos: ${daten.photo_file_ids.length}\n`;
  await sendMessage(chatId, text);
}

// ============================================
// handleAbbrechen - Vorgang abbrechen
// ============================================

export async function handleAbbrechen(chatId: number) {
  await updateSession(chatId, { aktueller_modus: null, modus_daten: {}, aktuelles_bv_id: null });
  await sendMessage(chatId, `Vorgang abgebrochen.\n\n/start für Hauptmenü.`);
}

// ============================================
// handleBriefingCommand - Audio-Briefing für Bauleiter
// ============================================

export async function handleBriefingCommand(chatId: number): Promise<void> {
  try {
    // 1. User ermitteln via telegram_chat_id
    const { data: kontakt } = await supabase
      .from('kontakte')
      .select('email, vorname, nachname, rolle')
      .eq('telegram_chat_id', chatId)
      .single();

    // Prüfe ob Bauleiter (BL) oder Holger Neumann
    const isBauleiter = kontakt?.rolle?.toUpperCase() === 'BL' ||
      (kontakt?.vorname?.toLowerCase() === 'holger' && kontakt?.nachname?.toLowerCase() === 'neumann');

    if (!kontakt || !isBauleiter) {
      await sendMessage(chatId, '❌ Dieser Befehl ist nur für Bauleiter verfügbar.');
      return;
    }

    if (!kontakt.email) {
      await sendMessage(chatId, '❌ Für dein Konto ist keine E-Mail hinterlegt. Bitte kontaktiere den Administrator.');
      return;
    }

    // 2. Statusmeldung senden
    await sendMessage(chatId,
      '🎙️ <b>Audio-Briefing wird generiert...</b>\n\n' +
      'Das dauert ca. 30-60 Sekunden.\n' +
      'Du erhältst eine Sprachnachricht sobald es fertig ist.'
    );

    // 3. Edge Function aufrufen
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/audio-briefing-generate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bauleiter_email: kontakt.email,
          force: true // Bei manuellem Abruf immer neu generieren
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Audio-Briefing error:', errorText);
      await sendMessage(chatId, '❌ Fehler beim Generieren des Briefings. Bitte versuche es später erneut.');
    }
    // Audio wird von der Edge Function direkt an Telegram gesendet
  } catch (e) {
    console.error('handleBriefingCommand error:', e);
    await sendMessage(chatId, '❌ Ein unerwarteter Fehler ist aufgetreten.');
  }
}
