<script lang="ts">
	import { Card, Badge, Button, KPICard, StarRating, Avatar } from '$lib/components/ui';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';

	// Types
	interface Bewerber {
		id: string;
		bewerber_nr: number | null;
		name: string;
		email: string;
		telefon: string | null;
		position: string | null;
		status: string;
		quelle: string | null;
		vermittler_name: string | null;
		vermittler_aktiv: boolean | null;
		provision_typ: string | null;
		provision_pauschal: number | null;
		provision_prozent: number | null;
		zusammenfassung: string | null;
		qualifikationen: Record<string, any> | null;
		berufserfahrung_jahre: number | null;
		fuehrerschein: string | null;
		kultur_rating: number | null;
		kommunikation_rating: number | null;
		skills_rating: number | null;
		kontakt_id: string | null;
		dokument_ids: string[] | null;
		notizen: string | null;
		bewerbung_am: string | null;
		eingestellt_am: string | null;
		erstellt_am: string | null;
	}

	// Status-Konfiguration
	const STATUS_CONFIG: Record<string, { label: string; color: string; variant: 'default' | 'error' | 'warning' | 'info' | 'success' }> = {
		'(0) Erhalten': { label: 'Erhalten', color: '#ef4444', variant: 'error' },
		'(1) Unterlagen gesichtet': { label: 'Gesichtet', color: '#f97316', variant: 'warning' },
		'(2) Telefonisch erreicht': { label: 'Telefonisch', color: '#3b82f6', variant: 'info' },
		'(3) 1. Gespräch': { label: '1. Gespräch', color: '#3b82f6', variant: 'info' },
		'(4) 2. Gespräch': { label: '2. Gespräch', color: '#8b5cf6', variant: 'default' },
		'(5) Referenzen einholen': { label: 'Referenzen', color: '#ec4899', variant: 'default' },
		'(6) Arbeitsvertrag erstellen': { label: 'Vertrag', color: '#84cc16', variant: 'success' },
		'(7) Eingestellt': { label: 'Eingestellt', color: '#10b981', variant: 'success' },
		'(10) Disqualifiziert': { label: 'Disqualifiziert', color: '#6b7280', variant: 'default' }
	};

	// Quellen-Konfiguration
	const QUELLEN_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
		'Direkt': { label: 'Direkt', icon: '●', color: '#10b981' },
		'Stepstone': { label: 'S', icon: 'S', color: '#0066cc' },
		'Indeed': { label: 'I', icon: 'I', color: '#2557a7' },
		'LinkedIn': { label: 'in', icon: 'in', color: '#0077b5' },
		'Empfehlung': { label: '★', icon: '★', color: '#f59e0b' },
		'Vermittler': { label: 'V', icon: 'V', color: '#6b7280' }
	};

	// Status-Liste für Dropdown
	const STATUS_OPTIONS = [
		'(0) Erhalten',
		'(1) Unterlagen gesichtet',
		'(2) Telefonisch erreicht',
		'(3) 1. Gespräch',
		'(4) 2. Gespräch',
		'(5) Referenzen einholen',
		'(6) Arbeitsvertrag erstellen',
		'(7) Eingestellt',
		'(10) Disqualifiziert'
	];

	const QUELLEN_OPTIONS = ['Direkt', 'Stepstone', 'Indeed', 'LinkedIn', 'Empfehlung', 'Vermittler'];

	// State
	let bewerber = $state<Bewerber[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Filter-State
	let searchQuery = $state('');
	let filterStatus = $state<string | null>(null);
	let filterQuelle = $state<string | null>(null);
	let filterPosition = $state<string | null>(null);
	let activeTab = $state<'aktiv' | 'vermittler'>('aktiv');

	// Modal-State
	let showDetailModal = $state(false);
	let selectedBewerber = $state<Bewerber | null>(null);
	let detailTab = $state<'uebersicht' | 'qualifikationen' | 'dokumente' | 'bewertung'>('uebersicht');
	let saving = $state(false);

	// Bewertungs-State für Modal
	let editKulturRating = $state(0);
	let editKommunikationRating = $state(0);
	let editSkillsRating = $state(0);
	let editNotizen = $state('');

	// Unique Positionen für Dropdown
	let uniquePositions = $derived(() => {
		const positions = [...new Set(bewerber.map(b => b.position).filter(Boolean))];
		return positions.sort() as string[];
	});

	// Gefilterte Bewerber
	let filteredBewerber = $derived(() => {
		return bewerber.filter(b => {
			// Tab-Filter
			if (activeTab === 'aktiv') {
				// Aktive Bewerber: vermittler_aktiv ist NULL oder true
				if (b.quelle === 'Vermittler' && b.vermittler_aktiv === false) return false;
			} else {
				// Vermittler-Pool: Quelle = Vermittler UND vermittler_aktiv = false
				if (b.quelle !== 'Vermittler' || b.vermittler_aktiv !== false) return false;
			}

			// Textsuche
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				const match =
					b.name.toLowerCase().includes(query) ||
					(b.position?.toLowerCase() || '').includes(query) ||
					b.email.toLowerCase().includes(query) ||
					`BW-${String(b.bewerber_nr).padStart(4, '0')}`.toLowerCase().includes(query);
				if (!match) return false;
			}

			// Status-Filter
			if (filterStatus && b.status !== filterStatus) return false;

			// Quelle-Filter
			if (filterQuelle && b.quelle !== filterQuelle) return false;

			// Position-Filter
			if (filterPosition && b.position !== filterPosition) return false;

			return true;
		});
	});

	// KPI-Statistiken
	let stats = $derived(() => {
		const now = new Date();
		const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
		const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

		// Nur aktive Bewerber (nicht Vermittler-Pool)
		const aktivBewerber = bewerber.filter(b =>
			b.quelle !== 'Vermittler' || b.vermittler_aktiv !== false
		);

		const gesamt = aktivBewerber.length;

		const neuDieseWoche = aktivBewerber.filter(b => {
			if (b.status !== '(0) Erhalten') return false;
			if (!b.bewerbung_am) return false;
			return new Date(b.bewerbung_am) >= oneWeekAgo;
		}).length;

		const inBearbeitung = aktivBewerber.filter(b =>
			['(1) Unterlagen gesichtet', '(2) Telefonisch erreicht', '(3) 1. Gespräch',
			 '(4) 2. Gespräch', '(5) Referenzen einholen', '(6) Arbeitsvertrag erstellen'
			].includes(b.status)
		).length;

		const eingestelltDiesenMonat = aktivBewerber.filter(b => {
			if (b.status !== '(7) Eingestellt') return false;
			if (!b.eingestellt_am) return false;
			return new Date(b.eingestellt_am) >= monthStart;
		}).length;

		return { gesamt, neuDieseWoche, inBearbeitung, eingestelltDiesenMonat };
	});

	// Durchschnittsbewertung berechnen
	function getAvgRating(b: Bewerber): number {
		const ratings = [b.kultur_rating, b.kommunikation_rating, b.skills_rating].filter(r => r !== null) as number[];
		if (ratings.length === 0) return 0;
		return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
	}

	// Bewerber-Nummer formatieren
	function formatBewerberNr(nr: number | null): string {
		if (!nr) return 'BW-????';
		return `BW-${String(nr).padStart(4, '0')}`;
	}

	// Datum formatieren
	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: '2-digit'
		});
	}

	// Provision formatieren
	function formatProvision(b: Bewerber): string {
		if (b.provision_typ === 'pauschal' && b.provision_pauschal) {
			return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(b.provision_pauschal);
		}
		if (b.provision_typ === 'prozent' && b.provision_prozent) {
			return `${b.provision_prozent}%`;
		}
		return '-';
	}

	// Status-Badge Variante
	function getStatusVariant(status: string): 'default' | 'error' | 'warning' | 'info' | 'success' {
		return STATUS_CONFIG[status]?.variant || 'default';
	}

	// Status-Label
	function getStatusLabel(status: string): string {
		return STATUS_CONFIG[status]?.label || status;
	}

	// Quelle-Icon
	function getQuelleConfig(quelle: string | null): { icon: string; color: string } {
		if (!quelle) return { icon: '?', color: '#6b7280' };
		return QUELLEN_CONFIG[quelle] || { icon: quelle[0], color: '#6b7280' };
	}

	// Daten laden
	async function loadBewerber() {
		loading = true;
		error = null;

		const { data, error: err } = await supabase
			.from('bewerber')
			.select('*')
			.order('bewerbung_am', { ascending: false, nullsFirst: false });

		if (err) {
			error = err.message;
			loading = false;
			return;
		}

		bewerber = data || [];
		loading = false;
	}

	onMount(() => {
		loadBewerber();
	});

	// Filter zurücksetzen
	function clearFilters() {
		searchQuery = '';
		filterStatus = null;
		filterQuelle = null;
		filterPosition = null;
	}

	// Detail-Modal öffnen
	function openDetailModal(b: Bewerber) {
		selectedBewerber = b;
		detailTab = 'uebersicht';
		editKulturRating = b.kultur_rating || 0;
		editKommunikationRating = b.kommunikation_rating || 0;
		editSkillsRating = b.skills_rating || 0;
		editNotizen = b.notizen || '';
		showDetailModal = true;
	}

	// Detail-Modal schließen
	function closeDetailModal() {
		showDetailModal = false;
		selectedBewerber = null;
	}

	// Bewertung speichern
	async function saveBewertung() {
		if (!selectedBewerber) return;
		saving = true;

		const { error: updateError } = await supabase
			.from('bewerber')
			.update({
				kultur_rating: editKulturRating > 0 ? editKulturRating : null,
				kommunikation_rating: editKommunikationRating > 0 ? editKommunikationRating : null,
				skills_rating: editSkillsRating > 0 ? editSkillsRating : null,
				notizen: editNotizen || null,
				aktualisiert_am: new Date().toISOString()
			})
			.eq('id', selectedBewerber.id);

		if (updateError) {
			error = updateError.message;
		} else {
			await loadBewerber();
			// Aktualisierte Daten im Modal anzeigen
			const updated = bewerber.find(b => b.id === selectedBewerber?.id);
			if (updated) {
				selectedBewerber = updated;
			}
		}

		saving = false;
	}

	// Status ändern
	async function updateStatus(newStatus: string) {
		if (!selectedBewerber) return;
		saving = true;

		const updateData: Record<string, any> = {
			status: newStatus,
			aktualisiert_am: new Date().toISOString()
		};

		// Bei Einstellung das Datum setzen
		if (newStatus === '(7) Eingestellt' && !selectedBewerber.eingestellt_am) {
			updateData.eingestellt_am = new Date().toISOString().split('T')[0];
		}

		const { error: updateError } = await supabase
			.from('bewerber')
			.update(updateData)
			.eq('id', selectedBewerber.id);

		if (updateError) {
			error = updateError.message;
		} else {
			await loadBewerber();
			const updated = bewerber.find(b => b.id === selectedBewerber?.id);
			if (updated) {
				selectedBewerber = updated;
			}
		}

		saving = false;
	}

	// Vermittler aktivieren
	async function aktiviereVermittler(b: Bewerber) {
		const { error: updateError } = await supabase
			.from('bewerber')
			.update({
				vermittler_aktiv: true,
				aktualisiert_am: new Date().toISOString()
			})
			.eq('id', b.id);

		if (updateError) {
			error = updateError.message;
		} else {
			await loadBewerber();
		}
	}
</script>

<div class="bewerber-page">
	<header class="page-header">
		<div class="header-content">
			<h1>Bewerber</h1>
			<p class="subtitle">
				{#if loading}
					Lade Bewerber...
				{:else}
					{filteredBewerber().length} von {bewerber.length} Bewerbern
				{/if}
			</p>
		</div>
		<div class="header-actions">
			<button class="refresh-btn" onclick={() => loadBewerber()} disabled={loading}>
				{loading ? 'Lädt...' : 'Aktualisieren'}
			</button>
		</div>
	</header>

	{#if error}
		<div class="error-banner">
			<span>Fehler: {error}</span>
			<Button variant="secondary" size="sm" onclick={() => loadBewerber()}>
				Erneut versuchen
			</Button>
		</div>
	{/if}

	<!-- KPI-Cards -->
	<div class="kpi-row">
		<KPICard
			label="Gesamt"
			value={stats().gesamt}
			color="blue"
		/>
		<KPICard
			label="Neu diese Woche"
			value={stats().neuDieseWoche}
			color="red"
		/>
		<KPICard
			label="In Bearbeitung"
			value={stats().inBearbeitung}
			color="orange"
		/>
		<KPICard
			label="Eingestellt (Monat)"
			value={stats().eingestelltDiesenMonat}
			color="green"
		/>
	</div>

	<!-- Tabs -->
	<div class="tabs-row">
		<button
			class="tab-btn"
			class:active={activeTab === 'aktiv'}
			onclick={() => activeTab = 'aktiv'}
		>
			Aktive Bewerber
		</button>
		<button
			class="tab-btn"
			class:active={activeTab === 'vermittler'}
			onclick={() => activeTab = 'vermittler'}
		>
			Vermittler-Pool
		</button>
	</div>

	<!-- Filter -->
	<Card padding="sm">
		<div class="filters">
			<div class="search-box">
				<span class="search-icon">&#128269;</span>
				<input
					type="search"
					placeholder="Name, Position, E-Mail oder Nr. suchen..."
					bind:value={searchQuery}
					class="search-input"
				/>
			</div>

			<select bind:value={filterStatus} class="filter-select">
				<option value={null}>Alle Status</option>
				{#each STATUS_OPTIONS as status}
					<option value={status}>{STATUS_CONFIG[status]?.label || status}</option>
				{/each}
			</select>

			<select bind:value={filterQuelle} class="filter-select">
				<option value={null}>Alle Quellen</option>
				{#each QUELLEN_OPTIONS as quelle}
					<option value={quelle}>{quelle}</option>
				{/each}
			</select>

			<select bind:value={filterPosition} class="filter-select">
				<option value={null}>Alle Positionen</option>
				{#each uniquePositions() as position}
					<option value={position}>{position}</option>
				{/each}
			</select>

			{#if searchQuery || filterStatus || filterQuelle || filterPosition}
				<button class="clear-btn" onclick={clearFilters}>
					Filter zurücksetzen
				</button>
			{/if}
		</div>
	</Card>

	<!-- Loading State -->
	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Lade Bewerber...</p>
		</div>
	{:else if filteredBewerber().length === 0}
		<div class="empty-state">
			<p>
				{#if activeTab === 'vermittler'}
					Keine Bewerber im Vermittler-Pool.
				{:else if searchQuery || filterStatus || filterQuelle || filterPosition}
					Keine Bewerber gefunden.
				{:else}
					Noch keine Bewerber vorhanden.
				{/if}
			</p>
			{#if searchQuery || filterStatus || filterQuelle || filterPosition}
				<Button variant="secondary" onclick={clearFilters}>
					Filter zurücksetzen
				</Button>
			{/if}
		</div>
	{:else}
		<!-- Tabellen-Ansicht (Desktop) -->
		<div class="table-container desktop-only">
			<table class="bewerber-table">
				<thead>
					<tr>
						<th>Nr.</th>
						<th>Name</th>
						<th>Position</th>
						<th>Status</th>
						<th>Quelle</th>
						<th>Eingang</th>
						<th>Bewertung</th>
						{#if activeTab === 'vermittler'}
							<th>Provision</th>
						{/if}
						<th>Aktionen</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredBewerber() as b}
						<tr onclick={() => openDetailModal(b)} class="clickable-row">
							<td class="td-nr">{formatBewerberNr(b.bewerber_nr)}</td>
							<td class="td-name">
								<div class="name-cell">
									<Avatar name={b.name} size="sm" />
									<span class="name-text">{b.name}</span>
								</div>
							</td>
							<td class="td-position">{b.position || '-'}</td>
							<td class="td-status">
								<Badge variant={getStatusVariant(b.status)} size="sm">
									{getStatusLabel(b.status)}
								</Badge>
							</td>
							<td class="td-quelle">
								{#if b.quelle}
									{@const quelleConfig = getQuelleConfig(b.quelle)}
									<span class="quelle-badge" style="background: {quelleConfig.color}">
										{quelleConfig.icon}
									</span>
								{:else}
									-
								{/if}
							</td>
							<td class="td-datum">{formatDate(b.bewerbung_am)}</td>
							<td class="td-bewertung">
								{#if getAvgRating(b) > 0}
									<StarRating value={Math.round(getAvgRating(b))} readonly size="sm" />
								{:else}
									<span class="no-rating">-</span>
								{/if}
							</td>
							{#if activeTab === 'vermittler'}
								<td class="td-provision">{formatProvision(b)}</td>
							{/if}
							<td class="td-actions">
								<button
									class="action-btn"
									onclick={(e) => { e.stopPropagation(); openDetailModal(b); }}
									title="Öffnen"
								>
									Öffnen
								</button>
								{#if activeTab === 'vermittler'}
									<button
										class="action-btn activate-btn"
										onclick={(e) => { e.stopPropagation(); aktiviereVermittler(b); }}
										title="Aktivieren"
									>
										Aktivieren
									</button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Karten-Ansicht (Mobile) -->
		<div class="cards-container mobile-only">
			{#each filteredBewerber() as b}
				<div class="bewerber-card" onclick={() => openDetailModal(b)} role="button" tabindex="0" onkeypress={(e) => e.key === 'Enter' && openDetailModal(b)}>
					<div class="card-header">
						<div class="header-left">
							<Avatar name={b.name} size="md" />
							<div class="header-info">
								<span class="bewerber-nr">{formatBewerberNr(b.bewerber_nr)}</span>
								<h3 class="bewerber-name">{b.name}</h3>
								{#if b.position}
									<span class="bewerber-position">{b.position}</span>
								{/if}
							</div>
						</div>
						{#if b.quelle}
							{@const quelleConfig = getQuelleConfig(b.quelle)}
							<span class="quelle-badge" style="background: {quelleConfig.color}">
								{quelleConfig.icon}
							</span>
						{/if}
					</div>

					<div class="card-body">
						<div class="card-row">
							<span class="card-label">Status</span>
							<Badge variant={getStatusVariant(b.status)} size="sm">
								{getStatusLabel(b.status)}
							</Badge>
						</div>
						<div class="card-row">
							<span class="card-label">Eingang</span>
							<span class="card-value">{formatDate(b.bewerbung_am)}</span>
						</div>
						{#if getAvgRating(b) > 0}
							<div class="card-row">
								<span class="card-label">Bewertung</span>
								<StarRating value={Math.round(getAvgRating(b))} readonly size="sm" />
							</div>
						{/if}
						{#if activeTab === 'vermittler'}
							<div class="card-row">
								<span class="card-label">Provision</span>
								<span class="card-value">{formatProvision(b)}</span>
							</div>
						{/if}
					</div>

					{#if activeTab === 'vermittler'}
						<div class="card-footer">
							<button
								class="activate-btn-full"
								onclick={(e) => { e.stopPropagation(); aktiviereVermittler(b); }}
							>
								Aktivieren
							</button>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Detail-Modal -->
{#if showDetailModal && selectedBewerber}
	<div class="modal-overlay" onclick={closeDetailModal} role="dialog" aria-modal="true">
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<div class="modal-header-left">
					<Avatar name={selectedBewerber.name} size="lg" />
					<div class="modal-header-info">
						<h2>{selectedBewerber.name}</h2>
						{#if selectedBewerber.position}
							<span class="modal-position">{selectedBewerber.position}</span>
						{/if}
					</div>
				</div>
				<div class="modal-header-right">
					<select
						class="status-select"
						value={selectedBewerber.status}
						onchange={(e) => updateStatus((e.target as HTMLSelectElement).value)}
						disabled={saving}
					>
						{#each STATUS_OPTIONS as status}
							<option value={status}>{STATUS_CONFIG[status]?.label || status}</option>
						{/each}
					</select>
					<button class="close-btn" onclick={closeDetailModal} aria-label="Schließen">&times;</button>
				</div>
			</div>

			<div class="modal-tabs">
				<button
					class="modal-tab"
					class:active={detailTab === 'uebersicht'}
					onclick={() => detailTab = 'uebersicht'}
				>
					Übersicht
				</button>
				<button
					class="modal-tab"
					class:active={detailTab === 'qualifikationen'}
					onclick={() => detailTab = 'qualifikationen'}
				>
					Qualifikationen
				</button>
				<button
					class="modal-tab"
					class:active={detailTab === 'dokumente'}
					onclick={() => detailTab = 'dokumente'}
				>
					Dokumente
				</button>
				<button
					class="modal-tab"
					class:active={detailTab === 'bewertung'}
					onclick={() => detailTab = 'bewertung'}
				>
					Bewertung
				</button>
			</div>

			<div class="modal-body">
				{#if detailTab === 'uebersicht'}
					<div class="detail-section">
						<h3>Kontaktdaten</h3>
						<div class="detail-grid">
							<div class="detail-item">
								<span class="detail-label">E-Mail</span>
								<a href="mailto:{selectedBewerber.email}" class="detail-link">{selectedBewerber.email}</a>
							</div>
							<div class="detail-item">
								<span class="detail-label">Telefon</span>
								{#if selectedBewerber.telefon}
									<a href="tel:{selectedBewerber.telefon}" class="detail-link">{selectedBewerber.telefon}</a>
								{:else}
									<span class="detail-value">-</span>
								{/if}
							</div>
						</div>
					</div>

					<div class="detail-section">
						<h3>Bewerbungsdetails</h3>
						<div class="detail-grid">
							<div class="detail-item">
								<span class="detail-label">Bewerber-Nr.</span>
								<span class="detail-value">{formatBewerberNr(selectedBewerber.bewerber_nr)}</span>
							</div>
							<div class="detail-item">
								<span class="detail-label">Quelle</span>
								<span class="detail-value">{selectedBewerber.quelle || '-'}</span>
							</div>
							<div class="detail-item">
								<span class="detail-label">Bewerbung am</span>
								<span class="detail-value">{formatDate(selectedBewerber.bewerbung_am)}</span>
							</div>
							{#if selectedBewerber.eingestellt_am}
								<div class="detail-item">
									<span class="detail-label">Eingestellt am</span>
									<span class="detail-value">{formatDate(selectedBewerber.eingestellt_am)}</span>
								</div>
							{/if}
						</div>
					</div>

					{#if selectedBewerber.quelle === 'Vermittler'}
						<div class="detail-section">
							<h3>Vermittler-Informationen</h3>
							<div class="detail-grid">
								<div class="detail-item">
									<span class="detail-label">Vermittler</span>
									<span class="detail-value">{selectedBewerber.vermittler_name || '-'}</span>
								</div>
								<div class="detail-item">
									<span class="detail-label">Provision</span>
									<span class="detail-value">{formatProvision(selectedBewerber)}</span>
								</div>
							</div>
						</div>
					{/if}

					{#if selectedBewerber.zusammenfassung}
						<div class="detail-section">
							<h3>Zusammenfassung</h3>
							<p class="summary-text">{selectedBewerber.zusammenfassung}</p>
						</div>
					{/if}

				{:else if detailTab === 'qualifikationen'}
					<div class="detail-section">
						<h3>Erfahrung & Führerschein</h3>
						<div class="detail-grid">
							<div class="detail-item">
								<span class="detail-label">Berufserfahrung</span>
								<span class="detail-value">
									{selectedBewerber.berufserfahrung_jahre ? `${selectedBewerber.berufserfahrung_jahre} Jahre` : '-'}
								</span>
							</div>
							<div class="detail-item">
								<span class="detail-label">Führerschein</span>
								<span class="detail-value">{selectedBewerber.fuehrerschein || '-'}</span>
							</div>
						</div>
					</div>

					{#if selectedBewerber.qualifikationen}
						<div class="detail-section">
							<h3>KI-geparste Qualifikationen</h3>
							<div class="qualifikationen-box">
								{#if typeof selectedBewerber.qualifikationen === 'object'}
									{#each Object.entries(selectedBewerber.qualifikationen) as [key, value]}
										<div class="quali-item">
											<span class="quali-key">{key}:</span>
											<span class="quali-value">
												{#if Array.isArray(value)}
													{value.join(', ')}
												{:else if typeof value === 'object'}
													{JSON.stringify(value)}
												{:else}
													{value}
												{/if}
											</span>
										</div>
									{/each}
								{:else}
									<p>Keine strukturierten Qualifikationen verfügbar.</p>
								{/if}
							</div>
						</div>
					{:else}
						<div class="empty-tab">
							<p>Keine Qualifikationsdaten vorhanden.</p>
						</div>
					{/if}

				{:else if detailTab === 'dokumente'}
					{#if selectedBewerber.dokument_ids && selectedBewerber.dokument_ids.length > 0}
						<div class="detail-section">
							<h3>Verknüpfte Dokumente</h3>
							<ul class="dokument-liste">
								{#each selectedBewerber.dokument_ids as docId}
									<li class="dokument-item">
										<span class="doc-icon">&#128196;</span>
										<span class="doc-id">{docId}</span>
									</li>
								{/each}
							</ul>
						</div>
					{:else}
						<div class="empty-tab">
							<p>Keine Dokumente verknüpft.</p>
						</div>
					{/if}

				{:else if detailTab === 'bewertung'}
					<div class="detail-section">
						<h3>Bewertung</h3>
						<div class="bewertung-grid">
							<div class="bewertung-item">
								<label class="bewertung-label">Kulturfit</label>
								<StarRating
									value={editKulturRating}
									onchange={(v) => editKulturRating = v}
									size="lg"
								/>
							</div>
							<div class="bewertung-item">
								<label class="bewertung-label">Kommunikation</label>
								<StarRating
									value={editKommunikationRating}
									onchange={(v) => editKommunikationRating = v}
									size="lg"
								/>
							</div>
							<div class="bewertung-item">
								<label class="bewertung-label">Fachliche Skills</label>
								<StarRating
									value={editSkillsRating}
									onchange={(v) => editSkillsRating = v}
									size="lg"
								/>
							</div>
						</div>
					</div>

					<div class="detail-section">
						<h3>Notizen</h3>
						<textarea
							class="notizen-textarea"
							bind:value={editNotizen}
							placeholder="Notizen zum Bewerber eingeben..."
							rows="5"
						></textarea>
					</div>

					<div class="bewertung-actions">
						<Button
							variant="primary"
							onclick={saveBewertung}
							disabled={saving}
						>
							{saving ? 'Speichern...' : 'Bewertung speichern'}
						</Button>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.bewerber-page {
		max-width: 1400px;
		margin: 0 auto;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.page-header h1 {
		font-size: 1.75rem;
		margin-bottom: 0.25rem;
	}

	.subtitle {
		color: var(--color-gray-500);
		margin: 0;
	}

	.header-actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.refresh-btn {
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-gray-300);
		background: white;
		cursor: pointer;
		font-size: 0.85rem;
	}

	.refresh-btn:hover:not(:disabled) {
		background: var(--color-gray-50);
	}

	.refresh-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.error-banner {
		background: var(--color-error-light);
		border: 1px solid var(--color-error);
		color: var(--color-error-dark);
		padding: 1rem;
		margin-bottom: 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	/* KPI Row */
	.kpi-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	@media (max-width: 900px) {
		.kpi-row {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 500px) {
		.kpi-row {
			grid-template-columns: 1fr;
		}
	}

	/* Tabs */
	.tabs-row {
		display: flex;
		gap: 0;
		margin-bottom: 1rem;
		border-bottom: 1px solid var(--color-gray-200);
	}

	.tab-btn {
		padding: 0.75rem 1.5rem;
		border: none;
		background: none;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--color-gray-500);
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		transition: all 0.15s ease;
	}

	.tab-btn:hover {
		color: var(--color-gray-700);
	}

	.tab-btn.active {
		color: var(--color-brand-medium);
		border-bottom-color: var(--color-brand-medium);
	}

	/* Filters */
	.filters {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		align-items: center;
	}

	.search-box {
		display: flex;
		align-items: center;
		background: white;
		border: 1px solid var(--color-gray-200);
		padding: 0.5rem 1rem;
		flex: 1;
		min-width: 200px;
	}

	.search-icon {
		color: var(--color-gray-400);
		margin-right: 0.5rem;
	}

	.search-input {
		flex: 1;
		border: none;
		background: none;
		font-size: 0.9rem;
		outline: none;
		padding: 0;
	}

	.filter-select {
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-gray-200);
		background: white;
		font-size: 0.9rem;
		cursor: pointer;
	}

	.clear-btn {
		background: none;
		border: none;
		color: var(--color-brand-medium);
		cursor: pointer;
		font-size: 0.85rem;
	}

	/* Loading/Empty States */
	.loading-state,
	.empty-state {
		text-align: center;
		padding: 3rem 1rem;
		color: var(--color-gray-500);
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid var(--color-gray-200);
		border-top-color: var(--color-brand-medium);
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto 1rem;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* Table */
	.table-container {
		margin-top: 1rem;
		background: white;
		border: 1px solid var(--color-gray-200);
		overflow-x: auto;
	}

	.bewerber-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.bewerber-table th {
		text-align: left;
		padding: 0.75rem 1rem;
		background: var(--color-gray-50);
		border-bottom: 1px solid var(--color-gray-200);
		font-weight: 600;
		color: var(--color-gray-600);
		font-size: 0.8rem;
		text-transform: uppercase;
	}

	.bewerber-table td {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-gray-100);
		vertical-align: middle;
	}

	.bewerber-table tr.clickable-row {
		cursor: pointer;
	}

	.bewerber-table tr:hover {
		background: var(--color-gray-50);
	}

	.td-nr {
		font-family: var(--font-family-mono);
		font-size: 0.8rem;
		color: var(--color-gray-500);
		white-space: nowrap;
	}

	.name-cell {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.name-text {
		font-weight: 500;
	}

	.td-position {
		color: var(--color-gray-600);
	}

	.td-datum {
		white-space: nowrap;
		color: var(--color-gray-600);
	}

	.quelle-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		color: white;
		font-size: 0.65rem;
		font-weight: 700;
	}

	.no-rating {
		color: var(--color-gray-400);
	}

	.td-actions {
		white-space: nowrap;
		display: flex;
		gap: 0.5rem;
	}

	.action-btn {
		padding: 0.35rem 0.75rem;
		border: 1px solid var(--color-gray-300);
		background: white;
		cursor: pointer;
		font-size: 0.8rem;
	}

	.action-btn:hover {
		background: var(--color-gray-50);
	}

	.activate-btn {
		border-color: var(--color-success);
		color: var(--color-success-dark);
	}

	.activate-btn:hover {
		background: var(--color-success-light);
	}

	/* Cards (Mobile) */
	.cards-container {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-top: 1rem;
	}

	.bewerber-card {
		background: white;
		border: 1px solid var(--color-gray-200);
		padding: 1rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.bewerber-card:hover {
		border-color: var(--color-gray-300);
		box-shadow: var(--shadow-md);
	}

	.bewerber-card .card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1rem;
	}

	.header-left {
		display: flex;
		gap: 0.75rem;
	}

	.header-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.bewerber-nr {
		font-family: var(--font-family-mono);
		font-size: 0.75rem;
		color: var(--color-gray-500);
	}

	.bewerber-name {
		font-size: 1rem;
		font-weight: 600;
		margin: 0;
	}

	.bewerber-position {
		font-size: 0.85rem;
		color: var(--color-gray-500);
	}

	.bewerber-card .card-body {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.card-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.card-label {
		font-size: 0.8rem;
		color: var(--color-gray-500);
	}

	.card-value {
		font-size: 0.9rem;
		color: var(--color-gray-800);
	}

	.card-footer {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-gray-100);
	}

	.activate-btn-full {
		width: 100%;
		padding: 0.5rem;
		background: var(--color-success-light);
		border: 1px solid var(--color-success);
		color: var(--color-success-dark);
		cursor: pointer;
		font-weight: 500;
	}

	.activate-btn-full:hover {
		background: var(--color-success);
		color: white;
	}

	/* Responsive visibility */
	.desktop-only {
		display: block;
	}

	.mobile-only {
		display: none;
	}

	@media (max-width: 768px) {
		.desktop-only {
			display: none;
		}

		.mobile-only {
			display: flex;
		}

		.page-header {
			flex-direction: column;
		}

		.header-actions {
			width: 100%;
			justify-content: space-between;
		}

		.filters {
			flex-direction: column;
		}

		.search-box,
		.filter-select {
			width: 100%;
		}
	}

	/* Modal Styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal-content {
		background: white;
		width: 100%;
		max-width: 700px;
		max-height: 90vh;
		overflow-y: auto;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 1.5rem;
		border-bottom: 1px solid var(--color-gray-200);
		background: var(--color-gray-50);
	}

	.modal-header-left {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.modal-header-info h2 {
		margin: 0 0 0.25rem 0;
		font-size: 1.25rem;
	}

	.modal-position {
		font-size: 0.9rem;
		color: var(--color-gray-500);
	}

	.modal-header-right {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.status-select {
		padding: 0.35rem 0.75rem;
		border: 1px solid var(--color-gray-300);
		background: white;
		font-size: 0.85rem;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: var(--color-gray-500);
		line-height: 1;
		padding: 0;
	}

	.close-btn:hover {
		color: var(--color-gray-800);
	}

	/* Modal Tabs */
	.modal-tabs {
		display: flex;
		border-bottom: 1px solid var(--color-gray-200);
		background: white;
	}

	.modal-tab {
		padding: 0.75rem 1.25rem;
		border: none;
		background: none;
		cursor: pointer;
		font-size: 0.85rem;
		color: var(--color-gray-500);
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
	}

	.modal-tab:hover {
		color: var(--color-gray-700);
	}

	.modal-tab.active {
		color: var(--color-brand-medium);
		border-bottom-color: var(--color-brand-medium);
	}

	.modal-body {
		padding: 1.5rem;
	}

	.detail-section {
		margin-bottom: 1.5rem;
	}

	.detail-section:last-child {
		margin-bottom: 0;
	}

	.detail-section h3 {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--color-gray-600);
		margin: 0 0 0.75rem 0;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.detail-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}

	@media (max-width: 500px) {
		.detail-grid {
			grid-template-columns: 1fr;
		}
	}

	.detail-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.detail-label {
		font-size: 0.75rem;
		color: var(--color-gray-500);
		text-transform: uppercase;
	}

	.detail-value {
		font-size: 0.9rem;
		color: var(--color-gray-800);
	}

	.detail-link {
		font-size: 0.9rem;
		color: var(--color-brand-medium);
		text-decoration: none;
	}

	.detail-link:hover {
		text-decoration: underline;
	}

	.summary-text {
		font-size: 0.9rem;
		color: var(--color-gray-700);
		line-height: 1.6;
		margin: 0;
	}

	/* Qualifikationen */
	.qualifikationen-box {
		background: var(--color-gray-50);
		padding: 1rem;
		font-size: 0.85rem;
	}

	.quali-item {
		margin-bottom: 0.5rem;
	}

	.quali-item:last-child {
		margin-bottom: 0;
	}

	.quali-key {
		font-weight: 500;
		color: var(--color-gray-700);
	}

	.quali-value {
		color: var(--color-gray-600);
	}

	/* Dokumente */
	.dokument-liste {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.dokument-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		border-bottom: 1px solid var(--color-gray-100);
	}

	.dokument-item:last-child {
		border-bottom: none;
	}

	.doc-icon {
		color: var(--color-gray-400);
	}

	.doc-id {
		font-family: var(--font-family-mono);
		font-size: 0.85rem;
	}

	/* Bewertung */
	.bewertung-grid {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.bewertung-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem;
		background: var(--color-gray-50);
	}

	.bewertung-label {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--color-gray-700);
	}

	.notizen-textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid var(--color-gray-300);
		font-size: 0.9rem;
		resize: vertical;
		font-family: inherit;
	}

	.notizen-textarea:focus {
		outline: none;
		border-color: var(--color-brand-medium);
	}

	.bewertung-actions {
		margin-top: 1rem;
		display: flex;
		justify-content: flex-end;
	}

	.empty-tab {
		text-align: center;
		padding: 2rem;
		color: var(--color-gray-500);
	}

	@media (max-width: 768px) {
		.modal-content {
			max-height: 100vh;
		}

		.modal-header {
			flex-direction: column;
			gap: 1rem;
		}

		.modal-header-right {
			width: 100%;
			justify-content: space-between;
		}

		.modal-tabs {
			overflow-x: auto;
		}

		.modal-tab {
			white-space: nowrap;
		}
	}
</style>
