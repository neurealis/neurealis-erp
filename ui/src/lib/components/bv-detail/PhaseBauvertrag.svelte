<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	interface BVData {
		bauvertrag_status?: string;
		bauvertrag_verschickt_am?: string;
		bauvertrag_unterzeichnet_am?: string;
		bauvertrag_datei_url?: string;
		bauvertrag_link?: string;
	}

	interface Props {
		bv: BVData;
		onSend?: () => void;
	}

	let { bv, onSend }: Props = $props();

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
		const s = status?.toLowerCase() || '';
		if (s.includes('unterzeichnet') || s.includes('abgeschlossen')) return 'success';
		if (s.includes('verschickt') || s.includes('gesendet')) return 'info';
		if (s.includes('lade') || s.includes('pending')) return 'warning';
		return 'default';
	}

	// Status-Logik
	let isCompleted = $derived(!!bv.bauvertrag_unterzeichnet_am);
	let isSent = $derived(!!bv.bauvertrag_verschickt_am);
</script>

<div class="phase-container">
	<div class="phase-header">
		<h3>(2.3) Bauvertrag</h3>
		<Badge variant={getStatusVariant(bv.bauvertrag_status)}>
			{bv.bauvertrag_status || 'Offen'}
		</Badge>
	</div>

	<div class="content-wrapper">
		<!-- Status-Übersicht -->
		<div class="status-overview">
			<div class="status-step" class:completed={isSent} class:active={!isSent}>
				<div class="step-icon">
					{#if isSent}
						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<polyline points="20 6 9 17 4 12"/>
						</svg>
					{:else}
						<span>1</span>
					{/if}
				</div>
				<div class="step-content">
					<span class="step-label">Verschickt</span>
					<span class="step-date">{formatDate(bv.bauvertrag_verschickt_am)}</span>
				</div>
			</div>

			<div class="step-connector" class:completed={isSent}></div>

			<div class="status-step" class:completed={isCompleted} class:active={isSent && !isCompleted}>
				<div class="step-icon">
					{#if isCompleted}
						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<polyline points="20 6 9 17 4 12"/>
						</svg>
					{:else}
						<span>2</span>
					{/if}
				</div>
				<div class="step-content">
					<span class="step-label">Unterzeichnet</span>
					<span class="step-date">{formatDate(bv.bauvertrag_unterzeichnet_am)}</span>
				</div>
			</div>
		</div>

		<!-- Dokument-Details -->
		<div class="section">
			<h4>Dokument</h4>
			<div class="document-grid">
				<div class="field">
					<label>Datei</label>
					{#if bv.bauvertrag_datei_url}
						<a href={bv.bauvertrag_datei_url} target="_blank" class="link-file large">
							<div class="file-icon">
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
									<polyline points="14 2 14 8 20 8"/>
								</svg>
							</div>
							<div class="file-info">
								<span class="file-name">Bauvertrag.pdf</span>
								<span class="file-action">Oeffnen</span>
							</div>
						</a>
					{:else}
						<div class="placeholder-file">
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
								<polyline points="14 2 14 8 20 8"/>
								<line x1="9" y1="15" x2="15" y2="15"/>
							</svg>
							<span>Keine Datei hochgeladen</span>
						</div>
					{/if}
				</div>

				<div class="field">
					<label>Link</label>
					{#if bv.bauvertrag_link}
						<a href={bv.bauvertrag_link} target="_blank" class="link-external">
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
								<polyline points="15 3 21 3 21 9"/>
								<line x1="10" y1="14" x2="21" y2="3"/>
							</svg>
							In SharePoint öffnen
						</a>
					{:else}
						<span class="text-muted">Kein Link vorhanden</span>
					{/if}
				</div>
			</div>
		</div>

		<!-- Info-Hinweis wenn abgeschlossen -->
		{#if isCompleted}
			<div class="success-banner">
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
					<polyline points="22 4 12 14.01 9 11.01"/>
				</svg>
				<div>
					<strong>Bauvertrag abgeschlossen</strong>
					<p>Der Bauvertrag wurde am {formatDate(bv.bauvertrag_unterzeichnet_am)} unterzeichnet.</p>
				</div>
			</div>
		{/if}
	</div>

	<!-- Aktionen -->
	<div class="actions">
		{#if !isSent}
			<Button variant="primary" size="sm" onclick={onSend}>
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="22" y1="2" x2="11" y2="13"/>
					<polygon points="22 2 15 22 11 13 2 9 22 2"/>
				</svg>
				Bauvertrag senden
			</Button>
		{:else if !isCompleted}
			<Button variant="secondary" size="sm">
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10"/>
					<polyline points="12 6 12 12 16 14"/>
				</svg>
				Warte auf Unterschrift...
			</Button>
			<Button variant="primary" size="sm">
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
					<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
				</svg>
				Als unterzeichnet markieren
			</Button>
		{:else}
			<Button variant="secondary" size="sm">
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="20 6 9 17 4 12"/>
				</svg>
				Abgeschlossen
			</Button>
		{/if}
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

	.content-wrapper {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	/* Status Overview */
	.status-overview {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		background: var(--color-gray-50);
		border: 1px solid var(--color-gray-200);
	}

	.status-step {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.step-icon {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px solid var(--color-gray-300);
		background: white;
		color: var(--color-gray-400);
		font-weight: 600;
		font-size: 0.9rem;
	}

	.status-step.active .step-icon {
		border-color: var(--color-brand-medium);
		color: var(--color-brand-medium);
	}

	.status-step.completed .step-icon {
		border-color: var(--color-success);
		background: var(--color-success);
		color: white;
	}

	.step-content {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.step-label {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-gray-700);
	}

	.step-date {
		font-size: 0.8rem;
		color: var(--color-gray-500);
	}

	.step-connector {
		width: 80px;
		height: 2px;
		background: var(--color-gray-300);
		margin: 0 1rem;
	}

	.step-connector.completed {
		background: var(--color-success);
	}

	/* Section */
	.section {
		background: var(--color-gray-50);
		padding: 1rem;
		border: 1px solid var(--color-gray-200);
	}

	.section h4 {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-gray-600);
		margin-bottom: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.document-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.field label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-gray-500);
	}

	/* File Link */
	.link-file.large {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: white;
		border: 1px solid var(--color-gray-200);
		text-decoration: none;
		transition: all 0.15s ease;
	}

	.link-file.large:hover {
		border-color: var(--color-brand-medium);
		background: var(--color-brand-bg);
	}

	.file-icon {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-brand-bg);
		color: var(--color-brand-medium);
	}

	.file-info {
		display: flex;
		flex-direction: column;
	}

	.file-name {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--color-gray-800);
	}

	.file-action {
		font-size: 0.75rem;
		color: var(--color-brand-medium);
	}

	/* Placeholder File */
	.placeholder-file {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: var(--color-gray-100);
		border: 1px dashed var(--color-gray-300);
		color: var(--color-gray-400);
	}

	.placeholder-file span {
		font-size: 0.85rem;
	}

	/* External Link */
	.link-external {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		color: var(--color-brand-medium);
		text-decoration: none;
	}

	.link-external:hover {
		color: var(--color-brand-dark);
		text-decoration: underline;
	}

	.text-muted {
		font-size: 0.85rem;
		color: var(--color-gray-400);
		font-style: italic;
	}

	/* Success Banner */
	.success-banner {
		display: flex;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--color-success-light);
		border: 1px solid var(--color-success);
	}

	.success-banner svg {
		flex-shrink: 0;
		color: var(--color-success-dark);
	}

	.success-banner strong {
		display: block;
		font-size: 0.9rem;
		color: var(--color-success-dark);
		margin-bottom: 0.25rem;
	}

	.success-banner p {
		font-size: 0.85rem;
		color: var(--color-gray-700);
		margin: 0;
	}

	/* Actions */
	.actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		padding-top: 1rem;
		border-top: 1px solid var(--color-gray-200);
	}

	@media (max-width: 768px) {
		.status-overview {
			flex-direction: column;
			gap: 0.5rem;
		}

		.step-connector {
			width: 2px;
			height: 30px;
			margin: 0;
		}

		.document-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
