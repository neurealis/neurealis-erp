<script lang="ts">
	import { page } from '$app/state';

	interface Props {
		userRole?: string;
	}

	let { userRole = 'mitarbeiter' }: Props = $props();

	// Mobile Navigation Items (max 5)
	const navConfigs: Record<string, { icon: string; label: string; href: string }[]> = {
		mitarbeiter: [
			{ icon: '🏠', label: 'Start', href: '/' },
			{ icon: '🏗️', label: 'BVs', href: '/bauvorhaben' },
			{ icon: '⚠️', label: 'Mängel', href: '/maengel' },
			{ icon: '📝', label: 'Nachträge', href: '/nachtraege' },
			{ icon: '💰', label: 'Finanzen', href: '/finanzen' },
		],
		admin: [
			{ icon: '🏠', label: 'Start', href: '/' },
			{ icon: '🏗️', label: 'BVs', href: '/bauvorhaben' },
			{ icon: '⚠️', label: 'Mängel', href: '/maengel' },
			{ icon: '📝', label: 'Nachträge', href: '/nachtraege' },
			{ icon: '💰', label: 'Finanzen', href: '/finanzen' },
		],
		kunde: [
			{ icon: '🏠', label: 'Start', href: '/' },
			{ icon: '🏗️', label: 'BVs', href: '/bauvorhaben' },
			{ icon: '✉️', label: 'Angebote', href: '/angebote' },
			{ icon: '💰', label: 'Rechnungen', href: '/rechnungen' },
			{ icon: '👤', label: 'Kontakt', href: '/ansprechpartner' },
		],
		nachunternehmer: [
			{ icon: '🏠', label: 'Start', href: '/' },
			{ icon: '➕', label: 'Aufträge', href: '/auftraege' },
			{ icon: '⚠️', label: 'Mängel', href: '/maengel' },
			{ icon: '💰', label: 'Rechnungen', href: '/rechnungen' },
			{ icon: '📄', label: 'Nachweise', href: '/nachweise' },
		],
	};

	let items = $derived(navConfigs[userRole] || navConfigs.mitarbeiter);

	function isActive(href: string): boolean {
		if (href === '/') {
			return page.url.pathname === '/';
		}
		return page.url.pathname.startsWith(href);
	}
</script>

<nav class="bottom-nav">
	{#each items as item}
		<a
			href={item.href}
			class="nav-item"
			class:active={isActive(item.href)}
		>
			<span class="nav-icon">{item.icon}</span>
			<span class="nav-label">{item.label}</span>
		</a>
	{/each}
</nav>

<style>
	.bottom-nav {
		display: none;
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		height: var(--bottom-nav-height);
		background: white;
		border-top: 1px solid var(--color-gray-200);
		z-index: 50;
	}

	@media (max-width: 1024px) {
		.bottom-nav {
			display: flex;
			justify-content: space-around;
			align-items: center;
		}
	}

	.nav-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		padding: 0.5rem 1rem;
		color: var(--color-gray-500);
		text-decoration: none;
		min-width: 64px;
		transition: color 0.15s ease;
	}

	.nav-item:hover {
		color: var(--color-gray-700);
	}

	.nav-item.active {
		color: var(--color-brand-medium);
	}

	.nav-icon {
		font-size: 1.25rem;
	}

	.nav-label {
		font-size: 0.7rem;
		font-weight: 500;
	}
</style>
