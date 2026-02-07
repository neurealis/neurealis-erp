/**
 * Berechtigungs-Store
 * Lädt und cached die Berechtigungen des eingeloggten Users.
 */

import { supabase } from '$lib/supabase';

// Typen
interface UserPermission {
	resource: string;
	action: string;
}

// State
let userPermissions: UserPermission[] = [];
let userRoleNames: string[] = [];
let loaded = false;

/**
 * Berechtigungen des eingeloggten Users laden.
 * Lädt User-Rollen und deren zugewiesene Berechtigungen.
 */
export async function loadUserPermissions() {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) {
		userPermissions = [];
		userRoleNames = [];
		loaded = true;
		return;
	}

	// User-Rollen + Berechtigungen laden
	const { data: roles } = await supabase
		.from('user_roles')
		.select('role_id, roles(name, role_permissions(permissions(resource, action)))')
		.eq('user_id', user.id);

	if (roles) {
		userRoleNames = roles.map((r: any) => r.roles?.name).filter(Boolean);
		const perms: UserPermission[] = [];
		for (const r of roles) {
			const rps = (r as any).roles?.role_permissions || [];
			for (const rp of rps) {
				if (rp.permissions) {
					perms.push({
						resource: rp.permissions.resource,
						action: rp.permissions.action
					});
				}
			}
		}
		// Deduplizieren
		const seen = new Set<string>();
		userPermissions = perms.filter(p => {
			const key = `${p.resource}.${p.action}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	}

	loaded = true;
}

/**
 * Prüfen ob User eine bestimmte Berechtigung hat.
 * Admin-Rolle hat immer Zugriff.
 */
export function hasPermission(resource: string, action: string): boolean {
	if (!loaded) return false;
	// Admin hat immer Zugriff
	if (userRoleNames.includes('Admin')) return true;
	return userPermissions.some(p => p.resource === resource && p.action === action);
}

/**
 * Prüfen ob User eine bestimmte Rolle hat.
 */
export function hasRole(roleName: string): boolean {
	return userRoleNames.includes(roleName);
}

/**
 * Alle Rollen des Users zurückgeben.
 */
export function getUserRoles(): string[] {
	return [...userRoleNames];
}

/**
 * Prüfen ob Berechtigungen geladen wurden.
 */
export function isLoaded(): boolean {
	return loaded;
}

/**
 * Berechtigungen zurücksetzen (bei Logout).
 */
export function resetPermissions() {
	userPermissions = [];
	userRoleNames = [];
	loaded = false;
}
