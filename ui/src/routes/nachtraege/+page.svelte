<script lang="ts">
	import { Card, Badge, Button } from '$lib/components/ui';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';

	// Types
	interface Nachtrag {
		id: string;
		nachtrag_nr: string | null;
		atbs_nummer: string;
		projektname_extern: string | null;
		status: string;
		status_nu: string | null;
		titel: string | null;
		beschreibung: string | null;
		betrag_kunde_netto: number | null;
		betrag_nu_netto: number | null;
		marge_prozent: number | null;
		verzoegerung_tage: number | null;
		gemeldet_von: string | null;
		melder_name: string | null;
		created_at: string | null;
		foto_urls: string[] | null;
	}

	interface MondayItem {
		id: string;
		name: string;
	}

	// Svelte 5 Runes
	let nachtraege = $state<Nachtrag[]>([]);
	let mondayItems = $state<MondayItem[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let saving = $state(false);

	// Filter State
	let filterStatus = $state<string>('alle');
	let filterBV = $state<string>('');

	// Modal State
	let showModal = $state(false);
	let editMode = $state(false);
	let currentNachtrag = $state<Nachtrag | null>(null);

	// Delete Confirmation
	let showDeleteConfirm = $state(false);
	let deleteTarget = $state<Nachtrag | null>(null);

	// Form State
	let formData = $state({
		atbs_nummer: '',
		nachtrag_nr: '',
		status: '(0) Offen',
		titel: '',
		beschreibung: '',
		betrag_kunde_netto: null as number | null,
		betrag_nu_netto: null as number | null,
		verzoegerung_tage: null as number | null
	});

	// Status-Optionen
	const statusOptions = [
		'(0) Offen',
		'(0) Offen / Preis eingeben',
		'(1) In Prüfung',
		'(2) Genehmigt',
		'(2) Abgelehnt'
	];

	// Unique BV-Nummern für Filter-Dropdown
	let uniqueBVs = $derived(() => {
		const bvs = [...new Set(nachtraege.map(n => n.atbs_nummer))];
		return bvs.sort();
	});

	// Gefilterte Nachträge
	let filteredNachtraege = $derived(() => {
		return nachtraege.filter(n => {
			// Status-Filter
			if (filterStatus !== 'alle') {
				const statusLower = n.status.toLowerCase();
				if (filterStatus === 'offen' && !statusLower.includes('offen')) return false;
				if (filterStatus === 'genehmigt' && !statusLower.includes('genehmigt')) return false;
				if (filterStatus === 'abgelehnt' && !statusLower.includes('abgelehnt')) return false;
				if (filterStatus === 'preis_eingegeben' && !statusLower.includes('preis eingeben')) return false;
				if (filterStatus === 'in_pruefung' && !statusLower.includes('prüfung')) return false;
			}
			// BV-Filter
			if (filterBV && n.atbs_nummer !== filterBV) return false;
			return true;
		});
	});

	// Berechnete Marge
	let calculatedMarge = $derived(() => {
		const kunde = formData.betrag_kunde_netto || 0;
		const nu = formData.betrag_nu_netto || 0;
		const marge = kunde - nu;
		const prozent = kunde > 0 ? ((marge / kunde) * 100).toFixed(1) : '0';
		return { betrag: marge, prozent };
	});

	// Statistiken
	let stats = $derived(() => {
		const offen = nachtraege.filter(n => n.status.toLowerCase().includes('offen')).length;
		const genehmigt = nachtraege.filter(n => n.status.toLowerCase().includes('genehmigt')).length;
		const abgelehnt = nachtraege.filter(n => n.status.toLowerCase().includes('abgelehnt')).length;
		const summeGenehmigt = nachtraege
			.filter(n => n.status.toLowerCase().includes('genehmigt'))
			.reduce((sum, n) => sum + (n.betrag_kunde_netto || 0), 0);
		const summeOffen = nachtraege
			.filter(n => n.status.toLowerCase().includes('offen'))
			.reduce((sum, n) => sum + (n.betrag_kunde_netto || 0), 0);
		const summeMarge = nachtraege
			.filter(n => n.status.toLowerCase().includes('genehmigt'))
			.reduce((sum, n) => sum + ((n.betrag_kunde_netto || 0) - (n.betrag_nu_netto || 0)), 0);
		return { offen, genehmigt, abgelehnt, summeGenehmigt, summeOffen, summeMarge };
	});

	// Daten laden
	async function loadNachtraege() {
		loading = true;
		error = null;

		const { data, error: err } = await supabase
			.from('nachtraege')
			.select('*')
			.order('created_at', { ascending: false });

		if (err) {
			error = err.message;
			loading = false;
			return;
		}

		nachtraege = data || [];
		loading = false;
	}

	async function loadMondayItems() {
		const { data } = await supabase
			.from('monday_bauprozess')
			.select('id, name')
			.order('name');
		mondayItems = data || [];
	}

	onMount(() => {
		loadNachtraege();
		loadMondayItems();
	});

	function formatCurrency(value: number | null): string {
		if (value === null) return '-';
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
			year: '2-digit'
		});
	}

	function getStatusLabel(status: string): string {
		const match = status.match(/\(\d+\)\s*(.+)/);
		return match ? match[1] : status;
	}

	function getStatusVariant(status: string): 'success' | 'warning' | 'error' | 'default' {
		const statusLower = status.toLowerCase();
		if (statusLower.includes('genehmigt')) return 'success';
		if (statusLower.includes('offen')) return 'warning';
		if (statusLower.includes('abgelehnt')) return 'error';
		if (statusLower.includes('prüfung')) return 'default';
		return 'default';
	}

	function getStatusNUVariant(statusNU: string | null): 'success' | 'warning' | 'error' | 'default' {
		if (!statusNU) return 'default';
		const statusLower = statusNU.toLowerCase();
		if (statusLower.includes('angenommen')) return 'success';
		if (statusLower.includes('abgelehnt')) return 'error';
		return 'warning';
	}

	// Modal-Funktionen
	function openCreateModal() {
		editMode = false;
		currentNachtrag = null;
		formData = {
			atbs_nummer: '',
			nachtrag_nr: '',
			status: '(0) Offen',
			titel: '',
			beschreibung: '',
			betrag_kunde_netto: null,
			betrag_nu_netto: null,
			verzoegerung_tage: null
		};
		showModal = true;
	}

	function openEditModal(nachtrag: Nachtrag) {
		editMode = true;
		currentNachtrag = nachtrag;
		formData = {
			atbs_nummer: nachtrag.atbs_nummer,
			nachtrag_nr: nachtrag.nachtrag_nr || '',
			status: nachtrag.status,
			titel: nachtrag.titel || '',
			beschreibung: nachtrag.beschreibung || '',
			betrag_kunde_netto: nachtrag.betrag_kunde_netto,
			betrag_nu_netto: nachtrag.betrag_nu_netto,
			verzoegerung_tage: nachtrag.verzoegerung_tage
		};
		showModal = true;
	}

	function closeModal() {
		showModal = false;
		currentNachtrag = null;
	}

	// CRUD-Operationen
	async function saveNachtrag() {
		if (!formData.atbs_nummer) {
			error = 'ATBS-Nummer ist erforderlich';
			return;
		}

		saving = true;
		error = null;

		// Marge berechnen
		const kunde = formData.betrag_kunde_netto || 0;
		const nu = formData.betrag_nu_netto || 0;
		const margeProzent = kunde > 0 ? Number(((kunde - nu) / kunde * 100).toFixed(1)) : null;

		const payload = {
			atbs_nummer: formData.atbs_nummer,
			nachtrag_nr: formData.nachtrag_nr || null,
			status: formData.status,
			titel: formData.titel || null,
			beschreibung: formData.beschreibung || null,
			betrag_kunde_netto: formData.betrag_kunde_netto,
			betrag_nu_netto: formData.betrag_nu_netto,
			verzoegerung_tage: formData.verzoegerung_tage,
			marge_prozent: margeProzent
		};

		if (editMode && currentNachtrag) {
			// UPDATE
			const { error: err } = await supabase
				.from('nachtraege')
				.update(payload)
				.eq('id', currentNachtrag.id);

			if (err) {
				error = err.message;
				saving = false;
				return;
			}
		} else {
			// INSERT
			const { error: err } = await supabase
				.from('nachtraege')
				.insert(payload);

			if (err) {
				error = err.message;
				saving = false;
				return;
			}
		}

		saving = false;
		closeModal();
		await loadNachtraege();
	}

	async function quickStatusChange(nachtrag: Nachtrag, newStatus: string) {
		const { error: err } = await supabase
			.from('nachtraege')
			.update({ status: newStatus })
			.eq('id', nachtrag.id);

		if (err) {
			error = err.message;
			return;
		}

		await loadNachtraege();
	}

	function confirmDelete(nachtrag: Nachtrag) {
		deleteTarget = nachtrag;
		showDeleteConfirm = true;
	}

	async function deleteNachtrag() {
		if (!deleteTarget) return;

		const { error: err } = await supabase
			.from('nachtraege')
			.delete()
			.eq('id', deleteTarget.id);

		if (err) {
			error = err.message;
			showDeleteConfirm = false;
			deleteTarget = null;
			return;
		}

		showDeleteConfirm = false;
		deleteTarget = null;
		await loadNachtraege();
	}

	function cancelDelete() {
		showDeleteConfirm = false;
		deleteTarget = null;
	}
</script>

<div class="nachtraege-page">
	<header class="page-header">
		<div class="header-content">
			<h1>Nachträge</h1>
			<p class="subtitle">
				{#if loading}
					Lade Nachträge...
				{:else}
					{filteredNachtraege().length} von {nachtraege.length} Nachträgen
				{/if}
			</p>
		</div>
		<Button variant="primary" onclick={openCreateModal}>
			+ Neuer Nachtrag
		</Button>
	</header>

	<!-- Error Message -->
	{#if error}
		<div class="error-banner">
			<span>Fehler: {error}</span>
			<Button variant="secondary" size="sm" onclick={() => { error = null; loadNachtraege(); }}>
				Erneut versuchen
			</Button>
		</div>
	{/if}

	<!-- Filter -->
	<div class="filter-row">
		<div class="filter-group">
			<label for="filter-status">Status</label>
			<select id="filter-status" bind:value={filterStatus}>
				<option value="alle">Alle Status</option>
				<option value="offen">Offen</option>
				<option value="in_pruefung">In Prüfung</option>
				<option value="genehmigt">Genehmigt</option>
				<option value="abgelehnt">Abgelehnt</option>
			</select>
		</div>
		<div class="filter-group">
			<label for="filter-bv">Bauvorhaben</label>
			<select id="filter-bv" bind:value={filterBV}>
				<option value="">Alle BV</option>
				{#each uniqueBVs() as bv}
					<option value={bv}>{bv}</option>
				{/each}
			</select>
		</div>
		{#if filterStatus !== 'alle' || filterBV}
			<Button variant="secondary" size="sm" onclick={() => { filterStatus = 'alle'; filterBV = ''; }}>
				Filter zurücksetzen
			</Button>
		{/if}
	</div>

	<!-- Statistik -->
	<div class="stats-row">
		<div class="stat-card">
			<span class="stat-value warning">{stats().offen}</span>
			<span class="stat-label">Offen</span>
		</div>
		<div class="stat-card">
			<span class="stat-value success">{stats().genehmigt}</span>
			<span class="stat-label">Genehmigt</span>
		</div>
		<div class="stat-card">
			<span class="stat-value error">{stats().abgelehnt}</span>
			<span class="stat-label">Abgelehnt</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{formatCurrency(stats().summeGenehmigt)}</span>
			<span class="stat-label">Genehmigt (Netto)</span>
		</div>
		<div class="stat-card">
			<span class="stat-value success">{formatCurrency(stats().summeMarge)}</span>
			<span class="stat-label">Marge (Genehmigt)</span>
		</div>
	</div>

	<!-- Loading State -->
	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Lade Nachträge...</p>
		</div>
	{:else if filteredNachtraege().length === 0}
		<div class="empty-state">
			<p>Keine Nachträge gefunden.</p>
			{#if filterStatus !== 'alle' || filterBV}
				<Button variant="secondary" onclick={() => { filterStatus = 'alle'; filterBV = ''; }}>
					Filter zurücksetzen
				</Button>
			{/if}
		</div>
	{:else}
		<!-- Liste -->
		<div class="nachtraege-list">
			{#each filteredNachtraege() as nachtrag}
				<Card>
					<div class="nachtrag-header">
						<div class="header-left">
							<span class="nachtrag-id">{nachtrag.nachtrag_nr || nachtrag.id.slice(0, 8)}</span>
							<Badge variant={getStatusVariant(nachtrag.status)} size="sm">
								{getStatusLabel(nachtrag.status)}
							</Badge>
							{#if nachtrag.status_nu}
								<Badge variant={getStatusNUVariant(nachtrag.status_nu)} size="sm">
									NU: {nachtrag.status_nu}
								</Badge>
							{/if}
						</div>
						<div class="header-right">
							<span class="bv-nr">{nachtrag.atbs_nummer}</span>
							<div class="action-buttons">
								<button class="icon-btn edit" onclick={() => openEditModal(nachtrag)} title="Bearbeiten">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
										<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
									</svg>
								</button>
								<button class="icon-btn delete" onclick={() => confirmDelete(nachtrag)} title="Löschen">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M3 6h18"></path>
										<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
									</svg>
								</button>
							</div>
						</div>
					</div>

					<h3 class="titel">{nachtrag.titel || 'Ohne Titel'}</h3>
					{#if nachtrag.beschreibung}
						<p class="beschreibung">{nachtrag.beschreibung}</p>
					{/if}
					{#if nachtrag.projektname_extern}
						<p class="adresse">{nachtrag.projektname_extern}</p>
					{/if}

					<div class="nachtrag-meta">
						<div class="meta-item">
							<span class="meta-label">Betrag Kunde</span>
							<span class="meta-value budget">{formatCurrency(nachtrag.betrag_kunde_netto)}</span>
						</div>
						<div class="meta-item">
							<span class="meta-label">Betrag NU</span>
							<span class="meta-value">{formatCurrency(nachtrag.betrag_nu_netto)}</span>
						</div>
						<div class="meta-item">
							<span class="meta-label">Marge</span>
							<span class="meta-value marge">
								{formatCurrency((nachtrag.betrag_kunde_netto || 0) - (nachtrag.betrag_nu_netto || 0))}
								{#if nachtrag.marge_prozent}
									<small>({nachtrag.marge_prozent}%)</small>
								{/if}
							</span>
						</div>
						<div class="meta-item">
							<span class="meta-label">Verzögerung</span>
							<span class="meta-value">
								{#if nachtrag.verzoegerung_tage !== null && nachtrag.verzoegerung_tage > 0}
									+{nachtrag.verzoegerung_tage} Tage
								{:else}
									-
								{/if}
							</span>
						</div>
						<div class="meta-item">
							<span class="meta-label">Erstellt</span>
							<span class="meta-value">{formatDate(nachtrag.created_at)}</span>
						</div>
					</div>

					<!-- Quick Actions -->
					<div class="quick-actions">
						<span class="quick-label">Status ändern:</span>
						<button
							class="quick-btn in-pruefung"
							class:active={nachtrag.status.includes('Prüfung')}
							onclick={() => quickStatusChange(nachtrag, '(1) In Prüfung')}
						>
							In Prüfung
						</button>
						<button
							class="quick-btn genehmigt"
							class:active={nachtrag.status.includes('Genehmigt')}
							onclick={() => quickStatusChange(nachtrag, '(2) Genehmigt')}
						>
							Genehmigt
						</button>
						<button
							class="quick-btn abgelehnt"
							class:active={nachtrag.status.includes('Abgelehnt')}
							onclick={() => quickStatusChange(nachtrag, '(2) Abgelehnt')}
						>
							Abgelehnt
						</button>
					</div>

					{#if nachtrag.foto_urls && nachtrag.foto_urls.length > 0}
						<div class="fotos-hint">
							<span>{nachtrag.foto_urls.length} Foto(s) vorhanden</span>
						</div>
					{/if}
				</Card>
			{/each}
		</div>
	{/if}
</div>

<!-- Modal für Create/Edit -->
{#if showModal}
	<div class="modal-overlay" onclick={closeModal}>
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>{editMode ? 'Nachtrag bearbeiten' : 'Neuer Nachtrag'}</h2>
				<button class="close-btn" onclick={closeModal}>&times;</button>
			</div>

			<form class="modal-body" onsubmit={(e) => { e.preventDefault(); saveNachtrag(); }}>
				<div class="form-row">
					<div class="form-group">
						<label for="atbs_nummer">ATBS-Nummer *</label>
						<input
							id="atbs_nummer"
							type="text"
							bind:value={formData.atbs_nummer}
							placeholder="z.B. ATBS-123"
							list="atbs-list"
							required
						/>
						<datalist id="atbs-list">
							{#each uniqueBVs() as bv}
								<option value={bv}></option>
							{/each}
						</datalist>
					</div>
					<div class="form-group">
						<label for="nachtrag_nr">Nachtrag-Nr.</label>
						<input
							id="nachtrag_nr"
							type="text"
							bind:value={formData.nachtrag_nr}
							placeholder="z.B. NT-001"
						/>
					</div>
				</div>

				<div class="form-group">
					<label for="status">Status</label>
					<select id="status" bind:value={formData.status}>
						{#each statusOptions as opt}
							<option value={opt}>{opt}</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label for="titel">Titel</label>
					<input
						id="titel"
						type="text"
						bind:value={formData.titel}
						placeholder="Kurzbeschreibung des Nachtrags"
					/>
				</div>

				<div class="form-group">
					<label for="beschreibung">Beschreibung</label>
					<textarea
						id="beschreibung"
						bind:value={formData.beschreibung}
						placeholder="Detaillierte Beschreibung..."
						rows="3"
					></textarea>
				</div>

				<div class="form-row three-col">
					<div class="form-group">
						<label for="betrag_kunde">Betrag Kunde (Netto)</label>
						<input
							id="betrag_kunde"
							type="number"
							bind:value={formData.betrag_kunde_netto}
							step="0.01"
							placeholder="0.00"
						/>
					</div>
					<div class="form-group">
						<label for="betrag_nu">Betrag NU (Netto)</label>
						<input
							id="betrag_nu"
							type="number"
							bind:value={formData.betrag_nu_netto}
							step="0.01"
							placeholder="0.00"
						/>
					</div>
					<div class="form-group">
						<label for="verzoegerung">Verzögerung (Tage)</label>
						<input
							id="verzoegerung"
							type="number"
							bind:value={formData.verzoegerung_tage}
							min="0"
							placeholder="0"
						/>
					</div>
				</div>

				<!-- Berechnete Marge -->
				<div class="marge-display">
					<span class="marge-label">Berechnete Marge:</span>
					<span class="marge-value">
						{formatCurrency(calculatedMarge().betrag)} ({calculatedMarge().prozent}%)
					</span>
				</div>

				<div class="modal-footer">
					<Button variant="secondary" onclick={closeModal}>
						Abbrechen
					</Button>
					<Button variant="primary" disabled={saving}>
						{#if saving}
							Speichern...
						{:else}
							{editMode ? 'Aktualisieren' : 'Erstellen'}
						{/if}
					</Button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm}
	<div class="modal-overlay" onclick={cancelDelete}>
		<div class="modal modal-sm" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>Nachtrag löschen?</h2>
				<button class="close-btn" onclick={cancelDelete}>&times;</button>
			</div>
			<div class="modal-body">
				<p>Möchten Sie den Nachtrag <strong>"{deleteTarget?.titel || deleteTarget?.nachtrag_nr || 'Ohne Titel'}"</strong> wirklich löschen?</p>
				<p class="warning-text">Diese Aktion kann nicht rückgängig gemacht werden.</p>
			</div>
			<div class="modal-footer">
				<Button variant="secondary" onclick={cancelDelete}>
					Abbrechen
				</Button>
				<Button variant="primary" onclick={deleteNachtrag}>
					Löschen
				</Button>
			</div>
		</div>
	</div>
{/if}

<style>
	.nachtraege-page {
		max-width: 1000px;
		margin: 0 auto;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1.5rem;
	}

	.page-header h1 {
		font-size: 1.75rem;
		margin-bottom: 0.25rem;
	}

	.subtitle {
		color: var(--color-gray-500);
		margin: 0;
	}

	.error-banner {
		background: var(--color-error-light, #fef2f2);
		border: 1px solid var(--color-error, #ef4444);
		color: var(--color-error-dark, #991b1b);
		padding: 1rem;
		margin-bottom: 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.filter-row {
		display: flex;
		gap: 1rem;
		align-items: flex-end;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.filter-group label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-gray-600);
		text-transform: uppercase;
	}

	.filter-group select {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-gray-300);
		border-radius: 0;
		font-size: 0.9rem;
		min-width: 150px;
		background: white;
	}

	.filter-group select:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.stats-row {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	@media (max-width: 768px) {
		.stats-row {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	@media (max-width: 480px) {
		.stats-row {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	.stat-card {
		background: white;
		border: 1px solid var(--color-gray-200);
		padding: 1rem;
		text-align: center;
	}

	.stat-value {
		display: block;
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 0.25rem;
	}

	.stat-value.warning {
		color: var(--color-warning-dark);
	}

	.stat-value.success {
		color: var(--color-success-dark);
	}

	.stat-value.error {
		color: var(--color-error);
	}

	.stat-label {
		font-size: 0.8rem;
		color: var(--color-gray-500);
	}

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
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto 1rem;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.nachtraege-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.nachtrag-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.nachtrag-id {
		font-family: var(--font-family-mono);
		font-weight: 600;
		color: var(--color-gray-600);
	}

	.bv-nr {
		font-family: var(--font-family-mono);
		font-size: 0.8rem;
		color: var(--color-gray-500);
	}

	.action-buttons {
		display: flex;
		gap: 0.25rem;
	}

	.icon-btn {
		background: none;
		border: 1px solid var(--color-gray-300);
		padding: 0.35rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s;
	}

	.icon-btn:hover {
		background: var(--color-gray-100);
	}

	.icon-btn.edit:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.icon-btn.delete:hover {
		border-color: var(--color-error);
		color: var(--color-error);
	}

	.titel {
		font-size: 1.1rem;
		margin: 0 0 0.5rem 0;
	}

	.beschreibung {
		color: var(--color-gray-600);
		margin: 0 0 0.5rem 0;
	}

	.adresse {
		font-size: 0.85rem;
		color: var(--color-gray-500);
		margin: 0 0 1rem 0;
	}

	.nachtrag-meta {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-gray-100);
	}

	@media (max-width: 768px) {
		.nachtrag-meta {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	@media (max-width: 480px) {
		.nachtrag-meta {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	.meta-item {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.meta-label {
		font-size: 0.7rem;
		color: var(--color-gray-500);
		text-transform: uppercase;
	}

	.meta-value {
		font-size: 0.9rem;
		color: var(--color-gray-800);
	}

	.meta-value.budget {
		font-weight: 600;
		font-family: var(--font-family-mono);
	}

	.meta-value.marge {
		font-weight: 600;
		color: var(--color-success-dark);
	}

	.meta-value.marge small {
		font-weight: 400;
		color: var(--color-gray-500);
	}

	.quick-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--color-gray-100);
		flex-wrap: wrap;
	}

	.quick-label {
		font-size: 0.75rem;
		color: var(--color-gray-500);
		text-transform: uppercase;
	}

	.quick-btn {
		padding: 0.25rem 0.75rem;
		font-size: 0.8rem;
		border: 1px solid var(--color-gray-300);
		background: white;
		cursor: pointer;
		transition: all 0.15s;
	}

	.quick-btn:hover {
		background: var(--color-gray-50);
	}

	.quick-btn.in-pruefung:hover,
	.quick-btn.in-pruefung.active {
		border-color: var(--color-gray-600);
		background: var(--color-gray-100);
	}

	.quick-btn.genehmigt:hover,
	.quick-btn.genehmigt.active {
		border-color: var(--color-success);
		background: var(--color-success-light, #dcfce7);
		color: var(--color-success-dark);
	}

	.quick-btn.abgelehnt:hover,
	.quick-btn.abgelehnt.active {
		border-color: var(--color-error);
		background: var(--color-error-light, #fef2f2);
		color: var(--color-error-dark, #991b1b);
	}

	.fotos-hint {
		margin-top: 1rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--color-gray-100);
		font-size: 0.8rem;
		color: var(--color-gray-500);
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

	.modal {
		background: white;
		width: 100%;
		max-width: 600px;
		max-height: 90vh;
		overflow-y: auto;
		border: 1px solid var(--color-gray-200);
	}

	.modal.modal-sm {
		max-width: 400px;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid var(--color-gray-200);
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.25rem;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: var(--color-gray-500);
		line-height: 1;
	}

	.close-btn:hover {
		color: var(--color-gray-800);
	}

	.modal-body {
		padding: 1.5rem;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding-top: 1rem;
		margin-top: 1rem;
		border-top: 1px solid var(--color-gray-200);
	}

	.form-group {
		margin-bottom: 1rem;
	}

	.form-group label {
		display: block;
		font-size: 0.85rem;
		font-weight: 500;
		margin-bottom: 0.35rem;
		color: var(--color-gray-700);
	}

	.form-group input,
	.form-group select,
	.form-group textarea {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-gray-300);
		border-radius: 0;
		font-size: 0.9rem;
		font-family: inherit;
	}

	.form-group input:focus,
	.form-group select:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.form-group textarea {
		resize: vertical;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.form-row.three-col {
		grid-template-columns: 1fr 1fr 1fr;
	}

	@media (max-width: 480px) {
		.form-row,
		.form-row.three-col {
			grid-template-columns: 1fr;
		}
	}

	.marge-display {
		background: var(--color-gray-50);
		border: 1px solid var(--color-gray-200);
		padding: 0.75rem 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.marge-label {
		font-size: 0.85rem;
		color: var(--color-gray-600);
	}

	.marge-value {
		font-weight: 600;
		color: var(--color-success-dark);
		font-family: var(--font-family-mono);
	}

	.warning-text {
		color: var(--color-error);
		font-size: 0.9rem;
	}
</style>
