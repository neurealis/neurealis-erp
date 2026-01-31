<script lang="ts">
	import { Card, Badge, Button } from '$lib/components/ui';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';

	// Types
	interface Kontakt {
		id: string;
		kontakt_nr: number;
		kontaktarten: string[];
		anrede: string | null;
		titel: string | null;
		vorname: string | null;
		nachname: string | null;
		firma_kurz: string | null;
		firma_lang: string | null;
		position: string | null;
		email: string | null;
		telefon_mobil: string | null;
		telefon_festnetz: string | null;
		strasse: string | null;
		plz: string | null;
		ort: string | null;
		notizen: string | null;
		aktiv: boolean;
		sync_source: string | null;
		created_at: string | null;
		updated_at: string | null;
	}

	interface KontaktFormData {
		anrede: string;
		titel: string;
		vorname: string;
		nachname: string;
		firma_kurz: string;
		firma_lang: string;
		position: string;
		kontaktarten: string[];
		email: string;
		telefon_mobil: string;
		telefon_festnetz: string;
		strasse: string;
		plz: string;
		ort: string;
		notizen: string;
	}

	// State
	let kontakte = $state<Kontakt[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Filter-State
	let searchQuery = $state('');
	let selectedTyp = $state<string | null>(null);
	let viewMode = $state<'cards' | 'table'>('cards');
	let sortierung = $state<'name_asc' | 'name_desc' | 'nr_asc' | 'nr_desc'>('name_asc');

	// Modal-State
	let showModal = $state(false);
	let modalMode = $state<'create' | 'edit'>('create');
	let editingKontakt = $state<Kontakt | null>(null);
	let formData = $state<KontaktFormData>(getEmptyFormData());
	let formErrors = $state<Record<string, string>>({});
	let saving = $state(false);

	// Delete-Bestätigung
	let showDeleteConfirm = $state(false);
	let deletingKontakt = $state<Kontakt | null>(null);
	let deleting = $state(false);

	// Kontaktarten-Mapping
	const KONTAKTARTEN_LABELS: Record<string, string> = {
		kunde_privat: 'Privatkunde',
		kunde_gewerblich: 'Gewerbekunde',
		lead: 'Lead',
		mitarbeiter: 'Mitarbeiter',
		mitarbeiter_baustelle: 'Baustellen-MA',
		bewerber: 'Bewerber',
		nachunternehmer: 'Nachunternehmer',
		nu_mitarbeiter: 'NU-Mitarbeiter',
		partner: 'Partner',
		lieferant: 'Lieferant',
		ansprechpartner: 'Ansprechpartner',
		eigentuemer: 'Eigentümer',
		hausverwaltung: 'Hausverwaltung',
		behoerde: 'Behörde'
	};

	// Farben für Kontaktarten
	const KONTAKTARTEN_COLORS: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
		kunde_privat: 'success',
		kunde_gewerblich: 'success',
		lead: 'warning',
		mitarbeiter: 'default',
		nachunternehmer: 'warning',
		lieferant: 'default',
		ansprechpartner: 'default'
	};

	// Anrede-Optionen
	const ANREDE_OPTIONS = ['Herr', 'Frau', 'Firma', 'Dr.', 'Prof.'];

	// Leeres Formular
	function getEmptyFormData(): KontaktFormData {
		return {
			anrede: '',
			titel: '',
			vorname: '',
			nachname: '',
			firma_kurz: '',
			firma_lang: '',
			position: '',
			kontaktarten: [],
			email: '',
			telefon_mobil: '',
			telefon_festnetz: '',
			strasse: '',
			plz: '',
			ort: '',
			notizen: ''
		};
	}

	// Statistiken
	let stats = $derived(() => {
		const kunden = kontakte.filter(k =>
			k.kontaktarten.includes('kunde_privat') || k.kontaktarten.includes('kunde_gewerblich')
		).length;
		const nachunternehmer = kontakte.filter(k =>
			k.kontaktarten.includes('nachunternehmer')
		).length;
		const lieferanten = kontakte.filter(k =>
			k.kontaktarten.includes('lieferant')
		).length;
		const leads = kontakte.filter(k =>
			k.kontaktarten.includes('lead')
		).length;

		return {
			gesamt: kontakte.length,
			kunden,
			nachunternehmer,
			lieferanten,
			leads
		};
	});

	// Alle Typen aus den Daten extrahieren
	let alleTypen = $derived(() => {
		const typen = new Set<string>();
		kontakte.forEach(k => k.kontaktarten.forEach(t => typen.add(t)));
		return [...typen].sort();
	});

	// Gefilterte Kontakte
	let filteredKontakte = $derived(() => {
		let result = kontakte.filter(k => {
			// Textsuche
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				const anzeigename = getAnzeigename(k).toLowerCase();
				const match =
					anzeigename.includes(query) ||
					(k.email?.toLowerCase() || '').includes(query) ||
					(k.telefon_mobil?.toLowerCase() || '').includes(query) ||
					(k.telefon_festnetz?.toLowerCase() || '').includes(query) ||
					(k.firma_kurz?.toLowerCase() || '').includes(query) ||
					(k.ort?.toLowerCase() || '').includes(query) ||
					`K-${String(k.kontakt_nr).padStart(4, '0')}`.toLowerCase().includes(query);
				if (!match) return false;
			}

			// Typ-Filter
			if (selectedTyp && !k.kontaktarten.includes(selectedTyp)) {
				return false;
			}

			return true;
		});

		// Sortierung
		result.sort((a, b) => {
			if (sortierung === 'name_asc') {
				return getAnzeigename(a).localeCompare(getAnzeigename(b), 'de');
			} else if (sortierung === 'name_desc') {
				return getAnzeigename(b).localeCompare(getAnzeigename(a), 'de');
			} else if (sortierung === 'nr_asc') {
				return a.kontakt_nr - b.kontakt_nr;
			} else if (sortierung === 'nr_desc') {
				return b.kontakt_nr - a.kontakt_nr;
			}
			return 0;
		});

		return result;
	});

	// Anzeigename generieren
	function getAnzeigename(kontakt: Kontakt): string {
		if (kontakt.firma_kurz) {
			return kontakt.firma_kurz;
		}
		const teile = [];
		if (kontakt.anrede && kontakt.anrede !== 'Firma') teile.push(kontakt.anrede);
		if (kontakt.titel) teile.push(kontakt.titel);
		if (kontakt.vorname) teile.push(kontakt.vorname);
		if (kontakt.nachname) teile.push(kontakt.nachname);
		return teile.join(' ') || 'Unbenannt';
	}

	// Kontakt-Nummer formatieren
	function formatKontaktNr(nr: number): string {
		return `K-${String(nr).padStart(4, '0')}`;
	}

	// Primäre Telefonnummer
	function getPrimaryPhone(kontakt: Kontakt): string | null {
		return kontakt.telefon_mobil || kontakt.telefon_festnetz || null;
	}

	// Adresse formatieren
	function formatAdresse(kontakt: Kontakt): string {
		const teile = [];
		if (kontakt.strasse) teile.push(kontakt.strasse);
		if (kontakt.plz || kontakt.ort) {
			teile.push([kontakt.plz, kontakt.ort].filter(Boolean).join(' '));
		}
		return teile.join(', ') || '-';
	}

	// Badge-Variante für Kontaktart
	function getKontaktartVariant(typ: string): 'success' | 'warning' | 'error' | 'default' {
		return KONTAKTARTEN_COLORS[typ] || 'default';
	}

	// Kontaktart-Label
	function getKontaktartLabel(typ: string): string {
		return KONTAKTARTEN_LABELS[typ] || typ;
	}

	// Daten laden
	async function loadKontakte() {
		loading = true;
		error = null;

		const { data, error: fetchError } = await supabase
			.from('kontakte')
			.select(`
				id,
				kontakt_nr,
				kontaktarten,
				anrede,
				titel,
				vorname,
				nachname,
				firma_kurz,
				firma_lang,
				position,
				email,
				telefon_mobil,
				telefon_festnetz,
				strasse,
				plz,
				ort,
				notizen,
				aktiv,
				sync_source,
				created_at,
				updated_at
			`)
			.eq('aktiv', true)
			.order('nachname', { ascending: true });

		if (fetchError) {
			error = fetchError.message;
			console.error('Fehler beim Laden der Kontakte:', fetchError);
		} else {
			kontakte = data || [];
		}

		loading = false;
	}

	onMount(() => {
		loadKontakte();
	});

	function clearFilters() {
		searchQuery = '';
		selectedTyp = null;
	}

	// Sync-Quelle als Icon
	function getSyncIcon(source: string | null): string {
		switch (source) {
			case 'hero': return 'H';
			case 'monday': return 'M';
			case 'ms365': return 'O';
			case 'manual': return 'N';
			default: return '';
		}
	}

	// ==================== CRUD Funktionen ====================

	// Modal öffnen für Neuen Kontakt
	function openCreateModal() {
		modalMode = 'create';
		editingKontakt = null;
		formData = getEmptyFormData();
		formErrors = {};
		showModal = true;
	}

	// Modal öffnen für Bearbeiten
	function openEditModal(kontakt: Kontakt) {
		modalMode = 'edit';
		editingKontakt = kontakt;
		formData = {
			anrede: kontakt.anrede || '',
			titel: kontakt.titel || '',
			vorname: kontakt.vorname || '',
			nachname: kontakt.nachname || '',
			firma_kurz: kontakt.firma_kurz || '',
			firma_lang: kontakt.firma_lang || '',
			position: kontakt.position || '',
			kontaktarten: [...(kontakt.kontaktarten || [])],
			email: kontakt.email || '',
			telefon_mobil: kontakt.telefon_mobil || '',
			telefon_festnetz: kontakt.telefon_festnetz || '',
			strasse: kontakt.strasse || '',
			plz: kontakt.plz || '',
			ort: kontakt.ort || '',
			notizen: kontakt.notizen || ''
		};
		formErrors = {};
		showModal = true;
	}

	// Modal schließen
	function closeModal() {
		showModal = false;
		editingKontakt = null;
		formErrors = {};
	}

	// E-Mail validieren
	function isValidEmail(email: string): boolean {
		if (!email) return true; // Optional
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	}

	// Formular validieren
	function validateForm(): boolean {
		const errors: Record<string, string> = {};

		// Mindestens Name oder Firma
		const hasName = formData.vorname.trim() || formData.nachname.trim();
		const hasFirma = formData.firma_kurz.trim();

		if (!hasName && !hasFirma) {
			errors.name = 'Mindestens Name oder Firma ist erforderlich';
		}

		// E-Mail Format
		if (formData.email && !isValidEmail(formData.email)) {
			errors.email = 'Ungültiges E-Mail-Format';
		}

		formErrors = errors;
		return Object.keys(errors).length === 0;
	}

	// Kontakt speichern (Create/Update)
	async function saveKontakt() {
		if (!validateForm()) return;

		saving = true;
		error = null;

		const kontaktData = {
			anrede: formData.anrede || null,
			titel: formData.titel || null,
			vorname: formData.vorname || null,
			nachname: formData.nachname || null,
			firma_kurz: formData.firma_kurz || null,
			firma_lang: formData.firma_lang || null,
			position: formData.position || null,
			kontaktarten: formData.kontaktarten.length > 0 ? formData.kontaktarten : [],
			email: formData.email || null,
			telefon_mobil: formData.telefon_mobil || null,
			telefon_festnetz: formData.telefon_festnetz || null,
			strasse: formData.strasse || null,
			plz: formData.plz || null,
			ort: formData.ort || null,
			notizen: formData.notizen || null,
			sync_source: 'manual',
			updated_at: new Date().toISOString()
		};

		try {
			if (modalMode === 'create') {
				const { error: insertError } = await supabase
					.from('kontakte')
					.insert([{ ...kontaktData, aktiv: true }]);

				if (insertError) throw insertError;
			} else if (editingKontakt) {
				const { error: updateError } = await supabase
					.from('kontakte')
					.update(kontaktData)
					.eq('id', editingKontakt.id);

				if (updateError) throw updateError;
			}

			closeModal();
			await loadKontakte();
		} catch (err: any) {
			error = err.message || 'Fehler beim Speichern';
			console.error('Speicherfehler:', err);
		} finally {
			saving = false;
		}
	}

	// Löschen-Bestätigung öffnen
	function openDeleteConfirm(kontakt: Kontakt, event: Event) {
		event.stopPropagation();
		deletingKontakt = kontakt;
		showDeleteConfirm = true;
	}

	// Löschen-Bestätigung schließen
	function closeDeleteConfirm() {
		showDeleteConfirm = false;
		deletingKontakt = null;
	}

	// Kontakt löschen (Soft-Delete: aktiv = false)
	async function deleteKontakt() {
		if (!deletingKontakt) return;

		deleting = true;
		error = null;

		try {
			const { error: deleteError } = await supabase
				.from('kontakte')
				.update({ aktiv: false, updated_at: new Date().toISOString() })
				.eq('id', deletingKontakt.id);

			if (deleteError) throw deleteError;

			closeDeleteConfirm();
			await loadKontakte();
		} catch (err: any) {
			error = err.message || 'Fehler beim Löschen';
			console.error('Löschfehler:', err);
		} finally {
			deleting = false;
		}
	}

	// Kontaktart toggle
	function toggleKontaktart(art: string) {
		if (formData.kontaktarten.includes(art)) {
			formData.kontaktarten = formData.kontaktarten.filter(k => k !== art);
		} else {
			formData.kontaktarten = [...formData.kontaktarten, art];
		}
	}
</script>

<div class="kontakte-page">
	<header class="page-header">
		<div class="header-content">
			<h1>Kontakte</h1>
			<p class="subtitle">
				{#if loading}
					Lade Kontakte...
				{:else}
					{filteredKontakte().length} von {stats().gesamt} Kontakten
				{/if}
			</p>
		</div>
		<div class="header-actions">
			<button class="primary-btn" onclick={openCreateModal}>
				+ Neuer Kontakt
			</button>
			<button class="refresh-btn" onclick={loadKontakte} disabled={loading}>
				{loading ? 'Laedt...' : 'Aktualisieren'}
			</button>
			<div class="view-toggle">
				<button
					class="toggle-btn"
					class:active={viewMode === 'cards'}
					onclick={() => viewMode = 'cards'}
					title="Kartenansicht"
				>
					&#9638;&#9638;
				</button>
				<button
					class="toggle-btn"
					class:active={viewMode === 'table'}
					onclick={() => viewMode = 'table'}
					title="Tabellenansicht"
				>
					&#9776;
				</button>
			</div>
		</div>
	</header>

	{#if error}
		<Card padding="md">
			<div class="error-message">
				<strong>Fehler:</strong> {error}
				<button onclick={loadKontakte}>Erneut versuchen</button>
			</div>
		</Card>
	{/if}

	<!-- Statistik-Karten -->
	<div class="stats-row">
		<button
			class="stat-card"
			class:active={selectedTyp === 'kunde_privat' || selectedTyp === 'kunde_gewerblich'}
			onclick={() => selectedTyp = selectedTyp === 'kunde_privat' ? null : 'kunde_privat'}
		>
			<span class="stat-value success">{stats().kunden}</span>
			<span class="stat-label">Kunden</span>
		</button>
		<button
			class="stat-card"
			class:active={selectedTyp === 'nachunternehmer'}
			onclick={() => selectedTyp = selectedTyp === 'nachunternehmer' ? null : 'nachunternehmer'}
		>
			<span class="stat-value warning">{stats().nachunternehmer}</span>
			<span class="stat-label">Nachunternehmer</span>
		</button>
		<button
			class="stat-card"
			class:active={selectedTyp === 'lieferant'}
			onclick={() => selectedTyp = selectedTyp === 'lieferant' ? null : 'lieferant'}
		>
			<span class="stat-value default">{stats().lieferanten}</span>
			<span class="stat-label">Lieferanten</span>
		</button>
		<button
			class="stat-card"
			class:active={selectedTyp === 'lead'}
			onclick={() => selectedTyp = selectedTyp === 'lead' ? null : 'lead'}
		>
			<span class="stat-value info">{stats().leads}</span>
			<span class="stat-label">Leads</span>
		</button>
	</div>

	<!-- Filter -->
	<Card padding="sm">
		<div class="filters">
			<div class="search-box">
				<span class="search-icon">&#128269;</span>
				<input
					type="search"
					placeholder="Name, E-Mail, Telefon oder Kontakt-Nr. suchen..."
					bind:value={searchQuery}
					class="search-input"
				/>
			</div>

			<select bind:value={selectedTyp} class="filter-select">
				<option value={null}>Alle Typen</option>
				{#each alleTypen() as typ}
					<option value={typ}>{getKontaktartLabel(typ)}</option>
				{/each}
			</select>

			<select bind:value={sortierung} class="filter-select">
				<option value="name_asc">Name A-Z</option>
				<option value="name_desc">Name Z-A</option>
				<option value="nr_asc">Kontakt-Nr. aufsteigend</option>
				<option value="nr_desc">Kontakt-Nr. absteigend</option>
			</select>

			{#if searchQuery || selectedTyp}
				<button class="clear-btn" onclick={clearFilters}>
					Filter zuruecksetzen
				</button>
			{/if}
		</div>
	</Card>

	<!-- Kontakte-Liste -->
	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Lade Kontakte aus Supabase...</p>
		</div>
	{:else if viewMode === 'cards'}
		<div class="kontakte-grid">
			{#each filteredKontakte() as kontakt}
				<div class="kontakt-card" onclick={() => openEditModal(kontakt)} role="button" tabindex="0" onkeypress={(e) => e.key === 'Enter' && openEditModal(kontakt)}>
					<div class="card-header">
						<div class="header-left">
							<span class="kontakt-nr">{formatKontaktNr(kontakt.kontakt_nr)}</span>
							{#if kontakt.sync_source}
								<span class="sync-badge" title="Quelle: {kontakt.sync_source}">
									{getSyncIcon(kontakt.sync_source)}
								</span>
							{/if}
						</div>
						<div class="kontaktarten">
							{#each kontakt.kontaktarten.slice(0, 2) as typ}
								<Badge variant={getKontaktartVariant(typ)} size="sm">
									{getKontaktartLabel(typ)}
								</Badge>
							{/each}
							{#if kontakt.kontaktarten.length > 2}
								<Badge variant="default" size="sm">+{kontakt.kontaktarten.length - 2}</Badge>
							{/if}
						</div>
					</div>

					<div class="card-body">
						<h3 class="kontakt-name">{getAnzeigename(kontakt)}</h3>
						{#if kontakt.position}
							<span class="kontakt-position">{kontakt.position}</span>
						{/if}

						<div class="kontakt-details">
							{#if kontakt.email}
								<div class="detail-item">
									<span class="detail-icon">&#9993;</span>
									<a href="mailto:{kontakt.email}" class="detail-link" onclick={(e) => e.stopPropagation()}>{kontakt.email}</a>
								</div>
							{/if}
							{#if getPrimaryPhone(kontakt)}
								<div class="detail-item">
									<span class="detail-icon">&#9742;</span>
									<a href="tel:{getPrimaryPhone(kontakt)}" class="detail-link" onclick={(e) => e.stopPropagation()}>{getPrimaryPhone(kontakt)}</a>
								</div>
							{/if}
							{#if kontakt.strasse || kontakt.ort}
								<div class="detail-item">
									<span class="detail-icon">&#9906;</span>
									<span class="detail-text">{formatAdresse(kontakt)}</span>
								</div>
							{/if}
						</div>
					</div>

					<div class="card-actions">
						<button class="action-btn edit-btn" onclick={(e) => { e.stopPropagation(); openEditModal(kontakt); }} title="Bearbeiten">
							&#9998;
						</button>
						<button class="action-btn delete-btn" onclick={(e) => openDeleteConfirm(kontakt, e)} title="Löschen">
							&#128465;
						</button>
					</div>
				</div>
			{/each}

			{#if filteredKontakte().length === 0}
				<div class="empty-state">
					{#if kontakte.length === 0}
						<p>Noch keine Kontakte vorhanden</p>
						<button class="primary-btn" onclick={openCreateModal}>Ersten Kontakt anlegen</button>
					{:else}
						<p>Keine Kontakte gefunden</p>
						<button onclick={clearFilters}>Filter zuruecksetzen</button>
					{/if}
				</div>
			{/if}
		</div>
	{:else}
		<!-- Tabellenansicht -->
		<div class="table-container">
			<table class="kontakte-table">
				<thead>
					<tr>
						<th>Nr.</th>
						<th>Name</th>
						<th>Typ</th>
						<th>E-Mail</th>
						<th>Telefon</th>
						<th>Ort</th>
						<th>Aktionen</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredKontakte() as kontakt}
						<tr onclick={() => openEditModal(kontakt)} class="clickable-row">
							<td class="td-nr">{formatKontaktNr(kontakt.kontakt_nr)}</td>
							<td class="td-name">
								<span class="name-primary">{getAnzeigename(kontakt)}</span>
								{#if kontakt.position}
									<span class="name-secondary">{kontakt.position}</span>
								{/if}
							</td>
							<td class="td-typ">
								{#each kontakt.kontaktarten.slice(0, 1) as typ}
									<Badge variant={getKontaktartVariant(typ)} size="sm">
										{getKontaktartLabel(typ)}
									</Badge>
								{/each}
							</td>
							<td class="td-email">
								{#if kontakt.email}
									<a href="mailto:{kontakt.email}" onclick={(e) => e.stopPropagation()}>{kontakt.email}</a>
								{:else}
									-
								{/if}
							</td>
							<td class="td-phone">
								{#if getPrimaryPhone(kontakt)}
									<a href="tel:{getPrimaryPhone(kontakt)}" onclick={(e) => e.stopPropagation()}>{getPrimaryPhone(kontakt)}</a>
								{:else}
									-
								{/if}
							</td>
							<td class="td-ort">{kontakt.ort || '-'}</td>
							<td class="td-actions">
								<button class="action-btn edit-btn" onclick={(e) => { e.stopPropagation(); openEditModal(kontakt); }} title="Bearbeiten">
									&#9998;
								</button>
								<button class="action-btn delete-btn" onclick={(e) => openDeleteConfirm(kontakt, e)} title="Löschen">
									&#128465;
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			{#if filteredKontakte().length === 0}
				<div class="empty-state">
					{#if kontakte.length === 0}
						<p>Noch keine Kontakte vorhanden</p>
						<button class="primary-btn" onclick={openCreateModal}>Ersten Kontakt anlegen</button>
					{:else}
						<p>Keine Kontakte gefunden</p>
						<button onclick={clearFilters}>Filter zuruecksetzen</button>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Create/Edit Modal -->
{#if showModal}
	<div class="modal-overlay" onclick={closeModal} role="dialog" aria-modal="true">
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>{modalMode === 'create' ? 'Neuer Kontakt' : 'Kontakt bearbeiten'}</h2>
				<button class="close-btn" onclick={closeModal} aria-label="Schließen">&times;</button>
			</div>

			<form class="modal-body" onsubmit={(e) => { e.preventDefault(); saveKontakt(); }}>
				{#if formErrors.name}
					<div class="form-error global-error">{formErrors.name}</div>
				{/if}

				<div class="form-section">
					<h3>Persönliche Daten</h3>

					<div class="form-row">
						<div class="form-group">
							<label for="anrede">Anrede</label>
							<select id="anrede" bind:value={formData.anrede}>
								<option value="">-- Bitte wählen --</option>
								{#each ANREDE_OPTIONS as option}
									<option value={option}>{option}</option>
								{/each}
							</select>
						</div>
						<div class="form-group">
							<label for="titel">Titel</label>
							<input type="text" id="titel" bind:value={formData.titel} placeholder="z.B. Dr., Prof.">
						</div>
					</div>

					<div class="form-row">
						<div class="form-group">
							<label for="vorname">Vorname</label>
							<input type="text" id="vorname" bind:value={formData.vorname} placeholder="Vorname">
						</div>
						<div class="form-group">
							<label for="nachname">Nachname</label>
							<input type="text" id="nachname" bind:value={formData.nachname} placeholder="Nachname">
						</div>
					</div>

					<div class="form-row">
						<div class="form-group">
							<label for="firma_kurz">Firma (Kurzname)</label>
							<input type="text" id="firma_kurz" bind:value={formData.firma_kurz} placeholder="Firmenname">
						</div>
						<div class="form-group">
							<label for="position">Position</label>
							<input type="text" id="position" bind:value={formData.position} placeholder="z.B. Geschäftsführer">
						</div>
					</div>
				</div>

				<div class="form-section">
					<h3>Kontaktart</h3>
					<div class="kontaktarten-grid">
						{#each Object.entries(KONTAKTARTEN_LABELS) as [key, label]}
							<label class="kontaktart-checkbox" class:checked={formData.kontaktarten.includes(key)}>
								<input
									type="checkbox"
									checked={formData.kontaktarten.includes(key)}
									onchange={() => toggleKontaktart(key)}
								>
								<span class="checkmark"></span>
								{label}
							</label>
						{/each}
					</div>
				</div>

				<div class="form-section">
					<h3>Kontaktdaten</h3>

					<div class="form-group full-width">
						<label for="email">E-Mail</label>
						<input
							type="email"
							id="email"
							bind:value={formData.email}
							placeholder="email@beispiel.de"
							class:error={formErrors.email}
						>
						{#if formErrors.email}
							<span class="field-error">{formErrors.email}</span>
						{/if}
					</div>

					<div class="form-row">
						<div class="form-group">
							<label for="telefon_mobil">Mobil</label>
							<input type="tel" id="telefon_mobil" bind:value={formData.telefon_mobil} placeholder="+49 171 1234567">
						</div>
						<div class="form-group">
							<label for="telefon_festnetz">Festnetz</label>
							<input type="tel" id="telefon_festnetz" bind:value={formData.telefon_festnetz} placeholder="+49 30 1234567">
						</div>
					</div>
				</div>

				<div class="form-section">
					<h3>Adresse</h3>

					<div class="form-group full-width">
						<label for="strasse">Straße / Hausnummer</label>
						<input type="text" id="strasse" bind:value={formData.strasse} placeholder="Musterstraße 123">
					</div>

					<div class="form-row">
						<div class="form-group small">
							<label for="plz">PLZ</label>
							<input type="text" id="plz" bind:value={formData.plz} placeholder="12345">
						</div>
						<div class="form-group">
							<label for="ort">Ort</label>
							<input type="text" id="ort" bind:value={formData.ort} placeholder="Berlin">
						</div>
					</div>
				</div>

				<div class="form-section">
					<h3>Notizen</h3>
					<div class="form-group full-width">
						<textarea
							id="notizen"
							bind:value={formData.notizen}
							placeholder="Zusätzliche Notizen..."
							rows="3"
						></textarea>
					</div>
				</div>

				<div class="modal-footer">
					<button type="button" class="cancel-btn" onclick={closeModal} disabled={saving}>
						Abbrechen
					</button>
					<button type="submit" class="save-btn" disabled={saving}>
						{#if saving}
							Speichern...
						{:else}
							{modalMode === 'create' ? 'Kontakt anlegen' : 'Speichern'}
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm && deletingKontakt}
	<div class="modal-overlay" onclick={closeDeleteConfirm} role="dialog" aria-modal="true">
		<div class="modal-content small" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>Kontakt löschen?</h2>
				<button class="close-btn" onclick={closeDeleteConfirm} aria-label="Schließen">&times;</button>
			</div>
			<div class="modal-body">
				<p>Möchten Sie den Kontakt <strong>{getAnzeigename(deletingKontakt)}</strong> wirklich löschen?</p>
				<p class="delete-info">Der Kontakt wird deaktiviert und kann bei Bedarf wiederhergestellt werden.</p>
			</div>
			<div class="modal-footer">
				<button type="button" class="cancel-btn" onclick={closeDeleteConfirm} disabled={deleting}>
					Abbrechen
				</button>
				<button type="button" class="delete-confirm-btn" onclick={deleteKontakt} disabled={deleting}>
					{deleting ? 'Lösche...' : 'Ja, löschen'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.kontakte-page {
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

	.header-actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.primary-btn {
		padding: 0.5rem 1rem;
		background: var(--color-brand-medium);
		color: white;
		border: none;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 500;
		transition: background 0.15s ease;
	}

	.primary-btn:hover {
		background: var(--color-brand-dark);
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

	.view-toggle {
		display: flex;
		border: 1px solid var(--color-gray-300);
		background: white;
	}

	.toggle-btn {
		padding: 0.5rem 0.75rem;
		border: none;
		background: none;
		cursor: pointer;
		font-size: 0.9rem;
		color: var(--color-gray-500);
	}

	.toggle-btn:first-child {
		border-right: 1px solid var(--color-gray-300);
	}

	.toggle-btn.active {
		background: var(--color-brand-bg);
		color: var(--color-brand-medium);
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

	.stat-value.success {
		color: var(--color-success-dark);
	}

	.stat-value.warning {
		color: var(--color-warning-dark);
	}

	.stat-value.default {
		color: var(--color-gray-600);
	}

	.stat-value.info {
		color: var(--color-primary-600);
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

	/* Kontakte Grid (Kartenansicht) */
	.kontakte-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 1rem;
		margin-top: 1rem;
	}

	.kontakt-card {
		background: white;
		border: 1px solid var(--color-gray-200);
		transition: all 0.15s ease;
		cursor: pointer;
		position: relative;
	}

	.kontakt-card:hover {
		border-color: var(--color-gray-300);
		box-shadow: var(--shadow-md);
	}

	.kontakt-card:hover .card-actions {
		opacity: 1;
	}

	.kontakt-card .card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-gray-100);
		background: var(--color-gray-50);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.kontakt-nr {
		font-family: var(--font-family-mono);
		font-weight: 600;
		font-size: 0.8rem;
		color: var(--color-gray-500);
	}

	.sync-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		font-size: 0.65rem;
		font-weight: 700;
		background: var(--color-gray-200);
		color: var(--color-gray-600);
		border-radius: 3px;
	}

	.kontaktarten {
		display: flex;
		gap: 0.25rem;
		flex-wrap: wrap;
	}

	.kontakt-card .card-body {
		padding: 1rem;
	}

	.kontakt-name {
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-gray-800);
		margin: 0 0 0.25rem 0;
	}

	.kontakt-position {
		font-size: 0.85rem;
		color: var(--color-gray-500);
		display: block;
		margin-bottom: 0.75rem;
	}

	.kontakt-details {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.detail-item {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		font-size: 0.85rem;
	}

	.detail-icon {
		color: var(--color-gray-400);
		flex-shrink: 0;
	}

	.detail-link {
		color: var(--color-brand-medium);
		text-decoration: none;
	}

	.detail-link:hover {
		text-decoration: underline;
	}

	.detail-text {
		color: var(--color-gray-600);
	}

	.card-actions {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		display: flex;
		gap: 0.25rem;
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.action-btn {
		width: 28px;
		height: 28px;
		border: 1px solid var(--color-gray-300);
		background: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.85rem;
		transition: all 0.15s ease;
	}

	.action-btn:hover {
		background: var(--color-gray-100);
	}

	.edit-btn:hover {
		border-color: var(--color-brand-medium);
		color: var(--color-brand-medium);
	}

	.delete-btn:hover {
		border-color: var(--color-error);
		color: var(--color-error);
	}

	/* Tabellenansicht */
	.table-container {
		margin-top: 1rem;
		background: white;
		border: 1px solid var(--color-gray-200);
		overflow-x: auto;
	}

	.kontakte-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.kontakte-table th {
		text-align: left;
		padding: 0.75rem 1rem;
		background: var(--color-gray-50);
		border-bottom: 1px solid var(--color-gray-200);
		font-weight: 600;
		color: var(--color-gray-600);
		font-size: 0.8rem;
		text-transform: uppercase;
	}

	.kontakte-table td {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-gray-100);
		vertical-align: top;
	}

	.kontakte-table tr.clickable-row {
		cursor: pointer;
	}

	.kontakte-table tr:hover {
		background: var(--color-gray-50);
	}

	.td-nr {
		font-family: var(--font-family-mono);
		font-size: 0.8rem;
		color: var(--color-gray-500);
		white-space: nowrap;
	}

	.td-name {
		min-width: 200px;
	}

	.name-primary {
		display: block;
		font-weight: 500;
		color: var(--color-gray-800);
	}

	.name-secondary {
		display: block;
		font-size: 0.8rem;
		color: var(--color-gray-500);
		margin-top: 0.125rem;
	}

	.td-email a,
	.td-phone a {
		color: var(--color-brand-medium);
		text-decoration: none;
	}

	.td-email a:hover,
	.td-phone a:hover {
		text-decoration: underline;
	}

	.td-actions {
		white-space: nowrap;
	}

	/* Empty State */
	.empty-state {
		text-align: center;
		padding: 3rem 2rem;
		color: var(--color-gray-500);
		grid-column: 1 / -1;
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

	.empty-state .primary-btn {
		background: var(--color-brand-medium);
		color: white;
		border: none;
	}

	/* Modal Styles */
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
		width: 100%;
		max-width: 700px;
		max-height: 90vh;
		overflow-y: auto;
		border-radius: 4px;
		box-shadow: var(--shadow-lg);
	}

	.modal-content.small {
		max-width: 450px;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid var(--color-gray-200);
		position: sticky;
		top: 0;
		background: white;
		z-index: 1;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.25rem;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: var(--color-gray-500);
		line-height: 1;
		padding: 0;
	}

	.close-btn:hover {
		color: var(--color-gray-800);
	}

	.modal-body {
		padding: 1.5rem;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding: 1rem 1.5rem;
		border-top: 1px solid var(--color-gray-200);
		background: var(--color-gray-50);
	}

	.form-section {
		margin-bottom: 1.5rem;
	}

	.form-section h3 {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--color-gray-600);
		margin: 0 0 0.75rem 0;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.form-group {
		margin-bottom: 0.75rem;
	}

	.form-group.full-width {
		grid-column: 1 / -1;
	}

	.form-group.small {
		max-width: 120px;
	}

	.form-group label {
		display: block;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--color-gray-700);
		margin-bottom: 0.25rem;
	}

	.form-group input,
	.form-group select,
	.form-group textarea {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-gray-300);
		font-size: 0.9rem;
		transition: border-color 0.15s ease;
	}

	.form-group input:focus,
	.form-group select:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: var(--color-brand-medium);
	}

	.form-group input.error {
		border-color: var(--color-error);
	}

	.form-group textarea {
		resize: vertical;
		min-height: 80px;
	}

	.field-error {
		display: block;
		color: var(--color-error);
		font-size: 0.8rem;
		margin-top: 0.25rem;
	}

	.form-error.global-error {
		background: var(--color-error-bg, #fee2e2);
		color: var(--color-error);
		padding: 0.75rem 1rem;
		margin-bottom: 1rem;
		border-radius: 4px;
		font-size: 0.9rem;
	}

	.kontaktarten-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 0.5rem;
	}

	.kontaktart-checkbox {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-gray-200);
		cursor: pointer;
		font-size: 0.85rem;
		transition: all 0.15s ease;
		user-select: none;
	}

	.kontaktart-checkbox:hover {
		border-color: var(--color-gray-300);
	}

	.kontaktart-checkbox.checked {
		border-color: var(--color-brand-medium);
		background: var(--color-brand-bg);
	}

	.kontaktart-checkbox input {
		display: none;
	}

	.kontaktart-checkbox .checkmark {
		width: 16px;
		height: 16px;
		border: 1px solid var(--color-gray-400);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.kontaktart-checkbox.checked .checkmark {
		background: var(--color-brand-medium);
		border-color: var(--color-brand-medium);
	}

	.kontaktart-checkbox.checked .checkmark::after {
		content: '\2713';
		color: white;
		font-size: 0.7rem;
		font-weight: bold;
	}

	.cancel-btn {
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-gray-300);
		background: white;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.cancel-btn:hover:not(:disabled) {
		background: var(--color-gray-50);
	}

	.cancel-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.save-btn {
		padding: 0.5rem 1.5rem;
		background: var(--color-brand-medium);
		color: white;
		border: none;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 500;
	}

	.save-btn:hover:not(:disabled) {
		background: var(--color-brand-dark);
	}

	.save-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.delete-confirm-btn {
		padding: 0.5rem 1.5rem;
		background: var(--color-error);
		color: white;
		border: none;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 500;
	}

	.delete-confirm-btn:hover:not(:disabled) {
		background: #b91c1c;
	}

	.delete-confirm-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.delete-info {
		font-size: 0.85rem;
		color: var(--color-gray-500);
		margin-top: 0.5rem;
	}

	@media (max-width: 768px) {
		.page-header {
			flex-direction: column;
			gap: 1rem;
		}

		.header-actions {
			width: 100%;
			justify-content: space-between;
			flex-wrap: wrap;
		}

		.filters {
			flex-direction: column;
		}

		.search-box,
		.filter-select {
			width: 100%;
		}

		.kontakte-grid {
			grid-template-columns: 1fr;
		}

		.table-container {
			font-size: 0.85rem;
		}

		.kontakte-table th,
		.kontakte-table td {
			padding: 0.5rem;
		}

		.form-row {
			grid-template-columns: 1fr;
		}

		.modal-content {
			max-height: 100vh;
			border-radius: 0;
		}

		.kontaktarten-grid {
			grid-template-columns: 1fr 1fr;
		}

		.card-actions {
			opacity: 1;
		}
	}
</style>
