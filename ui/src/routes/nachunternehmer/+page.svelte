<script lang="ts">
	import { Card, Badge, KPICard, Button } from '$lib/components/ui';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';

	// Types
	interface Nachunternehmer {
		id: string;
		kontakt_nr: number;
		firma_kurz: string;
		firma_lang: string | null;
		anrede: string | null;
		vorname: string | null;
		nachname: string | null;
		email: string | null;
		telefon_mobil: string | null;
		telefon_festnetz: string | null;
		strasse: string | null;
		plz: string | null;
		ort: string | null;
		aktiv: boolean;
		compliance_docs: Record<string, NachweisDokument> | null;
		notizen: string | null;
		created_at: string;
		// NU-spezifische Felder (aus kontakte_nachunternehmer)
		nu_id: string | null;
		gewerke: string[] | null;
		hauptgewerk: string | null;
		compliance_status: string | null;
		bewertung_qualitaet: number | null;
		bewertung_termintreue: number | null;
		bewertung_kommunikation: number | null;
		stundensatz_geselle: number | null;
		stundensatz_meister: number | null;
		// Berechnete Felder
		projekte: NUProjekt[];
		gesamtvolumen: number;
		letzteAktivitaet: string | null;
	}

	interface NachweisDokument {
		vorhanden: boolean;
		gueltig_bis?: string;
		datei_url?: string;
	}

	interface NUProjekt {
		atbs_nummer: string;
		projektname: string;
		nua_nr: string | null;
		betrag_netto: number;
		datum: string;
		art: string;
	}

	// Nachweis-Status Typen
	type NachweisStatus = 'gueltig' | 'bald_ungueltig' | 'ungueltig' | 'fehlend';

	// Nachweistypen
	const NACHWEIS_TYPEN = [
		{ key: 'paragraph_13b', label: '13b UStG', pflicht: true, beschreibung: 'Freistellungsbescheinigung' },
		{ key: 'paragraph_48', label: '48b EStG', pflicht: true, beschreibung: 'Bauabzugssteuer-Freistellung' },
		{ key: 'haftpflicht', label: 'Haftpflicht', pflicht: true, beschreibung: 'Betriebshaftpflicht-Versicherung' },
		{ key: 'handelsregister', label: 'HR-Auszug', pflicht: false, beschreibung: 'Handelsregister-Auszug' },
		{ key: 'gewerbeanmeldung', label: 'Gewerbe', pflicht: false, beschreibung: 'Gewerbeanmeldung' },
		{ key: 'unbedenklichkeit_fa', label: 'FA', pflicht: false, beschreibung: 'Unbedenklichkeit Finanzamt' },
		{ key: 'unbedenklichkeit_bg', label: 'BG', pflicht: false, beschreibung: 'Unbedenklichkeit Berufsgenossenschaft' }
	];

	// Gewerke-Liste
	const GEWERKE_LISTE = [
		'Abbruch',
		'Aufzüge',
		'Baumeister',
		'Baureinigung',
		'Böden/Parkett',
		'Dach',
		'Elektrik',
		'Estrich',
		'Fassade',
		'Fensterbau',
		'Fliesen',
		'Garten/Landschaft',
		'Gerüstbau',
		'Glaserei',
		'Heizung',
		'Innenausbau',
		'Klempner',
		'Klimatechnik',
		'Maler',
		'Maurer',
		'Metallbau',
		'Putz/Stuck',
		'Rohbau',
		'Sanitär',
		'Schlosser',
		'Schreiner/Tischler',
		'Sicherheitstechnik',
		'Sonnenschutz',
		'Spengler',
		'Tiefbau',
		'Trockenbau',
		'Zimmerei'
	];

	// Status-Optionen
	const STATUS_OPTIONEN = [
		{ value: 'aktiv', label: 'Aktiv' },
		{ value: 'inaktiv', label: 'Inaktiv' },
		{ value: 'gesperrt', label: 'Gesperrt' }
	];

	// State
	let loading = $state(true);
	let error = $state<string | null>(null);
	let activeTab = $state<'alle' | 'aktiv' | 'qualifizierung' | 'nachweise' | 'warnungen'>('alle');
	let searchQuery = $state('');
	let filterGewerk = $state<string>('alle');
	let selectedNU = $state<Nachunternehmer | null>(null);

	// CRUD Modal State
	let showEditModal = $state(false);
	let editingNU = $state<Nachunternehmer | null>(null);
	let isCreating = $state(false);
	let modalTab = $state<'stammdaten' | 'gewerke' | 'nachweise'>('stammdaten');
	let saving = $state(false);
	let saveError = $state<string | null>(null);

	// Form Data
	let formData = $state({
		// Kontakt-Felder
		firma_kurz: '',
		firma_lang: '',
		anrede: '',
		vorname: '',
		nachname: '',
		email: '',
		telefon_mobil: '',
		telefon_festnetz: '',
		strasse: '',
		plz: '',
		ort: '',
		aktiv: true,
		notizen: '',
		// NU-spezifische Felder
		hauptgewerk: '',
		gewerke: [] as string[],
		stundensatz_geselle: null as number | null,
		stundensatz_meister: null as number | null,
		bewertung_qualitaet: null as number | null,
		bewertung_termintreue: null as number | null,
		bewertung_kommunikation: null as number | null,
		status: 'aktiv',
		// Nachweise
		compliance_docs: {} as Record<string, NachweisDokument>
	});

	// Delete Modal State
	let showDeleteModal = $state(false);
	let deletingNU = $state<Nachunternehmer | null>(null);
	let deleting = $state(false);

	// Data
	let nachunternehmer = $state<Nachunternehmer[]>([]);
	let alleGewerke = $state<string[]>([]);
	let nuProjekte = $state<Map<string, NUProjekt[]>>(new Map());

	// Heute + 30 Tage für "bald ungültig" Check
	const heute = new Date();
	const in30Tagen = new Date(heute.getTime() + 30 * 24 * 60 * 60 * 1000);

	// KPI Stats
	let stats = $derived.by(() => {
		const total = nachunternehmer.length;
		const aktive = nachunternehmer.filter(nu => nu.aktiv).length;
		const mitWarnungen = nachunternehmer.filter(nu => hatNachweisWarnung(nu)).length;
		const vollstaendig = nachunternehmer.filter(nu =>
			getGesamtNachweisStatus(nu) === 'vollstaendig'
		).length;
		return { total, aktive, mitWarnungen, vollstaendig };
	});

	// Gefilterte NUs
	let gefilterteNUs = $derived.by(() => {
		let filtered = [...nachunternehmer];

		// Tab-Filter
		if (activeTab === 'aktiv') {
			filtered = filtered.filter(nu => nu.aktiv);
		} else if (activeTab === 'qualifizierung') {
			filtered = filtered.filter(nu =>
				getGesamtNachweisStatus(nu) !== 'vollstaendig'
			);
		} else if (activeTab === 'warnungen') {
			filtered = filtered.filter(nu => hatNachweisWarnung(nu));
		} else if (activeTab === 'nachweise') {
			// Bei Nachweise-Tab nach Status sortieren
			filtered = filtered.sort((a, b) => {
				const statusOrder = { 'ungueltig': 0, 'bald_ungueltig': 1, 'fehlend': 2, 'vollstaendig': 3 };
				const aStatus = getGesamtNachweisStatus(a) === 'vollstaendig' ? 'vollstaendig' : getWorstNachweisStatus(a);
				const bStatus = getGesamtNachweisStatus(b) === 'vollstaendig' ? 'vollstaendig' : getWorstNachweisStatus(b);
				return (statusOrder[aStatus] || 4) - (statusOrder[bStatus] || 4);
			});
		}

		// Gewerk-Filter
		if (filterGewerk !== 'alle') {
			filtered = filtered.filter(nu =>
				nu.gewerke?.includes(filterGewerk) || nu.hauptgewerk === filterGewerk
			);
		}

		// Suche
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			filtered = filtered.filter(nu =>
				nu.firma_kurz?.toLowerCase().includes(q) ||
				nu.firma_lang?.toLowerCase().includes(q) ||
				nu.email?.toLowerCase().includes(q) ||
				nu.hauptgewerk?.toLowerCase().includes(q) ||
				nu.ort?.toLowerCase().includes(q) ||
				nu.gewerke?.some(g => g.toLowerCase().includes(q))
			);
		}

		return filtered;
	});

	// Daten laden
	async function loadData() {
		loading = true;
		error = null;

		try {
			// Nachunternehmer mit NU-Details laden
			const { data: kontakte, error: kontakteError } = await supabase
				.from('kontakte')
				.select(`
					id,
					kontakt_nr,
					firma_kurz,
					firma_lang,
					anrede,
					vorname,
					nachname,
					email,
					telefon_mobil,
					telefon_festnetz,
					strasse,
					plz,
					ort,
					aktiv,
					compliance_docs,
					notizen,
					created_at,
					kontakte_nachunternehmer (
						id,
						gewerke,
						hauptgewerk,
						compliance_status,
						bewertung_qualitaet,
						bewertung_termintreue,
						bewertung_kommunikation,
						stundensatz_geselle,
						stundensatz_meister
					)
				`)
				.contains('kontaktarten', ['nachunternehmer'])
				.order('firma_kurz');

			if (kontakteError) throw kontakteError;

			// NU-Projekte aus softr_dokumente laden (NUA und ER-NU Dokumente)
			const { data: dokumente, error: dokError } = await supabase
				.from('softr_dokumente')
				.select('atbs_nummer, projektname, nua_nr, betrag_netto, datum_erstellt, art_des_dokuments, rechnungssteller')
				.or('art_des_dokuments.ilike.%NUA%,art_des_dokuments.ilike.%ER-NU%')
				.order('datum_erstellt', { ascending: false });

			if (dokError) throw dokError;

			// Projekte nach NU-Namen gruppieren
			const projektMap = new Map<string, NUProjekt[]>();
			(dokumente || []).forEach(dok => {
				if (!dok.rechnungssteller) return;
				const nuName = dok.rechnungssteller.toLowerCase().trim();
				if (!projektMap.has(nuName)) {
					projektMap.set(nuName, []);
				}
				projektMap.get(nuName)!.push({
					atbs_nummer: dok.atbs_nummer || '',
					projektname: dok.projektname || '',
					nua_nr: dok.nua_nr,
					betrag_netto: Number(dok.betrag_netto) || 0,
					datum: dok.datum_erstellt || '',
					art: dok.art_des_dokuments || ''
				});
			});
			nuProjekte = projektMap;

			// Daten transformieren
			nachunternehmer = (kontakte || []).map(k => {
				const firmaLower = k.firma_kurz?.toLowerCase().trim() || '';
				const projekte = projektMap.get(firmaLower) || [];
				const gesamtvolumen = projekte.reduce((sum, p) => sum + (p.betrag_netto || 0), 0);
				const letzteAktivitaet = projekte.length > 0 ? projekte[0].datum : null;

				return {
					id: k.id,
					kontakt_nr: k.kontakt_nr,
					firma_kurz: k.firma_kurz,
					firma_lang: k.firma_lang,
					anrede: k.anrede,
					vorname: k.vorname,
					nachname: k.nachname,
					email: k.email,
					telefon_mobil: k.telefon_mobil,
					telefon_festnetz: k.telefon_festnetz,
					strasse: k.strasse,
					plz: k.plz,
					ort: k.ort,
					aktiv: k.aktiv ?? true,
					compliance_docs: k.compliance_docs,
					notizen: k.notizen,
					created_at: k.created_at,
					// NU-Details aus Join
					nu_id: k.kontakte_nachunternehmer?.[0]?.id || null,
					gewerke: k.kontakte_nachunternehmer?.[0]?.gewerke || null,
					hauptgewerk: k.kontakte_nachunternehmer?.[0]?.hauptgewerk || null,
					compliance_status: k.kontakte_nachunternehmer?.[0]?.compliance_status || null,
					bewertung_qualitaet: k.kontakte_nachunternehmer?.[0]?.bewertung_qualitaet || null,
					bewertung_termintreue: k.kontakte_nachunternehmer?.[0]?.bewertung_termintreue || null,
					bewertung_kommunikation: k.kontakte_nachunternehmer?.[0]?.bewertung_kommunikation || null,
					stundensatz_geselle: k.kontakte_nachunternehmer?.[0]?.stundensatz_geselle || null,
					stundensatz_meister: k.kontakte_nachunternehmer?.[0]?.stundensatz_meister || null,
					// Berechnete Felder
					projekte,
					gesamtvolumen,
					letzteAktivitaet
				};
			});

			// Gewerke extrahieren
			const gewerkSet = new Set<string>();
			nachunternehmer.forEach(nu => {
				if (nu.hauptgewerk) gewerkSet.add(nu.hauptgewerk);
				nu.gewerke?.forEach(g => gewerkSet.add(g));
			});
			alleGewerke = Array.from(gewerkSet).sort();

		} catch (err) {
			error = err instanceof Error ? err.message : 'Fehler beim Laden';
			console.error('Nachunternehmer laden fehlgeschlagen:', err);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadData();
	});

	// === CRUD Functions ===

	function openCreateModal() {
		isCreating = true;
		editingNU = null;
		modalTab = 'stammdaten';
		saveError = null;
		formData = {
			firma_kurz: '',
			firma_lang: '',
			anrede: '',
			vorname: '',
			nachname: '',
			email: '',
			telefon_mobil: '',
			telefon_festnetz: '',
			strasse: '',
			plz: '',
			ort: '',
			aktiv: true,
			notizen: '',
			hauptgewerk: '',
			gewerke: [],
			stundensatz_geselle: null,
			stundensatz_meister: null,
			bewertung_qualitaet: null,
			bewertung_termintreue: null,
			bewertung_kommunikation: null,
			status: 'aktiv',
			compliance_docs: {}
		};
		showEditModal = true;
	}

	function openEditModal(nu: Nachunternehmer) {
		isCreating = false;
		editingNU = nu;
		modalTab = 'stammdaten';
		saveError = null;
		formData = {
			firma_kurz: nu.firma_kurz || '',
			firma_lang: nu.firma_lang || '',
			anrede: nu.anrede || '',
			vorname: nu.vorname || '',
			nachname: nu.nachname || '',
			email: nu.email || '',
			telefon_mobil: nu.telefon_mobil || '',
			telefon_festnetz: nu.telefon_festnetz || '',
			strasse: nu.strasse || '',
			plz: nu.plz || '',
			ort: nu.ort || '',
			aktiv: nu.aktiv,
			notizen: nu.notizen || '',
			hauptgewerk: nu.hauptgewerk || '',
			gewerke: nu.gewerke || [],
			stundensatz_geselle: nu.stundensatz_geselle,
			stundensatz_meister: nu.stundensatz_meister,
			bewertung_qualitaet: nu.bewertung_qualitaet,
			bewertung_termintreue: nu.bewertung_termintreue,
			bewertung_kommunikation: nu.bewertung_kommunikation,
			status: nu.aktiv ? 'aktiv' : (nu.compliance_status === 'gesperrt' ? 'gesperrt' : 'inaktiv'),
			compliance_docs: nu.compliance_docs || {}
		};
		showEditModal = true;
	}

	function closeEditModal() {
		showEditModal = false;
		editingNU = null;
		isCreating = false;
		saveError = null;
	}

	async function saveNU() {
		saving = true;
		saveError = null;

		try {
			// Validierung
			if (!formData.firma_kurz.trim()) {
				throw new Error('Firma (Kurzname) ist erforderlich');
			}

			// Status zu aktiv-Flag konvertieren
			const aktiv = formData.status === 'aktiv';

			if (isCreating) {
				// 1. Kontakt anlegen
				const { data: kontakt, error: kontaktError } = await supabase
					.from('kontakte')
					.insert({
						firma_kurz: formData.firma_kurz.trim(),
						firma_lang: formData.firma_lang.trim() || null,
						anrede: formData.anrede || null,
						vorname: formData.vorname.trim() || null,
						nachname: formData.nachname.trim() || null,
						email: formData.email.trim() || null,
						telefon_mobil: formData.telefon_mobil.trim() || null,
						telefon_festnetz: formData.telefon_festnetz.trim() || null,
						strasse: formData.strasse.trim() || null,
						plz: formData.plz.trim() || null,
						ort: formData.ort.trim() || null,
						aktiv: aktiv,
						notizen: formData.notizen.trim() || null,
						kontaktarten: ['nachunternehmer'],
						compliance_docs: formData.compliance_docs
					})
					.select('id')
					.single();

				if (kontaktError) throw kontaktError;

				// 2. NU-Erweiterung anlegen
				const { error: nuError } = await supabase
					.from('kontakte_nachunternehmer')
					.insert({
						kontakt_id: kontakt.id,
						hauptgewerk: formData.hauptgewerk || null,
						gewerke: formData.gewerke.length > 0 ? formData.gewerke : null,
						stundensatz_geselle: formData.stundensatz_geselle,
						stundensatz_meister: formData.stundensatz_meister,
						bewertung_qualitaet: formData.bewertung_qualitaet,
						bewertung_termintreue: formData.bewertung_termintreue,
						bewertung_kommunikation: formData.bewertung_kommunikation,
						compliance_status: formData.status === 'gesperrt' ? 'gesperrt' : (aktiv ? 'aktiv' : 'inaktiv')
					});

				if (nuError) throw nuError;
			} else if (editingNU) {
				// 1. Kontakt aktualisieren
				const { error: kontaktError } = await supabase
					.from('kontakte')
					.update({
						firma_kurz: formData.firma_kurz.trim(),
						firma_lang: formData.firma_lang.trim() || null,
						anrede: formData.anrede || null,
						vorname: formData.vorname.trim() || null,
						nachname: formData.nachname.trim() || null,
						email: formData.email.trim() || null,
						telefon_mobil: formData.telefon_mobil.trim() || null,
						telefon_festnetz: formData.telefon_festnetz.trim() || null,
						strasse: formData.strasse.trim() || null,
						plz: formData.plz.trim() || null,
						ort: formData.ort.trim() || null,
						aktiv: aktiv,
						notizen: formData.notizen.trim() || null,
						compliance_docs: formData.compliance_docs,
						updated_at: new Date().toISOString()
					})
					.eq('id', editingNU.id);

				if (kontaktError) throw kontaktError;

				// 2. NU-Erweiterung aktualisieren oder anlegen
				if (editingNU.nu_id) {
					const { error: nuError } = await supabase
						.from('kontakte_nachunternehmer')
						.update({
							hauptgewerk: formData.hauptgewerk || null,
							gewerke: formData.gewerke.length > 0 ? formData.gewerke : null,
							stundensatz_geselle: formData.stundensatz_geselle,
							stundensatz_meister: formData.stundensatz_meister,
							bewertung_qualitaet: formData.bewertung_qualitaet,
							bewertung_termintreue: formData.bewertung_termintreue,
							bewertung_kommunikation: formData.bewertung_kommunikation,
							compliance_status: formData.status === 'gesperrt' ? 'gesperrt' : (aktiv ? 'aktiv' : 'inaktiv'),
							updated_at: new Date().toISOString()
						})
						.eq('id', editingNU.nu_id);

					if (nuError) throw nuError;
				} else {
					// NU-Erweiterung existiert noch nicht -> anlegen
					const { error: nuError } = await supabase
						.from('kontakte_nachunternehmer')
						.insert({
							kontakt_id: editingNU.id,
							hauptgewerk: formData.hauptgewerk || null,
							gewerke: formData.gewerke.length > 0 ? formData.gewerke : null,
							stundensatz_geselle: formData.stundensatz_geselle,
							stundensatz_meister: formData.stundensatz_meister,
							bewertung_qualitaet: formData.bewertung_qualitaet,
							bewertung_termintreue: formData.bewertung_termintreue,
							bewertung_kommunikation: formData.bewertung_kommunikation,
							compliance_status: formData.status === 'gesperrt' ? 'gesperrt' : (aktiv ? 'aktiv' : 'inaktiv')
						});

					if (nuError) throw nuError;
				}
			}

			// Erfolgreich - Modal schließen und Daten neu laden
			closeEditModal();
			await loadData();
		} catch (err) {
			saveError = err instanceof Error ? err.message : 'Fehler beim Speichern';
			console.error('Speichern fehlgeschlagen:', err);
		} finally {
			saving = false;
		}
	}

	function openDeleteModal(nu: Nachunternehmer) {
		deletingNU = nu;
		showDeleteModal = true;
	}

	function closeDeleteModal() {
		showDeleteModal = false;
		deletingNU = null;
	}

	async function deleteNU() {
		if (!deletingNU) return;

		deleting = true;

		try {
			// Soft-Delete: Setze aktiv = false und compliance_status = 'geloescht'
			const { error: kontaktError } = await supabase
				.from('kontakte')
				.update({
					aktiv: false,
					updated_at: new Date().toISOString()
				})
				.eq('id', deletingNU.id);

			if (kontaktError) throw kontaktError;

			if (deletingNU.nu_id) {
				const { error: nuError } = await supabase
					.from('kontakte_nachunternehmer')
					.update({
						compliance_status: 'geloescht',
						updated_at: new Date().toISOString()
					})
					.eq('id', deletingNU.nu_id);

				if (nuError) throw nuError;
			}

			closeDeleteModal();
			await loadData();
		} catch (err) {
			console.error('Löschen fehlgeschlagen:', err);
			alert('Fehler beim Löschen: ' + (err instanceof Error ? err.message : 'Unbekannter Fehler'));
		} finally {
			deleting = false;
		}
	}

	// Gewerk Toggle für Multi-Select
	function toggleGewerk(gewerk: string) {
		if (formData.gewerke.includes(gewerk)) {
			formData.gewerke = formData.gewerke.filter(g => g !== gewerk);
		} else {
			formData.gewerke = [...formData.gewerke, gewerk];
		}
	}

	// Nachweis aktualisieren
	function updateNachweis(key: string, field: 'vorhanden' | 'gueltig_bis' | 'datei_url', value: boolean | string) {
		const current = formData.compliance_docs[key] || { vorhanden: false };
		formData.compliance_docs = {
			...formData.compliance_docs,
			[key]: {
				...current,
				[field]: value
			}
		};
	}

	// === Nachweis-Status Funktionen ===

	function getNachweisStatus(nu: Nachunternehmer, key: string): NachweisStatus {
		const doc = nu.compliance_docs?.[key];

		// Nicht vorhanden = fehlend
		if (!doc?.vorhanden) return 'fehlend';

		// Kein Gültigkeitsdatum = gültig (z.B. Handelsregister)
		if (!doc.gueltig_bis) return 'gueltig';

		const gueltigBis = new Date(doc.gueltig_bis);

		// Abgelaufen = ungültig
		if (gueltigBis < heute) return 'ungueltig';

		// Weniger als 30 Tage = bald ungültig
		if (gueltigBis < in30Tagen) return 'bald_ungueltig';

		return 'gueltig';
	}

	function getWorstNachweisStatus(nu: Nachunternehmer): NachweisStatus {
		const pflichtNachweise = NACHWEIS_TYPEN.filter(n => n.pflicht);
		const statusPriority: NachweisStatus[] = ['ungueltig', 'bald_ungueltig', 'fehlend', 'gueltig'];

		for (const status of statusPriority) {
			if (pflichtNachweise.some(n => getNachweisStatus(nu, n.key) === status)) {
				return status;
			}
		}
		return 'gueltig';
	}

	function hatNachweisWarnung(nu: Nachunternehmer): boolean {
		const pflichtNachweise = NACHWEIS_TYPEN.filter(n => n.pflicht);
		return pflichtNachweise.some(n => {
			const status = getNachweisStatus(nu, n.key);
			return status === 'ungueltig' || status === 'bald_ungueltig' || status === 'fehlend';
		});
	}

	function getGesamtNachweisStatus(nu: Nachunternehmer): 'vollstaendig' | 'unvollstaendig' {
		const pflichtNachweise = NACHWEIS_TYPEN.filter(n => n.pflicht);
		const alleGueltig = pflichtNachweise.every(n => {
			const status = getNachweisStatus(nu, n.key);
			return status === 'gueltig';
		});
		return alleGueltig ? 'vollstaendig' : 'unvollstaendig';
	}

	function getNachweisIcon(status: NachweisStatus): string {
		switch (status) {
			case 'gueltig': return 'OK';
			case 'bald_ungueltig': return '!';
			case 'ungueltig': return 'X';
			case 'fehlend': return '-';
		}
	}

	function getNachweisBadgeVariant(status: NachweisStatus): 'success' | 'warning' | 'error' | 'default' {
		switch (status) {
			case 'gueltig': return 'success';
			case 'bald_ungueltig': return 'warning';
			case 'ungueltig': return 'error';
			case 'fehlend': return 'default';
		}
	}

	function getComplianceStatusBadge(nu: Nachunternehmer): { label: string; variant: 'success' | 'warning' | 'error' | 'default' } {
		const worstStatus = getWorstNachweisStatus(nu);
		const pflichtNachweise = NACHWEIS_TYPEN.filter(n => n.pflicht);
		const gueltigeAnzahl = pflichtNachweise.filter(n => getNachweisStatus(nu, n.key) === 'gueltig').length;

		if (worstStatus === 'gueltig') {
			return { label: 'Vollständig', variant: 'success' };
		}
		if (worstStatus === 'ungueltig') {
			return { label: 'Ungültig', variant: 'error' };
		}
		if (worstStatus === 'bald_ungueltig') {
			return { label: 'Bald ablaufend', variant: 'warning' };
		}
		return { label: `${gueltigeAnzahl}/${pflichtNachweise.length}`, variant: 'warning' };
	}

	function formatNachweisDate(nu: Nachunternehmer, key: string): string {
		const doc = nu.compliance_docs?.[key];
		if (!doc?.gueltig_bis) return '-';
		return new Date(doc.gueltig_bis).toLocaleDateString('de-DE');
	}

	// Nachweis-Warnung berechnen (Tage bis Ablauf)
	function getNachweisWarningDays(gueltigBis: string | undefined): number | null {
		if (!gueltigBis) return null;
		const date = new Date(gueltigBis);
		const diff = date.getTime() - heute.getTime();
		return Math.ceil(diff / (1000 * 60 * 60 * 24));
	}

	// === Helper Functions ===

	function formatPhone(phone: string | null): string {
		if (!phone) return '-';
		return phone.replace(/^(\+?\d{2,3})(\d{3})(\d+)$/, '$1 $2 $3');
	}

	function formatCurrency(value: number): string {
		return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
	}

	function getAverageBewertung(nu: Nachunternehmer): number | null {
		const ratings = [nu.bewertung_qualitaet, nu.bewertung_termintreue, nu.bewertung_kommunikation]
			.filter((r): r is number => r !== null);
		if (ratings.length === 0) return null;
		return Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length * 10) / 10;
	}

	function renderStars(rating: number | null): string {
		if (rating === null) return '-';
		const full = Math.floor(rating);
		const half = rating % 1 >= 0.5 ? 1 : 0;
		const empty = 5 - full - half;
		return '★'.repeat(full) + (half ? '☆' : '') + '☆'.repeat(empty);
	}

	// === Erinnerungs-Logik ===

	function generateReminderEmail(nu: Nachunternehmer, fehlende: string[]): string {
		const betreff = `Nachweise erforderlich - ${nu.firma_kurz}`;
		const text = `Sehr geehrte Damen und Herren,

bitte übermitteln Sie uns die folgenden Unterlagen:

${fehlende.map(f => `- ${f}`).join('\n')}

Wir können nur bei vollständigen und aktuellen Unterlagen Rechnungen bearbeiten (gesetzliche Anforderungen nach §13b UStG und §48b EStG).

Mit freundlichen Grüßen
neurealis GmbH`;

		return `mailto:${nu.email}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(text)}`;
	}

	// === Projekt-Arbeitsperioden berechnen ===

	function getProjektZeitraum(projekte: NUProjekt[]): { von: string; bis: string } | null {
		if (projekte.length === 0) return null;
		const daten = projekte.map(p => p.datum).filter(Boolean).sort();
		if (daten.length === 0) return null;
		return { von: daten[0], bis: daten[daten.length - 1] };
	}

	// === Budget-Diagramm Daten (24 Monate) ===

	function getBudgetChartData(nu: Nachunternehmer): { monat: string; betrag: number }[] {
		const monateDaten = new Map<string, number>();

		// Letzte 24 Monate initialisieren
		for (let i = 23; i >= 0; i--) {
			const d = new Date();
			d.setMonth(d.getMonth() - i);
			const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
			monateDaten.set(key, 0);
		}

		// Projekte aggregieren
		nu.projekte.forEach(p => {
			if (!p.datum || !p.betrag_netto) return;
			const d = new Date(p.datum);
			const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
			if (monateDaten.has(key)) {
				monateDaten.set(key, (monateDaten.get(key) || 0) + p.betrag_netto);
			}
		});

		return Array.from(monateDaten.entries()).map(([monat, betrag]) => ({ monat, betrag }));
	}

	function getMaxBudget(data: { monat: string; betrag: number }[]): number {
		return Math.max(...data.map(d => d.betrag), 1);
	}
</script>

<div class="nu-page">
	<header class="page-header">
		<div class="header-left">
			<h1>Nachunternehmer</h1>
			<p class="subtitle">Verwaltung und Qualifizierung</p>
		</div>
		<div class="header-right">
			<Button variant="primary" onclick={openCreateModal}>
				+ Neuer Nachunternehmer
			</Button>
		</div>
	</header>

	{#if error}
		<Card>
			<div class="error-message">
				<strong>Fehler:</strong> {error}
				<button onclick={() => loadData()}>Erneut versuchen</button>
			</div>
		</Card>
	{/if}

	<!-- KPIs -->
	<section class="kpi-section">
		<KPICard
			label="Gesamt"
			value={loading ? '...' : stats.total}
			subvalue="Nachunternehmer"
			icon="NU"
			color="blue"
		/>
		<KPICard
			label="Aktiv"
			value={loading ? '...' : stats.aktive}
			subvalue="einsatzbereit"
			icon="OK"
			color="green"
		/>
		<KPICard
			label="Mit Warnungen"
			value={loading ? '...' : stats.mitWarnungen}
			subvalue="Nachweise prüfen"
			icon="!"
			color="orange"
		/>
		<KPICard
			label="Vollständig"
			value={loading ? '...' : stats.vollstaendig}
			subvalue="alle Nachweise"
			icon="OK"
			color="purple"
		/>
	</section>

	<!-- Tabs -->
	<div class="tabs">
		<button
			class="tab"
			class:active={activeTab === 'alle'}
			onclick={() => activeTab = 'alle'}
		>
			Alle NUs
		</button>
		<button
			class="tab"
			class:active={activeTab === 'aktiv'}
			onclick={() => activeTab = 'aktiv'}
		>
			Aktive
		</button>
		<button
			class="tab"
			class:active={activeTab === 'warnungen'}
			onclick={() => activeTab = 'warnungen'}
		>
			Warnungen {stats.mitWarnungen > 0 ? `(${stats.mitWarnungen})` : ''}
		</button>
		<button
			class="tab"
			class:active={activeTab === 'qualifizierung'}
			onclick={() => activeTab = 'qualifizierung'}
		>
			In Qualifizierung
		</button>
		<button
			class="tab"
			class:active={activeTab === 'nachweise'}
			onclick={() => activeTab = 'nachweise'}
		>
			Nachweise
		</button>
	</div>

	<!-- Filter & Suche -->
	<div class="filter-bar">
		<div class="filter-left">
			<input
				type="search"
				class="search-input"
				placeholder="Suche nach Firma, E-Mail, Ort, Gewerk..."
				bind:value={searchQuery}
			/>
			<label class="filter-group">
				<span>Gewerk:</span>
				<select bind:value={filterGewerk}>
					<option value="alle">Alle Gewerke</option>
					{#each alleGewerke as gewerk}
						<option value={gewerk}>{gewerk}</option>
					{/each}
				</select>
			</label>
		</div>
		<span class="result-count">
			{gefilterteNUs.length} Nachunternehmer
		</span>
	</div>

	<!-- Content basierend auf Tab -->
	{#if loading}
		<Card>
			<div class="loading-state">Lade Nachunternehmer...</div>
		</Card>
	{:else if gefilterteNUs.length === 0}
		<Card>
			<div class="empty-state">
				<p>Keine Nachunternehmer gefunden</p>
				<Button variant="primary" onclick={openCreateModal}>
					Ersten Nachunternehmer anlegen
				</Button>
			</div>
		</Card>
	{:else if activeTab === 'nachweise'}
		<!-- Nachweise-Tabelle -->
		<Card padding="none">
			<div class="table-wrapper">
				<table class="nachweise-table">
					<thead>
						<tr>
							<th class="th-firma">Firma</th>
							<th class="th-status">Status</th>
							{#each NACHWEIS_TYPEN as nachweis}
								<th class="th-nachweis" class:pflicht={nachweis.pflicht} title={nachweis.beschreibung}>
									{nachweis.label}
								</th>
							{/each}
							<th class="th-action">Aktionen</th>
						</tr>
					</thead>
					<tbody>
						{#each gefilterteNUs as nu (nu.id)}
							{@const status = getComplianceStatusBadge(nu)}
							{@const fehlende = NACHWEIS_TYPEN.filter(n => n.pflicht && getNachweisStatus(nu, n.key) !== 'gueltig').map(n => n.beschreibung)}
							<tr class:warnung={hatNachweisWarnung(nu)}>
								<td class="firma-cell">
									<span class="firma-name">{nu.firma_kurz}</span>
									{#if nu.hauptgewerk}
										<span class="firma-gewerk">{nu.hauptgewerk}</span>
									{/if}
								</td>
								<td>
									<Badge variant={status.variant} size="sm">{status.label}</Badge>
								</td>
								{#each NACHWEIS_TYPEN as nachweis}
									{@const nachweisStatus = getNachweisStatus(nu, nachweis.key)}
									<td class="nachweis-cell">
										<span
											class="nachweis-icon {nachweisStatus}"
											title="{nachweis.beschreibung}: {nachweisStatus === 'gueltig' ? 'Gültig' : nachweisStatus === 'bald_ungueltig' ? 'Läuft bald ab' : nachweisStatus === 'ungueltig' ? 'Abgelaufen' : 'Fehlt'}{nu.compliance_docs?.[nachweis.key]?.gueltig_bis ? ' (bis ' + formatNachweisDate(nu, nachweis.key) + ')' : ''}"
										>
											{getNachweisIcon(nachweisStatus)}
										</span>
									</td>
								{/each}
								<td class="action-cell">
									<button class="btn-icon" title="Bearbeiten" onclick={() => openEditModal(nu)}>
										Edit
									</button>
									{#if fehlende.length > 0 && nu.email}
										<a href={generateReminderEmail(nu, fehlende)} class="btn-remind" title="Erinnerung senden">
											Mail
										</a>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Card>
	{:else}
		<!-- Karten-Layout -->
		<div class="nu-grid">
			{#each gefilterteNUs as nu (nu.id)}
				{@const status = getComplianceStatusBadge(nu)}
				<Card>
					<div class="nu-card">
						<div class="nu-header">
							<div class="nu-name-block">
								<h3 class="nu-name">{nu.firma_kurz}</h3>
								{#if nu.firma_lang && nu.firma_lang !== nu.firma_kurz}
									<span class="nu-firma-lang">{nu.firma_lang}</span>
								{/if}
							</div>
							<div class="nu-badges">
								{#if nu.aktiv}
									<Badge variant="success" size="sm">Aktiv</Badge>
								{:else}
									<Badge variant="default" size="sm">Inaktiv</Badge>
								{/if}
								<Badge variant={status.variant} size="sm">
									{#if hatNachweisWarnung(nu)}
										<span class="warning-emoji">{getWorstNachweisStatus(nu) === 'ungueltig' ? '!!' : '!'}</span>
									{/if}
									{status.label}
								</Badge>
							</div>
						</div>

						<div class="nu-details">
							<!-- Alle Gewerke anzeigen -->
							{#if nu.gewerke && nu.gewerke.length > 0}
								<div class="nu-detail">
									<span class="detail-label">Gewerke</span>
									<span class="detail-value gewerke-list">
										{#each nu.gewerke as gewerk, i}
											<span class="gewerk-tag" class:hauptgewerk={gewerk === nu.hauptgewerk}>
												{gewerk}
											</span>
										{/each}
									</span>
								</div>
							{:else if nu.hauptgewerk}
								<div class="nu-detail">
									<span class="detail-label">Gewerk</span>
									<span class="detail-value">{nu.hauptgewerk}</span>
								</div>
							{/if}

							{#if nu.email}
								<div class="nu-detail">
									<span class="detail-label">E-Mail</span>
									<a href="mailto:{nu.email}" class="detail-value email">{nu.email}</a>
								</div>
							{/if}

							{#if nu.telefon_mobil || nu.telefon_festnetz}
								<div class="nu-detail">
									<span class="detail-label">Telefon</span>
									<span class="detail-value">{formatPhone(nu.telefon_mobil || nu.telefon_festnetz)}</span>
								</div>
							{/if}

							{#if nu.ort}
								<div class="nu-detail">
									<span class="detail-label">Ort</span>
									<span class="detail-value">{nu.plz ? nu.plz + ' ' : ''}{nu.ort}</span>
								</div>
							{/if}
						</div>

						<!-- Projekt-Statistiken -->
						{#if nu.projekte.length > 0}
							<div class="nu-projekte-stats">
								<div class="stat">
									<span class="stat-value">{nu.projekte.length}</span>
									<span class="stat-label">Projekte</span>
								</div>
								<div class="stat">
									<span class="stat-value">{formatCurrency(nu.gesamtvolumen)}</span>
									<span class="stat-label">Volumen</span>
								</div>
								{#if nu.letzteAktivitaet}
									<div class="stat">
										<span class="stat-value">{new Date(nu.letzteAktivitaet).toLocaleDateString('de-DE')}</span>
										<span class="stat-label">Letzte Aktivität</span>
									</div>
								{/if}
							</div>

							<!-- Mini Budget-Chart (24 Monate) -->
							{@const chartData = getBudgetChartData(nu)}
							{@const maxBudget = getMaxBudget(chartData)}
							{#if maxBudget > 1}
								<div class="mini-chart">
									<div class="chart-bars">
										{#each chartData as dataPoint}
											<div
												class="chart-bar"
												style="height: {(dataPoint.betrag / maxBudget) * 100}%"
												title="{dataPoint.monat}: {formatCurrency(dataPoint.betrag)}"
											></div>
										{/each}
									</div>
									<div class="chart-label">Budget 24 Monate</div>
								</div>
							{/if}
						{/if}

						<!-- Bewertung -->
						{#if getAverageBewertung(nu) !== null}
							<div class="nu-rating">
								<span class="rating-stars">{renderStars(getAverageBewertung(nu))}</span>
								<span class="rating-value">{getAverageBewertung(nu)}/5</span>
							</div>
						{/if}

						<!-- Nachweise-Übersicht mit Warnungen -->
						<div class="nu-nachweise">
							{#each NACHWEIS_TYPEN.filter(n => n.pflicht) as nachweis}
								{@const nachweisStatus = getNachweisStatus(nu, nachweis.key)}
								<span
									class="nachweis-badge {nachweisStatus}"
									title="{nachweis.beschreibung}: {nachweisStatus === 'gueltig' ? 'Gültig' : nachweisStatus === 'bald_ungueltig' ? 'Läuft bald ab' : nachweisStatus === 'ungueltig' ? 'Abgelaufen' : 'Fehlt'}"
								>
									{#if nachweisStatus === 'ungueltig' || nachweisStatus === 'bald_ungueltig'}
										<span class="badge-warning">{nachweisStatus === 'ungueltig' ? '!!' : '!'}</span>
									{/if}
									{nachweis.label}
								</span>
							{/each}
						</div>

						<!-- Action Buttons -->
						<div class="nu-actions">
							<button class="btn-action btn-edit" onclick={() => openEditModal(nu)}>
								Bearbeiten
							</button>
							{#if nu.projekte.length > 0}
								<button class="btn-action btn-projekte" onclick={() => selectedNU = nu}>
									Projekte ({nu.projekte.length})
								</button>
							{/if}
							<button class="btn-action btn-delete" onclick={() => openDeleteModal(nu)}>
								Löschen
							</button>
						</div>
					</div>
				</Card>
			{/each}
		</div>
	{/if}

	<!-- Legende -->
	<div class="legende">
		<h4>Nachweis-Status:</h4>
		<div class="legende-items">
			<span class="legende-item"><span class="status-dot gueltig"></span> Gültig</span>
			<span class="legende-item"><span class="status-dot bald_ungueltig"></span> Bald ablaufend (&lt;30 Tage)</span>
			<span class="legende-item"><span class="status-dot ungueltig"></span> Abgelaufen</span>
			<span class="legende-item"><span class="status-dot fehlend"></span> Fehlt</span>
		</div>
		<h4>Pflicht-Nachweise:</h4>
		<div class="legende-items">
			<span><strong>13b UStG:</strong> Freistellungsbescheinigung</span>
			<span><strong>48b EStG:</strong> Bauabzugssteuer-Freistellung</span>
			<span><strong>Haftpflicht:</strong> Betriebshaftpflicht-Versicherung</span>
		</div>
	</div>
</div>

<!-- Projekte-Modal -->
{#if selectedNU}
	<div class="modal-overlay" onclick={() => selectedNU = null}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>Projekte mit {selectedNU.firma_kurz}</h2>
				<button class="modal-close" onclick={() => selectedNU = null}>X</button>
			</div>
			<div class="modal-body">
				{#if getProjektZeitraum(selectedNU.projekte)}
					{@const zeitraum = getProjektZeitraum(selectedNU.projekte)}
					<div class="projekt-zeitraum">
						<strong>Zusammenarbeit:</strong> {new Date(zeitraum.von).toLocaleDateString('de-DE')} - {new Date(zeitraum.bis).toLocaleDateString('de-DE')}
					</div>
				{/if}

				<div class="projekt-summary">
					<div class="summary-item">
						<span class="summary-value">{selectedNU.projekte.length}</span>
						<span class="summary-label">Projekte</span>
					</div>
					<div class="summary-item">
						<span class="summary-value">{formatCurrency(selectedNU.gesamtvolumen)}</span>
						<span class="summary-label">Gesamtvolumen</span>
					</div>
				</div>

				<table class="projekte-table">
					<thead>
						<tr>
							<th>ATBS</th>
							<th>Projekt</th>
							<th>NUA-Nr</th>
							<th>Betrag</th>
							<th>Datum</th>
						</tr>
					</thead>
					<tbody>
						{#each selectedNU.projekte as projekt}
							<tr>
								<td>{projekt.atbs_nummer}</td>
								<td class="projekt-name">{projekt.projektname}</td>
								<td>{projekt.nua_nr || '-'}</td>
								<td>{projekt.betrag_netto ? formatCurrency(projekt.betrag_netto) : '-'}</td>
								<td>{projekt.datum ? new Date(projekt.datum).toLocaleDateString('de-DE') : '-'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</div>
{/if}

<!-- Edit/Create Modal -->
{#if showEditModal}
	<div class="modal-overlay" onclick={closeEditModal}>
		<div class="modal-content modal-large" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>{isCreating ? 'Neuer Nachunternehmer' : `${editingNU?.firma_kurz} bearbeiten`}</h2>
				<button class="modal-close" onclick={closeEditModal}>X</button>
			</div>

			<!-- Modal Tabs -->
			<div class="modal-tabs">
				<button
					class="modal-tab"
					class:active={modalTab === 'stammdaten'}
					onclick={() => modalTab = 'stammdaten'}
				>
					Stammdaten
				</button>
				<button
					class="modal-tab"
					class:active={modalTab === 'gewerke'}
					onclick={() => modalTab = 'gewerke'}
				>
					Gewerke & Bewertung
				</button>
				<button
					class="modal-tab"
					class:active={modalTab === 'nachweise'}
					onclick={() => modalTab = 'nachweise'}
				>
					Nachweise
				</button>
			</div>

			<div class="modal-body">
				{#if saveError}
					<div class="form-error">{saveError}</div>
				{/if}

				{#if modalTab === 'stammdaten'}
					<!-- Stammdaten Tab -->
					<div class="form-grid">
						<div class="form-group span-2">
							<label for="firma_kurz">Firma (Kurzname) *</label>
							<input
								type="text"
								id="firma_kurz"
								bind:value={formData.firma_kurz}
								placeholder="z.B. Müller Elektro"
								required
							/>
						</div>
						<div class="form-group span-2">
							<label for="firma_lang">Firma (Vollständig)</label>
							<input
								type="text"
								id="firma_lang"
								bind:value={formData.firma_lang}
								placeholder="z.B. Müller Elektrotechnik GmbH"
							/>
						</div>
						<div class="form-group">
							<label for="anrede">Anrede</label>
							<select id="anrede" bind:value={formData.anrede}>
								<option value="">-- Auswählen --</option>
								<option value="Herr">Herr</option>
								<option value="Frau">Frau</option>
								<option value="Firma">Firma</option>
							</select>
						</div>
						<div class="form-group">
							<label for="vorname">Vorname</label>
							<input type="text" id="vorname" bind:value={formData.vorname} />
						</div>
						<div class="form-group">
							<label for="nachname">Nachname</label>
							<input type="text" id="nachname" bind:value={formData.nachname} />
						</div>
						<div class="form-group">
							<label for="status">Status</label>
							<select id="status" bind:value={formData.status}>
								{#each STATUS_OPTIONEN as option}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						</div>
						<div class="form-group span-2">
							<label for="email">E-Mail</label>
							<input type="email" id="email" bind:value={formData.email} placeholder="email@beispiel.de" />
						</div>
						<div class="form-group">
							<label for="telefon_mobil">Mobil</label>
							<input type="tel" id="telefon_mobil" bind:value={formData.telefon_mobil} placeholder="+49 170 1234567" />
						</div>
						<div class="form-group">
							<label for="telefon_festnetz">Festnetz</label>
							<input type="tel" id="telefon_festnetz" bind:value={formData.telefon_festnetz} placeholder="+49 30 1234567" />
						</div>
						<div class="form-group span-2">
							<label for="strasse">Straße</label>
							<input type="text" id="strasse" bind:value={formData.strasse} />
						</div>
						<div class="form-group">
							<label for="plz">PLZ</label>
							<input type="text" id="plz" bind:value={formData.plz} maxlength="5" />
						</div>
						<div class="form-group">
							<label for="ort">Ort</label>
							<input type="text" id="ort" bind:value={formData.ort} />
						</div>
						<div class="form-group span-4">
							<label for="notizen">Notizen</label>
							<textarea id="notizen" bind:value={formData.notizen} rows="3"></textarea>
						</div>
					</div>
				{:else if modalTab === 'gewerke'}
					<!-- Gewerke & Bewertung Tab -->
					<div class="form-section">
						<h3>Hauptgewerk</h3>
						<div class="form-group">
							<label for="hauptgewerk">Hauptgewerk</label>
							<select id="hauptgewerk" bind:value={formData.hauptgewerk}>
								<option value="">-- Kein Hauptgewerk --</option>
								{#each GEWERKE_LISTE as gewerk}
									<option value={gewerk}>{gewerk}</option>
								{/each}
							</select>
						</div>
					</div>

					<div class="form-section">
						<h3>Weitere Gewerke</h3>
						<div class="gewerke-grid">
							{#each GEWERKE_LISTE as gewerk}
								<label class="gewerk-checkbox" class:selected={formData.gewerke.includes(gewerk)}>
									<input
										type="checkbox"
										checked={formData.gewerke.includes(gewerk)}
										onchange={() => toggleGewerk(gewerk)}
									/>
									<span>{gewerk}</span>
								</label>
							{/each}
						</div>
					</div>

					<div class="form-section">
						<h3>Stundensätze</h3>
						<div class="form-grid">
							<div class="form-group">
								<label for="stundensatz_geselle">Stundensatz Geselle (EUR)</label>
								<input
									type="number"
									id="stundensatz_geselle"
									bind:value={formData.stundensatz_geselle}
									min="0"
									step="0.50"
								/>
							</div>
							<div class="form-group">
								<label for="stundensatz_meister">Stundensatz Meister (EUR)</label>
								<input
									type="number"
									id="stundensatz_meister"
									bind:value={formData.stundensatz_meister}
									min="0"
									step="0.50"
								/>
							</div>
						</div>
					</div>

					<div class="form-section">
						<h3>Bewertung (1-5 Sterne)</h3>
						<div class="form-grid">
							<div class="form-group">
								<label for="bewertung_qualitaet">Qualität</label>
								<div class="rating-input">
									{#each [1, 2, 3, 4, 5] as star}
										<button
											type="button"
											class="star-btn"
											class:active={(formData.bewertung_qualitaet || 0) >= star}
											onclick={() => formData.bewertung_qualitaet = formData.bewertung_qualitaet === star ? null : star}
										>
											★
										</button>
									{/each}
								</div>
							</div>
							<div class="form-group">
								<label for="bewertung_termintreue">Termintreue</label>
								<div class="rating-input">
									{#each [1, 2, 3, 4, 5] as star}
										<button
											type="button"
											class="star-btn"
											class:active={(formData.bewertung_termintreue || 0) >= star}
											onclick={() => formData.bewertung_termintreue = formData.bewertung_termintreue === star ? null : star}
										>
											★
										</button>
									{/each}
								</div>
							</div>
							<div class="form-group">
								<label for="bewertung_kommunikation">Kommunikation</label>
								<div class="rating-input">
									{#each [1, 2, 3, 4, 5] as star}
										<button
											type="button"
											class="star-btn"
											class:active={(formData.bewertung_kommunikation || 0) >= star}
											onclick={() => formData.bewertung_kommunikation = formData.bewertung_kommunikation === star ? null : star}
										>
											★
										</button>
									{/each}
								</div>
							</div>
						</div>
					</div>
				{:else if modalTab === 'nachweise'}
					<!-- Nachweise Tab -->
					<div class="nachweise-form">
						{#each NACHWEIS_TYPEN as nachweis}
							{@const doc = formData.compliance_docs[nachweis.key] || { vorhanden: false }}
							{@const days = getNachweisWarningDays(doc.gueltig_bis)}
							<div class="nachweis-row" class:pflicht={nachweis.pflicht} class:warning={days !== null && days < 30 && days >= 0} class:expired={days !== null && days < 0}>
								<div class="nachweis-info">
									<span class="nachweis-label">
										{nachweis.beschreibung}
										{#if nachweis.pflicht}
											<span class="pflicht-marker">*</span>
										{/if}
									</span>
									<span class="nachweis-key">{nachweis.label}</span>
								</div>
								<div class="nachweis-controls">
									<label class="checkbox-label">
										<input
											type="checkbox"
											checked={doc.vorhanden}
											onchange={(e) => updateNachweis(nachweis.key, 'vorhanden', e.currentTarget.checked)}
										/>
										Vorhanden
									</label>
									<div class="date-input">
										<label>Gültig bis:</label>
										<input
											type="date"
											value={doc.gueltig_bis || ''}
											onchange={(e) => updateNachweis(nachweis.key, 'gueltig_bis', e.currentTarget.value)}
											disabled={!doc.vorhanden}
										/>
									</div>
									<div class="url-input">
										<label>Datei-URL:</label>
										<input
											type="url"
											value={doc.datei_url || ''}
											placeholder="https://..."
											onchange={(e) => updateNachweis(nachweis.key, 'datei_url', e.currentTarget.value)}
											disabled={!doc.vorhanden}
										/>
									</div>
								</div>
								{#if days !== null}
									<div class="days-indicator" class:warning={days < 30 && days >= 0} class:expired={days < 0}>
										{#if days < 0}
											Abgelaufen vor {Math.abs(days)} Tagen
										{:else if days === 0}
											Läuft heute ab
										{:else if days < 30}
											Noch {days} Tage gültig
										{:else}
											Noch {days} Tage gültig
										{/if}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="modal-footer">
				<Button variant="ghost" onclick={closeEditModal} disabled={saving}>
					Abbrechen
				</Button>
				<Button variant="primary" onclick={saveNU} loading={saving}>
					{isCreating ? 'Anlegen' : 'Speichern'}
				</Button>
			</div>
		</div>
	</div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && deletingNU}
	<div class="modal-overlay" onclick={closeDeleteModal}>
		<div class="modal-content modal-small" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>Nachunternehmer löschen</h2>
				<button class="modal-close" onclick={closeDeleteModal}>X</button>
			</div>
			<div class="modal-body">
				<p class="delete-warning">
					Möchten Sie den Nachunternehmer <strong>{deletingNU.firma_kurz}</strong> wirklich deaktivieren?
				</p>
				<p class="delete-info">
					Der Nachunternehmer wird auf "Inaktiv" gesetzt und kann bei Bedarf wieder aktiviert werden.
				</p>
			</div>
			<div class="modal-footer">
				<Button variant="ghost" onclick={closeDeleteModal} disabled={deleting}>
					Abbrechen
				</Button>
				<Button variant="danger" onclick={deleteNU} loading={deleting}>
					Deaktivieren
				</Button>
			</div>
		</div>
	</div>
{/if}

<style>
	.nu-page {
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

	.header-left h1 {
		font-size: 1.75rem;
		margin-bottom: 0.25rem;
	}

	.subtitle {
		color: var(--color-gray-500);
		margin: 0;
	}

	.error-message {
		padding: 1rem;
		background: var(--color-red-50);
		color: var(--color-red-700);
		border-radius: 0.5rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.error-message button {
		background: var(--color-red-600);
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 0.25rem;
		cursor: pointer;
	}

	/* KPI Section */
	.kpi-section {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin-bottom: 1.5rem;
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

	/* Tabs */
	.tabs {
		display: flex;
		gap: 0;
		margin-bottom: 1rem;
		border-bottom: 1px solid var(--color-gray-200);
		overflow-x: auto;
	}

	.tab {
		padding: 0.75rem 1.5rem;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		font-size: 0.9rem;
		color: var(--color-gray-500);
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.tab:hover {
		color: var(--color-gray-700);
	}

	.tab.active {
		color: var(--color-brand-medium);
		border-bottom-color: var(--color-brand-medium);
	}

	/* Filter Bar */
	.filter-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding: 0.75rem 1rem;
		background: var(--color-gray-50);
		border-radius: 0.5rem;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.filter-left {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.search-input {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-gray-300);
		border-radius: 0.25rem;
		font-size: 0.875rem;
		min-width: 250px;
	}

	.search-input:focus {
		outline: none;
		border-color: var(--color-brand-medium);
	}

	.filter-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.filter-group span {
		font-size: 0.875rem;
		color: var(--color-gray-600);
	}

	.filter-group select {
		padding: 0.5rem;
		border: 1px solid var(--color-gray-300);
		border-radius: 0.25rem;
		font-size: 0.875rem;
	}

	.result-count {
		font-size: 0.875rem;
		color: var(--color-gray-500);
	}

	/* Loading / Empty */
	.loading-state,
	.empty-state {
		padding: 3rem;
		text-align: center;
		color: var(--color-gray-500);
	}

	.empty-state p {
		margin-bottom: 1rem;
	}

	/* NU Grid */
	.nu-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
		gap: 1rem;
	}

	/* NU Card */
	.nu-card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.nu-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.nu-name-block {
		flex: 1;
		min-width: 0;
	}

	.nu-name {
		font-size: 1.1rem;
		font-weight: 600;
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.nu-firma-lang {
		font-size: 0.8rem;
		color: var(--color-gray-500);
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.nu-badges {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.warning-emoji {
		color: inherit;
		margin-right: 0.25rem;
	}

	.nu-details {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--color-gray-100);
	}

	.nu-detail {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.detail-label {
		font-size: 0.8rem;
		color: var(--color-gray-500);
		flex-shrink: 0;
	}

	.detail-value {
		font-size: 0.875rem;
		color: var(--color-gray-700);
		text-align: right;
	}

	.detail-value.email {
		color: var(--color-brand-medium);
		text-decoration: none;
	}

	.detail-value.email:hover {
		text-decoration: underline;
	}

	/* Gewerke als Tags */
	.gewerke-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		justify-content: flex-end;
	}

	.gewerk-tag {
		font-size: 0.7rem;
		padding: 0.15rem 0.4rem;
		background: var(--color-gray-100);
		border-radius: 0.25rem;
		color: var(--color-gray-600);
	}

	.gewerk-tag.hauptgewerk {
		background: var(--color-brand-light);
		color: var(--color-brand-dark);
		font-weight: 500;
	}

	/* Projekt-Statistiken */
	.nu-projekte-stats {
		display: flex;
		gap: 1rem;
		padding: 0.75rem;
		background: var(--color-gray-50);
		border-radius: 0.5rem;
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: 1;
	}

	.stat-value {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--color-gray-800);
	}

	.stat-label {
		font-size: 0.7rem;
		color: var(--color-gray-500);
	}

	/* Mini Chart */
	.mini-chart {
		padding: 0.5rem;
		background: var(--color-gray-50);
		border-radius: 0.25rem;
	}

	.chart-bars {
		display: flex;
		align-items: flex-end;
		height: 40px;
		gap: 1px;
	}

	.chart-bar {
		flex: 1;
		min-height: 2px;
		background: var(--color-brand-medium);
		border-radius: 1px 1px 0 0;
		transition: background 0.2s;
	}

	.chart-bar:hover {
		background: var(--color-brand-dark);
	}

	.chart-label {
		font-size: 0.65rem;
		color: var(--color-gray-400);
		text-align: center;
		margin-top: 0.25rem;
	}

	/* Rating */
	.nu-rating {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--color-gray-100);
	}

	.rating-stars {
		color: var(--color-warning-dark);
		letter-spacing: 0.1em;
	}

	.rating-value {
		font-size: 0.8rem;
		color: var(--color-gray-500);
	}

	/* Nachweise Badges */
	.nu-nachweise {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--color-gray-100);
	}

	.nachweis-badge {
		font-size: 0.7rem;
		padding: 0.15rem 0.4rem;
		border-radius: 0.25rem;
		font-weight: 500;
		display: flex;
		align-items: center;
		gap: 0.2rem;
	}

	.nachweis-badge.gueltig {
		background: var(--color-success-light);
		color: var(--color-success-dark);
	}

	.nachweis-badge.fehlend {
		background: var(--color-gray-100);
		color: var(--color-gray-500);
	}

	.nachweis-badge.ungueltig {
		background: var(--color-error-light);
		color: var(--color-error-dark);
	}

	.nachweis-badge.bald_ungueltig {
		background: var(--color-warning-light);
		color: var(--color-warning-dark);
	}

	.badge-warning {
		font-weight: bold;
	}

	/* NU Actions */
	.nu-actions {
		display: flex;
		gap: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--color-gray-100);
	}

	.btn-action {
		flex: 1;
		padding: 0.4rem 0.75rem;
		font-size: 0.8rem;
		border-radius: 0.25rem;
		cursor: pointer;
		transition: all 0.15s;
		border: 1px solid var(--color-gray-200);
		background: var(--color-gray-50);
		color: var(--color-gray-700);
	}

	.btn-action:hover {
		background: var(--color-gray-100);
	}

	.btn-edit {
		background: var(--color-brand-light);
		color: var(--color-brand-dark);
		border-color: var(--color-brand-medium);
	}

	.btn-edit:hover {
		background: var(--color-brand-medium);
		color: white;
	}

	.btn-delete {
		background: var(--color-error-light);
		color: var(--color-error-dark);
		border-color: var(--color-error);
	}

	.btn-delete:hover {
		background: var(--color-error);
		color: white;
	}

	/* Nachweise Tabelle */
	.table-wrapper {
		overflow-x: auto;
	}

	.nachweise-table {
		width: 100%;
		border-collapse: collapse;
		min-width: 900px;
	}

	.nachweise-table th {
		text-align: left;
		padding: 0.75rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-gray-500);
		text-transform: uppercase;
		border-bottom: 1px solid var(--color-gray-200);
		background: var(--color-gray-50);
		white-space: nowrap;
	}

	.th-firma {
		min-width: 200px;
	}

	.th-status {
		min-width: 100px;
	}

	.th-nachweis {
		text-align: center;
		min-width: 60px;
	}

	.th-nachweis.pflicht {
		background: var(--color-warning-light);
	}

	.th-action {
		min-width: 100px;
	}

	.nachweise-table td {
		padding: 0.75rem 0.5rem;
		border-bottom: 1px solid var(--color-gray-100);
		vertical-align: middle;
	}

	.nachweise-table tbody tr:hover {
		background: var(--color-gray-50);
	}

	.nachweise-table tbody tr.warnung {
		background: var(--color-warning-light);
	}

	.nachweise-table tbody tr.warnung:hover {
		background: #fef0c3;
	}

	.firma-cell {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.firma-name {
		font-weight: 600;
		font-size: 0.875rem;
	}

	.firma-gewerk {
		font-size: 0.75rem;
		color: var(--color-gray-500);
	}

	.nachweis-cell {
		text-align: center;
	}

	.nachweis-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		font-size: 0.7rem;
		font-weight: 600;
		cursor: help;
	}

	.nachweis-icon.gueltig {
		background: var(--color-success-light);
		color: var(--color-success-dark);
	}

	.nachweis-icon.fehlend {
		background: var(--color-gray-100);
		color: var(--color-gray-400);
	}

	.nachweis-icon.ungueltig {
		background: var(--color-error-light);
		color: var(--color-error-dark);
	}

	.nachweis-icon.bald_ungueltig {
		background: var(--color-warning-light);
		color: var(--color-warning-dark);
	}

	.action-cell {
		display: flex;
		gap: 0.5rem;
	}

	.btn-icon {
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		background: var(--color-gray-100);
		border: 1px solid var(--color-gray-200);
		border-radius: 0.25rem;
		cursor: pointer;
	}

	.btn-icon:hover {
		background: var(--color-gray-200);
	}

	.btn-remind {
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		background: var(--color-brand-light);
		color: var(--color-brand-dark);
		border-radius: 0.25rem;
		text-decoration: none;
	}

	.btn-remind:hover {
		background: var(--color-brand-medium);
		color: white;
	}

	/* Legende */
	.legende {
		margin-top: 1.5rem;
		padding: 1rem;
		background: var(--color-gray-50);
		border-radius: 0.5rem;
	}

	.legende h4 {
		font-size: 0.875rem;
		margin: 0 0 0.75rem 0;
		color: var(--color-gray-600);
	}

	.legende h4:not(:first-child) {
		margin-top: 1rem;
	}

	.legende-items {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
	}

	.legende-items span {
		font-size: 0.8rem;
		color: var(--color-gray-600);
	}

	.legende-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.status-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
	}

	.status-dot.gueltig {
		background: var(--color-success-medium);
	}

	.status-dot.bald_ungueltig {
		background: var(--color-warning-medium);
	}

	.status-dot.ungueltig {
		background: var(--color-error-medium);
	}

	.status-dot.fehlend {
		background: var(--color-gray-300);
	}

	/* Modal */
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
		border-radius: 0.5rem;
		max-width: 900px;
		width: 100%;
		max-height: 80vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.modal-large {
		max-width: 900px;
		max-height: 90vh;
	}

	.modal-small {
		max-width: 500px;
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

	.modal-close {
		background: none;
		border: none;
		font-size: 1.25rem;
		cursor: pointer;
		color: var(--color-gray-500);
		padding: 0.25rem;
	}

	.modal-close:hover {
		color: var(--color-gray-800);
	}

	.modal-tabs {
		display: flex;
		border-bottom: 1px solid var(--color-gray-200);
		background: var(--color-gray-50);
	}

	.modal-tab {
		padding: 0.75rem 1.5rem;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		font-size: 0.9rem;
		color: var(--color-gray-500);
		transition: all 0.15s ease;
	}

	.modal-tab:hover {
		color: var(--color-gray-700);
	}

	.modal-tab.active {
		color: var(--color-brand-medium);
		border-bottom-color: var(--color-brand-medium);
		background: white;
	}

	.modal-body {
		padding: 1.5rem;
		overflow-y: auto;
		flex: 1;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding: 1rem 1.5rem;
		border-top: 1px solid var(--color-gray-200);
		background: var(--color-gray-50);
	}

	/* Form Styles */
	.form-error {
		padding: 0.75rem 1rem;
		background: var(--color-error-light);
		color: var(--color-error-dark);
		border-radius: 0.25rem;
		margin-bottom: 1rem;
	}

	.form-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.form-group.span-2 {
		grid-column: span 2;
	}

	.form-group.span-4 {
		grid-column: span 4;
	}

	.form-group label {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--color-gray-600);
	}

	.form-group input,
	.form-group select,
	.form-group textarea {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-gray-300);
		border-radius: 0.25rem;
		font-size: 0.9rem;
	}

	.form-group input:focus,
	.form-group select:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: var(--color-brand-medium);
	}

	.form-group input:disabled,
	.form-group select:disabled {
		background: var(--color-gray-100);
		cursor: not-allowed;
	}

	.form-section {
		margin-bottom: 1.5rem;
	}

	.form-section h3 {
		font-size: 1rem;
		margin: 0 0 1rem 0;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--color-gray-200);
	}

	/* Gewerke Grid */
	.gewerke-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 0.5rem;
	}

	.gewerk-checkbox {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-gray-200);
		border-radius: 0.25rem;
		cursor: pointer;
		font-size: 0.85rem;
		transition: all 0.15s;
	}

	.gewerk-checkbox:hover {
		background: var(--color-gray-50);
	}

	.gewerk-checkbox.selected {
		background: var(--color-brand-light);
		border-color: var(--color-brand-medium);
	}

	.gewerk-checkbox input {
		margin: 0;
	}

	/* Rating Input */
	.rating-input {
		display: flex;
		gap: 0.25rem;
	}

	.star-btn {
		background: none;
		border: none;
		font-size: 1.5rem;
		color: var(--color-gray-300);
		cursor: pointer;
		padding: 0;
		transition: color 0.15s;
	}

	.star-btn:hover,
	.star-btn.active {
		color: var(--color-warning-dark);
	}

	/* Nachweise Form */
	.nachweise-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.nachweis-row {
		padding: 1rem;
		border: 1px solid var(--color-gray-200);
		border-radius: 0.5rem;
		background: white;
	}

	.nachweis-row.pflicht {
		border-left: 3px solid var(--color-warning-medium);
	}

	.nachweis-row.warning {
		background: var(--color-warning-light);
	}

	.nachweis-row.expired {
		background: var(--color-error-light);
	}

	.nachweis-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.nachweis-label {
		font-weight: 600;
		font-size: 0.9rem;
	}

	.pflicht-marker {
		color: var(--color-error);
		margin-left: 0.25rem;
	}

	.nachweis-key {
		font-size: 0.8rem;
		color: var(--color-gray-500);
		background: var(--color-gray-100);
		padding: 0.15rem 0.5rem;
		border-radius: 0.25rem;
	}

	.nachweis-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: flex-end;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		cursor: pointer;
	}

	.date-input,
	.url-input {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.date-input label,
	.url-input label {
		font-size: 0.75rem;
		color: var(--color-gray-500);
	}

	.date-input input,
	.url-input input {
		padding: 0.4rem 0.5rem;
		border: 1px solid var(--color-gray-300);
		border-radius: 0.25rem;
		font-size: 0.85rem;
	}

	.url-input input {
		min-width: 200px;
	}

	.days-indicator {
		margin-top: 0.5rem;
		font-size: 0.8rem;
		color: var(--color-gray-600);
	}

	.days-indicator.warning {
		color: var(--color-warning-dark);
		font-weight: 500;
	}

	.days-indicator.expired {
		color: var(--color-error-dark);
		font-weight: 500;
	}

	/* Delete Modal */
	.delete-warning {
		font-size: 1rem;
		margin-bottom: 0.5rem;
	}

	.delete-info {
		font-size: 0.9rem;
		color: var(--color-gray-600);
	}

	/* Projekte Modal */
	.projekt-zeitraum {
		margin-bottom: 1rem;
		font-size: 0.9rem;
		color: var(--color-gray-600);
	}

	.projekt-summary {
		display: flex;
		gap: 2rem;
		margin-bottom: 1.5rem;
		padding: 1rem;
		background: var(--color-gray-50);
		border-radius: 0.5rem;
	}

	.summary-item {
		display: flex;
		flex-direction: column;
	}

	.summary-value {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-gray-800);
	}

	.summary-label {
		font-size: 0.8rem;
		color: var(--color-gray-500);
	}

	.projekte-table {
		width: 100%;
		border-collapse: collapse;
	}

	.projekte-table th {
		text-align: left;
		padding: 0.75rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-gray-500);
		text-transform: uppercase;
		border-bottom: 1px solid var(--color-gray-200);
	}

	.projekte-table td {
		padding: 0.75rem 0.5rem;
		border-bottom: 1px solid var(--color-gray-100);
		font-size: 0.875rem;
	}

	.projekt-name {
		max-width: 300px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (max-width: 768px) {
		.nu-grid {
			grid-template-columns: 1fr;
		}

		.filter-bar {
			flex-direction: column;
			align-items: stretch;
		}

		.filter-left {
			flex-direction: column;
			align-items: stretch;
		}

		.search-input {
			min-width: 100%;
		}

		.tabs {
			overflow-x: auto;
		}

		.tab {
			padding: 0.75rem 1rem;
			white-space: nowrap;
		}

		.modal-content {
			max-height: 90vh;
		}

		.form-grid {
			grid-template-columns: 1fr;
		}

		.form-group.span-2,
		.form-group.span-4 {
			grid-column: span 1;
		}

		.nachweis-controls {
			flex-direction: column;
			align-items: flex-start;
		}

		.page-header {
			flex-direction: column;
		}
	}
</style>
