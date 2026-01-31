<script lang="ts">
	import { Card, Badge, Button } from '$lib/components/ui';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	// State
	let loading = $state(true);
	let error = $state<string | null>(null);
	let angebote = $state<Array<{
		id: string;
		angebotsnummer: string;
		projekt_id: string;
		projektname: string;
		auftraggeber: string;
		lv_typ: string;
		status: string;
		summe_netto: number;
		summe_brutto: number;
		erstellt_am: string;
		gueltig_bis: string;
	}>>([]);

	// Filter
	let searchQuery = $state('');
	let filterStatus = $state<string>('alle');

	// Derived: Gefilterte Angebote
	let gefiltert = $derived.by(() => {
		const query = searchQuery.toLowerCase().trim();
		return angebote.filter(a => {
			if (query && !a.angebotsnummer?.toLowerCase().includes(query) &&
				!a.projektname?.toLowerCase().includes(query) &&
				!a.auftraggeber?.toLowerCase().includes(query)) {
				return false;
			}
			if (filterStatus !== 'alle' && a.status !== filterStatus) return false;
			return true;
		});
	});

	// Stats
	let stats = $derived({
		gesamt: angebote.length,
		offen: angebote.filter(a => a.status === 'entwurf').length,
		gesendet: angebote.filter(a => a.status === 'gesendet').length,
		angenommen: angebote.filter(a => a.status === 'angenommen').length,
		abgelehnt: angebote.filter(a => a.status === 'abgelehnt').length,
		summeOffen: angebote.filter(a => a.status === 'gesendet').reduce((sum, a) => sum + (a.summe_netto || 0), 0)
	});

	async function loadAngebote() {
		loading = true;
		error = null;

		try {
			const { data, error: fetchError } = await supabase
				.from('angebote')
				.select(`
					id,
					angebotsnummer,
					projekt_id,
					projektname,
					auftraggeber,
					lv_typ,
					status,
					summe_netto,
					summe_brutto,
					erstellt_am,
					gueltig_bis
				`)
				.order('erstellt_am', { ascending: false });

			if (fetchError) throw fetchError;
			angebote = data || [];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Fehler beim Laden';
			console.error('Angebote laden fehlgeschlagen:', err);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadAngebote();
	});

	function formatCurrency(value: number | null): string {
		if (value === null || value === undefined) return '-';
		return new Intl.NumberFormat('de-DE', {
			style: 'currency',
			currency: 'EUR',
			minimumFractionDigits: 2
		}).format(value);
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
	}

	function getStatusVariant(status: string): 'default' | 'warning' | 'success' | 'error' | 'info' {
		switch (status) {
			case 'entwurf': return 'default';
			case 'gesendet': return 'info';
			case 'angenommen': return 'success';
			case 'abgelehnt': return 'error';
			default: return 'default';
		}
	}

	function getStatusLabel(status: string): string {
		switch (status) {
			case 'entwurf': return 'Entwurf';
			case 'gesendet': return 'Gesendet';
			case 'angenommen': return 'Angenommen';
			case 'abgelehnt': return 'Abgelehnt';
			default: return status;
		}
	}

	function getLvTypVariant(typ: string | null): 'info' | 'warning' | 'success' | 'error' | 'default' {
		if (!typ) return 'default';
		if (typ === 'GWS') return 'info';
		if (typ === 'VBW') return 'success';
		if (typ === 'covivio') return 'warning';
		if (typ === 'neurealis') return 'error';
		return 'default';
	}
</script>

<svelte:head>
	<title>Angebote - neurealis ERP</title>
</svelte:head>

<div class="page-container">
	<header class="page-header">
		<div class="header-left">
			<h1>Angebote</h1>
			<p class="subtitle">Angebotsverwaltung und CPQ-System</p>
		</div>
		<div class="header-right">
			<Button variant="primary" onclick={() => goto('/angebote/neu')}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="12" y1="5" x2="12" y2="19"/>
					<line x1="5" y1="12" x2="19" y2="12"/>
				</svg>
				Neues Angebot
			</Button>
		</div>
	</header>

	<!-- Stats -->
	<div class="stats-grid">
		<div class="stat-card">
			<div class="stat-value">{stats.gesamt}</div>
			<div class="stat-label">Gesamt</div>
		</div>
		<div class="stat-card">
			<div class="stat-value">{stats.offen}</div>
			<div class="stat-label">Entwürfe</div>
		</div>
		<div class="stat-card">
			<div class="stat-value">{stats.gesendet}</div>
			<div class="stat-label">Gesendet</div>
		</div>
		<div class="stat-card highlight">
			<div class="stat-value">{formatCurrency(stats.summeOffen)}</div>
			<div class="stat-label">Offenes Volumen</div>
		</div>
	</div>

	<!-- Filter -->
	<Card padding="sm">
		<div class="filter-bar">
			<div class="search-wrapper">
				<svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="11" cy="11" r="8"/>
					<path d="m21 21-4.35-4.35"/>
				</svg>
				<input
					type="text"
					class="search-input"
					placeholder="Suche nach Angebotsnummer, Projekt, Auftraggeber..."
					bind:value={searchQuery}
				/>
			</div>
			<select class="filter-select" bind:value={filterStatus}>
				<option value="alle">Alle Status</option>
				<option value="entwurf">Entwurf</option>
				<option value="gesendet">Gesendet</option>
				<option value="angenommen">Angenommen</option>
				<option value="abgelehnt">Abgelehnt</option>
			</select>
		</div>
	</Card>

	<!-- Content -->
	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Lade Angebote...</p>
		</div>
	{:else if error}
		<div class="error-state">
			<p>{error}</p>
			<Button variant="secondary" onclick={loadAngebote}>Erneut versuchen</Button>
		</div>
	{:else if gefiltert.length === 0}
		<div class="empty-state">
			<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
			</svg>
			<p>Keine Angebote gefunden</p>
			<Button variant="primary" onclick={() => goto('/angebote/neu')}>
				Erstes Angebot erstellen
			</Button>
		</div>
	{:else}
		<div class="table-wrapper">
			<table class="data-table">
				<thead>
					<tr>
						<th>Angebotsnr.</th>
						<th>Projekt</th>
						<th>Auftraggeber</th>
						<th>LV-Typ</th>
						<th>Status</th>
						<th class="text-right">Netto</th>
						<th>Erstellt</th>
						<th>Gültig bis</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each gefiltert as angebot}
						<tr onclick={() => goto(`/angebote/${angebot.id}`)}>
							<td class="angebotsnummer">{angebot.angebotsnummer}</td>
							<td class="projektname">{angebot.projektname || '-'}</td>
							<td>{angebot.auftraggeber || '-'}</td>
							<td>
								{#if angebot.lv_typ}
									<Badge variant={getLvTypVariant(angebot.lv_typ)} size="sm">
										{angebot.lv_typ}
									</Badge>
								{:else}
									-
								{/if}
							</td>
							<td>
								<Badge variant={getStatusVariant(angebot.status)} size="sm">
									{getStatusLabel(angebot.status)}
								</Badge>
							</td>
							<td class="text-right currency">{formatCurrency(angebot.summe_netto)}</td>
							<td class="date">{formatDate(angebot.erstellt_am)}</td>
							<td class="date">{formatDate(angebot.gueltig_bis)}</td>
							<td class="actions">
								<button class="action-btn" title="Bearbeiten">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
										<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
									</svg>
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.page-container {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.page-header h1 {
		margin: 0;
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--color-gray-900);
	}

	.subtitle {
		margin: 0.25rem 0 0;
		font-size: 0.9rem;
		color: var(--color-gray-500);
	}

	.header-right {
		display: flex;
		gap: 0.75rem;
	}

	/* Stats */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
	}

	.stat-card {
		background: white;
		border: 1px solid var(--color-gray-200);
		padding: 1.25rem;
	}

	.stat-card.highlight {
		background: var(--color-brand-light, #FFF5F5);
		border-color: var(--color-brand-medium, #C41E3A);
	}

	.stat-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-gray-900);
	}

	.stat-label {
		font-size: 0.8rem;
		color: var(--color-gray-500);
		margin-top: 0.25rem;
	}

	/* Filter */
	.filter-bar {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.search-wrapper {
		flex: 1;
		position: relative;
	}

	.search-icon {
		position: absolute;
		left: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		color: var(--color-gray-400);
	}

	.search-input {
		width: 100%;
		padding: 0.6rem 0.75rem 0.6rem 2.5rem;
		border: 1px solid var(--color-gray-300);
		font-size: 0.9rem;
	}

	.search-input:focus {
		outline: none;
		border-color: var(--color-brand-medium);
	}

	.filter-select {
		padding: 0.6rem 2rem 0.6rem 0.75rem;
		border: 1px solid var(--color-gray-300);
		background: white;
		font-size: 0.9rem;
		cursor: pointer;
	}

	/* Table */
	.table-wrapper {
		background: white;
		border: 1px solid var(--color-gray-200);
		overflow-x: auto;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	.data-table th {
		padding: 0.75rem 1rem;
		text-align: left;
		font-weight: 600;
		color: var(--color-gray-600);
		background: var(--color-gray-50);
		border-bottom: 1px solid var(--color-gray-200);
		white-space: nowrap;
	}

	.data-table td {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-gray-100);
	}

	.data-table tbody tr {
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.data-table tbody tr:hover {
		background: var(--color-gray-50);
	}

	.text-right {
		text-align: right;
	}

	.angebotsnummer {
		font-family: var(--font-family-mono, monospace);
		font-weight: 600;
		color: var(--color-brand-medium);
	}

	.projektname {
		font-weight: 500;
		color: var(--color-gray-800);
	}

	.currency {
		font-variant-numeric: tabular-nums;
		font-weight: 500;
	}

	.date {
		color: var(--color-gray-500);
		white-space: nowrap;
	}

	.actions {
		width: 40px;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: none;
		background: transparent;
		color: var(--color-gray-500);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.action-btn:hover {
		background: var(--color-gray-100);
		color: var(--color-gray-700);
	}

	/* States */
	.loading-state,
	.error-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		background: white;
		border: 1px solid var(--color-gray-200);
		text-align: center;
		gap: 1rem;
	}

	.loading-state p,
	.error-state p,
	.empty-state p {
		color: var(--color-gray-500);
		margin: 0;
	}

	.empty-state svg {
		color: var(--color-gray-300);
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--color-gray-200);
		border-top-color: var(--color-brand-medium);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* Mobile */
	@media (max-width: 768px) {
		.page-header {
			flex-direction: column;
		}

		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.filter-bar {
			flex-direction: column;
		}

		.search-wrapper,
		.filter-select {
			width: 100%;
		}

		.data-table th:nth-child(3),
		.data-table td:nth-child(3),
		.data-table th:nth-child(7),
		.data-table td:nth-child(7),
		.data-table th:nth-child(8),
		.data-table td:nth-child(8) {
			display: none;
		}
	}
</style>
