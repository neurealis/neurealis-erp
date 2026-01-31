<script lang="ts">
	import { Card, Badge, Button } from '$lib/components/ui';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';

	interface Props {
		columnValues: Record<string, unknown>;
		projektNr: string | null;
		nuName?: string | null;
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
		nua_nr: string | null;
		datei_url: string | null;
		notizen: string | null;
	}

	interface NUAAuftrag {
		nua_nr: string;
		typ: string;
		freigabe_status: string | null;
		datum_erstellt: string | null;
		betrag_brutto: number | null;
		betrag_netto: number | null;
		betrag_abschlag?: number | null;
		ende_plan?: string | null;
		ende_maengelfrei?: string | null;
		verspaetung_tage?: number | null;
		strafe_pro_tag?: number | null;
		strafe_gesamt?: number | null;
	}

	let { columnValues, projektNr, nuName }: Props = $props();

	// State
	let rechnungen = $state<Rechnung[]>([]);
	let loading = $state(true);

	// Extrahiere Feld aus column_values
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

	// Budget aus Monday
	let budgetNU = $derived(extractNumber('numbers_budget_nu') || 0);

	// Gefilterte Rechnungen (nur NU-Rechnungen NUA-S, NUA-A, ER-*)
	let nuRechnungen = $derived(
		rechnungen.filter(r =>
			r.art_des_dokuments_id?.startsWith('NUA-') ||
			r.art_des_dokuments_id?.startsWith('ER-') ||
			r.art_des_dokuments?.includes('Eingangsrechnung')
		)
	);

	// Gruppiere nach NUA-Nr für Übersicht
	let nuaUebersicht = $derived(() => {
		const grouped: Map<string, NUAAuftrag> = new Map();

		nuRechnungen.forEach(r => {
			const nua = r.nua_nr || 'Ohne NUA';
			if (!grouped.has(nua)) {
				grouped.set(nua, {
					nua_nr: nua,
					typ: r.art_des_dokuments_id?.includes('S') ? 'Schluss' : 'Abschlag',
					freigabe_status: r.freigabe_status,
					datum_erstellt: r.datum_erstellt,
					betrag_brutto: r.betrag_brutto,
					betrag_netto: r.betrag_netto,
				});
			}
		});

		return Array.from(grouped.values());
	});

	// Summen berechnen
	let summenRechnungen = $derived({
		netto: nuRechnungen.reduce((sum, r) => sum + (r.betrag_netto || 0), 0),
		brutto: nuRechnungen.reduce((sum, r) => sum + (r.betrag_brutto || 0), 0),
		bezahlt: nuRechnungen.reduce((sum, r) => sum + (r.betrag_bezahlt || 0), 0),
		offen: nuRechnungen.reduce((sum, r) => sum + (r.betrag_offen || 0), 0),
	});

	// Budget Differenz
	let budgetDifferenz = $derived(budgetNU - summenRechnungen.netto);
	let schlussrechnungBetrag = $derived(Math.max(0, budgetDifferenz));

	// Daten laden
	async function loadData() {
		if (!projektNr) {
			loading = false;
			return;
		}

		try {
			const { data: rechnungenData } = await supabase
				.from('softr_dokumente')
				.select('*')
				.eq('atbs_nummer', projektNr)
				.order('datum_erstellt', { ascending: false });

			if (rechnungenData) rechnungen = rechnungenData;

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

	function calculateVerspaetung(endePlan: string | null, endeMaengelfrei: string | null): number {
		if (!endePlan) return 0;
		const planDate = new Date(endePlan);
		const endDate = endeMaengelfrei ? new Date(endeMaengelfrei) : new Date();
		const diff = Math.ceil((endDate.getTime() - planDate.getTime()) / (1000 * 60 * 60 * 24));
		return Math.max(0, diff);
	}

	onMount(() => {
		loadData();
	});
</script>

<div class="phase-rechnung-nu">
	{#if loading}
		<div class="loading">Lade Daten...</div>
	{:else}
		<!-- Rechnungen Tabelle -->
		<Card>
			{#snippet header()}
				<div class="section-header">
					<h3>Rechnungen NU</h3>
					<Badge variant={summenRechnungen.offen > 0 ? 'warning' : 'success'}>
						{formatCurrency(summenRechnungen.offen)} offen
					</Badge>
				</div>
			{/snippet}

			{#if nuRechnungen.length > 0}
				<div class="table-container">
					<table class="data-table">
						<thead>
							<tr>
								<th>RE-Nr</th>
								<th>Steller</th>
								<th>Art</th>
								<th>Prüfung</th>
								<th>Zahlung</th>
								<th>Brutto</th>
								<th>Netto</th>
								<th>Bezahlt</th>
								<th>Offen</th>
								<th>Erstellt</th>
								<th>NU Fertig</th>
								<th>Faellig</th>
								<th>Bezahlt am</th>
								<th>Datei</th>
								<th>Notizen</th>
							</tr>
						</thead>
						<tbody>
							{#each nuRechnungen as rechnung}
								<tr>
									<td class="mono">{rechnung.dokument_nr}</td>
									<td class="text-cell">{rechnung.rechnungssteller || '-'}</td>
									<td>
										<Badge variant="default" size="sm">
											{rechnung.art_des_dokuments_id || '-'}
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
				<p class="empty-text">Keine NU-Rechnungen vorhanden</p>
			{/if}
		</Card>

		<!-- NUA Übersicht -->
		<Card>
			{#snippet header()}
				<div class="section-header">
					<h3>NUA-Übersicht</h3>
				</div>
			{/snippet}

			{#if nuaUebersicht().length > 0}
				<div class="table-container">
					<table class="data-table">
						<thead>
							<tr>
								<th>Typ</th>
								<th>NUA-Nr.</th>
								<th>Prüfung</th>
								<th>Erstellt</th>
								<th>Brutto</th>
								<th>Netto</th>
								<th>Abschlag</th>
								<th>Ende Plan</th>
								<th>Ende mängelfrei</th>
								<th>Verspätung</th>
								<th>Strafe/Tag</th>
								<th>Strafe</th>
								<th>Notizen</th>
							</tr>
						</thead>
						<tbody>
							{#each nuaUebersicht() as nua}
								<tr>
									<td>
										<Badge variant={nua.typ === 'Schluss' ? 'success' : 'warning'} size="sm">
											{nua.typ}
										</Badge>
									</td>
									<td class="mono">{nua.nua_nr}</td>
									<td>
										<Badge variant={getStatusVariant(nua.freigabe_status)} size="sm">
											{nua.freigabe_status || '-'}
										</Badge>
									</td>
									<td class="date-cell">{formatDate(nua.datum_erstellt)}</td>
									<td class="amount-cell">{formatCurrency(nua.betrag_brutto)}</td>
									<td class="amount-cell">{formatCurrency(nua.betrag_netto)}</td>
									<td class="amount-cell">{formatCurrency(nua.betrag_abschlag)}</td>
									<td class="date-cell">{formatDate(nua.ende_plan)}</td>
									<td class="date-cell">{formatDate(nua.ende_maengelfrei)}</td>
									<td>{nua.verspaetung_tage ? `${nua.verspaetung_tage}d` : '-'}</td>
									<td>0,25%</td>
									<td class="amount-cell">{formatCurrency(nua.strafe_gesamt)}</td>
									<td>-</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="empty-text">Keine NUA-Aufträge</p>
			{/if}
		</Card>

		<!-- Summen Tabelle -->
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
							<th>Budget</th>
							<th>Rechnungen</th>
							<th>Zahlungen</th>
							<th>Offen</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td class="row-label">Schluss</td>
							<td class="amount-cell">{formatCurrency(budgetNU)}</td>
							<td class="amount-cell">{formatCurrency(summenRechnungen.netto)}</td>
							<td class="amount-cell">{formatCurrency(summenRechnungen.bezahlt)}</td>
							<td class="amount-cell amount-open">{formatCurrency(summenRechnungen.offen)}</td>
						</tr>
						<tr>
							<td class="row-label">Verzögerung</td>
							<td class="amount-cell">-</td>
							<td class="amount-cell">-</td>
							<td class="amount-cell">-</td>
							<td class="amount-cell">-</td>
						</tr>
						<tr>
							<td class="row-label">Material</td>
							<td class="amount-cell">-</td>
							<td class="amount-cell">-</td>
							<td class="amount-cell">-</td>
							<td class="amount-cell">-</td>
						</tr>
						<tr class="total-row">
							<td class="row-label">Final</td>
							<td class="amount-cell">{formatCurrency(budgetNU)}</td>
							<td class="amount-cell">{formatCurrency(summenRechnungen.netto)}</td>
							<td class="amount-cell">{formatCurrency(summenRechnungen.bezahlt)}</td>
							<td class="amount-cell amount-open">{formatCurrency(summenRechnungen.offen)}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</Card>

		<!-- Info Box -->
		<Card>
			<div class="info-box">
				<span class="info-icon">i</span>
				<div class="info-content">
					<strong>Betrag für Deine Schlussrechnung:</strong>
					<span class="info-amount">{formatCurrency(schlussrechnungBetrag)}</span>
				</div>
			</div>

			{#if budgetDifferenz < 0}
				<div class="warning-box">
					<span class="warning-icon">!</span>
					<span class="warning-text">
						Budget überschritten um {formatCurrency(Math.abs(budgetDifferenz))}
					</span>
				</div>
			{/if}
		</Card>
	{/if}
</div>

<style>
	.phase-rechnung-nu {
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
		max-width: 600px;
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

	/* Info Box */
	.info-box {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		background: var(--color-info-light);
		border: 1px solid var(--color-info);
	}

	.info-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background: var(--color-info);
		color: white;
		font-weight: 700;
		font-size: 0.9rem;
	}

	.info-content {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.info-content strong {
		font-size: 0.85rem;
		color: var(--color-info-dark);
	}

	.info-amount {
		font-size: 1.25rem;
		font-weight: 700;
		font-family: var(--font-family-mono);
		color: var(--color-info-dark);
	}

	/* Warning Box */
	.warning-box {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		margin-top: 1rem;
		background: var(--color-error-light);
		border: 1px solid var(--color-error);
	}

	.warning-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background: var(--color-error);
		color: white;
		font-weight: 700;
		font-size: 0.9rem;
	}

	.warning-text {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--color-error-dark);
	}

	.empty-text {
		color: var(--color-gray-400);
		text-align: center;
		padding: 1.5rem;
		margin: 0;
	}
</style>
