<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase, parseArtikelText } from '$lib/supabase';

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

	// === State ===
	let projekte = $state<Projekt[]>([]);
	let grosshaendler = $state<Grosshaendler[]>([]);
	let artikel = $state<Artikel[]>([]);
	let isLoading = $state(true);
	let isLoadingArtikel = $state(false);

	let selectedProjekt = $state('');
	let selectedHaendler = $state('');
	let selectedLieferort = $state('baustelle');
	let lieferdatum = $state('');
	let selectedZeitfenster = $state('');

	// NEU: Ansprechpartner für Lieferung
	interface Ansprechpartner {
		id: string;
		vorname: string | null;
		nachname: string | null;
		telefon_mobil: string | null;
		email: string | null;
	}
	let ansprechpartner = $state<Ansprechpartner[]>([]);
	let selectedAnsprechpartner = $state('');

	let artikelText = $state('');
	let isProcessing = $state(false);
	let erkannteArtikel = $state<ErkannterArtikel[]>([]);
	let unerkannteTexte = $state<string[]>([]);
	let errorMessage = $state('');

	// Bestellpositionen mit Mengen
	let bestellpositionen = $state<Map<string, number>>(new Map());

	// Expanded Artikel (für Langname-Anzeige)
	let expandedArtikel = $state<Set<string>>(new Set());

	// Filter-State
	let selectedKategorie = $state<string | null>(null);
	let selectedUnterkategorie = $state<string | null>(null);
	let selectedHersteller = $state<string | null>(null);

	// NEU: Suchfeld
	let suchbegriff = $state('');

	// NEU: Warenkorb-Drawer
	let warenkorbOpen = $state(false);

	// NEU: Benutzer aus Auth Session
	let currentUser = $state<string | null>(null);

	// === Daten laden ===
	onMount(async () => {
		// Auth Session prüfen
		const { data: { session } } = await supabase.auth.getSession();
		currentUser = session?.user?.email || 'anonymous';

		await loadFavoriten();
		await loadData();
	});

	async function loadData() {
		isLoading = true;

		try {
			// Projekte aus monday_bauprozess laden - nur Phasen 2, 3, 4
			const { data: projekteData, error: projekteError } = await supabase
				.from('monday_bauprozess')
				.select('id, name, group_title, column_values')
				.or('group_title.ilike.(2%,group_title.ilike.(3%,group_title.ilike.(4%')
				.order('name', { ascending: true });

			if (projekteError) {
				console.error('Fehler beim Laden der Projekte:', projekteError);
			}

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
					selectedProjekt = projekte[0].atbs_nummer;
				}
			}

			// Großhändler aus Datenbank laden
			const { data: ghData, error: ghError } = await supabase
				.from('grosshaendler')
				.select('id, name, kurzname, typ, typ_anzeige, bestell_email')
				.eq('ist_aktiv', true)
				.order('name', { ascending: true });

			if (ghError) {
				console.error('Fehler beim Laden der Großhändler:', ghError);
			}

			if (ghData && ghData.length > 0) {
				grosshaendler = ghData;
				selectedHaendler = grosshaendler[0].id;
				await loadArtikelFuerHaendler(grosshaendler[0].id);
			}

			// NEU: Ansprechpartner (Mitarbeiter) laden
			const { data: mitarbeiterData, error: mitarbeiterError } = await supabase
				.from('kontakte')
				.select('id, vorname, nachname, telefon_mobil, email')
				.eq('aktiv', true)
				.contains('kontaktarten', ['mitarbeiter'])
				.order('nachname', { ascending: true });

			if (mitarbeiterError) {
				console.error('Fehler beim Laden der Mitarbeiter:', mitarbeiterError);
			}

			if (mitarbeiterData && mitarbeiterData.length > 0) {
				ansprechpartner = mitarbeiterData;
				// Aktuellen Benutzer als Standard-Ansprechpartner setzen
				const currentUserMatch = mitarbeiterData.find(m => m.email === currentUser);
				if (currentUserMatch) {
					selectedAnsprechpartner = currentUserMatch.id;
				} else {
					selectedAnsprechpartner = mitarbeiterData[0].id;
				}
			}
		} catch (err) {
			console.error('Unerwarteter Fehler beim Laden:', err);
			errorMessage = 'Fehler beim Laden der Daten. Bitte Seite neu laden.';
		} finally {
			isLoading = false;
		}
	}

	// Artikel für ausgewählten Großhändler laden
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
				.select('id, artikelnummer, bezeichnung, kurzbezeichnung, hersteller, einheit, einkaufspreis, kategorie, unterkategorie, grosshaendler_id')
				.eq('grosshaendler_id', haendlerId)
				.eq('ist_aktiv', true)
				.order('bezeichnung', { ascending: true });

			if (error) {
				console.error('Fehler beim Laden der Artikel:', error);
				errorMessage = 'Artikel konnten nicht geladen werden.';
			} else if (artikelData) {
				artikel = artikelData;
			}
		} catch (err) {
			console.error('Netzwerkfehler beim Laden der Artikel:', err);
			errorMessage = 'Netzwerkfehler - bitte Verbindung prüfen.';
		} finally {
			isLoadingArtikel = false;
		}
	}

	// NEU: Bei Großhändler-Wechsel mit Warnung
	async function onHaendlerChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		const neuerHaendler = select.value;

		// Warnung wenn Warenkorb nicht leer
		if (bestellpositionen.size > 0) {
			const confirmed = confirm(
				`Du hast ${bestellpositionen.size} Artikel im Warenkorb.\n\nHändlerwechsel leert den Warenkorb. Fortfahren?`
			);
			if (!confirmed) {
				// Zurücksetzen auf alten Wert
				select.value = selectedHaendler;
				return;
			}
		}

		// Warenkorb leeren und neu laden
		bestellpositionen = new Map();
		erkannteArtikel = [];
		unerkannteTexte = [];
		selectedHaendler = neuerHaendler;
		await loadArtikelFuerHaendler(neuerHaendler);
	}

	// Favoriten aus Datenbank
	let favoriten = $state<Set<string>>(new Set());
	let favoritenLoading = $state(false);

	// Favoriten aus DB laden
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
			} else if (error) {
				console.warn('Favoriten konnten nicht geladen werden:', error.message);
				// Fallback: localStorage
				loadFavoritenFromLocalStorage();
			}
		} catch (err) {
			console.warn('Favoriten-Laden fehlgeschlagen, nutze localStorage:', err);
			loadFavoritenFromLocalStorage();
		} finally {
			favoritenLoading = false;
		}
	}

	function loadFavoritenFromLocalStorage() {
		try {
			const stored = localStorage.getItem('bestellartikel_favoriten');
			if (stored) {
				favoriten = new Set(JSON.parse(stored));
			}
		} catch (e) {
			console.warn('localStorage nicht verfügbar:', e);
		}
	}

	async function toggleFavorit(artikelId: string) {
		const istFavorit = favoriten.has(artikelId);

		// Optimistic UI Update
		if (istFavorit) {
			favoriten.delete(artikelId);
		} else {
			favoriten.add(artikelId);
		}
		favoriten = new Set(favoriten);

		// DB Update
		try {
			if (currentUser && currentUser !== 'anonymous') {
				if (istFavorit) {
					await supabase
						.from('bestellartikel_favoriten')
						.delete()
						.eq('benutzer_id', currentUser)
						.eq('artikel_id', artikelId);
				} else {
					await supabase
						.from('bestellartikel_favoriten')
						.insert({ benutzer_id: currentUser, artikel_id: artikelId });
				}
			}
			// Auch localStorage aktualisieren als Backup
			localStorage.setItem('bestellartikel_favoriten', JSON.stringify([...favoriten]));
		} catch (err) {
			// Bei Fehler: Rollback
			if (istFavorit) {
				favoriten.add(artikelId);
			} else {
				favoriten.delete(artikelId);
			}
			favoriten = new Set(favoriten);
			console.error('Favorit-Speichern fehlgeschlagen:', err);
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

	// NEU: Anzahl Artikel im Warenkorb
	let warenkorbAnzahl = $derived.by(() => {
		let anzahl = 0;
		for (const menge of bestellpositionen.values()) {
			if (menge > 0) anzahl++;
		}
		return anzahl;
	});

	// NEU: Warenkorb-Artikel mit Details
	let warenkorbArtikel = $derived.by(() => {
		const items: Array<Artikel & { menge: number; summe: number }> = [];
		for (const [artikelId, menge] of bestellpositionen) {
			if (menge > 0) {
				const art = artikel.find(a => a.id === artikelId);
				if (art) {
					items.push({
						...art,
						menge,
						summe: (art.einkaufspreis || 0) * menge
					});
				}
			}
		}
		return items.sort((a, b) => (a.kurzbezeichnung || a.bezeichnung).localeCompare(b.kurzbezeichnung || b.bezeichnung));
	});

	let selectedProjektDetails = $derived.by(() => {
		return projekte.find(p => p.atbs_nummer === selectedProjekt);
	});

	let selectedHaendlerDetails = $derived.by(() => {
		return grosshaendler.find(h => h.id === selectedHaendler);
	});

	// NEU: Ausgewählter Ansprechpartner Details
	let selectedAnsprechpartnerDetails = $derived.by(() => {
		return ansprechpartner.find(a => a.id === selectedAnsprechpartner);
	});

	// NEU: Formatierter Name für Ansprechpartner
	function formatAnsprechpartnerName(ap: Ansprechpartner): string {
		const parts = [ap.vorname, ap.nachname].filter(Boolean);
		return parts.join(' ') || 'Unbekannt';
	}

	// Verfügbare Kategorien (Gewerke)
	let verfuegbareKategorien = $derived.by(() => {
		const kategorien = new Set<string>();
		for (const art of artikel) {
			if (art.kategorie) kategorien.add(art.kategorie);
		}
		return [...kategorien].sort();
	});

	// Verfügbare Unterkategorien (abhängig von gewählter Kategorie)
	let verfuegbareUnterkategorien = $derived.by(() => {
		const unterkategorien = new Set<string>();
		for (const art of artikel) {
			if (art.unterkategorie) {
				if (!selectedKategorie || art.kategorie === selectedKategorie) {
					unterkategorien.add(art.unterkategorie);
				}
			}
		}
		return [...unterkategorien].sort();
	});

	// Verfügbare Hersteller (abhängig von gewählter Kategorie/Unterkategorie)
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

	// NEU: Gefilterte Artikel mit Suchfunktion
	let gefilterteArtikel = $derived.by(() => {
		let filtered = artikel;

		// Volltextsuche
		if (suchbegriff.trim()) {
			const such = suchbegriff.toLowerCase().trim();
			filtered = filtered.filter(a =>
				(a.bezeichnung?.toLowerCase().includes(such)) ||
				(a.kurzbezeichnung?.toLowerCase().includes(such)) ||
				(a.artikelnummer?.toLowerCase().includes(such)) ||
				(a.hersteller?.toLowerCase().includes(such))
			);
		}

		// Nach Kategorie filtern
		if (selectedKategorie) {
			filtered = filtered.filter(a => a.kategorie === selectedKategorie);
		}

		// Nach Unterkategorie filtern
		if (selectedUnterkategorie) {
			filtered = filtered.filter(a => a.unterkategorie === selectedUnterkategorie);
		}

		// Nach Hersteller filtern
		if (selectedHersteller) {
			filtered = filtered.filter(a => a.hersteller === selectedHersteller);
		}

		// Sortieren: Favoriten oben, dann alphabetisch
		return [...filtered].sort((a, b) => {
			const aFav = favoriten.has(a.id);
			const bFav = favoriten.has(b.id);
			if (aFav && !bFav) return -1;
			if (!aFav && bFav) return 1;
			return (a.kurzbezeichnung || a.bezeichnung).localeCompare(b.kurzbezeichnung || b.bezeichnung);
		});
	});

	// NEU: Aktiver Filter als Breadcrumb
	let filterBreadcrumb = $derived.by(() => {
		const parts: string[] = [];
		if (selectedKategorie) parts.push(selectedKategorie);
		if (selectedUnterkategorie) parts.push(selectedUnterkategorie);
		if (selectedHersteller) parts.push(selectedHersteller);
		return parts;
	});

	// === Funktionen ===
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

				// Übertrage erkannte Artikel in Bestellpositionen
				for (const item of result.items) {
					let artikelId: string | undefined;

					if (item.artikel_id) {
						artikelId = item.artikel_id;
					} else {
						const match = artikel.find(
							a => a.bezeichnung.toLowerCase().includes(item.bezeichnung.toLowerCase())
						);
						if (match) {
							artikelId = match.id;
						}
					}

					if (artikelId) {
						const bisherigeMenge = bestellpositionen.get(artikelId) || 0;
						bestellpositionen.set(artikelId, bisherigeMenge + item.menge);
					}
				}
				bestellpositionen = new Map(bestellpositionen);
				artikelText = '';
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

	function selectKategorie(kat: string | null) {
		if (selectedKategorie === kat) {
			selectedKategorie = null;
		} else {
			selectedKategorie = kat;
		}
		selectedUnterkategorie = null;
		selectedHersteller = null;
	}

	function selectUnterkategorie(unterkat: string | null) {
		if (selectedUnterkategorie === unterkat) {
			selectedUnterkategorie = null;
		} else {
			selectedUnterkategorie = unterkat;
		}
		selectedHersteller = null;
	}

	function selectHersteller(hersteller: string | null) {
		if (selectedHersteller === hersteller) {
			selectedHersteller = null;
		} else {
			selectedHersteller = hersteller;
		}
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

	function formatPreis(betrag: number): string {
		return betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
	}

	// NEU: Warenkorb leeren
	function warenkorbLeeren() {
		if (bestellpositionen.size === 0) return;
		if (confirm('Warenkorb wirklich leeren?')) {
			bestellpositionen = new Map();
		}
	}
</script>

<div class="page">
	<!-- Header mit Warenkorb-Badge -->
	<header class="header">
		<div class="header-content">
			<h1>Neue Bestellung</h1>
			<div class="header-right">
				<!-- Warenkorb-Button -->
				<button
					class="warenkorb-toggle"
					class:has-items={warenkorbAnzahl > 0}
					onclick={() => warenkorbOpen = !warenkorbOpen}
					aria-label="Warenkorb öffnen ({warenkorbAnzahl} Artikel)"
					aria-expanded={warenkorbOpen}
				>
					<svg class="cart-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="9" cy="21" r="1"></circle>
						<circle cx="20" cy="21" r="1"></circle>
						<path d="m1 1 4 4h16l-2 9H7L5 5"></path>
					</svg>
					{#if warenkorbAnzahl > 0}
						<span class="badge">{warenkorbAnzahl}</span>
					{/if}
				</button>
				<div class="user-info">
					<span>{currentUser || 'Lädt...'}</span>
					<div class="avatar">{currentUser ? currentUser.substring(0, 2).toUpperCase() : '?'}</div>
				</div>
			</div>
		</div>
	</header>

	<!-- Warenkorb Drawer -->
	{#if warenkorbOpen}
		<div class="drawer-backdrop" onclick={() => warenkorbOpen = false} aria-hidden="true"></div>
		<aside class="warenkorb-drawer" role="dialog" aria-label="Warenkorb">
			<div class="drawer-header">
				<h2>Warenkorb</h2>
				<button
					class="drawer-close"
					onclick={() => warenkorbOpen = false}
					aria-label="Warenkorb schließen"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 6 6 18M6 6l12 12"></path>
					</svg>
				</button>
			</div>

			{#if warenkorbArtikel.length === 0}
				<div class="drawer-empty">
					<p>Dein Warenkorb ist leer.</p>
					<small>Füge Artikel aus dem Katalog hinzu.</small>
				</div>
			{:else}
				<ul class="drawer-items">
					{#each warenkorbArtikel as item}
						<li class="drawer-item">
							<div class="drawer-item-info">
								<strong>{item.kurzbezeichnung || item.bezeichnung}</strong>
								{#if item.hersteller}
									<small>{item.hersteller}</small>
								{/if}
							</div>
							<div class="drawer-item-controls">
								<div class="mini-menge">
									<button
										type="button"
										onclick={() => setzeMenge(item.id, item.menge - 1)}
										aria-label="Menge verringern"
									>−</button>
									<span>{item.menge}</span>
									<button
										type="button"
										onclick={() => setzeMenge(item.id, item.menge + 1)}
										aria-label="Menge erhöhen"
									>+</button>
								</div>
								<span class="drawer-item-summe">{formatPreis(item.summe)}</span>
							</div>
						</li>
					{/each}
				</ul>

				<div class="drawer-footer">
					<button class="btn btn-secondary btn-sm" onclick={warenkorbLeeren}>
						Leeren
					</button>
					<div class="drawer-total">
						<span>Gesamt</span>
						<strong>{formatPreis(gesamtsumme)}</strong>
					</div>
				</div>
			{/if}
		</aside>
	{/if}

	<main class="main">
		{#if isLoading}
			<div class="loading">
				<div class="spinner-large"></div>
				<p>Lade Daten...</p>
			</div>
		{:else}
			<div class="card">
				<!-- Projekt-Auswahl -->
				<section class="section">
					<h2 class="section-title">Projekt & Lieferung</h2>

					<div class="form-grid">
						<div class="form-group">
							<label for="projekt">ATBS-Nr / Projekt</label>
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
							<label for="haendler">Großhändler / Lieferant</label>
							<select id="haendler" bind:value={selectedHaendler} onchange={onHaendlerChange}>
								{#each grosshaendler as haendler}
									<option value={haendler.id}>
										{haendler.kurzname || haendler.name} - {haendler.typ_anzeige || haendler.typ}
									</option>
								{/each}
							</select>
							{#if artikel.length > 0}
								<small class="hint">{artikel.length} Artikel verfügbar</small>
							{:else if isLoadingArtikel}
								<small class="hint">Lade Artikel...</small>
							{:else}
								<small class="hint warning">Keine Artikel für diesen Lieferanten</small>
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

						<div class="form-group">
							<label for="ansprechpartner">Ansprechpartner vor Ort</label>
							<select id="ansprechpartner" bind:value={selectedAnsprechpartner}>
								{#each ansprechpartner as ap}
									<option value={ap.id}>
										{formatAnsprechpartnerName(ap)}
									</option>
								{/each}
							</select>
							{#if selectedAnsprechpartnerDetails}
								<div class="ansprechpartner-info">
									{#if selectedAnsprechpartnerDetails.telefon_mobil}
										<span class="ap-telefon">{selectedAnsprechpartnerDetails.telefon_mobil}</span>
									{/if}
								</div>
							{/if}
						</div>
					</div>
				</section>

				<!-- Artikel-Eingabe -->
				<section class="section">
					<h2 class="section-title">Artikel eingeben</h2>

					<div class="input-section">
						<div class="text-input-wrapper">
							<textarea
								bind:value={artikelText}
								placeholder="Artikel und Mengen eingeben (DE/HU/RU/RO)...

Beispiele:
• 10 Dreifachrahmen, 30 Steckdosen
• Tíz hármas keret (Ungarisch)
• Десять тройных рамок (Russisch)"
								rows="4"
							></textarea>

							<button
								class="btn btn-success process-btn"
								onclick={verarbeiteText}
								disabled={isProcessing || !artikelText.trim()}
								aria-busy={isProcessing}
							>
								{#if isProcessing}
									<span class="spinner" aria-hidden="true"></span>
									Verarbeite...
								{:else}
									KI-Erkennung
								{/if}
							</button>
						</div>

						{#if errorMessage}
							<div class="error-message" role="alert">{errorMessage}</div>
						{/if}

						{#if erkannteArtikel.length > 0}
							<div class="success-message" role="status">
								Erkannt: {erkannteArtikel.map(a => `${a.bezeichnung} (${a.menge}${a.artikel_id ? ' OK' : ''})`).join(', ')}
							</div>
						{/if}

						{#if unerkannteTexte.length > 0}
							<div class="warning-message" role="alert">
								Nicht erkannt: {unerkannteTexte.join(', ')}
							</div>
						{/if}
					</div>
				</section>

				<!-- Artikel-Tabelle -->
				<section class="section">
					<h2 class="section-title">
						Artikelkatalog
						{#if selectedHaendlerDetails}
							<span class="haendler-badge">{selectedHaendlerDetails.kurzname || selectedHaendlerDetails.name}</span>
						{/if}
					</h2>

					{#if isLoadingArtikel}
						<div class="loading-inline">
							<span class="spinner" aria-hidden="true"></span>
							Lade Artikel...
						</div>
					{:else if artikel.length === 0}
						<div class="empty-state">
							<p>Keine Artikel für diesen Lieferanten hinterlegt.</p>
							<small>Bitte wähle einen anderen Großhändler oder importiere Artikel.</small>
						</div>
					{:else}
						<!-- Suchfeld -->
						<div class="search-box">
							<svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
								<circle cx="11" cy="11" r="8"></circle>
								<path d="m21 21-4.35-4.35"></path>
							</svg>
							<input
								type="search"
								placeholder="Artikel suchen..."
								bind:value={suchbegriff}
								aria-label="Artikel durchsuchen"
							/>
							{#if suchbegriff}
								<button
									class="search-clear"
									onclick={() => suchbegriff = ''}
									aria-label="Suche löschen"
								>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M18 6 6 18M6 6l12 12"></path>
									</svg>
								</button>
							{/if}
						</div>

						<!-- MOBILE: Kompakte Filter-Dropdowns -->
						<div class="filter-mobile">
							<div class="filter-dropdowns">
								<select
									bind:value={selectedKategorie}
									onchange={() => { selectedUnterkategorie = null; selectedHersteller = null; }}
									aria-label="Gewerk filtern"
								>
									<option value={null}>Alle Gewerke</option>
									{#each verfuegbareKategorien as kat}
										<option value={kat}>{kat}</option>
									{/each}
								</select>

								<select
									bind:value={selectedUnterkategorie}
									onchange={() => { selectedHersteller = null; }}
									aria-label="Typ filtern"
									disabled={verfuegbareUnterkategorien.length === 0}
								>
									<option value={null}>Alle Typen</option>
									{#each verfuegbareUnterkategorien as unterkat}
										<option value={unterkat}>{unterkat}</option>
									{/each}
								</select>

								<select
									bind:value={selectedHersteller}
									aria-label="Hersteller filtern"
									disabled={verfuegbareHersteller.length === 0}
								>
									<option value={null}>Alle Hersteller</option>
									{#each verfuegbareHersteller as hersteller}
										<option value={hersteller}>{hersteller}</option>
									{/each}
								</select>
							</div>

							{#if filterBreadcrumb.length > 0}
								<button class="filter-reset-mobile" onclick={clearAllFilters}>
									Filter zurücksetzen
								</button>
							{/if}

							<div class="filter-count">
								{gefilterteArtikel.length} Artikel
							</div>
						</div>

						<!-- DESKTOP: Filter-Tags -->
						<div class="filter-desktop">
							<!-- Breadcrumb bei aktivem Filter -->
							{#if filterBreadcrumb.length > 0}
								<div class="filter-breadcrumb">
									<button
										class="breadcrumb-home"
										onclick={clearAllFilters}
										aria-label="Alle Filter löschen"
									>
										Alle
									</button>
									{#each filterBreadcrumb as crumb, i}
										<span class="breadcrumb-sep" aria-hidden="true">/</span>
										<span class="breadcrumb-item">{crumb}</span>
									{/each}
									<button
										class="breadcrumb-clear"
										onclick={clearAllFilters}
										aria-label="Filter zurücksetzen"
									>
										Zurücksetzen
									</button>
								</div>
							{/if}

							<!-- Gewerk-Filter -->
							<div class="filter-row">
								<span class="filter-label">Gewerk:</span>
								<div class="filter-tags" role="group" aria-label="Gewerk filtern">
									{#each verfuegbareKategorien as kat}
										<button
											type="button"
											class="filter-tag"
											class:active={selectedKategorie === kat}
											onclick={() => selectKategorie(kat)}
											aria-pressed={selectedKategorie === kat}
										>
											{kat}
										</button>
									{/each}
								</div>
							</div>

							<!-- Typ-Filter -->
							{#if verfuegbareUnterkategorien.length > 0}
								<div class="filter-row">
									<span class="filter-label">Typ:</span>
									<div class="filter-tags" role="group" aria-label="Typ filtern">
										{#each verfuegbareUnterkategorien as unterkat}
											<button
												type="button"
												class="filter-tag sub"
												class:active={selectedUnterkategorie === unterkat}
												onclick={() => selectUnterkategorie(unterkat)}
												aria-pressed={selectedUnterkategorie === unterkat}
											>
												{unterkat}
											</button>
										{/each}
									</div>
								</div>
							{/if}

							<!-- Hersteller-Filter -->
							{#if verfuegbareHersteller.length > 0}
								<div class="filter-row">
									<span class="filter-label">Hersteller:</span>
									<div class="filter-tags" role="group" aria-label="Hersteller filtern">
										{#each verfuegbareHersteller as hersteller}
											<button
												type="button"
												class="filter-tag hersteller"
												class:active={selectedHersteller === hersteller}
												onclick={() => selectHersteller(hersteller)}
												aria-pressed={selectedHersteller === hersteller}
											>
												{hersteller}
											</button>
										{/each}
									</div>
								</div>
							{/if}

							<div class="filter-info">
								{gefilterteArtikel.length} von {artikel.length} Artikel
							</div>
						</div>

						<div class="table-wrapper">
							<table class="artikel-table">
								<thead>
									<tr>
										<th class="th-fav" aria-label="Favoriten"></th>
										<th class="th-hersteller">Hersteller</th>
										<th>Bezeichnung</th>
										<th class="hide-mobile th-einheit">Einheit</th>
										<th class="hide-mobile th-preis">EK netto</th>
										<th class="text-center th-menge">Menge</th>
									</tr>
								</thead>
								<tbody>
									{#each gefilterteArtikel as art}
										{@const menge = bestellpositionen.get(art.id) || 0}
										{@const istFavorit = favoriten.has(art.id)}
										<tr class:highlight={menge > 0} class:favorit={istFavorit}>
											<td class="td-fav">
												<button
													type="button"
													class="favorit-btn"
													class:active={istFavorit}
													onclick={() => toggleFavorit(art.id)}
													aria-label={istFavorit ? 'Favorit entfernen' : 'Als Favorit markieren'}
													aria-pressed={istFavorit}
												>
													{istFavorit ? '★' : '☆'}
												</button>
											</td>
											<td class="td-hersteller">{art.hersteller || '-'}</td>
											<td>
												<button
													type="button"
													class="bezeichnung-toggle"
													onclick={() => toggleBezeichnung(art.id)}
													aria-expanded={expandedArtikel.has(art.id)}
												>
													<strong>{art.kurzbezeichnung || art.bezeichnung}</strong>
												</button>
												{#if expandedArtikel.has(art.id) && art.kurzbezeichnung && art.kurzbezeichnung !== art.bezeichnung}
													<div class="bezeichnung-full">{art.bezeichnung}</div>
												{/if}
												<!-- Mobile: Details unter Bezeichnung -->
												<div class="mobile-meta">
													{#if art.hersteller}<span class="mobile-hersteller">{art.hersteller}</span>{/if}
													<span>{art.einheit || 'Stk'}</span>
													{#if art.einkaufspreis}
														<span class="mobile-preis">{formatPreis(art.einkaufspreis)}</span>
													{/if}
												</div>
											</td>
											<td class="hide-mobile">{art.einheit || 'Stk'}</td>
											<td class="hide-mobile font-mono">{art.einkaufspreis ? formatPreis(art.einkaufspreis) : '-'}</td>
											<td>
												<div class="menge-controls">
													<button
														type="button"
														class="menge-btn minus"
														onclick={() => setzeMenge(art.id, Math.max(0, menge - 1))}
														disabled={menge === 0}
														aria-label="Menge verringern"
													>−</button>
													<input
														type="number"
														class="menge-input"
														class:filled={menge > 0}
														value={menge}
														min="0"
														onchange={(e) => setzeMengeDirekt(art.id, e)}
														onclick={(e) => (e.target as HTMLInputElement).select()}
														aria-label="Menge für {art.kurzbezeichnung || art.bezeichnung}"
													/>
													<button
														type="button"
														class="menge-btn plus"
														onclick={() => setzeMenge(art.id, menge + 1)}
														aria-label="Menge erhöhen"
													>+</button>
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</section>
			</div>

			<!-- Sticky Footer Actions -->
			<div class="footer-actions">
				<button class="btn btn-secondary">Zurück</button>
				<div class="total">
					<div class="total-label">Bestellsumme (netto)</div>
					<div class="total-value">{formatPreis(gesamtsumme)}</div>
					{#if warenkorbAnzahl > 0}
						<small class="total-count">{warenkorbAnzahl} Artikel</small>
					{/if}
				</div>
				<button class="btn btn-success" disabled={gesamtsumme === 0}>
					Weiter zur Bestätigung
				</button>
			</div>
		{/if}
	</main>
</div>

<style>
	.page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	/* Header */
	.header {
		background: white;
		color: var(--color-gray-900);
		padding: var(--spacing-4) var(--spacing-6);
		position: sticky;
		top: 0;
		z-index: 50;
		border-bottom: 1px solid var(--color-gray-200);
	}

	.header-content {
		max-width: var(--container-lg);
		margin: 0 auto;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.header h1 {
		color: var(--color-gray-900);
		font-size: var(--font-size-xl);
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: var(--spacing-4);
	}

	/* Warenkorb Toggle Button */
	.warenkorb-toggle {
		position: relative;
		background: var(--color-gray-100);
		border: 1px solid var(--color-gray-300);
		border-radius: var(--radius-md);
		padding: var(--spacing-2) var(--spacing-3);
		color: var(--color-gray-700);
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.warenkorb-toggle:hover {
		background: var(--color-gray-200);
	}

	.warenkorb-toggle.has-items {
		background: var(--color-brand-medium);
		border-color: var(--color-brand-medium);
		color: white;
	}

	.cart-icon {
		width: 24px;
		height: 24px;
	}

	.warenkorb-toggle .badge {
		position: absolute;
		top: -6px;
		right: -6px;
		background: var(--color-brand-medium);
		color: white;
		font-size: 11px;
		font-weight: var(--font-weight-bold);
		min-width: 20px;
		height: 20px;
		border-radius: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		font-size: var(--font-size-sm);
		color: var(--color-gray-600);
	}

	.avatar {
		width: 36px;
		height: 36px;
		background: var(--color-gray-200);
		border-radius: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-xs);
		color: var(--color-gray-700);
	}

	/* Warenkorb Drawer */
	.drawer-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: var(--z-modal-backdrop);
	}

	.warenkorb-drawer {
		position: fixed;
		top: 0;
		right: 0;
		width: 380px;
		max-width: 90vw;
		height: 100vh;
		background: white;
		box-shadow: var(--shadow-xl);
		z-index: var(--z-modal);
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
		color: var(--color-gray-700);
	}

	.drawer-close svg {
		width: 20px;
		height: 20px;
	}

	.drawer-empty {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-8);
		color: var(--color-gray-500);
		text-align: center;
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
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.drawer-item-info strong {
		font-size: var(--font-size-sm);
		display: block;
	}

	.drawer-item-info small {
		color: var(--color-gray-500);
		font-size: var(--font-size-xs);
	}

	.drawer-item-controls {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.mini-menge {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		background: var(--color-gray-100);
		border-radius: var(--radius-md);
		padding: 2px;
	}

	.mini-menge button {
		width: 28px;
		height: 28px;
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
	}

	.drawer-item-summe {
		font-weight: var(--font-weight-semibold);
		color: var(--color-gray-700);
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

	/* Main */
	.main {
		flex: 1;
		padding: var(--spacing-6);
		padding-bottom: 120px; /* Platz für Sticky Footer */
		max-width: var(--container-lg);
		margin: 0 auto;
		width: 100%;
	}

	.card {
		background: white;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
		overflow: hidden;
	}

	/* Sections */
	.section {
		padding: var(--spacing-6);
		border-bottom: 1px solid var(--color-gray-200);
	}

	.section:last-child {
		border-bottom: none;
	}

	.section-title {
		font-size: var(--font-size-base);
		color: var(--color-gray-800);
		margin-bottom: var(--spacing-4);
		padding-bottom: var(--spacing-3);
		border-bottom: 2px solid var(--color-gray-200);
	}

	/* Forms */
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

	.hint {
		color: var(--color-gray-500);
		font-size: var(--font-size-xs);
		margin-top: var(--spacing-1);
	}

	.hint.warning {
		color: var(--color-warning-dark);
	}

	/* Ansprechpartner Info */
	.ansprechpartner-info {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		margin-top: var(--spacing-2);
		padding: var(--spacing-2) var(--spacing-3);
		background: var(--color-success-light);
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
	}

	.ap-telefon {
		font-weight: var(--font-weight-semibold);
		color: var(--color-success-dark);
	}

	/* Input Section */
	.input-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.text-input-wrapper {
		display: flex;
		gap: var(--spacing-3);
		align-items: stretch;
	}

	.text-input-wrapper textarea {
		flex: 1;
		resize: none;
		min-height: 120px;
	}

	.process-btn {
		min-width: 140px;
		flex-direction: column;
		padding: var(--spacing-4);
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.error-message {
		background: var(--color-error-light);
		color: var(--color-error-dark);
		padding: var(--spacing-3);
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
	}

	.success-message {
		background: var(--color-success-light);
		color: var(--color-success-dark);
		padding: var(--spacing-3);
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
	}

	.warning-message {
		background: var(--color-warning-light);
		color: var(--color-warning-dark);
		padding: var(--spacing-3);
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
	}

	/* Händler Badge */
	.haendler-badge {
		display: inline-block;
		background: var(--color-brand-light);
		color: white;
		padding: var(--spacing-1) var(--spacing-3);
		border-radius: var(--radius-full);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-medium);
		margin-left: var(--spacing-2);
		vertical-align: middle;
	}

	/* NEU: Suchfeld */
	.search-box {
		position: relative;
		margin-bottom: var(--spacing-4);
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

	/* MOBILE Filter (Dropdowns) */
	.filter-mobile {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		margin-bottom: var(--spacing-4);
		padding: var(--spacing-3);
		background: var(--color-gray-50);
	}

	.filter-dropdowns {
		display: flex;
		gap: var(--spacing-2);
	}

	.filter-dropdowns select {
		flex: 1;
		min-width: 0;
		padding: var(--spacing-2) var(--spacing-3);
		font-size: var(--font-size-sm);
	}

	.filter-reset-mobile {
		background: none;
		border: none;
		color: var(--color-brand-medium);
		font-size: var(--font-size-xs);
		cursor: pointer;
		padding: var(--spacing-1) 0;
		text-align: left;
	}

	.filter-count {
		font-size: var(--font-size-xs);
		color: var(--color-gray-500);
	}

	/* DESKTOP Filter (Tags) */
	.filter-desktop {
		display: none;
		margin-bottom: var(--spacing-4);
		padding: var(--spacing-3);
		background: var(--color-gray-50);
	}

	/* Desktop: Tags anzeigen, Mobile: Dropdowns */
	@media (min-width: 768px) {
		.filter-mobile {
			display: none;
		}
		.filter-desktop {
			display: block;
		}
	}

	/* NEU: Filter Breadcrumb */
	.filter-breadcrumb {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding-bottom: var(--spacing-3);
		margin-bottom: var(--spacing-3);
		border-bottom: 1px solid var(--color-gray-200);
		font-size: var(--font-size-sm);
	}

	.breadcrumb-home {
		background: none;
		border: none;
		color: var(--color-brand-medium);
		cursor: pointer;
		padding: 0;
		font-size: inherit;
	}

	.breadcrumb-home:hover {
		text-decoration: underline;
	}

	.breadcrumb-sep {
		color: var(--color-gray-400);
	}

	.breadcrumb-item {
		color: var(--color-gray-700);
		font-weight: var(--font-weight-medium);
	}

	.breadcrumb-clear {
		margin-left: auto;
		background: none;
		border: none;
		color: var(--color-error);
		cursor: pointer;
		font-size: var(--font-size-xs);
		padding: var(--spacing-1) var(--spacing-2);
		border-radius: var(--radius-sm);
	}

	.breadcrumb-clear:hover {
		background: var(--color-error-light);
	}

	.filter-row {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-2);
		margin-bottom: var(--spacing-2);
	}

	.filter-row:last-of-type {
		margin-bottom: 0;
	}

	.filter-label {
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		color: var(--color-gray-600);
		min-width: 70px;
		padding-top: var(--spacing-1);
	}

	.filter-tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-1);
	}

	.filter-tag {
		display: inline-flex;
		align-items: center;
		padding: var(--spacing-1) var(--spacing-3);
		background: white;
		border: 1px solid var(--color-gray-300);
		border-radius: var(--radius-full);
		font-size: var(--font-size-xs);
		color: var(--color-gray-700);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.filter-tag:hover {
		border-color: var(--color-brand-medium);
		background: var(--color-info-light);
	}

	.filter-tag.active {
		background: var(--color-brand-medium);
		border-color: var(--color-brand-medium);
		color: white;
		font-weight: var(--font-weight-medium);
	}

	.filter-tag.sub {
		font-size: 11px;
		padding: 2px var(--spacing-2);
	}

	.filter-tag.hersteller {
		font-size: 11px;
		padding: 2px var(--spacing-2);
		background: var(--color-gray-100);
	}

	.filter-tag.hersteller.active {
		background: var(--color-gray-700);
		border-color: var(--color-gray-700);
	}

	.filter-info {
		margin-top: var(--spacing-2);
		font-size: var(--font-size-xs);
		color: var(--color-gray-500);
	}

	/* Favoriten */
	.th-fav, .td-fav {
		width: 40px;
		text-align: center;
		padding: var(--spacing-2) !important;
	}

	.favorit-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: var(--font-size-xl);
		color: var(--color-gray-300);
		padding: 0;
		line-height: 1;
		transition: color 0.15s ease, transform 0.15s ease;
	}

	.favorit-btn:hover {
		color: var(--color-warning);
		transform: scale(1.2);
	}

	.favorit-btn.active {
		color: var(--color-warning);
	}

	tr.favorit {
		background: linear-gradient(90deg, rgba(255, 193, 7, 0.1) 0%, transparent 10%);
	}

	tr.favorit.highlight {
		background: linear-gradient(90deg, rgba(255, 193, 7, 0.15) 0%, var(--color-success-light) 10%);
	}

	/* Spaltenbreiten */
	.th-hersteller, .td-hersteller {
		width: 100px;
		font-size: var(--font-size-xs);
		color: var(--color-gray-600);
	}

	.th-einheit {
		width: 60px;
	}

	.th-preis {
		width: 80px;
	}

	.th-menge {
		width: 130px;
	}

	.mobile-hersteller {
		font-weight: var(--font-weight-medium);
		color: var(--color-gray-700);
	}

	/* Loading inline */
	.loading-inline {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-4);
		color: var(--color-gray-500);
	}

	/* Empty state */
	.empty-state {
		text-align: center;
		padding: var(--spacing-8);
		color: var(--color-gray-500);
	}

	.empty-state p {
		margin-bottom: var(--spacing-2);
	}

	/* Table */
	.table-wrapper {
		overflow-x: auto;
	}

	.artikel-table {
		width: 100%;
		border-collapse: collapse;
	}

	.artikel-table th {
		background: var(--color-gray-50);
		padding: var(--spacing-3) var(--spacing-4);
		text-align: left;
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		color: var(--color-gray-600);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		border-bottom: 2px solid var(--color-gray-200);
	}

	.artikel-table td {
		padding: var(--spacing-3) var(--spacing-4);
		border-bottom: 1px solid var(--color-gray-200);
		font-size: var(--font-size-sm);
	}

	.artikel-table tr.highlight {
		background: var(--color-success-light);
	}

	/* Bezeichnung Toggle */
	.bezeichnung-toggle {
		background: none;
		border: none;
		padding: 0;
		text-align: left;
		cursor: pointer;
		color: inherit;
		font-size: inherit;
	}

	.bezeichnung-toggle:hover strong {
		color: var(--color-brand-medium);
		text-decoration: underline;
	}

	.bezeichnung-full {
		font-size: var(--font-size-xs);
		color: var(--color-gray-500);
		margin-top: var(--spacing-1);
		padding-left: var(--spacing-2);
		border-left: 2px solid var(--color-gray-300);
	}

	/* Menge Controls */
	.menge-controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-1);
	}

	.menge-btn {
		width: 36px;
		height: 36px;
		border-radius: var(--radius-md);
		border: 2px solid var(--color-gray-300);
		background: white;
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-bold);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
		flex-shrink: 0;
	}

	.menge-btn:hover:not(:disabled) {
		border-color: var(--color-brand-medium);
		background: var(--color-info-light);
	}

	.menge-btn:active:not(:disabled) {
		transform: scale(0.95);
	}

	.menge-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.menge-btn.minus {
		color: var(--color-error);
	}

	.menge-btn.plus {
		color: var(--color-success);
	}

	.menge-input {
		width: 50px;
		height: 36px;
		text-align: center;
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-semibold);
		color: var(--color-gray-600);
		border: 2px solid var(--color-gray-200);
		border-radius: var(--radius-md);
		padding: 0;
		appearance: textfield;
		-moz-appearance: textfield;
	}

	.menge-input::-webkit-outer-spin-button,
	.menge-input::-webkit-inner-spin-button {
		appearance: none;
		-webkit-appearance: none;
		margin: 0;
	}

	.menge-input:focus {
		outline: none;
		border-color: var(--color-brand-medium);
		background: var(--color-info-light);
	}

	.menge-input.filled {
		color: var(--color-success-dark);
		border-color: var(--color-success);
		background: var(--color-success-light);
		font-weight: var(--font-weight-bold);
	}

	/* Mobile Meta (unter Bezeichnung auf kleinen Screens) */
	.mobile-meta {
		display: none;
	}

	/* NEU: Sticky Footer */
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

	.total {
		text-align: center;
	}

	.total-label {
		font-size: var(--font-size-xs);
		color: var(--color-gray-500);
	}

	.total-value {
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-bold);
		color: var(--color-gray-900);
	}

	.total-count {
		color: var(--color-gray-500);
		font-size: var(--font-size-xs);
	}

	/* Mobile */
	@media (max-width: 767px) {
		.header-content {
			flex-direction: row;
			justify-content: space-between;
		}

		.header h1 {
			font-size: var(--font-size-lg);
		}

		.user-info span {
			display: none;
		}

		.main {
			padding: var(--spacing-3);
			padding-bottom: 140px;
		}

		.section {
			padding: var(--spacing-4);
		}

		.section-title {
			font-size: var(--font-size-sm);
		}

		.form-grid {
			grid-template-columns: 1fr;
			gap: var(--spacing-3);
		}

		.text-input-wrapper {
			flex-direction: column;
		}

		.text-input-wrapper textarea {
			min-height: 80px;
			font-size: var(--font-size-sm);
		}

		.process-btn {
			width: 100%;
			padding: var(--spacing-3);
		}

		/* Kompakte Tabelle für Mobile */
		.artikel-table {
			font-size: var(--font-size-xs);
		}

		.artikel-table th,
		.artikel-table td {
			padding: var(--spacing-2);
		}

		.artikel-table thead {
			display: none;
		}

		.artikel-table tr {
			display: flex;
			flex-wrap: wrap;
			padding: var(--spacing-2) 0;
			border-bottom: 1px solid var(--color-gray-200);
		}

		.artikel-table td {
			border: none;
			padding: var(--spacing-1) var(--spacing-2);
		}

		.td-fav {
			order: 1;
			width: auto;
		}

		.td-hersteller {
			display: none;
		}

		.artikel-table td:nth-child(3) {
			order: 2;
			flex: 1;
			min-width: 0;
		}

		.artikel-table td:nth-child(4),
		.artikel-table td:nth-child(5) {
			display: none;
		}

		.artikel-table td:nth-child(6) {
			order: 3;
			width: auto;
		}

		.mobile-meta {
			display: flex;
			gap: var(--spacing-2);
			font-size: 10px;
			color: var(--color-gray-500);
			margin-top: 2px;
		}

		.mobile-preis {
			font-weight: var(--font-weight-medium);
			color: var(--color-gray-700);
		}

		/* Kompakte Menge-Controls */
		.menge-controls {
			gap: 2px;
		}

		.menge-btn {
			width: 28px;
			height: 28px;
			font-size: var(--font-size-sm);
		}

		.menge-input {
			width: 36px;
			height: 28px;
			font-size: var(--font-size-xs);
		}

		.favorit-btn {
			font-size: var(--font-size-base);
		}

		/* Sticky Footer Mobile */
		.footer-actions {
			flex-direction: column;
			gap: var(--spacing-2);
			padding: var(--spacing-3);
		}

		.footer-actions .btn {
			width: 100%;
			padding: var(--spacing-3);
		}

		.total {
			display: flex;
			justify-content: space-between;
			align-items: center;
			width: 100%;
		}

		.total-label {
			font-size: var(--font-size-xs);
		}

		.total-value {
			font-size: var(--font-size-xl);
		}

		/* Drawer Fullscreen Mobile */
		.warenkorb-drawer {
			width: 100%;
			max-width: none;
		}

		/* Suchfeld kompakter */
		.search-box input {
			font-size: var(--font-size-sm);
			padding: var(--spacing-2) var(--spacing-3);
			padding-left: 36px;
		}

		.search-icon {
			width: 16px;
			height: 16px;
			left: 10px;
		}

		/* Ansprechpartner-Info kompakter */
		.ansprechpartner-info {
			padding: var(--spacing-2);
			font-size: var(--font-size-xs);
		}
	}

	/* Tablet */
	@media (min-width: 768px) and (max-width: 1023px) {
		.form-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	/* Desktop - hide-mobile Klasse */
	@media (max-width: 767px) {
		.hide-mobile {
			display: none !important;
		}
	}
</style>
