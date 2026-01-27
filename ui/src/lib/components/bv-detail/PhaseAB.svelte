<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	interface BVData {
		ab_status?: string;
		bv_start_kunde?: string;
		bv_ende_kunde?: string;
		auftrag_kunde_nr?: string;
		auftrag_kunde_datum?: string;
		auftrag_kunde_datei_url?: string;
		auftrag_kunde_link?: string;
		auftrag_kunde_infos?: string;
		ab_nr?: string;
		ab_datum?: string;
		ab_datei_url?: string;
		ab_link?: string;
		ab_verschickt_am?: string;
	}

	interface Props {
		bv: BVData;
		onUploadAuftrag?: () => void;
		onSendAB?: () => void;
	}

	let { bv, onUploadAuftrag, onSendAB }: Props = $props();

	function formatDate(dateStr?: string): string {
		if (!dateStr) return '-';
		const date = new Date(dateStr);
		return date.toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
	}

	function getStatusVariant(status?: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
		switch (status?.toLowerCase()) {
			case 'offen':
			case '(0) offen':
				return 'default';
			case 'erstellt':
				return 'info';
			case 'verschickt':
			case 'gesendet':
				return 'success';
			case 'bestaetigt':
				return 'success';
			default:
				return 'default';
		}
	}
</script>

<div class="phase-container">
	<div class="phase-header">
		<h3>(2.1) Auftragsbestaetigung</h3>
		<Badge variant={getStatusVariant(bv.ab_status)}>
			{bv.ab_status || '(0) Offen'}
		</Badge>
	</div>

	<div class="section-grid">
		<!-- BV Zeitraum -->
		<div class="section">
			<h4>Bauvorhaben-Zeitraum Kunde</h4>
			<div class="field-grid">
				<div class="field">
					<label>BV Start Kunde</label>
					<span class="value">{formatDate(bv.bv_start_kunde)}</span>
				</div>
				<div class="field">
					<label>BV Ende Kunde</label>
					<span class="value">{formatDate(bv.bv_ende_kunde)}</span>
				</div>
			</div>
		</div>

		<!-- Auftrag Kunde -->
		<div class="section">
			<h4>Auftrag Kunde</h4>
			<div class="field-grid">
				<div class="field">
					<label>Auftrags-Nr.</label>
					<span class="value mono">{bv.auftrag_kunde_nr || '-'}</span>
				</div>
				<div class="field">
					<label>Datum</label>
					<span class="value">{formatDate(bv.auftrag_kunde_datum)}</span>
				</div>
				<div class="field">
					<label>Datei</label>
					{#if bv.auftrag_kunde_datei_url}
						<a href={bv.auftrag_kunde_datei_url} target="_blank" class="link-file">
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
								<polyline points="14 2 14 8 20 8"/>
							</svg>
							PDF oeffnen
						</a>
					{:else}
						<span class="value text-muted">Keine Datei</span>
					{/if}
				</div>
				<div class="field">
					<label>Link</label>
					{#if bv.auftrag_kunde_link}
						<a href={bv.auftrag_kunde_link} target="_blank" class="link-external">
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
			{#if bv.auftrag_kunde_infos}
				<div class="infos-box">
					<label>Infos</label>
					<p>{bv.auftrag_kunde_infos}</p>
				</div>
			{/if}
		</div>

		<!-- Auftragsbestaetigung -->
		<div class="section full-width">
			<h4>Auftragsbestaetigung (AB)</h4>
			<div class="ab-grid">
				<div class="field">
					<label>AB-Nr.</label>
					<span class="value mono highlight">{bv.ab_nr || '-'}</span>
				</div>
				<div class="field">
					<label>Datum</label>
					<span class="value">{formatDate(bv.ab_datum)}</span>
				</div>
				<div class="field">
					<label>Datei</label>
					{#if bv.ab_datei_url}
						<a href={bv.ab_datei_url} target="_blank" class="link-file">
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
								<polyline points="14 2 14 8 20 8"/>
							</svg>
							PDF oeffnen
						</a>
					{:else}
						<span class="value text-muted">Keine Datei</span>
					{/if}
				</div>
				<div class="field">
					<label>Link</label>
					{#if bv.ab_link}
						<a href={bv.ab_link} target="_blank" class="link-external">
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
					<label>AB verschickt am</label>
					<span class="value" class:success={bv.ab_verschickt_am}>
						{formatDate(bv.ab_verschickt_am)}
						{#if bv.ab_verschickt_am}
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="check-icon">
								<polyline points="20 6 9 17 4 12"/>
							</svg>
						{/if}
					</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Aktionen -->
	<div class="actions">
		<Button variant="secondary" size="sm" onclick={onUploadAuftrag}>
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
				<polyline points="17 8 12 3 7 8"/>
				<line x1="12" y1="3" x2="12" y2="15"/>
			</svg>
			Auftrag hochladen
		</Button>
		<Button variant="primary" size="sm" onclick={onSendAB}>
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="22" y1="2" x2="11" y2="13"/>
				<polygon points="22 2 15 22 11 13 2 9 22 2"/>
			</svg>
			AB senden
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

	.ab-grid {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
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

	.infos-box {
		margin-top: 1rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--color-gray-200);
	}

	.infos-box label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-gray-500);
		display: block;
		margin-bottom: 0.25rem;
	}

	.infos-box p {
		font-size: 0.85rem;
		color: var(--color-gray-700);
		margin: 0;
		line-height: 1.4;
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

		.ab-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
