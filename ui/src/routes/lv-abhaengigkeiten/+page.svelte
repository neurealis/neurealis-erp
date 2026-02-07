<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';

	// Typen
	interface Dependency {
		id: string;
		lv_typ: string;
		dependency_type: string;
		confidence: number | null;
		grund: string | null;
		source_artikelnummer: string;
		target_artikelnummer: string;
		source_bezeichnung: string | null;
		source_gewerk: string | null;
		target_bezeichnung: string | null;
		target_gewerk: string | null;
	}

	interface LvTypGroup {
		lv_typ: string;
		label: string;
		dependencies: Dependency[];
		gewerke: Map<string, Dependency[]>;
	}

	// State
	let loading = $state(true);
	let error = $state<string | null>(null);
	let dependencies = $state<Dependency[]>([]);
	let searchQuery = $state('');
	let filterLvTyp = $state<string>('alle');
	let filterDepType = $state<string>('alle');
	let expandedGewerke = $state<Set<string>>(new Set());

	// Labels
	const LV_LABELS: Record<string, string> = {
		'GWS': 'GWS (Auftraggeber)',
		'neurealis': 'neurealis (eigene Positionen)',
		'VBW': 'VBW (Verband Baden-Württemberg)',
	};

	const TYPE_LABELS: Record<string, string> = {
		'required': 'Erforderlich',
		'often_together': 'Oft zusammen',
		'referenced_in_text': 'Im Text referenziert',
		'suggested': 'Vorgeschlagen',
	};

	const TYPE_DESCRIPTIONS: Record<string, string> = {
		'required': 'Position A erfordert zwingend Position B',
		'often_together': 'Positionen werden häufig gemeinsam beauftragt',
		'referenced_in_text': 'Position A verweist im Langtext auf Position B',
		'suggested': 'Position B wird als Ergänzung vorgeschlagen',
	};

	// Daten laden
	async function loadDependencies() {
		loading = true;
		error = null;

		try {
			// Lade position_dependencies mit JOIN auf lv_positionen für Bezeichnung und Gewerk
			const { data: deps, error: dbError } = await supabase
				.rpc('get_lv_dependencies_with_details');

			if (dbError) {
				// Fallback: Manueller Query ohne RPC
				const { data: rawDeps, error: rawError } = await supabase
					.from('position_dependencies')
					.select('id, lv_typ, dependency_type, confidence, grund, source_artikelnummer, target_artikelnummer, is_active')
					.eq('is_active', true)
					.order('lv_typ')
					.order('source_artikelnummer');

				if (rawError) throw rawError;

				// LV-Positionen separat laden für Bezeichnungen
				const artNummern = new Set<string>();
				for (const dep of rawDeps || []) {
					if (dep.source_artikelnummer) artNummern.add(dep.source_artikelnummer);
					if (dep.target_artikelnummer) artNummern.add(dep.target_artikelnummer);
				}

				const { data: lvPositionen, error: lvError } = await supabase
					.from('lv_positionen')
					.select('artikelnummer, bezeichnung, gewerk')
					.in('artikelnummer', [...artNummern]);

				if (lvError) throw lvError;

				// Lookup-Map erstellen
				const lvMap = new Map<string, { bezeichnung: string; gewerk: string }>();
				for (const lv of lvPositionen || []) {
					lvMap.set(lv.artikelnummer, { bezeichnung: lv.bezeichnung, gewerk: lv.gewerk });
				}

				// Zusammenführen
				dependencies = (rawDeps || []).map(dep => ({
					id: dep.id,
					lv_typ: dep.lv_typ,
					dependency_type: dep.dependency_type,
					confidence: dep.confidence,
					grund: dep.grund,
					source_artikelnummer: dep.source_artikelnummer,
					target_artikelnummer: dep.target_artikelnummer,
					source_bezeichnung: lvMap.get(dep.source_artikelnummer)?.bezeichnung || null,
					source_gewerk: lvMap.get(dep.source_artikelnummer)?.gewerk || null,
					target_bezeichnung: lvMap.get(dep.target_artikelnummer)?.bezeichnung || null,
					target_gewerk: lvMap.get(dep.target_artikelnummer)?.gewerk || null,
				}));
			} else {
				dependencies = deps || [];
			}

			// Alle Gewerke initial aufklappen
			const gewerkeSet = new Set<string>();
			for (const dep of dependencies) {
				const key = `${dep.lv_typ}::${dep.source_gewerk || 'Ohne Gewerk'}`;
				gewerkeSet.add(key);
			}
			expandedGewerke = gewerkeSet;

		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'Fehler beim Laden der Abhängigkeiten';
			console.error('Fehler:', err);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadDependencies();
	});

	// Gefilterte Daten
	let filtered = $derived.by(() => {
		const query = searchQuery.toLowerCase().trim();
		return dependencies.filter(dep => {
			// LV-Typ Filter
			if (filterLvTyp !== 'alle' && dep.lv_typ !== filterLvTyp) return false;
			// Abhängigkeitstyp Filter
			if (filterDepType !== 'alle' && dep.dependency_type !== filterDepType) return false;
			// Suchbegriff
			if (query) {
				const searchFields = [
					dep.source_artikelnummer,
					dep.source_bezeichnung,
					dep.target_artikelnummer,
					dep.target_bezeichnung,
					dep.source_gewerk,
					dep.target_gewerk,
					dep.grund,
				].filter(Boolean).map(s => s!.toLowerCase());
				if (!searchFields.some(f => f.includes(query))) return false;
			}
			return true;
		});
	});

	// Gruppierte Daten nach LV-Typ und Gewerk
	let grouped = $derived.by(() => {
		const lvOrder = ['GWS', 'neurealis', 'VBW'];
		const byLvTyp = new Map<string, Dependency[]>();

		for (const dep of filtered) {
			const existing = byLvTyp.get(dep.lv_typ) || [];
			existing.push(dep);
			byLvTyp.set(dep.lv_typ, existing);
		}

		const result: LvTypGroup[] = [];

		// Sortierte Reihenfolge
		for (const lvTyp of lvOrder) {
			const deps = byLvTyp.get(lvTyp);
			if (!deps || deps.length === 0) continue;

			// Nach Gewerk gruppieren
			const gewerke = new Map<string, Dependency[]>();
			for (const dep of deps) {
				const gewerk = dep.source_gewerk || 'Ohne Gewerk-Zuordnung';
				const existing = gewerke.get(gewerk) || [];
				existing.push(dep);
				gewerke.set(gewerk, existing);
			}

			result.push({
				lv_typ: lvTyp,
				label: LV_LABELS[lvTyp] || lvTyp,
				dependencies: deps,
				gewerke: new Map([...gewerke.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
			});
		}

		// Restliche LV-Typen
		for (const [lvTyp, deps] of byLvTyp.entries()) {
			if (lvOrder.includes(lvTyp)) continue;
			const gewerke = new Map<string, Dependency[]>();
			for (const dep of deps) {
				const gewerk = dep.source_gewerk || 'Ohne Gewerk-Zuordnung';
				const existing = gewerke.get(gewerk) || [];
				existing.push(dep);
				gewerke.set(gewerk, existing);
			}
			result.push({
				lv_typ: lvTyp,
				label: LV_LABELS[lvTyp] || lvTyp,
				dependencies: deps,
				gewerke: new Map([...gewerke.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
			});
		}

		return result;
	});

	// Statistiken
	let stats = $derived.by(() => {
		const total = filtered.length;
		const byType: Record<string, number> = {};
		const byLvTyp: Record<string, number> = {};
		for (const dep of filtered) {
			byType[dep.dependency_type] = (byType[dep.dependency_type] || 0) + 1;
			byLvTyp[dep.lv_typ] = (byLvTyp[dep.lv_typ] || 0) + 1;
		}
		return { total, byType, byLvTyp };
	});

	// Distinct LV-Typen und Dependency-Typen
	let lvTypen = $derived([...new Set(dependencies.map(d => d.lv_typ))].sort());
	let depTypes = $derived([...new Set(dependencies.map(d => d.dependency_type))].sort());

	// Gewerk toggle
	function toggleGewerk(key: string) {
		if (expandedGewerke.has(key)) {
			expandedGewerke.delete(key);
		} else {
			expandedGewerke.add(key);
		}
		expandedGewerke = new Set(expandedGewerke);
	}

	function isGewerkExpanded(key: string): boolean {
		return expandedGewerke.has(key);
	}

	function expandAll() {
		const all = new Set<string>();
		for (const group of grouped) {
			for (const [gewerk] of group.gewerke) {
				all.add(`${group.lv_typ}::${gewerk}`);
			}
		}
		expandedGewerke = all;
	}

	function collapseAll() {
		expandedGewerke = new Set();
	}

	// Confidence formatieren
	function formatConfidence(conf: number | null): string {
		if (conf === null || conf === undefined) return '-';
		return `${Math.round(conf * 100)}%`;
	}
</script>

<svelte:head>
	<title>LV-Abhängigkeiten - neurealis ERP</title>
</svelte:head>

<div class="page">
	<!-- Header -->
	<div class="page-header">
		<div class="header-top">
			<div>
				<h1 class="page-title">LV-Abhängigkeiten</h1>
				<p class="page-description">Abhängigkeiten zwischen Leistungsverzeichnis-Positionen nach LV-Typ und Gewerk</p>
			</div>
			{#if !loading}
				<div class="header-actions">
					<button class="btn btn-ghost btn-sm" onclick={expandAll}>Alle aufklappen</button>
					<button class="btn btn-ghost btn-sm" onclick={collapseAll}>Alle zuklappen</button>
					<button class="btn btn-secondary btn-sm" onclick={loadDependencies}>Aktualisieren</button>
				</div>
			{/if}
		</div>
	</div>

	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Abhängigkeiten werden geladen...</p>
		</div>
	{:else if error}
		<div class="error-state card">
			<div class="card-body">
				<p class="error-text">Fehler: {error}</p>
				<button class="btn btn-primary btn-sm" onclick={loadDependencies}>Erneut versuchen</button>
			</div>
		</div>
	{:else}
		<!-- Statistik-Karten -->
		<div class="stats-row">
			<div class="stat-card">
				<span class="stat-value">{stats.total}</span>
				<span class="stat-label">Abhängigkeiten gesamt</span>
			</div>
			{#each Object.entries(stats.byLvTyp).sort() as [lvTyp, count]}
				<div class="stat-card">
					<span class="stat-value">{count}</span>
					<span class="stat-label">
						<span class="lv-badge lv-badge-{lvTyp.toLowerCase()}">{lvTyp}</span>
					</span>
				</div>
			{/each}
		</div>

		<!-- Legende -->
		<div class="legend card">
			<div class="card-body legend-content">
				<span class="legend-title">Abhängigkeitstypen:</span>
				<div class="legend-items">
					{#each Object.entries(TYPE_LABELS) as [type, label]}
						<span class="legend-item">
							<span class="dep-dot dep-dot-{type}"></span>
							<span class="legend-label">{label}</span>
							<span class="legend-desc"> -- {TYPE_DESCRIPTIONS[type]}</span>
						</span>
					{/each}
				</div>
			</div>
		</div>

		<!-- Filter-Leiste -->
		<div class="filter-bar card">
			<div class="card-body filter-content">
				<div class="filter-group">
					<label for="search">Suche</label>
					<input
						id="search"
						type="text"
						placeholder="Artikelnummer, Bezeichnung, Gewerk..."
						bind:value={searchQuery}
					/>
				</div>
				<div class="filter-group">
					<label for="lv-typ">LV-Typ</label>
					<select id="lv-typ" bind:value={filterLvTyp}>
						<option value="alle">Alle LV-Typen</option>
						{#each lvTypen as typ}
							<option value={typ}>{LV_LABELS[typ] || typ}</option>
						{/each}
					</select>
				</div>
				<div class="filter-group">
					<label for="dep-type">Abhängigkeitstyp</label>
					<select id="dep-type" bind:value={filterDepType}>
						<option value="alle">Alle Typen</option>
						{#each depTypes as typ}
							<option value={typ}>{TYPE_LABELS[typ] || typ}</option>
						{/each}
					</select>
				</div>
				<div class="filter-info">
					<span class="text-sm text-muted">{filtered.length} von {dependencies.length} Abhängigkeiten</span>
				</div>
			</div>
		</div>

		<!-- Gruppierte Tabellen -->
		{#if grouped.length === 0}
			<div class="empty-state">
				<div class="empty-state-icon">--</div>
				<p class="empty-state-title">Keine Abhängigkeiten gefunden</p>
				<p class="empty-state-description">Versuche die Filter anzupassen oder die Suche zu ändern.</p>
			</div>
		{:else}
			{#each grouped as group}
				<div class="lv-section">
					<!-- LV-Typ Header -->
					<div class="lv-header lv-header-{group.lv_typ.toLowerCase()}">
						<h2 class="lv-title">{group.label}</h2>
						<div class="lv-stats">
							{#each Object.entries(TYPE_LABELS) as [type, label]}
								{@const count = group.dependencies.filter(d => d.dependency_type === type).length}
								{#if count > 0}
									<span class="lv-stat">
										<span class="dep-dot dep-dot-{type}"></span>
										{label}: {count}
									</span>
								{/if}
							{/each}
							<span class="lv-stat lv-stat-total">{group.dependencies.length} gesamt</span>
						</div>
					</div>

					<!-- Gewerk-Gruppen -->
					{#each [...group.gewerke.entries()] as [gewerk, deps]}
						{@const gewerkKey = `${group.lv_typ}::${gewerk}`}
						<div class="gewerk-section">
							<button
								class="gewerk-header"
								onclick={() => toggleGewerk(gewerkKey)}
							>
								<svg class="gewerk-chevron" class:rotated={isGewerkExpanded(gewerkKey)} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
								</svg>
								<span class="gewerk-name">{gewerk}</span>
								<span class="gewerk-count">{deps.length} Abhängigkeiten</span>
							</button>

							{#if isGewerkExpanded(gewerkKey)}
								<div class="table-container">
									<table class="table-striped">
										<thead>
											<tr>
												<th>Auslöser (Art.-Nr.)</th>
												<th>Auslöser (Bezeichnung)</th>
												<th>Typ</th>
												<th>Benötigt (Art.-Nr.)</th>
												<th>Benötigt (Bezeichnung)</th>
												<th class="text-center">Konfidenz</th>
												<th>Grund</th>
											</tr>
										</thead>
										<tbody>
											{#each deps as dep}
												<tr>
													<td class="font-mono text-xs">{dep.source_artikelnummer || '-'}</td>
													<td>{dep.source_bezeichnung || '-'}</td>
													<td>
														<span class="dep-badge dep-badge-{dep.dependency_type}">
															{TYPE_LABELS[dep.dependency_type] || dep.dependency_type}
														</span>
													</td>
													<td class="font-mono text-xs">{dep.target_artikelnummer || '-'}</td>
													<td>{dep.target_bezeichnung || '-'}</td>
													<td class="text-center">{formatConfidence(dep.confidence)}</td>
													<td class="text-muted text-sm">{dep.grund || '-'}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/each}
		{/if}
	{/if}
</div>

<style>
	.page {
		padding: var(--spacing-6);
		max-width: 1400px;
	}

	/* Header */
	.header-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--spacing-4);
		flex-wrap: wrap;
	}

	.header-actions {
		display: flex;
		gap: var(--spacing-2);
		flex-shrink: 0;
	}

	/* Loading */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-12);
		color: var(--color-gray-500);
		gap: var(--spacing-4);
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--color-gray-200);
		border-top: 3px solid var(--color-primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	/* Error */
	.error-state {
		margin-bottom: var(--spacing-6);
	}

	.error-text {
		color: var(--color-error);
		margin-bottom: var(--spacing-4);
	}

	/* Statistik-Karten */
	.stats-row {
		display: flex;
		gap: var(--spacing-4);
		margin-bottom: var(--spacing-6);
		flex-wrap: wrap;
	}

	.stat-card {
		background: white;
		border: 1px solid var(--color-gray-200);
		border-radius: var(--radius-lg);
		padding: var(--spacing-4) var(--spacing-5);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		min-width: 120px;
		box-shadow: var(--shadow-sm);
	}

	.stat-value {
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-bold);
		color: var(--color-gray-900);
	}

	.stat-label {
		font-size: var(--font-size-xs);
		color: var(--color-gray-500);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* LV-Typ Badges */
	.lv-badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.lv-badge-gws {
		background: #dbeafe;
		color: #1e40af;
	}

	.lv-badge-neurealis {
		background: var(--color-primary-100);
		color: var(--color-primary-700);
	}

	.lv-badge-vbw {
		background: #d1fae5;
		color: #065f46;
	}

	/* Legende */
	.legend {
		margin-bottom: var(--spacing-4);
	}

	.legend-content {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-4);
		flex-wrap: wrap;
		padding: var(--spacing-3) var(--spacing-5) !important;
	}

	.legend-title {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		color: var(--color-gray-700);
		white-space: nowrap;
		padding-top: 2px;
	}

	.legend-items {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-3) var(--spacing-6);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		font-size: var(--font-size-xs);
	}

	.legend-label {
		font-weight: var(--font-weight-semibold);
		color: var(--color-gray-700);
	}

	.legend-desc {
		color: var(--color-gray-400);
	}

	/* Dependency Dots */
	.dep-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.dep-dot-required {
		background: #dc3545;
	}

	.dep-dot-often_together {
		background: #28a745;
	}

	.dep-dot-referenced_in_text {
		background: #007bff;
	}

	.dep-dot-suggested {
		background: #ffc107;
	}

	/* Dependency Badges */
	.dep-badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		white-space: nowrap;
	}

	.dep-badge-required {
		background: #fee2e2;
		color: #991b1b;
	}

	.dep-badge-often_together {
		background: #d1fae5;
		color: #065f46;
	}

	.dep-badge-referenced_in_text {
		background: #dbeafe;
		color: #1e40af;
	}

	.dep-badge-suggested {
		background: #fef3c7;
		color: #92400e;
	}

	/* Filter-Leiste */
	.filter-bar {
		margin-bottom: var(--spacing-6);
	}

	.filter-content {
		display: flex;
		gap: var(--spacing-4);
		align-items: flex-end;
		flex-wrap: wrap;
		padding: var(--spacing-4) var(--spacing-5) !important;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		min-width: 180px;
		flex: 1;
	}

	.filter-group:first-child {
		flex: 2;
	}

	.filter-group label {
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-gray-500);
		margin-bottom: 0;
	}

	.filter-info {
		display: flex;
		align-items: center;
		padding-bottom: var(--spacing-3);
		white-space: nowrap;
	}

	/* LV-Sektionen */
	.lv-section {
		margin-bottom: var(--spacing-8);
	}

	.lv-header {
		padding: var(--spacing-4) var(--spacing-5);
		border-radius: var(--radius-lg) var(--radius-lg) 0 0;
		margin-bottom: 0;
	}

	.lv-header-gws {
		background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
		color: white;
	}

	.lv-header-neurealis {
		background: linear-gradient(135deg, var(--color-primary-800) 0%, var(--color-primary) 100%);
		color: white;
	}

	.lv-header-vbw {
		background: linear-gradient(135deg, #065f46 0%, #10b981 100%);
		color: white;
	}

	.lv-title {
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-bold);
		color: white;
		margin-bottom: var(--spacing-2);
	}

	.lv-stats {
		display: flex;
		gap: var(--spacing-4);
		flex-wrap: wrap;
	}

	.lv-stat {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		font-size: var(--font-size-xs);
		opacity: 0.9;
	}

	.lv-stat-total {
		font-weight: var(--font-weight-semibold);
		opacity: 1;
		margin-left: auto;
	}

	/* Gewerk-Sektionen */
	.gewerk-section {
		border: 1px solid var(--color-gray-200);
		border-top: none;
		background: white;
	}

	.gewerk-section:last-child {
		border-radius: 0 0 var(--radius-lg) var(--radius-lg);
	}

	.gewerk-header {
		width: 100%;
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-3) var(--spacing-5);
		background: var(--color-gray-50);
		border: none;
		border-bottom: 1px solid var(--color-gray-200);
		cursor: pointer;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		color: var(--color-gray-700);
		text-align: left;
		transition: background var(--transition-fast);
	}

	.gewerk-header:hover {
		background: var(--color-gray-100);
	}

	.gewerk-chevron {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
		transition: transform 0.2s ease;
		color: var(--color-gray-400);
	}

	.gewerk-chevron.rotated {
		transform: rotate(90deg);
	}

	.gewerk-name {
		flex: 1;
	}

	.gewerk-count {
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-normal);
		color: var(--color-gray-400);
	}

	/* Tabelle innerhalb Gewerk */
	.gewerk-section .table-container {
		border: none;
		border-radius: 0;
	}

	.gewerk-section table {
		min-width: 900px;
	}

	.gewerk-section thead th {
		position: sticky;
		top: 0;
		z-index: 1;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.page {
			padding: var(--spacing-3);
		}

		.stats-row {
			gap: var(--spacing-2);
		}

		.stat-card {
			min-width: 80px;
			padding: var(--spacing-3);
		}

		.stat-value {
			font-size: var(--font-size-xl);
		}

		.filter-content {
			flex-direction: column;
		}

		.filter-group {
			min-width: 100%;
		}

		.header-top {
			flex-direction: column;
		}

		.header-actions {
			width: 100%;
			justify-content: flex-end;
		}

		.legend-content {
			flex-direction: column;
		}

		.lv-stats {
			flex-direction: column;
			gap: var(--spacing-1);
		}

		.lv-stat-total {
			margin-left: 0;
		}
	}
</style>
