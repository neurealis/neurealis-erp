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

	// Svelte 5 Runes
	let nachtraege = $state<Nachtrag[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Filter State
	let filterStatus = $state<string>('alle');
	let filterBV = $state<string>('');

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
				if (filterStatus === 'preis_eingegeben' && !statusLower.includes('preis eingegeben')) return false;
			}
			// BV-Filter
			if (filterBV && n.atbs_nummer !== filterBV) return false;
			return true;
		});
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
		return { offen, genehmigt, abgelehnt, summeGenehmigt, summeOffen };
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

	onMount(() => {
		loadNachtraege();
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
		// Extrahiere nur den Text-Teil ohne Präfix
		const match = status.match(/\(\d+\)\s*(.+)/);
		return match ? match[1] : status;
	}

	function getStatusVariant(status: string): 'success' | 'warning' | 'error' | 'default' {
		const statusLower = status.toLowerCase();
		if (statusLower.includes('genehmigt')) return 'success';
		if (statusLower.includes('offen')) return 'warning';
		if (statusLower.includes('abgelehnt')) return 'error';
		if (statusLower.includes('preis eingegeben')) return 'default';
		return 'default';
	}

	function getStatusNUVariant(statusNU: string | null): 'success' | 'warning' | 'error' | 'default' {
		if (!statusNU) return 'default';
		const statusLower = statusNU.toLowerCase();
		if (statusLower.includes('angenommen')) return 'success';
		if (statusLower.includes('abgelehnt')) return 'error';
		return 'warning';
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
		<Button variant="primary">
			+ Neuer Nachtrag
		</Button>
	</header>

	<!-- Error Message -->
	{#if error}
		<div class="error-banner">
			<span>Fehler: {error}</span>
			<Button variant="secondary" size="sm" onclick={() => loadNachtraege()}>
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
				<option value="preis_eingegeben">Preis eingegeben</option>
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
						<span class="bv-nr">{nachtrag.atbs_nummer}</span>
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
							<span class="meta-label">Gemeldet</span>
							<span class="meta-value">{nachtrag.gemeldet_von || '-'}</span>
						</div>
						<div class="meta-item">
							<span class="meta-label">Erstellt</span>
							<span class="meta-value">{formatDate(nachtrag.created_at)}</span>
						</div>
						{#if nachtrag.marge_prozent}
							<div class="meta-item">
								<span class="meta-label">Marge</span>
								<span class="meta-value">{nachtrag.marge_prozent}%</span>
							</div>
						{/if}
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
		border-radius: 4px;
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
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	@media (max-width: 640px) {
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
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-gray-100);
	}

	@media (max-width: 640px) {
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

	.fotos-hint {
		margin-top: 1rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--color-gray-100);
		font-size: 0.8rem;
		color: var(--color-gray-500);
	}
</style>
