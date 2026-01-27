/**
 * neurealis ERP - Auth Callback
 * Verarbeitet OAuth-Redirects von Microsoft
 */

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');
	const next = url.searchParams.get('next') ?? '/';

	if (code) {
		const { error } = await locals.supabase.auth.exchangeCodeForSession(code);

		if (!error) {
			// Erfolgreicher Login - zur gewünschten Seite weiterleiten
			redirect(303, `/${next.slice(1)}`);
		}
	}

	// Fehler - zurück zum Login
	redirect(303, '/login?error=auth_callback_error');
};
