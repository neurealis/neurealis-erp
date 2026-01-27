/**
 * Bestellung Page - Daten vom Layout übernehmen
 */
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
	const { supabase, session, user } = await parent();
	return { supabase, session, user };
};
