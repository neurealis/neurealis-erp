<script lang="ts">
	import { Card, Badge } from '$lib/components/ui';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	// Types
	interface Bauvorhaben {
		id: string;
		name: string;
		group_title: string;
		phase: number;
		phaseLabel: string;
		kunde: string;
		adresse: string;
		lage: string;
		bauleiter: string | null;
		projektNr: string | null;
		grundflaeche: number | null;
		umsatzNetto: number | null;
		umsatzBrutto: number | null;
		budgetStart: number | null;
		budgetFinal: number | null;
		rohertrag: number | null;
		margeProzent: number | null;
		bvStart: string | null;
		bvEndPlan: string | null;
		deadline: string | null;
		deadlineSchluessel: string | null;
		angebotNr: string | null;
		angebotGesendet: string | null;
		abNr: string | null;
		nuaNr: string | null;
		schluesselStatus: string | null;
		offeneMaengel: number;
		offeneNachtraege: number;
		reKundeOffen: number | null;
		reKundeBezahlt: number | null;
		reNuOffen: number | null;
		reNuBezahlt: number | null;
		eingangsRe: number | null;
		datumBedarfsanalyse: string | null;
		matterportLink: string | null;
		status: string | null;
		maengelfrei: boolean | null;
		verspaetung: number | null;
		nu: string | null;
	}

	// State
	let bauvorhaben = $state<Bauvorhaben[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Filter-State
	let searchQuery = $state('');
	let selectedPhase = $state<number>(4); // Default: Bauphase

	// Sort-State (aus localStorage laden)
	let sortColumn = $state<string | null>(null);
	let sortDirection = $state<'asc' | 'desc'>('asc');

	// Column widths state (aus localStorage laden)
	let columnWidths = $state<Record<string, number>>({});

	// LocalStorage Keys
	const SORT_STORAGE_KEY = 'neurealis-bv-sort';
	const WIDTH_STORAGE_KEY = 'neurealis-bv-widths';

	// Phasen-Tabs mit Mapping - Nummern vorne
	const phasenTabs = [
		{ value: 0, label: '(0) Bedarfsanalyse' },
		{ value: 1, label: '(1) Angebot' },
		{ value: 2, label: '(2) Auftrag' },
		{ value: 3, label: '(3) Vorbereitung' },
		{ value: 4, label: '(4) Umsetzung' },
		{ value: 5, label: '(5) Rechnungen' },
		{ value: 6, label: '(6/7) Abgeschlossen' },
	];

	// Spalten-Definitionen pro Phase nach Softr-Vorlage
	const phaseColumns: Record<number, { key: string; label: string; defaultWidth: number; sortable?: boolean }[]> = {
		0: [ // Bedarfsanalyse
			{ key: 'projektNr', label: 'Projekt-Nr', defaultWidth: 110, sortable: true },
			{ key: 'kunde', label: 'Kunde', defaultWidth: 150, sortable: true },
			{ key: 'adresse', label: 'Adresse', defaultWidth: 200, sortable: true },
			{ key: 'lage', label: 'Lage', defaultWidth: 100, sortable: true },
			{ key: 'grundflaeche', label: 'Grundflaeche', defaultWidth: 100, sortable: true },
			{ key: 'datumBedarfsanalyse', label: 'Datum Bedarfsanalyse', defaultWidth: 140, sortable: true },
			{ key: 'matterportLink', label: 'Matterport', defaultWidth: 90, sortable: false },
			{ key: 'status', label: 'Status', defaultWidth: 120, sortable: true },
		],
		1: [ // Angebot
			{ key: 'projektNr', label: 'Projekt-Nr', defaultWidth: 110, sortable: true },
			{ key: 'kunde', label: 'Kunde', defaultWidth: 150, sortable: true },
			{ key: 'adresse', label: 'Adresse', defaultWidth: 200, sortable: true },
			{ key: 'angebotNr', label: 'Angebot-Nr', defaultWidth: 110, sortable: true },
			{ key: 'umsatzNetto', label: 'Umsatz netto', defaultWidth: 110, sortable: true },
			{ key: 'umsatzBrutto', label: 'Umsatz brutto', defaultWidth: 110, sortable: true },
			{ key: 'deadline', label: 'Deadline', defaultWidth: 100, sortable: true },
			{ key: 'angebotGesendet', label: 'Gesendet', defaultWidth: 100, sortable: true },
			{ key: 'status', label: 'Status', defaultWidth: 120, sortable: true },
		],
		2: [ // Auftrag
			{ key: 'projektNr', label: 'Projekt-Nr', defaultWidth: 110, sortable: true },
			{ key: 'kunde', label: 'Kunde', defaultWidth: 150, sortable: true },
			{ key: 'abNr', label: 'AB-Nr', defaultWidth: 100, sortable: true },
			{ key: 'nuaNr', label: 'NUA-Nr', defaultWidth: 100, sortable: true },
			{ key: 'budgetStart', label: 'Budget Start', defaultWidth: 110, sortable: true },
			{ key: 'budgetFinal', label: 'Budget Final', defaultWidth: 110, sortable: true },
			{ key: 'bvStart', label: 'BV Start', defaultWidth: 100, sortable: true },
			{ key: 'bvEndPlan', label: 'BV Ende', defaultWidth: 100, sortable: true },
			{ key: 'status', label: 'Status', defaultWidth: 120, sortable: true },
		],
		3: [ // Vorbereitung
			{ key: 'projektNr', label: 'Projekt-Nr', defaultWidth: 110, sortable: true },
			{ key: 'kunde', label: 'Kunde', defaultWidth: 150, sortable: true },
			{ key: 'bvStart', label: 'BV Start', defaultWidth: 100, sortable: true },
			{ key: 'schluesselStatus', label: 'Schluessel-Status', defaultWidth: 130, sortable: true },
			{ key: 'deadlineSchluessel', label: 'Deadline Schluessel', defaultWidth: 140, sortable: true },
			{ key: 'nu', label: 'NU', defaultWidth: 120, sortable: true },
			{ key: 'bauleiter', label: 'Bauleiter', defaultWidth: 120, sortable: true },
		],
		4: [ // Umsetzung (Bauphase)
			{ key: 'projektNr', label: 'Projekt-Nr', defaultWidth: 110, sortable: true },
			{ key: 'kunde', label: 'Kunde', defaultWidth: 150, sortable: true },
			{ key: 'nuaNr', label: 'NUA-Nr', defaultWidth: 100, sortable: true },
			{ key: 'bvStart', label: 'BV Start', defaultWidth: 100, sortable: true },
			{ key: 'bvEndPlan', label: 'BV Ende Plan', defaultWidth: 110, sortable: true },
			{ key: 'maengelfrei', label: 'Maengelfrei', defaultWidth: 100, sortable: true },
			{ key: 'verspaetung', label: 'Verspaetung', defaultWidth: 100, sortable: true },
			{ key: 'offeneMaengel', label: 'Maengel offen', defaultWidth: 110, sortable: true },
			{ key: 'offeneNachtraege', label: 'Nachtraege', defaultWidth: 100, sortable: true },
			{ key: 'nu', label: 'NU', defaultWidth: 120, sortable: true },
		],
		5: [ // Rechnungen
			{ key: 'projektNr', label: 'Projekt-Nr', defaultWidth: 110, sortable: true },
			{ key: 'kunde', label: 'Kunde', defaultWidth: 150, sortable: true },
			{ key: 'umsatzNetto', label: 'Umsatz', defaultWidth: 110, sortable: true },
			{ key: 'reKundeOffen', label: 'RE Kunde offen', defaultWidth: 120, sortable: true },
			{ key: 'reKundeBezahlt', label: 'RE Kunde bezahlt', defaultWidth: 130, sortable: true },
			{ key: 'reNuOffen', label: 'RE NU offen', defaultWidth: 110, sortable: true },
			{ key: 'reNuBezahlt', label: 'RE NU bezahlt', defaultWidth: 120, sortable: true },
			{ key: 'status', label: 'Status', defaultWidth: 120, sortable: true },
		],
		6: [ // Abgeschlossen
			{ key: 'projektNr', label: 'Projekt-Nr', defaultWidth: 110, sortable: true },
			{ key: 'kunde', label: 'Kunde', defaultWidth: 150, sortable: true },
			{ key: 'umsatzNetto', label: 'Umsatz', defaultWidth: 110, sortable: true },
			{ key: 'eingangsRe', label: 'Eingangs-RE', defaultWidth: 110, sortable: true },
			{ key: 'rohertrag', label: 'Rohertrag', defaultWidth: 110, sortable: true },
			{ key: 'margeProzent', label: 'Marge %', defaultWidth: 90, sortable: true },
		],
	};

	// Parse Phase aus group_title
	function parsePhase(groupTitle: string): { phase: number; label: string } {
		const match = groupTitle.match(/^\((\d+)/);
		if (match) {
			const rawPhase = parseInt(match[1]);
			// Mapping: 7 = abgeschlossen (wie 6), 9 = nicht erhalten (ignorieren)
			if (rawPhase === 7) return { phase: 6, label: groupTitle };
			if (rawPhase === 9) return { phase: 9, label: groupTitle };
			return { phase: rawPhase, label: groupTitle };
		}
		return { phase: -1, label: groupTitle };
	}

	// Parse Name: "Kunde | Adresse | Lage | Bauleiter" oder "Kunde - Adresse - Lage"
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

	// Extrahiere JSON-Wert aus column_values Feld
	function extractValue(field: any): string | null {
		if (!field) return null;
		if (typeof field === 'string') {
			try {
				const parsed = JSON.parse(field);
				return parsed?.text || parsed?.value || null;
			} catch {
				return field;
			}
		}
		return field?.text || field?.value || null;
	}

	function extractNumber(field: any): number | null {
		const val = extractValue(field);
		if (!val) return null;
		const num = parseFloat(val.replace(/"/g, ''));
		return isNaN(num) ? null : num;
	}

	function extractDate(field: any): string | null {
		if (!field) return null;
		const val = typeof field === 'string' ? JSON.parse(field) : field;
		if (val?.date) return val.date;
		if (val?.text) {
			const match = val.text.match(/^\d{4}-\d{2}-\d{2}/);
			return match ? match[0] : null;
		}
		return null;
	}

	// Load sort preferences from localStorage
	function loadSortPreferences() {
		if (!browser) return;
		try {
			const saved = localStorage.getItem(SORT_STORAGE_KEY);
			if (saved) {
				const parsed = JSON.parse(saved);
				sortColumn = parsed.column || null;
				sortDirection = parsed.direction || 'asc';
			}
		} catch {
			// Ignore errors
		}
	}

	// Save sort preferences to localStorage
	function saveSortPreferences() {
		if (!browser) return;
		try {
			localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({
				column: sortColumn,
				direction: sortDirection
			}));
		} catch {
			// Ignore errors
		}
	}

	// Load column widths from localStorage
	function loadColumnWidths() {
		if (!browser) return;
		try {
			const saved = localStorage.getItem(WIDTH_STORAGE_KEY);
			if (saved) {
				columnWidths = JSON.parse(saved);
			}
		} catch {
			// Ignore errors
		}
	}

	// Save column widths to localStorage
	function saveColumnWidths() {
		if (!browser) return;
		try {
			localStorage.setItem(WIDTH_STORAGE_KEY, JSON.stringify(columnWidths));
		} catch {
			// Ignore errors
		}
	}

	// Handle column sort click
	function handleSort(columnKey: string, sortable?: boolean) {
		if (!sortable) return;

		if (sortColumn === columnKey) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = columnKey;
			sortDirection = 'asc';
		}
		saveSortPreferences();
	}

	// Column resize handling
	let resizingColumn: string | null = null;
	let startX = 0;
	let startWidth = 0;

	function startResize(e: MouseEvent, columnKey: string, currentWidth: number) {
		e.preventDefault();
		e.stopPropagation();
		resizingColumn = columnKey;
		startX = e.clientX;
		startWidth = currentWidth;
		document.addEventListener('mousemove', handleResize);
		document.addEventListener('mouseup', stopResize);
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
	}

	function handleResize(e: MouseEvent) {
		if (!resizingColumn) return;
		const diff = e.clientX - startX;
		const newWidth = Math.max(60, startWidth + diff);
		columnWidths = { ...columnWidths, [resizingColumn]: newWidth };
	}

	function stopResize() {
		if (resizingColumn) {
			saveColumnWidths();
		}
		resizingColumn = null;
		document.removeEventListener('mousemove', handleResize);
		document.removeEventListener('mouseup', stopResize);
		document.body.style.cursor = '';
		document.body.style.userSelect = '';
	}

	function getColumnWidth(columnKey: string, defaultWidth: number): number {
		return columnWidths[columnKey] ?? defaultWidth;
	}

	// Daten laden
	async function loadBauvorhaben() {
		loading = true;
		error = null;

		try {
			const { data: mondayData, error: mondayError } = await supabase
				.from('monday_bauprozess')
				.select('id, name, group_title, column_values')
				.order('name');

			if (mondayError) throw mondayError;

			// Lade offene Maengel pro Projekt
			const { data: maengelData, error: maengelError } = await supabase
				.from('maengel_fertigstellung')
				.select('projekt_nr, status_mangel')
				.not('status_mangel', 'eq', '(2) Abgeschlossen');

			if (maengelError) throw maengelError;

			// Lade offene Nachtraege pro Projekt
			const { data: nachtraegeData, error: nachtraegeError } = await supabase
				.from('nachtraege')
				.select('atbs_nummer, status')
				.in('status', ['(0) Offen', '(1) Preis eingegeben']);

			if (nachtraegeError) throw nachtraegeError;

			// Zaehle Maengel pro Projekt
			const maengelCount: Record<string, number> = {};
			maengelData?.forEach(m => {
				if (m.projekt_nr) {
					maengelCount[m.projekt_nr] = (maengelCount[m.projekt_nr] || 0) + 1;
				}
			});

			// Zaehle Nachtraege pro Projekt
			const nachtraegeCount: Record<string, number> = {};
			nachtraegeData?.forEach(n => {
				if (n.atbs_nummer) {
					nachtraegeCount[n.atbs_nummer] = (nachtraegeCount[n.atbs_nummer] || 0) + 1;
				}
			});

			// Transformiere Daten
			bauvorhaben = (mondayData || []).map(item => {
				const { phase, label: phaseLabel } = parsePhase(item.group_title || '');
				const { kunde, adresse, lage, bauleiter } = parseName(item.name || '');
				const cv = item.column_values || {};

				// Extrahiere Projekt-Nr (ATBS)
				const projektNr = extractValue(cv['text_mkknjtn5']);

				// Umsatz netto/brutto
				const umsatzNetto = extractNumber(cv['zahlen_mkkmrcvm']);
				const umsatzBrutto = umsatzNetto ? umsatzNetto * 1.19 : null;

				return {
					id: item.id,
					name: item.name,
					group_title: item.group_title,
					phase,
					phaseLabel,
					kunde,
					adresse,
					lage,
					bauleiter,
					projektNr,
					grundflaeche: extractNumber(cv['zahlen0__1']),
					umsatzNetto,
					umsatzBrutto,
					budgetStart: extractNumber(cv['zahlen_mkksxgy8']),
					budgetFinal: extractNumber(cv['zahlen_mkksxgy8']), // TODO: Separates Feld wenn vorhanden
					rohertrag: extractNumber(cv['zahlen_mkm2n68z']),
					margeProzent: extractNumber(cv['formel_mkmmn6m6']),
					bvStart: extractDate(cv['datum__1']),
					bvEndPlan: extractDate(cv['date5__1']),
					deadline: extractDate(cv['date_mkyesh9']),
					deadlineSchluessel: extractDate(cv['date_mkyesh9']), // TODO: Separates Feld wenn vorhanden
					angebotNr: extractValue(cv['text__1']),
					angebotGesendet: extractDate(cv['datum__1']), // TODO: Korrektes Feld
					abNr: extractValue(cv['text0__1']),
					nuaNr: extractValue(cv['text1__1']),
					schluesselStatus: extractValue(cv['color_mkkh1mw9'])?.replace(/"/g, '') || null,
					offeneMaengel: maengelCount[projektNr || ''] || 0,
					offeneNachtraege: nachtraegeCount[projektNr || ''] || 0,
					reKundeOffen: null, // TODO: aus softr_dokumente
					reKundeBezahlt: null, // TODO: aus softr_dokumente
					reNuOffen: null, // TODO: aus softr_dokumente
					reNuBezahlt: null, // TODO: aus softr_dokumente
					eingangsRe: null, // TODO: aus softr_dokumente
					datumBedarfsanalyse: extractDate(cv['date_mkyesh9']),
					matterportLink: extractValue(cv['link__1']) || null,
					status: extractValue(cv['color_mkkh1mw9'])?.replace(/"/g, '') || null,
					maengelfrei: false, // TODO: Berechnen aus Maengel-Status
					verspaetung: null, // TODO: Berechnen aus BV Ende vs. Plan
					nu: bauleiter, // NU = Bauleiter Mapping
				};
			});
		} catch (e) {
			error = e instanceof Error ? e.message : 'Fehler beim Laden der Daten';
			console.error('Fehler:', e);
		} finally {
			loading = false;
		}
	}

	// Sort-Funktion
	function sortData(data: Bauvorhaben[]): Bauvorhaben[] {
		if (!sortColumn) return data;

		return [...data].sort((a, b) => {
			const aVal = getCellRawValue(a, sortColumn!);
			const bVal = getCellRawValue(b, sortColumn!);

			// Null-Werte immer ans Ende
			if (aVal === null && bVal === null) return 0;
			if (aVal === null) return 1;
			if (bVal === null) return -1;

			let comparison = 0;
			if (typeof aVal === 'number' && typeof bVal === 'number') {
				comparison = aVal - bVal;
			} else {
				comparison = String(aVal).localeCompare(String(bVal), 'de');
			}

			return sortDirection === 'asc' ? comparison : -comparison;
		});
	}

	// Get raw cell value for sorting
	function getCellRawValue(bv: Bauvorhaben, key: string): string | number | boolean | null {
		switch (key) {
			case 'projektNr': return bv.projektNr;
			case 'kunde': return bv.kunde;
			case 'adresse': return bv.adresse;
			case 'lage': return bv.lage;
			case 'grundflaeche': return bv.grundflaeche;
			case 'umsatzNetto': return bv.umsatzNetto;
			case 'umsatzBrutto': return bv.umsatzBrutto;
			case 'budgetStart': return bv.budgetStart;
			case 'budgetFinal': return bv.budgetFinal;
			case 'rohertrag': return bv.rohertrag;
			case 'margeProzent': return bv.margeProzent;
			case 'bvStart': return bv.bvStart;
			case 'bvEndPlan': return bv.bvEndPlan;
			case 'deadline': return bv.deadline;
			case 'deadlineSchluessel': return bv.deadlineSchluessel;
			case 'angebotNr': return bv.angebotNr;
			case 'angebotGesendet': return bv.angebotGesendet;
			case 'abNr': return bv.abNr;
			case 'nuaNr': return bv.nuaNr;
			case 'schluesselStatus': return bv.schluesselStatus;
			case 'bauleiter': return bv.bauleiter;
			case 'offeneMaengel': return bv.offeneMaengel;
			case 'offeneNachtraege': return bv.offeneNachtraege;
			case 'reKundeOffen': return bv.reKundeOffen;
			case 'reKundeBezahlt': return bv.reKundeBezahlt;
			case 'reNuOffen': return bv.reNuOffen;
			case 'reNuBezahlt': return bv.reNuBezahlt;
			case 'eingangsRe': return bv.eingangsRe;
			case 'datumBedarfsanalyse': return bv.datumBedarfsanalyse;
			case 'status': return bv.status;
			case 'maengelfrei': return bv.maengelfrei;
			case 'verspaetung': return bv.verspaetung;
			case 'nu': return bv.nu;
			default: return null;
		}
	}

	// Gefilterte Bauvorhaben nach Phase und Suche
	let filteredBV = $derived(() => {
		let filtered = bauvorhaben.filter(bv => {
			// Phase-Filter (Phase 9 = nicht erhalten - ausblenden)
			if (bv.phase === 9) return false;
			if (bv.phase !== selectedPhase) return false;

			// Suchfilter
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				const match =
					bv.name.toLowerCase().includes(query) ||
					bv.adresse.toLowerCase().includes(query) ||
					bv.kunde.toLowerCase().includes(query) ||
					(bv.projektNr && bv.projektNr.toLowerCase().includes(query));
				if (!match) return false;
			}

			return true;
		});

		// Sortierung anwenden
		return sortData(filtered);
	});

	// Anzahl pro Phase für Badges
	let phaseCounts = $derived(() => {
		const counts: Record<number, number> = {};
		bauvorhaben.forEach(bv => {
			if (bv.phase !== 9) {
				counts[bv.phase] = (counts[bv.phase] || 0) + 1;
			}
		});
		return counts;
	});

	// Formatierung
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

	function formatPercent(value: number | null): string {
		if (value === null) return '-';
		return `${value.toFixed(1)}%`;
	}

	function formatArea(value: number | null): string {
		if (value === null) return '-';
		return `${value} m2`;
	}

	function formatDays(value: number | null): string {
		if (value === null) return '-';
		if (value === 0) return '0 Tage';
		return `${value > 0 ? '+' : ''}${value} Tage`;
	}

	// Wert für Tabellenzelle holen
	function getCellValue(bv: Bauvorhaben, key: string): string {
		switch (key) {
			case 'projektNr': return bv.projektNr || '-';
			case 'kunde': return bv.kunde;
			case 'adresse': return bv.adresse;
			case 'lage': return bv.lage || '-';
			case 'grundflaeche': return formatArea(bv.grundflaeche);
			case 'umsatzNetto': return formatCurrency(bv.umsatzNetto);
			case 'umsatzBrutto': return formatCurrency(bv.umsatzBrutto);
			case 'budgetStart': return formatCurrency(bv.budgetStart);
			case 'budgetFinal': return formatCurrency(bv.budgetFinal);
			case 'rohertrag': return formatCurrency(bv.rohertrag);
			case 'margeProzent': return formatPercent(bv.margeProzent);
			case 'bvStart': return formatDate(bv.bvStart);
			case 'bvEndPlan': return formatDate(bv.bvEndPlan);
			case 'deadline': return formatDate(bv.deadline);
			case 'deadlineSchluessel': return formatDate(bv.deadlineSchluessel);
			case 'angebotNr': return bv.angebotNr || '-';
			case 'angebotGesendet': return formatDate(bv.angebotGesendet);
			case 'abNr': return bv.abNr || '-';
			case 'nuaNr': return bv.nuaNr || '-';
			case 'schluesselStatus': return bv.schluesselStatus || '-';
			case 'bauleiter': return bv.bauleiter || '-';
			case 'offeneMaengel': return bv.offeneMaengel > 0 ? String(bv.offeneMaengel) : '-';
			case 'offeneNachtraege': return bv.offeneNachtraege > 0 ? String(bv.offeneNachtraege) : '-';
			case 'reKundeOffen': return formatCurrency(bv.reKundeOffen);
			case 'reKundeBezahlt': return formatCurrency(bv.reKundeBezahlt);
			case 'reNuOffen': return formatCurrency(bv.reNuOffen);
			case 'reNuBezahlt': return formatCurrency(bv.reNuBezahlt);
			case 'eingangsRe': return formatCurrency(bv.eingangsRe);
			case 'datumBedarfsanalyse': return formatDate(bv.datumBedarfsanalyse);
			case 'matterportLink': return bv.matterportLink ? 'Link' : '-';
			case 'status': return bv.status || '-';
			case 'maengelfrei': return bv.maengelfrei ? 'Ja' : 'Nein';
			case 'verspaetung': return formatDays(bv.verspaetung);
			case 'nu': return bv.nu || '-';
			default: return '-';
		}
	}

	// Zellen-Klasse für spezielle Formatierung
	function getCellClass(key: string, bv: Bauvorhaben): string {
		if (key === 'offeneMaengel' && bv.offeneMaengel > 0) return 'cell-warning';
		if (key === 'offeneNachtraege' && bv.offeneNachtraege > 0) return 'cell-info';
		if (key === 'verspaetung' && bv.verspaetung && bv.verspaetung > 0) return 'cell-warning';
		if (['umsatzNetto', 'umsatzBrutto', 'budgetStart', 'budgetFinal', 'rohertrag', 'reKundeOffen', 'reKundeBezahlt', 'reNuOffen', 'reNuBezahlt', 'eingangsRe'].includes(key)) return 'cell-money';
		if (key === 'projektNr') return 'cell-link';
		return '';
	}

	// Check if cell should be a link
	function isLinkCell(key: string): boolean {
		return key === 'projektNr' || key === 'matterportLink';
	}

	onMount(() => {
		loadSortPreferences();
		loadColumnWidths();
		loadBauvorhaben();
	});
</script>

<div class="bauvorhaben-page">
	<header class="page-header">
		<div class="header-content">
			<h1>Bauvorhaben</h1>
			{#if !loading}
				<p class="subtitle">{filteredBV().length} Projekte in dieser Phase</p>
			{/if}
		</div>
		<a href="/bauvorhaben/neu" class="btn-add">
			+ Neues BV
		</a>
	</header>

	<!-- Phasen-Tabs -->
	<div class="phase-tabs">
		{#each phasenTabs as tab}
			<button
				class="phase-tab"
				class:active={selectedPhase === tab.value}
				onclick={() => selectedPhase = tab.value}
			>
				<span class="tab-label">{tab.label}</span>
				{#if phaseCounts()[tab.value]}
					<span class="tab-count">{phaseCounts()[tab.value]}</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Suchfeld -->
	<div class="search-container">
		<div class="search-box">
			<svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="11" cy="11" r="8"/>
				<path d="m21 21-4.35-4.35"/>
			</svg>
			<input
				type="search"
				placeholder="Projekt, Adresse oder Kunde suchen..."
				bind:value={searchQuery}
				class="search-input"
			/>
			{#if searchQuery}
				<button class="clear-search" onclick={() => searchQuery = ''}>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 6 6 18M6 6l12 12"/>
					</svg>
				</button>
			{/if}
		</div>
	</div>

	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Lade Bauvorhaben...</p>
		</div>
	{:else if error}
		<div class="error-state">
			<p>Fehler: {error}</p>
			<button onclick={loadBauvorhaben}>Erneut versuchen</button>
		</div>
	{:else}
		<!-- Tabelle -->
		<div class="table-wrapper">
			<table class="bv-table">
				<thead>
					<tr>
						{#each phaseColumns[selectedPhase] || [] as col}
							<th
								style="width: {getColumnWidth(col.key, col.defaultWidth)}px; min-width: {getColumnWidth(col.key, col.defaultWidth)}px"
								class:sortable={col.sortable}
								class:sorted={sortColumn === col.key}
								onclick={() => handleSort(col.key, col.sortable)}
							>
								<div class="th-content">
									<span class="th-label">{col.label}</span>
									{#if col.sortable}
										<span class="sort-indicator">
											{#if sortColumn === col.key}
												{#if sortDirection === 'asc'}
													<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
														<path d="M7 14l5-5 5 5z"/>
													</svg>
												{:else}
													<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
														<path d="M7 10l5 5 5-5z"/>
													</svg>
												{/if}
											{:else}
												<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
													<path d="M7 10l5 5 5-5z"/>
												</svg>
											{/if}
										</span>
									{/if}
								</div>
								<div
									class="resize-handle"
									onmousedown={(e) => startResize(e, col.key, getColumnWidth(col.key, col.defaultWidth))}
								></div>
							</th>
						{/each}
						<th style="width: 40px"></th>
					</tr>
				</thead>
				<tbody>
					{#each filteredBV() as bv}
						<tr>
							{#each phaseColumns[selectedPhase] || [] as col}
								<td class={getCellClass(col.key, bv)}>
									{#if col.key === 'projektNr' && bv.projektNr}
										<a href="/bauvorhaben/{bv.id}" class="projekt-link" onclick={(e) => e.stopPropagation()}>
											{bv.projektNr}
										</a>
									{:else if col.key === 'matterportLink' && bv.matterportLink}
										<a href={bv.matterportLink} target="_blank" rel="noopener" class="external-link" onclick={(e) => e.stopPropagation()}>
											3D-Scan
										</a>
									{:else if col.key === 'offeneMaengel' && bv.offeneMaengel > 0}
										<Badge variant="error" size="sm">{bv.offeneMaengel}</Badge>
									{:else if col.key === 'offeneNachtraege' && bv.offeneNachtraege > 0}
										<Badge variant="warning" size="sm">{bv.offeneNachtraege}</Badge>
									{:else}
										{getCellValue(bv, col.key)}
									{/if}
								</td>
							{/each}
							<td>
								<a href="/bauvorhaben/{bv.id}" class="row-link">
									<svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="m9 18 6-6-6-6"/>
									</svg>
								</a>
							</td>
						</tr>
					{:else}
						<tr class="empty-row">
							<td colspan={phaseColumns[selectedPhase]?.length + 1 || 1}>
								<div class="empty-state">
									<p>Keine Bauvorhaben in dieser Phase</p>
									{#if searchQuery}
										<button onclick={() => searchQuery = ''}>Suche zuruecksetzen</button>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Mobile Cards -->
		<div class="mobile-cards">
			{#each filteredBV() as bv}
				<a href="/bauvorhaben/{bv.id}" class="bv-card">
					<div class="card-header">
						<span class="projekt-nr">{bv.projektNr || '-'}</span>
						<span class="kunde">{bv.kunde}</span>
						{#if bv.offeneMaengel > 0 || bv.offeneNachtraege > 0}
							<div class="card-badges">
								{#if bv.offeneMaengel > 0}
									<Badge variant="error" size="sm">{bv.offeneMaengel}M</Badge>
								{/if}
								{#if bv.offeneNachtraege > 0}
									<Badge variant="warning" size="sm">{bv.offeneNachtraege}N</Badge>
								{/if}
							</div>
						{/if}
					</div>
					<div class="card-body">
						<h3 class="adresse">{bv.adresse}</h3>
						{#if bv.lage}
							<span class="lage">{bv.lage}</span>
						{/if}
					</div>
					<div class="card-footer">
						{#if selectedPhase === 4}
							<div class="card-meta">
								<span class="meta-label">NUA</span>
								<span class="meta-value">{bv.nuaNr || '-'}</span>
							</div>
							<div class="card-meta">
								<span class="meta-label">Start</span>
								<span class="meta-value">{formatDate(bv.bvStart)}</span>
							</div>
							<div class="card-meta">
								<span class="meta-label">Ende</span>
								<span class="meta-value">{formatDate(bv.bvEndPlan)}</span>
							</div>
						{:else if selectedPhase === 5}
							<div class="card-meta">
								<span class="meta-label">Umsatz</span>
								<span class="meta-value">{formatCurrency(bv.umsatzNetto)}</span>
							</div>
							<div class="card-meta">
								<span class="meta-label">RE offen</span>
								<span class="meta-value">{formatCurrency(bv.reKundeOffen)}</span>
							</div>
						{:else if selectedPhase === 6}
							<div class="card-meta">
								<span class="meta-label">Umsatz</span>
								<span class="meta-value">{formatCurrency(bv.umsatzNetto)}</span>
							</div>
							<div class="card-meta">
								<span class="meta-label">Marge</span>
								<span class="meta-value">{formatPercent(bv.margeProzent)}</span>
							</div>
						{:else}
							<div class="card-meta">
								<span class="meta-label">Flaeche</span>
								<span class="meta-value">{formatArea(bv.grundflaeche)}</span>
							</div>
							<div class="card-meta">
								<span class="meta-label">Umsatz</span>
								<span class="meta-value">{formatCurrency(bv.umsatzNetto)}</span>
							</div>
						{/if}
					</div>
				</a>
			{:else}
				<div class="empty-state mobile">
					<p>Keine Bauvorhaben in dieser Phase</p>
					{#if searchQuery}
						<button onclick={() => searchQuery = ''}>Suche zuruecksetzen</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.bauvorhaben-page {
		max-width: 1600px;
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
		color: var(--color-gray-800);
	}

	.subtitle {
		color: var(--color-gray-500);
		margin: 0;
		font-size: 0.9rem;
	}

	.btn-add {
		display: inline-flex;
		align-items: center;
		padding: 0.6rem 1rem;
		background: #C41E3A;
		color: white;
		text-decoration: none;
		font-weight: 600;
		font-size: 0.9rem;
		border-radius: 0;
		transition: background var(--transition-fast);
	}

	.btn-add:hover {
		background: #A31830;
	}

	/* Phase Tabs */
	.phase-tabs {
		display: flex;
		gap: 0;
		background: white;
		border: 1px solid var(--color-gray-200);
		margin-bottom: 1rem;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		border-radius: 0;
	}

	.phase-tab {
		flex: 1;
		min-width: 120px;
		padding: 0.75rem 1rem;
		background: none;
		border: none;
		border-right: 1px solid var(--color-gray-200);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		transition: all var(--transition-fast);
		color: var(--color-gray-600);
		position: relative;
		border-radius: 0;
	}

	.phase-tab:last-child {
		border-right: none;
	}

	.phase-tab:hover {
		background: var(--color-gray-50);
	}

	.phase-tab.active {
		background: #FFF5F5;
		color: #C41E3A;
	}

	.phase-tab.active::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: #C41E3A;
	}

	.tab-label {
		font-weight: 500;
		font-size: 0.85rem;
		white-space: nowrap;
	}

	.tab-count {
		font-size: 0.7rem;
		background: var(--color-gray-200);
		padding: 0.1rem 0.4rem;
		border-radius: 0;
		font-weight: 600;
	}

	.phase-tab.active .tab-count {
		background: #C41E3A;
		color: white;
	}

	/* Search */
	.search-container {
		margin-bottom: 1rem;
	}

	.search-box {
		display: flex;
		align-items: center;
		background: white;
		border: 1px solid var(--color-gray-200);
		padding: 0.5rem 1rem;
		gap: 0.75rem;
		border-radius: 0;
	}

	.search-icon {
		color: var(--color-gray-400);
		flex-shrink: 0;
	}

	.search-input {
		flex: 1;
		border: none;
		background: none;
		font-size: 0.9rem;
		outline: none;
		padding: 0.25rem 0;
		border-radius: 0;
	}

	.search-input::placeholder {
		color: var(--color-gray-400);
	}

	.clear-search {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.25rem;
		color: var(--color-gray-400);
		display: flex;
		align-items: center;
		border-radius: 0;
	}

	.clear-search:hover {
		color: var(--color-gray-600);
	}

	/* Table */
	.table-wrapper {
		background: white;
		border: 1px solid var(--color-gray-200);
		overflow-x: auto;
		border-radius: 0;
	}

	.bv-table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
	}

	.bv-table th {
		text-align: left;
		padding: 0.75rem 1rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-gray-500);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-bottom: 1px solid var(--color-gray-200);
		background: var(--color-gray-50);
		white-space: nowrap;
		position: relative;
		user-select: none;
	}

	.bv-table th.sortable {
		cursor: pointer;
	}

	.bv-table th.sortable:hover {
		background: var(--color-gray-100);
	}

	.bv-table th.sorted {
		color: #C41E3A;
		background: #FFF5F5;
	}

	.th-content {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.th-label {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sort-indicator {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		color: #C41E3A;
	}

	.resize-handle {
		position: absolute;
		right: 0;
		top: 0;
		bottom: 0;
		width: 5px;
		cursor: col-resize;
		background: transparent;
	}

	.resize-handle:hover {
		background: #C41E3A;
	}

	.bv-table td {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-gray-100);
		font-size: 0.875rem;
		color: var(--color-gray-700);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.bv-table tbody tr {
		transition: background var(--transition-fast);
	}

	.bv-table tbody tr:hover {
		background: var(--color-gray-50);
	}

	.bv-table tbody tr:last-child td {
		border-bottom: none;
	}

	.cell-money {
		font-family: var(--font-family-mono);
		font-size: 0.8rem;
	}

	.cell-warning {
		font-weight: 600;
	}

	.cell-info {
		font-weight: 600;
	}

	.cell-link {
		font-weight: 600;
	}

	.projekt-link {
		color: #C41E3A;
		text-decoration: none;
		font-weight: 600;
	}

	.projekt-link:hover {
		text-decoration: underline;
	}

	.external-link {
		color: #C41E3A;
		text-decoration: none;
		font-size: 0.8rem;
	}

	.external-link:hover {
		text-decoration: underline;
	}

	.row-link {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-gray-400);
		text-decoration: none;
	}

	.row-link:hover {
		color: #C41E3A;
	}

	.chevron {
		color: inherit;
	}

	.empty-row td {
		padding: 0;
	}

	/* Mobile Cards */
	.mobile-cards {
		display: none;
		flex-direction: column;
		gap: 0.75rem;
	}

	.bv-card {
		display: block;
		background: white;
		border: 1px solid var(--color-gray-200);
		text-decoration: none;
		transition: all var(--transition-fast);
		border-radius: 0;
	}

	.bv-card:hover {
		border-color: var(--color-gray-300);
		box-shadow: var(--shadow-md);
	}

	.bv-card .card-header {
		display: flex;
		justify-content: flex-start;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-gray-100);
	}

	.bv-card .projekt-nr {
		font-size: 0.8rem;
		font-weight: 700;
		color: #C41E3A;
	}

	.bv-card .kunde {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--color-gray-600);
		flex: 1;
	}

	.card-badges {
		display: flex;
		gap: 0.25rem;
	}

	.bv-card .card-body {
		padding: 0.75rem 1rem;
	}

	.bv-card .adresse {
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-gray-800);
		margin: 0 0 0.25rem 0;
	}

	.bv-card .lage {
		font-size: 0.85rem;
		color: var(--color-gray-500);
	}

	.bv-card .card-footer {
		display: flex;
		gap: 1.5rem;
		padding: 0.75rem 1rem;
		background: var(--color-gray-50);
		border-top: 1px solid var(--color-gray-100);
	}

	.card-meta {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.meta-label {
		font-size: 0.65rem;
		color: var(--color-gray-500);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.meta-value {
		font-size: 0.85rem;
		color: var(--color-gray-700);
		font-weight: 500;
	}

	/* Loading & Error States */
	.loading-state,
	.error-state {
		text-align: center;
		padding: 4rem 2rem;
		background: white;
		border: 1px solid var(--color-gray-200);
		border-radius: 0;
	}

	.loading-state p,
	.error-state p {
		color: var(--color-gray-500);
		margin: 0;
	}

	.error-state p {
		color: var(--color-error);
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--color-gray-200);
		border-top-color: #C41E3A;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		margin: 0 auto 1rem;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.error-state button,
	.empty-state button {
		margin-top: 1rem;
		background: none;
		border: 1px solid var(--color-gray-300);
		padding: 0.5rem 1rem;
		cursor: pointer;
		font-size: 0.85rem;
		color: var(--color-gray-600);
		transition: all var(--transition-fast);
		border-radius: 0;
	}

	.error-state button:hover,
	.empty-state button:hover {
		background: var(--color-gray-50);
		border-color: var(--color-gray-400);
	}

	.empty-state {
		text-align: center;
		padding: 3rem 2rem;
		color: var(--color-gray-500);
	}

	.empty-state.mobile {
		background: white;
		border: 1px solid var(--color-gray-200);
		border-radius: 0;
	}

	/* Responsive */
	@media (max-width: 1024px) {
		.table-wrapper {
			display: none;
		}

		.mobile-cards {
			display: flex;
		}

		.page-header {
			flex-direction: column;
			gap: 1rem;
		}

		.btn-add {
			width: 100%;
			justify-content: center;
		}

		.phase-tab {
			min-width: auto;
			padding: 0.75rem 0.5rem;
		}

		.tab-label {
			font-size: 0.75rem;
		}
	}

	@media (max-width: 640px) {
		.phase-tabs {
			gap: 0;
		}

		.phase-tab {
			flex: 1;
			min-width: 0;
			flex-direction: column;
			gap: 0.25rem;
		}

		.tab-label {
			font-size: 0.7rem;
		}

		.tab-count {
			font-size: 0.6rem;
			padding: 0.05rem 0.3rem;
		}
	}
</style>
