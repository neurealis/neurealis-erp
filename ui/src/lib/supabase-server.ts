/**
 * neurealis ERP - Server-Side Supabase Client
 * Für SSR und Auth-Handling in SvelteKit
 */

import { createServerClient, createBrowserClient, isBrowser } from '@supabase/ssr';
import type { Cookies } from '@sveltejs/kit';

const supabaseUrl = 'https://mfpuijttdgkllnvhvjlu.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Erstellt einen Supabase Client für Server-Side Rendering
 */
export function createSupabaseServerClient(cookies: Cookies) {
	return createServerClient(supabaseUrl, supabaseAnonKey, {
		cookies: {
			getAll: () => cookies.getAll(),
			setAll: (cookiesToSet) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					cookies.set(name, value, { ...options, path: '/' });
				});
			}
		}
	});
}

/**
 * Erstellt einen Supabase Client für den Browser
 */
export function createSupabaseBrowserClient() {
	return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export { isBrowser };
