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
		bestell_email: string | null;
	}

	interface Artikel {
		id: string;
		artikelnummer: string;
		bezeichnung: string;
		kurzbezeichnung: string | null;
		einheit: string;
		einkaufspreis: number;
		kategorie: string | null;
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

	let artikelText = $state('');
	let isProcessing = $state(false);
	let erkannteArtikel = $state<ErkannterArtikel[]>([]);
	let unerkannteTexte = $state<string[]>([]);
	let errorMessage = $state('');

	// Bestellpositionen mit Mengen
	let bestellpositionen = $state<Map<string, number>>(new Map());

	// Expanded Artikel (für Langname-Anzeige)
	let expandedArtikel = $state<Set<string>>(new Set());

	// === Daten laden ===
	onMount(async () => {
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
			.select('id, name, kurzname, typ, bestell_email')
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

		const { data: artikelData, error } = await supabase
			.from('bestellartikel')
			.select('id, artikelnummer, bezeichnung, kurzbezeichnung, einheit, einkaufspreis, kategorie, grosshaendler_id')
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
				for (const item of result.items) {
					if (item.artikel_id) {
						// Direkt gematcht via Embedding
						bestellpositionen.set(item.artikel_id, item.menge);
					} else {
						// Fallback: Suche nach Bezeichnung in lokaler Artikelliste
						const match = artikel.find(
							a => a.bezeichnung.toLowerCase().includes(item.bezeichnung.toLowerCase())
						);
						if (match) {
							bestellpositionen.set(match.id, item.menge);
						}
					}
				}
				bestellpositionen = new Map(bestellpositionen);
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
										{haendler.kurzname || haendler.name} - {haendler.typ}
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
							</select>
						</div>

						<div class="form-group">
							<label for="lieferdatum">Gewünschtes Lieferdatum</label>
							<input type="date" id="lieferdatum" bind:value={lieferdatum} />
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
						<div class="input-hint">
							<strong>Tipp:</strong> Nutze die Spracheingabe deiner Tastatur (🎤) für schnelle Eingabe - auch auf Ungarisch, Russisch oder Rumänisch!
						</div>

						<div class="text-input-wrapper">
							<textarea
								bind:value={artikelText}
								placeholder="Artikel und Mengen eingeben...

Beispiele:
• Dreifachrahmen 10 Stück
• 15 Zweifachrahmen, 30 Steckdosen
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
					<div class="table-wrapper">
						<table class="artikel-table">
							<thead>
								<tr>
									<th>Bezeichnung</th>
									<th>Einheit</th>
									<th>EK netto</th>
									<th class="text-center">Menge</th>
								</tr>
							</thead>
							<tbody>
								{#each artikel as art}
									{@const menge = bestellpositionen.get(art.id) || 0}
									<tr class:highlight={menge > 0}>
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
										</td>
										<td>{art.einheit || 'Stk'}</td>
										<td class="font-mono">{art.einkaufspreis ? formatPreis(art.einkaufspreis) : '-'}</td>
										<td>
											<div class="menge-controls">
												<button
													type="button"
													class="menge-btn minus"
													onclick={() => setzeMenge(art.id, Math.max(0, menge - 1))}
													disabled={menge === 0}
												>−</button>
												<span class="menge-display" class:filled={menge > 0}>{menge}</span>
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

	.input-hint {
		background: var(--color-info-light);
		padding: var(--spacing-3) var(--spacing-4);
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
		color: var(--color-primary-800);
		border-left: 4px solid var(--color-brand-light);
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
		gap: var(--spacing-2);
	}

	.menge-btn {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-md);
		border: 2px solid var(--color-gray-300);
		background: white;
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-bold);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
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

	.menge-display {
		min-width: 40px;
		text-align: center;
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
		color: var(--color-gray-400);
	}

	.menge-display.filled {
		color: var(--color-success-dark);
		font-size: var(--font-size-xl);
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
	}
</style>
