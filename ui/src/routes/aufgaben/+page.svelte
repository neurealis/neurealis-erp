<script lang="ts">
	import { Card, Badge } from '$lib/components/ui';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';

	// Types
	interface Task {
		id: string;
		title: string;
		description: string | null;
		status: string | null;
		priority: string | null;
		due_date: string | null;
		completed_at: string | null;
		assigned_to: string | null;
		category: string | null;
		planner_bucket_name: string | null;
		percent_complete: number | null;
		created_at: string | null;
	}

	// State
	let tasks = $state<Task[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Filter-State
	let searchQuery = $state('');
	let selectedStatus = $state<string | null>(null);
	let selectedVerantwortlicher = $state<string | null>(null);
	let selectedBucket = $state<string | null>(null);
	let sortierung = $state<'faelligkeit_asc' | 'faelligkeit_desc' | 'erstellt_desc'>('faelligkeit_asc');

	// Status-Mapping (normalisiert verschiedene Formate)
	const STATUS_OFFEN = 'not_started';
	const STATUS_IN_BEARBEITUNG = 'in_progress';
	const STATUS_ERLEDIGT = 'completed';

	function normalizeStatus(status: string | null): string {
		if (!status) return STATUS_OFFEN;
		const s = status.toLowerCase().replace(/\s+/g, '_');
		if (s === 'notstarted' || s === 'not_started') return STATUS_OFFEN;
		if (s === 'inprogress' || s === 'in_progress') return STATUS_IN_BEARBEITUNG;
		if (s === 'completed') return STATUS_ERLEDIGT;
		return STATUS_OFFEN;
	}

	// Verantwortliche und Buckets für Filter
	let verantwortlicheListe = $derived([...new Set(tasks.map(t => t.assigned_to).filter(Boolean))].sort() as string[]);
	let bucketListe = $derived([...new Set(tasks.map(t => t.planner_bucket_name).filter(Boolean))].sort() as string[]);

	// Datum-Helfer
	function getToday(): Date {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		return today;
	}

	function getTomorrow(): Date {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		tomorrow.setHours(0, 0, 0, 0);
		return tomorrow;
	}

	function isToday(dateStr: string | null): boolean {
		if (!dateStr) return false;
		const date = new Date(dateStr);
		date.setHours(0, 0, 0, 0);
		const today = getToday();
		return date.getTime() === today.getTime();
	}

	function isTomorrow(dateStr: string | null): boolean {
		if (!dateStr) return false;
		const date = new Date(dateStr);
		date.setHours(0, 0, 0, 0);
		const tomorrow = getTomorrow();
		return date.getTime() === tomorrow.getTime();
	}

	function isOverdue(task: Task): boolean {
		if (!task.due_date) return false;
		if (normalizeStatus(task.status) === STATUS_ERLEDIGT) return false;
		const dueDate = new Date(task.due_date);
		dueDate.setHours(0, 0, 0, 0);
		return dueDate < getToday();
	}

	function isDueToday(task: Task): boolean {
		if (normalizeStatus(task.status) === STATUS_ERLEDIGT) return false;
		return isToday(task.due_date);
	}

	// Gefilterte Aufgaben
	let filteredTasks = $derived(() => {
		let result = tasks.filter(t => {
			// Textsuche
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				const match =
					(t.title?.toLowerCase() || '').includes(query) ||
					(t.description?.toLowerCase() || '').includes(query) ||
					(t.planner_bucket_name?.toLowerCase() || '').includes(query);
				if (!match) return false;
			}

			// Status-Filter
			if (selectedStatus) {
				if (normalizeStatus(t.status) !== selectedStatus) return false;
			}

			// Verantwortlicher-Filter
			if (selectedVerantwortlicher && t.assigned_to !== selectedVerantwortlicher) return false;

			// Bucket-Filter
			if (selectedBucket && t.planner_bucket_name !== selectedBucket) return false;

			return true;
		});

		// Sortierung
		result.sort((a, b) => {
			if (sortierung === 'faelligkeit_asc') {
				const dateA = a.due_date ? new Date(a.due_date).getTime() : Infinity;
				const dateB = b.due_date ? new Date(b.due_date).getTime() : Infinity;
				return dateA - dateB;
			} else if (sortierung === 'faelligkeit_desc') {
				const dateA = a.due_date ? new Date(a.due_date).getTime() : 0;
				const dateB = b.due_date ? new Date(b.due_date).getTime() : 0;
				return dateB - dateA;
			} else if (sortierung === 'erstellt_desc') {
				const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
				const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
				return dateB - dateA;
			}
			return 0;
		});

		return result;
	});

	// Statistiken
	let stats = $derived(() => {
		const offen = tasks.filter(t => normalizeStatus(t.status) === STATUS_OFFEN).length;
		const inArbeit = tasks.filter(t => normalizeStatus(t.status) === STATUS_IN_BEARBEITUNG).length;
		const erledigt = tasks.filter(t => normalizeStatus(t.status) === STATUS_ERLEDIGT).length;
		const heuteFaellig = tasks.filter(t => isDueToday(t)).length;
		const ueberfaellig = tasks.filter(t => isOverdue(t)).length;

		return {
			gesamt: tasks.length,
			offen,
			inArbeit,
			erledigt,
			heuteFaellig,
			ueberfaellig
		};
	});

	// Daten laden
	async function loadTasks() {
		loading = true;
		error = null;

		const { data, error: fetchError } = await supabase
			.from('tasks')
			.select('id, title, description, status, priority, due_date, completed_at, assigned_to, category, planner_bucket_name, percent_complete, created_at')
			.order('due_date', { ascending: true, nullsFirst: false });

		if (fetchError) {
			error = fetchError.message;
			console.error('Fehler beim Laden der Aufgaben:', fetchError);
		} else {
			tasks = data || [];
		}

		loading = false;
	}

	onMount(() => {
		loadTasks();
	});

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: '2-digit'
		});
	}

	function getRelativeDate(dateStr: string | null): string {
		if (!dateStr) return '-';

		if (isToday(dateStr)) return 'Heute';
		if (isTomorrow(dateStr)) return 'Morgen';

		const date = new Date(dateStr);
		date.setHours(0, 0, 0, 0);
		const today = getToday();
		const diffTime = date.getTime() - today.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

		if (diffDays < 0) {
			const absDays = Math.abs(diffDays);
			if (absDays === 1) return 'Gestern';
			return `${absDays} Tage überfällig`;
		}

		if (diffDays <= 7) {
			return `In ${diffDays} Tagen`;
		}

		return formatDate(dateStr);
	}

	function getStatusVariant(status: string | null): 'success' | 'warning' | 'error' | 'default' {
		const normalized = normalizeStatus(status);
		switch (normalized) {
			case STATUS_ERLEDIGT: return 'success';
			case STATUS_IN_BEARBEITUNG: return 'warning';
			case STATUS_OFFEN: return 'default';
			default: return 'default';
		}
	}

	function getStatusLabel(status: string | null): string {
		const normalized = normalizeStatus(status);
		switch (normalized) {
			case STATUS_ERLEDIGT: return 'Erledigt';
			case STATUS_IN_BEARBEITUNG: return 'In Bearbeitung';
			case STATUS_OFFEN: return 'Offen';
			default: return 'Unbekannt';
		}
	}

	function getPriorityVariant(priority: string | null): 'error' | 'warning' | 'default' {
		switch (priority?.toLowerCase()) {
			case 'high':
			case 'urgent': return 'error';
			case 'medium': return 'warning';
			default: return 'default';
		}
	}

	function clearFilters() {
		searchQuery = '';
		selectedStatus = null;
		selectedVerantwortlicher = null;
		selectedBucket = null;
	}

	// Filter-Funktionen für Stat-Karten
	function filterByStatus(status: string) {
		if (selectedStatus === status) {
			selectedStatus = null;
		} else {
			selectedStatus = status;
		}
	}

	let filterOverdue = $state(false);
	let filterToday = $state(false);

	function toggleOverdueFilter() {
		filterOverdue = !filterOverdue;
		filterToday = false;
	}

	function toggleTodayFilter() {
		filterToday = !filterToday;
		filterOverdue = false;
	}

	// Erweiterte Filter mit überfällig/heute
	let displayedTasks = $derived(() => {
		let result = filteredTasks();

		if (filterOverdue) {
			result = result.filter(t => isOverdue(t));
		}

		if (filterToday) {
			result = result.filter(t => isDueToday(t));
		}

		return result;
	});
</script>

<div class="aufgaben-page">
	<header class="page-header">
		<div class="header-content">
			<h1>Aufgaben</h1>
			<p class="subtitle">
				{#if loading}
					Lade Aufgaben...
				{:else}
					{displayedTasks().length} von {stats().gesamt} Aufgaben
				{/if}
			</p>
		</div>
		<div class="header-actions">
			<button class="refresh-btn" onclick={loadTasks} disabled={loading}>
				{loading ? 'Lädt...' : 'Aktualisieren'}
			</button>
		</div>
	</header>

	{#if error}
		<Card padding="md">
			<div class="error-message">
				<strong>Fehler:</strong> {error}
				<button onclick={loadTasks}>Erneut versuchen</button>
			</div>
		</Card>
	{/if}

	<!-- Statistik-Karten -->
	<div class="stats-row">
		<button
			class="stat-card"
			class:active={selectedStatus === STATUS_OFFEN}
			onclick={() => filterByStatus(STATUS_OFFEN)}
		>
			<span class="stat-value default">{stats().offen}</span>
			<span class="stat-label">Offen</span>
		</button>
		<button
			class="stat-card"
			class:active={filterToday}
			onclick={toggleTodayFilter}
		>
			<span class="stat-value warning">{stats().heuteFaellig}</span>
			<span class="stat-label">Heute fällig</span>
		</button>
		<button
			class="stat-card"
			class:active={filterOverdue}
			onclick={toggleOverdueFilter}
		>
			<span class="stat-value error">{stats().ueberfaellig}</span>
			<span class="stat-label">Überfällig</span>
		</button>
		<button
			class="stat-card"
			class:active={selectedStatus === STATUS_ERLEDIGT}
			onclick={() => filterByStatus(STATUS_ERLEDIGT)}
		>
			<span class="stat-value success">{stats().erledigt}</span>
			<span class="stat-label">Erledigt</span>
		</button>
	</div>

	<!-- Filter -->
	<Card padding="sm">
		<div class="filters">
			<div class="search-box">
				<span class="search-icon">&#128269;</span>
				<input
					type="search"
					placeholder="Aufgabe suchen..."
					bind:value={searchQuery}
					class="search-input"
				/>
			</div>

			<select bind:value={selectedVerantwortlicher} class="filter-select">
				<option value={null}>Alle Verantwortlichen</option>
				{#each verantwortlicheListe as person}
					<option value={person}>{person}</option>
				{/each}
			</select>

			<select bind:value={selectedBucket} class="filter-select">
				<option value={null}>Alle Kategorien</option>
				{#each bucketListe as bucket}
					<option value={bucket}>{bucket}</option>
				{/each}
			</select>

			<select bind:value={sortierung} class="filter-select">
				<option value="faelligkeit_asc">Fälligkeit (dringend zuerst)</option>
				<option value="faelligkeit_desc">Fälligkeit (späteste zuerst)</option>
				<option value="erstellt_desc">Neueste zuerst</option>
			</select>

			{#if searchQuery || selectedStatus || selectedVerantwortlicher || selectedBucket || filterOverdue || filterToday}
				<button class="clear-btn" onclick={() => { clearFilters(); filterOverdue = false; filterToday = false; }}>
					Filter zurücksetzen
				</button>
			{/if}
		</div>
	</Card>

	<!-- Aufgaben-Liste -->
	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Lade Aufgaben aus Supabase...</p>
		</div>
	{:else}
		<div class="tasks-list">
			{#each displayedTasks() as task}
				<div class="task-card" class:overdue={isOverdue(task)} class:completed={normalizeStatus(task.status) === STATUS_ERLEDIGT}>
					<div class="card-header">
						<div class="header-left">
							<Badge variant={getStatusVariant(task.status)} size="sm">
								{getStatusLabel(task.status)}
							</Badge>
							{#if isOverdue(task)}
								<Badge variant="error" size="sm">Überfällig</Badge>
							{:else if isDueToday(task)}
								<Badge variant="warning" size="sm">Heute</Badge>
							{/if}
							{#if task.priority && task.priority !== 'normal'}
								<Badge variant={getPriorityVariant(task.priority)} size="sm">
									{task.priority === 'high' ? 'Hoch' : task.priority === 'urgent' ? 'Dringend' : task.priority}
								</Badge>
							{/if}
						</div>
						{#if task.planner_bucket_name}
							<span class="bucket-name">{task.planner_bucket_name}</span>
						{/if}
					</div>

					<div class="card-body">
						<h3 class="task-title">{task.title}</h3>
						{#if task.description}
							<p class="task-description">{task.description}</p>
						{/if}

						<div class="card-meta">
							<div class="meta-item">
								<span class="meta-label">Fällig</span>
								<span class="meta-value" class:overdue={isOverdue(task)}>
									{getRelativeDate(task.due_date)}
								</span>
							</div>
							{#if task.assigned_to}
								<div class="meta-item">
									<span class="meta-label">Verantwortlich</span>
									<span class="meta-value">{task.assigned_to}</span>
								</div>
							{/if}
							{#if task.percent_complete !== null && task.percent_complete > 0}
								<div class="meta-item">
									<span class="meta-label">Fortschritt</span>
									<span class="meta-value">{task.percent_complete}%</span>
								</div>
							{/if}
						</div>
					</div>
				</div>
			{/each}

			{#if displayedTasks().length === 0}
				<div class="empty-state">
					{#if tasks.length === 0}
						<p>Noch keine Aufgaben vorhanden</p>
					{:else}
						<p>Keine Aufgaben gefunden</p>
						<button onclick={() => { clearFilters(); filterOverdue = false; filterToday = false; }}>Filter zurücksetzen</button>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.aufgaben-page {
		max-width: 1200px;
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
		font-size: 0.9rem;
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

	.error-message {
		color: var(--color-error);
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.error-message button {
		padding: 0.25rem 0.75rem;
		border: 1px solid var(--color-error);
		background: white;
		color: var(--color-error);
		cursor: pointer;
	}

	/* Stats Row */
	.stats-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin-bottom: 1rem;
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
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.stat-card:hover {
		border-color: var(--color-gray-300);
	}

	.stat-card.active {
		border-color: var(--color-brand-medium);
		background: var(--color-brand-bg);
	}

	.stat-value {
		display: block;
		font-size: 1.75rem;
		font-weight: 700;
		line-height: 1;
		margin-bottom: 0.25rem;
	}

	.stat-value.default {
		color: var(--color-gray-600);
	}

	.stat-value.error {
		color: var(--color-error);
	}

	.stat-value.warning {
		color: var(--color-warning-dark);
	}

	.stat-value.success {
		color: var(--color-success-dark);
	}

	.stat-label {
		font-size: 0.8rem;
		color: var(--color-gray-500);
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

	/* Loading State */
	.loading-state {
		text-align: center;
		padding: 3rem 2rem;
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

	/* Tasks Liste */
	.tasks-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.task-card {
		display: block;
		background: white;
		border: 1px solid var(--color-gray-200);
		transition: all 0.15s ease;
	}

	.task-card:hover {
		border-color: var(--color-gray-300);
		box-shadow: var(--shadow-md);
	}

	.task-card.overdue {
		border-left: 3px solid var(--color-error);
	}

	.task-card.completed {
		opacity: 0.7;
		background: var(--color-gray-50);
	}

	.task-card .card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-gray-100);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.bucket-name {
		font-size: 0.75rem;
		color: var(--color-gray-500);
		background: var(--color-gray-100);
		padding: 0.2rem 0.5rem;
		border-radius: 2px;
	}

	.task-card .card-body {
		padding: 1rem;
	}

	.task-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-gray-800);
		margin: 0 0 0.5rem 0;
	}

	.task-description {
		font-size: 0.85rem;
		color: var(--color-gray-600);
		margin: 0 0 1rem 0;
		line-height: 1.4;
	}

	.card-meta {
		display: flex;
		gap: 2rem;
		flex-wrap: wrap;
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
		font-size: 0.85rem;
		color: var(--color-gray-800);
	}

	.meta-value.overdue {
		color: var(--color-error);
		font-weight: 600;
	}

	/* Empty State */
	.empty-state {
		text-align: center;
		padding: 3rem 2rem;
		color: var(--color-gray-500);
	}

	.empty-state p {
		margin-bottom: 1rem;
	}

	.empty-state button {
		background: none;
		border: 1px solid var(--color-gray-300);
		padding: 0.5rem 1rem;
		cursor: pointer;
	}

	@media (max-width: 640px) {
		.page-header {
			flex-direction: column;
			gap: 1rem;
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

		.card-meta {
			flex-direction: column;
			gap: 0.75rem;
		}
	}
</style>
