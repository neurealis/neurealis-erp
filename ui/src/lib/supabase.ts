/**
 * neurealis ERP - Supabase Client
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mfpuijttdgkllnvhvjlu.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Parst mehrsprachige Artikeleingabe via Edge Function
 */
export async function parseArtikelText(text: string): Promise<{
  success: boolean;
  items: Array<{
    artikel: string;
    menge: number;
    confidence: number;
  }>;
  unerkannt: string[];
  error?: string;
}> {
  const { data, error } = await supabase.functions.invoke('parse-bestellung', {
    body: { text }
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
