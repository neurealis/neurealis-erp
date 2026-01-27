/**
 * neurealis ERP - Server Hooks
 * Handhabt Auth-Sessions für alle Requests
 */

import { createSupabaseServerClient } from '$lib/supabase-server';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	// Supabase Client für diesen Request erstellen
	event.locals.supabase = createSupabaseServerClient(event.cookies);

	// Session aus Cookies laden (sicherer als getSession)
	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();

		if (!session) {
			return { session: null, user: null };
		}

		// User-Daten verifizieren
		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();

		if (error) {
			return { session: null, user: null };
		}

		return { session, user };
	};

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};
