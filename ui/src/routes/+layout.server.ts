/**
 * neurealis ERP - Layout Server Load
 * Lädt Session-Daten für alle Seiten
 */

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();

	return {
		session,
		user
	};
};
