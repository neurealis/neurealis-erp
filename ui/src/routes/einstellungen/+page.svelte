<script lang="ts">
	// SVG-Icon Paths
	const icons = {
		shield: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>',
		users: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>',
		settings: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>',
		arrowRight: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>'
	};

	interface SettingsTile {
		title: string;
		description: string;
		href: string;
		icon: string;
		disabled?: boolean;
	}

	const tiles: SettingsTile[] = [
		{
			title: 'Rollen & Rechte',
			description: 'Benutzerrollen, Berechtigungen und Zuweisungen verwalten',
			href: '/einstellungen/rollen',
			icon: 'shield'
		},
		{
			title: 'Benutzer',
			description: 'Benutzerkonten und Rollenzuweisungen',
			href: '/einstellungen/rollen?tab=benutzer',
			icon: 'users'
		},
		{
			title: 'System',
			description: 'Systemeinstellungen (demnächst)',
			href: '#',
			icon: 'settings',
			disabled: true
		}
	];
</script>

<svelte:head>
	<title>Einstellungen - neurealis ERP</title>
</svelte:head>

<div class="page-container">
	<!-- Page Header -->
	<div class="page-header">
		<div class="page-header-content">
			<div class="page-header-text">
				<h1 class="page-title">Einstellungen</h1>
				<p class="page-description">System- und Benutzerverwaltung</p>
			</div>
		</div>
	</div>

	<!-- Kachel-Grid -->
	<div class="tiles-grid">
		{#each tiles as tile}
			{#if tile.disabled}
				<div class="tile tile-disabled">
					<div class="tile-icon">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="28" height="28">
							{@html icons[tile.icon as keyof typeof icons]}
						</svg>
					</div>
					<div class="tile-content">
						<h2 class="tile-title">{tile.title}</h2>
						<p class="tile-description">{tile.description}</p>
					</div>
					<div class="tile-arrow">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20">
							{@html icons.arrowRight}
						</svg>
					</div>
				</div>
			{:else}
				<a href={tile.href} class="tile">
					<div class="tile-icon">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="28" height="28">
							{@html icons[tile.icon as keyof typeof icons]}
						</svg>
					</div>
					<div class="tile-content">
						<h2 class="tile-title">{tile.title}</h2>
						<p class="tile-description">{tile.description}</p>
					</div>
					<div class="tile-arrow">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20">
							{@html icons.arrowRight}
						</svg>
					</div>
				</a>
			{/if}
		{/each}
	</div>
</div>

<style>
	.page-container {
		max-width: 1400px;
		margin: 0 auto;
	}

	/* ===== Page Header ===== */
	.page-header {
		margin-bottom: var(--spacing-8);
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

	/* ===== Tiles Grid ===== */
	.tiles-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: var(--spacing-5);
	}

	.tile {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-4);
		padding: var(--spacing-6);
		background: var(--card-bg);
		border: 1px solid var(--card-border);
		border-radius: var(--card-radius);
		box-shadow: var(--card-shadow);
		text-decoration: none;
		color: inherit;
		transition: box-shadow var(--transition-normal), border-color var(--transition-normal);
		cursor: pointer;
	}

	.tile:hover:not(.tile-disabled) {
		box-shadow: var(--shadow-lg);
		border-color: var(--color-gray-300);
	}

	.tile-disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.tile-icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: var(--radius-lg);
		background-color: var(--color-primary-50);
		color: var(--color-primary);
	}

	.tile-disabled .tile-icon {
		background-color: var(--color-gray-100);
		color: var(--color-gray-400);
	}

	.tile-content {
		flex: 1;
		min-width: 0;
	}

	.tile-title {
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
		color: var(--color-gray-900);
		margin: 0 0 var(--spacing-1) 0;
	}

	.tile-disabled .tile-title {
		color: var(--color-gray-500);
	}

	.tile-description {
		font-size: var(--font-size-sm);
		color: var(--color-gray-500);
		margin: 0;
		line-height: var(--line-height-normal);
	}

	.tile-arrow {
		flex-shrink: 0;
		color: var(--color-gray-300);
		margin-top: var(--spacing-1);
		transition: color var(--transition-normal), transform var(--transition-normal);
	}

	.tile:hover:not(.tile-disabled) .tile-arrow {
		color: var(--color-primary);
		transform: translateX(2px);
	}

	/* ===== Responsive ===== */
	@media (max-width: 640px) {
		.page-header {
			margin-bottom: var(--spacing-6);
		}

		.tiles-grid {
			grid-template-columns: 1fr;
		}

		.tile {
			padding: var(--spacing-4);
		}
	}
</style>
