<script lang="ts">
	import { Card, Badge } from '$lib/components/ui';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';

	interface Props {
		columnValues: Record<string, unknown>;
		projektNr: string | null;
	}

	interface Rechnung {
		id: string;
		art_des_dokuments_id: string | null;
		betrag_netto: number | null;
	}

	let { columnValues, projektNr }: Props = $props();

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

	// Berechnungen aus Rechnungen
	let ausgangsrechnungen = $derived(
		rechnungen
			.filter(r => r.art_des_dokuments_id?.startsWith('AR-'))
			.reduce((sum, r) => sum + (r.betrag_netto || 0), 0)
	);

	let eingangsrechnungen = $derived(
		rechnungen
			.filter(r =>
				r.art_des_dokuments_id?.startsWith('ER-') ||
				r.art_des_dokuments_id?.startsWith('NUA-')
			)
			.reduce((sum, r) => sum + (r.betrag_netto || 0), 0)
	);

	let rohertrag = $derived(ausgangsrechnungen - eingangsrechnungen);
	let rohertagProzent = $derived(
		ausgangsrechnungen > 0
			? Math.round((rohertrag / ausgangsrechnungen) * 100)
			: 0
	);

	// Wasserfalldiagramm Daten
	let wasserfallDaten = $derived([
		{
			label: 'Ausgangsrechnungen',
			value: ausgangsrechnungen,
			type: 'income' as const,
			cumulative: ausgangsrechnungen,
		},
		{
			label: 'Eingangsrechnungen',
			value: -eingangsrechnungen,
			type: 'expense' as const,
			cumulative: rohertrag,
		},
		{
			label: 'Rohertrag',
			value: rohertrag,
			type: 'result' as const,
			cumulative: rohertrag,
		},
	]);

	// Maximalwert fuer Skalierung
	let maxValue = $derived(
		Math.max(ausgangsrechnungen, eingangsrechnungen, Math.abs(rohertrag)) || 1
	);

	// Daten laden
	async function loadData() {
		if (!projektNr) {
			loading = false;
			return;
		}

		try {
			const { data: rechnungenData } = await supabase
				.from('softr_dokumente')
				.select('id, art_des_dokuments_id, betrag_netto')
				.eq('atbs_nummer', projektNr);

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

	function getBarWidth(value: number): number {
		return Math.abs(value) / maxValue * 100;
	}

	function getBarColor(type: 'income' | 'expense' | 'result', value: number): string {
		if (type === 'income') return 'var(--color-success)';
		if (type === 'expense') return 'var(--color-error)';
		if (type === 'result') return value >= 0 ? 'var(--color-success)' : 'var(--color-error)';
		return 'var(--color-gray-400)';
	}

	onMount(() => {
		loadData();
	});
</script>

<div class="phase-nachkalkulation">
	{#if loading}
		<div class="loading">Lade Daten...</div>
	{:else}
		<!-- KPI Karten -->
		<div class="kpi-grid">
			<Card>
				<div class="kpi-card">
					<span class="kpi-label">Ausgangsrechnungen</span>
					<span class="kpi-value income">{formatCurrency(ausgangsrechnungen)}</span>
					<span class="kpi-subtitle">Summe Kundenrechnungen</span>
				</div>
			</Card>

			<Card>
				<div class="kpi-card">
					<span class="kpi-label">Eingangsrechnungen</span>
					<span class="kpi-value expense">{formatCurrency(eingangsrechnungen)}</span>
					<span class="kpi-subtitle">Summe NU + Material</span>
				</div>
			</Card>

			<Card>
				<div class="kpi-card">
					<span class="kpi-label">Rohertrag</span>
					<div class="kpi-row">
						<span class="kpi-value" class:positive={rohertrag >= 0} class:negative={rohertrag < 0}>
							{formatCurrency(rohertrag)}
						</span>
						<Badge variant={rohertrag >= 0 ? 'success' : 'error'} size="sm">
							{rohertagProzent}%
						</Badge>
					</div>
					<span class="kpi-subtitle">Differenz AR - ER</span>
				</div>
			</Card>
		</div>

		<!-- Wasserfalldiagramm -->
		<Card>
			{#snippet header()}
				<div class="section-header">
					<h3>Wasserfalldiagramm</h3>
				</div>
			{/snippet}

			<div class="waterfall-chart">
				{#each wasserfallDaten as item, i}
					<div class="waterfall-row">
						<div class="waterfall-label">{item.label}</div>
						<div class="waterfall-bar-container">
							{#if item.type === 'result'}
								<!-- Ergebnis-Balken (startet bei 0) -->
								<div
									class="waterfall-bar result-bar"
									class:positive={item.value >= 0}
									class:negative={item.value < 0}
									style="
										width: {getBarWidth(item.value)}%;
										background-color: {getBarColor(item.type, item.value)};
									"
								>
									<span class="bar-value">{formatCurrency(item.value)}</span>
								</div>
							{:else if item.type === 'income'}
								<!-- Einnahmen-Balken (startet bei 0) -->
								<div
									class="waterfall-bar income-bar"
									style="
										width: {getBarWidth(item.value)}%;
										background-color: {getBarColor(item.type, item.value)};
									"
								>
									<span class="bar-value">{formatCurrency(item.value)}</span>
								</div>
							{:else}
								<!-- Ausgaben-Balken (zeigt Abzug vom Vorherigen) -->
								<div class="waterfall-bar-wrapper">
									<div
										class="waterfall-connector"
										style="width: {getBarWidth(ausgangsrechnungen)}%"
									></div>
									<div
										class="waterfall-bar expense-bar"
										style="
											width: {getBarWidth(Math.abs(item.value))}%;
											margin-left: {getBarWidth(rohertrag)}%;
											background-color: {getBarColor(item.type, item.value)};
										"
									>
										<span class="bar-value">{formatCurrency(Math.abs(item.value))}</span>
									</div>
								</div>
							{/if}
						</div>
						<div class="waterfall-cumulative">
							{item.type !== 'result' ? formatCurrency(item.cumulative) : ''}
						</div>
					</div>
				{/each}
			</div>

			<!-- Legende -->
			<div class="legend">
				<div class="legend-item">
					<span class="legend-color income"></span>
					<span>Einnahmen</span>
				</div>
				<div class="legend-item">
					<span class="legend-color expense"></span>
					<span>Ausgaben</span>
				</div>
				<div class="legend-item">
					<span class="legend-color result"></span>
					<span>Ergebnis</span>
				</div>
			</div>
		</Card>

		<!-- Detaillierte Aufschluesselung -->
		<Card>
			{#snippet header()}
				<div class="section-header">
					<h3>Aufschluesselung</h3>
				</div>
			{/snippet}

			<div class="breakdown-list">
				<div class="breakdown-section">
					<h4>Ausgangsrechnungen (Kunde)</h4>
					<div class="breakdown-item">
						<span>Abschlagsrechnungen</span>
						<span class="amount income">
							{formatCurrency(
								rechnungen
									.filter(r => r.art_des_dokuments_id === 'AR-A')
									.reduce((s, r) => s + (r.betrag_netto || 0), 0)
							)}
						</span>
					</div>
					<div class="breakdown-item">
						<span>Schlussrechnungen</span>
						<span class="amount income">
							{formatCurrency(
								rechnungen
									.filter(r => r.art_des_dokuments_id === 'AR-S')
									.reduce((s, r) => s + (r.betrag_netto || 0), 0)
							)}
						</span>
					</div>
					<div class="breakdown-item total">
						<span>Gesamt AR</span>
						<span class="amount income">{formatCurrency(ausgangsrechnungen)}</span>
					</div>
				</div>

				<div class="breakdown-section">
					<h4>Eingangsrechnungen (NU + Material)</h4>
					<div class="breakdown-item">
						<span>NUA-Schluss</span>
						<span class="amount expense">
							{formatCurrency(
								rechnungen
									.filter(r => r.art_des_dokuments_id === 'NUA-S')
									.reduce((s, r) => s + (r.betrag_netto || 0), 0)
							)}
						</span>
					</div>
					<div class="breakdown-item">
						<span>NUA-Abschlag</span>
						<span class="amount expense">
							{formatCurrency(
								rechnungen
									.filter(r => r.art_des_dokuments_id === 'NUA-A')
									.reduce((s, r) => s + (r.betrag_netto || 0), 0)
							)}
						</span>
					</div>
					<div class="breakdown-item">
						<span>Materialrechnungen</span>
						<span class="amount expense">
							{formatCurrency(
								rechnungen
									.filter(r => r.art_des_dokuments_id?.startsWith('ER-'))
									.reduce((s, r) => s + (r.betrag_netto || 0), 0)
							)}
						</span>
					</div>
					<div class="breakdown-item total">
						<span>Gesamt ER</span>
						<span class="amount expense">{formatCurrency(eingangsrechnungen)}</span>
					</div>
				</div>

				<div class="breakdown-section result-section">
					<div class="breakdown-item total result">
						<span>Rohertrag</span>
						<div class="result-value">
							<span class="amount" class:positive={rohertrag >= 0} class:negative={rohertrag < 0}>
								{formatCurrency(rohertrag)}
							</span>
							<Badge variant={rohertrag >= 0 ? 'success' : 'error'}>
								{rohertagProzent}%
							</Badge>
						</div>
					</div>
				</div>
			</div>
		</Card>
	{/if}
</div>

<style>
	.phase-nachkalkulation {
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

	/* KPI Grid */
	.kpi-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
	}

	@media (max-width: 768px) {
		.kpi-grid {
			grid-template-columns: 1fr;
		}
	}

	.kpi-card {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.kpi-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		color: var(--color-gray-500);
	}

	.kpi-value {
		font-size: 1.5rem;
		font-weight: 700;
		font-family: var(--font-family-mono);
	}

	.kpi-value.income {
		color: var(--color-success-dark);
	}

	.kpi-value.expense {
		color: var(--color-error-dark);
	}

	.kpi-value.positive {
		color: var(--color-success-dark);
	}

	.kpi-value.negative {
		color: var(--color-error-dark);
	}

	.kpi-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.kpi-subtitle {
		font-size: 0.75rem;
		color: var(--color-gray-500);
	}

	/* Wasserfalldiagramm */
	.waterfall-chart {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem 0;
	}

	.waterfall-row {
		display: grid;
		grid-template-columns: 150px 1fr 100px;
		align-items: center;
		gap: 1rem;
	}

	@media (max-width: 640px) {
		.waterfall-row {
			grid-template-columns: 100px 1fr 80px;
		}
	}

	.waterfall-label {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--color-gray-700);
	}

	.waterfall-bar-container {
		height: 32px;
		background: var(--color-gray-100);
		position: relative;
	}

	.waterfall-bar {
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		padding: 0 0.75rem;
		min-width: 80px;
		transition: width 0.3s ease;
	}

	.waterfall-bar-wrapper {
		height: 100%;
		position: relative;
	}

	.waterfall-connector {
		position: absolute;
		top: 50%;
		left: 0;
		height: 2px;
		background: var(--color-gray-300);
		transform: translateY(-50%);
	}

	.expense-bar {
		position: absolute;
		top: 0;
	}

	.bar-value {
		font-size: 0.75rem;
		font-weight: 600;
		color: white;
		white-space: nowrap;
	}

	.result-bar.positive {
		background: var(--color-success) !important;
	}

	.result-bar.negative {
		background: var(--color-error) !important;
	}

	.waterfall-cumulative {
		font-size: 0.8rem;
		font-family: var(--font-family-mono);
		color: var(--color-gray-600);
		text-align: right;
	}

	/* Legende */
	.legend {
		display: flex;
		gap: 1.5rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-gray-200);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		color: var(--color-gray-600);
	}

	.legend-color {
		width: 16px;
		height: 16px;
	}

	.legend-color.income {
		background: var(--color-success);
	}

	.legend-color.expense {
		background: var(--color-error);
	}

	.legend-color.result {
		background: linear-gradient(90deg, var(--color-success) 50%, var(--color-error) 50%);
	}

	/* Breakdown List */
	.breakdown-list {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.breakdown-section h4 {
		margin: 0 0 0.75rem 0;
		font-size: 0.85rem;
		color: var(--color-gray-600);
		text-transform: uppercase;
	}

	.breakdown-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--color-gray-100);
	}

	.breakdown-item.total {
		border-bottom: none;
		padding-top: 0.75rem;
		margin-top: 0.25rem;
		border-top: 2px solid var(--color-gray-200);
		font-weight: 600;
	}

	.breakdown-item.result {
		background: var(--color-gray-50);
		margin: 0 -1.25rem;
		padding: 1rem 1.25rem;
	}

	.amount {
		font-family: var(--font-family-mono);
		font-weight: 500;
	}

	.amount.income {
		color: var(--color-success-dark);
	}

	.amount.expense {
		color: var(--color-error-dark);
	}

	.amount.positive {
		color: var(--color-success-dark);
	}

	.amount.negative {
		color: var(--color-error-dark);
	}

	.result-section {
		margin-top: 0.5rem;
	}

	.result-value {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.result-value .amount {
		font-size: 1.25rem;
		font-weight: 700;
	}
</style>
