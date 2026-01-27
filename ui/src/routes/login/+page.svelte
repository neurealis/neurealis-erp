<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';

	let { data } = $props();

	let loading = $state(false);
	let error = $state<string | null>(null);

	// Wenn bereits eingeloggt, zur Startseite weiterleiten
	$effect(() => {
		if (data.session) {
			goto('/');
		}
	});

	async function signInWithMicrosoft() {
		loading = true;
		error = null;

		const { data: authData, error: authError } = await data.supabase.auth.signInWithOAuth({
			provider: 'azure',
			options: {
				scopes: 'email profile',
				redirectTo: `${window.location.origin}/auth/callback`
			}
		});

		if (authError) {
			error = authError.message;
			loading = false;
		}
	}
</script>

<div class="login-container">
	<div class="login-card">
		<div class="login-header">
			<img src="/neurealis-logo.svg" alt="neurealis" class="logo" onerror={(e) => e.currentTarget.style.display = 'none'} />
			<h1>neurealis ERP</h1>
			<p>Anmelden mit deinem Microsoft-Konto</p>
		</div>

		{#if error}
			<div class="error-message">
				{error}
			</div>
		{/if}

		<button
			class="microsoft-button"
			onclick={signInWithMicrosoft}
			disabled={loading}
		>
			{#if loading}
				<span class="spinner"></span>
				Wird weitergeleitet...
			{:else}
				<svg class="microsoft-icon" viewBox="0 0 21 21" fill="none">
					<rect x="1" y="1" width="9" height="9" fill="#F25022"/>
					<rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
					<rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
					<rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
				</svg>
				Mit Microsoft anmelden
			{/if}
		</button>

		<p class="hint">Nur für neurealis-Mitarbeiter (@neurealis.de)</p>
	</div>
</div>

<style>
	.login-container {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-gray-800);
		padding: 1rem;
	}

	.login-card {
		background: white;
		padding: 2.5rem;
		border-radius: 0;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
		width: 100%;
		max-width: 400px;
		text-align: center;
	}

	.login-header {
		margin-bottom: 2rem;
	}

	.logo {
		height: 48px;
		margin-bottom: 1rem;
	}

	h1 {
		margin: 0 0 0.5rem;
		font-size: 1.75rem;
		color: var(--color-gray-800);
		font-weight: 600;
	}

	.login-header p {
		color: #666;
		margin: 0;
		font-size: 0.95rem;
	}

	.error-message {
		background: var(--color-error-light);
		color: var(--color-error-dark);
		padding: 0.75rem 1rem;
		border-radius: 0;
		margin-bottom: 1.5rem;
		font-size: 0.875rem;
	}

	.microsoft-button {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 0.875rem 1.5rem;
		font-size: 1rem;
		font-weight: 500;
		color: var(--color-gray-800);
		background: white;
		border: 1px solid var(--color-gray-400);
		border-radius: 0;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.microsoft-button:hover:not(:disabled) {
		background: var(--color-gray-100);
		border-color: var(--color-gray-800);
	}

	.microsoft-button:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.microsoft-icon {
		width: 21px;
		height: 21px;
		flex-shrink: 0;
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2px solid var(--color-gray-200);
		border-top-color: var(--color-gray-800);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.hint {
		margin: 1.5rem 0 0;
		font-size: 0.8rem;
		color: #888;
	}
</style>
