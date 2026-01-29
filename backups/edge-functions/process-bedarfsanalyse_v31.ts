// BACKUP: process-bedarfsanalyse v31
// Erstellt: 2026-01-29
// Supabase Function ID: 401eed08-e411-42bc-9dd4-27d78d011d4a

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * process-bedarfsanalyse v16 - Auftraggeber als Pflichtfeld
 *
 * Änderungen v16:
 * - Wenn OCR den Auftraggeber NICHT erkennt -> Status "needs_auftraggeber"
 * - Telegram-Webhook kann dann Rückfrage mit Inline-Buttons stellen
 * - pauschal_groesse=null -> als "Aufmaß nötig" interpretiert (unverändert)
 */

// [Rest des Codes - siehe Supabase Edge Function]
// Vollständiger Code in Supabase Dashboard unter:
// https://supabase.com/dashboard/project/mfpuijttdgkllnvhvjlu/functions/process-bedarfsanalyse
