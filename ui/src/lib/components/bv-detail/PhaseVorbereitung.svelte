<script lang="ts">
	import { Card, Badge, Button } from '$lib/components/ui';

	interface Props {
		columnValues: Record<string, unknown>;
		projektNr: string | null;
	}

	let { columnValues, projektNr }: Props = $props();

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

	// Wichtige Gewerke aus column_values extrahieren
	// Monday Feld-IDs muessen angepasst werden
	let asbestAusfuehrung = $derived(extractField('status_mkkc67qe') || 'Ohne');
	let gasthermeAusfuehrung = $derived(extractField('status_mkkc88vq') || 'Ohne Therme');
	let elektrikZaehler = $derived(extractField('status_mkkc8s4e') || 'Offen');
	let elektrikAusfuehrung = $derived(extractField('status_mkkc8123') || 'Komplett');
	let notizen = $derived(extractField('long_text_mkkd1234') || '');

	// Schluessel-Status
	let schluesselDeadline = $derived(extractDate('date_mkkd5678'));
	let schluesselStatus = $derived(extractField('status_mkkd9012') || 'Offen');

	// Formatierung
	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
	}

	function getStatusVariant(status: string): 'success' | 'warning' | 'error' | 'default' {
		switch (status.toLowerCase()) {
			case 'erhalten':
			case 'erledigt':
			case 'komplett': return 'success';
			case 'offen':
			case 'teilweise': return 'warning';
			case 'ohne':
			case 'ohne therme': return 'default';
			default: return 'default';
		}
	}
</script>

<div class="phase-vorbereitung">
	<!-- Ausfuehrung wichtiger Gewerke -->
	<Card>
		{#snippet header()}
			<div class="section-header">
				<h3>Ausfuehrung wichtiger Gewerke</h3>
			</div>
		{/snippet}

		<div class="gewerke-grid">
			<div class="gewerk-item">
				<span class="gewerk-label">Asbest</span>
				<Badge variant={getStatusVariant(asbestAusfuehrung)} size="sm">
					{asbestAusfuehrung}
				</Badge>
			</div>

			<div class="gewerk-item">
				<span class="gewerk-label">Gastherme</span>
				<Badge variant={getStatusVariant(gasthermeAusfuehrung)} size="sm">
					{gasthermeAusfuehrung}
				</Badge>
			</div>

			<div class="gewerk-item">
				<span class="gewerk-label">Elektrik Zaehler</span>
				<Badge variant={getStatusVariant(elektrikZaehler)} size="sm">
					{elektrikZaehler}
				</Badge>
			</div>

			<div class="gewerk-item">
				<span class="gewerk-label">Elektrik</span>
				<Badge variant={getStatusVariant(elektrikAusfuehrung)} size="sm">
					{elektrikAusfuehrung}
				</Badge>
			</div>
		</div>

		{#if notizen}
			<div class="notizen-section">
				<span class="notizen-label">Notizen:</span>
				<p class="notizen-text">{notizen}</p>
			</div>
		{/if}

		<div class="section-actions">
			<Button variant="primary" size="sm">Ausfuehrung festlegen</Button>
		</div>
	</Card>

	<!-- Schluessel-Status -->
	<Card>
		{#snippet header()}
			<div class="section-header">
				<h3>Schluessel-Status</h3>
				<Badge variant={getStatusVariant(schluesselStatus)}>
					{schluesselStatus}
				</Badge>
			</div>
		{/snippet}

		<div class="schluessel-info">
			<div class="info-row">
				<span class="info-label">Deadline Schluessel</span>
				<span class="info-value">{formatDate(schluesselDeadline)}</span>
			</div>

			<div class="info-row">
				<span class="info-label">Status</span>
				<Badge variant={getStatusVariant(schluesselStatus)} size="sm">
					{schluesselStatus}
				</Badge>
			</div>
		</div>

		<div class="section-actions">
			<Button variant="primary" size="sm">Status aktualisieren</Button>
		</div>
	</Card>
</div>

<style>
	.phase-vorbereitung {
		display: flex;
		flex-direction: column;
		gap: 1rem;
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

	.gewerke-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}

	@media (max-width: 640px) {
		.gewerke-grid {
			grid-template-columns: 1fr;
		}
	}

	.gewerk-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem;
		background: var(--color-gray-50);
		border: 1px solid var(--color-gray-200);
	}

	.gewerk-label {
		font-size: 0.9rem;
		color: var(--color-gray-700);
	}

	.notizen-section {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-gray-200);
	}

	.notizen-label {
		font-size: 0.8rem;
		color: var(--color-gray-500);
		display: block;
		margin-bottom: 0.25rem;
	}

	.notizen-text {
		margin: 0;
		font-size: 0.9rem;
		color: var(--color-gray-700);
	}

	.schluessel-info {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.info-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--color-gray-100);
	}

	.info-row:last-child {
		border-bottom: none;
	}

	.info-label {
		font-size: 0.85rem;
		color: var(--color-gray-500);
	}

	.info-value {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--color-gray-800);
	}

	.section-actions {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-gray-200);
	}
</style>
