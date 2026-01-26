<script lang="ts">
	import { parseArtikelText } from '$lib/supabase';

	// State
	let artikelText = $state('');
	let isProcessing = $state(false);
	let erkannteArtikel = $state<Array<{ artikel: string; menge: number; confidence: number }>>([]);
	let unerkannteTexte = $state<string[]>([]);
	let errorMessage = $state('');

	// Demo-Artikelliste (später aus DB)
	const verfuegbareArtikel = [
		{ name: 'Dreifachrahmen', kategorie: 'Elektro', einheit: 'Stk', preis: 4.50 },
		{ name: 'Zweifachrahmen', kategorie: 'Elektro', einheit: 'Stk', preis: 3.20 },
		{ name: 'Einfachrahmen', kategorie: 'Elektro', einheit: 'Stk', preis: 2.10 },
		{ name: 'Steckdose', kategorie: 'Elektro', einheit: 'Stk', preis: 2.40 },
		{ name: 'Wechselschalter', kategorie: 'Elektro', einheit: 'Stk', preis: 3.80 },
		{ name: 'Serienschalter', kategorie: 'Elektro', einheit: 'Stk', preis: 4.20 },
		{ name: 'Kreuzschalter', kategorie: 'Elektro', einheit: 'Stk', preis: 5.10 },
	];

	// Bestellpositionen mit Mengen
	let bestellpositionen = $state<Map<string, number>>(new Map());

	// Berechne Gesamtsumme
	let gesamtsumme = $derived(() => {
		let summe = 0;
		for (const [artikelName, menge] of bestellpositionen) {
			const artikel = verfuegbareArtikel.find(a => a.name === artikelName);
			if (artikel && menge > 0) {
				summe += artikel.preis * menge;
			}
		}
		return summe;
	});

	// KI-Parsing starten
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
					const match = verfuegbareArtikel.find(
						a => a.name.toLowerCase() === item.artikel.toLowerCase()
					);
					if (match) {
						bestellpositionen.set(match.name, item.menge);
						bestellpositionen = new Map(bestellpositionen); // Trigger reactivity
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

	// Menge manuell ändern
	function setzeMenge(artikelName: string, menge: number) {
		if (menge >= 0) {
			bestellpositionen.set(artikelName, menge);
			bestellpositionen = new Map(bestellpositionen);
		}
	}

	// Formatiere Preis
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
		<div class="card">
			<!-- Projekt-Auswahl -->
			<section class="section">
				<h2 class="section-title">Projekt & Lieferung</h2>

				<div class="form-grid">
					<div class="form-group">
						<label for="projekt">ATBS-Nr / Projekt</label>
						<select id="projekt">
							<option>ATBS-450 - Musterstraße 1, Dortmund</option>
						</select>
					</div>

					<div class="form-group">
						<label for="haendler">Großhändler</label>
						<select id="haendler">
							<option>ZANDER - Elektro, SHK</option>
						</select>
					</div>

					<div class="form-group">
						<label for="lieferort">Lieferort</label>
						<select id="lieferort">
							<option>📍 Baustelle - Musterstraße 1</option>
							<option>🏢 Lager - Kleyerweg 40</option>
						</select>
					</div>

					<div class="form-group">
						<label for="lieferdatum">Lieferdatum</label>
						<input type="date" id="lieferdatum" />
					</div>
				</div>
			</section>

			<!-- Artikel-Eingabe (VEREINFACHT: Nur Textbox) -->
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
						<div class="error-message">
							⚠️ {errorMessage}
						</div>
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
								<th>Artikel</th>
								<th>Kategorie</th>
								<th>Einheit</th>
								<th>EK netto</th>
								<th>Menge</th>
								<th class="text-right">Summe</th>
							</tr>
						</thead>
						<tbody>
							{#each verfuegbareArtikel as artikel}
								{@const menge = bestellpositionen.get(artikel.name) || 0}
								{@const summe = menge * artikel.preis}
								<tr class:highlight={menge > 0}>
									<td><strong>{artikel.name}</strong></td>
									<td><span class="tag">{artikel.kategorie}</span></td>
									<td>{artikel.einheit}</td>
									<td class="font-mono">{formatPreis(artikel.preis)}</td>
									<td>
										<input
											type="number"
											class="menge-input"
											class:filled={menge > 0}
											value={menge || ''}
											min="0"
											oninput={(e) => setzeMenge(artikel.name, parseInt(e.currentTarget.value) || 0)}
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
								<td class="font-mono text-right"><strong>{formatPreis(gesamtsumme())}</strong></td>
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
				<div class="total-value">{formatPreis(gesamtsumme())}</div>
			</div>
			<button class="btn btn-success" disabled={gesamtsumme() === 0}>
				Weiter zur Bestätigung →
			</button>
		</div>
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

	.tag {
		display: inline-block;
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		background: var(--color-warning-light);
		color: var(--color-warning-dark);
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
