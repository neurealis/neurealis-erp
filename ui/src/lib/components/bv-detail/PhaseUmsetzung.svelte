<script lang="ts">
	import { Card, Badge, Button } from '$lib/components/ui';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';

	interface Props {
		columnValues: Record<string, unknown>;
		projektNr: string | null;
		bvId: string;
	}

	interface Mangel {
		id: string;
		mangel_nr: string | null;
		status_mangel: string;
		art_des_mangels: string | null;
		beschreibung_mangel: string | null;
		nachunternehmer: string | null;
		datum_frist: string | null;
		mangel_behoben_datum: string | null;
		fotos_mangel: unknown;
		status_mangel_nu: string | null;
		fotos_nachweis_nu: unknown;
		kommentar_nu: string | null;
	}

	interface Nachtrag {
		id: string;
		nachtrag_nr: string;
		status: string;
		titel: string | null;
		beschreibung: string | null;
		betrag_kunde_netto: number | null;
		betrag_nu_netto: number | null;
		verzoegerung_tage: number | null;
		foto_urls: string[] | null;
	}

	interface EinkaufRechnung {
		id: string;
		dokument_nr: string;
		rechnungssteller: string | null;
		art_des_dokuments: string | null;
		status: string | null;
		betrag_netto: number | null;
		betrag_bezahlt: number | null;
		betrag_offen: number | null;
		datum_erstellt: string | null;
		datum_zahlungsfrist: string | null;
		datei_url: string | null;
		notizen: string | null;
	}

	let { columnValues, projektNr, bvId }: Props = $props();

	// State
	let maengel = $state<Mangel[]>([]);
	let nachtraege = $state<Nachtrag[]>([]);
	let einkaufRechnungen = $state<EinkaufRechnung[]>([]);
	let loading = $state(true);
	let maengelFilter = $state('alle');

	// Gewerke mit Status
	const gewerkeList = [
		{ id: 'entkernung', name: 'Entkernung', fieldId: 'status_gw1' },
		{ id: 'maurer', name: 'Maurer & Trockenbau', fieldId: 'status_gw2' },
		{ id: 'elektrik', name: 'Elektrik', fieldId: 'status_gw3' },
		{ id: 'echeck', name: 'E-Check', fieldId: 'status_gw4' },
		{ id: 'bad', name: 'Bad & Sanitaer', fieldId: 'status_gw5' },
		{ id: 'heizung', name: 'Heizung', fieldId: 'status_gw6' },
		{ id: 'waende', name: 'Waende & Decken', fieldId: 'status_gw7' },
		{ id: 'boden', name: 'Boden', fieldId: 'status_gw8' },
		{ id: 'tischler', name: 'Tischler', fieldId: 'status_gw9' },
		{ id: 'endreinigung', name: 'Endreinigung', fieldId: 'status_gw10' },
		{ id: 'vorabnahme', name: 'Vorabnahme intern', fieldId: 'status_gw11' },
		{ id: 'endabnahme', name: 'Endabnahme Kunde', fieldId: 'status_gw12' },
	];

	// Termine
	interface Termin {
		label: string;
		fieldId: string;
	}

	const termine: Termin[] = [
		{ label: 'BV Start', fieldId: 'date_bvstart' },
		{ label: 'BV Ende NU | Plan', fieldId: 'date_bvende_plan' },
		{ label: 'Vorabnahme intern', fieldId: 'date_vorabnahme' },
		{ label: 'BV Ende NU | Maengelfrei', fieldId: 'date_maengelfrei' },
		{ label: 'Verspaetung', fieldId: 'date_verspaetung' },
		{ label: 'Endabnahme Kunde', fieldId: 'date_endabnahme' },
	];

	// Extrahiere Feld aus column_values
	function extractField(fieldId: string): string | null {
		try {
			const field = columnValues[fieldId];
			if (!field) return null;
			const parsed = typeof field === 'string' ? JSON.parse(field) : field;
			return parsed?.text || parsed?.label || null;
		} catch {
			return null;
		}
	}

	function extractDate(fieldId: string): string | null {
		try {
			const field = columnValues[fieldId];
			if (!field) return null;
			const parsed = typeof field === 'string' ? JSON.parse(field) : field;
			return parsed?.date || null;
		} catch {
			return null;
		}
	}

	// Gewerke-Status aus column_values extrahieren
	let gewerke = $derived(gewerkeList.map(g => ({
		...g,
		status: extractField(g.fieldId) || 'Geplant'
	})));

	// Termine extrahieren
	let termineDaten = $derived(termine.map(t => ({
		label: t.label,
		datum: extractDate(t.fieldId)
	})));

	// Gefilterte Maengel
	let gefilterteMaengel = $derived(
		maengelFilter === 'alle'
			? maengel
			: maengel.filter(m => {
				if (maengelFilter === 'offen') return m.status_mangel !== '(2) Abgeschlossen';
				if (maengelFilter === 'behoben') return m.status_mangel === '(2) Abgeschlossen';
				return true;
			})
	);

	// Statistiken
	let offeneMaengel = $derived(maengel.filter(m => m.status_mangel !== '(2) Abgeschlossen').length);
	let offeneNachtraege = $derived(nachtraege.filter(n => n.status === '(0) Offen' || n.status === '(1) Preis eingegeben').length);
	let nachtraegeSumme = $derived(nachtraege.reduce((sum, n) => sum + (n.betrag_kunde_netto || 0), 0));

	// Daten laden
	async function loadData() {
		if (!projektNr) {
			loading = false;
			return;
		}

		try {
			// Lade Maengel (Ausfuehrungsmaengel)
			const { data: maengelData } = await supabase
				.from('maengel_fertigstellung')
				.select('*')
				.eq('projekt_nr', projektNr)
				.order('created_at', { ascending: false });

			if (maengelData) maengel = maengelData;

			// Lade Nachtraege
			const { data: nachtraegeData } = await supabase
				.from('nachtraege')
				.select('*')
				.eq('atbs_nummer', projektNr)
				.order('created_at', { ascending: false });

			if (nachtraegeData) nachtraege = nachtraegeData;

			// Lade Einkauf-Rechnungen (NUA-Rechnungen)
			const { data: rechnungenData } = await supabase
				.from('softr_dokumente')
				.select('*')
				.eq('atbs_nummer', projektNr)
				.in('art_des_dokuments_id', ['NUA-A', 'NUA-S', 'ER-M'])
				.order('datum_erstellt', { ascending: false });

			if (rechnungenData) einkaufRechnungen = rechnungenData;

		} catch (e) {
			console.error('Fehler beim Laden:', e);
		} finally {
			loading = false;
		}
	}

	// Formatierung
	function formatCurrency(value: number | null): string {
		if (value === null || value === undefined) return '-';
		return new Intl.NumberFormat('de-DE', {
			style: 'currency',
			currency: 'EUR',
			maximumFractionDigits: 0
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

	function getStatusVariant(status: string): 'success' | 'warning' | 'error' | 'default' {
		const s = status.toLowerCase();
		if (s.includes('erledigt') || s.includes('abgeschlossen') || s.includes('genehmigt') || s.includes('bezahlt')) return 'success';
		if (s.includes('arbeit') || s.includes('prüfung') || s.includes('eingegeben')) return 'warning';
		if (s.includes('offen') || s.includes('abgelehnt') || s.includes('überfällig')) return 'error';
		return 'default';
	}

	function getGewerkeStatusVariant(status: string): 'success' | 'warning' | 'error' | 'default' {
		switch (status) {
			case 'Erledigt': return 'success';
			case 'In Arbeit': return 'warning';
			case 'Offen': return 'error';
			case 'Geplant':
			default: return 'default';
		}
	}

	function getFotoCount(fotos: unknown): number {
		if (!fotos) return 0;
		if (Array.isArray(fotos)) return fotos.length;
		return 0;
	}

	function calculateDauer(frist: string | null, behoben: string | null): string {
		if (!frist) return '-';
		const fristDate = new Date(frist);
		const endDate = behoben ? new Date(behoben) : new Date();
		const diff = Math.ceil((endDate.getTime() - fristDate.getTime()) / (1000 * 60 * 60 * 24));
		if (diff > 0) return `+${diff} Tage`;
		if (diff < 0) return `${diff} Tage`;
		return '0 Tage';
	}

	onMount(() => {
		loadData();
	});
</script>

<div class="phase-umsetzung">
	{#if loading}
		<div class="loading">Lade Daten...</div>
	{:else}
		<!-- Gewerke Ausfuehrung -->
		<Card>
			{#snippet header()}
				<div class="section-header">
					<h3>Ausfuehrung Gewerke</h3>
				</div>
			{/snippet}

			<div class="gewerke-grid">
				{#each gewerke as gewerk}
					<div class="gewerk-item">
						<span class="gewerk-name">{gewerk.name}</span>
						<Badge variant={getGewerkeStatusVariant(gewerk.status)} size="sm">
							{gewerk.status}
						</Badge>
					</div>
				{/each}
			</div>
		</Card>

		<!-- Termine -->
		<Card>
			{#snippet header()}
				<div class="section-header">
					<h3>Termine</h3>
				</div>
			{/snippet}

			<div class="table-container">
				<table class="data-table">
					<thead>
						<tr>
							<th>Meilenstein</th>
							<th>Datum</th>
						</tr>
					</thead>
					<tbody>
						{#each termineDaten as termin}
							<tr>
								<td>{termin.label}</td>
								<td class="date-cell">{formatDate(termin.datum)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Card>

		<!-- Nachtraege -->
		<Card>
			{#snippet header()}
				<div class="section-header">
					<h3>Nachtraege</h3>
					<div class="header-stats">
						<Badge variant={offeneNachtraege > 0 ? 'warning' : 'success'}>
							{offeneNachtraege} offen
						</Badge>
						<span class="summe">{formatCurrency(nachtraegeSumme)}</span>
					</div>
				</div>
			{/snippet}

			{#if nachtraege.length > 0}
				<div class="table-container">
					<table class="data-table">
						<thead>
							<tr>
								<th>Nr</th>
								<th>Status</th>
								<th>Titel</th>
								<th>Beschreibung</th>
								<th>Kunde</th>
								<th>NU</th>
								<th>Dauer</th>
								<th>Fotos</th>
							</tr>
						</thead>
						<tbody>
							{#each nachtraege as nachtrag}
								<tr>
									<td class="mono">{nachtrag.nachtrag_nr}</td>
									<td>
										<Badge variant={getStatusVariant(nachtrag.status)} size="sm">
											{nachtrag.status}
										</Badge>
									</td>
									<td class="text-cell">{nachtrag.titel || '-'}</td>
									<td class="text-cell desc-cell">{nachtrag.beschreibung || '-'}</td>
									<td class="amount-cell">{formatCurrency(nachtrag.betrag_kunde_netto)}</td>
									<td class="amount-cell">{formatCurrency(nachtrag.betrag_nu_netto)}</td>
									<td>{nachtrag.verzoegerung_tage ? `+${nachtrag.verzoegerung_tage}d` : '-'}</td>
									<td>{getFotoCount(nachtrag.foto_urls)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="empty-text">Keine Nachtraege vorhanden</p>
			{/if}

			<div class="section-actions">
				<Button variant="primary" size="sm">+ Neuer Nachtrag</Button>
			</div>
		</Card>

		<!-- Ausfuehrungsmaengel -->
		<Card>
			{#snippet header()}
				<div class="section-header">
					<h3>Ausfuehrungsmaengel</h3>
					<div class="header-stats">
						<Badge variant={offeneMaengel > 0 ? 'error' : 'success'}>
							{offeneMaengel} offen
						</Badge>
					</div>
				</div>
			{/snippet}

			<div class="filter-bar">
				<button
					class="filter-btn"
					class:active={maengelFilter === 'alle'}
					onclick={() => maengelFilter = 'alle'}
				>
					Alle ({maengel.length})
				</button>
				<button
					class="filter-btn"
					class:active={maengelFilter === 'offen'}
					onclick={() => maengelFilter = 'offen'}
				>
					Offen ({offeneMaengel})
				</button>
				<button
					class="filter-btn"
					class:active={maengelFilter === 'behoben'}
					onclick={() => maengelFilter = 'behoben'}
				>
					Behoben ({maengel.length - offeneMaengel})
				</button>
			</div>

			{#if gefilterteMaengel.length > 0}
				<div class="table-container">
					<table class="data-table">
						<thead>
							<tr>
								<th>Mangel Nr.</th>
								<th>Status BL</th>
								<th>Beschreibung</th>
								<th>Fotos</th>
								<th>Frist</th>
								<th>Behoben</th>
								<th>Dauer</th>
								<th>Status NU</th>
								<th>Nachweise</th>
								<th>Kommentar NU</th>
							</tr>
						</thead>
						<tbody>
							{#each gefilterteMaengel as mangel}
								<tr>
									<td class="mono">{mangel.mangel_nr || mangel.id.slice(0, 8)}</td>
									<td>
										<Badge variant={getStatusVariant(mangel.status_mangel)} size="sm">
											{mangel.status_mangel}
										</Badge>
									</td>
									<td class="text-cell desc-cell">{mangel.beschreibung_mangel || '-'}</td>
									<td>{getFotoCount(mangel.fotos_mangel)}</td>
									<td class="date-cell">{formatDate(mangel.datum_frist)}</td>
									<td class="date-cell">{formatDate(mangel.mangel_behoben_datum)}</td>
									<td>{calculateDauer(mangel.datum_frist, mangel.mangel_behoben_datum)}</td>
									<td>
										{#if mangel.status_mangel_nu}
											<Badge variant={getStatusVariant(mangel.status_mangel_nu)} size="sm">
												{mangel.status_mangel_nu}
											</Badge>
										{:else}
											-
										{/if}
									</td>
									<td>{getFotoCount(mangel.fotos_nachweis_nu)}</td>
									<td class="text-cell">{mangel.kommentar_nu || '-'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="empty-text">Keine Maengel vorhanden</p>
			{/if}

			<div class="section-actions">
				<Button variant="primary" size="sm">+ Neuer Mangel</Button>
			</div>
		</Card>

		<!-- Einkaufe andere NUs -->
		<Card>
			{#snippet header()}
				<div class="section-header">
					<h3>Einkaufe andere NUs</h3>
				</div>
			{/snippet}

			{#if einkaufRechnungen.length > 0}
				<div class="table-container">
					<table class="data-table">
						<thead>
							<tr>
								<th>RE-Nr</th>
								<th>Steller</th>
								<th>Art</th>
								<th>Zahlung</th>
								<th>Betrag</th>
								<th>Bezahlt</th>
								<th>Offen</th>
								<th>Erstellt</th>
								<th>Faellig</th>
								<th>RE</th>
								<th>Notizen</th>
							</tr>
						</thead>
						<tbody>
							{#each einkaufRechnungen as rechnung}
								<tr>
									<td class="mono">{rechnung.dokument_nr}</td>
									<td class="text-cell">{rechnung.rechnungssteller || '-'}</td>
									<td>
										<Badge variant="default" size="sm">
											{rechnung.art_des_dokuments || '-'}
										</Badge>
									</td>
									<td>
										<Badge variant={getStatusVariant(rechnung.status || '')} size="sm">
											{rechnung.status || '-'}
										</Badge>
									</td>
									<td class="amount-cell">{formatCurrency(rechnung.betrag_netto)}</td>
									<td class="amount-cell">{formatCurrency(rechnung.betrag_bezahlt)}</td>
									<td class="amount-cell">{formatCurrency(rechnung.betrag_offen)}</td>
									<td class="date-cell">{formatDate(rechnung.datum_erstellt)}</td>
									<td class="date-cell">{formatDate(rechnung.datum_zahlungsfrist)}</td>
									<td>
										{#if rechnung.datei_url}
											<a href={rechnung.datei_url} target="_blank" class="file-link">PDF</a>
										{:else}
											-
										{/if}
									</td>
									<td class="text-cell">{rechnung.notizen || '-'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="empty-text">Keine Einkauf-Rechnungen vorhanden</p>
			{/if}

			<div class="section-actions">
				<Button variant="primary" size="sm">+ RE hinzufuegen</Button>
			</div>
		</Card>
	{/if}
</div>

<style>
	.phase-umsetzung {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.loading {
		text-align: center;
		padding: 2rem;
		color: var(--color-gray-500);
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.section-header h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
	}

	.header-stats {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.summe {
		font-weight: 600;
		color: var(--color-gray-700);
	}

	/* Gewerke Grid */
	.gewerke-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
	}

	@media (max-width: 768px) {
		.gewerke-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 480px) {
		.gewerke-grid {
			grid-template-columns: 1fr;
		}
	}

	.gewerk-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0.75rem;
		background: var(--color-gray-50);
		border: 1px solid var(--color-gray-200);
	}

	.gewerk-name {
		font-size: 0.85rem;
		color: var(--color-gray-700);
	}

	/* Filter Bar */
	.filter-bar {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--color-gray-200);
	}

	.filter-btn {
		padding: 0.4rem 0.75rem;
		font-size: 0.8rem;
		background: var(--color-gray-100);
		border: 1px solid var(--color-gray-200);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.filter-btn:hover {
		background: var(--color-gray-200);
	}

	.filter-btn.active {
		background: var(--color-brand-medium);
		color: white;
		border-color: var(--color-brand-medium);
	}

	/* Table Container */
	.table-container {
		overflow-x: auto;
		margin: -0.5rem;
		padding: 0.5rem;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8rem;
	}

	.data-table th,
	.data-table td {
		padding: 0.5rem 0.75rem;
		text-align: left;
		border-bottom: 1px solid var(--color-gray-100);
		white-space: nowrap;
	}

	.data-table th {
		background: var(--color-gray-50);
		font-weight: 600;
		color: var(--color-gray-600);
		font-size: 0.75rem;
		text-transform: uppercase;
	}

	.data-table tbody tr:hover {
		background: var(--color-gray-50);
	}

	.mono {
		font-family: var(--font-family-mono);
		font-size: 0.75rem;
	}

	.date-cell {
		font-family: var(--font-family-mono);
		font-size: 0.75rem;
		color: var(--color-gray-600);
	}

	.amount-cell {
		font-family: var(--font-family-mono);
		text-align: right;
		font-weight: 500;
	}

	.text-cell {
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.desc-cell {
		max-width: 200px;
	}

	.file-link {
		color: var(--color-brand-medium);
		text-decoration: none;
		font-weight: 500;
	}

	.file-link:hover {
		text-decoration: underline;
	}

	.empty-text {
		color: var(--color-gray-400);
		text-align: center;
		padding: 1.5rem;
		margin: 0;
	}

	.section-actions {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-gray-200);
	}
</style>
