<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase, parseArtikelText } from '$lib/supabase';

	// === Typen ===
	interface Projekt {
		atbs_nummer: string;
		project_name: string;
		address: string | null;
		city: string | null;
	}

	interface Grosshaendler {
		id: string;
		name: string;
		kurzname: string;
		typ: string;
		typ_anzeige: string | null;
		bestell_email: string | null;
	}

	interface Artikel {
		id: string;
		artikelnummer: string;
		bezeichnung: string;
		kurzbezeichnung: string | null;
		hersteller: string | null;
		einheit: string;
		einkaufspreis: number;
		kategorie: string | null;
		unterkategorie: string | null;
		grosshaendler_id: string;
	}

	interface ErkannterArtikel {
		bezeichnung: string;
		menge: number;
		einheit: string;
		confidence: number;
		originalText: string;
		artikel_id?: string;
		artikelnummer?: string;
		einzelpreis?: number;
	}

	// === State ===
	let projekte = $state<Projekt[]>([]);
	let grosshaendler = $state<Grosshaendler[]>([]);
	let artikel = $state<Artikel[]>([]);
	let isLoading = $state(true);
	let isLoadingArtikel = $state(false);

	let selectedProjekt = $state('');
	let selectedHaendler = $state('');
	let selectedLieferort = $state('baustelle');
	let lieferdatum = $state('');
	let selectedZeitfenster = $state('');

	let artikelText = $state('');
	let isProcessing = $state(false);
	let erkannteArtikel = $state<ErkannterArtikel[]>([]);
	let unerkannteTexte = $state<string[]>([]);
	let errorMessage = $state('');

	// Bestellpositionen mit Mengen
	let bestellpositionen = $state<Map<string, number>>(new Map());

	// Expanded Artikel (für Langname-Anzeige)
	let expandedArtikel = $state<Set<string>>(new Set());

	// Filter-State
	let selectedKategorie = $state<string | null>(null);
	let selectedUnterkategorie = $state<string | null>(null);
	let selectedHersteller = $state<string | null>(null);

	// === Daten laden ===
	onMount(async () => {
		loadFavoriten();
		await loadData();
	});

	async function loadData() {
		isLoading = true;

		// Projekte aus monday_bauprozess laden - nur Phasen 2, 3, 4
		const { data: projekteData } = await supabase
			.from('monday_bauprozess')
			.select('id, name, group_title, column_values')
			.or('group_title.ilike.(2%,group_title.ilike.(3%,group_title.ilike.(4%')
			.order('name', { ascending: true });

		if (projekteData) {
			// Transformiere Monday-Daten zu Projekt-Format
			// column_values enthält verschachtelte Objekte: { text49__1: { text: "ATBS-xxx", value: ... } }
			projekte = projekteData
				.map(p => {
					const cv = p.column_values || {};
					return {
						atbs_nummer: cv.text49__1?.text || p.id,
						project_name: p.name,
						address: cv.text51__1?.text || null,
						city: null
					};
				})
				.filter(p => p.atbs_nummer && p.atbs_nummer.startsWith('ATBS')); // Nur mit gültiger ATBS-Nr

			if (projekte.length > 0) {
				selectedProjekt = projekte[0].atbs_nummer;
			}
		}

		// Großhändler aus Datenbank laden
		const { data: ghData } = await supabase
			.from('grosshaendler')
			.select('id, name, kurzname, typ, typ_anzeige, bestell_email')
			.eq('ist_aktiv', true)
			.order('name', { ascending: true });

		if (ghData && ghData.length > 0) {
			grosshaendler = ghData;
			selectedHaendler = grosshaendler[0].id;
			// Artikel für ersten Großhändler laden
			await loadArtikelFuerHaendler(grosshaendler[0].id);
		}

		isLoading = false;
	}

	// Artikel für ausgewählten Großhändler laden
	async function loadArtikelFuerHaendler(haendlerId: string) {
		isLoadingArtikel = true;
		artikel = [];
		bestellpositionen = new Map(); // Positionen zurücksetzen bei Händlerwechsel
		erkannteArtikel = [];
		unerkannteTexte = [];
		selectedKategorie = null;
		selectedUnterkategorie = null;
		selectedHersteller = null;

		const { data: artikelData, error } = await supabase
			.from('bestellartikel')
			.select('id, artikelnummer, bezeichnung, kurzbezeichnung, hersteller, einheit, einkaufspreis, kategorie, unterkategorie, grosshaendler_id')
			.eq('grosshaendler_id', haendlerId)
			.eq('ist_aktiv', true)
			.order('bezeichnung', { ascending: true });

		if (artikelData) {
			artikel = artikelData;
		}

		isLoadingArtikel = false;
	}

	// Bei Großhändler-Wechsel Artikel neu laden
	async function onHaendlerChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		selectedHaendler = select.value;
		await loadArtikelFuerHaendler(selectedHaendler);
	}

	// Favoriten aus Datenbank (persistent pro Benutzer)
	let favoriten = $state<Set<string>>(new Set());
	let favoritenLoading = $state(false);

	// Benutzer-ID (vorerst fest, später aus Auth)
	const BENUTZER_ID = 'holger.neumann@neurealis.de';

	// Favoriten aus DB laden
	async function loadFavoriten() {
		favoritenLoading = true;
		try {
			const { data, error } = await supabase
				.from('bestellartikel_favoriten')
				.select('artikel_id')
				.eq('benutzer_id', BENUTZER_ID);

			if (data && !error) {
				favoriten = new Set(data.map(f => f.artikel_id));
			}
		} catch {
			// Fallback: localStorage
			try {
				const stored = localStorage.getItem('bestellartikel_favoriten');
				if (stored) {
					favoriten = new Set(JSON.parse(stored));
				}
			} catch {
				// Ignorieren
			}
		}
		favoritenLoading = false;
	}

	async function toggleFavorit(artikelId: string) {
		const istFavorit = favoriten.has(artikelId);

		// Optimistic UI Update
		if (istFavorit) {
			favoriten.delete(artikelId);
		} else {
			favoriten.add(artikelId);
		}
		favoriten = new Set(favoriten);

		// DB Update
		try {
			if (istFavorit) {
				// Entfernen
				await supabase
					.from('bestellartikel_favoriten')
					.delete()
					.eq('benutzer_id', BENUTZER_ID)
					.eq('artikel_id', artikelId);
			} else {
				// Hinzufügen
				await supabase
					.from('bestellartikel_favoriten')
					.insert({ benutzer_id: BENUTZER_ID, artikel_id: artikelId });
			}
		} catch (err) {
			// Bei Fehler: Rollback
			if (istFavorit) {
				favoriten.add(artikelId);
			} else {
				favoriten.delete(artikelId);
			}
			favoriten = new Set(favoriten);
			console.error('Favorit-Fehler:', err);
		}
	}

	// === Berechnungen ===
	let gesamtsumme = $derived.by(() => {
		let summe = 0;
		for (const [artikelId, menge] of bestellpositionen) {
			const art = artikel.find(a => a.id === artikelId);
			if (art && menge > 0) {
				summe += (art.einkaufspreis || 0) * menge;
			}
		}
		return summe;
	});

	let selectedProjektDetails = $derived.by(() => {
		return projekte.find(p => p.atbs_nummer === selectedProjekt);
	});

	let selectedHaendlerDetails = $derived.by(() => {
		return grosshaendler.find(h => h.id === selectedHaendler);
	});

	// Verfügbare Kategorien (Gewerke)
	let verfuegbareKategorien = $derived.by(() => {
		const kategorien = new Set<string>();
		for (const art of artikel) {
			if (art.kategorie) kategorien.add(art.kategorie);
		}
		return [...kategorien].sort();
	});

	// Verfügbare Unterkategorien (abhängig von gewählter Kategorie)
	let verfuegbareUnterkategorien = $derived.by(() => {
		const unterkategorien = new Set<string>();
		for (const art of artikel) {
			if (art.unterkategorie) {
				if (!selectedKategorie || art.kategorie === selectedKategorie) {
					unterkategorien.add(art.unterkategorie);
				}
			}
		}
		return [...unterkategorien].sort();
	});

	// Verfügbare Hersteller (abhängig von gewählter Kategorie/Unterkategorie)
	let verfuegbareHersteller = $derived.by(() => {
		const hersteller = new Set<string>();
		for (const art of artikel) {
			if (art.hersteller) {
				let passt = true;
				if (selectedKategorie && art.kategorie !== selectedKategorie) passt = false;
				if (selectedUnterkategorie && art.unterkategorie !== selectedUnterkategorie) passt = false;
				if (passt) hersteller.add(art.hersteller);
			}
		}
		return [...hersteller].sort();
	});

	// Gefilterte Artikel (nach Kategorie, Unterkategorie und Hersteller, Favoriten oben)
	let gefilterteArtikel = $derived.by(() => {
		let filtered = artikel;

		// Nach Kategorie filtern
		if (selectedKategorie) {
			filtered = filtered.filter(a => a.kategorie === selectedKategorie);
		}

		// Nach Unterkategorie filtern
		if (selectedUnterkategorie) {
			filtered = filtered.filter(a => a.unterkategorie === selectedUnterkategorie);
		}

		// Nach Hersteller filtern
		if (selectedHersteller) {
			filtered = filtered.filter(a => a.hersteller === selectedHersteller);
		}

		// Sortieren: Favoriten oben, dann alphabetisch
		return [...filtered].sort((a, b) => {
			const aFav = favoriten.has(a.id);
			const bFav = favoriten.has(b.id);
			if (aFav && !bFav) return -1;
			if (!aFav && bFav) return 1;
			return (a.kurzbezeichnung || a.bezeichnung).localeCompare(b.kurzbezeichnung || b.bezeichnung);
		});
	});

	// === Funktionen ===
	async function verarbeiteText() {
		if (!artikelText.trim()) return;

		isProcessing = true;
		errorMessage = '';
		erkannteArtikel = [];
		unerkannteTexte = [];

		try {
			// KI-Erkennung mit Großhändler-Filter
			const result = await parseArtikelText(artikelText, selectedHaendler);

			if (result.success) {
				erkannteArtikel = result.items;
				unerkannteTexte = result.unerkannt;

				// Übertrage erkannte Artikel in Bestellpositionen
				// WICHTIG: Mengen ADDIEREN, nicht ersetzen!
				for (const item of result.items) {
					let artikelId: string | undefined;

					if (item.artikel_id) {
						// Direkt gematcht via Embedding
						artikelId = item.artikel_id;
					} else {
						// Fallback: Suche nach Bezeichnung in lokaler Artikelliste
						const match = artikel.find(
							a => a.bezeichnung.toLowerCase().includes(item.bezeichnung.toLowerCase())
						);
						if (match) {
							artikelId = match.id;
						}
					}

					if (artikelId) {
						const bisherigeMenge = bestellpositionen.get(artikelId) || 0;
						bestellpositionen.set(artikelId, bisherigeMenge + item.menge);
					}
				}
				bestellpositionen = new Map(bestellpositionen);

				// Textfeld leeren nach erfolgreicher Verarbeitung
				artikelText = '';
			} else {
				errorMessage = result.error || 'Verarbeitung fehlgeschlagen';
			}
		} catch (err) {
			errorMessage = 'Netzwerkfehler - bitte erneut versuchen';
			console.error(err);
		} finally {
			isProcessing = false;
		}
	}

	function setzeMenge(artikelId: string, menge: number) {
		if (menge >= 0) {
			bestellpositionen.set(artikelId, menge);
			bestellpositionen = new Map(bestellpositionen);
		}
	}

	function setzeMengeDirekt(artikelId: string, event: Event) {
		const input = event.target as HTMLInputElement;
		const menge = parseInt(input.value) || 0;
		setzeMenge(artikelId, Math.max(0, menge));
	}

	function selectKategorie(kat: string | null) {
		if (selectedKategorie === kat) {
			selectedKategorie = null;
		} else {
			selectedKategorie = kat;
		}
		selectedUnterkategorie = null;
		selectedHersteller = null;
	}

	function selectUnterkategorie(unterkat: string | null) {
		if (selectedUnterkategorie === unterkat) {
			selectedUnterkategorie = null;
		} else {
			selectedUnterkategorie = unterkat;
		}
		selectedHersteller = null;
	}

	function selectHersteller(hersteller: string | null) {
		if (selectedHersteller === hersteller) {
			selectedHersteller = null;
		} else {
			selectedHersteller = hersteller;
		}
	}

	function toggleBezeichnung(artikelId: string) {
		if (expandedArtikel.has(artikelId)) {
			expandedArtikel.delete(artikelId);
		} else {
			expandedArtikel.add(artikelId);
		}
		expandedArtikel = new Set(expandedArtikel);
	}

	function formatPreis(betrag: number): string {
		return betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
	}
</script>

<div class="page">
	<!-- Header -->
	<header class="header">
		<div class="header-content">
			<h1>Neue Bestellung</h1>
			<div class="user-info">
				<span>Holger Neumann</span>
				<div class="avatar">HN</div>
			</div>
		</div>
	</header>

	<main class="main">
		{#if isLoading}
			<div class="loading">
				<div class="spinner-large"></div>
				<p>Lade Daten...</p>
			</div>
		{:else}
			<div class="card">
				<!-- Projekt-Auswahl -->
				<section class="section">
					<h2 class="section-title">Projekt & Lieferung</h2>

					<div class="form-grid">
						<div class="form-group">
							<label for="projekt">ATBS-Nr / Projekt</label>
							<select id="projekt" bind:value={selectedProjekt}>
								{#each projekte as projekt}
									<option value={projekt.atbs_nummer}>
										{projekt.atbs_nummer} - {projekt.project_name.split('|')[1]?.trim() || projekt.project_name}
									</option>
								{/each}
							</select>
							{#if selectedProjektDetails?.address}
								<small class="hint">{selectedProjektDetails.address}</small>
							{/if}
						</div>

						<div class="form-group">
							<label for="haendler">Großhändler / Lieferant</label>
							<select id="haendler" bind:value={selectedHaendler} onchange={onHaendlerChange}>
								{#each grosshaendler as haendler}
									<option value={haendler.id}>
										{haendler.kurzname || haendler.name} - {haendler.typ_anzeige || haendler.typ}
									</option>
								{/each}
							</select>
							{#if artikel.length > 0}
								<small class="hint">{artikel.length} Artikel verfügbar</small>
							{:else if isLoadingArtikel}
								<small class="hint">Lade Artikel...</small>
							{:else}
								<small class="hint warning">Keine Artikel für diesen Lieferanten</small>
							{/if}
						</div>

						<div class="form-group">
							<label for="lieferort">Lieferort</label>
							<select id="lieferort" bind:value={selectedLieferort}>
								<option value="baustelle">📍 Baustelle</option>
								<option value="lager">🏢 Lager - Kleyerweg 40, Dortmund</option>
								<option value="abholung">🚗 Abholung</option>
							</select>
						</div>

						<div class="form-group">
							<label for="lieferdatum">Gewünschtes Lieferdatum</label>
							<input type="date" id="lieferdatum" bind:value={lieferdatum} />
						</div>

						<div class="form-group">
							<label for="zeitfenster">Zeitfenster</label>
							<select id="zeitfenster" bind:value={selectedZeitfenster}>
								<option value="">Egal</option>
								<option value="vormittag">Vormittag (7-12 Uhr)</option>
								<option value="nachmittag">Nachmittag (12-17 Uhr)</option>
								<option value="ganztags">Ganztags</option>
							</select>
						</div>
					</div>

					{#if selectedHaendlerDetails}
						<div class="info-box">
							💡 <strong>{selectedHaendlerDetails.kurzname || selectedHaendlerDetails.name}</strong>: {artikel.length} Artikel im Katalog
						</div>
					{/if}
				</section>

				<!-- Artikel-Eingabe -->
				<section class="section">
					<h2 class="section-title">Artikel eingeben</h2>

					<div class="input-section">
						<div class="text-input-wrapper">
							<textarea
								bind:value={artikelText}
								placeholder="Artikel und Mengen eingeben (DE/HU/RU/RO)...

Beispiele:
• 10 Dreifachrahmen, 30 Steckdosen
• Tíz hármas keret (Ungarisch)
• Десять тройных рамок (Russisch)"
								rows="4"
							></textarea>

							<button
								class="btn btn-success process-btn"
								onclick={verarbeiteText}
								disabled={isProcessing || !artikelText.trim()}
							>
								{#if isProcessing}
									<span class="spinner"></span>
									Verarbeite...
								{:else}
									✨ KI-Erkennung
								{/if}
							</button>
						</div>

						{#if errorMessage}
							<div class="error-message">⚠️ {errorMessage}</div>
						{/if}

						{#if erkannteArtikel.length > 0}
							<div class="success-message">
								✅ Erkannt: {erkannteArtikel.map(a => `${a.bezeichnung} (${a.menge}${a.artikel_id ? ' ✓' : ''})`).join(', ')}
							</div>
						{/if}

						{#if unerkannteTexte.length > 0}
							<div class="warning-message">
								⚠️ Nicht erkannt: {unerkannteTexte.join(', ')}
							</div>
						{/if}
					</div>
				</section>

				<!-- Artikel-Tabelle -->
				<section class="section">
					<h2 class="section-title">
						Artikelkatalog
						{#if selectedHaendlerDetails}
							<span class="haendler-badge">{selectedHaendlerDetails.kurzname || selectedHaendlerDetails.name}</span>
						{/if}
					</h2>

					{#if isLoadingArtikel}
						<div class="loading-inline">
							<span class="spinner"></span>
							Lade Artikel...
						</div>
					{:else if artikel.length === 0}
						<div class="empty-state">
							<p>Keine Artikel für diesen Lieferanten hinterlegt.</p>
							<small>Bitte wähle einen anderen Großhändler oder importiere Artikel.</small>
						</div>
					{:else}
					<!-- Filter Tags -->
					<div class="filter-section">
						<!-- Gewerk-Filter (Hauptkategorie) -->
						<div class="filter-row">
							<span class="filter-label">Gewerk:</span>
							<div class="filter-tags">
								{#each verfuegbareKategorien as kat}
									<button
										type="button"
										class="filter-tag"
										class:active={selectedKategorie === kat}
										onclick={() => selectKategorie(kat)}
									>
										{kat}
									</button>
								{/each}
								{#if selectedKategorie}
									<button
										type="button"
										class="filter-tag clear"
										onclick={() => selectKategorie(null)}
									>
										✕
									</button>
								{/if}
							</div>
						</div>

						<!-- Unterkategorie-Filter (nur wenn Gewerk gewählt oder Unterkategorien vorhanden) -->
						{#if verfuegbareUnterkategorien.length > 0}
							<div class="filter-row">
								<span class="filter-label">Typ:</span>
								<div class="filter-tags">
									{#each verfuegbareUnterkategorien as unterkat}
										<button
											type="button"
											class="filter-tag sub"
											class:active={selectedUnterkategorie === unterkat}
											onclick={() => selectUnterkategorie(unterkat)}
										>
											{unterkat}
										</button>
									{/each}
									{#if selectedUnterkategorie}
										<button
											type="button"
											class="filter-tag clear"
											onclick={() => selectUnterkategorie(null)}
										>
											✕
										</button>
									{/if}
								</div>
							</div>
						{/if}

						<!-- Hersteller-Filter -->
						{#if verfuegbareHersteller.length > 0}
							<div class="filter-row">
								<span class="filter-label">Hersteller:</span>
								<div class="filter-tags">
									{#each verfuegbareHersteller as hersteller}
										<button
											type="button"
											class="filter-tag hersteller"
											class:active={selectedHersteller === hersteller}
											onclick={() => selectHersteller(hersteller)}
										>
											{hersteller}
										</button>
									{/each}
									{#if selectedHersteller}
										<button
											type="button"
											class="filter-tag clear"
											onclick={() => selectHersteller(null)}
										>
											✕
										</button>
									{/if}
								</div>
							</div>
						{/if}

						<!-- Aktive Filter Anzeige -->
						<div class="filter-info">
							{gefilterteArtikel.length} von {artikel.length} Artikel
							{#if selectedKategorie || selectedUnterkategorie || selectedHersteller}
								<button type="button" class="clear-all" onclick={() => { selectedKategorie = null; selectedUnterkategorie = null; selectedHersteller = null; }}>
									Alle Filter löschen
								</button>
							{/if}
						</div>
					</div>

					<div class="table-wrapper">
						<table class="artikel-table">
							<thead>
								<tr>
									<th class="th-fav"></th>
									<th class="th-hersteller">Hersteller</th>
									<th>Bezeichnung</th>
									<th class="hide-mobile th-einheit">Einheit</th>
									<th class="hide-mobile th-preis">EK netto</th>
									<th class="text-center th-menge">Menge</th>
								</tr>
							</thead>
							<tbody>
								{#each gefilterteArtikel as art}
									{@const menge = bestellpositionen.get(art.id) || 0}
									{@const istFavorit = favoriten.has(art.id)}
									<tr class:highlight={menge > 0} class:favorit={istFavorit}>
										<td class="td-fav">
											<button
												type="button"
												class="favorit-btn"
												class:active={istFavorit}
												onclick={() => toggleFavorit(art.id)}
												title={istFavorit ? 'Favorit entfernen' : 'Als Favorit markieren'}
											>
												{istFavorit ? '★' : '☆'}
											</button>
										</td>
										<td class="td-hersteller">{art.hersteller || '-'}</td>
										<td>
											<button
												type="button"
												class="bezeichnung-toggle"
												onclick={() => toggleBezeichnung(art.id)}
											>
												<strong>{art.kurzbezeichnung || art.bezeichnung}</strong>
											</button>
											{#if expandedArtikel.has(art.id) && art.kurzbezeichnung && art.kurzbezeichnung !== art.bezeichnung}
												<div class="bezeichnung-full">{art.bezeichnung}</div>
											{/if}
											<!-- Mobile: Details unter Bezeichnung -->
											<div class="mobile-meta">
												{#if art.hersteller}<span class="mobile-hersteller">{art.hersteller}</span>{/if}
												<span>{art.einheit || 'Stk'}</span>
												{#if art.einkaufspreis}
													<span class="mobile-preis">{formatPreis(art.einkaufspreis)}</span>
												{/if}
											</div>
										</td>
										<td class="hide-mobile">{art.einheit || 'Stk'}</td>
										<td class="hide-mobile font-mono">{art.einkaufspreis ? formatPreis(art.einkaufspreis) : '-'}</td>
										<td>
											<div class="menge-controls">
												<button
													type="button"
													class="menge-btn minus"
													onclick={() => setzeMenge(art.id, Math.max(0, menge - 1))}
													disabled={menge === 0}
												>−</button>
												<input
													type="number"
													class="menge-input"
													class:filled={menge > 0}
													value={menge}
													min="0"
													onchange={(e) => setzeMengeDirekt(art.id, e)}
													onclick={(e) => (e.target as HTMLInputElement).select()}
												/>
												<button
													type="button"
													class="menge-btn plus"
													onclick={() => setzeMenge(art.id, menge + 1)}
												>+</button>
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					{/if}
				</section>
			</div>

			<!-- Footer Actions -->
			<div class="footer-actions">
				<button class="btn btn-secondary">← Zurück</button>
				<div class="total">
					<div class="total-label">Bestellsumme (netto)</div>
					<div class="total-value">{formatPreis(gesamtsumme)}</div>
				</div>
				<button class="btn btn-success" disabled={gesamtsumme === 0}>
					Weiter zur Bestätigung →
				</button>
			</div>
		{/if}
	</main>
</div>

<style>
	.page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	/* Header */
	.header {
		background: linear-gradient(135deg, var(--color-brand-dark) 0%, var(--color-brand-medium) 100%);
		color: white;
		padding: var(--spacing-4) var(--spacing-6);
	}

	.header-content {
		max-width: var(--container-lg);
		margin: 0 auto;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.header h1 {
		color: white;
		font-size: var(--font-size-xl);
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		font-size: var(--font-size-sm);
	}

	.avatar {
		width: 36px;
		height: 36px;
		background: var(--color-brand-light);
		border-radius: var(--radius-full);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: var(--font-weight-semibold);
	}

	/* Loading */
	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-12);
		gap: var(--spacing-4);
	}

	.spinner-large {
		width: 48px;
		height: 48px;
		border: 4px solid var(--color-gray-200);
		border-top-color: var(--color-brand-light);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	/* Main */
	.main {
		flex: 1;
		padding: var(--spacing-6);
		max-width: var(--container-lg);
		margin: 0 auto;
		width: 100%;
	}

	.card {
		background: white;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
		overflow: hidden;
	}

	/* Sections */
	.section {
		padding: var(--spacing-6);
		border-bottom: 1px solid var(--color-gray-200);
	}

	.section:last-child {
		border-bottom: none;
	}

	.section-title {
		font-size: var(--font-size-base);
		color: var(--color-gray-800);
		margin-bottom: var(--spacing-4);
		padding-bottom: var(--spacing-3);
		border-bottom: 2px solid var(--color-gray-200);
	}

	/* Forms */
	.form-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--spacing-4);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.hint {
		color: var(--color-gray-500);
		font-size: var(--font-size-xs);
		margin-top: var(--spacing-1);
	}

	.info-box {
		background: var(--color-info-light);
		border-left: 4px solid var(--color-brand-light);
		padding: var(--spacing-3) var(--spacing-4);
		border-radius: 0 var(--radius-md) var(--radius-md) 0;
		font-size: var(--font-size-sm);
		color: var(--color-primary-800);
		margin-top: var(--spacing-4);
	}

	/* Input Section */
	.input-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.text-input-wrapper {
		display: flex;
		gap: var(--spacing-3);
		align-items: stretch;
	}

	.text-input-wrapper textarea {
		flex: 1;
		resize: none;
		min-height: 120px;
	}

	.process-btn {
		min-width: 140px;
		flex-direction: column;
		padding: var(--spacing-4);
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.error-message {
		background: var(--color-error-light);
		color: var(--color-error-dark);
		padding: var(--spacing-3);
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
	}

	.success-message {
		background: var(--color-success-light);
		color: var(--color-success-dark);
		padding: var(--spacing-3);
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
	}

	.warning-message {
		background: var(--color-warning-light);
		color: var(--color-warning-dark);
		padding: var(--spacing-3);
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
	}

	/* Händler Badge */
	.haendler-badge {
		display: inline-block;
		background: var(--color-brand-light);
		color: white;
		padding: var(--spacing-1) var(--spacing-3);
		border-radius: var(--radius-full);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-medium);
		margin-left: var(--spacing-2);
		vertical-align: middle;
	}

	.hint.warning {
		color: var(--color-warning-dark);
	}

	/* Filter Section */
	.filter-section {
		margin-bottom: var(--spacing-4);
		padding: var(--spacing-3);
		background: var(--color-gray-50);
		border-radius: var(--radius-md);
	}

	.filter-row {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-2);
		margin-bottom: var(--spacing-2);
	}

	.filter-row:last-of-type {
		margin-bottom: 0;
	}

	.filter-label {
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		color: var(--color-gray-600);
		min-width: 50px;
		padding-top: var(--spacing-1);
	}

	.filter-tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-1);
	}

	.filter-tag {
		display: inline-flex;
		align-items: center;
		padding: var(--spacing-1) var(--spacing-3);
		background: white;
		border: 1px solid var(--color-gray-300);
		border-radius: var(--radius-full);
		font-size: var(--font-size-xs);
		color: var(--color-gray-700);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.filter-tag:hover {
		border-color: var(--color-brand-medium);
		background: var(--color-info-light);
	}

	.filter-tag.active {
		background: var(--color-brand-medium);
		border-color: var(--color-brand-medium);
		color: white;
		font-weight: var(--font-weight-medium);
	}

	.filter-tag.sub {
		font-size: 11px;
		padding: 2px var(--spacing-2);
	}

	.filter-tag.hersteller {
		font-size: 11px;
		padding: 2px var(--spacing-2);
		background: var(--color-gray-100);
	}

	.filter-tag.hersteller.active {
		background: var(--color-gray-700);
		border-color: var(--color-gray-700);
	}

	.filter-tag.clear {
		background: var(--color-error-light);
		border-color: var(--color-error);
		color: var(--color-error-dark);
		padding: var(--spacing-1) var(--spacing-2);
	}

	.filter-tag.clear:hover {
		background: var(--color-error);
		color: white;
	}

	.filter-info {
		margin-top: var(--spacing-2);
		font-size: var(--font-size-xs);
		color: var(--color-gray-500);
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.clear-all {
		background: none;
		border: none;
		color: var(--color-brand-medium);
		cursor: pointer;
		font-size: var(--font-size-xs);
		text-decoration: underline;
	}

	.clear-all:hover {
		color: var(--color-brand-dark);
	}

	/* Favoriten */
	.th-fav, .td-fav {
		width: 40px;
		text-align: center;
		padding: var(--spacing-2) !important;
	}

	.favorit-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: var(--font-size-xl);
		color: var(--color-gray-300);
		padding: 0;
		line-height: 1;
		transition: color 0.15s ease, transform 0.15s ease;
	}

	.favorit-btn:hover {
		color: var(--color-warning);
		transform: scale(1.2);
	}

	.favorit-btn.active {
		color: var(--color-warning);
	}

	tr.favorit {
		background: linear-gradient(90deg, rgba(255, 193, 7, 0.1) 0%, transparent 10%);
	}

	tr.favorit.highlight {
		background: linear-gradient(90deg, rgba(255, 193, 7, 0.15) 0%, var(--color-success-light) 10%);
	}

	/* Spaltenbreiten */
	.th-art-nr, .td-art-nr {
		width: 90px;
		font-size: var(--font-size-xs);
	}

	.th-hersteller, .td-hersteller {
		width: 100px;
		font-size: var(--font-size-xs);
		color: var(--color-gray-600);
	}

	.th-einheit {
		width: 60px;
	}

	.th-preis {
		width: 80px;
	}

	.th-menge {
		width: 130px;
	}

	.mobile-hersteller {
		font-weight: var(--font-weight-medium);
		color: var(--color-gray-700);
	}

	/* Loading inline */
	.loading-inline {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-4);
		color: var(--color-gray-500);
	}

	/* Empty state */
	.empty-state {
		text-align: center;
		padding: var(--spacing-8);
		color: var(--color-gray-500);
	}

	.empty-state p {
		margin-bottom: var(--spacing-2);
	}

	/* Table */
	.table-wrapper {
		overflow-x: auto;
	}

	.artikel-table {
		width: 100%;
		border-collapse: collapse;
	}

	.artikel-table th {
		background: var(--color-gray-50);
		padding: var(--spacing-3) var(--spacing-4);
		text-align: left;
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		color: var(--color-gray-600);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		border-bottom: 2px solid var(--color-gray-200);
	}

	.artikel-table td {
		padding: var(--spacing-3) var(--spacing-4);
		border-bottom: 1px solid var(--color-gray-200);
		font-size: var(--font-size-sm);
	}

	.artikel-table tr.highlight {
		background: var(--color-success-light);
	}

	/* Bezeichnung Toggle */
	.bezeichnung-toggle {
		background: none;
		border: none;
		padding: 0;
		text-align: left;
		cursor: pointer;
		color: inherit;
		font-size: inherit;
	}

	.bezeichnung-toggle:hover strong {
		color: var(--color-brand-medium);
		text-decoration: underline;
	}

	.bezeichnung-full {
		font-size: var(--font-size-xs);
		color: var(--color-gray-500);
		margin-top: var(--spacing-1);
		padding-left: var(--spacing-2);
		border-left: 2px solid var(--color-gray-300);
	}

	/* Menge Controls */
	.menge-controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-1);
	}

	.menge-btn {
		width: 36px;
		height: 36px;
		border-radius: var(--radius-md);
		border: 2px solid var(--color-gray-300);
		background: white;
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-bold);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
		flex-shrink: 0;
	}

	.menge-btn:hover:not(:disabled) {
		border-color: var(--color-brand-medium);
		background: var(--color-info-light);
	}

	.menge-btn:active:not(:disabled) {
		transform: scale(0.95);
	}

	.menge-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.menge-btn.minus {
		color: var(--color-error);
	}

	.menge-btn.plus {
		color: var(--color-success);
	}

	.menge-input {
		width: 50px;
		height: 36px;
		text-align: center;
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-semibold);
		color: var(--color-gray-600);
		border: 2px solid var(--color-gray-200);
		border-radius: var(--radius-md);
		padding: 0;
		appearance: textfield;
		-moz-appearance: textfield;
	}

	.menge-input::-webkit-outer-spin-button,
	.menge-input::-webkit-inner-spin-button {
		appearance: none;
		-webkit-appearance: none;
		margin: 0;
	}

	.menge-input:focus {
		outline: none;
		border-color: var(--color-brand-medium);
		background: var(--color-info-light);
	}

	.menge-input.filled {
		color: var(--color-success-dark);
		border-color: var(--color-success);
		background: var(--color-success-light);
		font-weight: var(--font-weight-bold);
	}

	/* Mobile Meta (unter Bezeichnung auf kleinen Screens) */
	.mobile-meta {
		display: none;
	}

	/* Footer */
	.footer-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-5);
		background: white;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
		margin-top: var(--spacing-4);
	}

	.total {
		text-align: center;
	}

	.total-label {
		font-size: var(--font-size-xs);
		color: var(--color-gray-500);
	}

	.total-value {
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-bold);
		color: var(--color-gray-900);
	}

	/* Mobile */
	@media (max-width: 640px) {
		.header-content {
			flex-direction: column;
			gap: var(--spacing-3);
			text-align: center;
		}

		.form-grid {
			grid-template-columns: 1fr;
		}

		.text-input-wrapper {
			flex-direction: column;
		}

		.process-btn {
			width: 100%;
		}

		.footer-actions {
			flex-direction: column;
			gap: var(--spacing-4);
		}

		.artikel-table th,
		.artikel-table td {
			padding: var(--spacing-2);
			font-size: var(--font-size-xs);
		}

		/* Filter auf Mobile */
		.filter-row {
			flex-direction: column;
			align-items: flex-start;
		}

		.filter-label {
			min-width: auto;
			padding-top: 0;
			margin-bottom: var(--spacing-1);
		}

		.filter-tags {
			width: 100%;
		}

		/* Tabellenspalten auf Mobile ausblenden */
		.hide-mobile {
			display: none;
		}

		/* Mobile Meta anzeigen */
		.mobile-meta {
			display: flex;
			gap: var(--spacing-2);
			font-size: 10px;
			color: var(--color-gray-500);
			margin-top: 2px;
		}

		.mobile-preis {
			font-weight: var(--font-weight-medium);
			color: var(--color-gray-700);
		}

		/* Kleinere Buttons auf Mobile */
		.menge-btn {
			width: 32px;
			height: 32px;
			font-size: var(--font-size-base);
		}

		.menge-input {
			width: 44px;
			height: 32px;
			font-size: var(--font-size-sm);
		}

		/* Favorit kleiner */
		.favorit-btn {
			font-size: var(--font-size-lg);
		}

		.th-fav, .td-fav {
			width: 30px;
		}
	}
</style>
