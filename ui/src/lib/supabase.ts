/**
 * neurealis ERP - Supabase Client
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mfpuijttdgkllnvhvjlu.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Parst mehrsprachige Artikeleingabe via Edge Function
 * @param text - Freitext mit Artikeln und Mengen
 * @param grosshaendler_id - Optional: Nur Artikel dieses Großhändlers matchen
 */
export async function parseArtikelText(
  text: string,
  grosshaendler_id?: string
): Promise<{
  success: boolean;
  items: Array<{
    bezeichnung: string;
    menge: number;
    einheit: string;
    confidence: number;
    originalText: string;
    artikel_id?: string;
    artikelnummer?: string;
    einzelpreis?: number;
  }>;
  unerkannt: string[];
  grosshaendler_vorschlag?: string;
  error?: string;
}> {
  const { data, error } = await supabase.functions.invoke('parse-bestellung', {
    body: { text, grosshaendler_id }
  });

  if (error) {
    return {
      success: false,
      items: [],
      unerkannt: [],
      error: error.message
    };
  }

  return data;
}
