<script lang="ts">
	import { Card, Badge } from '$lib/components/ui';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';

	// Types
	interface BauvorhabenEvent {
		id: string;
		name: string;
		kunde: string;
		adresse: string;
		lage: string;
		phase: number;
		phaseLabel: string;
		startDate: Date | null;
		endDate: Date | null;
		bauleiter: string | null;
	}

	// State
	let events = $state<BauvorhabenEvent[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Kalender-State
	let currentDate = $state(new Date());
	let selectedPhase = $state<number | null>(null);

	// Phasen für Filter
	const phasen = [
		{ value: 0, label: '(0) Bedarfsanalyse' },
		{ value: 1, label: '(1) Angebot' },
		{ value: 2, label: '(2) Auftrag' },
		{ value: 3, label: '(3) Vorbereitung' },
		{ value: 4, label: '(4) Bauphase' },
		{ value: 5, label: '(5) Rechnungsstellung' },
		{ value: 6, label: '(6) Projekt abgeschlossen' },
	];

	// Wochentage (Montag-Sonntag)
	const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

	// Parse Phase aus group_title
	function parsePhase(groupTitle: string): { phase: number; label: string } {
		const match = groupTitle.match(/^\((\d+)\)/);
		if (match) {
			return { phase: parseInt(match[1]), label: groupTitle };
		}
		return { phase: -1, label: groupTitle };
	}

	// Parse Name: "Kunde | Adresse | Lage | Bauleiter"
	function parseName(name: string): { kunde: string; adresse: string; lage: string; bauleiter: string | null } {
		let parts = name.split('|').map(p => p.trim());
		if (parts.length >= 3) {
			return {
				kunde: parts[0],
				adresse: parts[1],
				lage: parts[2],
				bauleiter: parts[3] || null
			};
		}
		parts = name.split(' - ').map(p => p.trim());
		if (parts.length >= 3) {
			return {
				kunde: parts[0],
				adresse: parts[1],
				lage: parts[2],
				bauleiter: null
			};
		}
		return {
			kunde: parts[0] || name,
			adresse: parts[1] || '',
			lage: parts[2] || '',
			bauleiter: null
		};
	}

	// Parse Datum aus Monday column_values
	function parseDate(dateValue: string | null): Date | null {
		if (!dateValue) return null;
		try {
			const parsed = JSON.parse(dateValue);
			if (parsed?.text && parsed.text !== '') {
				// Format: "2026-03-17" oder "2025-06-26 09:00"
				const dateStr = parsed.text.split(' ')[0];
				return new Date(dateStr);
			}
		} catch {
			// Ignorieren
		}
		return null;
	}

	// Daten laden
	async function loadEvents() {
		loading = true;
		error = null;

		try {
			const { data, error: dbError } = await supabase
				.from('monday_bauprozess')
				.select('id, name, group_title, column_values')
				.order('name');

			if (dbError) throw dbError;

			events = (data || []).map(item => {
				const { phase, label: phaseLabel } = parsePhase(item.group_title || '');
				const { kunde, adresse, lage, bauleiter } = parseName(item.name || '');

				// Extrahiere Datums-Felder aus column_values
				let startDate: Date | null = null;
				let endDate: Date | null = null;

				if (item.column_values) {
					// date_mknaf1e2 = Baustart
					const startField = item.column_values['date_mknaf1e2'];
					if (startField) {
						startDate = parseDate(typeof startField === 'string' ? startField : JSON.stringify(startField));
					}

					// date_mkna9vad = Bauende
					const endField = item.column_values['date_mkna9vad'];
					if (endField) {
						endDate = parseDate(typeof endField === 'string' ? endField : JSON.stringify(endField));
					}
				}

				return {
					id: item.id,
					name: item.name,
					kunde,
					adresse,
					lage,
					phase,
					phaseLabel,
					startDate,
					endDate,
					bauleiter
				};
			}).filter(e => e.startDate || e.endDate); // Nur Events mit Datum
		} catch (e) {
			error = e instanceof Error ? e.message : 'Fehler beim Laden der Daten';
			console.error('Fehler:', e);
		} finally {
			loading = false;
		}
	}

	// Kalender-Berechnungen
	let currentMonth = $derived(currentDate.getMonth());
	let currentYear = $derived(currentDate.getFullYear());

	let monthName = $derived(
		currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
	);

	// Erster Tag des Monats (0 = Sonntag, 1 = Montag, ...)
	let firstDayOfMonth = $derived(() => {
		const first = new Date(currentYear, currentMonth, 1);
		// Konvertiere zu Montag-Start (0 = Mo, 6 = So)
		return (first.getDay() + 6) % 7;
	});

	// Anzahl Tage im Monat
	let daysInMonth = $derived(
		new Date(currentYear, currentMonth + 1, 0).getDate()
	);

	// Tage des vorherigen Monats (für Padding)
	let daysInPrevMonth = $derived(
		new Date(currentYear, currentMonth, 0).getDate()
	);

	// Kalender-Grid generieren
	let calendarDays = $derived(() => {
		const days: Array<{ day: number; isCurrentMonth: boolean; date: Date }> = [];
		const startOffset = firstDayOfMonth();

		// Vormonat
		for (let i = startOffset - 1; i >= 0; i--) {
			const day = daysInPrevMonth - i;
			days.push({
				day,
				isCurrentMonth: false,
				date: new Date(currentYear, currentMonth - 1, day)
			});
		}

		// Aktueller Monat
		for (let day = 1; day <= daysInMonth; day++) {
			days.push({
				day,
				isCurrentMonth: true,
				date: new Date(currentYear, currentMonth, day)
			});
		}

		// Nächster Monat (auf 6 Wochen auffüllen)
		const remaining = 42 - days.length;
		for (let day = 1; day <= remaining; day++) {
			days.push({
				day,
				isCurrentMonth: false,
				date: new Date(currentYear, currentMonth + 1, day)
			});
		}

		return days;
	});

	// Gefilterte Events
	let filteredEvents = $derived(() => {
		return events.filter(e => {
			if (selectedPhase !== null && e.phase !== selectedPhase) {
				return false;
			}
			return true;
		});
	});

	// Events für einen bestimmten Tag
	function getEventsForDay(date: Date): BauvorhabenEvent[] {
		const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
		const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);

		return filteredEvents().filter(event => {
			const start = event.startDate || event.endDate;
			const end = event.endDate || event.startDate;
			if (!start || !end) return false;

			// Event ist an diesem Tag wenn: Start <= Tag && End >= Tag
			return start <= dayEnd && end >= dayStart;
		});
	}

	// Prüfen ob Event an diesem Tag startet
	function isEventStart(event: BauvorhabenEvent, date: Date): boolean {
		if (!event.startDate) return false;
		return isSameDay(event.startDate, date);
	}

	// Prüfen ob Event an diesem Tag endet
	function isEventEnd(event: BauvorhabenEvent, date: Date): boolean {
		if (!event.endDate) return false;
		return isSameDay(event.endDate, date);
	}

	// Hilfsfunktion: Gleicher Tag?
	function isSameDay(d1: Date, d2: Date): boolean {
		return d1.getFullYear() === d2.getFullYear() &&
			d1.getMonth() === d2.getMonth() &&
			d1.getDate() === d2.getDate();
	}

	// Navigation
	function previousMonth() {
		currentDate = new Date(currentYear, currentMonth - 1, 1);
	}

	function nextMonth() {
		currentDate = new Date(currentYear, currentMonth + 1, 1);
	}

	function goToToday() {
		currentDate = new Date();
	}

	// Heute prüfen
	function isToday(date: Date): boolean {
		const today = new Date();
		return isSameDay(date, today);
	}

	// Phase-basierte Farbe
	function getPhaseColor(phase: number): string {
		const colors: Record<number, string> = {
			0: 'var(--status-0-bg)',
			1: 'var(--status-1-bg)',
			2: 'var(--status-2-bg)',
			3: 'var(--status-3-bg)',
			4: 'var(--status-4-bg)',
			5: 'var(--status-5-bg)',
			6: 'var(--status-6-bg)',
			7: 'var(--status-7-bg)',
		};
		return colors[phase] || 'var(--color-gray-100)';
	}

	function getPhaseTextColor(phase: number): string {
		const colors: Record<number, string> = {
			0: 'var(--status-0-text)',
			1: 'var(--status-1-text)',
			2: 'var(--status-2-text)',
			3: 'var(--status-3-text)',
			4: 'var(--status-4-text)',
			5: 'var(--status-5-text)',
			6: 'var(--status-6-text)',
			7: 'var(--status-7-text)',
		};
		return colors[phase] || 'var(--color-gray-700)';
	}

	// Formatierung
	function formatDateRange(start: Date | null, end: Date | null): string {
		const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' };
		if (start && end) {
			return `${start.toLocaleDateString('de-DE', opts)} - ${end.toLocaleDateString('de-DE', opts)}`;
		}
		if (start) return `Ab ${start.toLocaleDateString('de-DE', opts)}`;
		if (end) return `Bis ${end.toLocaleDateString('de-DE', opts)}`;
		return '';
	}

	// Event-Detail Modal
	let selectedEvent = $state<BauvorhabenEvent | null>(null);

	function showEventDetail(event: BauvorhabenEvent) {
		selectedEvent = event;
	}

	function closeModal() {
		selectedEvent = null;
	}

	onMount(() => {
		loadEvents();
	});
</script>

<div class="kalender-page">
	<header class="page-header">
		<div class="header-content">
			<h1>Kalender</h1>
			{#if !loading}
				<p class="subtitle">{filteredEvents().length} Bauvorhaben mit Terminen</p>
			{/if}
		</div>
	</header>

	<!-- Filter & Navigation -->
	<Card padding="sm">
		<div class="controls">
			<div class="nav-controls">
				<button class="nav-btn" onclick={previousMonth} aria-label="Vorheriger Monat">
					&#8249;
				</button>
				<button class="today-btn" onclick={goToToday}>
					Heute
				</button>
				<button class="nav-btn" onclick={nextMonth} aria-label="Naechster Monat">
					&#8250;
				</button>
				<span class="month-label">{monthName}</span>
			</div>

			<select
				bind:value={selectedPhase}
				class="filter-select"
			>
				<option value={null}>Alle Phasen</option>
				{#each phasen as phase}
					<option value={phase.value}>{phase.label}</option>
				{/each}
			</select>
		</div>
	</Card>

	{#if loading}
		<div class="loading-state">
			<p>Lade Termine...</p>
		</div>
	{:else if error}
		<div class="error-state">
			<p>Fehler: {error}</p>
			<button onclick={loadEvents}>Erneut versuchen</button>
		</div>
	{:else}
		<!-- Kalender Grid -->
		<Card padding="none">
			<div class="calendar">
				<!-- Wochentage Header -->
				<div class="weekdays">
					{#each weekdays as day}
						<div class="weekday">{day}</div>
					{/each}
				</div>

				<!-- Tage Grid -->
				<div class="days-grid">
					{#each calendarDays() as { day, isCurrentMonth, date }}
						{@const dayEvents = getEventsForDay(date)}
						<div
							class="day-cell"
							class:other-month={!isCurrentMonth}
							class:today={isToday(date)}
							class:has-events={dayEvents.length > 0}
						>
							<span class="day-number">{day}</span>

							{#if dayEvents.length > 0}
								<div class="day-events">
									{#each dayEvents.slice(0, 3) as event}
										<button
											class="event-bar"
											style="background: {getPhaseColor(event.phase)}; color: {getPhaseTextColor(event.phase)};"
											onclick={() => showEventDetail(event)}
											class:event-start={isEventStart(event, date)}
											class:event-end={isEventEnd(event, date)}
										>
											{#if isEventStart(event, date) || day === 1 || (date.getDay() === 1)}
												<span class="event-label">{event.adresse || event.kunde}</span>
											{/if}
										</button>
									{/each}
									{#if dayEvents.length > 3}
										<span class="more-events">+{dayEvents.length - 3}</span>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</Card>

		<!-- Legende -->
		<Card padding="sm">
			<div class="legend">
				<span class="legend-title">Legende:</span>
				{#each phasen.filter(p => p.value >= 3 && p.value <= 5) as phase}
					<div class="legend-item">
						<span
							class="legend-color"
							style="background: {getPhaseColor(phase.value)};"
						></span>
						<span class="legend-label">{phase.label}</span>
					</div>
				{/each}
			</div>
		</Card>

		<!-- Kommende Termine Liste (Mobile-freundlich) -->
		<Card padding="md">
			{#snippet header()}
				<span>Kommende Termine</span>
			{/snippet}

			<div class="upcoming-list">
				{#each filteredEvents()
					.filter(e => {
						const now = new Date();
						const end = e.endDate || e.startDate;
						return end && end >= now;
					})
					.sort((a, b) => {
						const aDate = a.startDate || a.endDate;
						const bDate = b.startDate || b.endDate;
						if (!aDate || !bDate) return 0;
						return aDate.getTime() - bDate.getTime();
					})
					.slice(0, 10) as event}
					<a href="/bauvorhaben/{event.id}" class="upcoming-item">
						<div class="upcoming-info">
							<span class="upcoming-kunde">{event.kunde}</span>
							<span class="upcoming-adresse">{event.adresse}</span>
							<span class="upcoming-dates">{formatDateRange(event.startDate, event.endDate)}</span>
						</div>
						<Badge variant="phase" phase={event.phase}>
							{event.phaseLabel}
						</Badge>
					</a>
				{:else}
					<p class="no-events">Keine kommenden Termine</p>
				{/each}
			</div>
		</Card>
	{/if}
</div>

<!-- Event Detail Modal -->
{#if selectedEvent}
	<div class="modal-backdrop" onclick={closeModal} role="button" tabindex="-1" onkeydown={(e) => e.key === 'Escape' && closeModal()}>
		<div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
			<div class="modal-header">
				<h2>{selectedEvent.adresse}</h2>
				<button class="modal-close" onclick={closeModal} aria-label="Schließen">&times;</button>
			</div>
			<div class="modal-body">
				<div class="detail-row">
					<span class="detail-label">Kunde</span>
					<span class="detail-value">{selectedEvent.kunde}</span>
				</div>
				<div class="detail-row">
					<span class="detail-label">Lage</span>
					<span class="detail-value">{selectedEvent.lage || '-'}</span>
				</div>
				<div class="detail-row">
					<span class="detail-label">Bauleiter</span>
					<span class="detail-value">{selectedEvent.bauleiter || '-'}</span>
				</div>
				<div class="detail-row">
					<span class="detail-label">Zeitraum</span>
					<span class="detail-value">{formatDateRange(selectedEvent.startDate, selectedEvent.endDate)}</span>
				</div>
				<div class="detail-row">
					<span class="detail-label">Phase</span>
					<Badge variant="phase" phase={selectedEvent.phase}>
						{selectedEvent.phaseLabel}
					</Badge>
				</div>
			</div>
			<div class="modal-footer">
				<a href="/bauvorhaben/{selectedEvent.id}" class="btn-primary">
					Zum Bauvorhaben
				</a>
			</div>
		</div>
	</div>
{/if}

<style>
	.kalender-page {
		max-width: 1400px;
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

	/* Controls */
	.controls {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.nav-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.nav-btn {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: white;
		border: 1px solid var(--color-gray-200);
		font-size: 1.25rem;
		cursor: pointer;
		color: var(--color-gray-700);
	}

	.nav-btn:hover {
		background: var(--color-gray-50);
	}

	.today-btn {
		padding: 0.5rem 1rem;
		background: var(--color-brand-medium);
		color: white;
		border: none;
		font-weight: 600;
		font-size: 0.85rem;
		cursor: pointer;
	}

	.today-btn:hover {
		background: var(--color-brand-dark);
	}

	.month-label {
		font-size: 1.1rem;
		font-weight: 600;
		margin-left: 1rem;
		text-transform: capitalize;
	}

	.filter-select {
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-gray-200);
		background: white;
		font-size: 0.9rem;
		cursor: pointer;
		min-width: 180px;
	}

	/* Loading & Error States */
	.loading-state,
	.error-state {
		text-align: center;
		padding: 3rem 2rem;
		color: var(--color-gray-500);
	}

	.error-state {
		color: var(--color-error);
	}

	.error-state button {
		margin-top: 1rem;
		background: none;
		border: 1px solid var(--color-gray-300);
		padding: 0.5rem 1rem;
		cursor: pointer;
	}

	/* Calendar */
	.calendar {
		overflow: hidden;
	}

	.weekdays {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		background: var(--color-gray-50);
		border-bottom: 1px solid var(--color-gray-200);
	}

	.weekday {
		padding: 0.75rem;
		text-align: center;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-gray-500);
		text-transform: uppercase;
	}

	.days-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
	}

	.day-cell {
		min-height: 100px;
		border-right: 1px solid var(--color-gray-100);
		border-bottom: 1px solid var(--color-gray-100);
		padding: 0.5rem;
		position: relative;
		background: white;
	}

	.day-cell:nth-child(7n) {
		border-right: none;
	}

	.day-cell.other-month {
		background: var(--color-gray-50);
	}

	.day-cell.other-month .day-number {
		color: var(--color-gray-400);
	}

	.day-cell.today {
		background: var(--color-primary-50);
	}

	.day-cell.today .day-number {
		background: var(--color-brand-medium);
		color: white;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.day-number {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--color-gray-700);
		margin-bottom: 0.25rem;
	}

	.day-events {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-top: 0.25rem;
	}

	.event-bar {
		display: block;
		width: 100%;
		padding: 2px 4px;
		font-size: 0.7rem;
		text-align: left;
		cursor: pointer;
		border: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.event-bar:hover {
		filter: brightness(0.95);
	}

	.event-label {
		pointer-events: none;
	}

	.more-events {
		font-size: 0.7rem;
		color: var(--color-gray-500);
		padding: 2px 4px;
	}

	/* Legend */
	.legend {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		flex-wrap: wrap;
	}

	.legend-title {
		font-weight: 600;
		font-size: 0.85rem;
		color: var(--color-gray-600);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.legend-color {
		width: 16px;
		height: 16px;
	}

	.legend-label {
		font-size: 0.8rem;
		color: var(--color-gray-600);
	}

	/* Upcoming List */
	.upcoming-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.upcoming-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem;
		background: var(--color-gray-50);
		border: 1px solid var(--color-gray-100);
		text-decoration: none;
		transition: all 0.15s ease;
	}

	.upcoming-item:hover {
		background: white;
		border-color: var(--color-gray-200);
	}

	.upcoming-info {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.upcoming-kunde {
		font-size: 0.8rem;
		color: var(--color-gray-500);
	}

	.upcoming-adresse {
		font-weight: 600;
		color: var(--color-gray-800);
	}

	.upcoming-dates {
		font-size: 0.8rem;
		color: var(--color-gray-500);
	}

	.no-events {
		color: var(--color-gray-500);
		text-align: center;
		padding: 1rem;
	}

	/* Modal */
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: var(--z-modal-backdrop);
		padding: 1rem;
	}

	.modal {
		background: white;
		width: 100%;
		max-width: 500px;
		max-height: 90vh;
		overflow-y: auto;
		z-index: var(--z-modal);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--color-gray-200);
	}

	.modal-header h2 {
		font-size: 1.1rem;
		margin: 0;
	}

	.modal-close {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: var(--color-gray-500);
		padding: 0;
		line-height: 1;
	}

	.modal-close:hover {
		color: var(--color-gray-700);
	}

	.modal-body {
		padding: 1.25rem;
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--color-gray-100);
	}

	.detail-row:last-child {
		border-bottom: none;
	}

	.detail-label {
		font-size: 0.85rem;
		color: var(--color-gray-500);
	}

	.detail-value {
		font-weight: 500;
		color: var(--color-gray-800);
	}

	.modal-footer {
		padding: 1rem 1.25rem;
		border-top: 1px solid var(--color-gray-200);
		background: var(--color-gray-50);
	}

	.btn-primary {
		display: block;
		width: 100%;
		padding: 0.75rem 1rem;
		background: var(--color-brand-medium);
		color: white;
		text-align: center;
		text-decoration: none;
		font-weight: 600;
	}

	.btn-primary:hover {
		background: var(--color-brand-dark);
	}

	/* Responsive */
	@media (max-width: 1024px) {
		.day-cell {
			min-height: 80px;
			padding: 0.25rem;
		}

		.event-bar {
			font-size: 0.6rem;
			padding: 1px 2px;
		}

		.weekday {
			font-size: 0.65rem;
			padding: 0.5rem 0.25rem;
		}
	}

	@media (max-width: 640px) {
		.controls {
			flex-direction: column;
			align-items: stretch;
		}

		.nav-controls {
			justify-content: center;
		}

		.filter-select {
			width: 100%;
		}

		.day-cell {
			min-height: 60px;
		}

		.day-number {
			font-size: 0.75rem;
		}

		.event-bar {
			font-size: 0.55rem;
		}

		.legend {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}
	}
</style>
