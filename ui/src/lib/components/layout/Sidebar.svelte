<script lang="ts">
	import { page } from '$app/state';

	interface MenuItem {
		icon: string;
		label: string;
		href: string;
		roles: string[];
	}

	interface MenuGroup {
		icon: string;
		label: string;
		roles: string[];
		children: MenuItem[];
	}

	type MenuEntry = MenuItem | MenuGroup;

	function isMenuGroup(item: MenuEntry): item is MenuGroup {
		return 'children' in item;
	}

	interface Props {
		userRole?: string;
		userName?: string;
		userEmail?: string;
		isCollapsed?: boolean;
		onToggle?: () => void;
	}

	let { userRole = 'mitarbeiter', userName, userEmail, isCollapsed = false, onToggle }: Props = $props();

	// WIP-Badge System: Nur für Holger sichtbar
	const isHolger = $derived(userEmail === 'holger.neumann@neurealis.de');

	// Freigegebene Seiten (kein WIP-Badge)
	const releasedPages = new Set([
		'/lv-export',
		'/bestellungen',
		'/bestellung',
		'/angebote',
		'/angebote/neu'
	]);

	function isWorkInProgress(href: string): boolean {
		return !releasedPages.has(href);
	}

	// Offene Submenues verwalten
	let openSubmenus = $state<Set<string>>(new Set(['Einkauf']));

	function toggleSubmenu(label: string) {
		if (openSubmenus.has(label)) {
			openSubmenus.delete(label);
		} else {
			openSubmenus.add(label);
		}
		openSubmenus = new Set(openSubmenus);
	}

	function isSubmenuOpen(label: string): boolean {
		return openSubmenus.has(label);
	}

	// Menue-Items nach Rolle (mit Gruppen)
	const menuEntries: MenuEntry[] = [
		// Alle Rollen
		{ icon: 'home', label: 'Startseite', href: '/', roles: ['admin', 'mitarbeiter', 'kunde', 'nachunternehmer'] },

		// Intern + Admin
		{ icon: 'building', label: 'Bauvorhaben', href: '/bauvorhaben', roles: ['admin', 'mitarbeiter'] },
		{ icon: 'calendar', label: 'Kalender', href: '/kalender', roles: ['admin', 'mitarbeiter'] },
		{ icon: 'file-text', label: 'Angebote', href: '/angebote', roles: ['admin', 'mitarbeiter'] },
		{ icon: 'alert', label: 'Maengel', href: '/maengel', roles: ['admin', 'mitarbeiter', 'nachunternehmer'] },
		{ icon: 'file-plus', label: 'Nachtraege', href: '/nachtraege', roles: ['admin', 'mitarbeiter', 'nachunternehmer'] },
		{ icon: 'euro', label: 'Finanzen', href: '/finanzen', roles: ['admin', 'mitarbeiter'] },

		// Einkauf als Gruppe mit Untermenü
		{
			icon: 'package',
			label: 'Einkauf',
			roles: ['admin', 'mitarbeiter'],
			children: [
				{ icon: 'list', label: 'Übersicht', href: '/einkauf', roles: ['admin', 'mitarbeiter'] },
				{ icon: 'cart', label: 'Bestellung', href: '/bestellung', roles: ['admin', 'mitarbeiter'] },
				{ icon: 'clipboard', label: 'Bestellungen', href: '/bestellungen', roles: ['admin', 'mitarbeiter'] },
				{ icon: 'chart', label: 'LV-Export', href: '/lv-export', roles: ['admin', 'mitarbeiter'] },
			]
		},

		{ icon: 'users', label: 'Kontakte', href: '/kontakte', roles: ['admin', 'mitarbeiter'] },
		{ icon: 'target', label: 'Leads', href: '/leads', roles: ['admin', 'mitarbeiter'] },
		{ icon: 'megaphone', label: 'Marketing', href: '/marketing', roles: ['admin', 'mitarbeiter'] },
		{ icon: 'checklist', label: 'Aufgaben', href: '/aufgaben', roles: ['admin', 'mitarbeiter'] },
		{ icon: 'wrench', label: 'Nachunternehmer', href: '/nachunternehmer', roles: ['admin', 'mitarbeiter'] },
		{ icon: 'user-check', label: 'Bewerber', href: '/bewerber', roles: ['admin', 'mitarbeiter'] },

		// Kunden
		{ icon: 'building', label: 'Bauvorhaben', href: '/bauvorhaben', roles: ['kunde'] },
		{ icon: 'mail', label: 'Angebote', href: '/angebote', roles: ['kunde'] },
		{ icon: 'euro', label: 'Rechnungen', href: '/rechnungen', roles: ['kunde'] },
		{ icon: 'user', label: 'Ansprechpartner', href: '/ansprechpartner', roles: ['kunde'] },

		// Nachunternehmer
		{ icon: 'plus', label: 'Auftraege', href: '/auftraege', roles: ['nachunternehmer'] },
		{ icon: 'euro', label: 'Rechnungen', href: '/rechnungen', roles: ['nachunternehmer'] },
		{ icon: 'list', label: 'LVs', href: '/lvs', roles: ['nachunternehmer'] },
		{ icon: 'file-check', label: 'Nachweise', href: '/nachweise', roles: ['nachunternehmer'] },

		// Hilfe (alle Rollen)
		{ icon: 'help', label: 'Hilfe', href: '/hilfe', roles: ['admin', 'mitarbeiter', 'kunde', 'nachunternehmer'] },
	];

	// Gefilterte Entries für aktuelle Rolle
	let filteredEntries = $derived(
		menuEntries
			.filter(entry => entry.roles.includes(userRole))
			.map(entry => {
				if (isMenuGroup(entry)) {
					return {
						...entry,
						children: entry.children.filter(child => child.roles.includes(userRole))
					};
				}
				return entry;
			})
			.filter((entry, index, self) => {
				// Duplikate entfernen (gleiche href bei Items)
				if (!isMenuGroup(entry)) {
					return self.findIndex(i => !isMenuGroup(i) && i.href === entry.href) === index;
				}
				return true;
			})
	);

	// Prüfen ob eine Gruppe aktiv ist (eines der Kinder ist aktiv)
	function isGroupActive(group: MenuGroup): boolean {
		return group.children.some(child => isActive(child.href));
	}

	function isActive(href: string): boolean {
		if (href === '/') {
			return page.url.pathname === '/';
		}
		return page.url.pathname.startsWith(href);
	}

	let userInitial = $derived(userName?.[0] || userEmail?.[0]?.toUpperCase() || '?');

	// SVG Icons
	const icons: Record<string, string> = {
		home: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>`,
		building: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>`,
		calendar: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>`,
		alert: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>`,
		'file-plus': `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>`,
		euro: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.121 15.536c-1.171 1.952-3.07 1.952-4.242 0-1.172-1.953-1.172-5.119 0-7.072 1.171-1.952 3.07-1.952 4.242 0M8 10.5h4m-4 3h4"/>`,
		package: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>`,
		users: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>`,
		target: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>`,
		megaphone: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/>`,
		checklist: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>`,
		wrench: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>`,
		mail: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>`,
		user: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>`,
		plus: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>`,
		list: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>`,
		'file-check': `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>`,
		'file-text': `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>`,
		cart: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>`,
		clipboard: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>`,
		chart: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>`,
		'user-check': `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11l2 2 4-4"/>`,
		chevronLeft: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>`,
		chevronRight: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>`,
		chevronDown: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>`,
		logout: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>`,
		help: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>`,
	};
</script>

<aside class="sidebar" class:collapsed={isCollapsed}>
	<div class="sidebar-header">
		<a href="/" class="logo">
			{#if isCollapsed}
				<img src="/logo-neurealis.png" alt="neurealis" class="logo-img-small" />
			{:else}
				<img src="/logo-neurealis.png" alt="neurealis" class="logo-img" />
				<span class="logo-badge">ERP</span>
			{/if}
		</a>
		<button class="toggle-btn" onclick={onToggle} aria-label="Sidebar umschalten">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
				{@html isCollapsed ? icons.chevronRight : icons.chevronLeft}
			</svg>
		</button>
	</div>

	<nav class="sidebar-nav">
		{#each filteredEntries as entry}
			{#if isMenuGroup(entry)}
				<!-- Menu-Gruppe mit Untermenü -->
				<div class="nav-group" class:open={isSubmenuOpen(entry.label)} class:active={isGroupActive(entry)}>
					<button
						class="nav-item nav-group-toggle"
						class:active={isGroupActive(entry)}
						onclick={() => toggleSubmenu(entry.label)}
						title={isCollapsed ? entry.label : undefined}
					>
						<svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20">
							{@html icons[entry.icon] || icons.home}
						</svg>
						{#if !isCollapsed}
							<span class="nav-label">{entry.label}</span>
							<svg class="nav-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
								{@html icons.chevronDown}
							</svg>
						{/if}
					</button>
					{#if !isCollapsed && isSubmenuOpen(entry.label)}
						<div class="nav-submenu">
							{#each entry.children as child}
								<a
									href={child.href}
									class="nav-item nav-subitem"
									class:active={isActive(child.href)}
								>
									<svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18">
										{@html icons[child.icon] || icons.home}
									</svg>
									<span class="nav-label">{child.label}</span>
									{#if isHolger && isWorkInProgress(child.href)}
										<span class="wip-badge" title="Work in Progress"></span>
									{/if}
								</a>
							{/each}
						</div>
					{/if}
				</div>
			{:else}
				<!-- Normales Menu-Item -->
				<a
					href={entry.href}
					class="nav-item"
					class:active={isActive(entry.href)}
					title={isCollapsed ? entry.label : undefined}
				>
					<svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20">
						{@html icons[entry.icon] || icons.home}
					</svg>
					{#if !isCollapsed}
						<span class="nav-label">{entry.label}</span>
						{#if isHolger && isWorkInProgress(entry.href)}
							<span class="wip-badge" title="Work in Progress"></span>
						{/if}
					{/if}
				</a>
			{/if}
		{/each}
	</nav>

	{#if userEmail}
		<div class="sidebar-footer">
			<div class="sidebar-user">
				<div class="user-avatar">
					{userInitial}
				</div>
				{#if !isCollapsed}
					<div class="user-info">
						<span class="user-name">{userName || 'Benutzer'}</span>
						<span class="user-email">{userEmail}</span>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</aside>

<style>
	/* Sidebar - Softr hellrosa Design */
	.sidebar {
		width: var(--sidebar-width);
		height: 100vh;
		background-color: var(--color-sidebar-bg);
		display: flex;
		flex-direction: column;
		position: fixed;
		left: 0;
		top: 0;
		z-index: 50;
		transition: width 0.2s ease;
		border-right: 1px solid var(--color-sidebar-border);
	}

	.sidebar.collapsed {
		width: var(--sidebar-width-collapsed);
	}

	/* Header */
	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
		border-bottom: 1px solid var(--color-sidebar-border);
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		color: var(--color-sidebar-text);
	}

	.logo-img {
		height: 28px;
		width: auto;
		object-fit: contain;
	}

	.logo-img-small {
		height: 24px;
		width: auto;
		object-fit: contain;
	}

	.logo-badge {
		font-size: 0.65rem;
		font-weight: 600;
		background: var(--color-primary);
		color: white;
		padding: 0.15rem 0.4rem;
		border-radius: var(--radius-sm);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.toggle-btn {
		background: transparent;
		border: 1px solid var(--color-sidebar-border);
		color: var(--color-sidebar-text-muted);
		width: 28px;
		height: 28px;
		cursor: pointer;
		font-size: 0.9rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-md);
		transition: all 0.15s ease;
	}

	.toggle-btn:hover {
		background: var(--color-sidebar-hover-bg);
		color: var(--color-primary);
		border-color: var(--color-primary-200);
	}

	/* Navigation */
	.sidebar-nav {
		flex: 1;
		padding: 0.75rem 0.5rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		color: var(--color-sidebar-text);
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 500;
		transition: all 0.15s ease;
		border-radius: var(--radius-md);
	}

	.sidebar.collapsed .nav-item {
		justify-content: center;
		padding: 0.75rem;
	}

	.nav-item:hover {
		color: var(--color-primary);
		background: var(--color-sidebar-hover-bg);
	}

	.nav-item.active {
		color: var(--color-sidebar-active-text);
		background: var(--color-sidebar-active-bg);
		font-weight: 600;
	}

	.nav-icon {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
	}

	.nav-label {
		white-space: nowrap;
		flex: 1;
	}

	/* Gruppen mit Submenu */
	.nav-group {
		display: flex;
		flex-direction: column;
	}

	.nav-group-toggle {
		width: 100%;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
	}

	.nav-chevron {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
		transition: transform 0.2s ease;
		margin-left: auto;
	}

	.nav-group.open .nav-chevron {
		transform: rotate(180deg);
	}

	.nav-submenu {
		display: flex;
		flex-direction: column;
		margin-left: 0.5rem;
		padding-left: 0.75rem;
		border-left: 2px solid var(--color-sidebar-border);
		margin-top: 0.25rem;
		margin-bottom: 0.25rem;
	}

	.nav-subitem {
		padding: 0.5rem 0.75rem;
		font-size: 0.85rem;
	}

	.nav-subitem .nav-icon {
		width: 18px;
		height: 18px;
	}

	.nav-group.active > .nav-group-toggle {
		color: var(--color-primary);
	}

	.nav-submenu .nav-item.active {
		background: var(--color-sidebar-active-bg);
		color: var(--color-sidebar-active-text);
		font-weight: 600;
		border-radius: var(--radius-md);
	}

	/* WIP Badge - Work in Progress Indikator */
	.wip-badge {
		display: inline-block;
		width: 8px;
		height: 8px;
		background-color: #f59e0b;
		border-radius: 2px;
		margin-left: 6px;
		flex-shrink: 0;
	}

	/* Footer / User */
	.sidebar-footer {
		padding: 1rem;
		border-top: 1px solid var(--color-sidebar-border);
	}

	.sidebar-user {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.user-avatar {
		width: 36px;
		height: 36px;
		background: var(--color-primary);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 1rem;
		flex-shrink: 0;
		border-radius: var(--radius-full);
	}

	.user-info {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.user-name {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--color-sidebar-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.user-email {
		font-size: 0.75rem;
		color: var(--color-sidebar-text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Mobile: Sidebar versteckt */
	@media (max-width: 1024px) {
		.sidebar {
			transform: translateX(-100%);
		}

		.sidebar.collapsed {
			transform: translateX(-100%);
		}
	}
</style>
