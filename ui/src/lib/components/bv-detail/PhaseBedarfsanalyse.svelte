<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	interface BVData {
		bedarfsanalyse_datum?: string;
		besprechung_angebot_datum?: string;
		bv_start_geschaetzt?: string;
		bv_ende_geschaetzt?: string;
		matterport_vorher_link?: string;
		titelfoto_url?: string;
		fotos?: string[];
		grundflaeche?: number;
		badplan_url?: string;
		badplan_datei?: string;
	}

	interface Props {
		bv: BVData;
	}

	let { bv }: Props = $props();

	function formatDate(dateStr?: string): string {
		if (!dateStr) return '-';
		const date = new Date(dateStr);
		return date.toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
	}
</script>

<div class="phase-container">
	<div class="phase-header">
		<h3>(0) Bedarfsanalyse</h3>
		<Badge variant="phase" phase={0}>Phase 0</Badge>
	</div>

	<div class="section-grid">
		<!-- Termine -->
		<div class="section">
			<h4>Termine</h4>
			<div class="field-grid">
				<div class="field">
					<label>Bedarfsanalyse | Datum</label>
					<span class="value">{formatDate(bv.bedarfsanalyse_datum)}</span>
				</div>
				<div class="field">
					<label>Besprechung Angebot Kunde | Datum</label>
					<span class="value">{formatDate(bv.besprechung_angebot_datum)}</span>
				</div>
				<div class="field">
					<label>BV Start (geschaetzt)</label>
					<span class="value">{formatDate(bv.bv_start_geschaetzt)}</span>
				</div>
				<div class="field">
					<label>BV Ende (geschaetzt)</label>
					<span class="value">{formatDate(bv.bv_ende_geschaetzt)}</span>
				</div>
			</div>
		</div>

		<!-- Matterport -->
		<div class="section">
			<h4>3D-Scan</h4>
			<div class="field">
				<label>Matterport vorher</label>
				{#if bv.matterport_vorher_link}
					<a href={bv.matterport_vorher_link} target="_blank" class="link-external">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
							<polyline points="15 3 21 3 21 9"/>
							<line x1="10" y1="14" x2="21" y2="3"/>
						</svg>
						3D-Rundgang öffnen
					</a>
				{:else}
					<span class="value text-muted">Kein Link vorhanden</span>
				{/if}
			</div>
		</div>

		<!-- Fotos -->
		<div class="section full-width">
			<h4>Dokumentation</h4>
			<div class="docs-grid">
				<div class="field">
					<label>Titelfoto BV</label>
					{#if bv.titelfoto_url}
						<div class="image-preview">
							<img src={bv.titelfoto_url} alt="Titelfoto" />
						</div>
					{:else}
						<div class="placeholder-image">
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
								<circle cx="8.5" cy="8.5" r="1.5"/>
								<polyline points="21 15 16 10 5 21"/>
							</svg>
							<span>Kein Titelfoto</span>
						</div>
					{/if}
				</div>

				<div class="field">
					<label>Bedarfsanalyse | Fotos</label>
					{#if bv.fotos && bv.fotos.length > 0}
						<div class="photo-gallery">
							{#each bv.fotos.slice(0, 4) as foto}
								<div class="gallery-item">
									<img src={foto} alt="Foto" />
								</div>
							{/each}
							{#if bv.fotos.length > 4}
								<div class="gallery-more">
									+{bv.fotos.length - 4} weitere
								</div>
							{/if}
						</div>
					{:else}
						<span class="value text-muted">Keine Fotos vorhanden</span>
					{/if}
				</div>
			</div>
		</div>

		<!-- Technische Daten -->
		<div class="section">
			<h4>Technische Daten</h4>
			<div class="field-grid">
				<div class="field">
					<label>Grundfläche (m2)</label>
					<span class="value highlight">
						{bv.grundflaeche ? `${bv.grundflaeche} m2` : '-'}
					</span>
				</div>
				<div class="field">
					<label>Badplan</label>
					{#if bv.badplan_url || bv.badplan_datei}
						<a href={bv.badplan_url || bv.badplan_datei} target="_blank" class="link-file">
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
								<polyline points="14 2 14 8 20 8"/>
							</svg>
							Badplan öffnen
						</a>
					{:else}
						<span class="value text-muted">Nicht vorhanden</span>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Aktionen -->
	<div class="actions">
		<Button variant="secondary" size="sm">
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
				<polyline points="17 8 12 3 7 8"/>
				<line x1="12" y1="3" x2="12" y2="15"/>
			</svg>
			Fotos hochladen
		</Button>
		<Button variant="primary" size="sm">
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
				<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
			</svg>
			Bearbeiten
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

	.docs-grid {
		display: grid;
		grid-template-columns: 200px 1fr;
		gap: 1.5rem;
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

	.value.highlight {
		font-weight: 600;
		color: var(--color-brand-medium);
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

	.image-preview {
		width: 180px;
		height: 120px;
		border: 1px solid var(--color-gray-200);
		overflow: hidden;
	}

	.image-preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.placeholder-image {
		width: 180px;
		height: 120px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		background: var(--color-gray-100);
		border: 1px dashed var(--color-gray-300);
		color: var(--color-gray-400);
		font-size: 0.8rem;
	}

	.photo-gallery {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.gallery-item {
		width: 80px;
		height: 60px;
		border: 1px solid var(--color-gray-200);
		overflow: hidden;
	}

	.gallery-item img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.gallery-more {
		width: 80px;
		height: 60px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-gray-200);
		color: var(--color-gray-600);
		font-size: 0.75rem;
		font-weight: 500;
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

		.docs-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
