<script lang="ts">
	// Startseite - leitet später zu Login oder Dashboard weiter
</script>

<div class="welcome">
	<div class="card welcome-card">
		<h1>neurealis ERP</h1>
		<p>Wohnungssanierung Management System</p>
		<div class="links">
			<a href="/bestellung" class="btn btn-primary">Neue Bestellung</a>
		</div>
	</div>
</div>

<style>
	.welcome {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-4);
	}

	.welcome-card {
		padding: var(--spacing-8);
		text-align: center;
		max-width: 400px;
	}

	.welcome-card h1 {
		color: var(--color-brand-dark);
		margin-bottom: var(--spacing-2);
	}

	.welcome-card p {
		color: var(--color-gray-500);
		margin-bottom: var(--spacing-6);
	}

	.links {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}
</style>
