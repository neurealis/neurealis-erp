<script lang="ts">
	import { page } from '$app/state';

	interface Props {
		user?: { email: string; name?: string } | null;
		sidebarCollapsed?: boolean;
		onMenuToggle?: () => void;
	}

	let { user, sidebarCollapsed = false, onMenuToggle }: Props = $props();

	let searchQuery = $state('');
	let showUserMenu = $state(false);

	function toggleUserMenu() {
		showUserMenu = !showUserMenu;
	}

	function closeUserMenu() {
		showUserMenu = false;
	}

	// Breadcrumb aus URL generieren
	let breadcrumbs = $derived(() => {
		const path = page.url.pathname;
		if (path === '/') return [{ label: 'Startseite', href: '/' }];

		const segments = path.split('/').filter(Boolean);
		const crumbs = [{ label: 'Startseite', href: '/' }];

		let currentPath = '';
		for (const segment of segments) {
			currentPath += '/' + segment;
			// Segment in lesbaren Namen umwandeln
			const label = segment
				.replace(/-/g, ' ')
				.replace(/\b\w/g, c => c.toUpperCase());
			crumbs.push({ label, href: currentPath });
		}

		return crumbs;
	});
</script>

<header class="header" class:sidebar-collapsed={sidebarCollapsed}>
	<div class="header-left">
		<button class="menu-toggle" onclick={onMenuToggle} aria-label="Menü öffnen">
			<span class="menu-icon">☰</span>
		</button>

		<nav class="breadcrumb" aria-label="Breadcrumb">
			{#each breadcrumbs() as crumb, i}
				{#if i > 0}
					<span class="breadcrumb-separator">/</span>
				{/if}
				{#if i === breadcrumbs().length - 1}
					<span class="breadcrumb-current">{crumb.label}</span>
				{:else}
					<a href={crumb.href} class="breadcrumb-link">{crumb.label}</a>
				{/if}
			{/each}
		</nav>
	</div>

	<div class="header-center">
		<div class="search-box">
			<span class="search-icon">🔍</span>
			<input
				type="search"
				placeholder="Suchen..."
				bind:value={searchQuery}
				class="search-input"
			/>
		</div>
	</div>

	<div class="header-right">
		{#if user}
			<div class="user-menu-container">
				<button class="user-button" onclick={toggleUserMenu}>
					<span class="user-avatar">
						{user.name?.[0] || user.email[0].toUpperCase()}
					</span>
					<span class="user-name">{user.name || user.email}</span>
					<span class="dropdown-arrow">▼</span>
				</button>

				{#if showUserMenu}
					<div class="user-dropdown">
						<div class="dropdown-header">
							<span class="dropdown-email">{user.email}</span>
						</div>
						<a href="/profil" class="dropdown-item" onclick={closeUserMenu}>
							👤 Profil
						</a>
						<a href="/einstellungen" class="dropdown-item" onclick={closeUserMenu}>
							⚙️ Einstellungen
						</a>
						<hr class="dropdown-divider" />
						<a href="/logout" class="dropdown-item logout">
							🚪 Abmelden
						</a>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</header>

<style>
	.header {
		height: var(--header-height);
		background: white;
		border-bottom: 1px solid var(--color-gray-200);
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 1.5rem;
		position: fixed;
		top: 0;
		left: var(--sidebar-width);
		right: 0;
		z-index: 40;
		transition: left 0.2s ease;
	}

	.header.sidebar-collapsed {
		left: var(--sidebar-width-collapsed);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.menu-toggle {
		display: none;
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0.5rem;
		color: var(--color-gray-600);
	}

	.menu-toggle:hover {
		color: var(--color-gray-900);
	}

	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
	}

	.breadcrumb-link {
		color: var(--color-gray-500);
		text-decoration: none;
	}

	.breadcrumb-link:hover {
		color: var(--color-brand-medium);
	}

	.breadcrumb-separator {
		color: var(--color-gray-300);
	}

	.breadcrumb-current {
		color: var(--color-gray-800);
		font-weight: 500;
	}

	.header-center {
		flex: 1;
		max-width: 400px;
		margin: 0 2rem;
	}

	.search-box {
		display: flex;
		align-items: center;
		background: var(--color-gray-100);
		border: 1px solid transparent;
		padding: 0.5rem 1rem;
		transition: all 0.2s ease;
	}

	.search-box:focus-within {
		background: white;
		border-color: var(--color-brand-light);
	}

	.search-icon {
		color: var(--color-gray-400);
		margin-right: 0.5rem;
	}

	.search-input {
		flex: 1;
		border: none;
		background: none;
		font-size: 0.9rem;
		outline: none;
		padding: 0;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.user-menu-container {
		position: relative;
	}

	.user-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.25rem 0.5rem;
	}

	.user-button:hover {
		background: var(--color-gray-100);
	}

	.user-avatar {
		width: 32px;
		height: 32px;
		background: var(--color-brand-medium);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 0.9rem;
	}

	.user-name {
		font-size: 0.9rem;
		color: var(--color-gray-700);
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dropdown-arrow {
		font-size: 0.6rem;
		color: var(--color-gray-400);
	}

	.user-dropdown {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 0.5rem;
		background: white;
		border: 1px solid var(--color-gray-200);
		box-shadow: var(--shadow-lg);
		min-width: 200px;
		z-index: var(--z-dropdown);
	}

	.dropdown-header {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-gray-100);
	}

	.dropdown-email {
		font-size: 0.8rem;
		color: var(--color-gray-500);
	}

	.dropdown-item {
		display: block;
		padding: 0.75rem 1rem;
		color: var(--color-gray-700);
		text-decoration: none;
		font-size: 0.9rem;
	}

	.dropdown-item:hover {
		background: var(--color-gray-50);
	}

	.dropdown-item.logout {
		color: var(--color-error);
	}

	.dropdown-divider {
		border: none;
		border-top: 1px solid var(--color-gray-100);
		margin: 0;
	}

	/* Mobile */
	@media (max-width: 1024px) {
		.header {
			left: 0;
		}

		.header.sidebar-collapsed {
			left: 0;
		}

		.menu-toggle {
			display: flex;
		}

		.header-center {
			display: none;
		}

		.user-name {
			display: none;
		}

		.breadcrumb {
			display: none;
		}
	}
</style>
