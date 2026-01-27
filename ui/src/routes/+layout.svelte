<script lang="ts">
	import '$lib/styles/global.css';
	import { page } from '$app/state';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';

	let { children, data } = $props();

	// Auth-Änderungen überwachen
	onMount(() => {
		const { data: { subscription } } = data.supabase.auth.onAuthStateChange((event, session) => {
			if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
				invalidate('supabase:auth');
			}
		});

		return () => subscription.unsubscribe();
	});

	// Prüfen ob auf Login-Seite
	let isLoginPage = $derived(page.url.pathname === '/login');
	let isAuthCallback = $derived(page.url.pathname.startsWith('/auth/'));
</script>

<svelte:head>
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>neurealis ERP</title>
</svelte:head>

{#if isLoginPage || isAuthCallback}
	<!-- Login-Seite ohne Header -->
	{@render children()}
{:else if data.user}
	<!-- Eingeloggt: Mit Header -->
	<div class="app-layout">
		<header class="app-header">
			<div class="header-left">
				<a href="/" class="logo-link">
					<span class="logo-text">neurealis</span>
					<span class="logo-badge">ERP</span>
				</a>
			</div>

			<nav class="header-nav">
				<a href="/bestellung" class:active={page.url.pathname === '/bestellung'}>Bestellung</a>
				<a href="/bestellungen" class:active={page.url.pathname === '/bestellungen'}>Übersicht</a>
				<a href="/lv-export" class:active={page.url.pathname === '/lv-export'}>LV-Export</a>
			</nav>

			<div class="header-right">
				<span class="user-email">{data.user.email}</span>
				<a href="/logout" class="logout-button">Abmelden</a>
			</div>
		</header>

		<main class="app-main">
			{@render children()}
		</main>
	</div>
{:else}
	<!-- Nicht eingeloggt: Weiterleitung zu Login -->
	<script>
		window.location.href = '/login';
	</script>
	<div class="loading-screen">
		<p>Weiterleitung zum Login...</p>
	</div>
{/if}

<style>
	.app-layout {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.app-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1.5rem;
		background: var(--color-gray-800);
		color: white;
		position: sticky;
		top: 0;
		z-index: 100;
	}

	.header-left {
		display: flex;
		align-items: center;
	}

	.logo-link {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		color: white;
	}

	.logo-text {
		font-size: 1.25rem;
		font-weight: 600;
	}

	.logo-badge {
		font-size: 0.7rem;
		font-weight: 600;
		background: var(--color-brand-medium);
		padding: 0.2rem 0.5rem;
		border-radius: 0;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.header-nav {
		display: flex;
		gap: 0.5rem;
	}

	.header-nav a {
		color: rgba(255, 255, 255, 0.7);
		text-decoration: none;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		font-size: 0.9rem;
		transition: all 0.2s ease;
	}

	.header-nav a:hover {
		color: white;
		background: rgba(255, 255, 255, 0.1);
	}

	.header-nav a.active {
		color: white;
		background: var(--color-brand-medium);
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.user-email {
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.7);
	}

	.logout-button {
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.7);
		text-decoration: none;
		padding: 0.4rem 0.75rem;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.2);
		transition: all 0.2s ease;
	}

	.logout-button:hover {
		color: white;
		border-color: rgba(255, 255, 255, 0.4);
		background: rgba(255, 255, 255, 0.1);
	}

	.app-main {
		flex: 1;
		padding: 1.5rem;
		background: #f5f5f7;
	}

	.loading-screen {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f5f5f7;
		color: #666;
	}

	/* Mobile */
	@media (max-width: 768px) {
		.app-header {
			flex-wrap: wrap;
			gap: 0.75rem;
			padding: 0.75rem 1rem;
		}

		.header-nav {
			order: 3;
			width: 100%;
			justify-content: center;
		}

		.user-email {
			display: none;
		}
	}
</style>
