<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';

	interface Bestellung {
		id: string;
		bestell_nr: number;
		projekt_bestell_nr: number;
		atbs_nummer: string;
		projekt_name: string | null;
		status: string;
		bestelltyp: 'bestellung' | 'angebotsanfrage';
		summe_netto: number;
		anzahl_positionen: number;
		created_at: string;
		bestellt_am: string | null;
		gewuenschtes_lieferdatum: string | null;
		tatsaechliches_lieferdatum: string | null;
		lieferort: string;
		lieferadresse: string | null;
		zeitfenster: string | null;
		ansprechpartner_name: string | null;
		ansprechpartner_telefon: string | null;
		bestellt_von_name: string | null;
		bestellt_von_email: string | null;
		notizen: string | null;
		html_content: string | null;
		email_gesendet_an: string | null;
		email_gesendet_am: string | null;
		lieferschein_url: string | null;
		lieferschein_nr: string | null;
		lieferschein_datum: string | null;
		grosshaendler: {
			name: string;
			kurzname: string;
			typ: string;
			bestell_email: string | null;
		} | null;
	}

	interface StatusHistorie {
		id: string;
		alter_status: string | null;
		neuer_status: string;
		geaendert_von: string | null;
		geaendert_am: string;
		kommentar: string | null;
	}

	interface Position {
		id: string;
		position_nr: number;
		artikelnummer: string | null;
		bezeichnung: string;
		hersteller: string | null;
		menge: number;
		einheit: string;
		einzelpreis: number;
		gesamtpreis: number;
	}

	let bestellung = $state<Bestellung | null>(null);
	let positionen = $state<Position[]>([]);
	let statusHistorie = $state<StatusHistorie[]>([]);
	let isLoading = $state(true);
	let errorMessage = $state('');
	let isUploading = $state(false);
	let lieferscheinNr = $state('');
	let lieferscheinDatum = $state('');

	const statusLabels: Record<string, { label: string; color: string }> = {
		'entwurf': { label: 'Entwurf', color: 'gray' },
		'gesendet': { label: 'Gesendet', color: 'blue' },
		'bestaetigt': { label: 'Bestätigt', color: 'green' },
		'teillieferung': { label: 'Teillieferung', color: 'yellow' },
		'geliefert': { label: 'Geliefert', color: 'green' },
		'abgeschlossen': { label: 'Abgeschlossen', color: 'gray' },
		'storniert': { label: 'Storniert', color: 'red' }
	};

	let bestellungId = '';

	page.subscribe(p => {
		bestellungId = p.params.id;
	});

	onMount(async () => {
		await loadBestellung();
	});

	async function loadBestellung() {
		isLoading = true;
		errorMessage = '';

		try {
			const { data: bestellData, error: bestellError } = await supabase
				.from('bestellungen')
				.select(`
					*,
					grosshaendler:grosshaendler_id (name, kurzname, typ, bestell_email)
				`)
				.eq('id', bestellungId)
				.single();

			if (bestellError) throw bestellError;
			bestellung = bestellData;

			const { data: posData, error: posError } = await supabase
				.from('bestellpositionen')
				.select('*')
				.eq('bestellung_id', bestellungId)
				.order('position_nr', { ascending: true });

			if (posError) throw posError;
			positionen = posData || [];

			// Status-Historie laden
			const { data: historieData } = await supabase
				.from('bestellung_status_history')
				.select('*')
				.eq('bestellung_id', bestellungId)
				.order('geaendert_am', { ascending: false });

			statusHistorie = historieData || [];

			// Lieferschein-Daten vorbelegen
			if (bestellung.lieferschein_nr) lieferscheinNr = bestellung.lieferschein_nr;
			if (bestellung.lieferschein_datum) lieferscheinDatum = bestellung.lieferschein_datum;

		} catch (err) {
			console.error('Fehler:', err);
			errorMessage = 'Bestellung nicht gefunden.';
		} finally {
			isLoading = false;
		}
	}

	async function updateStatus(newStatus: string) {
		if (!bestellung) return;

		try {
			const { error } = await supabase
				.from('bestellungen')
				.update({ status: newStatus })
				.eq('id', bestellung.id);

			if (error) throw error;
			bestellung.status = newStatus;
		} catch (err) {
			console.error('Status-Update fehlgeschlagen:', err);
			alert('Status konnte nicht geändert werden.');
		}
	}

	function formatPreis(betrag: number): string {
		return betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
	}

	function formatDatum(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleDateString('de-DE', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	function formatDatumZeit(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatZeitfenster(zf: string | null): string {
		if (!zf) return '';
		const fenster: Record<string, string> = {
			'vormittag': 'Vormittag (7-12 Uhr)',
			'nachmittag': 'Nachmittag (12-17 Uhr)',
			'ganztags': 'Ganztags'
		};
		return fenster[zf] || zf;
	}

	function formatLieferort(ort: string): string {
		const orte: Record<string, string> = {
			'baustelle': 'Baustelle',
			'lager': 'Lager',
			'abholung': 'Abholung'
		};
		return orte[ort] || ort;
	}

	function drucken() {
		window.print();
	}

	async function uploadLieferschein(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !bestellung) return;

		isUploading = true;

		try {
			// Dateiname generieren
			const ext = file.name.split('.').pop() || 'pdf';
			const fileName = `${bestellung.atbs_nummer}/lieferschein_${bestellung.projekt_bestell_nr}_${Date.now()}.${ext}`;

			// Upload zu Storage
			const { error: uploadError } = await supabase.storage
				.from('bestellungen')
				.upload(fileName, file);

			if (uploadError) throw uploadError;

			// Public URL holen
			const { data: { publicUrl } } = supabase.storage
				.from('bestellungen')
				.getPublicUrl(fileName);

			// Bestellung aktualisieren
			const { error: updateError } = await supabase
				.from('bestellungen')
				.update({
					lieferschein_url: publicUrl,
					lieferschein_nr: lieferscheinNr || null,
					lieferschein_datum: lieferscheinDatum || null,
					lieferschein_hochgeladen_am: new Date().toISOString()
				})
				.eq('id', bestellung.id);

			if (updateError) throw updateError;

			// Bestellung aktualisieren
			bestellung.lieferschein_url = publicUrl;
			alert('Lieferschein erfolgreich hochgeladen!');

		} catch (err) {
			console.error('Upload fehlgeschlagen:', err);
			alert('Upload fehlgeschlagen. Bitte erneut versuchen.');
		} finally {
			isUploading = false;
		}
	}
</script>

<div class="page">
	<header class="header no-print">
		<div class="header-content">
			<a href="/bestellungen" class="back-link" aria-label="Zurück zur Übersicht">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M19 12H5M12 19l-7-7 7-7"/>
				</svg>
			</a>
			{#if bestellung}
				<h1>{bestellung.bestelltyp === 'angebotsanfrage' ? 'Anfrage' : 'Bestellung'} {bestellung.atbs_nummer}-B{bestellung.projekt_bestell_nr}</h1>
				{@const status = statusLabels[bestellung.status] || { label: bestellung.status, color: 'gray' }}
				<span class="status-badge status-{status.color}">{status.label}</span>
				{#if bestellung.bestelltyp === 'angebotsanfrage'}
					<span class="type-badge">Angebotsanfrage</span>
				{/if}
			{:else}
				<h1>Bestellung</h1>
			{/if}
			<div class="header-actions">
				<button class="btn btn-secondary" onclick={drucken}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
						<rect x="6" y="14" width="12" height="8"/>
					</svg>
					Drucken
				</button>
			</div>
		</div>
	</header>

	<main class="main">
		{#if isLoading}
			<div class="loading">
				<div class="spinner-large"></div>
				<p>Lade Bestellung...</p>
			</div>
		{:else if errorMessage || !bestellung}
			<div class="error-state">
				<p>{errorMessage || 'Bestellung nicht gefunden'}</p>
				<a href="/bestellungen" class="btn btn-secondary">Zur Übersicht</a>
			</div>
		{:else}
			<div class="content">
				<!-- Info Cards -->
				<div class="info-grid">
					<div class="info-card">
						<h3>Lieferant</h3>
						<p class="info-value">{bestellung.grosshaendler?.kurzname || bestellung.grosshaendler?.name || '-'}</p>
						<p class="info-sub">{bestellung.grosshaendler?.typ || ''}</p>
						{#if bestellung.grosshaendler?.bestell_email}
							<p class="info-sub">{bestellung.grosshaendler.bestell_email}</p>
						{/if}
					</div>

					<div class="info-card">
						<h3>Projekt</h3>
						<p class="info-value">{bestellung.atbs_nummer || '-'}</p>
						{#if bestellung.projekt_name}
							<p class="info-sub">{bestellung.projekt_name.split('|')[1]?.trim() || bestellung.projekt_name}</p>
						{/if}
					</div>

					<div class="info-card">
						<h3>Lieferung</h3>
						<p class="info-value">{formatLieferort(bestellung.lieferort)}</p>
						{#if bestellung.lieferadresse}
							<p class="info-sub">{bestellung.lieferadresse}</p>
						{/if}
						{#if bestellung.gewuenschtes_lieferdatum}
							<p class="info-sub">{formatDatum(bestellung.gewuenschtes_lieferdatum)}</p>
							{#if bestellung.zeitfenster}
								<p class="info-sub">{formatZeitfenster(bestellung.zeitfenster)}</p>
							{/if}
						{/if}
					</div>

					<div class="info-card">
						<h3>Ansprechpartner</h3>
						<p class="info-value">{bestellung.ansprechpartner_name || '-'}</p>
						{#if bestellung.ansprechpartner_telefon}
							<p class="info-sub">{bestellung.ansprechpartner_telefon}</p>
						{/if}
					</div>
				</div>

				{#if bestellung.notizen}
					<div class="notes-box">
						<strong>Lieferhinweise:</strong> {bestellung.notizen}
					</div>
				{/if}

				<!-- Positionen -->
				<div class="positions-section">
					<h2>Bestellpositionen ({positionen.length})</h2>
					<table>
						<thead>
							<tr>
								<th class="th-pos">Pos.</th>
								<th>Artikel</th>
								<th class="text-right">Menge</th>
								<th class="text-right">Einzelpreis</th>
								<th class="text-right">Gesamt</th>
							</tr>
						</thead>
						<tbody>
							{#each positionen as pos}
								<tr>
									<td class="text-center">{pos.position_nr}</td>
									<td>
										<strong>{pos.bezeichnung}</strong>
										{#if pos.hersteller}
											<div class="cell-sub">{pos.hersteller}</div>
										{/if}
										{#if pos.artikelnummer}
											<div class="cell-sub">Art.-Nr.: {pos.artikelnummer}</div>
										{/if}
									</td>
									<td class="text-right">{pos.menge} {pos.einheit}</td>
									<td class="text-right font-mono">{formatPreis(pos.einzelpreis)}</td>
									<td class="text-right font-mono"><strong>{formatPreis(pos.gesamtpreis)}</strong></td>
								</tr>
							{/each}
						</tbody>
						<tfoot>
							<tr>
								<td colspan="4" class="text-right"><strong>Gesamtsumme (netto)</strong></td>
								<td class="text-right total">{formatPreis(bestellung.summe_netto || 0)}</td>
							</tr>
						</tfoot>
					</table>
				</div>

				<!-- Meta Info -->
				<div class="meta-section no-print">
					<h3>Details</h3>
					<div class="meta-grid">
						<div>
							<span class="meta-label">Erstellt am</span>
							<span class="meta-value">{formatDatumZeit(bestellung.created_at)}</span>
						</div>
						{#if bestellung.bestellt_am}
							<div>
								<span class="meta-label">Bestellt am</span>
								<span class="meta-value">{formatDatumZeit(bestellung.bestellt_am)}</span>
							</div>
						{/if}
						<div>
							<span class="meta-label">Bestellt von</span>
							<span class="meta-value">{bestellung.bestellt_von_name || bestellung.bestellt_von_email || '-'}</span>
						</div>
						{#if bestellung.email_gesendet_am}
							<div>
								<span class="meta-label">E-Mail gesendet</span>
								<span class="meta-value">{formatDatumZeit(bestellung.email_gesendet_am)} an {bestellung.email_gesendet_an}</span>
							</div>
						{/if}
					</div>
				</div>

				<!-- Lieferschein-Upload -->
				<div class="lieferschein-section no-print">
					<h3>Lieferschein</h3>
					{#if bestellung.lieferschein_url}
						<div class="lieferschein-info">
							<a href={bestellung.lieferschein_url} target="_blank" class="btn btn-secondary">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;">
									<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
									<path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
								</svg>
								Lieferschein öffnen
							</a>
							{#if bestellung.lieferschein_nr}
								<span class="lieferschein-nr">Nr: {bestellung.lieferschein_nr}</span>
							{/if}
							{#if bestellung.lieferschein_datum}
								<span class="lieferschein-datum">{formatDatum(bestellung.lieferschein_datum)}</span>
							{/if}
						</div>
					{:else}
						<div class="lieferschein-upload">
							<div class="upload-fields">
								<input
									type="text"
									placeholder="Lieferschein-Nr. (optional)"
									bind:value={lieferscheinNr}
								/>
								<input
									type="date"
									bind:value={lieferscheinDatum}
								/>
							</div>
							<label class="upload-btn">
								<input type="file" accept=".pdf,.jpg,.jpeg,.png" onchange={uploadLieferschein} hidden />
								{#if isUploading}
									<span class="spinner"></span>
									Hochladen...
								{:else}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;">
										<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
									</svg>
									Lieferschein hochladen
								{/if}
							</label>
						</div>
					{/if}
				</div>

				<!-- Status-Historie -->
				{#if statusHistorie.length > 0}
					<div class="historie-section no-print">
						<h3>Status-Verlauf</h3>
						<ul class="historie-list">
							{#each statusHistorie as eintrag}
								{@const status = statusLabels[eintrag.neuer_status] || { label: eintrag.neuer_status, color: 'gray' }}
								<li>
									<span class="historie-datum">{formatDatumZeit(eintrag.geaendert_am)}</span>
									<span class="status-badge status-{status.color} status-sm">{status.label}</span>
									{#if eintrag.geaendert_von}
										<span class="historie-von">von {eintrag.geaendert_von}</span>
									{/if}
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				<!-- Status ändern -->
				<div class="status-section no-print">
					<h3>Status ändern</h3>
					<div class="status-buttons">
						{#each Object.entries(statusLabels) as [value, { label, color }]}
							<button
								class="status-btn status-{color}"
								class:active={bestellung.status === value}
								onclick={() => updateStatus(value)}
								disabled={bestellung.status === value}
							>
								{label}
							</button>
						{/each}
					</div>
				</div>
			</div>
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
		max-width: var(--container-lg);
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
		font-size: var(--font-size-xl);
		color: var(--color-gray-900);
	}

	.header-actions {
		margin-left: auto;
	}

	/* Status Badge */
	.status-badge {
		display: inline-block;
		padding: 4px 12px;
		border-radius: var(--radius-full);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
	}

	.status-gray { background: var(--color-gray-100); color: var(--color-gray-700); }
	.status-blue { background: var(--color-info-light); color: var(--color-info-dark); }
	.status-green { background: var(--color-success-light); color: var(--color-success-dark); }
	.status-yellow { background: var(--color-warning-light); color: var(--color-warning-dark); }
	.status-red { background: var(--color-error-light); color: var(--color-error-dark); }

	.type-badge {
		display: inline-block;
		padding: 4px 12px;
		border-radius: var(--radius-full);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-medium);
		background: var(--color-info-light);
		color: var(--color-info-dark);
		margin-left: var(--spacing-2);
	}

	.status-sm {
		padding: 2px 8px;
		font-size: var(--font-size-xs);
	}

	.main {
		padding: var(--spacing-6);
		max-width: var(--container-lg);
		margin: 0 auto;
	}

	.content {
		background: white;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
		padding: var(--spacing-6);
	}

	/* Info Grid */
	.info-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: var(--spacing-4);
		margin-bottom: var(--spacing-6);
	}

	.info-card {
		background: var(--color-gray-50);
		padding: var(--spacing-4);
		border-radius: var(--radius-md);
	}

	.info-card h3 {
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--color-gray-500);
		margin-bottom: var(--spacing-2);
	}

	.info-value {
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-base);
		margin: 0;
	}

	.info-sub {
		font-size: var(--font-size-sm);
		color: var(--color-gray-500);
		margin: var(--spacing-1) 0 0 0;
	}

	/* Notes */
	.notes-box {
		background: var(--color-warning-light);
		padding: var(--spacing-3);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-6);
		font-size: var(--font-size-sm);
	}

	/* Positions */
	.positions-section {
		margin-bottom: var(--spacing-6);
	}

	.positions-section h2 {
		font-size: var(--font-size-base);
		margin-bottom: var(--spacing-4);
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th {
		text-align: left;
		padding: var(--spacing-3);
		background: var(--color-gray-100);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		color: var(--color-gray-600);
	}

	.th-pos {
		width: 60px;
		text-align: center;
	}

	td {
		padding: var(--spacing-3);
		border-bottom: 1px solid var(--color-gray-200);
		font-size: var(--font-size-sm);
	}

	.text-center { text-align: center; }
	.text-right { text-align: right; }
	.font-mono { font-family: monospace; }

	.cell-sub {
		font-size: var(--font-size-xs);
		color: var(--color-gray-500);
	}

	tfoot td {
		border-bottom: none;
		padding-top: var(--spacing-4);
		font-weight: var(--font-weight-semibold);
	}

	.total {
		font-size: var(--font-size-lg);
		color: var(--color-success-dark);
	}

	/* Meta */
	.meta-section {
		padding-top: var(--spacing-6);
		border-top: 1px solid var(--color-gray-200);
		margin-bottom: var(--spacing-6);
	}

	.meta-section h3 {
		font-size: var(--font-size-sm);
		color: var(--color-gray-600);
		margin-bottom: var(--spacing-3);
	}

	.meta-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: var(--spacing-3);
	}

	.meta-label {
		display: block;
		font-size: var(--font-size-xs);
		color: var(--color-gray-500);
	}

	.meta-value {
		font-size: var(--font-size-sm);
	}

	/* Status Section */
	.status-section {
		padding-top: var(--spacing-4);
		border-top: 1px solid var(--color-gray-200);
	}

	.status-section h3 {
		font-size: var(--font-size-sm);
		color: var(--color-gray-600);
		margin-bottom: var(--spacing-3);
	}

	.status-buttons {
		display: flex;
		gap: var(--spacing-2);
		flex-wrap: wrap;
	}

	/* Lieferschein */
	.lieferschein-section {
		padding-top: var(--spacing-4);
		border-top: 1px solid var(--color-gray-200);
		margin-bottom: var(--spacing-4);
	}

	.lieferschein-section h3 {
		font-size: var(--font-size-sm);
		color: var(--color-gray-600);
		margin-bottom: var(--spacing-3);
	}

	.lieferschein-info {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}

	.lieferschein-nr, .lieferschein-datum {
		font-size: var(--font-size-sm);
		color: var(--color-gray-600);
	}

	.lieferschein-upload {
		display: flex;
		gap: var(--spacing-3);
		align-items: flex-end;
		flex-wrap: wrap;
	}

	.upload-fields {
		display: flex;
		gap: var(--spacing-2);
	}

	.upload-fields input {
		padding: var(--spacing-2) var(--spacing-3);
		font-size: var(--font-size-sm);
	}

	.upload-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-2) var(--spacing-4);
		background: var(--color-brand-medium);
		color: white;
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
		cursor: pointer;
	}

	.upload-btn:hover {
		background: var(--color-brand-dark);
	}

	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255,255,255,0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	/* Historie */
	.historie-section {
		padding-top: var(--spacing-4);
		border-top: 1px solid var(--color-gray-200);
		margin-bottom: var(--spacing-4);
	}

	.historie-section h3 {
		font-size: var(--font-size-sm);
		color: var(--color-gray-600);
		margin-bottom: var(--spacing-3);
	}

	.historie-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.historie-list li {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-2) 0;
		border-bottom: 1px solid var(--color-gray-100);
		font-size: var(--font-size-sm);
	}

	.historie-list li:last-child {
		border-bottom: none;
	}

	.historie-datum {
		color: var(--color-gray-500);
		min-width: 140px;
	}

	.historie-von {
		color: var(--color-gray-500);
		font-size: var(--font-size-xs);
	}

	.status-btn {
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-md);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-medium);
		cursor: pointer;
		border: 2px solid transparent;
		transition: all 0.15s ease;
	}

	.status-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.status-btn.active {
		border-color: currentColor;
	}

	/* Loading */
	.loading, .error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-12);
		background: white;
		border-radius: var(--radius-lg);
		gap: var(--spacing-4);
		text-align: center;
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
		gap: var(--spacing-2);
		padding: var(--spacing-2) var(--spacing-4);
		border-radius: var(--radius-md);
		font-weight: var(--font-weight-medium);
		font-size: var(--font-size-sm);
		cursor: pointer;
		border: none;
		text-decoration: none;
	}

	.btn svg {
		width: 18px;
		height: 18px;
	}

	.btn-secondary {
		background: var(--color-gray-200);
		color: var(--color-gray-700);
	}

	.btn-secondary:hover {
		background: var(--color-gray-300);
	}

	/* Print */
	@media print {
		.no-print {
			display: none !important;
		}

		.page {
			background: white;
		}

		.main {
			padding: 0;
		}

		.content {
			box-shadow: none;
		}
	}

	/* Mobile */
	@media (max-width: 767px) {
		.main {
			padding: var(--spacing-3);
		}

		.content {
			padding: var(--spacing-4);
		}

		.info-grid {
			grid-template-columns: 1fr;
		}

		th, td {
			padding: var(--spacing-2);
		}
	}
</style>
