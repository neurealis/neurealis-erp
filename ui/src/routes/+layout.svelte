<script lang="ts">
	import '$lib/styles/global.css';
	import { page } from '$app/state';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { AppShell } from '$lib/components/layout';

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

	// User-Objekt mit Rolle (TODO: Rolle aus DB laden)
	let userWithRole = $derived(
		data.user
			? {
					email: data.user.email || '',
					name: data.user.user_metadata?.name || data.user.user_metadata?.full_name,
					role: data.user.user_metadata?.role || 'mitarbeiter'
			  }
			: null
	);
</script>

<svelte:head>
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>neurealis ERP</title>
</svelte:head>

{#if isLoginPage || isAuthCallback}
	<!-- Login-Seite ohne Layout -->
	{@render children()}
{:else if data.user}
	<!-- Eingeloggt: Mit AppShell -->
	<AppShell user={userWithRole}>
		{@render children()}
	</AppShell>
{:else}
	<!-- Nicht eingeloggt: Weiterleitung zu Login -->
	<script>
		window.location.href = '/login';
	</script>
	<div class="loading-screen">
		<div class="loading-content">
			<div class="loading-logo">
				<span class="logo-text">neurealis</span>
				<span class="logo-badge">ERP</span>
			</div>
			<p>Weiterleitung zum Login...</p>
		</div>
	</div>
{/if}

<style>
	.loading-screen {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-gray-50);
	}

	.loading-content {
		text-align: center;
	}

	.loading-logo {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.logo-text {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--color-gray-800);
	}

	.logo-badge {
		font-size: 0.7rem;
		font-weight: 600;
		background: var(--color-brand-medium);
		color: white;
		padding: 0.2rem 0.5rem;
		text-transform: uppercase;
	}

	.loading-content p {
		color: var(--color-gray-500);
		font-size: 0.9rem;
	}
</style>
