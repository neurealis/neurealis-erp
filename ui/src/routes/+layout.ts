/**
 * neurealis ERP - Layout Client Load
 * Initialisiert Supabase Client im Browser
 */

import { createSupabaseBrowserClient, isBrowser } from '$lib/supabase-server';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ data, depends }) => {
	depends('supabase:auth');

	const supabase = createSupabaseBrowserClient();

	// Session vom Server übernehmen
	const {
		data: { session }
	} = await supabase.auth.getSession();

	return {
		supabase,
		session: data.session,
		user: data.user
	};
};
