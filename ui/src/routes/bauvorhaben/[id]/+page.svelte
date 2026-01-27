<script lang="ts">
	import { page } from '$app/state';
	import { Badge, Button } from '$lib/components/ui';
	import {
		PhaseVorbereitung,
		PhaseUmsetzung,
		PhaseRechnungenKunde,
		PhaseRechnungNU,
		PhaseNachkalkulation
	} from '$lib/components/bv-detail';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';

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
		matterportVorher: string | null;
		matterportNachher: string | null;
		heroLink: string | null;
		onedriveLink: string | null;
		onenoteLink: string | null;
		googleMapsLink: string | null;
		grundflaeche: number | null;
		umsatzNetto: number | null;
		budgetNU: number | null;
		marge: number | null;
		bvStart: string | null;
		bvEnde: string | null;
		kundeAnrede: string | null;
		kundeVorname: string | null;
		kundeNachname: string | null;
		kundeEmail: string | null;
		kundeTelefon: string | null;
		bauleiterEmail: string | null;
		bauleiterTelefon: string | null;
		titelfoto: string | null;
		columnValues: Record<string, unknown>;
	}

	interface Mangel {
		id: string;
		mangel_nr: string | null;
		status_mangel: string;
		art_des_mangels: string | null;
		beschreibung_mangel: string | null;
		nachunternehmer: string | null;
		datum_frist: string | null;
		fotos_mangel: unknown;
		created_at: string | null;
	}

	interface Nachtrag {
		id: string;
		nachtrag_nr: string;
		status: string;
		titel: string | null;
		beschreibung: string | null;
		betrag_kunde_netto: number | null;
		betrag_nu_netto: number | null;
		verzoegerung_tage: number | null;
		created_at: string | null;
	}

	interface Dokument {
		id: string;
		dokument_nr: string | null;
		art_des_dokuments: string | null;
		betrag_netto: number | null;
		betrag_brutto: number | null;
		betrag_bezahlt: number | null;
		betrag_offen: number | null;
		status: string | null;
		datum_erstellt: string | null;
		datum_zahlungsfrist: string | null;
		rechnungssteller: string | null;
		projektname: string | null;
		nua_nr: string | null;
		datei_url: string | null;
		sharepoint_link: string | null;
		freigabe_status: string | null;
	}

	interface Task {
		id: string;
		title: string;
		description: string | null;
		status: string;
		priority: string | null;
		due_date: string | null;
		assigned_to: string | null;
		category: string | null;
		percent_complete: number | null;
		planner_bucket_name: string | null;
	}

	interface NachunternehmerInfo {
		name: string;
		dokumente: Dokument[];
		summeNetto: number;
		summeBrutto: number;
		anzahlDokumente: number;
	}

	// SVG Icons (aus Sidebar)
	const icons: Record<string, string> = {
		home: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>`,
		building: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>`,
		user: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>`,
		wrench: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>`,
		file: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>`,
		checklist: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>`,
		calendar: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>`,
		check: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>`,
		alert: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>`,
		clipboard: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>`,
		hammer: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>`,
		chart: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>`,
		arrowLeft: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>`,
		external: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>`,
	};

	// BV-ID aus URL
	let bvId = $derived(page.params.id);

	// State
	let bv = $state<Bauvorhaben | null>(null);
	let maengel = $state<Mangel[]>([]);
	let nachtraege = $state<Nachtrag[]>([]);
	let dokumente = $state<Dokument[]>([]);
	let tasks = $state<Task[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let activeTab = $state('uebersicht');
	let dokumentFilter = $state('');
	let dokumentKategorie = $state('alle');

	// Edit States
	let editingKunde = $state(false);
	let editingTermine = $state(false);
	let editingUebersicht = $state(false);
	let saving = $state(false);
	let saveMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	// Edit Form Values - Kunde
	let editKundeAnrede = $state('');
	let editKundeVorname = $state('');
	let editKundeNachname = $state('');
	let editKundeEmail = $state('');
	let editKundeTelefon = $state('');

	// Edit Form Values - Termine
	let editBvStart = $state('');
	let editBvEnde = $state('');

	// Edit Form Values - Uebersicht
	let editGrundflaeche = $state<number | null>(null);
	let editUmsatzNetto = $state<number | null>(null);
	let editBudgetNU = $state<number | null>(null);
	let editMarge = $state<number | null>(null);

	// Nachweise Edit State
	let nachweiseEditMode = $state(false);
	let nachweiseLinks = $state<Record<string, string>>({});

	// Helper: column_values aktualisieren
	function updateColumnValue(columnValues: Record<string, unknown>, fieldId: string, textValue: string): Record<string, unknown> {
		const existing = columnValues[fieldId] as { text?: string; value?: string } | undefined;
		return {
			...columnValues,
			[fieldId]: {
				...existing,
				text: textValue,
				value: JSON.stringify(textValue)
			}
		};
	}

	// Helper: Datum im column_values Format aktualisieren
	function updateDateColumnValue(columnValues: Record<string, unknown>, fieldId: string, dateStr: string): Record<string, unknown> {
		return {
			...columnValues,
			[fieldId]: {
				text: dateStr,
				value: JSON.stringify({ date: dateStr })
			}
		};
	}

	// Helper: Zahl im column_values Format aktualisieren
	function updateNumberColumnValue(columnValues: Record<string, unknown>, fieldId: string, numValue: number | null): Record<string, unknown> {
		if (numValue === null) {
			return {
				...columnValues,
				[fieldId]: { text: '', value: null }
			};
		}
		return {
			...columnValues,
			[fieldId]: {
				text: String(numValue),
				value: JSON.stringify(String(numValue))
			}
		};
	}

	// Edit-Modus fuer Kunde starten
	function startEditKunde() {
		if (!bv) return;
		editKundeAnrede = bv.kundeAnrede || '';
		editKundeVorname = bv.kundeVorname || '';
		editKundeNachname = bv.kundeNachname || '';
		editKundeEmail = bv.kundeEmail || '';
		editKundeTelefon = bv.kundeTelefon || '';
		editingKunde = true;
		saveMessage = null;
	}

	// Edit-Modus fuer Termine starten
	function startEditTermine() {
		if (!bv) return;
		editBvStart = bv.bvStart || '';
		editBvEnde = bv.bvEnde || '';
		editingTermine = true;
		saveMessage = null;
	}

	// Edit-Modus fuer Uebersicht starten
	function startEditUebersicht() {
		if (!bv) return;
		editGrundflaeche = bv.grundflaeche;
		editUmsatzNetto = bv.umsatzNetto;
		editBudgetNU = bv.budgetNU;
		editMarge = bv.marge;
		editingUebersicht = true;
		saveMessage = null;
	}

	// Speichern: Kunde
	async function saveKunde() {
		if (!bv) return;
		saving = true;
		saveMessage = null;

		try {
			let newColumnValues = { ...bv.columnValues };
			newColumnValues = updateColumnValue(newColumnValues, 'text_1__1', editKundeAnrede);
			newColumnValues = updateColumnValue(newColumnValues, 'text573__1', editKundeVorname);
			newColumnValues = updateColumnValue(newColumnValues, 'text57__1', editKundeNachname);

			// E-Mail Feld hat spezielles Format
			newColumnValues = {
				...newColumnValues,
				'e_mail4__1': {
					text: editKundeEmail,
					value: JSON.stringify({ text: editKundeEmail, email: editKundeEmail })
				}
			};

			// Telefon Feld hat spezielles Format
			newColumnValues = {
				...newColumnValues,
				'telefon___kunde__1': {
					text: editKundeTelefon,
					value: JSON.stringify({ phone: editKundeTelefon, countryShortName: 'DE' })
				}
			};

			const { error: updateError } = await supabase
				.from('monday_bauprozess')
				.update({ column_values: newColumnValues })
				.eq('id', bv.id);

			if (updateError) throw updateError;

			// Optimistic UI Update
			bv = {
				...bv,
				kundeAnrede: editKundeAnrede,
				kundeVorname: editKundeVorname,
				kundeNachname: editKundeNachname,
				kundeEmail: editKundeEmail,
				kundeTelefon: editKundeTelefon,
				columnValues: newColumnValues
			};

			editingKunde = false;
			saveMessage = { type: 'success', text: 'Kundendaten gespeichert!' };
			setTimeout(() => saveMessage = null, 3000);
		} catch (e) {
			console.error('Fehler beim Speichern:', e);
			saveMessage = { type: 'error', text: 'Fehler beim Speichern der Kundendaten' };
		} finally {
			saving = false;
		}
	}

	// Speichern: Termine
	async function saveTermine() {
		if (!bv) return;
		saving = true;
		saveMessage = null;

		try {
			let newColumnValues = { ...bv.columnValues };
			newColumnValues = updateDateColumnValue(newColumnValues, 'datum2__1', editBvStart);
			newColumnValues = updateDateColumnValue(newColumnValues, 'datum7__1', editBvEnde);

			const { error: updateError } = await supabase
				.from('monday_bauprozess')
				.update({ column_values: newColumnValues })
				.eq('id', bv.id);

			if (updateError) throw updateError;

			// Optimistic UI Update
			bv = {
				...bv,
				bvStart: editBvStart,
				bvEnde: editBvEnde,
				columnValues: newColumnValues
			};

			editingTermine = false;
			saveMessage = { type: 'success', text: 'Termine gespeichert!' };
			setTimeout(() => saveMessage = null, 3000);
		} catch (e) {
			console.error('Fehler beim Speichern:', e);
			saveMessage = { type: 'error', text: 'Fehler beim Speichern der Termine' };
		} finally {
			saving = false;
		}
	}

	// Speichern: Uebersicht (Kennzahlen)
	async function saveUebersicht() {
		if (!bv) return;
		saving = true;
		saveMessage = null;

		try {
			let newColumnValues = { ...bv.columnValues };
			newColumnValues = updateNumberColumnValue(newColumnValues, 'zahlen_mkm2n68z', editGrundflaeche);
			newColumnValues = updateNumberColumnValue(newColumnValues, 'zahlen1__1', editUmsatzNetto);
			newColumnValues = updateNumberColumnValue(newColumnValues, 'numeric_mkp7hv0t', editBudgetNU);
			newColumnValues = updateNumberColumnValue(newColumnValues, 'numeric_mkpg3ayz', editMarge);

			const { error: updateError } = await supabase
				.from('monday_bauprozess')
				.update({ column_values: newColumnValues })
				.eq('id', bv.id);

			if (updateError) throw updateError;

			// Optimistic UI Update
			bv = {
				...bv,
				grundflaeche: editGrundflaeche,
				umsatzNetto: editUmsatzNetto,
				budgetNU: editBudgetNU,
				marge: editMarge,
				columnValues: newColumnValues
			};

			editingUebersicht = false;
			saveMessage = { type: 'success', text: 'Kennzahlen gespeichert!' };
			setTimeout(() => saveMessage = null, 3000);
		} catch (e) {
			console.error('Fehler beim Speichern:', e);
			saveMessage = { type: 'error', text: 'Fehler beim Speichern der Kennzahlen' };
		} finally {
			saving = false;
		}
	}

	// Nachweis-Status umschalten (markieren als vorhanden/fehlend)
	async function toggleNachweis(key: string, currentlyVorhanden: boolean) {
		// TODO: Implementierung - Nachweise in separater Tabelle speichern
		console.log('Toggle Nachweis:', key, !currentlyVorhanden);
		saveMessage = { type: 'success', text: 'Nachweis-Status aktualisiert (Demo)' };
		setTimeout(() => saveMessage = null, 3000);
	}

	// Abbrechen
	function cancelEdit() {
		editingKunde = false;
		editingTermine = false;
		editingUebersicht = false;
		saveMessage = null;
	}

	// Allgemeine Info Tabs (OBEN)
	const infoTabs = [
		{ id: 'uebersicht', label: 'Uebersicht', icon: 'chart' },
		{ id: 'kunde', label: 'Kunde', icon: 'user' },
		{ id: 'nu', label: 'NU', icon: 'wrench' },
		{ id: 'dokumente', label: 'Dokumente', icon: 'file' },
		{ id: 'aufgaben', label: 'Aufgaben', icon: 'checklist' },
		{ id: 'termine', label: 'Termine', icon: 'calendar' },
		{ id: 'abnahmen', label: 'Abnahmen', icon: 'check' },
		{ id: 'maengel', label: 'Maengel', icon: 'alert' },
		{ id: 'nachweise', label: 'Nachweise', icon: 'clipboard' },
		{ id: 'gewerke', label: 'Gewerke', icon: 'hammer' },
	];

	// Bauphasen-Tabs (UNTEN nach Separator)
	const phasenTabs = [
		{ id: 'phase0', label: '(0) Bedarfsanalyse', phase: 0 },
		{ id: 'phase1', label: '(1) Angebot', phase: 1 },
		{ id: 'phase2', label: '(2) Auftrag', phase: 2 },
		{ id: 'phase3', label: '(3) Vorbereitung', phase: 3 },
		{ id: 'phase4', label: '(4) Umsetzung', phase: 4 },
		{ id: 'phase5', label: '(5) Rechnungen', phase: 5 },
		{ id: 'phase6', label: '(6) Nachkalkulation', phase: 6 },
	];

	// Phasen-Labels fuer Status-Bar
	const phasenLabels = [
		{ nr: '0', name: 'Bedarfsanalyse', short: 'Bedarf' },
		{ nr: '1', name: 'Angebot', short: 'Angebot' },
		{ nr: '2', name: 'Auftrag/AB', short: 'Auftrag' },
		{ nr: '3', name: 'Vorbereitung', short: 'Vorber.' },
		{ nr: '4', name: 'Umsetzung', short: 'Umsetz.' },
		{ nr: '5', name: 'Rechnungen', short: 'Rechnung' },
		{ nr: '6', name: 'Nachkalkulation', short: 'Nachkalk.' }
	];

	// Gewerke (aus Monday column_values extrahiert)
	const gewerkeDefinition = [
		{ key: 'entkernung', name: 'Entkernung', statusKey: 'dup__of_entkernung__1' },
		{ key: 'maurer', name: 'Maurer & Trockenbau', statusKey: 'color58__1' },
		{ key: 'elektrik', name: 'Elektrik', statusKey: 'color63__1' },
		{ key: 'echeck', name: 'E-Check', statusKey: 'color93__1' },
		{ key: 'sanitaer', name: 'Bad & Sanitaer', statusKey: 'color65__1' },
		{ key: 'heizung', name: 'Heizung', statusKey: 'color49__1' },
		{ key: 'waende', name: 'Waende & Decken', statusKey: 'color98__1' },
		{ key: 'boden', name: 'Boden', statusKey: 'color05__1' },
		{ key: 'tischler', name: 'Tischler', statusKey: 'color15__1' },
		{ key: 'reinigung', name: 'Endreinigung', statusKey: 'color42__1' },
		{ key: 'vorabnahme', name: 'Vorabnahme intern', statusKey: 'color45__1' },
		{ key: 'endabnahme', name: 'Endabnahme Kunde', statusKey: 'color72__1' },
	];

	// Nachweise-Definition (fuer BV)
	const nachweiseDefinition = [
		{ key: 'rohinstallation_elektrik', name: 'Rohinstallation Elektrik', required: true },
		{ key: 'sanitaer_rohinstallation', name: 'Sanitaer Rohinstallation', required: true },
		{ key: 'abdichtung_bad', name: 'Abdichtung Bad', required: true },
		{ key: 'echeck_protokoll', name: 'E-Check Protokoll', required: true },
		{ key: 'brandschutz_nachweis', name: 'Nachweis Brandschutz (Fotos von Aufklebern)', required: true },
	];

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

	// Extrahiere Feld aus column_values
	function extractField(columnValues: Record<string, unknown>, fieldId: string): string | null {
		try {
			const field = columnValues[fieldId] as { text?: string; value?: string } | undefined;
			if (!field) return null;
			return field.text || null;
		} catch {
			return null;
		}
	}

	// Extrahiere Link aus column_values
	function extractLink(columnValues: Record<string, unknown>, fieldId: string): string | null {
		try {
			const field = columnValues[fieldId] as { text?: string; value?: string } | undefined;
			if (!field) return null;
			if (field.value) {
				const parsed = JSON.parse(field.value);
				return parsed?.url || field.text || null;
			}
			return field.text || null;
		} catch {
			return null;
		}
	}

	// Extrahiere Zahl aus column_values
	function extractNumber(columnValues: Record<string, unknown>, fieldId: string): number | null {
		try {
			const text = extractField(columnValues, fieldId);
			if (!text) return null;
			const num = parseFloat(text.replace(',', '.'));
			return isNaN(num) ? null : num;
		} catch {
			return null;
		}
	}

	// Extrahiere Bild-URL aus column_values (fuer Titelfoto)
	function extractImageUrl(columnValues: Record<string, unknown>, fieldId: string): string | null {
		try {
			const field = columnValues[fieldId] as { text?: string; value?: string; files?: Array<{url: string}> } | undefined;
			if (!field) return null;
			if (field.files && field.files.length > 0) {
				return field.files[0].url;
			}
			if (field.value) {
				try {
					const parsed = JSON.parse(field.value);
					if (parsed?.files && parsed.files.length > 0) {
						return parsed.files[0].url || parsed.files[0].publicUrl;
					}
				} catch { /* ignore */ }
			}
			return field.text || null;
		} catch {
			return null;
		}
	}

	// Daten laden
	async function loadData() {
		loading = true;
		error = null;

		try {
			// Lade Bauvorhaben
			const { data: mondayData, error: mondayError } = await supabase
				.from('monday_bauprozess')
				.select('*')
				.eq('id', bvId)
				.single();

			if (mondayError) throw mondayError;
			if (!mondayData) throw new Error('Bauvorhaben nicht gefunden');

			const { phase, label: phaseLabel } = parsePhase(mondayData.group_title || '');
			const { kunde, adresse, lage, bauleiter } = parseName(mondayData.name || '');
			const columnValues = mondayData.column_values || {};

			// Projekt-Nr extrahieren
			const projektNr = extractField(columnValues, 'text49__1') || extractField(columnValues, 'text_mkknjtn5');

			// Titelfoto extrahieren (Feld-ID muss ggf. angepasst werden)
			const titelfoto = extractImageUrl(columnValues, 'file__1') || extractImageUrl(columnValues, 'titelfoto');

			bv = {
				id: mondayData.id,
				name: mondayData.name,
				group_title: mondayData.group_title,
				phase,
				phaseLabel,
				kunde,
				adresse,
				lage,
				bauleiter: extractField(columnValues, 'text_mkn8ggev') || bauleiter,
				projektNr,
				matterportVorher: extractLink(columnValues, 'link_mkkby3cj'),
				matterportNachher: extractLink(columnValues, 'link_mkpmh0h6'),
				heroLink: extractLink(columnValues, 'link__1'),
				onedriveLink: extractLink(columnValues, 'link_1__1'),
				onenoteLink: extractLink(columnValues, 'link_mknhrdg0'),
				googleMapsLink: extractLink(columnValues, 'link_mkn8k6sr'),
				grundflaeche: extractNumber(columnValues, 'zahlen_mkm2n68z'),
				umsatzNetto: extractNumber(columnValues, 'zahlen1__1') || extractNumber(columnValues, 'numeric65__1'),
				budgetNU: extractNumber(columnValues, 'numeric_mkp7hv0t'),
				marge: extractNumber(columnValues, 'numeric_mkpg3ayz'),
				bvStart: extractField(columnValues, 'datum2__1'),
				bvEnde: extractField(columnValues, 'datum7__1'),
				kundeAnrede: extractField(columnValues, 'text_1__1'),
				kundeVorname: extractField(columnValues, 'text573__1'),
				kundeNachname: extractField(columnValues, 'text57__1'),
				kundeEmail: extractField(columnValues, 'e_mail4__1'),
				kundeTelefon: extractField(columnValues, 'telefon___kunde__1'),
				bauleiterEmail: extractField(columnValues, 'e_mail0__1'),
				bauleiterTelefon: extractField(columnValues, 'telefon__1'),
				titelfoto,
				columnValues
			};

			// Lade zugehoerige Daten parallel
			if (projektNr) {
				const [maengelResult, nachtraegeResult, dokumenteResult] = await Promise.all([
					supabase
						.from('maengel_fertigstellung')
						.select('id, mangel_nr, status_mangel, art_des_mangels, beschreibung_mangel, nachunternehmer, datum_frist, fotos_mangel, created_at')
						.eq('projekt_nr', projektNr)
						.order('created_at', { ascending: false }),
					supabase
						.from('nachtraege')
						.select('id, nachtrag_nr, status, titel, beschreibung, betrag_kunde_netto, betrag_nu_netto, verzoegerung_tage, created_at')
						.eq('atbs_nummer', projektNr)
						.order('created_at', { ascending: false }),
					supabase
						.from('softr_dokumente')
						.select('id, dokument_nr, art_des_dokuments, betrag_netto, betrag_brutto, betrag_bezahlt, betrag_offen, status, datum_erstellt, datum_zahlungsfrist, rechnungssteller, projektname, nua_nr, datei_url, sharepoint_link, freigabe_status')
						.eq('atbs_nummer', projektNr)
						.order('datum_erstellt', { ascending: false })
				]);

				if (!maengelResult.error && maengelResult.data) {
					maengel = maengelResult.data;
				}
				if (!nachtraegeResult.error && nachtraegeResult.data) {
					nachtraege = nachtraegeResult.data;
				}
				if (!dokumenteResult.error && dokumenteResult.data) {
					dokumente = dokumenteResult.data;
				}
			}

			// Lade Tasks - suche nach Projekt-Nr oder Adresse
			const searchTerms = [projektNr, bv.adresse].filter(Boolean);
			if (searchTerms.length > 0) {
				const orConditions = searchTerms.map(term => `title.ilike.%${term}%`).join(',');
				const { data: tasksData } = await supabase
					.from('tasks')
					.select('id, title, description, status, priority, due_date, assigned_to, category, percent_complete, planner_bucket_name')
					.or(orConditions)
					.order('due_date', { ascending: true })
					.limit(50);

				if (tasksData) {
					tasks = tasksData;
				}
			}

		} catch (e) {
			error = e instanceof Error ? e.message : 'Fehler beim Laden der Daten';
			console.error('Fehler:', e);
		} finally {
			loading = false;
		}
	}

	// Berechnungen
	let gewerke = $derived(gewerkeDefinition.map(g => ({
		...g,
		status: bv ? extractField(bv.columnValues, g.statusKey) || 'Geplant' : 'Geplant'
	})));

	let erledigteGewerke = $derived(gewerke.filter(g =>
		g.status === 'Erledigt' || g.status === 'Abgeschlossen'
	).length);
	let gewerkeProgress = $derived(Math.round((erledigteGewerke / gewerke.length) * 100));
	let offeneMaengel = $derived(maengel.filter(m => m.status_mangel !== '(2) Abgeschlossen').length);
	let offeneNachtraege = $derived(nachtraege.filter(n => n.status === '(0) Offen' || n.status === '(1) Preis eingegeben').length);
	let offeneTasks = $derived(tasks.filter(t => t.status !== 'completed').length);

	// Dokumente filtern
	let dokumenteFiltered = $derived(dokumente.filter(d => {
		const matchesSearch = !dokumentFilter ||
			(d.dokument_nr?.toLowerCase().includes(dokumentFilter.toLowerCase())) ||
			(d.rechnungssteller?.toLowerCase().includes(dokumentFilter.toLowerCase()));
		const matchesKategorie = dokumentKategorie === 'alle' || d.art_des_dokuments === dokumentKategorie;
		return matchesSearch && matchesKategorie;
	}));

	// Dokument-Kategorien (sortiert nach Haeufigkeit)
	let dokumentKategorien = $derived([...new Set(dokumente.map(d => d.art_des_dokuments).filter(Boolean))].sort());

	// Dokumente nach Typ gruppieren
	let dokumenteAR = $derived(dokumente.filter(d => d.art_des_dokuments?.startsWith('AR')));
	let dokumenteER = $derived(dokumente.filter(d => d.art_des_dokuments?.startsWith('ER')));
	let dokumenteANG = $derived(dokumente.filter(d => d.art_des_dokuments?.startsWith('ANG')));
	let dokumenteAB = $derived(dokumente.filter(d => d.art_des_dokuments?.startsWith('AB')));
	let dokumenteNUA = $derived(dokumente.filter(d => d.art_des_dokuments?.startsWith('NUA')));

	// Nachunternehmer aus NU-Dokumenten extrahieren (ER-NU, NUA)
	let nachunternehmerListe = $derived.by(() => {
		const nuDokumente = dokumente.filter(d =>
			d.art_des_dokuments?.includes('NU') ||
			d.art_des_dokuments?.startsWith('NUA')
		);

		const grouped = new Map<string, Dokument[]>();
		for (const dok of nuDokumente) {
			const name = dok.rechnungssteller || 'Unbekannt';
			if (!grouped.has(name)) {
				grouped.set(name, []);
			}
			grouped.get(name)!.push(dok);
		}

		return Array.from(grouped.entries()).map(([name, docs]) => ({
			name,
			dokumente: docs,
			summeNetto: docs.reduce((sum, d) => sum + (d.betrag_netto || 0), 0),
			summeBrutto: docs.reduce((sum, d) => sum + (d.betrag_brutto || 0), 0),
			anzahlDokumente: docs.length
		})) as NachunternehmerInfo[];
	});

	// Summen berechnen
	let summeARNetto = $derived(dokumenteAR.reduce((sum, d) => sum + (d.betrag_netto || 0), 0));
	let summeERNetto = $derived(dokumenteER.reduce((sum, d) => sum + (d.betrag_netto || 0), 0));
	let summeARBrutto = $derived(dokumenteAR.reduce((sum, d) => sum + (d.betrag_brutto || 0), 0));
	let summeERBrutto = $derived(dokumenteER.reduce((sum, d) => sum + (d.betrag_brutto || 0), 0));

	// Rohertrag berechnen
	let rohertrag = $derived(bv && bv.umsatzNetto && bv.budgetNU ? bv.umsatzNetto - bv.budgetNU : null);
	let rohertragsquote = $derived(bv && bv.umsatzNetto && rohertrag ? Math.round((rohertrag / bv.umsatzNetto) * 100) : null);

	// Nachweis-Status (pruefen ob Dokumente vorhanden sind)
	let nachweiseStatus = $derived(nachweiseDefinition.map(n => {
		// Suche nach passenden Dokumenten (z.B. E-Check Protokoll in Dokumenten)
		const found = dokumente.some(d =>
			d.dokument_nr?.toLowerCase().includes(n.key.replace('_', ' ')) ||
			d.art_des_dokuments?.toLowerCase().includes(n.key.replace('_', ' '))
		);
		return { ...n, vorhanden: found };
	}));

	// Task-Statistiken
	let completedTasks = $derived(tasks.filter(t => t.status === 'completed').length);
	let inProgressTasks = $derived(tasks.filter(t => t.status === 'in_progress' || t.status === 'inProgress').length);
	let overdueTasks = $derived(tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed').length);

	// Termin-Berechnungen
	let heute = $derived(new Date());
	let startDate = $derived(bv?.bvStart ? new Date(bv.bvStart) : null);
	let endDate = $derived(bv?.bvEnde ? new Date(bv.bvEnde) : null);
	let totalDays = $derived(startDate && endDate ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : 0);
	let elapsedDays = $derived(startDate ? Math.ceil((heute.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : 0);
	let progressPercent = $derived(totalDays > 0 ? Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100)) : 0);
	let remainingDays = $derived(endDate ? Math.ceil((endDate.getTime() - heute.getTime()) / (1000 * 60 * 60 * 24)) : 0);

	// Nachweis-Fortschritt
	let vorhandeneNachweise = $derived(nachweiseStatus.filter(n => n.vorhanden).length);
	let pflichtNachweise = $derived(nachweiseStatus.filter(n => n.required).length);
	let vorhandenePflicht = $derived(nachweiseStatus.filter(n => n.required && n.vorhanden).length);

	// Faellige Aufgaben
	let upcomingTasks = $derived(tasks.filter(t => t.due_date && t.status !== 'completed').sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()).slice(0, 5));

	// NU-Dokumente
	let nuDokumente = $derived(dokumente.filter(d => d.art_des_dokuments?.includes('NU') || d.art_des_dokuments?.startsWith('NUA')));

	// Sonstige Dokumente
	let sonstigeDokumente = $derived(dokumente.filter(d => d.art_des_dokuments === 'S Sonstiges'));

	// Formatierung
	function formatCurrency(value: number | null): string {
		if (value === null || value === undefined) return '-';
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
			year: 'numeric'
		});
	}

	function getStatusVariant(status: string): 'success' | 'warning' | 'error' | 'default' | 'info' {
		const lower = status.toLowerCase();
		if (lower.includes('erledigt') || lower.includes('abgeschlossen') || lower.includes('genehmigt') || lower.includes('bezahlt')) return 'success';
		if (lower.includes('arbeit') || lower.includes('pruefung') || lower.includes('eingegeben')) return 'warning';
		if (lower.includes('offen') || lower.includes('abgelehnt') || lower.includes('ueberfaellig')) return 'error';
		if (lower.includes('geplant') || lower.includes('termin')) return 'info';
		return 'default';
	}

	function getFotoCount(fotos: unknown): number {
		if (!fotos) return 0;
		if (Array.isArray(fotos)) return fotos.length;
		return 0;
	}

	onMount(() => {
		loadData();
	});
</script>

<div class="bv-detail">
	{#if loading}
		<div class="loading-state">
			<div class="spinner-lg"></div>
			<p>Lade Bauvorhaben...</p>
		</div>
	{:else if error}
		<div class="error-state">
			<p>Fehler: {error}</p>
			<a href="/bauvorhaben" class="back-link">Zurueck zur Uebersicht</a>
		</div>
	{:else if bv}
		<!-- Breadcrumb -->
		<nav class="breadcrumb">
			<a href="/" class="breadcrumb-link">Startseite</a>
			<span class="breadcrumb-sep">/</span>
			<a href="/bauvorhaben" class="breadcrumb-link">Bauvorhaben</a>
			<span class="breadcrumb-sep">/</span>
			<span class="breadcrumb-current">
				<strong>{bv.projektNr || 'BV'}</strong> {bv.adresse}
			</span>
		</nav>

		<!-- Hero-Bereich -->
		<div class="hero-section">
			<!-- Links: Titelfoto -->
			<div class="hero-image">
				{#if bv.titelfoto}
					<img src={bv.titelfoto} alt="Titelfoto {bv.adresse}" />
				{:else}
					<div class="hero-placeholder">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="48" height="48">
							{@html icons.building}
						</svg>
						<span>Kein Foto</span>
					</div>
				{/if}
			</div>

			<!-- Rechts: Info + Status-Bar -->
			<div class="hero-content">
				<h1 class="hero-title">
					<strong>{bv.projektNr || ''}</strong> {bv.projektNr ? '|' : ''} {bv.kunde} - {bv.adresse}
				</h1>
				<p class="hero-subtitle">{bv.lage || ''} {bv.bauleiter ? `| Bauleiter: ${bv.bauleiter}` : ''}</p>

				<!-- Status-Bar mit eckigen Phasen und Namen -->
				<div class="phase-status-bar">
					{#each phasenLabels as phase, i}
						<div class="phase-step" class:active={i === bv.phase} class:completed={i < bv.phase} class:future={i > bv.phase}>
							{#if i > 0}
								<div class="phase-line" class:completed={i <= bv.phase}></div>
							{/if}
							<div class="phase-item">
								<div class="phase-box">
									{phase.nr}
								</div>
								<span class="phase-name">{phase.name}</span>
								<span class="phase-name-short">{phase.short}</span>
							</div>
						</div>
					{/each}
				</div>

				<!-- Externe Links -->
				<div class="hero-links">
					{#if bv.heroLink}
						<a href={bv.heroLink} target="_blank" class="hero-link hero">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
								{@html icons.external}
							</svg>
							HERO
						</a>
					{/if}
					{#if bv.onedriveLink}
						<a href={bv.onedriveLink} target="_blank" class="hero-link">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
								{@html icons.file}
							</svg>
							OneDrive
						</a>
					{/if}
					{#if bv.onenoteLink}
						<a href={bv.onenoteLink} target="_blank" class="hero-link">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
								{@html icons.clipboard}
							</svg>
							OneNote
						</a>
					{/if}
					{#if bv.matterportVorher}
						<a href={bv.matterportVorher} target="_blank" class="hero-link">
							3D vorher
						</a>
					{/if}
					{#if bv.matterportNachher}
						<a href={bv.matterportNachher} target="_blank" class="hero-link">
							3D nachher
						</a>
					{/if}
				</div>
			</div>
		</div>

		<!-- Tab Navigation -->
		<nav class="tabs-nav">
			<div class="tabs-scroll">
				<!-- Info Tabs -->
				{#each infoTabs as tab}
					<button
						class="tab-btn"
						class:active={activeTab === tab.id}
						onclick={() => activeTab = tab.id}
					>
						<svg class="tab-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
							{@html icons[tab.icon] || icons.chart}
						</svg>
						<span class="tab-label">{tab.label}</span>
						{#if tab.id === 'maengel' && offeneMaengel > 0}
							<span class="tab-badge error">{offeneMaengel}</span>
						{:else if tab.id === 'aufgaben' && offeneTasks > 0}
							<span class="tab-badge warning">{offeneTasks}</span>
						{:else if tab.id === 'dokumente'}
							<span class="tab-badge">{dokumente.length}</span>
						{/if}
					</button>
				{/each}

				<!-- Separator -->
				<span class="tabs-separator"></span>

				<!-- Phasen Tabs -->
				{#each phasenTabs as tab}
					<button
						class="tab-btn phase-tab"
						class:active={activeTab === tab.id}
						class:current-phase={tab.phase === bv.phase}
						onclick={() => activeTab = tab.id}
					>
						<span class="tab-label">{tab.label}</span>
					</button>
				{/each}
			</div>
		</nav>

		<!-- Tab Content -->
		<div class="tab-content">
			<!-- UEBERSICHT TAB -->
			{#if activeTab === 'uebersicht'}
				<div class="tab-panel">
					<!-- Speicher-Meldung -->
					{#if saveMessage}
						<div class="save-message" class:success={saveMessage.type === 'success'} class:error={saveMessage.type === 'error'}>
							{saveMessage.text}
						</div>
					{/if}

					<!-- Kennzahlen Header mit Edit-Button -->
					<div class="section-header">
						<h3 class="section-title">Kennzahlen</h3>
						{#if !editingUebersicht}
							<Button variant="secondary" onclick={startEditUebersicht}>
								Bearbeiten
							</Button>
						{/if}
					</div>

					{#if editingUebersicht}
						<!-- Edit-Modus fuer Kennzahlen -->
						<div class="edit-form">
							<div class="form-grid form-grid-4">
								<div class="form-group">
									<label class="form-label" for="editGrundflaeche">Grundflaeche (m2)</label>
									<input
										type="number"
										id="editGrundflaeche"
										class="form-input"
										bind:value={editGrundflaeche}
										placeholder="z.B. 85"
										step="0.01"
									/>
								</div>
								<div class="form-group">
									<label class="form-label" for="editUmsatzNetto">Umsatz netto (EUR)</label>
									<input
										type="number"
										id="editUmsatzNetto"
										class="form-input"
										bind:value={editUmsatzNetto}
										placeholder="z.B. 45000"
										step="0.01"
									/>
								</div>
								<div class="form-group">
									<label class="form-label" for="editBudgetNU">Budget NU (EUR)</label>
									<input
										type="number"
										id="editBudgetNU"
										class="form-input"
										bind:value={editBudgetNU}
										placeholder="z.B. 30000"
										step="0.01"
									/>
								</div>
								<div class="form-group">
									<label class="form-label" for="editMarge">Marge (%)</label>
									<input
										type="number"
										id="editMarge"
										class="form-input"
										bind:value={editMarge}
										placeholder="z.B. 25"
										step="0.1"
									/>
								</div>
							</div>
							<div class="form-actions">
								<Button variant="primary" onclick={saveUebersicht} disabled={saving}>
									{saving ? 'Speichern...' : 'Speichern'}
								</Button>
								<Button variant="ghost" onclick={cancelEdit} disabled={saving}>
									Abbrechen
								</Button>
							</div>
						</div>
					{:else}
						<!-- KPI Cards -->
						<div class="kpi-grid">
							<div class="kpi-card">
								<span class="kpi-label">Bauleiter</span>
								<span class="kpi-value">{bv.bauleiter || '-'}</span>
								{#if bv.bauleiterEmail}
									<a href="mailto:{bv.bauleiterEmail}" class="kpi-link">{bv.bauleiterEmail}</a>
								{/if}
							</div>
							<div class="kpi-card">
								<span class="kpi-label">Nachunternehmer</span>
								<span class="kpi-value">{nachunternehmerListe.length}</span>
								<span class="kpi-sub">{nachunternehmerListe.length === 1 ? 'zugewiesen' : 'aus Dokumenten'}</span>
							</div>
							<div class="kpi-card">
								<span class="kpi-label">Grundflaeche</span>
								<span class="kpi-value">{bv.grundflaeche ? `${bv.grundflaeche} m2` : '-'}</span>
							</div>
							<div class="kpi-card">
								<span class="kpi-label">Umsatz (netto)</span>
								<span class="kpi-value currency">{formatCurrency(bv.umsatzNetto)}</span>
							</div>
							<div class="kpi-card">
								<span class="kpi-label">Budget NU</span>
								<span class="kpi-value currency">{formatCurrency(bv.budgetNU)}</span>
							</div>
							<div class="kpi-card highlight">
								<span class="kpi-label">Rohertrag</span>
								<span class="kpi-value currency">{formatCurrency(rohertrag)}</span>
								{#if rohertragsquote !== null}
									<span class="kpi-sub success">{rohertragsquote}% Marge</span>
								{/if}
							</div>
						</div>
					{/if}

					<!-- Bauzeiten -->
					<div class="section">
						<h3 class="section-title">Bauzeiten</h3>
						<div class="info-grid">
							<div class="info-item">
								<span class="info-label">BV Start</span>
								<span class="info-value">{formatDate(bv.bvStart)}</span>
							</div>
							<div class="info-item">
								<span class="info-label">BV Ende</span>
								<span class="info-value">{formatDate(bv.bvEnde)}</span>
							</div>
						</div>
					</div>

					<!-- Schnelluebersicht -->
					<div class="section">
						<h3 class="section-title">Status-Uebersicht</h3>
						<div class="status-grid">
							<div class="status-item" class:error={offeneMaengel > 0}>
								<span class="status-count">{offeneMaengel}</span>
								<span class="status-label">Offene Maengel</span>
							</div>
							<div class="status-item" class:warning={offeneNachtraege > 0}>
								<span class="status-count">{offeneNachtraege}</span>
								<span class="status-label">Offene Nachtraege</span>
							</div>
							<div class="status-item">
								<span class="status-count">{dokumente.length}</span>
								<span class="status-label">Dokumente</span>
							</div>
							<div class="status-item">
								<span class="status-count">{gewerkeProgress}%</span>
								<span class="status-label">Gewerke erledigt</span>
							</div>
						</div>
					</div>
				</div>

			<!-- KUNDE TAB -->
			{:else if activeTab === 'kunde'}
				<div class="tab-panel">
					<!-- Speicher-Meldung -->
					{#if saveMessage}
						<div class="save-message" class:success={saveMessage.type === 'success'} class:error={saveMessage.type === 'error'}>
							{saveMessage.text}
						</div>
					{/if}

					<div class="section">
						<div class="section-header">
							<h3 class="section-title">Kundendaten</h3>
							{#if !editingKunde}
								<Button variant="secondary" onclick={startEditKunde}>
									Bearbeiten
								</Button>
							{/if}
						</div>

						{#if editingKunde}
							<!-- Edit-Modus -->
							<div class="edit-form">
								<div class="form-grid">
									<div class="form-group">
										<label class="form-label" for="kundeAnrede">Anrede</label>
										<select id="kundeAnrede" class="form-select" bind:value={editKundeAnrede}>
											<option value="">-- Bitte waehlen --</option>
											<option value="Herr">Herr</option>
											<option value="Frau">Frau</option>
											<option value="Firma">Firma</option>
										</select>
									</div>
									<div class="form-group">
										<label class="form-label" for="kundeVorname">Vorname</label>
										<input
											type="text"
											id="kundeVorname"
											class="form-input"
											bind:value={editKundeVorname}
											placeholder="Vorname"
										/>
									</div>
									<div class="form-group">
										<label class="form-label" for="kundeNachname">Nachname</label>
										<input
											type="text"
											id="kundeNachname"
											class="form-input"
											bind:value={editKundeNachname}
											placeholder="Nachname"
										/>
									</div>
									<div class="form-group">
										<label class="form-label" for="kundeEmail">E-Mail</label>
										<input
											type="email"
											id="kundeEmail"
											class="form-input"
											bind:value={editKundeEmail}
											placeholder="kunde@beispiel.de"
										/>
									</div>
									<div class="form-group">
										<label class="form-label" for="kundeTelefon">Telefon</label>
										<input
											type="tel"
											id="kundeTelefon"
											class="form-input"
											bind:value={editKundeTelefon}
											placeholder="+49..."
										/>
									</div>
								</div>
								<div class="form-actions">
									<Button variant="primary" onclick={saveKunde} disabled={saving}>
										{saving ? 'Speichern...' : 'Speichern'}
									</Button>
									<Button variant="ghost" onclick={cancelEdit} disabled={saving}>
										Abbrechen
									</Button>
								</div>
							</div>
						{:else}
							<!-- Anzeige-Modus -->
							<div class="data-card">
								<div class="data-row">
									<span class="data-label">Kunde</span>
									<span class="data-value">{bv.kunde}</span>
								</div>
								<div class="data-row">
									<span class="data-label">Anrede</span>
									<span class="data-value">{bv.kundeAnrede || '-'}</span>
								</div>
								<div class="data-row">
									<span class="data-label">Vorname</span>
									<span class="data-value">{bv.kundeVorname || '-'}</span>
								</div>
								<div class="data-row">
									<span class="data-label">Nachname</span>
									<span class="data-value">{bv.kundeNachname || '-'}</span>
								</div>
								<div class="data-row">
									<span class="data-label">E-Mail</span>
									{#if bv.kundeEmail}
										<a href="mailto:{bv.kundeEmail}" class="data-value link">{bv.kundeEmail}</a>
									{:else}
										<span class="data-value">-</span>
									{/if}
								</div>
								<div class="data-row">
									<span class="data-label">Telefon</span>
									{#if bv.kundeTelefon}
										<a href="tel:{bv.kundeTelefon}" class="data-value link">{bv.kundeTelefon}</a>
									{:else}
										<span class="data-value">-</span>
									{/if}
								</div>
								<div class="data-row">
									<span class="data-label">Adresse</span>
									<span class="data-value">{bv.adresse}</span>
								</div>
							</div>
						{/if}
					</div>

					<div class="section">
						<h3 class="section-title">Kommunikation</h3>
						<div class="action-buttons">
							{#if bv.kundeEmail}
								<Button variant="primary" onclick={() => window.open(`mailto:${bv?.kundeEmail}`)}>
									E-Mail senden
								</Button>
							{/if}
							{#if bv.kundeTelefon}
								<Button variant="secondary" onclick={() => window.open(`tel:${bv?.kundeTelefon}`)}>
									Anrufen
								</Button>
							{/if}
						</div>
					</div>
				</div>

			<!-- NU TAB -->
			{:else if activeTab === 'nu'}
				<div class="tab-panel">
					<!-- Budget-Uebersicht -->
					<div class="section">
						<h3 class="section-title">NU-Budget Uebersicht</h3>
						<div class="nu-budget-grid">
							<div class="nu-budget-card">
								<span class="nu-budget-label">Budget (Plan)</span>
								<span class="nu-budget-value">{formatCurrency(bv.budgetNU)}</span>
							</div>
							<div class="nu-budget-card">
								<span class="nu-budget-label">NU-Rechnungen (Ist)</span>
								<span class="nu-budget-value">{formatCurrency(summeERNetto)}</span>
							</div>
							<div class="nu-budget-card" class:success={bv.budgetNU && summeERNetto < bv.budgetNU} class:error={bv.budgetNU && summeERNetto > bv.budgetNU}>
								<span class="nu-budget-label">Differenz</span>
								<span class="nu-budget-value">{formatCurrency((bv.budgetNU || 0) - summeERNetto)}</span>
							</div>
						</div>
					</div>

					<!-- Nachunternehmer aus Dokumenten -->
					<div class="section">
						<h3 class="section-title">Nachunternehmer (aus Dokumenten)</h3>
						{#if nachunternehmerListe.length > 0}
							<div class="nu-cards-grid">
								{#each nachunternehmerListe as nu}
									<div class="nu-card">
										<div class="nu-header">
											<span class="nu-name">{nu.name}</span>
											<Badge variant="info" size="sm">{nu.anzahlDokumente} Dok.</Badge>
										</div>
										<div class="nu-details">
											<div class="nu-row">
												<span class="nu-label">Summe Netto</span>
												<span class="nu-value">{formatCurrency(nu.summeNetto)}</span>
											</div>
											<div class="nu-row">
												<span class="nu-label">Summe Brutto</span>
												<span class="nu-value">{formatCurrency(nu.summeBrutto)}</span>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{:else if bv.budgetNU}
							<div class="nu-card">
								<div class="nu-header">
									<span class="nu-name">Haupt-NU</span>
									<Badge variant="warning">Keine Dokumente</Badge>
								</div>
								<div class="nu-details">
									<div class="nu-row">
										<span class="nu-label">Budget (NUA)</span>
										<span class="nu-value">{formatCurrency(bv.budgetNU)}</span>
									</div>
								</div>
							</div>
						{:else}
							<div class="empty-state">
								<p>Noch kein Nachunternehmer zugewiesen</p>
								<Button variant="primary">NU zuweisen</Button>
							</div>
						{/if}
					</div>

					<!-- NU-Dokumente -->
					<div class="section">
						<h3 class="section-title">NU-Dokumente (NUA, ER-NU)</h3>
						{#if nuDokumente.length > 0}
							<div class="table-container">
								<table class="data-table">
									<thead>
										<tr>
											<th>Typ</th>
											<th>Nr.</th>
											<th>NU/Steller</th>
											<th>Netto</th>
											<th>Brutto</th>
											<th>Status</th>
											<th>Datum</th>
											<th>Aktion</th>
										</tr>
									</thead>
									<tbody>
										{#each nuDokumente as dok}
											<tr>
												<td><Badge variant="default" size="sm">{dok.art_des_dokuments || '-'}</Badge></td>
												<td class="mono">{dok.dokument_nr || dok.nua_nr || '-'}</td>
												<td>{dok.rechnungssteller || '-'}</td>
												<td class="currency">{formatCurrency(dok.betrag_netto)}</td>
												<td class="currency">{formatCurrency(dok.betrag_brutto)}</td>
												<td><Badge variant={getStatusVariant(dok.status || '')} size="sm">{dok.status || '-'}</Badge></td>
												<td>{formatDate(dok.datum_erstellt)}</td>
												<td>
													{#if dok.datei_url}
														<a href={dok.datei_url} target="_blank" class="action-link">PDF</a>
													{:else if dok.sharepoint_link}
														<a href={dok.sharepoint_link} target="_blank" class="action-link">Link</a>
													{:else}
														-
													{/if}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{:else}
							<p class="empty-text">Keine NU-Dokumente vorhanden</p>
						{/if}
					</div>

					<!-- Nachtraege -->
					<div class="section">
						<h3 class="section-title">Nachtraege</h3>
						{#if nachtraege.length > 0}
							<div class="table-container">
								<table class="data-table">
									<thead>
										<tr>
											<th>Nr.</th>
											<th>Status</th>
											<th>Titel</th>
											<th>Kunde</th>
											<th>NU</th>
											<th>Tage</th>
										</tr>
									</thead>
									<tbody>
										{#each nachtraege as nachtrag}
											<tr>
												<td class="mono">{nachtrag.nachtrag_nr}</td>
												<td><Badge variant={getStatusVariant(nachtrag.status)} size="sm">{nachtrag.status}</Badge></td>
												<td>{nachtrag.titel || '-'}</td>
												<td class="currency">{formatCurrency(nachtrag.betrag_kunde_netto)}</td>
												<td class="currency">{formatCurrency(nachtrag.betrag_nu_netto)}</td>
												<td>{nachtrag.verzoegerung_tage || '-'}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{:else}
							<p class="empty-text">Keine Nachtraege</p>
						{/if}
					</div>
				</div>

			<!-- DOKUMENTE TAB -->
			{:else if activeTab === 'dokumente'}
				<div class="tab-panel">
					<!-- Dokument-Statistik -->
					<div class="dok-stats-grid">
						<div class="dok-stat-card ar">
							<span class="dok-stat-label">Ausgangsrechnungen (AR)</span>
							<span class="dok-stat-count">{dokumenteAR.length}</span>
							<span class="dok-stat-value">{formatCurrency(summeARNetto)}</span>
						</div>
						<div class="dok-stat-card er">
							<span class="dok-stat-label">Eingangsrechnungen (ER)</span>
							<span class="dok-stat-count">{dokumenteER.length}</span>
							<span class="dok-stat-value">{formatCurrency(summeERNetto)}</span>
						</div>
						<div class="dok-stat-card ang">
							<span class="dok-stat-label">Angebote (ANG)</span>
							<span class="dok-stat-count">{dokumenteANG.length}</span>
						</div>
						<div class="dok-stat-card ab">
							<span class="dok-stat-label">Auftragsbestaet. (AB)</span>
							<span class="dok-stat-count">{dokumenteAB.length}</span>
						</div>
						<div class="dok-stat-card nua">
							<span class="dok-stat-label">NU-Auftraege (NUA)</span>
							<span class="dok-stat-count">{dokumenteNUA.length}</span>
						</div>
					</div>

					<div class="filter-bar">
						<input
							type="text"
							placeholder="Suche nach Nr. oder Steller..."
							class="search-input"
							bind:value={dokumentFilter}
						/>
						<select class="filter-select" bind:value={dokumentKategorie}>
							<option value="alle">Alle Kategorien ({dokumente.length})</option>
							{#each dokumentKategorien as kat}
								<option value={kat}>{kat}</option>
							{/each}
						</select>
						<Button variant="primary">Dokument hochladen</Button>
					</div>

					{#if dokumenteFiltered.length > 0}
						<div class="table-container">
							<table class="data-table">
								<thead>
									<tr>
										<th>Typ</th>
										<th>Nr.</th>
										<th>Steller</th>
										<th>Netto</th>
										<th>Brutto</th>
										<th>Offen</th>
										<th>Status</th>
										<th>Datum</th>
										<th>Frist</th>
										<th>Aktion</th>
									</tr>
								</thead>
								<tbody>
									{#each dokumenteFiltered as dok}
										<tr>
											<td><Badge variant={dok.art_des_dokuments?.startsWith('AR') ? 'success' : dok.art_des_dokuments?.startsWith('ER') ? 'warning' : 'default'} size="sm">{dok.art_des_dokuments || '-'}</Badge></td>
											<td class="mono">{dok.dokument_nr || '-'}</td>
											<td>{dok.rechnungssteller || '-'}</td>
											<td class="currency">{formatCurrency(dok.betrag_netto)}</td>
											<td class="currency">{formatCurrency(dok.betrag_brutto)}</td>
											<td class="currency" class:error={dok.betrag_offen && dok.betrag_offen > 0}>{dok.betrag_offen ? formatCurrency(dok.betrag_offen) : '-'}</td>
											<td><Badge variant={getStatusVariant(dok.status || '')} size="sm">{dok.status || '-'}</Badge></td>
											<td>{formatDate(dok.datum_erstellt)}</td>
											<td class:overdue={dok.datum_zahlungsfrist && new Date(dok.datum_zahlungsfrist) < new Date()}>{formatDate(dok.datum_zahlungsfrist)}</td>
											<td>
												{#if dok.datei_url}
													<a href={dok.datei_url} target="_blank" class="action-link">PDF</a>
												{:else if dok.sharepoint_link}
													<a href={dok.sharepoint_link} target="_blank" class="action-link">Link</a>
												{:else}
													-
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						<!-- Summenzeile -->
						<div class="table-summary">
							<span>Gesamt ({dokumenteFiltered.length} Dokumente):</span>
							<span class="summary-value">Netto: {formatCurrency(dokumenteFiltered.reduce((s, d) => s + (d.betrag_netto || 0), 0))}</span>
							<span class="summary-value">Brutto: {formatCurrency(dokumenteFiltered.reduce((s, d) => s + (d.betrag_brutto || 0), 0))}</span>
						</div>
					{:else}
						<div class="empty-state">
							<p>Keine Dokumente gefunden</p>
						</div>
					{/if}
				</div>

			<!-- AUFGABEN TAB -->
			{:else if activeTab === 'aufgaben'}
				<div class="tab-panel">
					<!-- Task-Statistik -->
					<div class="task-stats">
						<div class="task-stat">
							<span class="task-stat-count">{tasks.length}</span>
							<span class="task-stat-label">Gesamt</span>
						</div>
						<div class="task-stat success">
							<span class="task-stat-count">{completedTasks}</span>
							<span class="task-stat-label">Erledigt</span>
						</div>
						<div class="task-stat warning">
							<span class="task-stat-count">{inProgressTasks}</span>
							<span class="task-stat-label">In Arbeit</span>
						</div>
						<div class="task-stat error">
							<span class="task-stat-count">{overdueTasks}</span>
							<span class="task-stat-label">Ueberfaellig</span>
						</div>
					</div>

					<div class="section-header">
						<h3 class="section-title">Projekt-Aufgaben</h3>
						<div class="header-actions">
							<Button variant="secondary">KI fragen</Button>
							<Button variant="primary">+ Aufgabe</Button>
						</div>
					</div>

					{#if tasks.length > 0}
						<div class="task-list">
							{#each tasks as task}
								{@const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed'}
								<div class="task-item" class:completed={task.status === 'completed'} class:overdue={isOverdue}>
									<div class="task-checkbox">
										{#if task.status === 'completed'}
											<svg class="check-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
												{@html icons.check}
											</svg>
										{:else if task.percent_complete && task.percent_complete > 0}
											<div class="task-progress-circle" style="--progress: {task.percent_complete}%">
												<span>{task.percent_complete}%</span>
											</div>
										{:else}
											<span class="check-empty"></span>
										{/if}
									</div>
									<div class="task-content">
										<span class="task-title">{task.title}</span>
										{#if task.description}
											<span class="task-desc">{task.description}</span>
										{/if}
										<div class="task-meta">
											{#if task.due_date}
												<span class="task-due" class:overdue={isOverdue}>
													{isOverdue ? 'Ueberfaellig: ' : ''}{formatDate(task.due_date)}
												</span>
											{/if}
											{#if task.assigned_to}
												<span class="task-assignee">{task.assigned_to}</span>
											{/if}
											{#if task.planner_bucket_name}
												<Badge variant="info" size="sm">{task.planner_bucket_name}</Badge>
											{/if}
											{#if task.category}
												<Badge variant="default" size="sm">{task.category}</Badge>
											{/if}
											{#if task.priority}
												<Badge variant={task.priority === 'high' || task.priority === '1' ? 'error' : task.priority === 'medium' || task.priority === '5' ? 'warning' : 'default'} size="sm">
													{task.priority === '1' ? 'Hoch' : task.priority === '5' ? 'Mittel' : task.priority === '9' ? 'Niedrig' : task.priority}
												</Badge>
											{/if}
										</div>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="empty-state">
							<p>Keine Aufgaben fuer dieses Projekt</p>
							<Button variant="primary">Aufgabe erstellen</Button>
						</div>
					{/if}
				</div>

			<!-- TERMINE TAB -->
			{:else if activeTab === 'termine'}
				<div class="tab-panel">
					<!-- Speicher-Meldung -->
					{#if saveMessage}
						<div class="save-message" class:success={saveMessage.type === 'success'} class:error={saveMessage.type === 'error'}>
							{saveMessage.text}
						</div>
					{/if}

					<!-- Zeitbalken -->
					{#if startDate && endDate}
						<div class="termin-overview">
							<div class="termin-progress">
								<div class="termin-progress-bar">
									<div class="termin-progress-fill" style="width: {progressPercent}%"></div>
									<div class="termin-progress-marker" style="left: {progressPercent}%"></div>
								</div>
								<div class="termin-progress-labels">
									<span>{formatDate(bv.bvStart)}</span>
									<span class="termin-heute">Heute</span>
									<span>{formatDate(bv.bvEnde)}</span>
								</div>
							</div>
							<div class="termin-stats">
								<div class="termin-stat">
									<span class="termin-stat-value">{totalDays}</span>
									<span class="termin-stat-label">Tage gesamt</span>
								</div>
								<div class="termin-stat">
									<span class="termin-stat-value">{Math.max(0, elapsedDays)}</span>
									<span class="termin-stat-label">Tage vergangen</span>
								</div>
								<div class="termin-stat" class:warning={remainingDays < 14 && remainingDays > 0} class:error={remainingDays <= 0}>
									<span class="termin-stat-value">{remainingDays}</span>
									<span class="termin-stat-label">{remainingDays >= 0 ? 'Tage verbleibend' : 'Tage ueberfaellig'}</span>
								</div>
							</div>
						</div>
					{/if}

					<div class="section">
						<div class="section-header">
							<h3 class="section-title">Projekttermine</h3>
							{#if !editingTermine}
								<Button variant="secondary" onclick={startEditTermine}>
									Bearbeiten
								</Button>
							{/if}
						</div>

						{#if editingTermine}
							<!-- Edit-Modus -->
							<div class="edit-form">
								<div class="form-grid form-grid-2">
									<div class="form-group">
										<label class="form-label" for="bvStart">BV Start</label>
										<input
											type="date"
											id="bvStart"
											class="form-input"
											bind:value={editBvStart}
										/>
									</div>
									<div class="form-group">
										<label class="form-label" for="bvEnde">BV Ende</label>
										<input
											type="date"
											id="bvEnde"
											class="form-input"
											bind:value={editBvEnde}
										/>
									</div>
								</div>
								<div class="form-actions">
									<Button variant="primary" onclick={saveTermine} disabled={saving}>
										{saving ? 'Speichern...' : 'Speichern'}
									</Button>
									<Button variant="ghost" onclick={cancelEdit} disabled={saving}>
										Abbrechen
									</Button>
								</div>
							</div>
						{:else}
							<div class="timeline">
								{#if extractField(bv.columnValues, 'datum__bedarfsanalyse__1')}
									<div class="timeline-item" class:past={true}>
										<div class="timeline-marker past"></div>
										<div class="timeline-content">
											<span class="timeline-label">Bedarfsanalyse</span>
											<span class="timeline-date">{extractField(bv.columnValues, 'datum__bedarfsanalyse__1')}</span>
										</div>
									</div>
								{/if}
								<div class="timeline-item" class:past={startDate && startDate < heute}>
									<div class="timeline-marker" class:past={startDate && startDate < heute}></div>
									<div class="timeline-content">
										<span class="timeline-label">BV Start</span>
										<span class="timeline-date">{formatDate(bv.bvStart)}</span>
									</div>
								</div>
								<div class="timeline-item" class:future={endDate && endDate > heute} class:past={endDate && endDate <= heute}>
									<div class="timeline-marker" class:future={endDate && endDate > heute} class:past={endDate && endDate <= heute}></div>
									<div class="timeline-content">
										<span class="timeline-label">BV Ende (geplant)</span>
										<span class="timeline-date">{formatDate(bv.bvEnde)}</span>
									</div>
								</div>
							</div>
						{/if}
					</div>

					<div class="section">
						<h3 class="section-title">Gewerke-Meilensteine</h3>
						<div class="milestone-grid">
							{#each gewerke as gewerk}
								<div class="milestone-item" class:erledigt={gewerk.status === 'Erledigt' || gewerk.status === 'Abgeschlossen'}>
									<span class="milestone-name">{gewerk.name}</span>
									<Badge variant={getStatusVariant(gewerk.status)} size="sm">{gewerk.status}</Badge>
								</div>
							{/each}
						</div>
					</div>

					<!-- Faellige Aufgaben -->
					{#if upcomingTasks.length > 0}
						<div class="section">
							<h3 class="section-title">Naechste Faelligkeiten</h3>
							<div class="upcoming-tasks">
								{#each upcomingTasks as task}
									{@const isOverdue = new Date(task.due_date!) < heute}
									<div class="upcoming-task" class:overdue={isOverdue}>
										<span class="upcoming-date" class:overdue={isOverdue}>{formatDate(task.due_date)}</span>
										<span class="upcoming-title">{task.title}</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>

			<!-- ABNAHMEN TAB -->
			{:else if activeTab === 'abnahmen'}
				<div class="tab-panel">
					<div class="section">
						<h3 class="section-title">Abnahmeprotokolle</h3>
						<div class="empty-state">
							<p>Noch keine Abnahmen dokumentiert</p>
							<Button variant="primary">Neue Abnahme erstellen</Button>
						</div>
					</div>

					<div class="section">
						<h3 class="section-title">Abnahme-Status</h3>
						<div class="info-grid">
							<div class="info-item">
								<span class="info-label">Vorabnahme intern</span>
								<Badge variant={getStatusVariant(extractField(bv.columnValues, 'color45__1') || 'Offen')} size="sm">
									{extractField(bv.columnValues, 'color45__1') || 'Offen'}
								</Badge>
							</div>
							<div class="info-item">
								<span class="info-label">Endabnahme Kunde</span>
								<Badge variant={getStatusVariant(extractField(bv.columnValues, 'color72__1') || 'Offen')} size="sm">
									{extractField(bv.columnValues, 'color72__1') || 'Offen'}
								</Badge>
							</div>
						</div>
					</div>
				</div>

			<!-- MAENGEL TAB -->
			{:else if activeTab === 'maengel'}
				<div class="tab-panel">
					<div class="section-header">
						<h3 class="section-title">Maengelliste</h3>
						<Button variant="primary">+ Mangel melden</Button>
					</div>

					{#if maengel.length > 0}
						<div class="table-container">
							<table class="data-table">
								<thead>
									<tr>
										<th>Nr.</th>
										<th>Status</th>
										<th>Art</th>
										<th>Beschreibung</th>
										<th>NU</th>
										<th>Frist</th>
										<th>Fotos</th>
									</tr>
								</thead>
								<tbody>
									{#each maengel as mangel}
										<tr>
											<td class="mono">{mangel.mangel_nr || mangel.id.slice(0, 8)}</td>
											<td><Badge variant={getStatusVariant(mangel.status_mangel)} size="sm">{mangel.status_mangel}</Badge></td>
											<td>{mangel.art_des_mangels || '-'}</td>
											<td class="desc-cell">{mangel.beschreibung_mangel || '-'}</td>
											<td>{mangel.nachunternehmer || '-'}</td>
											<td>{formatDate(mangel.datum_frist)}</td>
											<td>{getFotoCount(mangel.fotos_mangel)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else}
						<div class="empty-state success">
							<p>Keine Maengel erfasst</p>
						</div>
					{/if}
				</div>

			<!-- NACHWEISE TAB -->
			{:else if activeTab === 'nachweise'}
				<div class="tab-panel">
					<!-- Speicher-Meldung -->
					{#if saveMessage}
						<div class="save-message" class:success={saveMessage.type === 'success'} class:error={saveMessage.type === 'error'}>
							{saveMessage.text}
						</div>
					{/if}

					<!-- Nachweis-Fortschritt -->
					<div class="nachweis-progress">
						<div class="nachweis-progress-bar">
							<div class="nachweis-progress-fill" style="width: {Math.round((vorhandenePflicht / pflichtNachweise) * 100)}%"></div>
						</div>
						<span class="nachweis-progress-text">{vorhandenePflicht}/{pflichtNachweise} Pflicht-Nachweise vorhanden</span>
					</div>

					<div class="section">
						<h3 class="section-title">Erforderliche Nachweise im BV</h3>
						<p class="section-hint">Klicken Sie auf die Checkbox um den Status zu aendern. Nutzen Sie "Link hinzufuegen" um eine Datei-URL zu verknuepfen.</p>
						<div class="nachweise-list">
							{#each nachweiseStatus as nachweis}
								<div class="nachweis-item" class:vorhanden={nachweis.vorhanden}>
									<button
										type="button"
										class="nachweis-checkbox-btn"
										onclick={() => toggleNachweis(nachweis.key, nachweis.vorhanden)}
										title={nachweis.vorhanden ? 'Als fehlend markieren' : 'Als vorhanden markieren'}
									>
										{#if nachweis.vorhanden}
											<svg class="check-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
												{@html icons.check}
											</svg>
										{:else}
											<span class="check-empty"></span>
										{/if}
									</button>
									<div class="nachweis-content">
										<span class="nachweis-name">{nachweis.name}</span>
										{#if nachweis.required && !nachweis.vorhanden}
											<span class="nachweis-required">Pflicht - fehlt!</span>
										{:else if nachweis.required && nachweis.vorhanden}
											<span class="nachweis-ok">Pflicht - OK</span>
										{:else if nachweis.vorhanden}
											<span class="nachweis-ok">Vorhanden</span>
										{/if}
									</div>
									<div class="nachweis-actions">
										{#if !nachweis.vorhanden}
											<Button variant="ghost" size="sm">Link hinzufuegen</Button>
										{:else}
											<Button variant="ghost" size="sm">Ansehen</Button>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>

					<div class="section">
						<h3 class="section-title">Sonstige Dokumente als Nachweise</h3>
						{#if sonstigeDokumente.length > 0}
							<div class="table-container">
								<table class="data-table">
									<thead>
										<tr>
											<th>Nr.</th>
											<th>Bezeichnung</th>
											<th>Datum</th>
											<th>Aktion</th>
										</tr>
									</thead>
									<tbody>
										{#each sonstigeDokumente as dok}
											<tr>
												<td class="mono">{dok.dokument_nr || '-'}</td>
												<td>{dok.projektname || dok.rechnungssteller || '-'}</td>
												<td>{formatDate(dok.datum_erstellt)}</td>
												<td>
													{#if dok.datei_url}
														<a href={dok.datei_url} target="_blank" class="action-link">PDF</a>
													{:else}
														-
													{/if}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{:else}
							<div class="empty-state">
								<p>Noch keine sonstigen Nachweise hochgeladen</p>
								<Button variant="primary">Nachweis hochladen</Button>
							</div>
						{/if}
					</div>
				</div>

			<!-- GEWERKE TAB -->
			{:else if activeTab === 'gewerke'}
				<div class="tab-panel">
					<div class="section-header">
						<h3 class="section-title">Gewerke-Status</h3>
						<div class="progress-info">
							<div class="progress-bar-lg">
								<div class="progress-fill-lg" style="width: {gewerkeProgress}%"></div>
							</div>
							<span class="progress-text-lg">{erledigteGewerke}/{gewerke.length} erledigt ({gewerkeProgress}%)</span>
						</div>
					</div>

					<div class="gewerke-grid">
						{#each gewerke as gewerk}
							<div class="gewerk-card" class:erledigt={gewerk.status === 'Erledigt'}>
								<div class="gewerk-header">
									<span class="gewerk-name">{gewerk.name}</span>
									<Badge variant={getStatusVariant(gewerk.status)} size="sm">{gewerk.status}</Badge>
								</div>
							</div>
						{/each}
					</div>
				</div>

			<!-- PHASE (0) BEDARFSANALYSE -->
			{:else if activeTab === 'phase0'}
				<div class="tab-panel">
					<div class="section">
						<h3 class="section-title">(0) Bedarfsanalyse</h3>
						<div class="data-card">
							<div class="data-row">
								<span class="data-label">Bedarfsanalyse Datum</span>
								<span class="data-value">{extractField(bv.columnValues, 'datum__bedarfsanalyse__1') || '-'}</span>
							</div>
							<div class="data-row">
								<span class="data-label">Grundflaeche</span>
								<span class="data-value">{bv.grundflaeche ? `${bv.grundflaeche} m2` : '-'}</span>
							</div>
							<div class="data-row">
								<span class="data-label">BV Start (geschaetzt)</span>
								<span class="data-value">{formatDate(bv.bvStart)}</span>
							</div>
							<div class="data-row">
								<span class="data-label">BV Ende (geschaetzt)</span>
								<span class="data-value">{formatDate(bv.bvEnde)}</span>
							</div>
						</div>
					</div>

					{#if bv.matterportVorher}
						<div class="section">
							<h3 class="section-title">Matterport vorher</h3>
							<a href={bv.matterportVorher} target="_blank" class="matterport-link">
								3D-Scan oeffnen
							</a>
						</div>
					{/if}
				</div>

			<!-- PHASE (1) ANGEBOT -->
			{:else if activeTab === 'phase1'}
				<div class="tab-panel">
					<div class="section">
						<h3 class="section-title">(1) Angebot</h3>
						<div class="data-card">
							<div class="data-row">
								<span class="data-label">Angebots-Nr.</span>
								<span class="data-value">{extractField(bv.columnValues, 'text_angebotsnr') || '-'}</span>
							</div>
							<div class="data-row">
								<span class="data-label">Umsatz (netto)</span>
								<span class="data-value currency">{formatCurrency(bv.umsatzNetto)}</span>
							</div>
							<div class="data-row">
								<span class="data-label">Deadline Angebot</span>
								<span class="data-value">{extractField(bv.columnValues, 'datum_deadline_angebot') || '-'}</span>
							</div>
							<div class="data-row">
								<span class="data-label">Angebot gesendet</span>
								<span class="data-value">{extractField(bv.columnValues, 'datum_angebot_gesendet') || '-'}</span>
							</div>
						</div>
					</div>
				</div>

			<!-- PHASE (2) AUFTRAG -->
			{:else if activeTab === 'phase2'}
				<div class="tab-panel">
					<div class="section">
						<h3 class="section-title">(2) Auftrag</h3>
						<div class="data-card">
							<div class="data-row">
								<span class="data-label">AB-Nr.</span>
								<span class="data-value">{extractField(bv.columnValues, 'text_ab_nr') || '-'}</span>
							</div>
							<div class="data-row">
								<span class="data-label">NUA-Nr.</span>
								<span class="data-value">{extractField(bv.columnValues, 'text_nua_nr') || '-'}</span>
							</div>
							<div class="data-row">
								<span class="data-label">Budget NU</span>
								<span class="data-value currency">{formatCurrency(bv.budgetNU)}</span>
							</div>
							<div class="data-row">
								<span class="data-label">Marge</span>
								<span class="data-value">{bv.marge ? `${bv.marge}%` : '-'}</span>
							</div>
						</div>
					</div>
				</div>

			<!-- PHASE (3) VORBEREITUNG -->
			{:else if activeTab === 'phase3'}
				<div class="tab-panel">
					<PhaseVorbereitung
						columnValues={bv.columnValues}
						projektNr={bv.projektNr}
					/>
				</div>

			<!-- PHASE (4) UMSETZUNG -->
			{:else if activeTab === 'phase4'}
				<div class="tab-panel">
					<PhaseUmsetzung
						columnValues={bv.columnValues}
						projektNr={bv.projektNr}
						bvId={bv.id}
					/>
				</div>

			<!-- PHASE (5) RECHNUNGEN -->
			{:else if activeTab === 'phase5'}
				<div class="tab-panel">
					<div class="phase-sub-tabs">
						<button class="sub-tab active" onclick={() => activeTab = 'phase51'}>(5.1) RE Kunde</button>
						<button class="sub-tab" onclick={() => activeTab = 'phase52'}>(5.2) RE NU</button>
					</div>
					<PhaseRechnungenKunde
						columnValues={bv.columnValues}
						projektNr={bv.projektNr}
					/>
				</div>

			<!-- PHASE (6) NACHKALKULATION -->
			{:else if activeTab === 'phase6'}
				<div class="tab-panel">
					<PhaseNachkalkulation
						columnValues={bv.columnValues}
						projektNr={bv.projektNr}
					/>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.bv-detail {
		max-width: 1400px;
		margin: 0 auto;
	}

	/* Loading & Error States */
	.loading-state,
	.error-state {
		text-align: center;
		padding: 4rem 2rem;
		color: var(--color-gray-500);
	}

	.spinner-lg {
		width: 40px;
		height: 40px;
		border: 3px solid var(--color-gray-200);
		border-top-color: var(--color-brand-medium);
		animation: spin 0.8s linear infinite;
		margin: 0 auto 1rem;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.error-state {
		color: var(--color-error);
	}

	/* Breadcrumb */
	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem 0;
		font-size: 0.9rem;
		border-bottom: 1px solid var(--color-gray-200);
	}

	.breadcrumb-link {
		color: var(--color-gray-500);
		text-decoration: none;
	}

	.breadcrumb-link:hover {
		color: var(--color-primary);
	}

	.breadcrumb-sep {
		color: var(--color-gray-400);
	}

	.breadcrumb-current {
		color: var(--color-gray-800);
	}

	.breadcrumb-current strong {
		font-weight: 700;
		color: var(--color-primary);
	}

	/* Hero Section */
	.hero-section {
		display: grid;
		grid-template-columns: 280px 1fr;
		gap: 2rem;
		padding: 1.5rem 0;
		border-bottom: 1px solid var(--color-gray-200);
	}

	@media (max-width: 768px) {
		.hero-section {
			grid-template-columns: 1fr;
		}
	}

	.hero-image {
		width: 280px;
		height: 200px;
		background: var(--color-gray-100);
		overflow: hidden;
	}

	.hero-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.hero-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		color: var(--color-gray-400);
	}

	.hero-content {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.75rem;
	}

	.hero-title {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--color-gray-900);
		margin: 0;
	}

	.hero-title strong {
		color: var(--color-primary);
	}

	.hero-subtitle {
		color: var(--color-gray-500);
		margin: 0;
	}

	/* Phase Status Bar */
	.phase-status-bar {
		display: flex;
		align-items: flex-start;
		margin: 1rem 0;
		gap: 0;
	}

	.phase-step {
		display: flex;
		align-items: center;
		position: relative;
	}

	.phase-line {
		width: 20px;
		height: 3px;
		background: var(--color-gray-300);
		flex-shrink: 0;
	}

	.phase-line.completed {
		background: var(--color-success);
	}

	.phase-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
	}

	.phase-box {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-gray-100);
		border: 2px solid var(--color-gray-300);
		color: var(--color-gray-500);
		font-weight: 700;
		font-size: 0.9rem;
		border-radius: 0;
	}

	/* Zukuenftige Phasen: Grau */
	.phase-step.future .phase-box {
		background: var(--color-gray-100);
		border-color: var(--color-gray-300);
		color: var(--color-gray-400);
	}

	/* Erledigte Phasen: Gruen */
	.phase-step.completed .phase-box {
		background: var(--color-success);
		border-color: var(--color-success);
		color: white;
	}

	/* Aktive Phase: Rot (Markenfarbe) */
	.phase-step.active .phase-box {
		background: var(--color-error);
		border-color: var(--color-error);
		color: white;
		box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.2);
	}

	.phase-name {
		font-size: 0.7rem;
		color: var(--color-gray-500);
		text-align: center;
		max-width: 70px;
		line-height: 1.2;
		white-space: nowrap;
	}

	.phase-name-short {
		display: none;
		font-size: 0.65rem;
		color: var(--color-gray-500);
		text-align: center;
	}

	.phase-step.completed .phase-name,
	.phase-step.completed .phase-name-short {
		color: var(--color-success-dark);
		font-weight: 500;
	}

	.phase-step.active .phase-name,
	.phase-step.active .phase-name-short {
		color: var(--color-error);
		font-weight: 600;
	}

	/* Responsive: Mobile zeigt Kurzform */
	@media (max-width: 900px) {
		.phase-line {
			width: 12px;
		}

		.phase-box {
			width: 32px;
			height: 32px;
			font-size: 0.85rem;
		}

		.phase-name {
			display: none;
		}

		.phase-name-short {
			display: block;
			font-size: 0.6rem;
			max-width: 50px;
		}
	}

	/* Sehr kleine Bildschirme: Nur Nummern */
	@media (max-width: 480px) {
		.phase-status-bar {
			flex-wrap: wrap;
			gap: 0.25rem;
		}

		.phase-line {
			width: 8px;
		}

		.phase-box {
			width: 28px;
			height: 28px;
			font-size: 0.75rem;
		}

		.phase-name-short {
			display: none;
		}
	}

	/* Hero Links */
	.hero-links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.hero-link {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.4rem 0.75rem;
		background: var(--color-gray-100);
		color: var(--color-gray-700);
		text-decoration: none;
		font-size: 0.8rem;
		font-weight: 500;
		border: 1px solid var(--color-gray-200);
		transition: all 0.15s ease;
	}

	.hero-link:hover {
		background: var(--color-gray-200);
	}

	.hero-link.hero {
		background: #1a73e8;
		color: white;
		border-color: #1a73e8;
	}

	.hero-link.hero:hover {
		background: #1557b0;
	}

	/* Tabs Navigation */
	.tabs-nav {
		background: white;
		border-bottom: 2px solid var(--color-gray-200);
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.tabs-scroll {
		display: flex;
		overflow-x: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--color-gray-300) transparent;
	}

	.tabs-scroll::-webkit-scrollbar {
		height: 4px;
	}

	.tabs-scroll::-webkit-scrollbar-track {
		background: transparent;
	}

	.tabs-scroll::-webkit-scrollbar-thumb {
		background: var(--color-gray-300);
	}

	.tab-btn {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.9rem 1rem;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		margin-bottom: -2px;
		cursor: pointer;
		font-size: 0.85rem;
		color: var(--color-gray-600);
		white-space: nowrap;
		transition: all 0.15s ease;
	}

	.tab-btn:hover {
		color: var(--color-gray-900);
		background: var(--color-gray-50);
	}

	.tab-btn.active {
		color: var(--color-primary);
		border-bottom-color: var(--color-primary);
		font-weight: 600;
	}

	.tab-icon {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
	}

	.tab-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		background: var(--color-gray-200);
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--color-gray-600);
	}

	.tab-badge.error {
		background: var(--color-error-light);
		color: var(--color-error-dark);
	}

	.tab-badge.warning {
		background: var(--color-warning-light);
		color: var(--color-warning-dark);
	}

	.tabs-separator {
		display: block;
		width: 1px;
		height: 24px;
		background: var(--color-gray-300);
		margin: 0 0.75rem;
		align-self: center;
		flex-shrink: 0;
	}

	.tab-btn.phase-tab {
		color: var(--color-gray-500);
	}

	.tab-btn.phase-tab.current-phase {
		color: var(--color-primary);
		font-weight: 600;
	}

	.tab-btn.phase-tab.active {
		background: var(--color-brand-bg);
	}

	/* Tab Content */
	.tab-content {
		padding: 1.5rem 0;
	}

	.tab-panel {
		animation: fadeIn 0.2s ease;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(5px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* Sections */
	.section {
		margin-bottom: 2rem;
	}

	.section-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-gray-800);
		margin: 0 0 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--color-gray-200);
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.section-header .section-title {
		margin: 0;
		border: none;
		padding: 0;
	}

	.header-actions {
		display: flex;
		gap: 0.5rem;
	}

	/* KPI Grid */
	.kpi-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 1rem;
		margin-bottom: 2rem;
	}

	@media (max-width: 1200px) {
		.kpi-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	@media (max-width: 768px) {
		.kpi-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	.kpi-card {
		background: white;
		border: 1px solid var(--color-gray-200);
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.kpi-card.highlight {
		background: var(--color-success-light);
		border-color: var(--color-success);
	}

	.kpi-label {
		font-size: 0.75rem;
		color: var(--color-gray-500);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.kpi-value {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-gray-900);
	}

	.kpi-value.currency {
		font-family: var(--font-family-mono);
	}

	.kpi-sub {
		font-size: 0.8rem;
		color: var(--color-gray-500);
	}

	.kpi-sub.success {
		color: var(--color-success-dark);
	}

	.kpi-link {
		font-size: 0.8rem;
		color: var(--color-primary);
	}

	/* Info Grid */
	.info-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 1rem;
	}

	.info-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.info-label {
		font-size: 0.75rem;
		color: var(--color-gray-500);
		text-transform: uppercase;
	}

	.info-value {
		font-size: 0.9rem;
		color: var(--color-gray-800);
	}

	/* Status Grid */
	.status-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
	}

	@media (max-width: 768px) {
		.status-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	.status-item {
		background: var(--color-gray-50);
		border: 1px solid var(--color-gray-200);
		padding: 1rem;
		text-align: center;
	}

	.status-item.error {
		background: var(--color-error-light);
		border-color: var(--color-error);
	}

	.status-item.warning {
		background: var(--color-warning-light);
		border-color: var(--color-warning);
	}

	.status-count {
		display: block;
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-gray-900);
	}

	.status-item.error .status-count {
		color: var(--color-error-dark);
	}

	.status-item.warning .status-count {
		color: var(--color-warning-dark);
	}

	.status-label {
		font-size: 0.8rem;
		color: var(--color-gray-600);
	}

	/* Data Card */
	.data-card {
		background: white;
		border: 1px solid var(--color-gray-200);
		padding: 1rem;
	}

	.data-row {
		display: flex;
		justify-content: space-between;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--color-gray-100);
	}

	.data-row:last-child {
		border-bottom: none;
	}

	.data-label {
		color: var(--color-gray-500);
		font-size: 0.9rem;
	}

	.data-value {
		color: var(--color-gray-800);
		font-weight: 500;
	}

	.data-value.link {
		color: var(--color-primary);
		text-decoration: none;
	}

	.data-value.link:hover {
		text-decoration: underline;
	}

	/* Action Buttons */
	.action-buttons {
		display: flex;
		gap: 0.75rem;
	}

	/* NU Card */
	.nu-card {
		background: white;
		border: 1px solid var(--color-gray-200);
		padding: 1rem;
	}

	.nu-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--color-gray-100);
	}

	.nu-name {
		font-weight: 600;
		color: var(--color-gray-800);
	}

	.nu-details {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.nu-row {
		display: flex;
		justify-content: space-between;
	}

	.nu-label {
		color: var(--color-gray-500);
	}

	.nu-value {
		font-weight: 500;
		font-family: var(--font-family-mono);
	}

	/* Filter Bar */
	.filter-bar {
		display: flex;
		gap: 1rem;
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}

	.search-input {
		flex: 1;
		min-width: 200px;
		padding: 0.6rem 1rem;
		border: 1px solid var(--color-gray-300);
		font-size: 0.9rem;
	}

	.search-input:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.filter-select {
		padding: 0.6rem 1rem;
		border: 1px solid var(--color-gray-300);
		font-size: 0.9rem;
		background: white;
		min-width: 150px;
	}

	/* Tables */
	.table-container {
		overflow-x: auto;
		border: 1px solid var(--color-gray-200);
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
	}

	.data-table th,
	.data-table td {
		padding: 0.75rem 1rem;
		text-align: left;
		border-bottom: 1px solid var(--color-gray-100);
	}

	.data-table th {
		background: var(--color-gray-50);
		font-weight: 600;
		color: var(--color-gray-700);
		white-space: nowrap;
	}

	.data-table tbody tr:hover {
		background: var(--color-gray-50);
	}

	.data-table .mono {
		font-family: var(--font-family-mono);
		font-size: 0.8rem;
	}

	.data-table .currency {
		font-family: var(--font-family-mono);
		text-align: right;
	}

	.data-table .desc-cell {
		max-width: 250px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.action-link {
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 500;
	}

	.action-link:hover {
		text-decoration: underline;
	}

	/* Task List */
	.task-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.task-item {
		display: flex;
		gap: 0.75rem;
		padding: 0.75rem;
		background: white;
		border: 1px solid var(--color-gray-200);
	}

	.task-item.completed {
		opacity: 0.6;
	}

	.task-checkbox {
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.check-icon {
		color: var(--color-success);
	}

	.check-empty {
		width: 16px;
		height: 16px;
		border: 2px solid var(--color-gray-300);
	}

	.task-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.task-title {
		font-weight: 500;
		color: var(--color-gray-800);
	}

	.task-item.completed .task-title {
		text-decoration: line-through;
	}

	.task-desc {
		font-size: 0.85rem;
		color: var(--color-gray-500);
	}

	.task-meta {
		display: flex;
		gap: 1rem;
		font-size: 0.8rem;
		color: var(--color-gray-500);
	}

	/* Timeline */
	.timeline {
		position: relative;
		padding-left: 1.5rem;
	}

	.timeline::before {
		content: '';
		position: absolute;
		left: 0.5rem;
		top: 0.5rem;
		bottom: 0.5rem;
		width: 2px;
		background: var(--color-gray-200);
	}

	.timeline-item {
		position: relative;
		padding: 0.5rem 0;
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.timeline-marker {
		position: absolute;
		left: -1.25rem;
		width: 10px;
		height: 10px;
		background: var(--color-primary);
		border: 2px solid white;
		box-shadow: 0 0 0 2px var(--color-primary);
	}

	.timeline-content {
		display: flex;
		justify-content: space-between;
		flex: 1;
	}

	.timeline-label {
		color: var(--color-gray-700);
	}

	.timeline-date {
		font-weight: 500;
		color: var(--color-gray-800);
	}

	/* Milestone Grid */
	.milestone-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 0.75rem;
	}

	.milestone-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem;
		background: var(--color-gray-50);
		border: 1px solid var(--color-gray-200);
	}

	.milestone-name {
		font-size: 0.9rem;
		color: var(--color-gray-700);
	}

	/* Nachweise List */
	.nachweise-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.nachweis-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: white;
		border: 1px solid var(--color-gray-200);
	}

	/* nachweis-checkbox entfernt - jetzt nachweis-checkbox-btn */

	.nachweis-content {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.nachweis-name {
		font-weight: 500;
		color: var(--color-gray-800);
	}

	.nachweis-required {
		font-size: 0.7rem;
		padding: 0.15rem 0.4rem;
		background: var(--color-error-light);
		color: var(--color-error-dark);
		font-weight: 600;
	}

	/* Progress */
	.progress-info {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.progress-bar-lg {
		width: 150px;
		height: 8px;
		background: var(--color-gray-200);
		overflow: hidden;
	}

	.progress-fill-lg {
		height: 100%;
		background: var(--color-success);
		transition: width 0.3s ease;
	}

	.progress-text-lg {
		font-size: 0.85rem;
		color: var(--color-gray-600);
	}

	/* Gewerke Grid */
	.gewerke-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		gap: 0.75rem;
	}

	.gewerk-card {
		background: white;
		border: 1px solid var(--color-gray-200);
		padding: 1rem;
	}

	.gewerk-card.erledigt {
		background: var(--color-success-light);
		border-color: var(--color-success);
	}

	.gewerk-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.gewerk-name {
		font-weight: 500;
		color: var(--color-gray-800);
	}

	/* Empty State */
	.empty-state {
		text-align: center;
		padding: 3rem 2rem;
		background: var(--color-gray-50);
		border: 1px dashed var(--color-gray-300);
	}

	.empty-state.success {
		background: var(--color-success-light);
		border-color: var(--color-success);
	}

	.empty-state p {
		color: var(--color-gray-500);
		margin: 0 0 1rem;
	}

	.empty-text {
		color: var(--color-gray-400);
		text-align: center;
		padding: 2rem;
	}

	/* Matterport Link */
	.matterport-link {
		display: inline-block;
		padding: 0.75rem 1.5rem;
		background: var(--color-primary);
		color: white;
		text-decoration: none;
		font-weight: 500;
	}

	.matterport-link:hover {
		background: var(--color-primary-hover);
	}

	/* Phase Sub Tabs */
	.phase-sub-tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}

	.sub-tab {
		padding: 0.5rem 1rem;
		background: var(--color-gray-100);
		border: 1px solid var(--color-gray-200);
		cursor: pointer;
		font-size: 0.9rem;
		color: var(--color-gray-600);
	}

	.sub-tab.active {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: white;
	}

	/* Back Link */
	.back-link {
		color: var(--color-primary);
		text-decoration: none;
	}

	.back-link:hover {
		text-decoration: underline;
	}

	/* Responsive */
	@media (max-width: 640px) {
		.tabs-nav {
			padding: 0;
		}

		.tab-btn {
			padding: 0.75rem 0.75rem;
			font-size: 0.8rem;
		}

		.tab-label {
			display: none;
		}

		.tab-icon {
			width: 18px;
			height: 18px;
		}

		.filter-bar {
			flex-direction: column;
		}

		.search-input,
		.filter-select {
			width: 100%;
		}

		.hero-image {
			width: 100%;
			height: 180px;
		}
	}

	/* NU Budget Grid */
	.nu-budget-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.nu-budget-card {
		background: var(--color-gray-50);
		border: 1px solid var(--color-gray-200);
		padding: 1rem;
		text-align: center;
	}

	.nu-budget-card.success {
		background: var(--color-success-light);
		border-color: var(--color-success);
	}

	.nu-budget-card.error {
		background: var(--color-error-light);
		border-color: var(--color-error);
	}

	.nu-budget-label {
		display: block;
		font-size: 0.75rem;
		color: var(--color-gray-500);
		text-transform: uppercase;
		margin-bottom: 0.25rem;
	}

	.nu-budget-value {
		font-size: 1.25rem;
		font-weight: 600;
		font-family: var(--font-family-mono);
	}

	.nu-cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
	}

	/* Dokument Statistik Grid */
	.dok-stats-grid {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	@media (max-width: 900px) {
		.dok-stats-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	@media (max-width: 600px) {
		.dok-stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	.dok-stat-card {
		background: var(--color-gray-50);
		border: 1px solid var(--color-gray-200);
		padding: 0.75rem;
		text-align: center;
	}

	.dok-stat-card.ar {
		border-left: 3px solid var(--color-success);
	}

	.dok-stat-card.er {
		border-left: 3px solid var(--color-warning);
	}

	.dok-stat-card.ang {
		border-left: 3px solid var(--color-info);
	}

	.dok-stat-card.ab {
		border-left: 3px solid var(--color-primary);
	}

	.dok-stat-card.nua {
		border-left: 3px solid var(--color-gray-500);
	}

	.dok-stat-label {
		display: block;
		font-size: 0.7rem;
		color: var(--color-gray-500);
		margin-bottom: 0.25rem;
	}

	.dok-stat-count {
		display: block;
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-gray-800);
	}

	.dok-stat-value {
		display: block;
		font-size: 0.8rem;
		font-family: var(--font-family-mono);
		color: var(--color-gray-600);
	}

	/* Table Summary */
	.table-summary {
		display: flex;
		gap: 2rem;
		padding: 0.75rem 1rem;
		background: var(--color-gray-50);
		border: 1px solid var(--color-gray-200);
		border-top: none;
		font-size: 0.85rem;
	}

	.summary-value {
		font-family: var(--font-family-mono);
		font-weight: 500;
	}

	/* Task Stats */
	.task-stats {
		display: flex;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.task-stat {
		flex: 1;
		text-align: center;
		padding: 0.75rem;
		background: var(--color-gray-50);
		border: 1px solid var(--color-gray-200);
	}

	.task-stat.success {
		background: var(--color-success-light);
		border-color: var(--color-success);
	}

	.task-stat.warning {
		background: var(--color-warning-light);
		border-color: var(--color-warning);
	}

	.task-stat.error {
		background: var(--color-error-light);
		border-color: var(--color-error);
	}

	.task-stat-count {
		display: block;
		font-size: 1.5rem;
		font-weight: 700;
	}

	.task-stat-label {
		font-size: 0.75rem;
		color: var(--color-gray-600);
	}

	.task-item.overdue {
		border-left: 3px solid var(--color-error);
	}

	.task-due.overdue {
		color: var(--color-error);
		font-weight: 600;
	}

	.task-progress-circle {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: conic-gradient(var(--color-primary) var(--progress), var(--color-gray-200) var(--progress));
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.5rem;
		font-weight: 600;
	}

	/* Nachweis Progress */
	.nachweis-progress {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		background: var(--color-gray-50);
		border: 1px solid var(--color-gray-200);
		margin-bottom: 1.5rem;
	}

	.nachweis-progress-bar {
		flex: 1;
		height: 8px;
		background: var(--color-gray-200);
		border-radius: 4px;
		overflow: hidden;
	}

	.nachweis-progress-fill {
		height: 100%;
		background: var(--color-success);
		transition: width 0.3s ease;
	}

	.nachweis-progress-text {
		font-size: 0.85rem;
		color: var(--color-gray-600);
		white-space: nowrap;
	}

	.nachweis-item.vorhanden {
		background: var(--color-success-light);
		border-color: var(--color-success);
	}

	.nachweis-ok {
		font-size: 0.7rem;
		padding: 0.15rem 0.4rem;
		background: var(--color-success-light);
		color: var(--color-success-dark);
		font-weight: 600;
	}

	/* Termin Overview */
	.termin-overview {
		background: var(--color-gray-50);
		border: 1px solid var(--color-gray-200);
		padding: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.termin-progress {
		margin-bottom: 1rem;
	}

	.termin-progress-bar {
		position: relative;
		height: 12px;
		background: var(--color-gray-200);
		border-radius: 6px;
		overflow: visible;
	}

	.termin-progress-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--color-success), var(--color-warning));
		border-radius: 6px 0 0 6px;
	}

	.termin-progress-marker {
		position: absolute;
		top: -4px;
		width: 4px;
		height: 20px;
		background: var(--color-error);
		transform: translateX(-50%);
	}

	.termin-progress-labels {
		display: flex;
		justify-content: space-between;
		margin-top: 0.5rem;
		font-size: 0.8rem;
		color: var(--color-gray-500);
	}

	.termin-heute {
		color: var(--color-error);
		font-weight: 600;
	}

	.termin-stats {
		display: flex;
		gap: 2rem;
		justify-content: center;
	}

	.termin-stat {
		text-align: center;
	}

	.termin-stat.warning .termin-stat-value {
		color: var(--color-warning-dark);
	}

	.termin-stat.error .termin-stat-value {
		color: var(--color-error);
	}

	.termin-stat-value {
		display: block;
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-gray-800);
	}

	.termin-stat-label {
		font-size: 0.75rem;
		color: var(--color-gray-500);
	}

	.timeline-marker.past {
		background: var(--color-success);
		box-shadow: 0 0 0 2px var(--color-success);
	}

	.timeline-marker.future {
		background: var(--color-gray-300);
		box-shadow: 0 0 0 2px var(--color-gray-300);
	}

	.milestone-item.erledigt {
		background: var(--color-success-light);
		border-color: var(--color-success);
	}

	/* Upcoming Tasks */
	.upcoming-tasks {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.upcoming-task {
		display: flex;
		gap: 1rem;
		padding: 0.75rem;
		background: white;
		border: 1px solid var(--color-gray-200);
	}

	.upcoming-task.overdue {
		border-left: 3px solid var(--color-error);
		background: var(--color-error-light);
	}

	.upcoming-date {
		font-family: var(--font-family-mono);
		font-size: 0.85rem;
		color: var(--color-gray-500);
		min-width: 90px;
	}

	.upcoming-date.overdue {
		color: var(--color-error);
		font-weight: 600;
	}

	.upcoming-title {
		color: var(--color-gray-800);
	}

	/* Error styling for currency cells */
	.data-table .currency.error {
		color: var(--color-error);
	}

	.overdue {
		color: var(--color-error);
	}

	@media (max-width: 768px) {
		.nu-budget-grid {
			grid-template-columns: 1fr;
		}

		.task-stats {
			flex-wrap: wrap;
		}

		.task-stat {
			flex: 1 1 45%;
		}

		.termin-stats {
			flex-direction: column;
			gap: 1rem;
		}
	}

	/* Edit Form Styles */
	.edit-form {
		background: var(--color-gray-50);
		border: 1px solid var(--color-gray-200);
		padding: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.form-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.form-grid-2 {
		grid-template-columns: repeat(2, 1fr);
	}

	.form-grid-4 {
		grid-template-columns: repeat(4, 1fr);
	}

	@media (max-width: 900px) {
		.form-grid-4 {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 600px) {
		.form-grid,
		.form-grid-2,
		.form-grid-4 {
			grid-template-columns: 1fr;
		}
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.form-label {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--color-gray-600);
	}

	.form-input,
	.form-select {
		padding: 0.6rem 0.75rem;
		border: 1px solid var(--color-gray-300);
		font-size: 0.9rem;
		background: white;
		transition: border-color 0.15s ease;
	}

	.form-input:focus,
	.form-select:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.1);
	}

	.form-input::placeholder {
		color: var(--color-gray-400);
	}

	.form-actions {
		display: flex;
		gap: 0.75rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--color-gray-200);
		margin-top: 0.5rem;
	}

	/* Save Message */
	.save-message {
		padding: 0.75rem 1rem;
		margin-bottom: 1rem;
		font-size: 0.9rem;
		font-weight: 500;
	}

	.save-message.success {
		background: var(--color-success-light);
		border: 1px solid var(--color-success);
		color: var(--color-success-dark);
	}

	.save-message.error {
		background: var(--color-error-light);
		border: 1px solid var(--color-error);
		color: var(--color-error-dark);
	}

	/* Section Hint */
	.section-hint {
		font-size: 0.85rem;
		color: var(--color-gray-500);
		margin: -0.5rem 0 1rem 0;
	}

	/* Nachweis Checkbox Button (klickbar) */
	.nachweis-checkbox-btn {
		width: 24px;
		height: 24px;
		padding: 0;
		background: white;
		border: 2px solid var(--color-gray-300);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
	}

	.nachweis-checkbox-btn:hover {
		border-color: var(--color-primary);
		background: var(--color-gray-50);
	}

	.nachweis-item.vorhanden .nachweis-checkbox-btn {
		background: var(--color-success);
		border-color: var(--color-success);
	}

	.nachweis-item.vorhanden .nachweis-checkbox-btn:hover {
		background: var(--color-success-dark);
		border-color: var(--color-success-dark);
	}

	.nachweis-item.vorhanden .nachweis-checkbox-btn .check-icon {
		color: white;
	}

	.nachweis-actions {
		display: flex;
		gap: 0.5rem;
	}

	/* Disabled Button State */
	button:disabled,
	.form-input:disabled,
	.form-select:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
