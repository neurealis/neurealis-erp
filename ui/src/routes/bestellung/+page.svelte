<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { supabase, parseArtikelText } from '$lib/supabase';

	// Props vom Layout
	let { data } = $props();

	// === Typen ===
	interface Projekt {
		atbs_nummer: string;
		project_name: string;
		address: string | null;
		city: string | null;
	}

	interface Grosshaendler {
		id: string;
		name: string;
		kurzname: string;
		typ: string;
		typ_anzeige: string | null;
		bestell_email: string | null;
		logo_url: string | null;
		sortiment: string[] | null;
	}

	interface Artikel {
		id: string;
		artikelnummer: string;
		bezeichnung: string;
		kurzbezeichnung: string | null;
		hersteller: string | null;
		einheit: string;
		einkaufspreis: number;
		kategorie: string | null;
		unterkategorie: string | null;
		grosshaendler_id: string;
		bild_url: string | null;
		shop_url: string | null;
	}

	interface ErkannterArtikel {
		bezeichnung: string;
		menge: number;
		einheit: string;
		confidence: number;
		originalText: string;
		artikel_id?: string;
		artikelnummer?: string;
		einzelpreis?: number;
	}

	interface Ansprechpartner {
		id: string;
		vorname: string | null;
		nachname: string | null;
		telefon_mobil: string | null;
		email: string | null;
	}

	// === Wizard State ===
	let currentStep = $state(1);
	const totalSteps = 4;

	const stepTitles = [
		'Großhändler',
		'Artikel auswählen',
		'Lieferung',
		'Bestätigung'
	];

	// === Daten State ===
	let projekte = $state<Projekt[]>([]);
	let grosshaendler = $state<Grosshaendler[]>([]);
	let artikel = $state<Artikel[]>([]);
	let ansprechpartner = $state<Ansprechpartner[]>([]);
	let isLoading = $state(true);
	let isLoadingArtikel = $state(false);

	// === Formular State ===
	let bestelltyp = $state<'bestellung' | 'angebotsanfrage'>('bestellung');
	let selectedHaendler = $state('');
	let selectedProjekt = $state('');
	let selectedLieferort = $state('baustelle');
	let lieferdatum = $state('');
	let selectedZeitfenster = $state('');
	let selectedAnsprechpartner = $state('');
	let lieferhinweise = $state('');

	// === Artikel State ===
	let artikelText = $state('');
	let isProcessing = $state(false);
	let erkannteArtikel = $state<ErkannterArtikel[]>([]);
	let unerkannteTexte = $state<string[]>([]);
	let errorMessage = $state('');
	let activeTab = $state<'ki' | 'katalog'>('ki');

	// Bestellpositionen mit Mengen
	let bestellpositionen = $state<Map<string, number>>(new Map());

	// Freitextpositionen (ohne Katalog-Artikel)
	interface FreitextPosition {
		id: string;
		bezeichnung: string;
		menge: number;
		einheit: string;
	}
	let freitextPositionen = $state<FreitextPosition[]>([]);

	// Expanded Artikel (für Langname-Anzeige)
	let expandedArtikel = $state<Set<string>>(new Set());

	// Filter-State
	let selectedKategorie = $state<string | null>(null);
	let selectedUnterkategorie = $state<string | null>(null);
	let selectedHersteller = $state<string | null>(null);
	let suchbegriff = $state('');

	// Favoriten
	let favoriten = $state<Set<string>>(new Set());
	let favoritenLoading = $state(false);

	// Benutzer
	let currentUser = $state<string | null>(null);

	// Submit State
	let isSubmitting = $state(false);
	let submitSuccess = $state(false);
	let bestellnummer = $state('');

	// Warenkorb-Drawer
	let warenkorbOpen = $state(false);

	// URL-Parameter
	let initialAtbs = $state('');

	// === Lifecycle ===
	onMount(async () => {
		// User-Email aus Layout-Daten (Microsoft 365 Login)
		currentUser = data.user?.email || 'anonymous';

		// URL-Parameter auslesen
		const url = new URL(window.location.href);
		initialAtbs = url.searchParams.get('atbs') || '';

		await loadFavoriten();
		await loadData();

		// Lieferdatum auf morgen setzen
		const morgen = new Date();
		morgen.setDate(morgen.getDate() + 1);
		// Wenn nach 14 Uhr, dann übermorgen
		if (new Date().getHours() >= 14) {
			morgen.setDate(morgen.getDate() + 1);
		}
		lieferdatum = morgen.toISOString().split('T')[0];
	});

	// === Daten laden ===
	async function loadData() {
		isLoading = true;

		try {
			// Projekte aus monday_bauprozess laden - nur Phasen 2, 3, 4
			const { data: projekteData } = await supabase
				.from('monday_bauprozess')
				.select('id, name, group_title, column_values')
				.or('group_title.ilike.(2%,group_title.ilike.(3%,group_title.ilike.(4%')
				.order('name', { ascending: true });

			if (projekteData) {
				projekte = projekteData
					.map(p => {
						const cv = p.column_values || {};
						return {
							atbs_nummer: cv.text49__1?.text || p.id,
							project_name: p.name,
							address: cv.text51__1?.text || null,
							city: null
						};
					})
					.filter(p => p.atbs_nummer && p.atbs_nummer.startsWith('ATBS'));

				if (projekte.length > 0) {
					// URL-Parameter oder erstes Projekt
					if (initialAtbs) {
						const found = projekte.find(p => p.atbs_nummer === initialAtbs);
						selectedProjekt = found ? found.atbs_nummer : projekte[0].atbs_nummer;
					} else {
						selectedProjekt = projekte[0].atbs_nummer;
					}
				}
			}

			// Großhändler laden (mit Logo aus verknüpftem Kontakt)
			const { data: ghData } = await supabase
				.from('grosshaendler')
				.select('id, name, kurzname, typ, typ_anzeige, bestell_email, sortiment, kontakt:kontakte(foto_url)')
				.eq('ist_aktiv', true)
				.order('name', { ascending: true });

			if (ghData && ghData.length > 0) {
				grosshaendler = ghData.map(h => ({
					...h,
					logo_url: h.kontakt?.foto_url || null,
					sortiment: h.sortiment || null,
					kontakt: undefined
				}));
			}

			// Ansprechpartner (Mitarbeiter) laden
			const { data: mitarbeiterData } = await supabase
				.from('kontakte')
				.select('id, vorname, nachname, telefon_mobil, email, kontaktarten')
				.eq('aktiv', true)
				.contains('kontaktarten', ['mitarbeiter']);

			if (mitarbeiterData && mitarbeiterData.length > 0) {
				// Sortieren: Handwerker > Bauleiter > Rest
				const sortiert = [...mitarbeiterData].sort((a, b) => {
					const getPrio = (k: typeof a) => {
						const arten = k.kontaktarten || [];
						if (arten.includes('handwerker')) return 1;
						if (arten.includes('bauleiter')) return 2;
						return 3;
					};
					const prioA = getPrio(a);
					const prioB = getPrio(b);
					if (prioA !== prioB) return prioA - prioB;
					return (a.nachname || '').localeCompare(b.nachname || '');
				});

				ansprechpartner = sortiert;
				const currentUserMatch = sortiert.find(m => m.email === currentUser);
				if (currentUserMatch) {
					selectedAnsprechpartner = currentUserMatch.id;
				} else {
					selectedAnsprechpartner = sortiert[0].id;
				}
			}
		} catch (err) {
			console.error('Fehler beim Laden:', err);
			errorMessage = 'Fehler beim Laden der Daten. Bitte Seite neu laden.';
		} finally {
			isLoading = false;
		}
	}

	async function loadArtikelFuerHaendler(haendlerId: string) {
		isLoadingArtikel = true;
		artikel = [];
		selectedKategorie = null;
		selectedUnterkategorie = null;
		selectedHersteller = null;
		suchbegriff = '';

		try {
			const { data: artikelData, error } = await supabase
				.from('bestellartikel')
				.select('id, artikelnummer, bezeichnung, kurzbezeichnung, hersteller, einheit, einkaufspreis, kategorie, unterkategorie, grosshaendler_id, bild_url, shop_url')
				.eq('grosshaendler_id', haendlerId)
				.eq('ist_aktiv', true)
				.order('bezeichnung', { ascending: true });

			if (!error && artikelData) {
				artikel = artikelData;
			}
		} catch (err) {
			console.error('Fehler beim Laden der Artikel:', err);
		} finally {
			isLoadingArtikel = false;
		}
	}

	// === Favoriten ===
	async function loadFavoriten() {
		if (!currentUser) return;
		favoritenLoading = true;
		try {
			const { data, error } = await supabase
				.from('bestellartikel_favoriten')
				.select('artikel_id')
				.eq('benutzer_id', currentUser);

			if (data && !error) {
				favoriten = new Set(data.map(f => f.artikel_id));
			} else {
				const stored = localStorage.getItem('bestellartikel_favoriten');
				if (stored) favoriten = new Set(JSON.parse(stored));
			}
		} catch {
			const stored = localStorage.getItem('bestellartikel_favoriten');
			if (stored) favoriten = new Set(JSON.parse(stored));
		} finally {
			favoritenLoading = false;
		}
	}

	async function toggleFavorit(artikelId: string) {
		const istFavorit = favoriten.has(artikelId);

		if (istFavorit) {
			favoriten.delete(artikelId);
		} else {
			favoriten.add(artikelId);
		}
		favoriten = new Set(favoriten);

		try {
			if (currentUser && currentUser !== 'anonymous') {
				if (istFavorit) {
					await supabase.from('bestellartikel_favoriten').delete()
						.eq('benutzer_id', currentUser).eq('artikel_id', artikelId);
				} else {
					await supabase.from('bestellartikel_favoriten')
						.insert({ benutzer_id: currentUser, artikel_id: artikelId });
				}
			}
			localStorage.setItem('bestellartikel_favoriten', JSON.stringify([...favoriten]));
		} catch {
			if (istFavorit) favoriten.add(artikelId);
			else favoriten.delete(artikelId);
			favoriten = new Set(favoriten);
		}
	}

	// === Berechnungen ===
	let gesamtsumme = $derived.by(() => {
		let summe = 0;
		for (const [artikelId, menge] of bestellpositionen) {
			const art = artikel.find(a => a.id === artikelId);
			if (art && menge > 0) {
				summe += (art.einkaufspreis || 0) * menge;
			}
		}
		return summe;
	});

	let warenkorbAnzahl = $derived.by(() => {
		let anzahl = 0;
		for (const menge of bestellpositionen.values()) {
			if (menge > 0) anzahl++;
		}
		// Freitextpositionen zählen
		anzahl += freitextPositionen.filter(f => f.menge > 0 && f.bezeichnung.trim()).length;
		return anzahl;
	});

	let warenkorbArtikel = $derived.by(() => {
		const items: Array<Artikel & { menge: number; summe: number }> = [];
		for (const [artikelId, menge] of bestellpositionen) {
			if (menge > 0) {
				const art = artikel.find(a => a.id === artikelId);
				if (art) {
					items.push({ ...art, menge, summe: (art.einkaufspreis || 0) * menge });
				}
			}
		}
		return items.sort((a, b) => (a.kurzbezeichnung || a.bezeichnung).localeCompare(b.kurzbezeichnung || b.bezeichnung));
	});

	let selectedProjektDetails = $derived.by(() => projekte.find(p => p.atbs_nummer === selectedProjekt));
	let selectedHaendlerDetails = $derived.by(() => grosshaendler.find(h => h.id === selectedHaendler));
	let selectedAnsprechpartnerDetails = $derived.by(() => ansprechpartner.find(a => a.id === selectedAnsprechpartner));

	// Filter
	let verfuegbareKategorien = $derived.by(() => {
		const kategorien = new Set<string>();
		for (const art of artikel) {
			if (art.kategorie) kategorien.add(art.kategorie);
		}
		return [...kategorien].sort();
	});

	let verfuegbareUnterkategorien = $derived.by(() => {
		const unterkategorien = new Set<string>();
		for (const art of artikel) {
			if (art.unterkategorie && (!selectedKategorie || art.kategorie === selectedKategorie)) {
				unterkategorien.add(art.unterkategorie);
			}
		}
		return [...unterkategorien].sort();
	});

	let verfuegbareHersteller = $derived.by(() => {
		const hersteller = new Set<string>();
		for (const art of artikel) {
			if (art.hersteller) {
				let passt = true;
				if (selectedKategorie && art.kategorie !== selectedKategorie) passt = false;
				if (selectedUnterkategorie && art.unterkategorie !== selectedUnterkategorie) passt = false;
				if (passt) hersteller.add(art.hersteller);
			}
		}
		return [...hersteller].sort();
	});

	let gefilterteArtikel = $derived.by(() => {
		let filtered = artikel;

		if (suchbegriff.trim()) {
			const such = suchbegriff.toLowerCase().trim();
			filtered = filtered.filter(a =>
				(a.bezeichnung?.toLowerCase().includes(such)) ||
				(a.kurzbezeichnung?.toLowerCase().includes(such)) ||
				(a.artikelnummer?.toLowerCase().includes(such)) ||
				(a.hersteller?.toLowerCase().includes(such))
			);
		}

		if (selectedKategorie) filtered = filtered.filter(a => a.kategorie === selectedKategorie);
		if (selectedUnterkategorie) filtered = filtered.filter(a => a.unterkategorie === selectedUnterkategorie);
		if (selectedHersteller) filtered = filtered.filter(a => a.hersteller === selectedHersteller);

		return [...filtered].sort((a, b) => {
			const aFav = favoriten.has(a.id);
			const bFav = favoriten.has(b.id);
			if (aFav && !bFav) return -1;
			if (!aFav && bFav) return 1;
			return (a.kurzbezeichnung || a.bezeichnung).localeCompare(b.kurzbezeichnung || b.bezeichnung);
		});
	});

	// === Funktionen ===
	function formatAnsprechpartnerName(ap: Ansprechpartner): string {
		return [ap.vorname, ap.nachname].filter(Boolean).join(' ') || 'Unbekannt';
	}

	function formatPreis(betrag: number): string {
		return betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
	}

	function formatLieferort(ort: string): string {
		const orte: Record<string, string> = {
			'baustelle': 'Baustelle',
			'lager': 'Lager (Kleyerweg 40, Dortmund)',
			'abholung': 'Abholung'
		};
		return orte[ort] || ort;
	}

	function formatZeitfenster(zf: string): string {
		const fenster: Record<string, string> = {
			'vormittag': 'Vormittag (7-12 Uhr)',
			'nachmittag': 'Nachmittag (12-17 Uhr)',
			'ganztags': 'Ganztags'
		};
		return fenster[zf] || 'Egal';
	}

	// Fuzzy-Matching: Findet besten Artikel für eine Bezeichnung
	function findBestMatch(suchText: string): Artikel | null {
		const such = suchText.toLowerCase().trim();
		let bestMatch: Artikel | null = null;
		let bestScore = 0;

		for (const art of artikel) {
			const bez = (art.kurzbezeichnung || art.bezeichnung).toLowerCase();
			const vollBez = art.bezeichnung.toLowerCase();

			// Exakte Übereinstimmung
			if (bez === such || vollBez === such) {
				return art;
			}

			// Enthält den Suchtext
			if (bez.includes(such) || vollBez.includes(such)) {
				const score = such.length / bez.length;
				if (score > bestScore) {
					bestScore = score;
					bestMatch = art;
				}
			}

			// Suchtext enthält die Bezeichnung
			if (such.includes(bez)) {
				const score = bez.length / such.length * 0.8;
				if (score > bestScore) {
					bestScore = score;
					bestMatch = art;
				}
			}

			// Wort-für-Wort Matching
			const suchWorte = such.split(/\s+/);
			const bezWorte = bez.split(/\s+/);
			let matches = 0;
			for (const sw of suchWorte) {
				if (sw.length < 3) continue;
				for (const bw of bezWorte) {
					if (bw.includes(sw) || sw.includes(bw)) {
						matches++;
						break;
					}
				}
			}
			if (matches > 0) {
				const score = matches / Math.max(suchWorte.length, bezWorte.length) * 0.5;
				if (score > bestScore) {
					bestScore = score;
					bestMatch = art;
				}
			}
		}

		return bestScore > 0.3 ? bestMatch : null;
	}

	async function verarbeiteText() {
		if (!artikelText.trim()) return;

		isProcessing = true;
		errorMessage = '';
		erkannteArtikel = [];
		unerkannteTexte = [];

		try {
			const result = await parseArtikelText(artikelText, selectedHaendler);

			if (result.success) {
				erkannteArtikel = result.items;
				unerkannteTexte = result.unerkannt;
				let gefunden = 0;
				let nichtGefunden: string[] = [];

				for (const item of result.items) {
					let artikelId: string | undefined;

					// 1. Direkte ID vom Backend
					if (item.artikel_id) {
						artikelId = item.artikel_id;
					}

					// 2. Fuzzy-Matching lokal
					if (!artikelId) {
						const match = findBestMatch(item.bezeichnung);
						if (match) {
							artikelId = match.id;
							console.log(`Fuzzy-Match: "${item.bezeichnung}" → "${match.kurzbezeichnung || match.bezeichnung}"`);
						}
					}

					if (artikelId) {
						const bisherigeMenge = bestellpositionen.get(artikelId) || 0;
						bestellpositionen.set(artikelId, bisherigeMenge + item.menge);
						gefunden++;
					} else {
						nichtGefunden.push(`${item.menge}x ${item.bezeichnung}`);
					}
				}

				bestellpositionen = new Map(bestellpositionen);

				if (nichtGefunden.length > 0) {
					unerkannteTexte = [...unerkannteTexte, ...nichtGefunden];
				}

				if (gefunden > 0) {
					artikelText = '';
					// Automatisch zum Katalog wechseln um Ergebnis zu sehen
					activeTab = 'katalog';
				}
			} else {
				errorMessage = result.error || 'Verarbeitung fehlgeschlagen';
			}
		} catch (err) {
			console.error('KI-Verarbeitung fehlgeschlagen:', err);
			errorMessage = 'Netzwerkfehler - bitte erneut versuchen';
		} finally {
			isProcessing = false;
		}
	}

	function setzeMenge(artikelId: string, menge: number) {
		if (menge >= 0) {
			if (menge === 0) {
				bestellpositionen.delete(artikelId);
			} else {
				bestellpositionen.set(artikelId, menge);
			}
			bestellpositionen = new Map(bestellpositionen);
		}
	}

	function setzeMengeDirekt(artikelId: string, event: Event) {
		const input = event.target as HTMLInputElement;
		const menge = parseInt(input.value) || 0;
		setzeMenge(artikelId, Math.max(0, menge));
	}

	function clearAllFilters() {
		selectedKategorie = null;
		selectedUnterkategorie = null;
		selectedHersteller = null;
		suchbegriff = '';
	}

	function toggleBezeichnung(artikelId: string) {
		if (expandedArtikel.has(artikelId)) {
			expandedArtikel.delete(artikelId);
		} else {
			expandedArtikel.add(artikelId);
		}
		expandedArtikel = new Set(expandedArtikel);
	}

	function warenkorbLeeren() {
		if (bestellpositionen.size === 0 && freitextPositionen.length === 0) return;
		if (confirm('Warenkorb wirklich leeren?')) {
			bestellpositionen = new Map();
			freitextPositionen = [];
		}
	}

	// Freitext-Positionen
	function addFreitextPosition() {
		freitextPositionen = [...freitextPositionen, {
			id: crypto.randomUUID(),
			bezeichnung: '',
			menge: 1,
			einheit: 'Stk'
		}];
	}

	function removeFreitextPosition(id: string) {
		freitextPositionen = freitextPositionen.filter(f => f.id !== id);
	}

	function updateFreitextPosition(id: string, field: keyof FreitextPosition, value: string | number) {
		freitextPositionen = freitextPositionen.map(f =>
			f.id === id ? { ...f, [field]: value } : f
		);
	}

	// === Wizard Navigation ===
	function canProceed(step: number): boolean {
		switch (step) {
			case 1: return !!selectedHaendler;
			case 2: return warenkorbAnzahl > 0;
			case 3: return !!selectedProjekt && !!selectedAnsprechpartner;
			case 4: return true;
			default: return false;
		}
	}

	async function nextStep() {
		if (currentStep === 1 && selectedHaendler && artikel.length === 0) {
			await loadArtikelFuerHaendler(selectedHaendler);
		}
		if (canProceed(currentStep) && currentStep < totalSteps) {
			currentStep++;
		}
	}

	function prevStep() {
		if (currentStep > 1) {
			currentStep--;
		}
	}

	function goToStep(step: number) {
		// Nur zu bereits besuchten Steps oder vorherigen navigieren
		if (step < currentStep || (step <= currentStep + 1 && canProceed(step - 1))) {
			if (step === 2 && selectedHaendler && artikel.length === 0) {
				loadArtikelFuerHaendler(selectedHaendler);
			}
			currentStep = step;
		}
	}

	// === Bestellung absenden ===
	async function submitBestellung() {
		if (isSubmitting || warenkorbAnzahl === 0) return;

		isSubmitting = true;
		errorMessage = '';

		try {
			// 1. Bestellung in DB speichern
			const { data: bestellung, error: bestellError } = await supabase
				.from('bestellungen')
				.insert({
					grosshaendler_id: selectedHaendler,
					atbs_nummer: selectedProjekt,
					projekt_name: selectedProjektDetails?.project_name || '',
					bestellt_von_email: currentUser,
					bestellt_von_name: currentUser?.split('@')[0] || 'Unbekannt',
					status: 'entwurf',
					bestelltyp: bestelltyp,
					summe_netto: gesamtsumme,
					lieferadresse: selectedLieferort === 'baustelle' ? selectedProjektDetails?.address :
						selectedLieferort === 'lager' ? 'Kleyerweg 40, 44149 Dortmund' : 'Abholung',
					lieferort: selectedLieferort,
					gewuenschtes_lieferdatum: lieferdatum || null,
					zeitfenster: selectedZeitfenster || null,
					ansprechpartner_id: selectedAnsprechpartner || null,
					ansprechpartner_name: selectedAnsprechpartnerDetails ? formatAnsprechpartnerName(selectedAnsprechpartnerDetails) : null,
					ansprechpartner_telefon: selectedAnsprechpartnerDetails?.telefon_mobil || null,
					notizen: lieferhinweise || null,
					anzahl_positionen: warenkorbAnzahl
				})
				.select()
				.single();

			if (bestellError) throw bestellError;

			// 2. Katalog-Positionen speichern
			const katalogPositionen = warenkorbArtikel.map((art, idx) => ({
				bestellung_id: bestellung.id,
				position_nr: idx + 1,
				artikel_id: art.id,
				artikelnummer: art.artikelnummer,
				bezeichnung: art.kurzbezeichnung || art.bezeichnung,
				hersteller: art.hersteller,
				menge: art.menge,
				einheit: art.einheit || 'Stk',
				einzelpreis: art.einkaufspreis || 0,
				gesamtpreis: art.summe,
				ist_freitext: false
			}));

			// 3. Freitext-Positionen hinzufügen
			const gueltigeFreitext = freitextPositionen.filter(f => f.bezeichnung.trim() && f.menge > 0);
			const freitextPositionenDb = gueltigeFreitext.map((f, idx) => ({
				bestellung_id: bestellung.id,
				position_nr: katalogPositionen.length + idx + 1,
				artikel_id: null,
				artikelnummer: null,
				bezeichnung: f.bezeichnung.trim(),
				hersteller: null,
				menge: f.menge,
				einheit: f.einheit,
				einzelpreis: 0,
				gesamtpreis: 0,
				ist_freitext: true,
				freitext_beschreibung: f.bezeichnung.trim()
			}));

			const allePositionen = [...katalogPositionen, ...freitextPositionenDb];

			const { error: posError } = await supabase
				.from('bestellpositionen')
				.insert(allePositionen);

			if (posError) throw posError;

			// 3. Edge Function aufrufen für HTML/PDF/E-Mail
			const { data: submitResult, error: submitError } = await supabase.functions.invoke('bestellung-submit', {
				body: { bestellung_id: bestellung.id }
			});

			if (submitError) {
				console.warn('E-Mail-Versand fehlgeschlagen:', submitError);
				// Trotzdem als Erfolg werten, da Bestellung gespeichert ist
			}

			// Erfolg
			bestellnummer = bestellung.bestell_nr?.toString() || bestellung.id;
			submitSuccess = true;

			// Status auf "gesendet" setzen
			await supabase
				.from('bestellungen')
				.update({ status: 'gesendet', bestellt_am: new Date().toISOString() })
				.eq('id', bestellung.id);

		} catch (err) {
			console.error('Bestellung fehlgeschlagen:', err);
			errorMessage = 'Bestellung konnte nicht gespeichert werden. Bitte erneut versuchen.';
		} finally {
			isSubmitting = false;
		}
	}

	function neueBestellung() {
		// Reset
		currentStep = 1;
		bestelltyp = 'bestellung';
		selectedHaendler = '';
		bestellpositionen = new Map();
		freitextPositionen = [];
		erkannteArtikel = [];
		unerkannteTexte = [];
		artikelText = '';
		lieferhinweise = '';
		lieferdatum = '';
		selectedZeitfenster = '';
		submitSuccess = false;
		bestellnummer = '';
		errorMessage = '';
	}
</script>

<div class="page">
	<!-- Header -->
	<header class="header">
		<div class="header-content">
			<a href="/" class="back-link" aria-label="Zurück zur Startseite">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M19 12H5M12 19l-7-7 7-7"/>
				</svg>
			</a>
			<h1>{bestelltyp === 'angebotsanfrage' ? 'Neue Angebotsanfrage' : 'Neue Bestellung'}</h1>
			<!-- Warenkorb Toggle -->
			<button
				class="warenkorb-toggle"
				class:has-items={warenkorbAnzahl > 0}
				onclick={() => warenkorbOpen = !warenkorbOpen}
				aria-label="Warenkorb ({warenkorbAnzahl} Artikel)"
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="9" cy="21" r="1"/>
					<circle cx="20" cy="21" r="1"/>
					<path d="m1 1 4 4h16l-2 9H7L5 5"/>
				</svg>
				{#if warenkorbAnzahl > 0}
					<span class="cart-badge">{warenkorbAnzahl}</span>
				{/if}
			</button>
			{#if warenkorbAnzahl > 0 && currentStep < 4}
				<div class="header-badge">
					<span class="badge-sum">{formatPreis(gesamtsumme)}</span>
				</div>
			{/if}
		</div>
	</header>

	<!-- Warenkorb Drawer -->
	{#if warenkorbOpen}
		<div class="drawer-backdrop" onclick={() => warenkorbOpen = false}></div>
		<aside class="warenkorb-drawer">
			<div class="drawer-header">
				<h2>Warenkorb</h2>
				<button class="drawer-close" onclick={() => warenkorbOpen = false} aria-label="Schließen">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 6 6 18M6 6l12 12"/>
					</svg>
				</button>
			</div>

			{#if warenkorbArtikel.length === 0}
				<div class="drawer-empty">
					<p>Dein Warenkorb ist leer.</p>
				</div>
			{:else}
				<ul class="drawer-items">
					{#each warenkorbArtikel as item}
						<li class="drawer-item">
							<div class="drawer-item-info">
								<strong>{item.kurzbezeichnung || item.bezeichnung}</strong>
								{#if item.hersteller}<small>{item.hersteller}</small>{/if}
							</div>
							<div class="drawer-item-controls">
								<div class="mini-menge">
									<button onclick={() => setzeMenge(item.id, item.menge - 1)}>−</button>
									<span>{item.menge}</span>
									<button onclick={() => setzeMenge(item.id, item.menge + 1)}>+</button>
								</div>
								<span class="drawer-item-summe">{formatPreis(item.summe)}</span>
							</div>
						</li>
					{/each}
				</ul>

				<div class="drawer-footer">
					<button class="btn btn-secondary btn-sm" onclick={warenkorbLeeren}>Leeren</button>
					<div class="drawer-total">
						<span>Gesamt</span>
						<strong>{formatPreis(gesamtsumme)}</strong>
					</div>
				</div>
			{/if}
		</aside>
	{/if}

	<!-- Progress Steps -->
	{#if !submitSuccess}
		<nav class="progress-bar" aria-label="Fortschritt">
			{#each stepTitles as title, i}
				{@const stepNum = i + 1}
				{@const isActive = currentStep === stepNum}
				{@const isComplete = currentStep > stepNum}
				{@const isClickable = stepNum < currentStep || (stepNum === currentStep + 1 && canProceed(currentStep))}
				<button
					class="progress-step"
					class:active={isActive}
					class:complete={isComplete}
					class:clickable={isClickable}
					onclick={() => goToStep(stepNum)}
					disabled={!isClickable && !isActive}
					aria-current={isActive ? 'step' : undefined}
				>
					<span class="step-number">
						{#if isComplete}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
								<path d="M5 13l4 4L19 7"/>
							</svg>
						{:else}
							{stepNum}
						{/if}
					</span>
					<span class="step-title">{title}</span>
				</button>
				{#if i < totalSteps - 1}
					<div class="progress-line" class:complete={currentStep > stepNum}></div>
				{/if}
			{/each}
		</nav>
	{/if}

	<main class="main">
		{#if isLoading}
			<div class="loading">
				<div class="spinner-large"></div>
				<p>Lade Daten...</p>
			</div>

		{:else if submitSuccess}
			<!-- Erfolgs-Ansicht -->
			<div class="success-view">
				<div class="success-icon">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10"/>
						<path d="M9 12l2 2 4-4"/>
					</svg>
				</div>
				<h2>{bestelltyp === 'angebotsanfrage' ? 'Angebotsanfrage' : 'Bestellung'} erfolgreich!</h2>
				<p class="success-nr">{bestelltyp === 'angebotsanfrage' ? 'Anfrage-Nr.' : 'Bestellnummer'}: <strong>B-{bestellnummer}</strong></p>
				<p>Die {bestelltyp === 'angebotsanfrage' ? 'Anfrage' : 'Bestellung'} wurde gespeichert und eine E-Mail gesendet (CC: bauleitung@neurealis.de).</p>
				<div class="success-actions">
					<button class="btn btn-secondary" onclick={neueBestellung}>
						Neue Bestellung
					</button>
					<a href="/bestellungen" class="btn btn-primary">
						Zur Übersicht
					</a>
				</div>
			</div>

		{:else}
			<!-- Step 1: Großhändler -->
			{#if currentStep === 1}
				<div class="step-content">
					<!-- Bestelltyp Toggle -->
					<div class="bestelltyp-toggle">
						<button
							class="bestelltyp-btn"
							class:active={bestelltyp === 'bestellung'}
							onclick={() => bestelltyp = 'bestellung'}
						>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<rect x="3" y="3" width="18" height="18" rx="2"/>
								<path d="M9 12l2 2 4-4"/>
							</svg>
							Bestellung
						</button>
						<button
							class="bestelltyp-btn"
							class:active={bestelltyp === 'angebotsanfrage'}
							onclick={() => bestelltyp = 'angebotsanfrage'}
						>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<circle cx="12" cy="12" r="10"/>
								<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>
							</svg>
							Angebotsanfrage
						</button>
					</div>

					<h2 class="step-heading">Bei welchem Großhändler möchtest du {bestelltyp === 'angebotsanfrage' ? 'anfragen' : 'bestellen'}?</h2>

					<div class="haendler-grid">
						{#each grosshaendler as haendler}
							<button
								class="haendler-card"
								class:selected={selectedHaendler === haendler.id}
								onclick={async () => {
									selectedHaendler = haendler.id;
									// Auto-Weiter zu Schritt 2
									await loadArtikelFuerHaendler(haendler.id);
									currentStep = 2;
								}}
							>
								<div class="haendler-name">{haendler.kurzname || haendler.name}</div>
								{#if haendler.sortiment && haendler.sortiment.length > 0}
									<div class="haendler-sortiment">{haendler.sortiment.join(', ')}</div>
								{/if}
								{#if selectedHaendler === haendler.id}
									<div class="haendler-check">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
											<path d="M5 13l4 4L19 7"/>
										</svg>
									</div>
								{/if}
							</button>
						{/each}
					</div>
				</div>

			<!-- Step 2: Artikel -->
			{:else if currentStep === 2}
				<div class="step-content step-artikel">
					<!-- Tabs -->
					<div class="tabs">
						<button
							class="tab"
							class:active={activeTab === 'ki'}
							onclick={() => activeTab = 'ki'}
						>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
								<path d="M20 3v4M22 5h-4M4 17v2M5 18H3"/>
							</svg>
							KI-Eingabe
						</button>
						<button
							class="tab"
							class:active={activeTab === 'katalog'}
							onclick={() => activeTab = 'katalog'}
						>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M3 6h18M3 12h18M3 18h18"/>
							</svg>
							Katalog ({artikel.length})
						</button>
					</div>

					<!-- Tab Content: KI -->
					{#if activeTab === 'ki'}
						<div class="ki-input">
							<p class="ki-hint">
								Gib deine Bestellung ein - in Deutsch, Ungarisch, Russisch oder Rumänisch.
								Die KI erkennt Artikel und Mengen automatisch.
							</p>
							<textarea
								bind:value={artikelText}
								placeholder="z.B. 10 Dreifachrahmen, 30 Steckdosen, 5 Wechselschalter..."
								rows="5"
							></textarea>
							<button
								class="btn btn-primary"
								onclick={verarbeiteText}
								disabled={isProcessing || !artikelText.trim()}
							>
								{#if isProcessing}
									<span class="spinner"></span>
									Verarbeite...
								{:else}
									KI-Erkennung starten
								{/if}
							</button>

							{#if errorMessage}
								<div class="message error">{errorMessage}</div>
							{/if}

							{#if erkannteArtikel.length > 0}
								{@const imWarenkorb = erkannteArtikel.filter(a => bestellpositionen.has(a.artikel_id || ''))}
								{@const nichtImKatalog = erkannteArtikel.filter(a => !bestellpositionen.has(a.artikel_id || '') && !a.artikel_id)}

								{#if imWarenkorb.length > 0}
									<div class="message success">
										<strong>✓ In Warenkorb:</strong> {imWarenkorb.map(a => `${a.menge}x ${a.bezeichnung}`).join(', ')}
									</div>
								{/if}

								{#if nichtImKatalog.length > 0}
									<div class="message warning">
										<strong>⚠ Nicht im Katalog:</strong> {nichtImKatalog.map(a => `${a.menge}x ${a.bezeichnung}`).join(', ')}
										<div style="font-size: 0.85em; margin-top: 4px; opacity: 0.8;">
											KI hat verstanden, aber kein passender Artikel gefunden. Bitte manuell im Katalog suchen.
										</div>
									</div>
								{/if}
							{/if}

							{#if unerkannteTexte.length > 0 && erkannteArtikel.length === 0}
								<div class="message error">
									<strong>✗ Nicht verstanden:</strong> {unerkannteTexte.join(', ')}
								</div>
							{/if}
						</div>

					<!-- Tab Content: Katalog -->
					{:else}
						<div class="katalog">
							{#if isLoadingArtikel}
								<div class="loading-inline">
									<span class="spinner"></span>
									Lade Artikel...
								</div>
							{:else if artikel.length === 0}
								<div class="empty-state">
									<p>Keine Artikel für {selectedHaendlerDetails?.kurzname || 'diesen Händler'} verfügbar.</p>
								</div>
							{:else}
								<!-- Suchfeld -->
								<div class="search-box">
									<svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<circle cx="11" cy="11" r="8"></circle>
										<path d="m21 21-4.35-4.35"></path>
									</svg>
									<input
										type="search"
										placeholder="Artikel suchen..."
										bind:value={suchbegriff}
									/>
									{#if suchbegriff}
										<button class="search-clear" onclick={() => suchbegriff = ''}>
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<path d="M18 6 6 18M6 6l12 12"></path>
											</svg>
										</button>
									{/if}
								</div>

								<!-- Filter -->
								<div class="filter-row">
									<select bind:value={selectedKategorie} onchange={() => { selectedUnterkategorie = null; selectedHersteller = null; }}>
										<option value={null}>Alle Gewerke</option>
										{#each verfuegbareKategorien as kat}
											<option value={kat}>{kat}</option>
										{/each}
									</select>
									<select bind:value={selectedUnterkategorie} onchange={() => { selectedHersteller = null; }} disabled={verfuegbareUnterkategorien.length === 0}>
										<option value={null}>Alle Typen</option>
										{#each verfuegbareUnterkategorien as unterkat}
											<option value={unterkat}>{unterkat}</option>
										{/each}
									</select>
									<select bind:value={selectedHersteller} disabled={verfuegbareHersteller.length === 0}>
										<option value={null}>Alle Hersteller</option>
										{#each verfuegbareHersteller as hersteller}
											<option value={hersteller}>{hersteller}</option>
										{/each}
									</select>
									{#if selectedKategorie || selectedUnterkategorie || selectedHersteller}
										<button class="btn-link" onclick={clearAllFilters}>Zurücksetzen</button>
									{/if}
								</div>

								<div class="artikel-count">{gefilterteArtikel.length} Artikel</div>

								<!-- Artikel-Liste -->
								<div class="artikel-list">
									{#each gefilterteArtikel as art}
										{@const menge = bestellpositionen.get(art.id) || 0}
										{@const istFavorit = favoriten.has(art.id)}
										<div class="artikel-row" class:selected={menge > 0} class:favorit={istFavorit}>
											<button
												class="fav-btn"
												class:active={istFavorit}
												onclick={() => toggleFavorit(art.id)}
												aria-label={istFavorit ? 'Favorit entfernen' : 'Als Favorit markieren'}
											>
												{istFavorit ? '★' : '☆'}
											</button>
											{#if art.bild_url}
												<a href={art.bild_url} target="_blank" class="artikel-thumb" title="Bild öffnen">
													<img src={art.bild_url} alt={art.kurzbezeichnung || art.bezeichnung} loading="lazy" />
												</a>
											{/if}
											<div class="artikel-info">
												<button class="artikel-name" onclick={() => toggleBezeichnung(art.id)}>
													{art.kurzbezeichnung || art.bezeichnung}
												</button>
												{#if expandedArtikel.has(art.id) && art.kurzbezeichnung !== art.bezeichnung}
													<div class="artikel-full">{art.bezeichnung}</div>
												{/if}
												<div class="artikel-meta">
													{#if art.hersteller}<span>{art.hersteller}</span>{/if}
													<span>{art.einheit || 'Stk'}</span>
													{#if art.einkaufspreis}<span class="preis">{formatPreis(art.einkaufspreis)}</span>{/if}
													{#if art.shop_url}
														<a href={art.shop_url} target="_blank" class="shop-link" title="Im Shop öffnen">
															<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
																<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/>
															</svg>
														</a>
													{/if}
												</div>
											</div>
											<div class="menge-controls">
												<button onclick={() => setzeMenge(art.id, Math.max(0, menge - 1))} disabled={menge === 0}>−</button>
												<input
													type="number"
													class:filled={menge > 0}
													value={menge}
													min="0"
													onchange={(e) => setzeMengeDirekt(art.id, e)}
													onclick={(e) => (e.target as HTMLInputElement).select()}
												/>
												<button onclick={() => setzeMenge(art.id, menge + 1)}>+</button>
											</div>
										</div>
									{/each}
								</div>
							{/if}

							<!-- Freitext-Positionen -->
							<div class="freitext-section">
								<div class="freitext-header">
									<h4>Freitextpositionen</h4>
									<button class="btn btn-secondary btn-sm" onclick={addFreitextPosition}>
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
											<path d="M12 5v14M5 12h14"/>
										</svg>
										Position hinzufügen
									</button>
								</div>
								{#if freitextPositionen.length > 0}
									<div class="freitext-list">
										{#each freitextPositionen as pos}
											<div class="freitext-row">
												<input
													type="text"
													placeholder="Bezeichnung (z.B. 'Sonderartikel XY')"
													class="freitext-bezeichnung"
													value={pos.bezeichnung}
													oninput={(e) => updateFreitextPosition(pos.id, 'bezeichnung', (e.target as HTMLInputElement).value)}
												/>
												<input
													type="number"
													min="1"
													class="freitext-menge"
													value={pos.menge}
													oninput={(e) => updateFreitextPosition(pos.id, 'menge', parseInt((e.target as HTMLInputElement).value) || 1)}
												/>
												<select
													class="freitext-einheit"
													value={pos.einheit}
													onchange={(e) => updateFreitextPosition(pos.id, 'einheit', (e.target as HTMLSelectElement).value)}
												>
													<option value="Stk">Stk</option>
													<option value="m">m</option>
													<option value="m²">m²</option>
													<option value="kg">kg</option>
													<option value="Rolle">Rolle</option>
													<option value="Paar">Paar</option>
													<option value="Set">Set</option>
												</select>
												<button class="freitext-remove" onclick={() => removeFreitextPosition(pos.id)} aria-label="Entfernen">
													<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
														<path d="M18 6 6 18M6 6l12 12"/>
													</svg>
												</button>
											</div>
										{/each}
									</div>
								{:else}
									<p class="freitext-hint">Keine Freitextpositionen. Nutze diese für Artikel, die nicht im Katalog sind.</p>
								{/if}
							</div>
						</div>
					{/if}

					<!-- Mini-Warenkorb -->
					{#if warenkorbAnzahl > 0}
						<div class="mini-cart">
							<div class="mini-cart-header">
								<span>{warenkorbAnzahl} Artikel</span>
								<span class="mini-cart-sum">{formatPreis(gesamtsumme)}</span>
								<button class="btn-link" onclick={warenkorbLeeren}>Leeren</button>
							</div>
						</div>
					{/if}
				</div>

			<!-- Step 3: Lieferung -->
			{:else if currentStep === 3}
				<div class="step-content">
					<h2 class="step-heading">Wohin soll geliefert werden?</h2>

					<div class="form-grid">
						<div class="form-group full">
							<label for="projekt">Projekt</label>
							<select id="projekt" bind:value={selectedProjekt}>
								{#each projekte as projekt}
									<option value={projekt.atbs_nummer}>
										{projekt.atbs_nummer} - {projekt.project_name.split('|')[1]?.trim() || projekt.project_name}
									</option>
								{/each}
							</select>
							{#if selectedProjektDetails?.address}
								<small class="hint">{selectedProjektDetails.address}</small>
							{/if}
						</div>

						<div class="form-group">
							<label for="lieferort">Lieferort</label>
							<select id="lieferort" bind:value={selectedLieferort}>
								<option value="baustelle">Baustelle</option>
								<option value="lager">Lager - Kleyerweg 40, Dortmund</option>
								<option value="abholung">Abholung</option>
							</select>
						</div>

						<div class="form-group">
							<label for="ansprechpartner">Ansprechpartner vor Ort</label>
							<select id="ansprechpartner" bind:value={selectedAnsprechpartner}>
								{#each ansprechpartner as ap}
									<option value={ap.id}>{formatAnsprechpartnerName(ap)}</option>
								{/each}
							</select>
							{#if selectedAnsprechpartnerDetails?.telefon_mobil}
								<small class="hint success">{selectedAnsprechpartnerDetails.telefon_mobil}</small>
							{/if}
						</div>

						<div class="form-group">
							<label for="lieferdatum">Gewünschtes Lieferdatum</label>
							<input type="date" id="lieferdatum" bind:value={lieferdatum} />
						</div>

						<div class="form-group">
							<label for="zeitfenster">Zeitfenster</label>
							<select id="zeitfenster" bind:value={selectedZeitfenster}>
								<option value="">Egal</option>
								<option value="vormittag">Vormittag (7-12 Uhr)</option>
								<option value="nachmittag">Nachmittag (12-17 Uhr)</option>
								<option value="ganztags">Ganztags</option>
							</select>
						</div>

						<div class="form-group full">
							<label for="hinweise">Lieferhinweise (optional)</label>
							<textarea
								id="hinweise"
								bind:value={lieferhinweise}
								placeholder="z.B. Klingeln bei Müller, 3. Stock..."
								rows="2"
							></textarea>
						</div>
					</div>
				</div>

			<!-- Step 4: Bestätigung -->
			{:else if currentStep === 4}
				<div class="step-content">
					<h2 class="step-heading">{bestelltyp === 'angebotsanfrage' ? 'Angebotsanfrage' : 'Bestellung'} prüfen</h2>

					{#if bestelltyp === 'angebotsanfrage'}
						<div class="message info" style="margin-bottom: var(--spacing-4);">
							Dies ist eine <strong>Angebotsanfrage</strong>. Der Großhändler wird Ihnen ein Angebot zusenden.
						</div>
					{/if}

					<!-- Zusammenfassung -->
					<div class="summary-card">
						<div class="summary-section">
							<h3>Lieferant</h3>
							<p><strong>{selectedHaendlerDetails?.kurzname || selectedHaendlerDetails?.name}</strong></p>
							<p class="muted">{selectedHaendlerDetails?.typ_anzeige || selectedHaendlerDetails?.typ}</p>
						</div>

						<div class="summary-section">
							<h3>Lieferung</h3>
							<p><strong>{selectedProjektDetails?.atbs_nummer}</strong> - {selectedProjektDetails?.project_name.split('|')[1]?.trim() || selectedProjektDetails?.project_name}</p>
							<p>{formatLieferort(selectedLieferort)}</p>
							{#if lieferdatum}
								<p>{new Date(lieferdatum).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}, {formatZeitfenster(selectedZeitfenster)}</p>
							{/if}
							{#if selectedAnsprechpartnerDetails}
								<p class="muted">Ansprechpartner: {formatAnsprechpartnerName(selectedAnsprechpartnerDetails)} {selectedAnsprechpartnerDetails.telefon_mobil ? `(${selectedAnsprechpartnerDetails.telefon_mobil})` : ''}</p>
							{/if}
							{#if lieferhinweise}
								<p class="muted">Hinweis: {lieferhinweise}</p>
							{/if}
						</div>
					</div>

					<!-- Artikel-Liste -->
					<div class="review-list">
						<h3>Artikel ({warenkorbAnzahl})</h3>
						<table>
							<thead>
								<tr>
									<th>Pos.</th>
									<th>Artikel</th>
									<th class="text-right">Menge</th>
									{#if bestelltyp !== 'angebotsanfrage'}
										<th class="text-right">Einzelpreis</th>
										<th class="text-right">Gesamt</th>
									{/if}
								</tr>
							</thead>
							<tbody>
								{#each warenkorbArtikel as art, i}
									<tr>
										<td>{i + 1}</td>
										<td>
											<strong>{art.kurzbezeichnung || art.bezeichnung}</strong>
											{#if art.hersteller}<br><small class="muted">{art.hersteller}</small>{/if}
										</td>
										<td class="text-right">{art.menge} {art.einheit || 'Stk'}</td>
										{#if bestelltyp !== 'angebotsanfrage'}
											<td class="text-right">{formatPreis(art.einkaufspreis || 0)}</td>
											<td class="text-right"><strong>{formatPreis(art.summe)}</strong></td>
										{/if}
									</tr>
								{/each}
								<!-- Freitext-Positionen -->
								{#each freitextPositionen.filter(f => f.bezeichnung.trim() && f.menge > 0) as fp, i}
									<tr class="freitext-position-row">
										<td>{warenkorbArtikel.length + i + 1}</td>
										<td>
											<strong>{fp.bezeichnung}</strong>
											<br><small class="muted freitext-badge">Freitextposition</small>
										</td>
										<td class="text-right">{fp.menge} {fp.einheit}</td>
										{#if bestelltyp !== 'angebotsanfrage'}
											<td class="text-right">-</td>
											<td class="text-right">-</td>
										{/if}
									</tr>
								{/each}
							</tbody>
							{#if bestelltyp !== 'angebotsanfrage'}
								<tfoot>
									<tr>
										<td colspan="4" class="text-right"><strong>Gesamtsumme (netto)</strong></td>
										<td class="text-right total">{formatPreis(gesamtsumme)}</td>
									</tr>
								</tfoot>
							{/if}
						</table>
					</div>

					{#if errorMessage}
						<div class="message error">{errorMessage}</div>
					{/if}
				</div>
			{/if}

			<!-- Footer Actions -->
			{#if !submitSuccess}
				<div class="footer-actions">
					{#if currentStep > 1}
						<button class="btn btn-secondary" onclick={prevStep}>
							Zurück
						</button>
					{:else}
						<div></div>
					{/if}

					{#if currentStep < totalSteps}
						<button
							class="btn btn-primary"
							onclick={nextStep}
							disabled={!canProceed(currentStep)}
						>
							Weiter
						</button>
					{:else}
						<button
							class="btn btn-success"
							onclick={submitBestellung}
							disabled={isSubmitting || warenkorbAnzahl === 0}
						>
							{#if isSubmitting}
								<span class="spinner"></span>
								Wird gesendet...
							{:else}
								{bestelltyp === 'angebotsanfrage' ? 'Anfrage absenden' : 'Bestellung absenden'}
							{/if}
						</button>
					{/if}
				</div>
			{/if}
		{/if}
	</main>
</div>

<style>
	.page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--color-gray-50);
	}

	/* Header */
	.header {
		background: white;
		padding: var(--spacing-4) var(--spacing-6);
		border-bottom: 1px solid var(--color-gray-200);
		position: sticky;
		top: 0;
		z-index: 50;
	}

	.header-content {
		max-width: var(--container-lg);
		margin: 0 auto;
		display: flex;
		align-items: center;
		gap: var(--spacing-4);
	}

	.back-link {
		color: var(--color-gray-500);
		padding: var(--spacing-2);
		border-radius: var(--radius-md);
	}

	.back-link:hover {
		background: var(--color-gray-100);
		color: var(--color-gray-700);
	}

	.back-link svg {
		width: 20px;
		height: 20px;
	}

	.header h1 {
		flex: 1;
		font-size: var(--font-size-xl);
		color: var(--color-gray-900);
	}

	.header-badge {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		background: var(--color-brand-light);
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-full);
	}

	.header-badge .badge {
		background: white;
		color: var(--color-brand-medium);
		padding: 2px 8px;
		border-radius: var(--radius-full);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-bold);
	}

	.badge-sum {
		color: white;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
	}

	/* Warenkorb Toggle */
	.warenkorb-toggle {
		position: relative;
		background: var(--color-gray-100);
		border: 1px solid var(--color-gray-300);
		border-radius: var(--radius-md);
		padding: var(--spacing-2);
		color: var(--color-gray-600);
		cursor: pointer;
	}

	.warenkorb-toggle:hover {
		background: var(--color-gray-200);
	}

	.warenkorb-toggle.has-items {
		background: var(--color-brand-medium);
		border-color: var(--color-brand-medium);
		color: white;
	}

	.warenkorb-toggle svg {
		width: 22px;
		height: 22px;
	}

	.cart-badge {
		position: absolute;
		top: -6px;
		right: -6px;
		background: var(--color-error);
		color: white;
		font-size: 11px;
		font-weight: var(--font-weight-bold);
		min-width: 18px;
		height: 18px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Warenkorb Drawer */
	.drawer-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 100;
	}

	.warenkorb-drawer {
		position: fixed;
		top: 0;
		right: 0;
		width: 360px;
		max-width: 90vw;
		height: 100vh;
		background: white;
		box-shadow: var(--shadow-xl);
		z-index: 101;
		display: flex;
		flex-direction: column;
		animation: slideIn 0.2s ease;
	}

	@keyframes slideIn {
		from { transform: translateX(100%); }
		to { transform: translateX(0); }
	}

	.drawer-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-4);
		border-bottom: 1px solid var(--color-gray-200);
	}

	.drawer-header h2 {
		font-size: var(--font-size-lg);
		margin: 0;
	}

	.drawer-close {
		background: none;
		border: none;
		padding: var(--spacing-2);
		cursor: pointer;
		color: var(--color-gray-500);
		border-radius: var(--radius-md);
	}

	.drawer-close:hover {
		background: var(--color-gray-100);
	}

	.drawer-close svg {
		width: 20px;
		height: 20px;
	}

	.drawer-empty {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-gray-500);
	}

	.drawer-items {
		flex: 1;
		overflow-y: auto;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.drawer-item {
		padding: var(--spacing-3) var(--spacing-4);
		border-bottom: 1px solid var(--color-gray-100);
	}

	.drawer-item-info strong {
		display: block;
		font-size: var(--font-size-sm);
	}

	.drawer-item-info small {
		color: var(--color-gray-500);
		font-size: var(--font-size-xs);
	}

	.drawer-item-controls {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: var(--spacing-2);
	}

	.mini-menge {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		background: var(--color-gray-100);
		border-radius: var(--radius-md);
		padding: 2px;
	}

	.mini-menge button {
		width: 26px;
		height: 26px;
		border: none;
		background: white;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-weight: var(--font-weight-bold);
	}

	.mini-menge button:hover {
		background: var(--color-gray-200);
	}

	.mini-menge span {
		min-width: 24px;
		text-align: center;
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-sm);
	}

	.drawer-item-summe {
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-sm);
	}

	.drawer-footer {
		padding: var(--spacing-4);
		border-top: 2px solid var(--color-gray-200);
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: var(--color-gray-50);
	}

	.btn-sm {
		padding: var(--spacing-2) var(--spacing-3);
		font-size: var(--font-size-xs);
	}

	.drawer-total {
		text-align: right;
	}

	.drawer-total span {
		display: block;
		font-size: var(--font-size-xs);
		color: var(--color-gray-500);
	}

	.drawer-total strong {
		font-size: var(--font-size-xl);
		color: var(--color-gray-900);
	}

	/* Progress Bar */
	.progress-bar {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: var(--spacing-4) var(--spacing-6);
		background: white;
		border-bottom: 1px solid var(--color-gray-200);
		gap: 0;
	}

	.progress-step {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-1);
		background: none;
		border: none;
		cursor: default;
		padding: var(--spacing-2) var(--spacing-1);
		opacity: 0.5;
	}

	.progress-step.active,
	.progress-step.complete {
		opacity: 1;
	}

	.progress-step.clickable {
		cursor: pointer;
	}

	.progress-step.clickable:hover .step-number {
		transform: scale(1.1);
	}

	.step-number {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-sm);
		background: var(--color-gray-200);
		color: var(--color-gray-600);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-sm);
		transition: all 0.2s ease;
	}

	.progress-step.active .step-number {
		background: var(--color-brand-medium);
		color: white;
	}

	.progress-step.complete .step-number {
		background: var(--color-success);
		color: white;
	}

	.step-number svg {
		width: 16px;
		height: 16px;
	}

	.step-title {
		font-size: var(--font-size-xs);
		color: var(--color-gray-600);
		white-space: nowrap;
	}

	.progress-step.active .step-title {
		color: var(--color-brand-medium);
		font-weight: var(--font-weight-semibold);
	}

	.progress-line {
		width: 40px;
		height: 2px;
		background: var(--color-gray-300);
		margin-top: 23px; /* padding (8px) + halbe Quadrat-Höhe (15px) */
	}

	.progress-line.complete {
		background: var(--color-brand-medium);
	}

	/* Main */
	.main {
		flex: 1;
		padding: var(--spacing-6);
		padding-bottom: 100px;
		max-width: var(--container-lg);
		margin: 0 auto;
		width: 100%;
	}

	/* Loading */
	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-12);
		gap: var(--spacing-4);
	}

	.spinner-large {
		width: 48px;
		height: 48px;
		border: 4px solid var(--color-gray-200);
		border-top-color: var(--color-brand-light);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2px solid rgba(255,255,255,0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		display: inline-block;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.loading-inline {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-4);
		color: var(--color-gray-500);
	}

	/* Step Content */
	.step-content {
		background: white;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
		padding: var(--spacing-6);
	}

	.step-artikel {
		padding: 0;
	}

	.step-heading {
		font-size: var(--font-size-lg);
		color: var(--color-gray-800);
		margin-bottom: var(--spacing-6);
	}

	/* Bestelltyp Toggle */
	.bestelltyp-toggle {
		display: flex;
		gap: var(--spacing-3);
		margin-bottom: var(--spacing-6);
		padding: var(--spacing-1);
		background: var(--color-gray-100);
		border-radius: var(--radius-lg);
	}

	.bestelltyp-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-2);
		padding: var(--spacing-3) var(--spacing-4);
		background: transparent;
		border: none;
		border-radius: var(--radius-md);
		font-weight: var(--font-weight-medium);
		font-size: var(--font-size-sm);
		color: var(--color-gray-600);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.bestelltyp-btn:hover {
		color: var(--color-gray-800);
	}

	.bestelltyp-btn.active {
		background: white;
		color: var(--color-brand-medium);
		box-shadow: var(--shadow-sm);
	}

	.bestelltyp-btn svg {
		width: 20px;
		height: 20px;
	}

	/* Step 1: Händler-Grid */
	.haendler-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--spacing-4);
	}

	.haendler-card {
		position: relative;
		background: var(--color-gray-50);
		border: 2px solid var(--color-gray-200);
		border-radius: var(--radius-lg);
		padding: var(--spacing-4);
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: center;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		min-height: 80px;
	}

	.haendler-card:hover {
		border-color: var(--color-brand-medium);
		background: var(--color-info-light);
	}

	.haendler-card.selected {
		border-color: var(--color-brand-medium);
		background: var(--color-brand-light);
		color: white;
	}

	.haendler-name {
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-base);
		color: var(--color-gray-800);
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.haendler-card.selected .haendler-name {
		color: white;
	}

	.haendler-sortiment {
		font-size: var(--font-size-xs);
		color: var(--color-gray-500);
		margin-top: var(--spacing-2);
	}

	.haendler-card.selected .haendler-sortiment {
		color: rgba(255, 255, 255, 0.8);
	}

	.haendler-check {
		position: absolute;
		top: var(--spacing-2);
		right: var(--spacing-2);
		width: 24px;
		height: 24px;
		background: white;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.haendler-check svg {
		width: 14px;
		height: 14px;
		color: var(--color-brand-medium);
	}

	/* Step 2: Tabs */
	.tabs {
		display: flex;
		border-bottom: 2px solid var(--color-gray-200);
		background: var(--color-gray-50);
	}

	.tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-2);
		padding: var(--spacing-4);
		background: none;
		border: none;
		cursor: pointer;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
		color: var(--color-gray-600);
		border-bottom: 2px solid transparent;
		margin-bottom: -2px;
		transition: all 0.15s ease;
	}

	.tab:hover {
		color: var(--color-gray-800);
		background: var(--color-gray-100);
	}

	.tab.active {
		color: var(--color-brand-medium);
		border-bottom-color: var(--color-brand-medium);
		background: white;
	}

	.tab svg {
		width: 18px;
		height: 18px;
	}

	/* KI Input */
	.ki-input {
		padding: var(--spacing-6);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.ki-hint {
		color: var(--color-gray-600);
		font-size: var(--font-size-sm);
	}

	.ki-input textarea {
		resize: none;
	}

	/* Katalog */
	.katalog {
		padding: var(--spacing-4);
	}

	.search-box {
		position: relative;
		margin-bottom: var(--spacing-3);
	}

	.search-box input {
		width: 100%;
		padding-left: 44px;
		padding-right: 44px;
	}

	.search-icon {
		position: absolute;
		left: 14px;
		top: 50%;
		transform: translateY(-50%);
		width: 20px;
		height: 20px;
		color: var(--color-gray-400);
		pointer-events: none;
	}

	.search-clear {
		position: absolute;
		right: 8px;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		padding: var(--spacing-2);
		cursor: pointer;
		color: var(--color-gray-400);
		border-radius: var(--radius-md);
	}

	.search-clear:hover {
		color: var(--color-gray-600);
		background: var(--color-gray-100);
	}

	.search-clear svg {
		width: 16px;
		height: 16px;
	}

	.filter-row {
		display: flex;
		gap: var(--spacing-2);
		flex-wrap: wrap;
		margin-bottom: var(--spacing-3);
	}

	.filter-row select {
		flex: 1;
		min-width: 120px;
		padding: var(--spacing-2) var(--spacing-3);
		font-size: var(--font-size-sm);
	}

	.btn-link {
		background: none;
		border: none;
		color: var(--color-brand-medium);
		cursor: pointer;
		font-size: var(--font-size-sm);
		padding: var(--spacing-2);
	}

	.btn-link:hover {
		text-decoration: underline;
	}

	.artikel-count {
		font-size: var(--font-size-xs);
		color: var(--color-gray-500);
		margin-bottom: var(--spacing-2);
	}

	.artikel-list {
		max-height: 400px;
		overflow-y: auto;
		border: 1px solid var(--color-gray-200);
		border-radius: var(--radius-md);
	}

	.artikel-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-3);
		border-bottom: 1px solid var(--color-gray-100);
	}

	.artikel-row:last-child {
		border-bottom: none;
	}

	.artikel-row.selected {
		background: var(--color-success-light);
	}

	.artikel-row.favorit {
		background: linear-gradient(90deg, rgba(255, 193, 7, 0.1) 0%, transparent 10%);
	}

	.artikel-row.favorit.selected {
		background: linear-gradient(90deg, rgba(255, 193, 7, 0.15) 0%, var(--color-success-light) 10%);
	}

	.fav-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: var(--font-size-lg);
		color: var(--color-gray-300);
		padding: 0;
	}

	.fav-btn:hover,
	.fav-btn.active {
		color: var(--color-warning);
	}

	.artikel-thumb {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-sm);
		overflow: hidden;
		flex-shrink: 0;
		border: 1px solid var(--color-gray-200);
	}

	.artikel-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.artikel-thumb:hover {
		border-color: var(--color-brand-medium);
	}

	.shop-link {
		display: inline-flex;
		color: var(--color-gray-400);
	}

	.shop-link:hover {
		color: var(--color-brand-medium);
	}

	.shop-link svg {
		width: 12px;
		height: 12px;
	}

	.artikel-info {
		flex: 1;
		min-width: 0;
	}

	.artikel-name {
		background: none;
		border: none;
		padding: 0;
		text-align: left;
		cursor: pointer;
		font-weight: var(--font-weight-medium);
		font-size: var(--font-size-sm);
		color: var(--color-gray-800);
	}

	.artikel-name:hover {
		color: var(--color-brand-medium);
		text-decoration: underline;
	}

	.artikel-full {
		font-size: var(--font-size-xs);
		color: var(--color-gray-500);
		margin-top: 2px;
		padding-left: var(--spacing-2);
		border-left: 2px solid var(--color-gray-300);
	}

	.artikel-meta {
		display: flex;
		gap: var(--spacing-2);
		font-size: var(--font-size-xs);
		color: var(--color-gray-500);
		margin-top: 2px;
	}

	.artikel-meta .preis {
		font-weight: var(--font-weight-medium);
		color: var(--color-gray-700);
	}

	.menge-controls {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.menge-controls button {
		width: 32px;
		height: 32px;
		border: 2px solid var(--color-gray-300);
		background: white;
		border-radius: var(--radius-md);
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-bold);
		cursor: pointer;
	}

	.menge-controls button:hover:not(:disabled) {
		border-color: var(--color-brand-medium);
		background: var(--color-info-light);
	}

	.menge-controls button:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.menge-controls input {
		width: 44px;
		height: 32px;
		text-align: center;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		border: 2px solid var(--color-gray-200);
		border-radius: var(--radius-md);
		padding: 0;
	}

	.menge-controls input:focus {
		outline: none;
		border-color: var(--color-brand-medium);
	}

	.menge-controls input.filled {
		color: var(--color-success-dark);
		border-color: var(--color-success);
		background: var(--color-success-light);
	}

	/* Freitext-Positionen */
	.freitext-section {
		border-top: 2px solid var(--color-gray-200);
		margin-top: var(--spacing-4);
		padding-top: var(--spacing-4);
	}

	.freitext-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-3);
	}

	.freitext-header h4 {
		font-size: var(--font-size-sm);
		color: var(--color-gray-700);
		margin: 0;
	}

	.freitext-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.freitext-row {
		display: flex;
		gap: var(--spacing-2);
		align-items: center;
	}

	.freitext-bezeichnung {
		flex: 1;
		min-width: 200px;
	}

	.freitext-menge {
		width: 70px;
		text-align: center;
	}

	.freitext-einheit {
		width: 80px;
	}

	.freitext-remove {
		background: none;
		border: none;
		color: var(--color-gray-400);
		padding: var(--spacing-2);
		cursor: pointer;
		border-radius: var(--radius-md);
	}

	.freitext-remove:hover {
		background: var(--color-error-light);
		color: var(--color-error);
	}

	.freitext-remove svg {
		width: 16px;
		height: 16px;
	}

	.freitext-hint {
		font-size: var(--font-size-xs);
		color: var(--color-gray-500);
		margin: 0;
	}

	/* Mini Cart */
	.mini-cart {
		position: sticky;
		bottom: 0;
		background: var(--color-gray-800);
		color: white;
		padding: var(--spacing-3) var(--spacing-4);
	}

	.mini-cart-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-4);
	}

	.mini-cart-sum {
		flex: 1;
		text-align: right;
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-lg);
	}

	.mini-cart .btn-link {
		color: var(--color-gray-300);
	}

	/* Step 3: Form */
	.form-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--spacing-4);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.form-group.full {
		grid-column: span 2;
	}

	.form-group label {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
		color: var(--color-gray-700);
	}

	.hint {
		font-size: var(--font-size-xs);
		color: var(--color-gray-500);
	}

	.hint.success {
		color: var(--color-success-dark);
		background: var(--color-success-light);
		padding: var(--spacing-1) var(--spacing-2);
		border-radius: var(--radius-sm);
	}

	/* Step 4: Summary */
	.summary-card {
		background: var(--color-gray-50);
		border-radius: var(--radius-md);
		padding: var(--spacing-4);
		margin-bottom: var(--spacing-6);
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: var(--spacing-4);
	}

	.summary-section h3 {
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--color-gray-500);
		margin-bottom: var(--spacing-2);
	}

	.summary-section p {
		margin: var(--spacing-1) 0;
		font-size: var(--font-size-sm);
	}

	.muted {
		color: var(--color-gray-500);
	}

	/* Review List */
	.review-list h3 {
		font-size: var(--font-size-base);
		margin-bottom: var(--spacing-3);
	}

	.review-list table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--font-size-sm);
	}

	.review-list th {
		text-align: left;
		padding: var(--spacing-2) var(--spacing-3);
		background: var(--color-gray-100);
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		color: var(--color-gray-600);
	}

	.review-list td {
		padding: var(--spacing-3);
		border-bottom: 1px solid var(--color-gray-200);
	}

	.review-list tfoot td {
		border-bottom: none;
		padding-top: var(--spacing-4);
	}

	.text-right {
		text-align: right;
	}

	.total {
		font-size: var(--font-size-lg);
		color: var(--color-success-dark);
	}

	/* Success View */
	.success-view {
		text-align: center;
		padding: var(--spacing-12);
		background: white;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
	}

	.success-icon {
		width: 80px;
		height: 80px;
		margin: 0 auto var(--spacing-6);
		background: var(--color-success-light);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.success-icon svg {
		width: 40px;
		height: 40px;
		color: var(--color-success);
	}

	.success-view h2 {
		font-size: var(--font-size-2xl);
		color: var(--color-gray-900);
		margin-bottom: var(--spacing-2);
	}

	.success-nr {
		font-size: var(--font-size-lg);
		margin-bottom: var(--spacing-4);
	}

	.success-view p {
		color: var(--color-gray-600);
		margin-bottom: var(--spacing-6);
	}

	.success-actions {
		display: flex;
		gap: var(--spacing-4);
		justify-content: center;
	}

	/* Messages */
	.message {
		padding: var(--spacing-3);
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
	}

	.message.error {
		background: var(--color-error-light);
		color: var(--color-error-dark);
	}

	.message.success {
		background: var(--color-success-light);
		color: var(--color-success-dark);
	}

	.message.warning {
		background: var(--color-warning-light);
		color: var(--color-warning-dark);
	}

	.message.info {
		background: var(--color-info-light);
		color: var(--color-info-dark);
	}

	.freitext-position-row {
		background: var(--color-gray-50);
	}

	.freitext-badge {
		display: inline-block;
		background: var(--color-gray-200);
		color: var(--color-gray-600);
		padding: 2px 6px;
		border-radius: var(--radius-sm);
		font-size: var(--font-size-xs);
	}

	/* Empty State */
	.empty-state {
		text-align: center;
		padding: var(--spacing-8);
		color: var(--color-gray-500);
	}

	/* Footer Actions */
	.footer-actions {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-4) var(--spacing-6);
		background: white;
		border-top: 2px solid var(--color-gray-200);
		box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
		z-index: 40;
	}

	/* Buttons */
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-2);
		padding: var(--spacing-3) var(--spacing-6);
		border-radius: var(--radius-md);
		font-weight: var(--font-weight-medium);
		font-size: var(--font-size-base);
		cursor: pointer;
		border: none;
		transition: all 0.15s ease;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background: var(--color-brand-medium);
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--color-brand-dark);
	}

	.btn-secondary {
		background: var(--color-gray-200);
		color: var(--color-gray-700);
	}

	.btn-secondary:hover:not(:disabled) {
		background: var(--color-gray-300);
	}

	.btn-success {
		background: var(--color-success);
		color: white;
	}

	.btn-success:hover:not(:disabled) {
		background: var(--color-success-dark);
	}

	/* Mobile */
	@media (max-width: 767px) {
		.header-content {
			gap: var(--spacing-2);
		}

		.header h1 {
			font-size: var(--font-size-lg);
		}

		.progress-bar {
			padding: var(--spacing-2);
			overflow-x: auto;
		}

		.step-title {
			display: none;
		}

		.progress-line {
			max-width: 24px;
		}

		.main {
			padding: var(--spacing-3);
			padding-bottom: 120px;
		}

		.step-content {
			padding: var(--spacing-4);
		}

		.haendler-grid {
			grid-template-columns: 1fr;
		}

		.form-grid {
			grid-template-columns: 1fr;
		}

		.form-group.full {
			grid-column: span 1;
		}

		.filter-row {
			flex-direction: column;
		}

		.filter-row select {
			width: 100%;
		}

		.artikel-list {
			max-height: 300px;
		}

		.review-list table {
			font-size: var(--font-size-xs);
		}

		.review-list th,
		.review-list td {
			padding: var(--spacing-2);
		}

		.footer-actions {
			padding: var(--spacing-3);
		}

		.btn {
			padding: var(--spacing-3) var(--spacing-4);
			font-size: var(--font-size-sm);
		}

		.success-view {
			padding: var(--spacing-6);
		}

		.success-actions {
			flex-direction: column;
		}

		.success-actions .btn {
			width: 100%;
		}
	}
</style>
