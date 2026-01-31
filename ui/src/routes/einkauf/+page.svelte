<script lang="ts">
	import { Card, Badge } from '$lib/components/ui';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';

	// State mit Svelte 5 Runes
	let loading = $state(true);
	let error = $state<string | null>(null);
	let activeTab = $state<'lieferanten' | 'artikel' | 'lv'>('lieferanten');
	let searchQuery = $state('');
	let searchMode = $state<'text' | 'semantic'>('text');
	let isSearching = $state(false);
	let semanticResults = $state<Array<any>>([]);

	// Filter
	let filterKategorie = $state<string>('alle');
	let filterGewerk = $state<string>('alle');
	let filterLvTyp = $state<string>('alle');
	let filterGrosshaendler = $state<string>('alle');

	// Daten
	let lieferanten = $state<Array<{
		id: string;
		name: string;
		kurzname: string;
		typ: string;
		typ_anzeige: string;
		kundennummer: string;
		bestellweg: string;
		shop_url: string;
		rabatt_prozent: number;
		lieferzeit_werktage: number;
		mindestbestellwert: number;
		sortiment: string[];
		ist_aktiv: boolean;
	}>>([]);

	let artikel = $state<Array<{
		id: string;
		artikelnummer: string;
		bezeichnung: string;
		kurzbezeichnung: string;
		kategorie: string;
		einheit: string;
		einkaufspreis: number;
		listenpreis: number;
		grosshaendler_name: string;
		hersteller: string;
		ist_aktiv: boolean;
	}>>([]);

	let lvPositionen = $state<Array<{
		id: string;
		artikelnummer: string;
		bezeichnung: string;
		beschreibung: string;
		lv_typ: string;
		gewerk: string;
		einheit: string;
		preis: number;
		listenpreis: number;
		aktiv: boolean;
	}>>([]);

	// Distinct-Werte für Filter
	let kategorien = $state<string[]>([]);
	let gewerke = $state<string[]>([]);
	let lvTypen = $state<string[]>([]);
	let grosshaendlerListe = $state<string[]>([]);

	// Derived: Gefilterte Daten
	let gefiltert = $derived.by(() => {
		const query = searchQuery.toLowerCase().trim();

		if (activeTab === 'lieferanten') {
			return lieferanten.filter(l => {
				if (query && !l.name?.toLowerCase().includes(query) &&
					!l.kurzname?.toLowerCase().includes(query) &&
					!l.kundennummer?.toLowerCase().includes(query)) {
					return false;
				}
				return true;
			});
		}

		if (activeTab === 'artikel') {
			return artikel.filter(a => {
				if (query && !a.bezeichnung?.toLowerCase().includes(query) &&
					!a.artikelnummer?.toLowerCase().includes(query) &&
					!a.kurzbezeichnung?.toLowerCase().includes(query)) {
					return false;
				}
				if (filterKategorie !== 'alle' && a.kategorie !== filterKategorie) return false;
				if (filterGrosshaendler !== 'alle' && a.grosshaendler_name !== filterGrosshaendler) return false;
				return true;
			});
		}

		if (activeTab === 'lv') {
			return lvPositionen.filter(p => {
				if (query && !p.bezeichnung?.toLowerCase().includes(query) &&
					!p.artikelnummer?.toLowerCase().includes(query)) {
					return false;
				}
				if (filterLvTyp !== 'alle' && p.lv_typ !== filterLvTyp) return false;
				if (filterGewerk !== 'alle' && p.gewerk !== filterGewerk) return false;
				return true;
			});
		}

		return [];
	});

	// Stats
	let stats = $derived({
		lieferantenAktiv: lieferanten.filter(l => l.ist_aktiv).length,
		lieferantenGesamt: lieferanten.length,
		artikelGesamt: artikel.length,
		lvGesamt: lvPositionen.length
	});

	// Daten laden
	async function loadData() {
		loading = true;
		error = null;

		try {
			// Lieferanten (Grosshaendler)
			const { data: lieferantenData, error: lieferantenError } = await supabase
				.from('grosshaendler')
				.select('id, name, kurzname, typ, typ_anzeige, kundennummer, bestellweg, shop_url, rabatt_prozent, lieferzeit_werktage, mindestbestellwert, sortiment, ist_aktiv')
				.order('name');

			if (lieferantenError) throw lieferantenError;
			lieferanten = lieferantenData || [];

			// Bestellartikel
			const { data: artikelData, error: artikelError } = await supabase
				.from('bestellartikel')
				.select('id, artikelnummer, bezeichnung, kurzbezeichnung, kategorie, einheit, einkaufspreis, listenpreis, grosshaendler_name, hersteller, ist_aktiv')
				.order('bezeichnung')
				.limit(1000);

			if (artikelError) throw artikelError;
			artikel = artikelData || [];

			// LV-Positionen
			const { data: lvData, error: lvError } = await supabase
				.from('lv_positionen')
				.select('id, artikelnummer, bezeichnung, beschreibung, lv_typ, gewerk, einheit, preis, listenpreis, aktiv')
				.order('lv_typ, gewerk, artikelnummer')
				.limit(2500);

			if (lvError) throw lvError;
			lvPositionen = lvData || [];

			// Distinct-Werte für Filter extrahieren
			kategorien = [...new Set(artikel.map(a => a.kategorie).filter(Boolean))].sort();
			gewerke = [...new Set(lvPositionen.map(p => p.gewerk).filter(Boolean))].sort();
			lvTypen = [...new Set(lvPositionen.map(p => p.lv_typ).filter(Boolean))].sort();
			grosshaendlerListe = [...new Set(artikel.map(a => a.grosshaendler_name).filter(Boolean))].sort();

		} catch (err) {
			error = err instanceof Error ? err.message : 'Fehler beim Laden';
			console.error('Einkauf laden fehlgeschlagen:', err);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadData();
	});

	function formatCurrency(value: number | null): string {
		if (value === null || value === undefined) return '-';
		return new Intl.NumberFormat('de-DE', {
			style: 'currency',
			currency: 'EUR',
			minimumFractionDigits: 2
		}).format(value);
	}

	function getLieferantTypVariant(typ: string | null): 'info' | 'warning' | 'success' | 'error' | 'default' {
		if (!typ) return 'default';
		if (typ.includes('Grosshandel') || typ.includes('Großhandel')) return 'info';
		if (typ.includes('Hersteller')) return 'success';
		if (typ.includes('Fachhandel')) return 'warning';
		return 'default';
	}

	function getLvTypVariant(typ: string | null): 'info' | 'warning' | 'success' | 'error' | 'default' {
		if (!typ) return 'default';
		if (typ === 'GWS') return 'info';
		if (typ === 'VBW') return 'success';
		if (typ === 'covivio') return 'warning';
		if (typ === 'neurealis') return 'error';
		if (typ === 'Artikel') return 'default';
		return 'default';
	}

	function getKategorieVariant(kat: string | null): 'info' | 'warning' | 'success' | 'error' | 'default' {
		if (!kat) return 'default';
		if (['Sanitär', 'Heizung'].includes(kat)) return 'info';
		if (['Elektro', 'Trockenbau'].includes(kat)) return 'warning';
		if (['Maler', 'Fliesen'].includes(kat)) return 'success';
		if (['Boden', 'Bodenbeläge'].includes(kat)) return 'error';
		return 'default';
	}

	// Filter zuruecksetzen wenn Tab wechselt
	function resetFilters() {
		searchQuery = '';
		filterKategorie = 'alle';
		filterGewerk = 'alle';
		filterLvTyp = 'alle';
		filterGrosshaendler = 'alle';
		searchMode = 'text';
		semanticResults = [];
	}

	// Semantische Suche via Edge Function
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	async function performSemanticSearch(query: string) {
		if (!query || query.length < 3 || activeTab !== 'lv') {
			semanticResults = [];
			return;
		}

		isSearching = true;
		try {
			const response = await fetch(
				`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-lv`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
					},
					body: JSON.stringify({
						query,
						lv_typ: filterLvTyp !== 'alle' ? filterLvTyp : null,
						gewerk: filterGewerk !== 'alle' ? filterGewerk : null,
						limit: 50
					})
				}
			);

			if (response.ok) {
				const data = await response.json();
				semanticResults = data.results || [];
			} else {
				// Fallback auf Text-Suche wenn Edge Function nicht verfuegbar
				console.warn('Semantische Suche nicht verfügbar, verwende Textsuche');
				searchMode = 'text';
			}
		} catch (err) {
			console.error('Semantische Suche fehlgeschlagen:', err);
			searchMode = 'text';
		} finally {
			isSearching = false;
		}
	}

	// Debounced Search Handler
	function handleSearchInput() {
		if (searchTimeout) clearTimeout(searchTimeout);

		if (searchMode === 'semantic' && activeTab === 'lv') {
			searchTimeout = setTimeout(() => {
				performSemanticSearch(searchQuery);
			}, 500);
		}
	}

	// Gefilterte Ergebnisse (kombiniert Text und Semantic)
	let gefiltertFinal = $derived.by(() => {
		// Bei semantischer Suche: Ergebnisse aus semanticResults verwenden
		if (searchMode === 'semantic' && activeTab === 'lv' && semanticResults.length > 0) {
			return semanticResults.map(r => ({
				id: r.id,
				artikelnummer: r.artikelnummer,
				bezeichnung: r.bezeichnung,
				beschreibung: r.beschreibung,
				lv_typ: r.lv_typ,
				gewerk: r.gewerk,
				einheit: r.einheit,
				preis: r.preis,
				listenpreis: r.listenpreis,
				aktiv: true,
				similarity: r.similarity
			}));
		}
		// Sonst normale Text-Filterung
		return gefiltert;
	});
</script>

<div class="einkauf-page">
	<header class="page-header">
		<h1>Einkauf</h1>
		<p class="subtitle">Lieferanten, Artikel und Leistungsverzeichnis</p>
	</header>

	{#if error}
		<Card>
			<div class="error-message">
				<strong>Fehler:</strong> {error}
				<button onclick={() => loadData()}>Erneut versuchen</button>
			</div>
		</Card>
	{/if}

	<!-- Stats -->
	<section class="stats-section">
		<div class="stat-card">
			<span class="stat-value">{loading ? '...' : stats.lieferantenAktiv}</span>
			<span class="stat-label">Aktive Lieferanten</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{loading ? '...' : stats.artikelGesamt}</span>
			<span class="stat-label">Bestellartikel</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{loading ? '...' : stats.lvGesamt}</span>
			<span class="stat-label">LV-Positionen</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{loading ? '...' : lvTypen.length}</span>
			<span class="stat-label">LV-Typen</span>
		</div>
	</section>

	<!-- Tabs -->
	<div class="tabs">
		<button
			class="tab"
			class:active={activeTab === 'lieferanten'}
			onclick={() => { activeTab = 'lieferanten'; resetFilters(); }}
		>
			Lieferanten ({lieferanten.length})
		</button>
		<button
			class="tab"
			class:active={activeTab === 'artikel'}
			onclick={() => { activeTab = 'artikel'; resetFilters(); }}
		>
			Artikel ({artikel.length})
		</button>
		<button
			class="tab"
			class:active={activeTab === 'lv'}
			onclick={() => { activeTab = 'lv'; resetFilters(); }}
		>
			LV-Positionen ({lvPositionen.length})
		</button>
	</div>

	<!-- Filter-Bar -->
	<div class="filter-bar">
		<div class="search-group">
			<div class="search-wrapper">
				<svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="11" cy="11" r="8"/>
					<path d="M21 21l-4.35-4.35"/>
				</svg>
				<input
					type="text"
					placeholder={activeTab === 'lv' && searchMode === 'semantic' ? 'Semantische Suche...' : 'Suchen...'}
					bind:value={searchQuery}
					oninput={handleSearchInput}
					class="search-input"
				/>
				{#if isSearching}
					<div class="search-spinner"></div>
				{/if}
			</div>
			{#if activeTab === 'lv'}
				<div class="search-mode-toggle">
					<button
						class="mode-btn"
						class:active={searchMode === 'text'}
						onclick={() => { searchMode = 'text'; semanticResults = []; }}
						title="Textsuche (ILIKE)"
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
							<path d="M4 6h16M4 12h10M4 18h8"/>
						</svg>
						Text
					</button>
					<button
						class="mode-btn"
						class:active={searchMode === 'semantic'}
						onclick={() => { searchMode = 'semantic'; if (searchQuery.length >= 3) performSemanticSearch(searchQuery); }}
						title="KI-Suche (pgvector)"
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
							<path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5"/>
						</svg>
						KI
					</button>
				</div>
			{/if}
		</div>

		{#if activeTab === 'artikel'}
			<label class="filter-group">
				<span>Kategorie:</span>
				<select bind:value={filterKategorie}>
					<option value="alle">Alle</option>
					{#each kategorien as kat}
						<option value={kat}>{kat}</option>
					{/each}
				</select>
			</label>
			<label class="filter-group">
				<span>Lieferant:</span>
				<select bind:value={filterGrosshaendler}>
					<option value="alle">Alle</option>
					{#each grosshaendlerListe as gh}
						<option value={gh}>{gh}</option>
					{/each}
				</select>
			</label>
		{/if}

		{#if activeTab === 'lv'}
			<label class="filter-group">
				<span>LV-Typ:</span>
				<select bind:value={filterLvTyp}>
					<option value="alle">Alle</option>
					{#each lvTypen as typ}
						<option value={typ}>{typ}</option>
					{/each}
				</select>
			</label>
			<label class="filter-group">
				<span>Gewerk:</span>
				<select bind:value={filterGewerk}>
					<option value="alle">Alle</option>
					{#each gewerke as g}
						<option value={g}>{g}</option>
					{/each}
				</select>
			</label>
		{/if}

		<span class="result-count">
			{gefiltertFinal.length} Ergebnisse
			{#if searchMode === 'semantic' && semanticResults.length > 0}
				<span class="semantic-badge">KI</span>
			{/if}
		</span>
	</div>

	<!-- Tabellen-Content -->
	<Card padding="none">
		{#if loading}
			<div class="loading-state">Lade Daten...</div>
		{:else if gefiltertFinal.length === 0}
			<div class="empty-state">
				{#if searchMode === 'semantic' && searchQuery.length >= 3}
					Keine ähnlichen Positionen gefunden
				{:else if searchQuery.length > 0 && searchQuery.length < 3 && searchMode === 'semantic'}
					Mindestens 3 Zeichen für KI-Suche
				{:else}
					Keine Einträge gefunden
				{/if}
			</div>
		{:else if activeTab === 'lieferanten'}
			<!-- Lieferanten-Tabelle -->
			<table class="data-table">
				<thead>
					<tr>
						<th>Name</th>
						<th>Typ</th>
						<th>Kundennr.</th>
						<th>Bestellweg</th>
						<th>Rabatt</th>
						<th>Lieferzeit</th>
						<th>Status</th>
					</tr>
				</thead>
				<tbody>
					{#each gefiltert as l (l.id)}
						<tr>
							<td class="name-cell">
								<span class="primary-name">{l.name || '-'}</span>
								{#if l.kurzname && l.kurzname !== l.name}
									<span class="secondary-name">({l.kurzname})</span>
								{/if}
							</td>
							<td>
								<Badge variant={getLieferantTypVariant(l.typ_anzeige || l.typ)} size="sm">
									{l.typ_anzeige || l.typ || '-'}
								</Badge>
							</td>
							<td class="mono">{l.kundennummer || '-'}</td>
							<td>{l.bestellweg || '-'}</td>
							<td class="mono">{l.rabatt_prozent ? `${l.rabatt_prozent}%` : '-'}</td>
							<td>{l.lieferzeit_werktage ? `${l.lieferzeit_werktage} Tage` : '-'}</td>
							<td>
								<Badge variant={l.ist_aktiv ? 'success' : 'default'} size="sm">
									{l.ist_aktiv ? 'Aktiv' : 'Inaktiv'}
								</Badge>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else if activeTab === 'artikel'}
			<!-- Artikel-Tabelle -->
			<table class="data-table">
				<thead>
					<tr>
						<th>Art.-Nr.</th>
						<th>Bezeichnung</th>
						<th>Kategorie</th>
						<th>Lieferant</th>
						<th>Einheit</th>
						<th class="text-right">EK</th>
						<th class="text-right">LP</th>
					</tr>
				</thead>
				<tbody>
					{#each gefiltert as a (a.id)}
						<tr>
							<td class="mono artikelnr">{a.artikelnummer || '-'}</td>
							<td class="name-cell">
								<span class="primary-name">{a.kurzbezeichnung || a.bezeichnung || '-'}</span>
								{#if a.hersteller}
									<span class="secondary-name">{a.hersteller}</span>
								{/if}
							</td>
							<td>
								{#if a.kategorie}
									<Badge variant={getKategorieVariant(a.kategorie)} size="sm">
										{a.kategorie}
									</Badge>
								{:else}
									-
								{/if}
							</td>
							<td class="lieferant">{a.grosshaendler_name || '-'}</td>
							<td class="einheit">{a.einheit || '-'}</td>
							<td class="preis text-right">{formatCurrency(a.einkaufspreis)}</td>
							<td class="preis text-right listenpreis">{formatCurrency(a.listenpreis)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else if activeTab === 'lv'}
			<!-- LV-Positionen-Tabelle -->
			<table class="data-table">
				<thead>
					<tr>
						{#if searchMode === 'semantic' && semanticResults.length > 0}
							<th class="text-center" style="width: 60px">Match</th>
						{/if}
						<th>Art.-Nr.</th>
						<th>Bezeichnung</th>
						<th>LV-Typ</th>
						<th>Gewerk</th>
						<th>Einheit</th>
						<th class="text-right">EK</th>
						<th class="text-right">LP</th>
					</tr>
				</thead>
				<tbody>
					{#each gefiltertFinal as p (p.id)}
						<tr>
							{#if searchMode === 'semantic' && semanticResults.length > 0}
								<td class="text-center">
									<span class="similarity-badge" style="--sim: {(p.similarity || 0) * 100}%">
										{Math.round((p.similarity || 0) * 100)}%
									</span>
								</td>
							{/if}
							<td class="mono artikelnr">{p.artikelnummer || '-'}</td>
							<td class="name-cell" title={p.beschreibung || ''}>
								<span class="primary-name">{p.bezeichnung || '-'}</span>
							</td>
							<td>
								<Badge variant={getLvTypVariant(p.lv_typ)} size="sm">
									{p.lv_typ || '-'}
								</Badge>
							</td>
							<td class="gewerk">{p.gewerk || '-'}</td>
							<td class="einheit">{p.einheit || '-'}</td>
							<td class="preis text-right">{formatCurrency(p.preis)}</td>
							<td class="preis text-right listenpreis">{formatCurrency(p.listenpreis)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</Card>

	<!-- Legende -->
	<div class="legende">
		<h4>Legende:</h4>
		<div class="legende-items">
			{#if activeTab === 'lv'}
				<span><Badge variant="info" size="sm">GWS</Badge> GWS-LV</span>
				<span><Badge variant="success" size="sm">VBW</Badge> VBW-LV</span>
				<span><Badge variant="warning" size="sm">covivio</Badge> Covivio-LV</span>
				<span><Badge variant="error" size="sm">neurealis</Badge> Neurealis-LV</span>
			{:else if activeTab === 'artikel'}
				<span><strong>EK</strong> = Einkaufspreis</span>
				<span><strong>LP</strong> = Listenpreis</span>
			{:else}
				<span><Badge variant="info" size="sm">Grosshandel</Badge> Grosshaendler</span>
				<span><Badge variant="success" size="sm">Hersteller</Badge> Direkteinkauf</span>
				<span><Badge variant="warning" size="sm">Fachhandel</Badge> Lokaler Haendler</span>
			{/if}
		</div>
	</div>
</div>

<style>
	.einkauf-page {
		max-width: 1400px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 1.5rem;
	}

	.page-header h1 {
		font-size: 1.75rem;
		margin-bottom: 0.25rem;
	}

	.subtitle {
		color: var(--color-gray-500);
		margin: 0;
	}

	.error-message {
		padding: 1rem;
		background: var(--color-red-50);
		color: var(--color-red-700);
		border-radius: 0.5rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.error-message button {
		background: var(--color-red-600);
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 0.25rem;
		cursor: pointer;
	}

	/* Stats */
	.stats-section {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.stat-card {
		background: white;
		border: 1px solid var(--color-gray-200);
		border-radius: 0.5rem;
		padding: 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.stat-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-brand-medium);
	}

	.stat-label {
		font-size: 0.8rem;
		color: var(--color-gray-500);
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	@media (max-width: 1024px) {
		.stats-section {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 640px) {
		.stats-section {
			grid-template-columns: 1fr;
		}
	}

	/* Tabs */
	.tabs {
		display: flex;
		gap: 0;
		margin-bottom: 1rem;
		border-bottom: 1px solid var(--color-gray-200);
	}

	.tab {
		padding: 0.75rem 1.5rem;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		font-size: 0.9rem;
		color: var(--color-gray-500);
		transition: all 0.15s ease;
	}

	.tab:hover {
		color: var(--color-gray-700);
	}

	.tab.active {
		color: var(--color-brand-medium);
		border-bottom-color: var(--color-brand-medium);
	}

	/* Filter */
	.filter-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
		margin-bottom: 1rem;
		padding: 0.75rem 1rem;
		background: var(--color-gray-50);
		border-radius: 0.5rem;
	}

	.search-group {
		flex: 1;
		min-width: 200px;
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.search-wrapper {
		flex: 1;
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-icon {
		position: absolute;
		left: 0.75rem;
		width: 18px;
		height: 18px;
		color: var(--color-gray-400);
		pointer-events: none;
	}

	.search-input {
		width: 100%;
		padding: 0.5rem 0.75rem 0.5rem 2.5rem;
		border: 2px solid var(--color-gray-300);
		border-radius: 0;
		font-size: 0.875rem;
	}

	.search-input:focus {
		outline: none;
		border-color: var(--color-brand-medium);
	}

	.search-spinner {
		position: absolute;
		right: 0.75rem;
		width: 18px;
		height: 18px;
		border: 2px solid var(--color-gray-200);
		border-top-color: var(--color-brand-medium);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.search-mode-toggle {
		display: flex;
		border: 2px solid var(--color-gray-300);
		border-radius: 0;
		overflow: hidden;
	}

	.mode-btn {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.5rem 0.75rem;
		background: white;
		border: none;
		cursor: pointer;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-gray-500);
		transition: all 0.15s ease;
	}

	.mode-btn:first-child {
		border-right: 1px solid var(--color-gray-200);
	}

	.mode-btn:hover {
		background: var(--color-gray-50);
	}

	.mode-btn.active {
		background: var(--color-brand-medium);
		color: white;
	}

	.semantic-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.125rem 0.375rem;
		background: var(--color-info);
		color: white;
		font-size: 0.65rem;
		font-weight: 700;
		border-radius: 0;
		margin-left: 0.5rem;
	}

	.similarity-badge {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 700;
		font-family: var(--font-family-mono);
		background: linear-gradient(90deg, var(--color-success) var(--sim), var(--color-gray-200) var(--sim));
		color: var(--color-gray-800);
		border-radius: 0;
	}

	.filter-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.filter-group span {
		font-size: 0.875rem;
		color: var(--color-gray-600);
		white-space: nowrap;
	}

	.filter-group select {
		padding: 0.5rem;
		border: 1px solid var(--color-gray-300);
		border-radius: 0.25rem;
		font-size: 0.875rem;
		max-width: 180px;
	}

	.result-count {
		font-size: 0.875rem;
		color: var(--color-gray-500);
		margin-left: auto;
	}

	/* Table */
	.loading-state,
	.empty-state {
		padding: 3rem;
		text-align: center;
		color: var(--color-gray-500);
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	.data-table th {
		text-align: left;
		padding: 0.75rem 1rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-gray-500);
		text-transform: uppercase;
		letter-spacing: 0.025em;
		border-bottom: 1px solid var(--color-gray-200);
		background: var(--color-gray-50);
		white-space: nowrap;
	}

	.data-table th.text-right {
		text-align: right;
	}

	.data-table td {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-gray-100);
		vertical-align: middle;
	}

	.data-table td.text-right {
		text-align: right;
	}

	.data-table tbody tr:hover {
		background: var(--color-gray-50);
	}

	.name-cell {
		max-width: 300px;
	}

	.primary-name {
		display: block;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.secondary-name {
		display: block;
		font-size: 0.75rem;
		color: var(--color-gray-500);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.mono {
		font-family: var(--font-family-mono);
	}

	.artikelnr {
		font-weight: 600;
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.einheit {
		color: var(--color-gray-500);
		white-space: nowrap;
	}

	.gewerk {
		font-size: 0.8rem;
		max-width: 180px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.lieferant {
		font-size: 0.8rem;
		color: var(--color-gray-600);
	}

	.preis {
		font-family: var(--font-family-mono);
		font-weight: 500;
		white-space: nowrap;
	}

	.listenpreis {
		color: var(--color-gray-500);
	}

	/* Legende */
	.legende {
		margin-top: 1.5rem;
		padding: 1rem;
		background: var(--color-gray-50);
		border-radius: 0.5rem;
	}

	.legende h4 {
		font-size: 0.875rem;
		margin: 0 0 0.75rem 0;
		color: var(--color-gray-600);
	}

	.legende-items {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.legende-items span {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		color: var(--color-gray-600);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.filter-bar {
			flex-direction: column;
			align-items: stretch;
		}

		.search-group {
			width: 100%;
		}

		.filter-group {
			width: 100%;
		}

		.filter-group select {
			flex: 1;
			max-width: none;
		}

		.result-count {
			margin-left: 0;
			text-align: center;
		}

		.data-table {
			font-size: 0.8rem;
		}

		.data-table th,
		.data-table td {
			padding: 0.5rem;
		}

		.name-cell {
			max-width: 150px;
		}
	}
</style>
