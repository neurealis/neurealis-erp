/**
 * neurealis ERP - Logout Handler
 */

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	await locals.supabase.auth.signOut();
	redirect(303, '/login');
};

// Auch GET erlauben für einfache Links
export const GET: RequestHandler = async ({ locals }) => {
	await locals.supabase.auth.signOut();
	redirect(303, '/login');
};
