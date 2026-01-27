<script lang="ts">
	import { Card, Badge, Button, KPICard } from '$lib/components/ui';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';

	// Types
	interface Lead {
		id: string;
		lead_nr: number;
		name: string;
		firma: string | null;
		email: string | null;
		telefon: string | null;
		status: 'neu' | 'kontaktiert' | 'qualifiziert' | 'angebot' | 'gewonnen' | 'verloren';
		quelle: string | null;
		wert: number | null;
		notizen: string | null;
		created_at: string;
		letzter_kontakt: string | null;
		naechste_aktion: string | null;
		naechste_aktion_datum: string | null;
	}

	// Status-Konfiguration
	const statusConfig: Record<Lead['status'], { label: string; variant: 'default' | 'info' | 'warning' | 'success' | 'error'; color: string }> = {
		neu: { label: 'Neu', variant: 'info', color: '#3b82f6' },
		kontaktiert: { label: 'Kontaktiert', variant: 'default', color: '#6b7280' },
		qualifiziert: { label: 'Qualifiziert', variant: 'warning', color: '#f59e0b' },
		angebot: { label: 'Angebot', variant: 'warning', color: '#8b5cf6' },
		gewonnen: { label: 'Gewonnen', variant: 'success', color: '#10b981' },
		verloren: { label: 'Verloren', variant: 'error', color: '#ef4444' }
	};

	const statusOrder: Lead['status'][] = ['neu', 'kontaktiert', 'qualifiziert', 'angebot', 'gewonnen', 'verloren'];

	// Svelte 5 Runes
	let leads = $state<Lead[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Filter State
	let filterStatus = $state<string>('alle');
	let filterQuelle = $state<string>('');
	let viewMode = $state<'kanban' | 'liste'>('kanban');

	// Unique Quellen für Filter-Dropdown
	let uniqueQuellen = $derived(() => {
		const quellen = [...new Set(leads.map(l => l.quelle).filter(Boolean))];
		return quellen.sort() as string[];
	});

	// Gefilterte Leads
	let filteredLeads = $derived(() => {
		return leads.filter(l => {
			if (filterStatus !== 'alle' && l.status !== filterStatus) return false;
			if (filterQuelle && l.quelle !== filterQuelle) return false;
			return true;
		});
	});

	// Leads nach Status gruppiert (für Kanban)
	let leadsByStatus = $derived(() => {
		const grouped: Record<Lead['status'], Lead[]> = {
			neu: [],
			kontaktiert: [],
			qualifiziert: [],
			angebot: [],
			gewonnen: [],
			verloren: []
		};
		for (const lead of filteredLeads()) {
			grouped[lead.status].push(lead);
		}
		return grouped;
	});

	// Statistiken
	let stats = $derived(() => {
		const total = leads.length;
		const offen = leads.filter(l => !['gewonnen', 'verloren'].includes(l.status)).length;
		const gewonnen = leads.filter(l => l.status === 'gewonnen').length;
		const verloren = leads.filter(l => l.status === 'verloren').length;

		const wertOffen = leads
			.filter(l => !['gewonnen', 'verloren'].includes(l.status))
			.reduce((sum, l) => sum + (l.wert || 0), 0);
		const wertGewonnen = leads
			.filter(l => l.status === 'gewonnen')
			.reduce((sum, l) => sum + (l.wert || 0), 0);

		const conversionRate = total > 0 ? Math.round((gewonnen / total) * 100) : 0;

		return { total, offen, gewonnen, verloren, wertOffen, wertGewonnen, conversionRate };
	});

	// Daten laden
	async function loadLeads() {
		loading = true;
		error = null;

		const { data, error: err } = await supabase
			.from('leads')
			.select('*')
			.order('created_at', { ascending: false });

		if (err) {
			error = err.message;
			loading = false;
			return;
		}

		leads = data || [];
		loading = false;
	}

	onMount(() => {
		loadLeads();
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

	function getStatusVariant(status: Lead['status']): 'default' | 'info' | 'warning' | 'success' | 'error' {
		return statusConfig[status]?.variant || 'default';
	}
</script>

<div class="leads-page">
	<header class="page-header">
		<div class="header-content">
			<h1>Leads</h1>
			<p class="subtitle">
				{#if loading}
					Lade Leads...
				{:else}
					{filteredLeads().length} von {leads.length} Leads
				{/if}
			</p>
		</div>
		<div class="header-actions">
			<div class="view-toggle">
				<button
					class="toggle-btn"
					class:active={viewMode === 'kanban'}
					onclick={() => viewMode = 'kanban'}
				>
					Kanban
				</button>
				<button
					class="toggle-btn"
					class:active={viewMode === 'liste'}
					onclick={() => viewMode = 'liste'}
				>
					Liste
				</button>
			</div>
			<Button variant="primary">
				+ Neuer Lead
			</Button>
		</div>
	</header>

	<!-- Error Message -->
	{#if error}
		<div class="error-banner">
			<span>Fehler: {error}</span>
			<Button variant="secondary" size="sm" onclick={() => loadLeads()}>
				Erneut versuchen
			</Button>
		</div>
	{/if}

	<!-- KPI Cards -->
	<div class="kpi-row">
		<KPICard
			label="Offene Leads"
			value={stats().offen}
			subvalue={formatCurrency(stats().wertOffen)}
			color="blue"
		/>
		<KPICard
			label="Gewonnen"
			value={stats().gewonnen}
			subvalue={formatCurrency(stats().wertGewonnen)}
			color="green"
		/>
		<KPICard
			label="Verloren"
			value={stats().verloren}
			color="red"
		/>
		<KPICard
			label="Conversion Rate"
			value="{stats().conversionRate}%"
			color="purple"
		/>
	</div>

	<!-- Filter -->
	<div class="filter-row">
		<div class="filter-group">
			<label for="filter-status">Status</label>
			<select id="filter-status" bind:value={filterStatus}>
				<option value="alle">Alle Status</option>
				{#each statusOrder as status}
					<option value={status}>{statusConfig[status].label}</option>
				{/each}
			</select>
		</div>
		<div class="filter-group">
			<label for="filter-quelle">Quelle</label>
			<select id="filter-quelle" bind:value={filterQuelle}>
				<option value="">Alle Quellen</option>
				{#each uniqueQuellen() as quelle}
					<option value={quelle}>{quelle}</option>
				{/each}
			</select>
		</div>
		{#if filterStatus !== 'alle' || filterQuelle}
			<Button variant="secondary" size="sm" onclick={() => { filterStatus = 'alle'; filterQuelle = ''; }}>
				Filter zurücksetzen
			</Button>
		{/if}
	</div>

	<!-- Loading State -->
	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Lade Leads...</p>
		</div>
	{:else if filteredLeads().length === 0}
		<div class="empty-state">
			<p>Keine Leads gefunden.</p>
			{#if filterStatus !== 'alle' || filterQuelle}
				<Button variant="secondary" onclick={() => { filterStatus = 'alle'; filterQuelle = ''; }}>
					Filter zurücksetzen
				</Button>
			{/if}
		</div>
	{:else if viewMode === 'kanban'}
		<!-- Kanban View -->
		<div class="kanban-board">
			{#each statusOrder as status}
				{@const statusLeads = leadsByStatus()[status]}
				{@const columnWert = statusLeads.reduce((sum, l) => sum + (l.wert || 0), 0)}
				<div class="kanban-column">
					<div class="column-header" style="border-top-color: {statusConfig[status].color}">
						<span class="column-title">{statusConfig[status].label}</span>
						<span class="column-count">{statusLeads.length}</span>
					</div>
					{#if columnWert > 0}
						<div class="column-value">{formatCurrency(columnWert)}</div>
					{/if}
					<div class="column-cards">
						{#each statusLeads as lead}
							<div class="lead-card">
								<div class="lead-header">
									<span class="lead-nr">#{lead.lead_nr}</span>
									{#if lead.quelle}
										<span class="lead-quelle">{lead.quelle}</span>
									{/if}
								</div>
								<h4 class="lead-name">{lead.name}</h4>
								{#if lead.firma}
									<p class="lead-firma">{lead.firma}</p>
								{/if}
								{#if lead.wert}
									<p class="lead-wert">{formatCurrency(lead.wert)}</p>
								{/if}
								{#if lead.naechste_aktion}
									<div class="lead-action">
										<span class="action-label">Nächste Aktion:</span>
										<span class="action-text">{lead.naechste_aktion}</span>
										{#if lead.naechste_aktion_datum}
											<span class="action-date">{formatDate(lead.naechste_aktion_datum)}</span>
										{/if}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<!-- Liste View -->
		<div class="leads-list">
			{#each filteredLeads() as lead}
				<Card>
					<div class="list-card-header">
						<div class="header-left">
							<span class="lead-nr">#{lead.lead_nr}</span>
							<Badge variant={getStatusVariant(lead.status)} size="sm">
								{statusConfig[lead.status].label}
							</Badge>
							{#if lead.quelle}
								<Badge variant="default" size="sm">{lead.quelle}</Badge>
							{/if}
						</div>
						{#if lead.wert}
							<span class="lead-wert-lg">{formatCurrency(lead.wert)}</span>
						{/if}
					</div>

					<h3 class="lead-name-lg">{lead.name}</h3>
					{#if lead.firma}
						<p class="lead-firma-lg">{lead.firma}</p>
					{/if}

					<div class="lead-meta">
						<div class="meta-item">
							<span class="meta-label">E-Mail</span>
							<span class="meta-value">{lead.email || '-'}</span>
						</div>
						<div class="meta-item">
							<span class="meta-label">Telefon</span>
							<span class="meta-value">{lead.telefon || '-'}</span>
						</div>
						<div class="meta-item">
							<span class="meta-label">Erstellt</span>
							<span class="meta-value">{formatDate(lead.created_at)}</span>
						</div>
						{#if lead.naechste_aktion}
							<div class="meta-item">
								<span class="meta-label">Nächste Aktion</span>
								<span class="meta-value">{lead.naechste_aktion}</span>
							</div>
						{/if}
					</div>

					{#if lead.notizen}
						<p class="lead-notizen">{lead.notizen}</p>
					{/if}
				</Card>
			{/each}
		</div>
	{/if}
</div>

<style>
	.leads-page {
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
		gap: 1rem;
		align-items: center;
	}

	.view-toggle {
		display: flex;
		border: 1px solid var(--color-gray-300);
		border-radius: 4px;
		overflow: hidden;
	}

	.toggle-btn {
		padding: 0.5rem 1rem;
		border: none;
		background: white;
		cursor: pointer;
		font-size: 0.85rem;
		transition: all 0.15s ease;
	}

	.toggle-btn:not(:last-child) {
		border-right: 1px solid var(--color-gray-300);
	}

	.toggle-btn.active {
		background: var(--color-primary);
		color: white;
	}

	.toggle-btn:hover:not(.active) {
		background: var(--color-gray-50);
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

	/* Kanban View */
	.kanban-board {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 1rem;
		overflow-x: auto;
		padding-bottom: 1rem;
	}

	@media (max-width: 1200px) {
		.kanban-board {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	@media (max-width: 768px) {
		.kanban-board {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 500px) {
		.kanban-board {
			grid-template-columns: 1fr;
		}
	}

	.kanban-column {
		background: var(--color-gray-50);
		border-radius: 6px;
		min-height: 400px;
	}

	.column-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		border-top: 3px solid var(--color-gray-400);
		background: white;
		border-radius: 6px 6px 0 0;
	}

	.column-title {
		font-weight: 600;
		font-size: 0.9rem;
	}

	.column-count {
		background: var(--color-gray-200);
		color: var(--color-gray-700);
		padding: 0.15rem 0.5rem;
		border-radius: 10px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.column-value {
		padding: 0.5rem 1rem;
		font-size: 0.8rem;
		color: var(--color-gray-600);
		background: white;
		border-bottom: 1px solid var(--color-gray-100);
	}

	.column-cards {
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.lead-card {
		background: white;
		border: 1px solid var(--color-gray-200);
		border-radius: 4px;
		padding: 0.75rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.lead-card:hover {
		border-color: var(--color-gray-300);
		box-shadow: var(--shadow-sm);
	}

	.lead-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.lead-nr {
		font-family: var(--font-family-mono);
		font-size: 0.75rem;
		color: var(--color-gray-500);
	}

	.lead-quelle {
		font-size: 0.65rem;
		background: var(--color-gray-100);
		color: var(--color-gray-600);
		padding: 0.1rem 0.4rem;
		border-radius: 3px;
	}

	.lead-name {
		font-size: 0.9rem;
		margin: 0 0 0.25rem 0;
		font-weight: 600;
	}

	.lead-firma {
		font-size: 0.8rem;
		color: var(--color-gray-600);
		margin: 0 0 0.5rem 0;
	}

	.lead-wert {
		font-family: var(--font-family-mono);
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-primary-600);
		margin: 0;
	}

	.lead-action {
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--color-gray-100);
		font-size: 0.75rem;
	}

	.action-label {
		color: var(--color-gray-500);
		display: block;
	}

	.action-text {
		color: var(--color-gray-700);
	}

	.action-date {
		display: block;
		color: var(--color-warning-dark);
		margin-top: 0.15rem;
	}

	/* Liste View */
	.leads-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.list-card-header {
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

	.lead-wert-lg {
		font-family: var(--font-family-mono);
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--color-primary-600);
	}

	.lead-name-lg {
		font-size: 1.1rem;
		margin: 0 0 0.25rem 0;
	}

	.lead-firma-lg {
		color: var(--color-gray-600);
		margin: 0 0 1rem 0;
	}

	.lead-meta {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-gray-100);
	}

	@media (max-width: 768px) {
		.lead-meta {
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

	.lead-notizen {
		margin-top: 1rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--color-gray-100);
		font-size: 0.85rem;
		color: var(--color-gray-600);
		font-style: italic;
	}
</style>
