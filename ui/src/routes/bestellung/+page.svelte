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
		kategorien: string[];
	}

	interface Artikel {
		id: string;
		artikelnummer: string;
		bezeichnung: string;
		einheit: string;
		preis: number;
		kategorie: string;
	}

	// === State ===
	let projekte = $state<Projekt[]>([]);
	let grosshaendler = $state<Grosshaendler[]>([]);
	let artikel = $state<Artikel[]>([]);
	let isLoading = $state(true);

	let selectedProjekt = $state('');
	let selectedHaendler = $state('');
	let selectedLieferort = $state('baustelle');
	let lieferdatum = $state('');

	let artikelText = $state('');
	let isProcessing = $state(false);
	let erkannteArtikel = $state<Array<{ artikel: string; menge: number; confidence: number }>>([]);
	let unerkannteTexte = $state<string[]>([]);
	let errorMessage = $state('');

	// Bestellpositionen mit Mengen
	let bestellpositionen = $state<Map<string, number>>(new Map());

	// === Daten laden ===
	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		isLoading = true;

		// Projekte aus matterport_spaces laden
		const { data: projekteData } = await supabase
			.from('matterport_spaces')
			.select('atbs_nummer, project_name, address, city')
			.eq('is_active', true)
			.order('atbs_nummer', { ascending: false });

		if (projekteData) {
			projekte = projekteData;
			if (projekte.length > 0) {
				selectedProjekt = projekte[0].atbs_nummer;
			}
		}

		// Großhändler (Demo-Daten bis Tabelle existiert)
		grosshaendler = [
			{ id: 'zander', name: 'ZANDER - Elektro, SHK', kategorien: ['Elektro', 'SHK'] },
			{ id: 'sonepar', name: 'Sonepar - Elektro', kategorien: ['Elektro'] },
			{ id: 'richter-frenzel', name: 'Richter+Frenzel - SHK', kategorien: ['SHK'] },
			{ id: 'hornbach', name: 'Hornbach - Baustoffe', kategorien: ['Baustoffe'] },
		];
		if (grosshaendler.length > 0) {
			selectedHaendler = grosshaendler[0].id;
		}

		// Artikel (Demo-Daten für Elektro-Material)
		artikel = [
			{ id: '1', artikelnummer: 'GIRA-3R', bezeichnung: 'Dreifachrahmen Gira Standard 55', einheit: 'Stk', preis: 4.50, kategorie: 'Elektro' },
			{ id: '2', artikelnummer: 'GIRA-2R', bezeichnung: 'Zweifachrahmen Gira Standard 55', einheit: 'Stk', preis: 3.20, kategorie: 'Elektro' },
			{ id: '3', artikelnummer: 'GIRA-1R', bezeichnung: 'Einfachrahmen Gira Standard 55', einheit: 'Stk', preis: 2.10, kategorie: 'Elektro' },
			{ id: '4', artikelnummer: 'GIRA-SD', bezeichnung: 'Steckdose Gira Standard 55', einheit: 'Stk', preis: 2.40, kategorie: 'Elektro' },
			{ id: '5', artikelnummer: 'GIRA-WS', bezeichnung: 'Wechselschalter Gira Standard 55', einheit: 'Stk', preis: 3.80, kategorie: 'Elektro' },
			{ id: '6', artikelnummer: 'GIRA-SS', bezeichnung: 'Serienschalter Gira Standard 55', einheit: 'Stk', preis: 4.20, kategorie: 'Elektro' },
			{ id: '7', artikelnummer: 'GIRA-KS', bezeichnung: 'Kreuzschalter Gira Standard 55', einheit: 'Stk', preis: 5.10, kategorie: 'Elektro' },
			{ id: '8', artikelnummer: 'NYM-3x1.5', bezeichnung: 'NYM-J 3x1,5mm² (100m Ring)', einheit: 'Ring', preis: 89.00, kategorie: 'Elektro' },
			{ id: '9', artikelnummer: 'NYM-5x2.5', bezeichnung: 'NYM-J 5x2,5mm² (100m Ring)', einheit: 'Ring', preis: 189.00, kategorie: 'Elektro' },
			{ id: '10', artikelnummer: 'UP-DOSE', bezeichnung: 'Unterputzdose tief 60mm', einheit: 'Stk', preis: 0.45, kategorie: 'Elektro' },
		];

		isLoading = false;
	}

	// === Berechnungen ===
	let gesamtsumme = $derived.by(() => {
		let summe = 0;
		for (const [artikelId, menge] of bestellpositionen) {
			const art = artikel.find(a => a.id === artikelId);
			if (art && menge > 0) {
				summe += art.preis * menge;
			}
		}
		return summe;
	});

	let selectedProjektDetails = $derived.by(() => {
		return projekte.find(p => p.atbs_nummer === selectedProjekt);
	});

	// === Funktionen ===
	async function verarbeiteText() {
		if (!artikelText.trim()) return;

		isProcessing = true;
		errorMessage = '';
		erkannteArtikel = [];
		unerkannteTexte = [];

		try {
			const result = await parseArtikelText(artikelText);

			if (result.success) {
				erkannteArtikel = result.items;
				unerkannteTexte = result.unerkannt;

				// Übertrage erkannte Artikel in Bestellpositionen
				for (const item of result.items) {
					const match = artikel.find(
						a => a.bezeichnung.toLowerCase().includes(item.artikel.toLowerCase())
					);
					if (match) {
						bestellpositionen.set(match.id, item.menge);
						bestellpositionen = new Map(bestellpositionen);
					}
				}
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
								<small class="hint">{selectedProjektDetails.address}, {selectedProjektDetails.city}</small>
							{/if}
						</div>

						<div class="form-group">
							<label for="haendler">Großhändler</label>
							<select id="haendler" bind:value={selectedHaendler}>
								{#each grosshaendler as haendler}
									<option value={haendler.id}>{haendler.name}</option>
								{/each}
							</select>
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

					<div class="info-box">
						💡 Lieferzeit bei ZANDER: ca. 2-3 Werktage | Frei Haus ab 500 €
					</div>
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
								✅ Erkannt: {erkannteArtikel.map(a => `${a.artikel} (${a.menge})`).join(', ')}
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
					<h2 class="section-title">Bestellpositionen</h2>

					<div class="table-wrapper">
						<table class="artikel-table">
							<thead>
								<tr>
									<th>Art.-Nr.</th>
									<th>Bezeichnung</th>
									<th>Einheit</th>
									<th>EK netto</th>
									<th>Menge</th>
									<th class="text-right">Summe</th>
								</tr>
							</thead>
							<tbody>
								{#each artikel as art}
									{@const menge = bestellpositionen.get(art.id) || 0}
									{@const summe = menge * art.preis}
									<tr class:highlight={menge > 0}>
										<td class="text-muted text-sm">{art.artikelnummer}</td>
										<td><strong>{art.bezeichnung}</strong></td>
										<td>{art.einheit}</td>
										<td class="font-mono">{formatPreis(art.preis)}</td>
										<td>
											<input
												type="number"
												class="menge-input"
												class:filled={menge > 0}
												value={menge || ''}
												min="0"
												oninput={(e) => setzeMenge(art.id, parseInt(e.currentTarget.value) || 0)}
											/>
										</td>
										<td class="font-mono text-right">
											{menge > 0 ? formatPreis(summe) : '-'}
										</td>
									</tr>
								{/each}
							</tbody>
							<tfoot>
								<tr class="summe-row">
									<td colspan="4"></td>
									<td><strong>Summe netto</strong></td>
									<td class="font-mono text-right"><strong>{formatPreis(gesamtsumme)}</strong></td>
								</tr>
							</tfoot>
						</table>
					</div>
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

	.menge-input {
		width: 80px;
		text-align: center;
		padding: var(--spacing-2);
	}

	.menge-input.filled {
		border-color: var(--color-success);
		background: #f0fff4;
	}

	.summe-row {
		background: var(--color-gray-50);
	}

	.summe-row td {
		border-bottom: none;
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
