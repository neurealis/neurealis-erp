<script lang="ts">
	import { Card, Badge, Button } from '$lib/components/ui';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';

	// Types
	interface Kontakt {
		id: string;
		kontakt_nr: number;
		kontaktarten: string[];
		anrede: string | null;
		titel: string | null;
		vorname: string | null;
		nachname: string | null;
		firma_kurz: string | null;
		firma_lang: string | null;
		position: string | null;
		email: string | null;
		telefon_mobil: string | null;
		telefon_festnetz: string | null;
		strasse: string | null;
		plz: string | null;
		ort: string | null;
		aktiv: boolean;
		sync_source: string | null;
		created_at: string | null;
		updated_at: string | null;
	}

	// State
	let kontakte = $state<Kontakt[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Filter-State
	let searchQuery = $state('');
	let selectedTyp = $state<string | null>(null);
	let viewMode = $state<'cards' | 'table'>('cards');
	let sortierung = $state<'name_asc' | 'name_desc' | 'nr_asc' | 'nr_desc'>('name_asc');

	// Kontaktarten-Mapping
	const KONTAKTARTEN_LABELS: Record<string, string> = {
		kunde_privat: 'Privatkunde',
		kunde_gewerblich: 'Gewerbekunde',
		lead: 'Lead',
		mitarbeiter: 'Mitarbeiter',
		mitarbeiter_baustelle: 'Baustellen-MA',
		bewerber: 'Bewerber',
		nachunternehmer: 'Nachunternehmer',
		nu_mitarbeiter: 'NU-Mitarbeiter',
		partner: 'Partner',
		lieferant: 'Lieferant',
		ansprechpartner: 'Ansprechpartner',
		eigentuemer: 'Eigentuemer',
		hausverwaltung: 'Hausverwaltung',
		behoerde: 'Behoerde'
	};

	// Farben fuer Kontaktarten
	const KONTAKTARTEN_COLORS: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
		kunde_privat: 'success',
		kunde_gewerblich: 'success',
		lead: 'warning',
		mitarbeiter: 'default',
		nachunternehmer: 'warning',
		lieferant: 'default',
		ansprechpartner: 'default'
	};

	// Statistiken
	let stats = $derived(() => {
		const kunden = kontakte.filter(k =>
			k.kontaktarten.includes('kunde_privat') || k.kontaktarten.includes('kunde_gewerblich')
		).length;
		const nachunternehmer = kontakte.filter(k =>
			k.kontaktarten.includes('nachunternehmer')
		).length;
		const lieferanten = kontakte.filter(k =>
			k.kontaktarten.includes('lieferant')
		).length;
		const leads = kontakte.filter(k =>
			k.kontaktarten.includes('lead')
		).length;

		return {
			gesamt: kontakte.length,
			kunden,
			nachunternehmer,
			lieferanten,
			leads
		};
	});

	// Alle Typen aus den Daten extrahieren
	let alleTypen = $derived(() => {
		const typen = new Set<string>();
		kontakte.forEach(k => k.kontaktarten.forEach(t => typen.add(t)));
		return [...typen].sort();
	});

	// Gefilterte Kontakte
	let filteredKontakte = $derived(() => {
		let result = kontakte.filter(k => {
			// Textsuche
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				const anzeigename = getAnzeigename(k).toLowerCase();
				const match =
					anzeigename.includes(query) ||
					(k.email?.toLowerCase() || '').includes(query) ||
					(k.telefon_mobil?.toLowerCase() || '').includes(query) ||
					(k.telefon_festnetz?.toLowerCase() || '').includes(query) ||
					(k.firma_kurz?.toLowerCase() || '').includes(query) ||
					(k.ort?.toLowerCase() || '').includes(query) ||
					`K-${String(k.kontakt_nr).padStart(4, '0')}`.toLowerCase().includes(query);
				if (!match) return false;
			}

			// Typ-Filter
			if (selectedTyp && !k.kontaktarten.includes(selectedTyp)) {
				return false;
			}

			return true;
		});

		// Sortierung
		result.sort((a, b) => {
			if (sortierung === 'name_asc') {
				return getAnzeigename(a).localeCompare(getAnzeigename(b), 'de');
			} else if (sortierung === 'name_desc') {
				return getAnzeigename(b).localeCompare(getAnzeigename(a), 'de');
			} else if (sortierung === 'nr_asc') {
				return a.kontakt_nr - b.kontakt_nr;
			} else if (sortierung === 'nr_desc') {
				return b.kontakt_nr - a.kontakt_nr;
			}
			return 0;
		});

		return result;
	});

	// Anzeigename generieren
	function getAnzeigename(kontakt: Kontakt): string {
		if (kontakt.firma_kurz) {
			return kontakt.firma_kurz;
		}
		const teile = [];
		if (kontakt.anrede && kontakt.anrede !== 'Firma') teile.push(kontakt.anrede);
		if (kontakt.titel) teile.push(kontakt.titel);
		if (kontakt.vorname) teile.push(kontakt.vorname);
		if (kontakt.nachname) teile.push(kontakt.nachname);
		return teile.join(' ') || 'Unbenannt';
	}

	// Kontakt-Nummer formatieren
	function formatKontaktNr(nr: number): string {
		return `K-${String(nr).padStart(4, '0')}`;
	}

	// Primaere Telefonnummer
	function getPrimaryPhone(kontakt: Kontakt): string | null {
		return kontakt.telefon_mobil || kontakt.telefon_festnetz || null;
	}

	// Adresse formatieren
	function formatAdresse(kontakt: Kontakt): string {
		const teile = [];
		if (kontakt.strasse) teile.push(kontakt.strasse);
		if (kontakt.plz || kontakt.ort) {
			teile.push([kontakt.plz, kontakt.ort].filter(Boolean).join(' '));
		}
		return teile.join(', ') || '-';
	}

	// Badge-Variante fuer Kontaktart
	function getKontaktartVariant(typ: string): 'success' | 'warning' | 'error' | 'default' {
		return KONTAKTARTEN_COLORS[typ] || 'default';
	}

	// Kontaktart-Label
	function getKontaktartLabel(typ: string): string {
		return KONTAKTARTEN_LABELS[typ] || typ;
	}

	// Daten laden
	async function loadKontakte() {
		loading = true;
		error = null;

		const { data, error: fetchError } = await supabase
			.from('kontakte')
			.select(`
				id,
				kontakt_nr,
				kontaktarten,
				anrede,
				titel,
				vorname,
				nachname,
				firma_kurz,
				firma_lang,
				position,
				email,
				telefon_mobil,
				telefon_festnetz,
				strasse,
				plz,
				ort,
				aktiv,
				sync_source,
				created_at,
				updated_at
			`)
			.eq('aktiv', true)
			.order('nachname', { ascending: true });

		if (fetchError) {
			error = fetchError.message;
			console.error('Fehler beim Laden der Kontakte:', fetchError);
		} else {
			kontakte = data || [];
		}

		loading = false;
	}

	onMount(() => {
		loadKontakte();
	});

	function clearFilters() {
		searchQuery = '';
		selectedTyp = null;
	}

	// Sync-Quelle als Icon
	function getSyncIcon(source: string | null): string {
		switch (source) {
			case 'hero': return 'H';
			case 'monday': return 'M';
			case 'ms365': return 'O';
			case 'manual': return 'N';
			default: return '';
		}
	}
</script>

<div class="kontakte-page">
	<header class="page-header">
		<div class="header-content">
			<h1>Kontakte</h1>
			<p class="subtitle">
				{#if loading}
					Lade Kontakte...
				{:else}
					{filteredKontakte().length} von {stats().gesamt} Kontakten
				{/if}
			</p>
		</div>
		<div class="header-actions">
			<button class="refresh-btn" onclick={loadKontakte} disabled={loading}>
				{loading ? 'Laedt...' : 'Aktualisieren'}
			</button>
			<div class="view-toggle">
				<button
					class="toggle-btn"
					class:active={viewMode === 'cards'}
					onclick={() => viewMode = 'cards'}
					title="Kartenansicht"
				>
					&#9638;&#9638;
				</button>
				<button
					class="toggle-btn"
					class:active={viewMode === 'table'}
					onclick={() => viewMode = 'table'}
					title="Tabellenansicht"
				>
					&#9776;
				</button>
			</div>
		</div>
	</header>

	{#if error}
		<Card padding="md">
			<div class="error-message">
				<strong>Fehler:</strong> {error}
				<button onclick={loadKontakte}>Erneut versuchen</button>
			</div>
		</Card>
	{/if}

	<!-- Statistik-Karten -->
	<div class="stats-row">
		<button
			class="stat-card"
			class:active={selectedTyp === 'kunde_privat' || selectedTyp === 'kunde_gewerblich'}
			onclick={() => selectedTyp = selectedTyp === 'kunde_privat' ? null : 'kunde_privat'}
		>
			<span class="stat-value success">{stats().kunden}</span>
			<span class="stat-label">Kunden</span>
		</button>
		<button
			class="stat-card"
			class:active={selectedTyp === 'nachunternehmer'}
			onclick={() => selectedTyp = selectedTyp === 'nachunternehmer' ? null : 'nachunternehmer'}
		>
			<span class="stat-value warning">{stats().nachunternehmer}</span>
			<span class="stat-label">Nachunternehmer</span>
		</button>
		<button
			class="stat-card"
			class:active={selectedTyp === 'lieferant'}
			onclick={() => selectedTyp = selectedTyp === 'lieferant' ? null : 'lieferant'}
		>
			<span class="stat-value default">{stats().lieferanten}</span>
			<span class="stat-label">Lieferanten</span>
		</button>
		<button
			class="stat-card"
			class:active={selectedTyp === 'lead'}
			onclick={() => selectedTyp = selectedTyp === 'lead' ? null : 'lead'}
		>
			<span class="stat-value info">{stats().leads}</span>
			<span class="stat-label">Leads</span>
		</button>
	</div>

	<!-- Filter -->
	<Card padding="sm">
		<div class="filters">
			<div class="search-box">
				<span class="search-icon">&#128269;</span>
				<input
					type="search"
					placeholder="Name, E-Mail, Telefon oder Kontakt-Nr. suchen..."
					bind:value={searchQuery}
					class="search-input"
				/>
			</div>

			<select bind:value={selectedTyp} class="filter-select">
				<option value={null}>Alle Typen</option>
				{#each alleTypen() as typ}
					<option value={typ}>{getKontaktartLabel(typ)}</option>
				{/each}
			</select>

			<select bind:value={sortierung} class="filter-select">
				<option value="name_asc">Name A-Z</option>
				<option value="name_desc">Name Z-A</option>
				<option value="nr_asc">Kontakt-Nr. aufsteigend</option>
				<option value="nr_desc">Kontakt-Nr. absteigend</option>
			</select>

			{#if searchQuery || selectedTyp}
				<button class="clear-btn" onclick={clearFilters}>
					Filter zuruecksetzen
				</button>
			{/if}
		</div>
	</Card>

	<!-- Kontakte-Liste -->
	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Lade Kontakte aus Supabase...</p>
		</div>
	{:else if viewMode === 'cards'}
		<div class="kontakte-grid">
			{#each filteredKontakte() as kontakt}
				<div class="kontakt-card">
					<div class="card-header">
						<div class="header-left">
							<span class="kontakt-nr">{formatKontaktNr(kontakt.kontakt_nr)}</span>
							{#if kontakt.sync_source}
								<span class="sync-badge" title="Quelle: {kontakt.sync_source}">
									{getSyncIcon(kontakt.sync_source)}
								</span>
							{/if}
						</div>
						<div class="kontaktarten">
							{#each kontakt.kontaktarten.slice(0, 2) as typ}
								<Badge variant={getKontaktartVariant(typ)} size="sm">
									{getKontaktartLabel(typ)}
								</Badge>
							{/each}
							{#if kontakt.kontaktarten.length > 2}
								<Badge variant="default" size="sm">+{kontakt.kontaktarten.length - 2}</Badge>
							{/if}
						</div>
					</div>

					<div class="card-body">
						<h3 class="kontakt-name">{getAnzeigename(kontakt)}</h3>
						{#if kontakt.position}
							<span class="kontakt-position">{kontakt.position}</span>
						{/if}

						<div class="kontakt-details">
							{#if kontakt.email}
								<div class="detail-item">
									<span class="detail-icon">&#9993;</span>
									<a href="mailto:{kontakt.email}" class="detail-link">{kontakt.email}</a>
								</div>
							{/if}
							{#if getPrimaryPhone(kontakt)}
								<div class="detail-item">
									<span class="detail-icon">&#9742;</span>
									<a href="tel:{getPrimaryPhone(kontakt)}" class="detail-link">{getPrimaryPhone(kontakt)}</a>
								</div>
							{/if}
							{#if kontakt.strasse || kontakt.ort}
								<div class="detail-item">
									<span class="detail-icon">&#9906;</span>
									<span class="detail-text">{formatAdresse(kontakt)}</span>
								</div>
							{/if}
						</div>
					</div>
				</div>
			{/each}

			{#if filteredKontakte().length === 0}
				<div class="empty-state">
					{#if kontakte.length === 0}
						<p>Noch keine Kontakte vorhanden</p>
					{:else}
						<p>Keine Kontakte gefunden</p>
						<button onclick={clearFilters}>Filter zuruecksetzen</button>
					{/if}
				</div>
			{/if}
		</div>
	{:else}
		<!-- Tabellenansicht -->
		<div class="table-container">
			<table class="kontakte-table">
				<thead>
					<tr>
						<th>Nr.</th>
						<th>Name</th>
						<th>Typ</th>
						<th>E-Mail</th>
						<th>Telefon</th>
						<th>Ort</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredKontakte() as kontakt}
						<tr>
							<td class="td-nr">{formatKontaktNr(kontakt.kontakt_nr)}</td>
							<td class="td-name">
								<span class="name-primary">{getAnzeigename(kontakt)}</span>
								{#if kontakt.position}
									<span class="name-secondary">{kontakt.position}</span>
								{/if}
							</td>
							<td class="td-typ">
								{#each kontakt.kontaktarten.slice(0, 1) as typ}
									<Badge variant={getKontaktartVariant(typ)} size="sm">
										{getKontaktartLabel(typ)}
									</Badge>
								{/each}
							</td>
							<td class="td-email">
								{#if kontakt.email}
									<a href="mailto:{kontakt.email}">{kontakt.email}</a>
								{:else}
									-
								{/if}
							</td>
							<td class="td-phone">
								{#if getPrimaryPhone(kontakt)}
									<a href="tel:{getPrimaryPhone(kontakt)}">{getPrimaryPhone(kontakt)}</a>
								{:else}
									-
								{/if}
							</td>
							<td class="td-ort">{kontakt.ort || '-'}</td>
						</tr>
					{/each}
				</tbody>
			</table>

			{#if filteredKontakte().length === 0}
				<div class="empty-state">
					{#if kontakte.length === 0}
						<p>Noch keine Kontakte vorhanden</p>
					{:else}
						<p>Keine Kontakte gefunden</p>
						<button onclick={clearFilters}>Filter zuruecksetzen</button>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.kontakte-page {
		max-width: 1400px;
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

	.view-toggle {
		display: flex;
		border: 1px solid var(--color-gray-300);
		background: white;
	}

	.toggle-btn {
		padding: 0.5rem 0.75rem;
		border: none;
		background: none;
		cursor: pointer;
		font-size: 0.9rem;
		color: var(--color-gray-500);
	}

	.toggle-btn:first-child {
		border-right: 1px solid var(--color-gray-300);
	}

	.toggle-btn.active {
		background: var(--color-brand-bg);
		color: var(--color-brand-medium);
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

	.stat-value.success {
		color: var(--color-success-dark);
	}

	.stat-value.warning {
		color: var(--color-warning-dark);
	}

	.stat-value.default {
		color: var(--color-gray-600);
	}

	.stat-value.info {
		color: var(--color-primary-600);
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

	/* Kontakte Grid (Kartenansicht) */
	.kontakte-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 1rem;
		margin-top: 1rem;
	}

	.kontakt-card {
		background: white;
		border: 1px solid var(--color-gray-200);
		transition: all 0.15s ease;
	}

	.kontakt-card:hover {
		border-color: var(--color-gray-300);
		box-shadow: var(--shadow-md);
	}

	.kontakt-card .card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-gray-100);
		background: var(--color-gray-50);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.kontakt-nr {
		font-family: var(--font-family-mono);
		font-weight: 600;
		font-size: 0.8rem;
		color: var(--color-gray-500);
	}

	.sync-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		font-size: 0.65rem;
		font-weight: 700;
		background: var(--color-gray-200);
		color: var(--color-gray-600);
		border-radius: 3px;
	}

	.kontaktarten {
		display: flex;
		gap: 0.25rem;
		flex-wrap: wrap;
	}

	.kontakt-card .card-body {
		padding: 1rem;
	}

	.kontakt-name {
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-gray-800);
		margin: 0 0 0.25rem 0;
	}

	.kontakt-position {
		font-size: 0.85rem;
		color: var(--color-gray-500);
		display: block;
		margin-bottom: 0.75rem;
	}

	.kontakt-details {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.detail-item {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		font-size: 0.85rem;
	}

	.detail-icon {
		color: var(--color-gray-400);
		flex-shrink: 0;
	}

	.detail-link {
		color: var(--color-brand-medium);
		text-decoration: none;
	}

	.detail-link:hover {
		text-decoration: underline;
	}

	.detail-text {
		color: var(--color-gray-600);
	}

	/* Tabellenansicht */
	.table-container {
		margin-top: 1rem;
		background: white;
		border: 1px solid var(--color-gray-200);
		overflow-x: auto;
	}

	.kontakte-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.kontakte-table th {
		text-align: left;
		padding: 0.75rem 1rem;
		background: var(--color-gray-50);
		border-bottom: 1px solid var(--color-gray-200);
		font-weight: 600;
		color: var(--color-gray-600);
		font-size: 0.8rem;
		text-transform: uppercase;
	}

	.kontakte-table td {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-gray-100);
		vertical-align: top;
	}

	.kontakte-table tr:hover {
		background: var(--color-gray-50);
	}

	.td-nr {
		font-family: var(--font-family-mono);
		font-size: 0.8rem;
		color: var(--color-gray-500);
		white-space: nowrap;
	}

	.td-name {
		min-width: 200px;
	}

	.name-primary {
		display: block;
		font-weight: 500;
		color: var(--color-gray-800);
	}

	.name-secondary {
		display: block;
		font-size: 0.8rem;
		color: var(--color-gray-500);
		margin-top: 0.125rem;
	}

	.td-email a,
	.td-phone a {
		color: var(--color-brand-medium);
		text-decoration: none;
	}

	.td-email a:hover,
	.td-phone a:hover {
		text-decoration: underline;
	}

	/* Empty State */
	.empty-state {
		text-align: center;
		padding: 3rem 2rem;
		color: var(--color-gray-500);
		grid-column: 1 / -1;
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

	@media (max-width: 768px) {
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

		.kontakte-grid {
			grid-template-columns: 1fr;
		}

		.table-container {
			font-size: 0.85rem;
		}

		.kontakte-table th,
		.kontakte-table td {
			padding: 0.5rem;
		}
	}
</style>
