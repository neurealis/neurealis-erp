<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	interface BVData {
		angebot_status?: string;
		angebot_deadline?: string;
		angebot_nr?: string;
		angebot_gesendet_datum?: string;
		angebot_datei_url?: string;
		angebot_link?: string;
		umsatz_netto?: number;
		umsatz_brutto?: number;
	}

	interface Props {
		bv: BVData;
		onEdit?: () => void;
		onSend?: () => void;
	}

	let { bv, onEdit, onSend }: Props = $props();

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

	function getStatusVariant(status?: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
		switch (status?.toLowerCase()) {
			case 'erstellt':
			case '(1) erstellt':
				return 'info';
			case 'gesendet':
				return 'success';
			case 'abgelehnt':
				return 'error';
			case 'offen':
			default:
				return 'default';
		}
	}
</script>

<div class="phase-container">
	<div class="phase-header">
		<h3>(1) Angebot</h3>
		<Badge variant={getStatusVariant(bv.angebot_status)}>
			{bv.angebot_status || 'Offen'}
		</Badge>
	</div>

	<div class="section-grid">
		<!-- Angebotsdaten -->
		<div class="section">
			<h4>Angebotsdaten</h4>
			<div class="field-grid">
				<div class="field">
					<label>Deadline | Angebot</label>
					<span class="value" class:overdue={bv.angebot_deadline && new Date(bv.angebot_deadline) < new Date()}>
						{formatDate(bv.angebot_deadline)}
					</span>
				</div>
				<div class="field">
					<label>Angebots-Nr.</label>
					<span class="value mono">{bv.angebot_nr || '-'}</span>
				</div>
				<div class="field">
					<label>Angebot gesendet | Datum</label>
					<span class="value">{formatDate(bv.angebot_gesendet_datum)}</span>
				</div>
			</div>
		</div>

		<!-- Dokumente -->
		<div class="section">
			<h4>Dokumente</h4>
			<div class="field-grid">
				<div class="field">
					<label>Datei</label>
					{#if bv.angebot_datei_url}
						<a href={bv.angebot_datei_url} target="_blank" class="link-file">
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
					<label>Link</label>
					{#if bv.angebot_link}
						<a href={bv.angebot_link} target="_blank" class="link-external">
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
			</div>
		</div>

		<!-- Finanzen -->
		<div class="section full-width">
			<h4>Finanzen</h4>
			<div class="finance-grid">
				<div class="finance-card">
					<span class="finance-label">Umsatz (netto)</span>
					<span class="finance-value">{formatCurrency(bv.umsatz_netto)}</span>
				</div>
				<div class="finance-card">
					<span class="finance-label">Umsatz (brutto)</span>
					<span class="finance-value">{formatCurrency(bv.umsatz_brutto)}</span>
				</div>
				<div class="finance-card mwst">
					<span class="finance-label">MwSt. (19%)</span>
					<span class="finance-value">
						{bv.umsatz_netto && bv.umsatz_brutto
							? formatCurrency(bv.umsatz_brutto - bv.umsatz_netto)
							: '-'}
					</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Aktionen -->
	<div class="actions">
		<Button variant="secondary" size="sm" onclick={onEdit}>
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
				<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
			</svg>
			Bearbeiten
		</Button>
		<Button variant="primary" size="sm" onclick={onSend}>
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="22" y1="2" x2="11" y2="13"/>
				<polygon points="22 2 15 22 11 13 2 9 22 2"/>
			</svg>
			Angebot senden
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
	}

	.value.mono {
		font-family: var(--font-family-mono);
	}

	.value.overdue {
		color: var(--color-error);
		font-weight: 600;
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

	.finance-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
	}

	.finance-card {
		background: white;
		padding: 1rem;
		border: 1px solid var(--color-gray-200);
		text-align: center;
	}

	.finance-card.mwst {
		background: var(--color-gray-100);
	}

	.finance-label {
		display: block;
		font-size: 0.75rem;
		color: var(--color-gray-500);
		margin-bottom: 0.25rem;
	}

	.finance-value {
		display: block;
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--color-gray-800);
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

		.finance-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
