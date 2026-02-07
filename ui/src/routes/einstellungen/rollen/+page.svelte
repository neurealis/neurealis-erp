<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';

	// ===== Types =====
	interface Role {
		id: string;
		name: string;
		description: string | null;
		is_default: boolean;
		created_at: string;
	}

	interface Permission {
		id: string;
		name: string;
		description: string | null;
		resource: string;
		action: string;
	}

	interface RolePermission {
		role_id: string;
		permission_id: string;
	}

	interface UserRole {
		user_id: string;
		role_id: string;
		assigned_at: string;
		assigned_by: string | null;
	}

	interface UserProfile {
		id: string;
		email: string;
		name: string | null;
		raw_user_meta_data: Record<string, unknown> | null;
	}

	// ===== State =====
	let activeTab = $state<'rollen' | 'berechtigungen' | 'benutzer'>('rollen');

	// Daten
	let roles = $state<Role[]>([]);
	let permissions = $state<Permission[]>([]);
	let rolePermissions = $state<RolePermission[]>([]);
	let userRoles = $state<UserRole[]>([]);
	let users = $state<UserProfile[]>([]);

	// Laden
	let loading = $state(true);
	let error = $state<string | null>(null);
	let saving = $state(false);
	let successMessage = $state<string | null>(null);

	// Rollen-Tab State
	let showRoleModal = $state(false);
	let roleModalMode = $state<'create' | 'edit'>('create');
	let editingRole = $state<Role | null>(null);
	let roleFormName = $state('');
	let roleFormDescription = $state('');
	let roleFormIsDefault = $state(false);

	// Löschen-Bestätigung
	let showDeleteConfirm = $state(false);
	let deletingRole = $state<Role | null>(null);

	// Benutzer-Tab State
	let showUserRoleModal = $state(false);
	let editingUser = $state<UserProfile | null>(null);
	let selectedRoleIds = $state<string[]>([]);

	// ===== Abgeleitete Werte =====
	let permissionsByResource = $derived(() => {
		const grouped: Record<string, Permission[]> = {};
		for (const perm of permissions) {
			if (!grouped[perm.resource]) {
				grouped[perm.resource] = [];
			}
			grouped[perm.resource].push(perm);
		}
		return grouped;
	});

	let resourceNames = $derived(() => {
		return Object.keys(permissionsByResource()).sort();
	});

	// ===== Daten laden =====
	async function loadData() {
		loading = true;
		error = null;

		try {
			const [rolesRes, permsRes, rpRes, urRes, usersRes] = await Promise.all([
				supabase.from('roles').select('*').order('name'),
				supabase.from('permissions').select('*').order('resource').order('action'),
				supabase.from('role_permissions').select('*'),
				supabase.from('user_roles').select('*'),
				supabase.rpc('get_users_for_role_management')
			]);

			if (rolesRes.error) throw rolesRes.error;
			if (permsRes.error) throw permsRes.error;
			if (rpRes.error) throw rpRes.error;
			if (urRes.error) throw urRes.error;

			roles = rolesRes.data || [];
			permissions = permsRes.data || [];
			rolePermissions = rpRes.data || [];
			userRoles = urRes.data || [];

			// Users: Falls RPC nicht existiert, Fallback auf auth.users via user_roles
			if (usersRes.error) {
				// Fallback: Benutzer aus user_roles extrahieren
				const uniqueUserIds = [...new Set(userRoles.map(ur => ur.user_id))];
				users = uniqueUserIds.map(uid => ({
					id: uid,
					email: uid,
					name: null,
					raw_user_meta_data: null
				}));
			} else {
				users = usersRes.data || [];
			}
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'Fehler beim Laden der Daten';
			console.error('Fehler beim Laden:', err);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadData();
	});

	// ===== Hilfsfunktionen =====
	function hasPermission(roleId: string, permissionId: string): boolean {
		return rolePermissions.some(rp => rp.role_id === roleId && rp.permission_id === permissionId);
	}

	function getUserRoles(userId: string): Role[] {
		const roleIds = userRoles.filter(ur => ur.user_id === userId).map(ur => ur.role_id);
		return roles.filter(r => roleIds.includes(r.id));
	}

	function getUserDisplayName(user: UserProfile): string {
		if (user.name) return user.name;
		const meta = user.raw_user_meta_data;
		if (meta) {
			const fullName = (meta.full_name || meta.name) as string | undefined;
			if (fullName) return fullName;
		}
		return user.email;
	}

	function showSuccess(msg: string) {
		successMessage = msg;
		setTimeout(() => { successMessage = null; }, 3000);
	}

	function formatResourceName(resource: string): string {
		const mapping: Record<string, string> = {
			bauvorhaben: 'Bauvorhaben',
			maengel: 'Mängel',
			nachtraege: 'Nachträge',
			finanzen: 'Finanzen',
			kontakte: 'Kontakte',
			leads: 'Leads',
			marketing: 'Marketing',
			aufgaben: 'Aufgaben',
			einkauf: 'Einkauf',
			einstellungen: 'Einstellungen',
			benutzer: 'Benutzer',
			rollen: 'Rollen',
			nachunternehmer: 'Nachunternehmer',
			angebote: 'Angebote',
			dokumente: 'Dokumente'
		};
		return mapping[resource] || resource.charAt(0).toUpperCase() + resource.slice(1);
	}

	function formatActionName(action: string): string {
		const mapping: Record<string, string> = {
			read: 'Lesen',
			create: 'Erstellen',
			update: 'Bearbeiten',
			delete: 'Löschen',
			manage: 'Verwalten',
			export: 'Exportieren',
			approve: 'Genehmigen'
		};
		return mapping[action] || action;
	}

	// ===== Rollen CRUD =====
	function openCreateRole() {
		roleModalMode = 'create';
		roleFormName = '';
		roleFormDescription = '';
		roleFormIsDefault = false;
		editingRole = null;
		showRoleModal = true;
	}

	function openEditRole(role: Role) {
		roleModalMode = 'edit';
		roleFormName = role.name;
		roleFormDescription = role.description || '';
		roleFormIsDefault = role.is_default;
		editingRole = role;
		showRoleModal = true;
	}

	function closeRoleModal() {
		showRoleModal = false;
		editingRole = null;
	}

	async function saveRole() {
		if (!roleFormName.trim()) return;
		saving = true;

		try {
			if (roleModalMode === 'create') {
				const { error: err } = await supabase.from('roles').insert({
					name: roleFormName.trim(),
					description: roleFormDescription.trim() || null,
					is_default: roleFormIsDefault
				});
				if (err) throw err;
				showSuccess('Rolle erfolgreich erstellt');
			} else if (editingRole) {
				const { error: err } = await supabase.from('roles').update({
					name: roleFormName.trim(),
					description: roleFormDescription.trim() || null,
					is_default: roleFormIsDefault
				}).eq('id', editingRole.id);
				if (err) throw err;
				showSuccess('Rolle erfolgreich aktualisiert');
			}

			// Wenn als Standard markiert, andere Standard-Rollen entfernen
			if (roleFormIsDefault) {
				const otherId = editingRole?.id;
				const otherDefaults = roles.filter(r => r.is_default && r.id !== otherId);
				for (const r of otherDefaults) {
					await supabase.from('roles').update({ is_default: false }).eq('id', r.id);
				}
			}

			closeRoleModal();
			await loadData();
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'Fehler beim Speichern';
		} finally {
			saving = false;
		}
	}

	function confirmDeleteRole(role: Role) {
		deletingRole = role;
		showDeleteConfirm = true;
	}

	async function deleteRole() {
		if (!deletingRole) return;
		saving = true;

		try {
			// Erst Zuweisungen entfernen
			await supabase.from('role_permissions').delete().eq('role_id', deletingRole.id);
			await supabase.from('user_roles').delete().eq('role_id', deletingRole.id);

			const { error: err } = await supabase.from('roles').delete().eq('id', deletingRole.id);
			if (err) throw err;

			showDeleteConfirm = false;
			deletingRole = null;
			showSuccess('Rolle erfolgreich gelöscht');
			await loadData();
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'Fehler beim Löschen';
		} finally {
			saving = false;
		}
	}

	// ===== Berechtigungen Toggle =====
	async function togglePermission(roleId: string, permissionId: string) {
		const exists = hasPermission(roleId, permissionId);
		saving = true;

		try {
			if (exists) {
				const { error: err } = await supabase
					.from('role_permissions')
					.delete()
					.eq('role_id', roleId)
					.eq('permission_id', permissionId);
				if (err) throw err;
				rolePermissions = rolePermissions.filter(
					rp => !(rp.role_id === roleId && rp.permission_id === permissionId)
				);
			} else {
				const { error: err } = await supabase
					.from('role_permissions')
					.insert({ role_id: roleId, permission_id: permissionId });
				if (err) throw err;
				rolePermissions = [...rolePermissions, { role_id: roleId, permission_id: permissionId }];
			}
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'Fehler beim Aktualisieren der Berechtigung';
		} finally {
			saving = false;
		}
	}

	// ===== Benutzer-Rollen =====
	function openUserRoleModal(user: UserProfile) {
		editingUser = user;
		selectedRoleIds = userRoles
			.filter(ur => ur.user_id === user.id)
			.map(ur => ur.role_id);
		showUserRoleModal = true;
	}

	function closeUserRoleModal() {
		showUserRoleModal = false;
		editingUser = null;
		selectedRoleIds = [];
	}

	function toggleUserRole(roleId: string) {
		if (selectedRoleIds.includes(roleId)) {
			selectedRoleIds = selectedRoleIds.filter(id => id !== roleId);
		} else {
			selectedRoleIds = [...selectedRoleIds, roleId];
		}
	}

	async function saveUserRoles() {
		if (!editingUser) return;
		saving = true;

		try {
			// Alle bestehenden Rollen des Users löschen
			const { error: delErr } = await supabase
				.from('user_roles')
				.delete()
				.eq('user_id', editingUser.id);
			if (delErr) throw delErr;

			// Neue Rollen zuweisen
			if (selectedRoleIds.length > 0) {
				const inserts = selectedRoleIds.map(roleId => ({
					user_id: editingUser!.id,
					role_id: roleId
				}));
				const { error: insErr } = await supabase.from('user_roles').insert(inserts);
				if (insErr) throw insErr;
			}

			closeUserRoleModal();
			showSuccess('Rollen erfolgreich aktualisiert');
			await loadData();
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'Fehler beim Speichern der Rollen';
		} finally {
			saving = false;
		}
	}

	// ===== SVG Icons =====
	const icons = {
		settings: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>`,
		plus: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>`,
		edit: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>`,
		trash: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>`,
		shield: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>`,
		users: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>`,
		check: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>`,
		x: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>`,
		star: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>`
	};
</script>

<svelte:head>
	<title>Rollen & Rechte - neurealis ERP</title>
</svelte:head>

<div class="page-container">
	<!-- Page Header -->
	<div class="page-header">
		<div class="page-header-content">
			<div class="page-header-text">
				<h1 class="page-title">Rollen & Rechte</h1>
				<p class="page-description">Benutzerrollen, Berechtigungen und Zuweisungen verwalten</p>
			</div>
		</div>
	</div>

	<!-- Erfolgs-Meldung -->
	{#if successMessage}
		<div class="toast toast-success">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18">
				{@html icons.check}
			</svg>
			{successMessage}
		</div>
	{/if}

	<!-- Fehler-Meldung -->
	{#if error}
		<div class="toast toast-error">
			{error}
			<button class="toast-close" onclick={() => error = null}>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
					{@html icons.x}
				</svg>
			</button>
		</div>
	{/if}

	<!-- Tab-Navigation -->
	<div class="tabs">
		<button
			class="tab"
			class:active={activeTab === 'rollen'}
			onclick={() => activeTab = 'rollen'}
		>
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18">
				{@html icons.shield}
			</svg>
			Rollen
			<span class="tab-count">{roles.length}</span>
		</button>
		<button
			class="tab"
			class:active={activeTab === 'berechtigungen'}
			onclick={() => activeTab = 'berechtigungen'}
		>
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18">
				{@html icons.settings}
			</svg>
			Berechtigungen
			<span class="tab-count">{permissions.length}</span>
		</button>
		<button
			class="tab"
			class:active={activeTab === 'benutzer'}
			onclick={() => activeTab = 'benutzer'}
		>
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18">
				{@html icons.users}
			</svg>
			Benutzer
			<span class="tab-count">{users.length}</span>
		</button>
	</div>

	<!-- Ladeindikator -->
	{#if loading}
		<div class="loading-container">
			<div class="loading-spinner"></div>
			<p class="loading-text">Daten werden geladen...</p>
		</div>
	{:else}

	<!-- ==================== TAB 1: ROLLEN ==================== -->
	{#if activeTab === 'rollen'}
		<div class="tab-content">
			<div class="section-header">
				<h2 class="section-title">Rollen verwalten</h2>
				<button class="btn-primary btn-sm" onclick={openCreateRole}>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
						{@html icons.plus}
					</svg>
					Neue Rolle
				</button>
			</div>

			{#if roles.length === 0}
				<div class="empty-state">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="48" height="48" class="empty-icon">
						{@html icons.shield}
					</svg>
					<p class="empty-title">Keine Rollen vorhanden</p>
					<p class="empty-desc">Erstellen Sie die erste Rolle, um Berechtigungen zuzuweisen.</p>
				</div>
			{:else}
				<div class="roles-grid">
					{#each roles as role}
						<div class="role-card">
							<div class="role-card-header">
								<div class="role-name-row">
									<h3 class="role-name">{role.name}</h3>
									{#if role.is_default}
										<span class="default-badge">Standard</span>
									{/if}
								</div>
								<div class="role-actions">
									<button class="btn-icon-sm" onclick={() => openEditRole(role)} title="Bearbeiten">
										<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
											{@html icons.edit}
										</svg>
									</button>
									<button class="btn-icon-sm btn-icon-danger" onclick={() => confirmDeleteRole(role)} title="Löschen">
										<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
											{@html icons.trash}
										</svg>
									</button>
								</div>
							</div>
							{#if role.description}
								<p class="role-description">{role.description}</p>
							{/if}
							<div class="role-meta">
								<span class="role-meta-item">
									{rolePermissions.filter(rp => rp.role_id === role.id).length} Berechtigungen
								</span>
								<span class="role-meta-sep">|</span>
								<span class="role-meta-item">
									{userRoles.filter(ur => ur.role_id === role.id).length} Benutzer
								</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- ==================== TAB 2: BERECHTIGUNGEN ==================== -->
	{#if activeTab === 'berechtigungen'}
		<div class="tab-content">
			<div class="section-header">
				<h2 class="section-title">Berechtigungsmatrix</h2>
				<p class="section-desc">Berechtigungen pro Rolle zuweisen</p>
			</div>

			{#if permissions.length === 0}
				<div class="empty-state">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="48" height="48" class="empty-icon">
						{@html icons.settings}
					</svg>
					<p class="empty-title">Keine Berechtigungen definiert</p>
					<p class="empty-desc">Berechtigungen werden über die Datenbank angelegt.</p>
				</div>
			{:else if roles.length === 0}
				<div class="empty-state">
					<p class="empty-title">Erst Rollen erstellen</p>
					<p class="empty-desc">Erstellen Sie zuerst Rollen im Tab "Rollen".</p>
				</div>
			{:else}
				<div class="matrix-wrapper">
					<div class="matrix-container">
						<table class="matrix-table">
							<thead>
								<tr>
									<th class="matrix-header-resource">Ressource</th>
									<th class="matrix-header-action">Aktion</th>
									{#each roles as role}
										<th class="matrix-header-role">
											<div class="matrix-role-name">{role.name}</div>
										</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each resourceNames() as resource}
									{#each permissionsByResource()[resource] as perm, permIndex}
										<tr class:resource-first={permIndex === 0}>
											{#if permIndex === 0}
												<td class="matrix-resource" rowspan={permissionsByResource()[resource].length}>
													<span class="resource-label">{formatResourceName(resource)}</span>
												</td>
											{/if}
											<td class="matrix-action">
												<span class="action-label">{formatActionName(perm.action)}</span>
												{#if perm.description}
													<span class="action-desc" title={perm.description}>?</span>
												{/if}
											</td>
											{#each roles as role}
												<td class="matrix-cell">
													<label class="checkbox-wrapper">
														<input
															type="checkbox"
															checked={hasPermission(role.id, perm.id)}
															onchange={() => togglePermission(role.id, perm.id)}
															disabled={saving}
														/>
														<span class="checkbox-custom"></span>
													</label>
												</td>
											{/each}
										</tr>
									{/each}
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- ==================== TAB 3: BENUTZER ==================== -->
	{#if activeTab === 'benutzer'}
		<div class="tab-content">
			<div class="section-header">
				<h2 class="section-title">Benutzerverwaltung</h2>
				<p class="section-desc">Rollen pro Benutzer zuweisen</p>
			</div>

			{#if users.length === 0}
				<div class="empty-state">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="48" height="48" class="empty-icon">
						{@html icons.users}
					</svg>
					<p class="empty-title">Keine Benutzer gefunden</p>
					<p class="empty-desc">Es gibt noch keine registrierten Benutzer.</p>
				</div>
			{:else}
				<div class="table-container">
					<table>
						<thead>
							<tr>
								<th>Benutzer</th>
								<th>E-Mail</th>
								<th>Rollen</th>
								<th class="col-actions">Aktionen</th>
							</tr>
						</thead>
						<tbody>
							{#each users as user}
								<tr>
									<td>
										<div class="user-cell">
											<div class="user-avatar-sm">
												{getUserDisplayName(user).charAt(0).toUpperCase()}
											</div>
											<span class="user-name">{getUserDisplayName(user)}</span>
										</div>
									</td>
									<td class="user-email-cell">{user.email}</td>
									<td>
										<div class="role-chips">
											{#each getUserRoles(user.id) as role}
												<span class="role-chip">
													{role.name}
													{#if role.is_default}
														<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="12" height="12">
															{@html icons.star}
														</svg>
													{/if}
												</span>
											{/each}
											{#if getUserRoles(user.id).length === 0}
												<span class="no-role-text">Keine Rolle zugewiesen</span>
											{/if}
										</div>
									</td>
									<td class="col-actions">
										<button class="btn-secondary btn-sm" onclick={() => openUserRoleModal(user)}>
											Rollen bearbeiten
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}

	{/if} <!-- Ende loading check -->
</div>

<!-- ==================== MODAL: Rolle erstellen/bearbeiten ==================== -->
{#if showRoleModal}
	<button class="modal-backdrop" aria-label="Schließen" onclick={closeRoleModal}></button>
	<div class="modal">
		<div class="modal-header">
			<h3 class="modal-title">
				{roleModalMode === 'create' ? 'Neue Rolle erstellen' : 'Rolle bearbeiten'}
			</h3>
			<button class="modal-close" onclick={closeRoleModal}>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20">
					{@html icons.x}
				</svg>
			</button>
		</div>
		<div class="modal-body">
			<div class="form-group">
				<label for="role-name">Rollenname</label>
				<input
					id="role-name"
					type="text"
					bind:value={roleFormName}
					placeholder="z.B. Administrator, Bauleiter, Buchhalter"
				/>
			</div>
			<div class="form-group">
				<label for="role-desc">Beschreibung</label>
				<textarea
					id="role-desc"
					bind:value={roleFormDescription}
					placeholder="Beschreibung der Rolle und ihrer Aufgaben"
					rows="3"
				></textarea>
			</div>
			<div class="form-group">
				<label class="checkbox-label">
					<input type="checkbox" bind:checked={roleFormIsDefault} />
					<span>Standard-Rolle (wird neuen Benutzern automatisch zugewiesen)</span>
				</label>
			</div>
		</div>
		<div class="modal-footer">
			<button class="btn-ghost" onclick={closeRoleModal}>Abbrechen</button>
			<button class="btn-primary" onclick={saveRole} disabled={saving || !roleFormName.trim()}>
				{#if saving}
					Speichern...
				{:else}
					{roleModalMode === 'create' ? 'Erstellen' : 'Speichern'}
				{/if}
			</button>
		</div>
	</div>
{/if}

<!-- ==================== MODAL: Rolle löschen bestätigen ==================== -->
{#if showDeleteConfirm && deletingRole}
	<button class="modal-backdrop" aria-label="Schließen" onclick={() => { showDeleteConfirm = false; deletingRole = null; }}></button>
	<div class="modal modal-sm">
		<div class="modal-header modal-header-danger">
			<h3 class="modal-title">Rolle löschen?</h3>
		</div>
		<div class="modal-body">
			<p class="confirm-text">
				Möchten Sie die Rolle <strong>"{deletingRole.name}"</strong> wirklich löschen?
			</p>
			<p class="confirm-warning">
				Alle Berechtigungen und Benutzerzuweisungen dieser Rolle werden entfernt.
				Diese Aktion kann nicht rückgängig gemacht werden.
			</p>
		</div>
		<div class="modal-footer">
			<button class="btn-ghost" onclick={() => { showDeleteConfirm = false; deletingRole = null; }}>
				Abbrechen
			</button>
			<button class="btn-danger" onclick={deleteRole} disabled={saving}>
				{saving ? 'Wird gelöscht...' : 'Endgültig löschen'}
			</button>
		</div>
	</div>
{/if}

<!-- ==================== MODAL: Benutzer-Rollen bearbeiten ==================== -->
{#if showUserRoleModal && editingUser}
	<button class="modal-backdrop" aria-label="Schließen" onclick={closeUserRoleModal}></button>
	<div class="modal">
		<div class="modal-header">
			<h3 class="modal-title">Rollen für {getUserDisplayName(editingUser)}</h3>
			<button class="modal-close" onclick={closeUserRoleModal}>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20">
					{@html icons.x}
				</svg>
			</button>
		</div>
		<div class="modal-body">
			<p class="modal-subtitle">{editingUser.email}</p>
			<div class="role-selection">
				{#each roles as role}
					<label class="role-selection-item" class:selected={selectedRoleIds.includes(role.id)}>
						<input
							type="checkbox"
							checked={selectedRoleIds.includes(role.id)}
							onchange={() => toggleUserRole(role.id)}
						/>
						<div class="role-selection-content">
							<span class="role-selection-name">{role.name}</span>
							{#if role.description}
								<span class="role-selection-desc">{role.description}</span>
							{/if}
							{#if role.is_default}
								<span class="default-badge-sm">Standard</span>
							{/if}
						</div>
					</label>
				{/each}
			</div>
		</div>
		<div class="modal-footer">
			<button class="btn-ghost" onclick={closeUserRoleModal}>Abbrechen</button>
			<button class="btn-primary" onclick={saveUserRoles} disabled={saving}>
				{saving ? 'Speichern...' : 'Rollen speichern'}
			</button>
		</div>
	</div>
{/if}

<style>
	/* ===== Page Container ===== */
	.page-container {
		max-width: 1400px;
		margin: 0 auto;
	}

	/* ===== Page Header ===== */
	.page-header {
		margin-bottom: var(--spacing-6);
	}

	.page-header-content {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--spacing-4);
	}

	.page-title {
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-bold);
		color: var(--color-gray-900);
		margin-bottom: var(--spacing-1);
	}

	.page-description {
		font-size: var(--font-size-sm);
		color: var(--color-gray-500);
		margin-bottom: 0;
	}

	/* ===== Toast Notifications ===== */
	.toast {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-3) var(--spacing-4);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-4);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
		animation: slideDown 0.3s ease;
	}

	.toast-success {
		background-color: var(--color-success-light);
		color: var(--color-success-dark);
		border: 1px solid var(--color-success);
	}

	.toast-error {
		background-color: var(--color-error-light);
		color: var(--color-error-dark);
		border: 1px solid var(--color-error);
	}

	.toast-close {
		margin-left: auto;
		padding: 2px;
		background: none;
		border: none;
		cursor: pointer;
		color: inherit;
		opacity: 0.7;
	}

	.toast-close:hover {
		opacity: 1;
	}

	@keyframes slideDown {
		from { opacity: 0; transform: translateY(-8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* ===== Tab-Navigation ===== */
	.tabs {
		display: flex;
		gap: var(--spacing-1);
		border-bottom: 2px solid var(--color-gray-200);
		margin-bottom: var(--spacing-6);
	}

	.tab {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-3) var(--spacing-4);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
		color: var(--color-gray-500);
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		margin-bottom: -2px;
		cursor: pointer;
		transition: all var(--transition-fast);
		white-space: nowrap;
	}

	.tab:hover {
		color: var(--color-gray-700);
	}

	.tab.active {
		color: var(--color-primary);
		border-bottom-color: var(--color-primary);
		font-weight: var(--font-weight-semibold);
	}

	.tab svg {
		flex-shrink: 0;
	}

	.tab-count {
		background: var(--color-gray-100);
		color: var(--color-gray-600);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		padding: 1px 8px;
		border-radius: var(--radius-full);
	}

	.tab.active .tab-count {
		background: var(--color-primary-100);
		color: var(--color-primary);
	}

	/* ===== Tab Content ===== */
	.tab-content {
		animation: fadeIn 0.2s ease;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	/* ===== Section Header ===== */
	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-4);
		margin-bottom: var(--spacing-4);
		flex-wrap: wrap;
	}

	.section-title {
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
		color: var(--color-gray-800);
		margin: 0;
	}

	.section-desc {
		font-size: var(--font-size-sm);
		color: var(--color-gray-500);
		margin: 0;
	}

	/* ===== Loading ===== */
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-12) 0;
		gap: var(--spacing-4);
	}

	.loading-spinner {
		width: 36px;
		height: 36px;
		border: 3px solid var(--color-gray-200);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.loading-text {
		font-size: var(--font-size-sm);
		color: var(--color-gray-500);
		margin: 0;
	}

	/* ===== Empty State ===== */
	.empty-state {
		text-align: center;
		padding: var(--spacing-12) var(--spacing-6);
	}

	.empty-icon {
		color: var(--color-gray-300);
		margin-bottom: var(--spacing-4);
	}

	.empty-title {
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
		color: var(--color-gray-700);
		margin-bottom: var(--spacing-2);
	}

	.empty-desc {
		font-size: var(--font-size-sm);
		color: var(--color-gray-500);
		margin: 0;
	}

	/* ===== Roles Grid ===== */
	.roles-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: var(--spacing-4);
	}

	.role-card {
		background: white;
		border: 1px solid var(--color-gray-200);
		border-radius: var(--radius-lg);
		padding: var(--spacing-5);
		transition: box-shadow var(--transition-fast);
	}

	.role-card:hover {
		box-shadow: var(--shadow-md);
	}

	.role-card-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--spacing-3);
		margin-bottom: var(--spacing-2);
	}

	.role-name-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		flex-wrap: wrap;
	}

	.role-name {
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-semibold);
		color: var(--color-gray-900);
		margin: 0;
	}

	.default-badge {
		display: inline-flex;
		align-items: center;
		padding: 1px 8px;
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		background: var(--color-primary-100);
		color: var(--color-primary);
		border-radius: var(--radius-full);
		border: 1px solid var(--color-primary-200);
	}

	.default-badge-sm {
		display: inline-flex;
		font-size: 0.65rem;
		padding: 0 6px;
		background: var(--color-primary-100);
		color: var(--color-primary);
		border-radius: var(--radius-full);
	}

	.role-actions {
		display: flex;
		gap: var(--spacing-1);
		flex-shrink: 0;
	}

	.btn-icon-sm {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		background: none;
		border: 1px solid var(--color-gray-200);
		border-radius: var(--radius-md);
		color: var(--color-gray-500);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.btn-icon-sm:hover {
		background: var(--color-gray-50);
		color: var(--color-gray-700);
		border-color: var(--color-gray-300);
	}

	.btn-icon-sm.btn-icon-danger:hover {
		background: var(--color-error-light);
		color: var(--color-error);
		border-color: var(--color-error);
	}

	.role-description {
		font-size: var(--font-size-sm);
		color: var(--color-gray-600);
		margin-bottom: var(--spacing-3);
		line-height: var(--line-height-normal);
	}

	.role-meta {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		font-size: var(--font-size-xs);
		color: var(--color-gray-400);
		padding-top: var(--spacing-3);
		border-top: 1px solid var(--color-gray-100);
	}

	.role-meta-sep {
		color: var(--color-gray-200);
	}

	/* ===== Permissions Matrix ===== */
	.matrix-wrapper {
		background: white;
		border: 1px solid var(--color-gray-200);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}

	.matrix-container {
		overflow-x: auto;
	}

	.matrix-table {
		width: 100%;
		border-collapse: collapse;
		min-width: 600px;
	}

	.matrix-table thead {
		background: var(--color-gray-50);
		position: sticky;
		top: 0;
		z-index: 1;
	}

	.matrix-table th {
		padding: var(--spacing-3) var(--spacing-4);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		color: var(--color-gray-500);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-bottom: 1px solid var(--color-gray-200);
		text-align: left;
		white-space: nowrap;
	}

	.matrix-header-resource {
		min-width: 140px;
	}

	.matrix-header-action {
		min-width: 100px;
	}

	.matrix-header-role {
		text-align: center !important;
		min-width: 100px;
	}

	.matrix-role-name {
		font-size: var(--font-size-xs);
		color: var(--color-gray-700);
	}

	.matrix-table td {
		padding: var(--spacing-2) var(--spacing-4);
		border-bottom: 1px solid var(--color-gray-100);
		vertical-align: middle;
	}

	.matrix-table tr:last-child td {
		border-bottom: none;
	}

	.resource-first td {
		border-top: 1px solid var(--color-gray-200);
	}

	.matrix-resource {
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-sm);
		color: var(--color-gray-800);
		background: var(--color-gray-50);
		vertical-align: top;
		padding-top: var(--spacing-3) !important;
	}

	.resource-label {
		display: inline-block;
		padding: 2px 8px;
		background: var(--color-primary-50);
		color: var(--color-primary-700);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
	}

	.matrix-action {
		font-size: var(--font-size-sm);
		color: var(--color-gray-600);
	}

	.action-label {
		font-weight: var(--font-weight-medium);
	}

	.action-desc {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		font-size: 0.6rem;
		font-weight: var(--font-weight-bold);
		background: var(--color-gray-200);
		color: var(--color-gray-500);
		border-radius: var(--radius-full);
		margin-left: 4px;
		cursor: help;
	}

	.matrix-cell {
		text-align: center;
	}

	/* ===== Custom Checkbox ===== */
	.checkbox-wrapper {
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.checkbox-wrapper input[type="checkbox"] {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}

	.checkbox-custom {
		display: inline-block;
		width: 20px;
		height: 20px;
		border: 2px solid var(--color-gray-300);
		border-radius: var(--radius-sm);
		background: white;
		transition: all var(--transition-fast);
		position: relative;
	}

	.checkbox-wrapper input:checked + .checkbox-custom {
		background: var(--color-primary);
		border-color: var(--color-primary);
	}

	.checkbox-wrapper input:checked + .checkbox-custom::after {
		content: '';
		position: absolute;
		left: 5px;
		top: 1px;
		width: 6px;
		height: 11px;
		border: solid white;
		border-width: 0 2px 2px 0;
		transform: rotate(45deg);
	}

	.checkbox-wrapper input:disabled + .checkbox-custom {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.checkbox-wrapper:hover .checkbox-custom {
		border-color: var(--color-primary-300);
	}

	/* ===== Users Table ===== */
	.table-container {
		background: white;
		border: 1px solid var(--color-gray-200);
		border-radius: var(--radius-lg);
		overflow-x: auto;
	}

	.user-cell {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
	}

	.user-avatar-sm {
		width: 32px;
		height: 32px;
		background: var(--color-primary-100);
		color: var(--color-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-sm);
		border-radius: var(--radius-full);
		flex-shrink: 0;
	}

	.user-name {
		font-weight: var(--font-weight-medium);
		color: var(--color-gray-800);
	}

	.user-email-cell {
		color: var(--color-gray-500);
		font-size: var(--font-size-sm);
	}

	.col-actions {
		text-align: right;
		white-space: nowrap;
	}

	/* ===== Role Chips ===== */
	.role-chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-1);
	}

	.role-chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 10px;
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-medium);
		background: var(--color-primary-50);
		color: var(--color-primary-700);
		border: 1px solid var(--color-primary-200);
		border-radius: var(--radius-full);
	}

	.no-role-text {
		font-size: var(--font-size-xs);
		color: var(--color-gray-400);
		font-style: italic;
	}

	/* ===== Modal ===== */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: var(--z-modal-backdrop);
		animation: fadeIn 0.15s ease;
	}

	.modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: white;
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-xl);
		z-index: var(--z-modal);
		width: 90%;
		max-width: 520px;
		max-height: 90vh;
		overflow-y: auto;
		animation: modalSlideIn 0.2s ease;
	}

	.modal-sm {
		max-width: 440px;
	}

	@keyframes modalSlideIn {
		from { opacity: 0; transform: translate(-50%, -48%); }
		to { opacity: 1; transform: translate(-50%, -50%); }
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-5) var(--spacing-5) var(--spacing-3);
	}

	.modal-header-danger {
		border-bottom: 2px solid var(--color-error);
	}

	.modal-title {
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
		color: var(--color-gray-900);
		margin: 0;
	}

	.modal-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		background: none;
		border: none;
		color: var(--color-gray-400);
		cursor: pointer;
		border-radius: var(--radius-md);
		transition: all var(--transition-fast);
	}

	.modal-close:hover {
		background: var(--color-gray-100);
		color: var(--color-gray-600);
	}

	.modal-body {
		padding: var(--spacing-4) var(--spacing-5);
	}

	.modal-subtitle {
		font-size: var(--font-size-sm);
		color: var(--color-gray-500);
		margin-bottom: var(--spacing-4);
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: var(--spacing-3);
		padding: var(--spacing-3) var(--spacing-5) var(--spacing-5);
	}

	/* ===== Form Groups ===== */
	.form-group {
		margin-bottom: var(--spacing-4);
	}

	.form-group label {
		display: block;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
		color: var(--color-gray-700);
		margin-bottom: var(--spacing-1);
	}

	.form-group input[type="text"],
	.form-group textarea {
		width: 100%;
	}

	.checkbox-label {
		display: flex !important;
		align-items: center;
		gap: var(--spacing-2);
		cursor: pointer;
		font-weight: var(--font-weight-normal) !important;
	}

	.checkbox-label input[type="checkbox"] {
		width: auto;
		accent-color: var(--color-primary);
	}

	.checkbox-label span {
		font-size: var(--font-size-sm);
		color: var(--color-gray-600);
	}

	/* ===== Confirm Dialog ===== */
	.confirm-text {
		font-size: var(--font-size-sm);
		color: var(--color-gray-700);
		margin-bottom: var(--spacing-3);
	}

	.confirm-warning {
		font-size: var(--font-size-sm);
		color: var(--color-error);
		background: var(--color-error-light);
		padding: var(--spacing-3);
		border-radius: var(--radius-md);
		margin: 0;
	}

	/* ===== Role Selection (User Modal) ===== */
	.role-selection {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.role-selection-item {
		display: flex !important;
		align-items: flex-start;
		gap: var(--spacing-3);
		padding: var(--spacing-3) var(--spacing-4);
		border: 1px solid var(--color-gray-200);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: all var(--transition-fast);
		margin-bottom: 0 !important;
	}

	.role-selection-item:hover {
		border-color: var(--color-primary-200);
		background: var(--color-primary-50);
	}

	.role-selection-item.selected {
		border-color: var(--color-primary);
		background: var(--color-primary-50);
	}

	.role-selection-item input[type="checkbox"] {
		width: auto;
		margin-top: 2px;
		accent-color: var(--color-primary);
		flex-shrink: 0;
	}

	.role-selection-content {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.role-selection-name {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		color: var(--color-gray-800);
	}

	.role-selection-desc {
		font-size: var(--font-size-xs);
		color: var(--color-gray-500);
	}

	/* ===== Responsive ===== */
	@media (max-width: 768px) {
		.tabs {
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
		}

		.tab {
			padding: var(--spacing-2) var(--spacing-3);
		}

		.roles-grid {
			grid-template-columns: 1fr;
		}

		.matrix-header-resource {
			min-width: 100px;
		}

		.section-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.modal {
			width: 95%;
		}

		.page-header-content {
			flex-direction: column;
		}
	}

	@media (max-width: 640px) {
		.tab-count {
			display: none;
		}
	}
</style>
