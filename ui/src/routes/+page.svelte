<script lang="ts">
	import { onMount } from 'svelte';
	import { KPICard, Card, Badge } from '$lib/components/ui';
	import { supabase } from '$lib/supabase';

	let { data } = $props();

	// User-Name für Begrüßung
	let userName = $derived(
		data.user?.user_metadata?.name ||
		data.user?.email?.split('@')[0] ||
		'Benutzer'
	);

	// Aktuelle Uhrzeit für Begrüßung
	let greeting = $derived(() => {
		const hour = new Date().getHours();
		if (hour < 12) return 'Guten Morgen';
		if (hour < 18) return 'Guten Tag';
		return 'Guten Abend';
	});

	// KPI State mit Svelte 5 Runes
	let kpis = $state({
		aktiveBVs: 0,
		offeneMaengel: 0,
		offeneNachtraege: 0,
		offeneBetrage: '0 €',
		loading: true
	});

	// Letzte Aktivitäten
	let aktivitaeten = $state<Array<{
		id: string;
		typ: 'Mangel' | 'Nachtrag' | 'Dokument';
		text: string;
		zeitpunkt: string;
		icon: string;
	}>>([]);

	// Dringende Aufgaben
	let aufgaben = $state<Array<{
		id: string;
		text: string;
		frist: string;
		prioritaet: 'hoch' | 'mittel' | 'normal';
	}>>([]);

	// Quicklinks
	const quicklinks = [
		{ icon: '🛒', label: 'Neue Bestellung', href: '/bestellung' },
		{ icon: '➕', label: 'Neuer Nachtrag', href: '/nachtraege/neu' },
		{ icon: '⚠️', label: 'Mangel melden', href: '/maengel/neu' },
		{ icon: '📊', label: 'LV-Export', href: '/lv-export' },
	];

	// Hilfsfunktion: Relative Zeit formatieren
	function formatRelativeTime(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'gerade eben';
		if (diffMins < 60) return `vor ${diffMins} Min.`;
		if (diffHours < 24) return `vor ${diffHours} Std.`;
		if (diffDays === 1) return 'gestern';
		if (diffDays < 7) return `vor ${diffDays} Tagen`;
		return date.toLocaleDateString('de-DE');
	}

	// Hilfsfunktion: Frist formatieren
	function formatFrist(dateString: string | null): string {
		if (!dateString) return 'keine Frist';
		const date = new Date(dateString);
		const now = new Date();
		const diffDays = Math.floor((date.getTime() - now.getTime()) / 86400000);

		if (diffDays < 0) return 'überfällig';
		if (diffDays === 0) return 'heute';
		if (diffDays === 1) return 'morgen';
		if (diffDays < 7) return `in ${diffDays} Tagen`;
		return date.toLocaleDateString('de-DE');
	}

	// Hilfsfunktion: Betrag formatieren
	function formatBetrag(betrag: number): string {
		return new Intl.NumberFormat('de-DE', {
			style: 'currency',
			currency: 'EUR',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(betrag);
	}

	// Daten laden
	async function loadDashboardData() {
		kpis.loading = true;

		try {
			// Parallele Abfragen für KPIs
			const [
				maengelResult,
				nachtraegeResult,
				bvsResult,
				offeneBetragResult
			] = await Promise.all([
				// Offene Mängel
				supabase
					.from('maengel_fertigstellung')
					.select('id', { count: 'exact', head: true })
					.not('status_mangel', 'in', '("Erledigt","Abgeschlossen","(2) Abgeschlossen")'),

				// Offene Nachträge
				supabase
					.from('nachtraege')
					.select('id', { count: 'exact', head: true })
					.not('status', 'in', '("Genehmigt","Abgelehnt","(1) Genehmigt","(2) Abgelehnt")'),

				// Aktive BVs (Phasen 0-4)
				supabase
					.from('monday_bauprozess')
					.select('id', { count: 'exact', head: true })
					.or('group_title.ilike.%(0)%,group_title.ilike.%(1)%,group_title.ilike.%(2)%,group_title.ilike.%(3)%,group_title.ilike.%(4)%'),

				// Offene Nachtragsbeträge (summe der offenen)
				supabase
					.from('nachtraege')
					.select('betrag_kunde_netto')
					.not('status', 'in', '("Genehmigt","Abgelehnt","(1) Genehmigt","(2) Abgelehnt")')
			]);

			// KPIs setzen
			kpis.offeneMaengel = maengelResult.count ?? 0;
			kpis.offeneNachtraege = nachtraegeResult.count ?? 0;
			kpis.aktiveBVs = bvsResult.count ?? 0;

			// Offene Beträge summieren
			const summe = offeneBetragResult.data?.reduce((acc, n) =>
				acc + (Number(n.betrag_kunde_netto) || 0), 0) ?? 0;
			kpis.offeneBetrage = formatBetrag(summe);

			// Letzte Aktivitäten laden (parallel)
			const [maengelAktiv, nachtraegeAktiv, dokumenteAktiv] = await Promise.all([
				supabase
					.from('maengel_fertigstellung')
					.select('mangel_nr, art_des_mangels, status_mangel, updated_at')
					.order('updated_at', { ascending: false, nullsFirst: false })
					.limit(3),

				supabase
					.from('nachtraege')
					.select('nachtrag_nr, titel, status, updated_at')
					.order('updated_at', { ascending: false, nullsFirst: false })
					.limit(3),

				supabase
					.from('dokumente')
					.select('dok_id, bezeichnung, datei_name, dok_typ, created_at')
					.order('created_at', { ascending: false, nullsFirst: false })
					.limit(3)
			]);

			// Aktivitäten zusammenführen und sortieren
			const alleAktivitaeten: typeof aktivitaeten = [];

			maengelAktiv.data?.forEach(m => {
				alleAktivitaeten.push({
					id: m.mangel_nr ?? '',
					typ: 'Mangel',
					text: `${m.art_des_mangels ?? 'Mangel'} ${m.mangel_nr ?? ''} - ${m.status_mangel ?? 'Neu'}`,
					zeitpunkt: m.updated_at ?? '',
					icon: '⚠️'
				});
			});

			nachtraegeAktiv.data?.forEach(n => {
				alleAktivitaeten.push({
					id: n.nachtrag_nr ?? '',
					typ: 'Nachtrag',
					text: `Nachtrag ${n.nachtrag_nr ?? ''}: ${n.titel ?? ''} - ${n.status ?? 'Offen'}`,
					zeitpunkt: n.updated_at ?? '',
					icon: '📝'
				});
			});

			dokumenteAktiv.data?.forEach(d => {
				alleAktivitaeten.push({
					id: d.dok_id ?? '',
					typ: 'Dokument',
					text: `${d.bezeichnung ?? d.datei_name ?? 'Dokument'} (${d.dok_typ ?? ''})`,
					zeitpunkt: d.created_at ?? '',
					icon: '📄'
				});
			});

			// Nach Datum sortieren und auf 5 begrenzen
			aktivitaeten = alleAktivitaeten
				.sort((a, b) => new Date(b.zeitpunkt).getTime() - new Date(a.zeitpunkt).getTime())
				.slice(0, 5);

			// Dringende Aufgaben laden
			const tasksResult = await supabase
				.from('tasks')
				.select('id, title, priority, due_date, status')
				.not('status', 'in', '("completed","Erledigt","done")')
				.order('due_date', { ascending: true, nullsFirst: false })
				.limit(5);

			aufgaben = (tasksResult.data ?? []).map(t => ({
				id: t.id,
				text: t.title ?? '',
				frist: formatFrist(t.due_date),
				prioritaet: (t.priority === 'hoch' || t.priority === 'high') ? 'hoch'
					: (t.priority === 'mittel' || t.priority === 'medium') ? 'mittel'
					: 'normal'
			}));

		} catch (error) {
			console.error('Fehler beim Laden der Dashboard-Daten:', error);
		} finally {
			kpis.loading = false;
		}
	}

	// Daten beim Mount laden
	onMount(() => {
		loadDashboardData();
	});
</script>

<div class="dashboard">
	<!-- Begrüßung -->
	<header class="dashboard-header">
		<h1>{greeting()}, {userName}</h1>
		<p class="subtitle">Hier ist deine Übersicht für heute</p>
	</header>

	<!-- KPI Cards -->
	<section class="kpi-section">
		{#if kpis.loading}
			<div class="kpi-loading">
				<span class="loading-spinner"></span>
				Lade Daten...
			</div>
		{:else}
			<KPICard
				label="Aktive BVs"
				value={kpis.aktiveBVs}
				icon="🏗️"
				color="blue"
				href="/bauvorhaben"
			/>
			<KPICard
				label="Offene Mängel"
				value={kpis.offeneMaengel}
				icon="⚠️"
				color="orange"
				href="/maengel"
			/>
			<KPICard
				label="Offene Nachträge"
				value={kpis.offeneNachtraege}
				icon="📝"
				color="purple"
				href="/nachtraege"
			/>
			<KPICard
				label="Offene Beträge"
				value={kpis.offeneBetrage}
				icon="💰"
				color="red"
				href="/finanzen"
			/>
		{/if}
	</section>

	<!-- Zwei-Spalten-Layout -->
	<div class="dashboard-grid">
		<!-- Dringende Aufgaben -->
		<Card>
			{#snippet header()}
				<div class="card-header-content">
					<span>🔥 Dringende Aufgaben</span>
					<a href="/aufgaben" class="view-all">Alle anzeigen →</a>
				</div>
			{/snippet}

			{#if aufgaben.length > 0}
				<ul class="task-list">
					{#each aufgaben as aufgabe (aufgabe.id)}
						<li class="task-item">
							<div class="task-content">
								<span class="task-text">{aufgabe.text}</span>
								<span class="task-frist">Frist: {aufgabe.frist}</span>
							</div>
							<Badge
								variant={aufgabe.prioritaet === 'hoch' ? 'error' : aufgabe.prioritaet === 'mittel' ? 'warning' : 'default'}
								size="sm"
							>
								{aufgabe.prioritaet}
							</Badge>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty-state">Keine dringenden Aufgaben</p>
			{/if}
		</Card>

		<!-- Quicklinks -->
		<Card>
			{#snippet header()}
				<span>⚡ Schnellzugriff</span>
			{/snippet}

			<div class="quicklinks">
				{#each quicklinks as link}
					<a href={link.href} class="quicklink">
						<span class="quicklink-icon">{link.icon}</span>
						<span class="quicklink-label">{link.label}</span>
					</a>
				{/each}
			</div>
		</Card>
	</div>

	<!-- Letzte Aktivitäten -->
	<Card>
		{#snippet header()}
			<span>📋 Letzte Aktivitäten</span>
		{/snippet}

		{#if aktivitaeten.length > 0}
			<ul class="activity-list">
				{#each aktivitaeten as aktivitaet (aktivitaet.id + aktivitaet.zeitpunkt)}
					<li class="activity-item">
						<span class="activity-icon">{aktivitaet.icon}</span>
						<div class="activity-content">
							<span class="activity-text">{aktivitaet.text}</span>
							<span class="activity-time">{formatRelativeTime(aktivitaet.zeitpunkt)}</span>
						</div>
						<Badge variant="default" size="sm">{aktivitaet.typ}</Badge>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty-state">Keine Aktivitäten vorhanden</p>
		{/if}
	</Card>
</div>

<style>
	.dashboard {
		max-width: 1200px;
		margin: 0 auto;
	}

	.dashboard-header {
		margin-bottom: 1.5rem;
	}

	.dashboard-header h1 {
		font-size: 1.75rem;
		font-weight: 600;
		color: var(--color-gray-900);
		margin-bottom: 0.25rem;
	}

	.subtitle {
		color: var(--color-gray-500);
		font-size: 0.95rem;
		margin: 0;
	}

	/* KPI Section */
	.kpi-section {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.kpi-loading {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 2rem;
		background: var(--color-gray-50);
		border-radius: 8px;
		color: var(--color-gray-500);
	}

	.loading-spinner {
		width: 20px;
		height: 20px;
		border: 2px solid var(--color-gray-200);
		border-top-color: var(--color-brand-medium);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	@media (max-width: 1024px) {
		.kpi-section {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 640px) {
		.kpi-section {
			grid-template-columns: 1fr;
		}
	}

	/* Dashboard Grid */
	.dashboard-grid {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	@media (max-width: 1024px) {
		.dashboard-grid {
			grid-template-columns: 1fr;
		}
	}

	/* Card Header */
	.card-header-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
	}

	.view-all {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--color-brand-medium);
	}

	.view-all:hover {
		color: var(--color-brand-dark);
	}

	/* Task List */
	.task-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.task-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--color-gray-100);
	}

	.task-item:last-child {
		border-bottom: none;
	}

	.task-content {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.task-text {
		font-size: 0.9rem;
		color: var(--color-gray-800);
	}

	.task-frist {
		font-size: 0.75rem;
		color: var(--color-gray-500);
	}

	.empty-state {
		text-align: center;
		color: var(--color-gray-400);
		padding: 2rem;
		margin: 0;
	}

	/* Quicklinks */
	.quicklinks {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.75rem;
	}

	.quicklink {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--color-gray-50);
		text-decoration: none;
		transition: all 0.15s ease;
	}

	.quicklink:hover {
		background: var(--color-gray-100);
	}

	.quicklink-icon {
		font-size: 1.25rem;
	}

	.quicklink-label {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--color-gray-700);
	}

	/* Activity List */
	.activity-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.activity-item {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--color-gray-100);
	}

	.activity-item:last-child {
		border-bottom: none;
	}

	.activity-icon {
		font-size: 1rem;
		padding-top: 0.1rem;
	}

	.activity-content {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		flex: 1;
	}

	.activity-text {
		font-size: 0.9rem;
		color: var(--color-gray-800);
	}

	.activity-time {
		font-size: 0.75rem;
		color: var(--color-gray-500);
	}
</style>
