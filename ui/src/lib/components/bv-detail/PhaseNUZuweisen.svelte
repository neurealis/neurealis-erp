<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	interface BVData {
		nu_status?: string;
		bv_start?: string;
		fertigstellung_nu?: string;
		bv_ende?: string;
		nua_nr?: string;
		nua_datum?: string;
		nua_link?: string;
		nua_datei_url?: string;
		nua_angenommen_am?: string;
		budget_bei_annahme?: number;
		// Gewerke
		gewerk_asbest?: string;
		gewerk_bad?: string;
		gewerk_boden?: string;
		gewerk_elektrik?: string;
		gewerk_elektrik_zaehler?: string;
		gewerk_gastherme?: string;
		gewerk_waende_decken?: string;
		gewerk_tueren?: string;
		// Kalkulation
		umsatz_netto?: number;
		andere_nus_einkauf?: number;
		marge_prozent?: number;
		budget_nu_netto?: number;
		budget_pro_qm?: number;
		grundflaeche?: number;
	}

	interface Props {
		bv: BVData;
		onAssignNU?: () => void;
		onAdjustTime?: () => void;
		onAdjustMarge?: () => void;
	}

	let { bv, onAssignNU, onAdjustTime, onAdjustMarge }: Props = $props();

	function formatDate(dateStr?: string): string {
		if (!dateStr) return '-';
		const date = new Date(dateStr);
		return date.toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
	}

	function formatCurrency(value?: number): string {
		if (value === undefined || value === null) return '-';
		return new Intl.NumberFormat('de-DE', {
			style: 'currency',
			currency: 'EUR'
		}).format(value);
	}

	function formatPercent(value?: number): string {
		if (value === undefined || value === null) return '-';
		return `${value.toFixed(1)}%`;
	}

	function getStatusVariant(status?: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
		switch (status?.toLowerCase()) {
			case 'nu-auftrag offen':
			case 'offen':
				return 'warning';
			case 'zugewiesen':
				return 'info';
			case 'angenommen':
			case 'bestaetigt':
				return 'success';
			default:
				return 'default';
		}
	}

	// Margen Referenzwerte
	const margenReferenz = [
		{ kunde: 'Privat', marge: 42 },
		{ kunde: 'WBG Luenen', marge: 37 },
		{ kunde: 'GWS', marge: 35 },
		{ kunde: 'VBW', marge: 25 },
		{ kunde: 'Vonovia', marge: 24 },
		{ kunde: 'Covivio', marge: 22 }
	];

	// Gewerke-Konfiguration
	const gewerke = [
		{ key: 'gewerk_asbest', label: 'Asbest', options: ['Ohne', 'Mit'] },
		{ key: 'gewerk_bad', label: 'Bad', options: ['Komplett', 'Teilweise', 'Ohne'] },
		{ key: 'gewerk_boden', label: 'Boden', options: ['Vinyl (Planken)', 'Fliesen', 'Parkett', 'Ohne'] },
		{ key: 'gewerk_elektrik', label: 'Elektrik', options: ['Komplett', 'Teilweise', 'Ohne'] },
		{ key: 'gewerk_elektrik_zaehler', label: 'Elektrik Zaehler', options: ['Offen', 'Erledigt'] },
		{ key: 'gewerk_gastherme', label: 'Gastherme', options: ['Ohne Therme', 'Mit Therme'] },
		{ key: 'gewerk_waende_decken', label: 'Waende/Decken', options: ['Raufaser & Anstrich', 'Glattvlies', 'Ohne'] },
		{ key: 'gewerk_tueren', label: 'Tueren', options: ['Tuerblaetter: neu | Zarge: neu', 'Tuerblaetter: neu', 'Ohne'] }
	];
</script>

<div class="phase-container">
	<div class="phase-header">
		<h3>(2.2) NU zuweisen</h3>
		<Badge variant={getStatusVariant(bv.nu_status)}>
			{bv.nu_status || 'NU-Auftrag offen'}
		</Badge>
	</div>

	<div class="section-grid">
		<!-- Zeitplan -->
		<div class="section">
			<h4>Zeitplan</h4>
			<div class="timeline">
				<div class="timeline-item">
					<span class="timeline-label">BV Start</span>
					<span class="timeline-value">{formatDate(bv.bv_start)}</span>
				</div>
				<div class="timeline-connector"></div>
				<div class="timeline-item">
					<span class="timeline-label">Fertigstellung NU</span>
					<span class="timeline-value">{formatDate(bv.fertigstellung_nu)}</span>
				</div>
				<div class="timeline-connector"></div>
				<div class="timeline-item">
					<span class="timeline-label">BV Ende</span>
					<span class="timeline-value">{formatDate(bv.bv_ende)}</span>
				</div>
			</div>
		</div>

		<!-- NUA-Auftrag -->
		<div class="section">
			<h4>NU-Auftrag</h4>
			<div class="field-grid">
				<div class="field">
					<label>NUA-Nr.</label>
					<span class="value mono highlight">{bv.nua_nr || '-'}</span>
				</div>
				<div class="field">
					<label>Datum</label>
					<span class="value">{formatDate(bv.nua_datum)}</span>
				</div>
				<div class="field">
					<label>Link</label>
					{#if bv.nua_link}
						<a href={bv.nua_link} target="_blank" class="link-external">
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
								<polyline points="15 3 21 3 21 9"/>
								<line x1="10" y1="14" x2="21" y2="3"/>
							</svg>
							SharePoint
						</a>
					{:else}
						<span class="value text-muted">Kein Link</span>
					{/if}
				</div>
				<div class="field">
					<label>Datei</label>
					{#if bv.nua_datei_url}
						<a href={bv.nua_datei_url} target="_blank" class="link-file">
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
								<polyline points="14 2 14 8 20 8"/>
							</svg>
							PDF öffnen
						</a>
					{:else}
						<span class="value text-muted">Keine Datei</span>
					{/if}
				</div>
				<div class="field">
					<label>NUA angenommen am</label>
					<span class="value" class:success={bv.nua_angenommen_am}>
						{formatDate(bv.nua_angenommen_am)}
						{#if bv.nua_angenommen_am}
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="check-icon">
								<polyline points="20 6 9 17 4 12"/>
							</svg>
						{/if}
					</span>
				</div>
				<div class="field">
					<label>Budget (bei Annahme NUA)</label>
					<span class="value highlight">{formatCurrency(bv.budget_bei_annahme)}</span>
				</div>
			</div>
		</div>

		<!-- Gewerke-Ausfuehrung -->
		<div class="section full-width">
			<h4>Gewerke-Ausfuehrung</h4>
			<div class="gewerke-grid">
				{#each gewerke as gewerk}
					<div class="gewerk-item">
						<span class="gewerk-label">{gewerk.label}</span>
						<span class="gewerk-value">
							{(bv as Record<string, any>)[gewerk.key] || '-'}
						</span>
					</div>
				{/each}
			</div>
		</div>

		<!-- Kalkulation -->
		<div class="section">
			<h4>Kalkulation</h4>
			<div class="calc-grid">
				<div class="calc-row">
					<span class="calc-label">Umsatz (netto)</span>
					<span class="calc-value">{formatCurrency(bv.umsatz_netto)}</span>
				</div>
				<div class="calc-row">
					<span class="calc-label">Andere NUs/Einkaeufe</span>
					<span class="calc-value negative">{formatCurrency(bv.andere_nus_einkauf)}</span>
				</div>
				<div class="calc-row">
					<span class="calc-label">Marge (%)</span>
					<span class="calc-value" class:low-marge={bv.marge_prozent !== undefined && bv.marge_prozent < 20}>
						{formatPercent(bv.marge_prozent)}
					</span>
				</div>
				<div class="calc-divider"></div>
				<div class="calc-row total">
					<span class="calc-label">Budget NU (netto)</span>
					<span class="calc-value">{formatCurrency(bv.budget_nu_netto)}</span>
				</div>
				<div class="calc-row">
					<span class="calc-label">Budget/m2</span>
					<span class="calc-value">
						{bv.budget_pro_qm ? `${bv.budget_pro_qm.toFixed(2)} Euro/m2` : '-'}
					</span>
				</div>
			</div>
		</div>

		<!-- Margen-Übersicht -->
		<div class="section">
			<h4>Margen-Übersicht (Referenz)</h4>
			<div class="info-box">
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10"/>
					<line x1="12" y1="16" x2="12" y2="12"/>
					<line x1="12" y1="8" x2="12.01" y2="8"/>
				</svg>
				<div class="marge-list">
					{#each margenReferenz as ref}
						<span class="marge-item">
							<strong>{ref.kunde}:</strong> {ref.marge}%
						</span>
					{/each}
				</div>
			</div>
		</div>
	</div>

	<!-- Aktionen -->
	<div class="actions">
		<Button variant="secondary" size="sm" onclick={onAdjustTime}>
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="10"/>
				<polyline points="12 6 12 12 16 14"/>
			</svg>
			Bauzeit anpassen
		</Button>
		<Button variant="secondary" size="sm" onclick={onAdjustMarge}>
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="12" y1="1" x2="12" y2="23"/>
				<path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
			</svg>
			Marge anpassen
		</Button>
		<Button variant="primary" size="sm" onclick={onAssignNU}>
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
				<circle cx="8.5" cy="7" r="4"/>
				<line x1="20" y1="8" x2="20" y2="14"/>
				<line x1="23" y1="11" x2="17" y2="11"/>
			</svg>
			NU zuweisen
		</Button>
	</div>
</div>

<style>
	.phase-container {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.phase-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.75rem;
		border-bottom: 2px solid var(--color-gray-200);
	}

	.phase-header h3 {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--color-gray-800);
	}

	.section-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1.5rem;
	}

	.section {
		background: var(--color-gray-50);
		padding: 1rem;
		border: 1px solid var(--color-gray-200);
	}

	.section.full-width {
		grid-column: 1 / -1;
	}

	.section h4 {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-gray-600);
		margin-bottom: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Timeline */
	.timeline {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0;
	}

	.timeline-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}

	.timeline-label {
		font-size: 0.7rem;
		color: var(--color-gray-500);
	}

	.timeline-value {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-gray-800);
	}

	.timeline-connector {
		flex: 1;
		height: 2px;
		background: var(--color-gray-300);
		margin: 0 0.5rem;
	}

	.field-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.field label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-gray-500);
	}

	.value {
		font-size: 0.9rem;
		color: var(--color-gray-800);
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

	.value.mono {
		font-family: var(--font-family-mono);
	}

	.value.highlight {
		font-weight: 600;
		color: var(--color-brand-medium);
	}

	.value.success {
		color: var(--color-success-dark);
	}

	.check-icon {
		color: var(--color-success);
	}

	.text-muted {
		color: var(--color-gray-400);
		font-style: italic;
	}

	.link-external,
	.link-file {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		color: var(--color-brand-medium);
		text-decoration: none;
	}

	.link-external:hover,
	.link-file:hover {
		color: var(--color-brand-dark);
		text-decoration: underline;
	}

	/* Gewerke Grid */
	.gewerke-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.75rem;
	}

	.gewerk-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.5rem;
		background: white;
		border: 1px solid var(--color-gray-200);
	}

	.gewerk-label {
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--color-gray-500);
	}

	.gewerk-value {
		font-size: 0.8rem;
		color: var(--color-gray-800);
	}

	/* Kalkulation */
	.calc-grid {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.calc-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.25rem 0;
	}

	.calc-row.total {
		font-weight: 600;
		padding-top: 0.5rem;
	}

	.calc-label {
		font-size: 0.85rem;
		color: var(--color-gray-600);
	}

	.calc-value {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--color-gray-800);
	}

	.calc-value.negative {
		color: var(--color-error);
	}

	.calc-value.low-marge {
		color: var(--color-warning-dark);
	}

	.calc-divider {
		height: 1px;
		background: var(--color-gray-300);
		margin: 0.25rem 0;
	}

	/* Info Box */
	.info-box {
		display: flex;
		gap: 0.75rem;
		padding: 0.75rem;
		background: var(--color-info-light);
		border: 1px solid var(--color-info);
	}

	.info-box svg {
		flex-shrink: 0;
		color: var(--color-info);
	}

	.marge-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
	}

	.marge-item {
		font-size: 0.8rem;
		color: var(--color-gray-700);
	}

	.actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		padding-top: 1rem;
		border-top: 1px solid var(--color-gray-200);
	}

	@media (max-width: 768px) {
		.section-grid {
			grid-template-columns: 1fr;
		}

		.field-grid {
			grid-template-columns: 1fr;
		}

		.gewerke-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.timeline {
			flex-direction: column;
			gap: 0.5rem;
		}

		.timeline-connector {
			width: 2px;
			height: 20px;
			margin: 0;
		}
	}
</style>
