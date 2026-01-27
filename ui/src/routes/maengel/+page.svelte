<script lang="ts">
	import { Card, Badge, Button } from '$lib/components/ui';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';

	// Types
	interface Mangel {
		id: string;
		mangel_nr: string | null;
		projekt_nr: string | null;
		projektname_komplett: string | null;
		status_mangel: string | null;
		nachunternehmer: string | null;
		beschreibung_mangel: string | null;
		datum_frist: string | null;
		datum_meldung: string | null;
		bauleiter: string | null;
		fotos_mangel: any[] | null;
		created_at: string | null;
	}

	// State
	let maengel = $state<Mangel[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Filter-State
	let searchQuery = $state('');
	let selectedStatus = $state<string | null>(null);
	let selectedBV = $state<string | null>(null);
	let selectedGewerk = $state<string | null>(null);
	let nurUeberfaellig = $state(false);
	let sortierung = $state<'datum_desc' | 'datum_asc' | 'frist_asc'>('datum_desc');

	// Status-Mapping
	const STATUS_OFFEN = '(0) Offen';
	const STATUS_IN_BEARBEITUNG = '(1) In Bearbeitung';
	const STATUS_NICHT_ABGENOMMEN = '(2) Nicht abgenommen';
	const STATUS_UEBERFAELLIG = '(3) Überfällig';
	const STATUS_ABGENOMMEN = '(4) Abgenommen';

	// BVs und Gewerke für Filter
	let bvListe = $derived([...new Set(maengel.map(m => m.projekt_nr).filter(Boolean))].sort());
	let gewerkListe = $derived([...new Set(maengel.map(m => m.nachunternehmer).filter(Boolean))].sort());

	// Prüfen ob Frist überschritten
	function istUeberfaellig(mangel: Mangel): boolean {
		if (!mangel.datum_frist) return false;
		if (mangel.status_mangel === STATUS_ABGENOMMEN) return false;
		return new Date(mangel.datum_frist) < new Date();
	}

	// Gefilterte Mängel
	let filteredMaengel = $derived(() => {
		let result = maengel.filter(m => {
			// Textsuche
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				const match =
					(m.mangel_nr?.toLowerCase() || '').includes(query) ||
					(m.beschreibung_mangel?.toLowerCase() || '').includes(query) ||
					(m.projekt_nr?.toLowerCase() || '').includes(query) ||
					(m.projektname_komplett?.toLowerCase() || '').includes(query);
				if (!match) return false;
			}

			// Status-Filter
			if (selectedStatus) {
				if (m.status_mangel !== selectedStatus) return false;
			}

			// BV-Filter
			if (selectedBV && m.projekt_nr !== selectedBV) return false;

			// Gewerk-Filter
			if (selectedGewerk && m.nachunternehmer !== selectedGewerk) return false;

			// Nur überfällige
			if (nurUeberfaellig && !istUeberfaellig(m)) return false;

			return true;
		});

		// Sortierung
		result.sort((a, b) => {
			if (sortierung === 'datum_desc') {
				const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
				const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
				return dateB - dateA;
			} else if (sortierung === 'datum_asc') {
				const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
				const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
				return dateA - dateB;
			} else if (sortierung === 'frist_asc') {
				const dateA = a.datum_frist ? new Date(a.datum_frist).getTime() : Infinity;
				const dateB = b.datum_frist ? new Date(b.datum_frist).getTime() : Infinity;
				return dateA - dateB;
			}
			return 0;
		});

		return result;
	});

	// Statistiken
	let stats = $derived(() => {
		const offen = maengel.filter(m =>
			m.status_mangel === STATUS_OFFEN ||
			m.status_mangel === STATUS_IN_BEARBEITUNG ||
			m.status_mangel === STATUS_NICHT_ABGENOMMEN
		).length;
		const inArbeit = maengel.filter(m => m.status_mangel === STATUS_IN_BEARBEITUNG).length;
		const erledigt = maengel.filter(m => m.status_mangel === STATUS_ABGENOMMEN).length;
		const ueberfaellig = maengel.filter(m =>
			m.status_mangel === STATUS_UEBERFAELLIG || istUeberfaellig(m)
		).length;

		return {
			gesamt: maengel.length,
			offen,
			inArbeit,
			erledigt,
			ueberfaellig
		};
	});

	// Daten laden
	async function loadMaengel() {
		loading = true;
		error = null;

		const { data, error: fetchError } = await supabase
			.from('maengel_fertigstellung')
			.select('id, mangel_nr, projekt_nr, projektname_komplett, status_mangel, nachunternehmer, beschreibung_mangel, datum_frist, datum_meldung, bauleiter, fotos_mangel, created_at')
			.order('created_at', { ascending: false });

		if (fetchError) {
			error = fetchError.message;
			console.error('Fehler beim Laden der Mängel:', fetchError);
		} else {
			maengel = data || [];
		}

		loading = false;
	}

	onMount(() => {
		loadMaengel();
	});

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: '2-digit'
		});
	}

	function getStatusVariant(status: string | null): 'success' | 'warning' | 'error' | 'default' {
		switch (status) {
			case STATUS_ABGENOMMEN: return 'success';
			case STATUS_IN_BEARBEITUNG: return 'warning';
			case STATUS_OFFEN: return 'error';
			case STATUS_NICHT_ABGENOMMEN: return 'error';
			case STATUS_UEBERFAELLIG: return 'error';
			default: return 'default';
		}
	}

	function getStatusLabel(status: string | null): string {
		switch (status) {
			case STATUS_ABGENOMMEN: return 'Abgenommen';
			case STATUS_IN_BEARBEITUNG: return 'In Bearbeitung';
			case STATUS_OFFEN: return 'Offen';
			case STATUS_NICHT_ABGENOMMEN: return 'Nicht abgenommen';
			case STATUS_UEBERFAELLIG: return 'Überfällig';
			default: return status || 'Unbekannt';
		}
	}

	function clearFilters() {
		searchQuery = '';
		selectedStatus = null;
		selectedBV = null;
		selectedGewerk = null;
		nurUeberfaellig = false;
	}

	function getFotosCount(fotos: any[] | null): number {
		if (!fotos || !Array.isArray(fotos)) return 0;
		return fotos.length;
	}

	// Adresse aus projektname_komplett extrahieren (Format: "Kunde | Adresse | Lage | Name")
	function getAdresse(projektname: string | null): string {
		if (!projektname) return '-';
		const parts = projektname.split('|').map(p => p.trim());
		return parts.length >= 2 ? parts[1] : projektname;
	}
</script>

<div class="maengel-page">
	<header class="page-header">
		<div class="header-content">
			<h1>Mängel</h1>
			<p class="subtitle">
				{#if loading}
					Lade Mängel...
				{:else}
					{filteredMaengel().length} von {stats().gesamt} Mängeln
				{/if}
			</p>
		</div>
		<div class="header-actions">
			<button class="refresh-btn" onclick={loadMaengel} disabled={loading}>
				{loading ? 'Lädt...' : 'Aktualisieren'}
			</button>
			<Button variant="primary" href="/maengel/neu">
				+ Mangel melden
			</Button>
		</div>
	</header>

	{#if error}
		<Card padding="md">
			<div class="error-message">
				<strong>Fehler:</strong> {error}
				<button onclick={loadMaengel}>Erneut versuchen</button>
			</div>
		</Card>
	{/if}

	<!-- Statistik-Karten -->
	<div class="stats-row">
		<button
			class="stat-card"
			class:active={selectedStatus === STATUS_OFFEN}
			onclick={() => selectedStatus = selectedStatus === STATUS_OFFEN ? null : STATUS_OFFEN}
		>
			<span class="stat-value error">{stats().offen}</span>
			<span class="stat-label">Offen</span>
		</button>
		<button
			class="stat-card"
			class:active={selectedStatus === STATUS_IN_BEARBEITUNG}
			onclick={() => selectedStatus = selectedStatus === STATUS_IN_BEARBEITUNG ? null : STATUS_IN_BEARBEITUNG}
		>
			<span class="stat-value warning">{stats().inArbeit}</span>
			<span class="stat-label">In Bearbeitung</span>
		</button>
		<button
			class="stat-card"
			class:active={selectedStatus === STATUS_ABGENOMMEN}
			onclick={() => selectedStatus = selectedStatus === STATUS_ABGENOMMEN ? null : STATUS_ABGENOMMEN}
		>
			<span class="stat-value success">{stats().erledigt}</span>
			<span class="stat-label">Abgenommen</span>
		</button>
		<button
			class="stat-card"
			class:active={nurUeberfaellig}
			onclick={() => nurUeberfaellig = !nurUeberfaellig}
		>
			<span class="stat-value danger">{stats().ueberfaellig}</span>
			<span class="stat-label">Überfällig</span>
		</button>
	</div>

	<!-- Filter -->
	<Card padding="sm">
		<div class="filters">
			<div class="search-box">
				<span class="search-icon">&#128269;</span>
				<input
					type="search"
					placeholder="Mangel-Nr., Beschreibung oder BV suchen..."
					bind:value={searchQuery}
					class="search-input"
				/>
			</div>

			<select bind:value={selectedBV} class="filter-select">
				<option value={null}>Alle BVs</option>
				{#each bvListe as bv}
					<option value={bv}>{bv}</option>
				{/each}
			</select>

			<select bind:value={selectedGewerk} class="filter-select">
				<option value={null}>Alle Gewerke/NU</option>
				{#each gewerkListe as gewerk}
					<option value={gewerk}>{gewerk}</option>
				{/each}
			</select>

			<select bind:value={sortierung} class="filter-select">
				<option value="datum_desc">Neueste zuerst</option>
				<option value="datum_asc">Älteste zuerst</option>
				<option value="frist_asc">Frist (dringend zuerst)</option>
			</select>

			{#if searchQuery || selectedStatus || selectedBV || selectedGewerk || nurUeberfaellig}
				<button class="clear-btn" onclick={clearFilters}>
					Filter zurücksetzen
				</button>
			{/if}
		</div>
	</Card>

	<!-- Mängel-Liste -->
	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Lade Mängel aus Supabase...</p>
		</div>
	{:else}
		<div class="maengel-list">
			{#each filteredMaengel() as mangel}
				<a href="/maengel/{mangel.id}" class="mangel-card">
					<div class="card-header">
						<div class="header-left">
							<span class="mangel-id">{mangel.mangel_nr || `#${mangel.id.slice(0, 8)}`}</span>
							<Badge variant={getStatusVariant(mangel.status_mangel)} size="sm">
								{getStatusLabel(mangel.status_mangel)}
							</Badge>
							{#if istUeberfaellig(mangel)}
								<Badge variant="error" size="sm">Überfällig!</Badge>
							{/if}
						</div>
						<span class="bv-nr">{mangel.projekt_nr || '-'}</span>
					</div>

					<div class="card-body">
						<h3 class="beschreibung">{mangel.beschreibung_mangel || 'Keine Beschreibung'}</h3>
						<span class="adresse">{getAdresse(mangel.projektname_komplett)}</span>

						<div class="card-meta">
							<div class="meta-item">
								<span class="meta-label">Gewerk/NU</span>
								<span class="meta-value">{mangel.nachunternehmer || '-'}</span>
							</div>
							<div class="meta-item">
								<span class="meta-label">Frist</span>
								<span class="meta-value" class:overdue={istUeberfaellig(mangel)}>
									{formatDate(mangel.datum_frist)}
								</span>
							</div>
							<div class="meta-item">
								<span class="meta-label">Fotos</span>
								<span class="meta-value">{getFotosCount(mangel.fotos_mangel)}</span>
							</div>
						</div>
					</div>

					<div class="card-footer">
						<span class="creator">Bauleiter: {mangel.bauleiter || '-'}</span>
						<span class="date">{formatDate(mangel.created_at)}</span>
					</div>
				</a>
			{/each}

			{#if filteredMaengel().length === 0}
				<div class="empty-state">
					{#if maengel.length === 0}
						<p>Noch keine Mängel vorhanden</p>
					{:else}
						<p>Keine Mängel gefunden</p>
						<button onclick={clearFilters}>Filter zurücksetzen</button>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.maengel-page {
		max-width: 1200px;
		margin: 0 auto;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1.5rem;
	}

	.page-header h1 {
		font-size: 1.75rem;
		margin-bottom: 0.25rem;
	}

	.subtitle {
		color: var(--color-gray-500);
		margin: 0;
		font-size: 0.9rem;
	}

	.header-actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.refresh-btn {
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-gray-300);
		background: white;
		cursor: pointer;
		font-size: 0.85rem;
	}

	.refresh-btn:hover:not(:disabled) {
		background: var(--color-gray-50);
	}

	.refresh-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.error-message {
		color: var(--color-error);
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.error-message button {
		padding: 0.25rem 0.75rem;
		border: 1px solid var(--color-error);
		background: white;
		color: var(--color-error);
		cursor: pointer;
	}

	/* Stats Row */
	.stats-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin-bottom: 1rem;
	}

	@media (max-width: 640px) {
		.stats-row {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	.stat-card {
		background: white;
		border: 1px solid var(--color-gray-200);
		padding: 1rem;
		text-align: center;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.stat-card:hover {
		border-color: var(--color-gray-300);
	}

	.stat-card.active {
		border-color: var(--color-brand-medium);
		background: var(--color-brand-bg);
	}

	.stat-value {
		display: block;
		font-size: 1.75rem;
		font-weight: 700;
		line-height: 1;
		margin-bottom: 0.25rem;
	}

	.stat-value.error {
		color: var(--color-error);
	}

	.stat-value.warning {
		color: var(--color-warning-dark);
	}

	.stat-value.success {
		color: var(--color-success-dark);
	}

	.stat-value.danger {
		color: var(--color-error-dark);
	}

	.stat-label {
		font-size: 0.8rem;
		color: var(--color-gray-500);
	}

	/* Filters */
	.filters {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		align-items: center;
	}

	.search-box {
		display: flex;
		align-items: center;
		background: white;
		border: 1px solid var(--color-gray-200);
		padding: 0.5rem 1rem;
		flex: 1;
		min-width: 200px;
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

	.filter-select {
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-gray-200);
		background: white;
		font-size: 0.9rem;
		cursor: pointer;
	}

	.clear-btn {
		background: none;
		border: none;
		color: var(--color-brand-medium);
		cursor: pointer;
		font-size: 0.85rem;
	}

	/* Loading State */
	.loading-state {
		text-align: center;
		padding: 3rem 2rem;
		color: var(--color-gray-500);
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid var(--color-gray-200);
		border-top-color: var(--color-brand-medium);
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto 1rem;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* Mängel Liste */
	.maengel-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-top: 1rem;
	}

	.mangel-card {
		display: block;
		background: white;
		border: 1px solid var(--color-gray-200);
		text-decoration: none;
		transition: all 0.15s ease;
	}

	.mangel-card:hover {
		border-color: var(--color-gray-300);
		box-shadow: var(--shadow-md);
	}

	.mangel-card .card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-gray-100);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.mangel-id {
		font-family: var(--font-family-mono);
		font-weight: 600;
		font-size: 0.85rem;
		color: var(--color-gray-600);
	}

	.bv-nr {
		font-family: var(--font-family-mono);
		font-size: 0.8rem;
		color: var(--color-gray-500);
	}

	.mangel-card .card-body {
		padding: 1rem;
	}

	.beschreibung {
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-gray-800);
		margin: 0 0 0.25rem 0;
	}

	.adresse {
		font-size: 0.85rem;
		color: var(--color-gray-500);
		display: block;
		margin-bottom: 1rem;
	}

	.card-meta {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
	}

	.meta-item {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.meta-label {
		font-size: 0.7rem;
		color: var(--color-gray-500);
		text-transform: uppercase;
	}

	.meta-value {
		font-size: 0.85rem;
		color: var(--color-gray-800);
	}

	.meta-value.overdue {
		color: var(--color-error);
		font-weight: 600;
	}

	.mangel-card .card-footer {
		display: flex;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-top: 1px solid var(--color-gray-100);
		background: var(--color-gray-50);
		font-size: 0.8rem;
		color: var(--color-gray-500);
	}

	/* Empty State */
	.empty-state {
		text-align: center;
		padding: 3rem 2rem;
		color: var(--color-gray-500);
	}

	.empty-state p {
		margin-bottom: 1rem;
	}

	.empty-state button {
		background: none;
		border: 1px solid var(--color-gray-300);
		padding: 0.5rem 1rem;
		cursor: pointer;
	}

	@media (max-width: 640px) {
		.page-header {
			flex-direction: column;
			gap: 1rem;
		}

		.header-actions {
			width: 100%;
			justify-content: space-between;
		}

		.filters {
			flex-direction: column;
		}

		.search-box,
		.filter-select {
			width: 100%;
		}
	}
</style>
