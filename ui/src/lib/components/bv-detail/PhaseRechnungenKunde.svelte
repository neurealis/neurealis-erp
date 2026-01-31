<script lang="ts">
	import { Card, Badge, Button } from '$lib/components/ui';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';

	interface Props {
		columnValues: Record<string, unknown>;
		projektNr: string | null;
	}

	interface Rechnung {
		id: string;
		dokument_nr: string;
		rechnungssteller: string | null;
		art_des_dokuments: string | null;
		art_des_dokuments_id: string | null;
		status: string | null;
		freigabe_status: string | null;
		betrag_netto: number | null;
		betrag_brutto: number | null;
		betrag_bezahlt: number | null;
		betrag_offen: number | null;
		datum_erstellt: string | null;
		datum_zahlungsfrist: string | null;
		datei_url: string | null;
		notizen: string | null;
	}

	interface Nachtrag {
		id: string;
		nachtrag_nr: string;
		status: string;
		titel: string | null;
		betrag_kunde_netto: number | null;
	}

	let { columnValues, projektNr }: Props = $props();

	// State
	let rechnungen = $state<Rechnung[]>([]);
	let nachtraege = $state<Nachtrag[]>([]);
	let loading = $state(true);

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

	function extractNumber(fieldId: string): number | null {
		try {
			const field = columnValues[fieldId];
			if (!field) return null;
			const parsed = typeof field === 'string' ? JSON.parse(field) : field;
			const num = parseFloat(parsed?.text || parsed);
			return isNaN(num) ? null : num;
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

	// Abschlagsrechnung Konfiguration
	let abschlagVereinbart = $derived(extractField('status_abschlag') === 'Ja');
	let abschlagProzent = $derived(extractNumber('numbers_abschlag_prozent') || 40);
	let erstellenBis = $derived(extractDate('date_erstellen_bis'));

	// Gefilterte Rechnungen (nur Kundenrechnungen AR-S, AR-A)
	let kundenRechnungen = $derived(
		rechnungen.filter(r =>
			r.art_des_dokuments_id?.startsWith('AR-') ||
			r.art_des_dokuments?.includes('Ausgangsrechnung')
		)
	);

	// Teilrechnungen und Schlussrechnungen trennen
	let teilRechnungen = $derived(
		kundenRechnungen.filter(r =>
			r.art_des_dokuments_id === 'AR-A' ||
			r.art_des_dokuments?.includes('Abschlag')
		)
	);

	let schlussRechnungen = $derived(
		kundenRechnungen.filter(r =>
			r.art_des_dokuments_id === 'AR-S' ||
			r.art_des_dokuments?.includes('Schluss')
		)
	);

	// Summen berechnen
	let summenTeil = $derived({
		brutto: teilRechnungen.reduce((sum, r) => sum + (r.betrag_brutto || 0), 0),
		bezahlt: teilRechnungen.reduce((sum, r) => sum + (r.betrag_bezahlt || 0), 0),
		offen: teilRechnungen.reduce((sum, r) => sum + (r.betrag_offen || 0), 0),
	});

	let summenSchluss = $derived({
		brutto: schlussRechnungen.reduce((sum, r) => sum + (r.betrag_brutto || 0), 0),
		bezahlt: schlussRechnungen.reduce((sum, r) => sum + (r.betrag_bezahlt || 0), 0),
		offen: schlussRechnungen.reduce((sum, r) => sum + (r.betrag_offen || 0), 0),
	});

	let summenGesamt = $derived({
		brutto: kundenRechnungen.reduce((sum, r) => sum + (r.betrag_brutto || 0), 0),
		bezahlt: kundenRechnungen.reduce((sum, r) => sum + (r.betrag_bezahlt || 0), 0),
		offen: kundenRechnungen.reduce((sum, r) => sum + (r.betrag_offen || 0), 0),
	});

	// Genehmigte Nachtraege
	let genehmigteNachtraege = $derived(
		nachtraege.filter(n => n.status === '(2) Genehmigt')
	);

	// Daten laden
	async function loadData() {
		if (!projektNr) {
			loading = false;
			return;
		}

		try {
			// Lade Rechnungen
			const { data: rechnungenData } = await supabase
				.from('softr_dokumente')
				.select('*')
				.eq('atbs_nummer', projektNr)
				.order('datum_erstellt', { ascending: false });

			if (rechnungenData) rechnungen = rechnungenData;

			// Lade Nachtraege
			const { data: nachtraegeData } = await supabase
				.from('nachtraege')
				.select('id, nachtrag_nr, status, titel, betrag_kunde_netto')
				.eq('atbs_nummer', projektNr)
				.order('created_at', { ascending: false });

			if (nachtraegeData) nachtraege = nachtraegeData;

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

	function getStatusVariant(status: string | null): 'success' | 'warning' | 'error' | 'default' {
		if (!status) return 'default';
		const s = status.toLowerCase();
		if (s.includes('bezahlt') || s.includes('freigegeben') || s.includes('genehmigt')) return 'success';
		if (s.includes('prüfung') || s.includes('offen') || s.includes('teilweise')) return 'warning';
		if (s.includes('überfällig') || s.includes('mahnung') || s.includes('abgelehnt')) return 'error';
		return 'default';
	}

	onMount(() => {
		loadData();
	});
</script>

<div class="phase-rechnungen-kunde">
	{#if loading}
		<div class="loading">Lade Daten...</div>
	{:else}
		<!-- Abschlagsrechnung Config -->
		<Card>
			{#snippet header()}
				<div class="section-header">
					<h3>Abschlagsrechnung</h3>
					<Badge variant={abschlagVereinbart ? 'success' : 'default'}>
						{abschlagVereinbart ? 'Ja' : 'Nein'}
					</Badge>
				</div>
			{/snippet}

			<div class="config-grid">
				<div class="config-item">
					<span class="config-label">Abschlag vereinbart</span>
					<span class="config-value">{abschlagVereinbart ? 'Ja' : 'Nein'}</span>
				</div>

				{#if abschlagVereinbart}
					<div class="config-item">
						<span class="config-label">Abschlag %</span>
						<span class="config-value">{abschlagProzent}%</span>
					</div>

					<div class="config-item">
						<span class="config-label">Erstellen bis</span>
						<span class="config-value">{formatDate(erstellenBis)}</span>
					</div>
				{/if}
			</div>
		</Card>

		<!-- Nachtraege -->
		<Card>
			{#snippet header()}
				<div class="section-header">
					<h3>Nachtraege</h3>
					<Badge variant={genehmigteNachtraege.length > 0 ? 'success' : 'default'}>
						{genehmigteNachtraege.length} genehmigt
					</Badge>
				</div>
			{/snippet}

			{#if genehmigteNachtraege.length > 0}
				<div class="nachtraege-list">
					{#each genehmigteNachtraege as nachtrag}
						<div class="nachtrag-item">
							<span class="nachtrag-nr">{nachtrag.nachtrag_nr}</span>
							<span class="nachtrag-titel">{nachtrag.titel || 'Ohne Titel'}</span>
							<span class="nachtrag-betrag">{formatCurrency(nachtrag.betrag_kunde_netto)}</span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="empty-text">Keine genehmigten Nachtraege</p>
			{/if}

			<div class="section-actions">
				<Button variant="primary" size="sm">+ Nachtrag erstellen</Button>
			</div>
		</Card>

		<!-- Rechnungen Tabelle -->
		<Card>
			{#snippet header()}
				<div class="section-header">
					<h3>Rechnungen</h3>
					<Badge variant={summenGesamt.offen > 0 ? 'warning' : 'success'}>
						{formatCurrency(summenGesamt.offen)} offen
					</Badge>
				</div>
			{/snippet}

			{#if kundenRechnungen.length > 0}
				<div class="table-container">
					<table class="data-table">
						<thead>
							<tr>
								<th>RE-Nr</th>
								<th>Steller</th>
								<th>Art</th>
								<th>Pruefung</th>
								<th>Zahlung</th>
								<th>Brutto</th>
								<th>Netto</th>
								<th>Bezahlt</th>
								<th>Offen</th>
								<th>Erstellt</th>
								<th>Verschickt</th>
								<th>Faellig</th>
								<th>Bezahlt am</th>
								<th>RE</th>
								<th>Notizen</th>
							</tr>
						</thead>
						<tbody>
							{#each kundenRechnungen as rechnung}
								<tr>
									<td class="mono">{rechnung.dokument_nr}</td>
									<td class="text-cell">{rechnung.rechnungssteller || '-'}</td>
									<td>
										<Badge variant="default" size="sm">
											{rechnung.art_des_dokuments_id || rechnung.art_des_dokuments || '-'}
										</Badge>
									</td>
									<td>
										<Badge variant={getStatusVariant(rechnung.freigabe_status)} size="sm">
											{rechnung.freigabe_status || '-'}
										</Badge>
									</td>
									<td>
										<Badge variant={getStatusVariant(rechnung.status)} size="sm">
											{rechnung.status || '-'}
										</Badge>
									</td>
									<td class="amount-cell">{formatCurrency(rechnung.betrag_brutto)}</td>
									<td class="amount-cell">{formatCurrency(rechnung.betrag_netto)}</td>
									<td class="amount-cell">{formatCurrency(rechnung.betrag_bezahlt)}</td>
									<td class="amount-cell amount-open">{formatCurrency(rechnung.betrag_offen)}</td>
									<td class="date-cell">{formatDate(rechnung.datum_erstellt)}</td>
									<td class="date-cell">-</td>
									<td class="date-cell">{formatDate(rechnung.datum_zahlungsfrist)}</td>
									<td class="date-cell">-</td>
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
				<p class="empty-text">Keine Rechnungen vorhanden</p>
			{/if}
		</Card>

		<!-- Summen Übersicht -->
		<Card>
			{#snippet header()}
				<div class="section-header">
					<h3>Summen-Übersicht</h3>
				</div>
			{/snippet}

			<div class="table-container">
				<table class="data-table summen-table">
					<thead>
						<tr>
							<th></th>
							<th>Rechnungen</th>
							<th>Zahlungen</th>
							<th>Offene Beträge</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td class="row-label">Teil-RE</td>
							<td class="amount-cell">{formatCurrency(summenTeil.brutto)}</td>
							<td class="amount-cell">{formatCurrency(summenTeil.bezahlt)}</td>
							<td class="amount-cell amount-open">{formatCurrency(summenTeil.offen)}</td>
						</tr>
						<tr>
							<td class="row-label">Schluss-RE</td>
							<td class="amount-cell">{formatCurrency(summenSchluss.brutto)}</td>
							<td class="amount-cell">{formatCurrency(summenSchluss.bezahlt)}</td>
							<td class="amount-cell amount-open">{formatCurrency(summenSchluss.offen)}</td>
						</tr>
						<tr class="total-row">
							<td class="row-label">Gesamt</td>
							<td class="amount-cell">{formatCurrency(summenGesamt.brutto)}</td>
							<td class="amount-cell">{formatCurrency(summenGesamt.bezahlt)}</td>
							<td class="amount-cell amount-open">{formatCurrency(summenGesamt.offen)}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</Card>
	{/if}
</div>

<style>
	.phase-rechnungen-kunde {
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

	/* Config Grid */
	.config-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
	}

	@media (max-width: 640px) {
		.config-grid {
			grid-template-columns: 1fr;
		}
	}

	.config-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.config-label {
		font-size: 0.75rem;
		color: var(--color-gray-500);
		text-transform: uppercase;
	}

	.config-value {
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-gray-800);
	}

	/* Nachtraege List */
	.nachtraege-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.nachtrag-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.5rem 0.75rem;
		background: var(--color-gray-50);
		border: 1px solid var(--color-gray-200);
	}

	.nachtrag-nr {
		font-family: var(--font-family-mono);
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-gray-600);
	}

	.nachtrag-titel {
		flex: 1;
		font-size: 0.9rem;
		color: var(--color-gray-700);
	}

	.nachtrag-betrag {
		font-family: var(--font-family-mono);
		font-weight: 600;
		color: var(--color-gray-800);
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

	.amount-open {
		color: var(--color-warning-dark);
	}

	.text-cell {
		max-width: 120px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.file-link {
		color: var(--color-brand-medium);
		text-decoration: none;
		font-weight: 500;
	}

	.file-link:hover {
		text-decoration: underline;
	}

	/* Summen Table */
	.summen-table {
		max-width: 500px;
	}

	.summen-table .row-label {
		font-weight: 600;
		color: var(--color-gray-700);
	}

	.summen-table .total-row {
		background: var(--color-gray-100);
		font-weight: 700;
	}

	.summen-table .total-row td {
		border-bottom: none;
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
