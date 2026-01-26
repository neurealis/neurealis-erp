<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';

	interface Bestellung {
		id: string;
		bestell_nr: number;
		atbs_nummer: string;
		projekt_name: string | null;
		status: string;
		summe_netto: number;
		anzahl_positionen: number;
		created_at: string;
		bestellt_am: string | null;
		gewuenschtes_lieferdatum: string | null;
		lieferort: string;
		bestellt_von_name: string | null;
		grosshaendler: {
			name: string;
			kurzname: string;
			typ: string;
		} | null;
	}

	let bestellungen = $state<Bestellung[]>([]);
	let isLoading = $state(true);
	let errorMessage = $state('');

	// Filter
	let filterStatus = $state<string | null>(null);
	let filterProjekt = $state('');
	let filterHaendler = $state('');
	let sortBy = $state<'created_at' | 'bestell_nr' | 'summe_netto'>('created_at');
	let sortDir = $state<'asc' | 'desc'>('desc');

	const statusLabels: Record<string, { label: string; color: string }> = {
		'entwurf': { label: 'Entwurf', color: 'gray' },
		'gesendet': { label: 'Gesendet', color: 'blue' },
		'bestaetigt': { label: 'Bestätigt', color: 'green' },
		'teillieferung': { label: 'Teillieferung', color: 'yellow' },
		'geliefert': { label: 'Geliefert', color: 'green' },
		'abgeschlossen': { label: 'Abgeschlossen', color: 'gray' },
		'storniert': { label: 'Storniert', color: 'red' }
	};

	onMount(async () => {
		await loadBestellungen();
	});

	async function loadBestellungen() {
		isLoading = true;
		errorMessage = '';

		try {
			const { data, error } = await supabase
				.from('bestellungen')
				.select(`
					id, bestell_nr, atbs_nummer, projekt_name, status,
					summe_netto, anzahl_positionen, created_at, bestellt_am,
					gewuenschtes_lieferdatum, lieferort, bestellt_von_name,
					grosshaendler:grosshaendler_id (name, kurzname, typ)
				`)
				.order('created_at', { ascending: false })
				.limit(100);

			if (error) throw error;
			bestellungen = data || [];
		} catch (err) {
			console.error('Fehler beim Laden:', err);
			errorMessage = 'Bestellungen konnten nicht geladen werden.';
		} finally {
			isLoading = false;
		}
	}

	// Gefilterte & sortierte Liste
	let gefilterteBestellungen = $derived.by(() => {
		let filtered = bestellungen;

		if (filterStatus) {
			filtered = filtered.filter(b => b.status === filterStatus);
		}

		if (filterProjekt.trim()) {
			const such = filterProjekt.toLowerCase();
			filtered = filtered.filter(b =>
				b.atbs_nummer?.toLowerCase().includes(such) ||
				b.projekt_name?.toLowerCase().includes(such)
			);
		}

		if (filterHaendler.trim()) {
			const such = filterHaendler.toLowerCase();
			filtered = filtered.filter(b =>
				b.grosshaendler?.name?.toLowerCase().includes(such) ||
				b.grosshaendler?.kurzname?.toLowerCase().includes(such)
			);
		}

		// Sortieren
		return [...filtered].sort((a, b) => {
			let aVal: string | number = 0;
			let bVal: string | number = 0;

			switch (sortBy) {
				case 'created_at':
					aVal = a.created_at || '';
					bVal = b.created_at || '';
					break;
				case 'bestell_nr':
					aVal = a.bestell_nr;
					bVal = b.bestell_nr;
					break;
				case 'summe_netto':
					aVal = a.summe_netto || 0;
					bVal = b.summe_netto || 0;
					break;
			}

			if (sortDir === 'asc') {
				return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
			} else {
				return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
			}
		});
	});

	// Statistiken
	let stats = $derived.by(() => {
		const total = bestellungen.length;
		const offen = bestellungen.filter(b => ['entwurf', 'gesendet', 'bestaetigt'].includes(b.status)).length;
		const summe = bestellungen.reduce((sum, b) => sum + (b.summe_netto || 0), 0);
		return { total, offen, summe };
	});

	function formatPreis(betrag: number): string {
		return betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
	}

	function formatDatum(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
	}

	function formatDatumKurz(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit'
		});
	}

	function toggleSort(column: 'created_at' | 'bestell_nr' | 'summe_netto') {
		if (sortBy === column) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortBy = column;
			sortDir = 'desc';
		}
	}

	function clearFilters() {
		filterStatus = null;
		filterProjekt = '';
		filterHaendler = '';
	}
</script>

<div class="page">
	<header class="header">
		<div class="header-content">
			<a href="/" class="back-link" aria-label="Zurück">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M19 12H5M12 19l-7-7 7-7"/>
				</svg>
			</a>
			<h1>Bestellungen</h1>
			<a href="/bestellung" class="btn btn-primary">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 5v14M5 12h14"/>
				</svg>
				Neue Bestellung
			</a>
		</div>
	</header>

	<main class="main">
		{#if isLoading}
			<div class="loading">
				<div class="spinner-large"></div>
				<p>Lade Bestellungen...</p>
			</div>
		{:else if errorMessage}
			<div class="error-state">
				<p>{errorMessage}</p>
				<button class="btn btn-secondary" onclick={loadBestellungen}>Erneut versuchen</button>
			</div>
		{:else}
			<!-- Stats -->
			<div class="stats-row">
				<div class="stat-card">
					<div class="stat-value">{stats.total}</div>
					<div class="stat-label">Bestellungen</div>
				</div>
				<div class="stat-card">
					<div class="stat-value">{stats.offen}</div>
					<div class="stat-label">Offen</div>
				</div>
				<div class="stat-card">
					<div class="stat-value">{formatPreis(stats.summe)}</div>
					<div class="stat-label">Gesamtwert</div>
				</div>
			</div>

			<!-- Filter -->
			<div class="filter-bar">
				<div class="filter-group">
					<select bind:value={filterStatus}>
						<option value={null}>Alle Status</option>
						{#each Object.entries(statusLabels) as [value, { label }]}
							<option value={value}>{label}</option>
						{/each}
					</select>
				</div>
				<div class="filter-group">
					<input
						type="search"
						placeholder="Projekt suchen..."
						bind:value={filterProjekt}
					/>
				</div>
				<div class="filter-group">
					<input
						type="search"
						placeholder="Händler suchen..."
						bind:value={filterHaendler}
					/>
				</div>
				{#if filterStatus || filterProjekt || filterHaendler}
					<button class="btn-link" onclick={clearFilters}>Filter zurücksetzen</button>
				{/if}
				<div class="filter-count">
					{gefilterteBestellungen.length} von {bestellungen.length}
				</div>
			</div>

			<!-- Tabelle -->
			{#if gefilterteBestellungen.length === 0}
				<div class="empty-state">
					<p>Keine Bestellungen gefunden.</p>
					{#if filterStatus || filterProjekt || filterHaendler}
						<button class="btn btn-secondary" onclick={clearFilters}>Filter zurücksetzen</button>
					{:else}
						<a href="/bestellung" class="btn btn-primary">Erste Bestellung erstellen</a>
					{/if}
				</div>
			{:else}
				<div class="table-wrapper">
					<table>
						<thead>
							<tr>
								<th class="sortable" onclick={() => toggleSort('bestell_nr')}>
									Nr.
									{#if sortBy === 'bestell_nr'}
										<span class="sort-icon">{sortDir === 'asc' ? '↑' : '↓'}</span>
									{/if}
								</th>
								<th>Händler</th>
								<th>Projekt</th>
								<th>Status</th>
								<th class="text-right">Positionen</th>
								<th class="text-right sortable" onclick={() => toggleSort('summe_netto')}>
									Summe
									{#if sortBy === 'summe_netto'}
										<span class="sort-icon">{sortDir === 'asc' ? '↑' : '↓'}</span>
									{/if}
								</th>
								<th class="sortable" onclick={() => toggleSort('created_at')}>
									Datum
									{#if sortBy === 'created_at'}
										<span class="sort-icon">{sortDir === 'asc' ? '↑' : '↓'}</span>
									{/if}
								</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{#each gefilterteBestellungen as b}
								{@const status = statusLabels[b.status] || { label: b.status, color: 'gray' }}
								<tr>
									<td>
										<span class="bestell-nr">B-{b.bestell_nr}</span>
									</td>
									<td>
										<strong>{b.grosshaendler?.kurzname || b.grosshaendler?.name || '-'}</strong>
										<div class="cell-sub">{b.grosshaendler?.typ || ''}</div>
									</td>
									<td>
										<strong>{b.atbs_nummer || '-'}</strong>
										{#if b.projekt_name}
											<div class="cell-sub">{b.projekt_name.split('|')[1]?.trim() || b.projekt_name}</div>
										{/if}
									</td>
									<td>
										<span class="status-badge status-{status.color}">{status.label}</span>
									</td>
									<td class="text-right">{b.anzahl_positionen}</td>
									<td class="text-right font-mono">{formatPreis(b.summe_netto || 0)}</td>
									<td>
										<div>{formatDatumKurz(b.created_at)}</div>
										{#if b.gewuenschtes_lieferdatum}
											<div class="cell-sub">Liefer: {formatDatumKurz(b.gewuenschtes_lieferdatum)}</div>
										{/if}
									</td>
									<td>
										<a href="/bestellungen/{b.id}" class="btn-icon" aria-label="Details anzeigen">
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<path d="M9 18l6-6-6-6"/>
											</svg>
										</a>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{/if}
	</main>
</div>

<style>
	.page {
		min-height: 100vh;
		background: var(--color-gray-50);
	}

	.header {
		background: white;
		padding: var(--spacing-4) var(--spacing-6);
		border-bottom: 1px solid var(--color-gray-200);
		position: sticky;
		top: 0;
		z-index: 50;
	}

	.header-content {
		max-width: var(--container-xl);
		margin: 0 auto;
		display: flex;
		align-items: center;
		gap: var(--spacing-4);
	}

	.back-link {
		color: var(--color-gray-500);
		padding: var(--spacing-2);
		border-radius: var(--radius-md);
	}

	.back-link:hover {
		background: var(--color-gray-100);
		color: var(--color-gray-700);
	}

	.back-link svg {
		width: 20px;
		height: 20px;
	}

	.header h1 {
		flex: 1;
		font-size: var(--font-size-xl);
		color: var(--color-gray-900);
	}

	.main {
		padding: var(--spacing-6);
		max-width: var(--container-xl);
		margin: 0 auto;
	}

	/* Stats */
	.stats-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--spacing-4);
		margin-bottom: var(--spacing-6);
	}

	.stat-card {
		background: white;
		padding: var(--spacing-4);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
		text-align: center;
	}

	.stat-value {
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-bold);
		color: var(--color-gray-900);
	}

	.stat-label {
		font-size: var(--font-size-sm);
		color: var(--color-gray-500);
	}

	/* Filter */
	.filter-bar {
		display: flex;
		gap: var(--spacing-3);
		align-items: center;
		flex-wrap: wrap;
		margin-bottom: var(--spacing-4);
		padding: var(--spacing-3);
		background: white;
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-sm);
	}

	.filter-group {
		flex: 1;
		min-width: 150px;
	}

	.filter-group select,
	.filter-group input {
		width: 100%;
		padding: var(--spacing-2) var(--spacing-3);
		font-size: var(--font-size-sm);
	}

	.filter-count {
		font-size: var(--font-size-sm);
		color: var(--color-gray-500);
		margin-left: auto;
	}

	/* Table */
	.table-wrapper {
		background: white;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
		overflow: hidden;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th {
		text-align: left;
		padding: var(--spacing-3) var(--spacing-4);
		background: var(--color-gray-50);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--color-gray-600);
		border-bottom: 2px solid var(--color-gray-200);
	}

	th.sortable {
		cursor: pointer;
		user-select: none;
	}

	th.sortable:hover {
		background: var(--color-gray-100);
	}

	.sort-icon {
		margin-left: var(--spacing-1);
	}

	td {
		padding: var(--spacing-3) var(--spacing-4);
		border-bottom: 1px solid var(--color-gray-200);
		font-size: var(--font-size-sm);
	}

	tr:hover {
		background: var(--color-gray-50);
	}

	.text-right {
		text-align: right;
	}

	.font-mono {
		font-family: monospace;
	}

	.cell-sub {
		font-size: var(--font-size-xs);
		color: var(--color-gray-500);
	}

	.bestell-nr {
		font-weight: var(--font-weight-semibold);
		color: var(--color-brand-medium);
	}

	/* Status Badge */
	.status-badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: var(--radius-full);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-medium);
	}

	.status-gray {
		background: var(--color-gray-100);
		color: var(--color-gray-700);
	}

	.status-blue {
		background: var(--color-info-light);
		color: var(--color-info-dark);
	}

	.status-green {
		background: var(--color-success-light);
		color: var(--color-success-dark);
	}

	.status-yellow {
		background: var(--color-warning-light);
		color: var(--color-warning-dark);
	}

	.status-red {
		background: var(--color-error-light);
		color: var(--color-error-dark);
	}

	/* Loading & Empty */
	.loading, .error-state, .empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-12);
		background: white;
		border-radius: var(--radius-lg);
		gap: var(--spacing-4);
		text-align: center;
		color: var(--color-gray-500);
	}

	.spinner-large {
		width: 48px;
		height: 48px;
		border: 4px solid var(--color-gray-200);
		border-top-color: var(--color-brand-light);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* Buttons */
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-2);
		padding: var(--spacing-2) var(--spacing-4);
		border-radius: var(--radius-md);
		font-weight: var(--font-weight-medium);
		font-size: var(--font-size-sm);
		cursor: pointer;
		border: none;
		text-decoration: none;
		transition: all 0.15s ease;
	}

	.btn svg {
		width: 18px;
		height: 18px;
	}

	.btn-primary {
		background: var(--color-brand-medium);
		color: white;
	}

	.btn-primary:hover {
		background: var(--color-brand-dark);
	}

	.btn-secondary {
		background: var(--color-gray-200);
		color: var(--color-gray-700);
	}

	.btn-secondary:hover {
		background: var(--color-gray-300);
	}

	.btn-link {
		background: none;
		border: none;
		color: var(--color-brand-medium);
		cursor: pointer;
		font-size: var(--font-size-sm);
		padding: var(--spacing-2);
	}

	.btn-link:hover {
		text-decoration: underline;
	}

	.btn-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-md);
		color: var(--color-gray-500);
	}

	.btn-icon:hover {
		background: var(--color-gray-100);
		color: var(--color-gray-700);
	}

	.btn-icon svg {
		width: 18px;
		height: 18px;
	}

	/* Mobile */
	@media (max-width: 767px) {
		.main {
			padding: var(--spacing-3);
		}

		.stats-row {
			grid-template-columns: 1fr;
		}

		.filter-bar {
			flex-direction: column;
		}

		.filter-group {
			width: 100%;
		}

		.table-wrapper {
			overflow-x: auto;
		}

		table {
			min-width: 600px;
		}

		th, td {
			padding: var(--spacing-2);
		}
	}
</style>
