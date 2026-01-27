<script lang="ts">
	import { Card, Badge, Button } from '$lib/components/ui';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';

	// Types
	interface Mangel {
		id: string;
		mangel_nr: string | null;
		projekt_nr: string | null;
		projektname_komplett: string | null;
		status_mangel: string | null;
		art_des_mangels: string | null;
		nachunternehmer: string | null;
		beschreibung_mangel: string | null;
		datum_frist: string | null;
		datum_meldung: string | null;
		bauleiter: string | null;
		fotos_mangel: any[] | null;
		created_at: string | null;
	}

	interface BVOption {
		projekt_nr: string;
		projektname_komplett: string;
	}

	// State
	let maengel = $state<Mangel[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Modal State
	let showModal = $state(false);
	let editingMangel = $state<Mangel | null>(null);
	let formLoading = $state(false);
	let formError = $state<string | null>(null);
	let formSuccess = $state<string | null>(null);

	// Delete Confirmation State
	let showDeleteConfirm = $state(false);
	let deletingMangel = $state<Mangel | null>(null);
	let deleteLoading = $state(false);

	// Form State
	let formData = $state({
		projekt_nr: '',
		projektname_komplett: '',
		mangel_nr: '',
		status_mangel: '(0) Offen',
		art_des_mangels: '',
		beschreibung_mangel: '',
		nachunternehmer: '',
		datum_frist: '',
		fotos_mangel: ''
	});

	// BV-Optionen für Dropdown
	let bvOptions = $state<BVOption[]>([]);

	// Filter-State
	let searchQuery = $state('');
	let selectedStatus = $state<string | null>(null);
	let selectedBV = $state<string | null>(null);
	let selectedGewerk = $state<string | null>(null);
	let nurUeberfaellig = $state(false);
	let sortierung = $state<'datum_desc' | 'datum_asc' | 'frist_asc'>('datum_desc');

	// Status-Mapping
	const STATUS_OFFEN = '(0) Offen';
	const STATUS_IN_BEARBEITUNG = '(1) In Bearbeitung';
	const STATUS_NICHT_ABGENOMMEN = '(2) Nicht abgenommen';
	const STATUS_ABGENOMMEN = '(2) Abgenommen';
	const STATUS_ABGELEHNT = '(3) Abgelehnt';
	const STATUS_UEBERFAELLIG = '(3) Überfällig';

	// Status-Optionen für Dropdown
	const statusOptions = [
		{ value: '(0) Offen', label: 'Offen' },
		{ value: '(1) In Bearbeitung', label: 'In Bearbeitung' },
		{ value: '(2) Abgenommen', label: 'Abgenommen' },
		{ value: '(3) Abgelehnt', label: 'Abgelehnt' },
		{ value: '(3) Überfällig', label: 'Überfällig' }
	];

	// Art des Mangels Optionen
	const artOptions = [
		'Ausführungsmangel',
		'Materialfehler',
		'Endabnahme',
		'Gewährleistung',
		'Sonstiges'
	];

	// BVs und Gewerke für Filter
	let bvListe = $derived([...new Set(maengel.map(m => m.projekt_nr).filter(Boolean))].sort());
	let gewerkListe = $derived([...new Set(maengel.map(m => m.nachunternehmer).filter(Boolean))].sort());

	// Nachunternehmer-Liste für Dropdown (aus existierenden Daten)
	let nuListe = $derived([...new Set(maengel.map(m => m.nachunternehmer).filter(Boolean))].sort() as string[]);

	// Prüfen ob Frist überschritten
	function istUeberfaellig(mangel: Mangel): boolean {
		if (!mangel.datum_frist) return false;
		if (mangel.status_mangel === STATUS_ABGENOMMEN) return false;
		return new Date(mangel.datum_frist) < new Date();
	}

	// Gefilterte Mängel
	let filteredMaengel = $derived(() => {
		let result = maengel.filter(m => {
			// Textsuche
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				const match =
					(m.mangel_nr?.toLowerCase() || '').includes(query) ||
					(m.beschreibung_mangel?.toLowerCase() || '').includes(query) ||
					(m.projekt_nr?.toLowerCase() || '').includes(query) ||
					(m.projektname_komplett?.toLowerCase() || '').includes(query);
				if (!match) return false;
			}

			// Status-Filter
			if (selectedStatus) {
				if (m.status_mangel !== selectedStatus) return false;
			}

			// BV-Filter
			if (selectedBV && m.projekt_nr !== selectedBV) return false;

			// Gewerk-Filter
			if (selectedGewerk && m.nachunternehmer !== selectedGewerk) return false;

			// Nur überfällige
			if (nurUeberfaellig && !istUeberfaellig(m)) return false;

			return true;
		});

		// Sortierung
		result.sort((a, b) => {
			if (sortierung === 'datum_desc') {
				const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
				const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
				return dateB - dateA;
			} else if (sortierung === 'datum_asc') {
				const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
				const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
				return dateA - dateB;
			} else if (sortierung === 'frist_asc') {
				const dateA = a.datum_frist ? new Date(a.datum_frist).getTime() : Infinity;
				const dateB = b.datum_frist ? new Date(b.datum_frist).getTime() : Infinity;
				return dateA - dateB;
			}
			return 0;
		});

		return result;
	});

	// Statistiken
	let stats = $derived(() => {
		const offen = maengel.filter(m =>
			m.status_mangel === STATUS_OFFEN ||
			m.status_mangel === STATUS_IN_BEARBEITUNG ||
			m.status_mangel === STATUS_NICHT_ABGENOMMEN
		).length;
		const inArbeit = maengel.filter(m => m.status_mangel === STATUS_IN_BEARBEITUNG).length;
		const erledigt = maengel.filter(m => m.status_mangel === STATUS_ABGENOMMEN).length;
		const ueberfaellig = maengel.filter(m =>
			m.status_mangel === STATUS_UEBERFAELLIG || istUeberfaellig(m)
		).length;

		return {
			gesamt: maengel.length,
			offen,
			inArbeit,
			erledigt,
			ueberfaellig
		};
	});

	// Daten laden
	async function loadMaengel() {
		loading = true;
		error = null;

		const { data, error: fetchError } = await supabase
			.from('maengel_fertigstellung')
			.select('id, mangel_nr, projekt_nr, projektname_komplett, status_mangel, art_des_mangels, nachunternehmer, beschreibung_mangel, datum_frist, datum_meldung, bauleiter, fotos_mangel, created_at')
			.order('created_at', { ascending: false });

		if (fetchError) {
			error = fetchError.message;
			console.error('Fehler beim Laden der Mängel:', fetchError);
		} else {
			maengel = data || [];
		}

		loading = false;
	}

	// BV-Optionen laden (aus existierenden Mängeln)
	async function loadBVOptions() {
		// Lade eindeutige BVs aus der Mängel-Tabelle
		const { data } = await supabase
			.from('maengel_fertigstellung')
			.select('projekt_nr, projektname_komplett')
			.not('projekt_nr', 'is', null);

		if (data) {
			const uniqueBVs = new Map<string, string>();
			data.forEach(d => {
				if (d.projekt_nr && !uniqueBVs.has(d.projekt_nr)) {
					uniqueBVs.set(d.projekt_nr, d.projektname_komplett || d.projekt_nr);
				}
			});
			bvOptions = Array.from(uniqueBVs.entries()).map(([projekt_nr, projektname_komplett]) => ({
				projekt_nr,
				projektname_komplett
			})).sort((a, b) => a.projekt_nr.localeCompare(b.projekt_nr));
		}
	}

	onMount(() => {
		loadMaengel();
		loadBVOptions();
	});

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: '2-digit'
		});
	}

	function formatDateForInput(dateStr: string | null): string {
		if (!dateStr) return '';
		const date = new Date(dateStr);
		return date.toISOString().split('T')[0];
	}

	function getStatusVariant(status: string | null): 'success' | 'warning' | 'error' | 'default' {
		switch (status) {
			case STATUS_ABGENOMMEN: return 'success';
			case STATUS_IN_BEARBEITUNG: return 'warning';
			case STATUS_OFFEN: return 'error';
			case STATUS_NICHT_ABGENOMMEN: return 'error';
			case STATUS_UEBERFAELLIG: return 'error';
			case STATUS_ABGELEHNT: return 'error';
			default: return 'default';
		}
	}

	function getStatusLabel(status: string | null): string {
		switch (status) {
			case STATUS_ABGENOMMEN: return 'Abgenommen';
			case STATUS_IN_BEARBEITUNG: return 'In Bearbeitung';
			case STATUS_OFFEN: return 'Offen';
			case STATUS_NICHT_ABGENOMMEN: return 'Nicht abgenommen';
			case STATUS_UEBERFAELLIG: return 'Überfällig';
			case STATUS_ABGELEHNT: return 'Abgelehnt';
			default: return status || 'Unbekannt';
		}
	}

	function clearFilters() {
		searchQuery = '';
		selectedStatus = null;
		selectedBV = null;
		selectedGewerk = null;
		nurUeberfaellig = false;
	}

	function getFotosCount(fotos: any[] | null): number {
		if (!fotos || !Array.isArray(fotos)) return 0;
		return fotos.length;
	}

	// Adresse aus projektname_komplett extrahieren (Format: "Kunde | Adresse | Lage | Name")
	function getAdresse(projektname: string | null): string {
		if (!projektname) return '-';
		const parts = projektname.split('|').map(p => p.trim());
		return parts.length >= 2 ? parts[1] : projektname;
	}

	// ===== CRUD Functions =====

	// Modal öffnen für neuen Mangel
	function openCreateModal() {
		editingMangel = null;
		formData = {
			projekt_nr: '',
			projektname_komplett: '',
			mangel_nr: '',
			status_mangel: '(0) Offen',
			art_des_mangels: '',
			beschreibung_mangel: '',
			nachunternehmer: '',
			datum_frist: '',
			fotos_mangel: ''
		};
		formError = null;
		formSuccess = null;
		showModal = true;
	}

	// Modal öffnen für Bearbeiten
	function openEditModal(mangel: Mangel) {
		editingMangel = mangel;
		formData = {
			projekt_nr: mangel.projekt_nr || '',
			projektname_komplett: mangel.projektname_komplett || '',
			mangel_nr: mangel.mangel_nr || '',
			status_mangel: mangel.status_mangel || '(0) Offen',
			art_des_mangels: mangel.art_des_mangels || '',
			beschreibung_mangel: mangel.beschreibung_mangel || '',
			nachunternehmer: mangel.nachunternehmer || '',
			datum_frist: formatDateForInput(mangel.datum_frist),
			fotos_mangel: mangel.fotos_mangel ? mangel.fotos_mangel.map((f: any) => typeof f === 'string' ? f : f.url).join('\n') : ''
		};
		formError = null;
		formSuccess = null;
		showModal = true;
	}

	// Modal schließen
	function closeModal() {
		showModal = false;
		editingMangel = null;
		formError = null;
		formSuccess = null;
	}

	// BV-Auswahl ändern
	function onBVChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		const selectedOption = bvOptions.find(bv => bv.projekt_nr === select.value);
		if (selectedOption) {
			formData.projekt_nr = selectedOption.projekt_nr;
			formData.projektname_komplett = selectedOption.projektname_komplett;
		} else {
			formData.projekt_nr = select.value;
			formData.projektname_komplett = '';
		}
	}

	// Formular speichern (Create oder Update)
	async function saveForm() {
		formLoading = true;
		formError = null;
		formSuccess = null;

		// Validierung
		if (!formData.beschreibung_mangel.trim()) {
			formError = 'Bitte geben Sie eine Beschreibung ein.';
			formLoading = false;
			return;
		}

		// Fotos-URLs parsen
		const fotosArray = formData.fotos_mangel
			.split('\n')
			.map(url => url.trim())
			.filter(url => url.length > 0)
			.map(url => ({ url }));

		const payload = {
			projekt_nr: formData.projekt_nr || null,
			projektname_komplett: formData.projektname_komplett || null,
			mangel_nr: formData.mangel_nr || null,
			status_mangel: formData.status_mangel,
			art_des_mangels: formData.art_des_mangels || null,
			beschreibung_mangel: formData.beschreibung_mangel,
			nachunternehmer: formData.nachunternehmer || null,
			datum_frist: formData.datum_frist ? new Date(formData.datum_frist).toISOString() : null,
			fotos_mangel: fotosArray.length > 0 ? fotosArray : null
		};

		if (editingMangel) {
			// UPDATE
			const { error: updateError } = await supabase
				.from('maengel_fertigstellung')
				.update(payload)
				.eq('id', editingMangel.id);

			if (updateError) {
				formError = `Fehler beim Aktualisieren: ${updateError.message}`;
			} else {
				formSuccess = 'Mangel erfolgreich aktualisiert!';
				await loadMaengel();
				setTimeout(closeModal, 1000);
			}
		} else {
			// INSERT
			const { error: insertError } = await supabase
				.from('maengel_fertigstellung')
				.insert(payload);

			if (insertError) {
				formError = `Fehler beim Erstellen: ${insertError.message}`;
			} else {
				formSuccess = 'Mangel erfolgreich erstellt!';
				await loadMaengel();
				await loadBVOptions();
				setTimeout(closeModal, 1000);
			}
		}

		formLoading = false;
	}

	// Quick Status Update
	async function updateStatus(mangel: Mangel, newStatus: string) {
		const { error: updateError } = await supabase
			.from('maengel_fertigstellung')
			.update({ status_mangel: newStatus })
			.eq('id', mangel.id);

		if (updateError) {
			console.error('Fehler beim Status-Update:', updateError);
			alert(`Fehler: ${updateError.message}`);
		} else {
			await loadMaengel();
		}
	}

	// Delete Confirmation öffnen
	function confirmDelete(mangel: Mangel) {
		deletingMangel = mangel;
		showDeleteConfirm = true;
	}

	// Delete ausführen
	async function deleteMangel() {
		if (!deletingMangel) return;

		deleteLoading = true;

		const { error: deleteError } = await supabase
			.from('maengel_fertigstellung')
			.delete()
			.eq('id', deletingMangel.id);

		if (deleteError) {
			console.error('Fehler beim Löschen:', deleteError);
			alert(`Fehler beim Löschen: ${deleteError.message}`);
		} else {
			await loadMaengel();
		}

		deleteLoading = false;
		showDeleteConfirm = false;
		deletingMangel = null;
	}

	// Delete abbrechen
	function cancelDelete() {
		showDeleteConfirm = false;
		deletingMangel = null;
	}
</script>

<div class="maengel-page">
	<header class="page-header">
		<div class="header-content">
			<h1>Mängel</h1>
			<p class="subtitle">
				{#if loading}
					Lade Mängel...
				{:else}
					{filteredMaengel().length} von {stats().gesamt} Mängeln
				{/if}
			</p>
		</div>
		<div class="header-actions">
			<button class="refresh-btn" onclick={loadMaengel} disabled={loading}>
				{loading ? 'Lädt...' : 'Aktualisieren'}
			</button>
			<Button variant="primary" onclick={openCreateModal}>
				+ Neuer Mangel
			</Button>
		</div>
	</header>

	{#if error}
		<Card padding="md">
			<div class="error-message">
				<strong>Fehler:</strong> {error}
				<button onclick={loadMaengel}>Erneut versuchen</button>
			</div>
		</Card>
	{/if}

	<!-- Statistik-Karten -->
	<div class="stats-row">
		<button
			class="stat-card"
			class:active={selectedStatus === STATUS_OFFEN}
			onclick={() => selectedStatus = selectedStatus === STATUS_OFFEN ? null : STATUS_OFFEN}
		>
			<span class="stat-value error">{stats().offen}</span>
			<span class="stat-label">Offen</span>
		</button>
		<button
			class="stat-card"
			class:active={selectedStatus === STATUS_IN_BEARBEITUNG}
			onclick={() => selectedStatus = selectedStatus === STATUS_IN_BEARBEITUNG ? null : STATUS_IN_BEARBEITUNG}
		>
			<span class="stat-value warning">{stats().inArbeit}</span>
			<span class="stat-label">In Bearbeitung</span>
		</button>
		<button
			class="stat-card"
			class:active={selectedStatus === STATUS_ABGENOMMEN}
			onclick={() => selectedStatus = selectedStatus === STATUS_ABGENOMMEN ? null : STATUS_ABGENOMMEN}
		>
			<span class="stat-value success">{stats().erledigt}</span>
			<span class="stat-label">Abgenommen</span>
		</button>
		<button
			class="stat-card"
			class:active={nurUeberfaellig}
			onclick={() => nurUeberfaellig = !nurUeberfaellig}
		>
			<span class="stat-value danger">{stats().ueberfaellig}</span>
			<span class="stat-label">Überfällig</span>
		</button>
	</div>

	<!-- Filter -->
	<Card padding="sm">
		<div class="filters">
			<div class="search-box">
				<span class="search-icon">&#128269;</span>
				<input
					type="search"
					placeholder="Mangel-Nr., Beschreibung oder BV suchen..."
					bind:value={searchQuery}
					class="search-input"
				/>
			</div>

			<select bind:value={selectedBV} class="filter-select">
				<option value={null}>Alle BVs</option>
				{#each bvListe as bv}
					<option value={bv}>{bv}</option>
				{/each}
			</select>

			<select bind:value={selectedGewerk} class="filter-select">
				<option value={null}>Alle Gewerke/NU</option>
				{#each gewerkListe as gewerk}
					<option value={gewerk}>{gewerk}</option>
				{/each}
			</select>

			<select bind:value={sortierung} class="filter-select">
				<option value="datum_desc">Neueste zuerst</option>
				<option value="datum_asc">Älteste zuerst</option>
				<option value="frist_asc">Frist (dringend zuerst)</option>
			</select>

			{#if searchQuery || selectedStatus || selectedBV || selectedGewerk || nurUeberfaellig}
				<button class="clear-btn" onclick={clearFilters}>
					Filter zurücksetzen
				</button>
			{/if}
		</div>
	</Card>

	<!-- Mängel-Liste -->
	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Lade Mängel aus Supabase...</p>
		</div>
	{:else}
		<div class="maengel-list">
			{#each filteredMaengel() as mangel}
				<div class="mangel-card">
					<div class="card-header">
						<div class="header-left">
							<span class="mangel-id">{mangel.mangel_nr || `#${mangel.id.slice(0, 8)}`}</span>
							<Badge variant={getStatusVariant(mangel.status_mangel)} size="sm">
								{getStatusLabel(mangel.status_mangel)}
							</Badge>
							{#if istUeberfaellig(mangel)}
								<Badge variant="error" size="sm">Überfällig!</Badge>
							{/if}
						</div>
						<div class="header-right">
							<span class="bv-nr">{mangel.projekt_nr || '-'}</span>
							<button class="icon-btn edit-btn" onclick={() => openEditModal(mangel)} title="Bearbeiten">
								&#9998;
							</button>
							<button class="icon-btn delete-btn" onclick={() => confirmDelete(mangel)} title="Löschen">
								&#128465;
							</button>
						</div>
					</div>

					<div class="card-body">
						<h3 class="beschreibung">{mangel.beschreibung_mangel || 'Keine Beschreibung'}</h3>
						<span class="adresse">{getAdresse(mangel.projektname_komplett)}</span>
						{#if mangel.art_des_mangels}
							<span class="art-badge">{mangel.art_des_mangels}</span>
						{/if}

						<div class="card-meta">
							<div class="meta-item">
								<span class="meta-label">Gewerk/NU</span>
								<span class="meta-value">{mangel.nachunternehmer || '-'}</span>
							</div>
							<div class="meta-item">
								<span class="meta-label">Frist</span>
								<span class="meta-value" class:overdue={istUeberfaellig(mangel)}>
									{formatDate(mangel.datum_frist)}
								</span>
							</div>
							<div class="meta-item">
								<span class="meta-label">Fotos</span>
								<span class="meta-value">{getFotosCount(mangel.fotos_mangel)}</span>
							</div>
						</div>
					</div>

					<!-- Quick Actions -->
					<div class="card-actions">
						<span class="actions-label">Status:</span>
						<button
							class="action-btn"
							class:active={mangel.status_mangel === STATUS_IN_BEARBEITUNG}
							onclick={() => updateStatus(mangel, STATUS_IN_BEARBEITUNG)}
						>
							In Bearbeitung
						</button>
						<button
							class="action-btn success"
							class:active={mangel.status_mangel === STATUS_ABGENOMMEN}
							onclick={() => updateStatus(mangel, STATUS_ABGENOMMEN)}
						>
							Erledigt
						</button>
						<button
							class="action-btn danger"
							class:active={mangel.status_mangel === STATUS_ABGELEHNT}
							onclick={() => updateStatus(mangel, STATUS_ABGELEHNT)}
						>
							Abgelehnt
						</button>
					</div>

					<div class="card-footer">
						<span class="creator">Bauleiter: {mangel.bauleiter || '-'}</span>
						<span class="date">{formatDate(mangel.created_at)}</span>
					</div>
				</div>
			{/each}

			{#if filteredMaengel().length === 0}
				<div class="empty-state">
					{#if maengel.length === 0}
						<p>Noch keine Mängel vorhanden</p>
						<Button variant="primary" onclick={openCreateModal}>
							Ersten Mangel anlegen
						</Button>
					{:else}
						<p>Keine Mängel gefunden</p>
						<button onclick={clearFilters}>Filter zurücksetzen</button>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Create/Edit Modal -->
{#if showModal}
	<div class="modal-backdrop" onclick={closeModal}></div>
	<div class="modal">
		<div class="modal-header">
			<h2>{editingMangel ? 'Mangel bearbeiten' : 'Neuer Mangel'}</h2>
			<button class="modal-close" onclick={closeModal}>&times;</button>
		</div>

		<div class="modal-body">
			{#if formError}
				<div class="form-error">{formError}</div>
			{/if}
			{#if formSuccess}
				<div class="form-success">{formSuccess}</div>
			{/if}

			<form onsubmit={(e) => { e.preventDefault(); saveForm(); }}>
				<div class="form-row">
					<div class="form-group">
						<label for="projekt_nr">Bauvorhaben (BV)</label>
						<select id="projekt_nr" value={formData.projekt_nr} onchange={onBVChange}>
							<option value="">-- BV auswählen --</option>
							{#each bvOptions as bv}
								<option value={bv.projekt_nr}>{bv.projekt_nr} - {bv.projektname_komplett}</option>
							{/each}
						</select>
						<input
							type="text"
							placeholder="Oder ATBS-Nr. manuell eingeben"
							bind:value={formData.projekt_nr}
							class="manual-input"
						/>
					</div>

					<div class="form-group">
						<label for="mangel_nr">Mangel-Nr. (optional)</label>
						<input
							type="text"
							id="mangel_nr"
							bind:value={formData.mangel_nr}
							placeholder="z.B. M-001"
						/>
					</div>
				</div>

				<div class="form-row">
					<div class="form-group">
						<label for="status_mangel">Status</label>
						<select id="status_mangel" bind:value={formData.status_mangel}>
							{#each statusOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</div>

					<div class="form-group">
						<label for="art_des_mangels">Art des Mangels</label>
						<select id="art_des_mangels" bind:value={formData.art_des_mangels}>
							<option value="">-- Bitte auswählen --</option>
							{#each artOptions as art}
								<option value={art}>{art}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="form-group full-width">
					<label for="beschreibung_mangel">Beschreibung *</label>
					<textarea
						id="beschreibung_mangel"
						bind:value={formData.beschreibung_mangel}
						placeholder="Beschreiben Sie den Mangel..."
						rows="4"
						required
					></textarea>
				</div>

				<div class="form-row">
					<div class="form-group">
						<label for="nachunternehmer">Nachunternehmer</label>
						<input
							type="text"
							id="nachunternehmer"
							bind:value={formData.nachunternehmer}
							placeholder="Name des Nachunternehmers"
							list="nu-liste"
						/>
						<datalist id="nu-liste">
							{#each nuListe as nu}
								<option value={nu}></option>
							{/each}
						</datalist>
					</div>

					<div class="form-group">
						<label for="datum_frist">Frist</label>
						<input
							type="date"
							id="datum_frist"
							bind:value={formData.datum_frist}
						/>
					</div>
				</div>

				<div class="form-group full-width">
					<label for="fotos_mangel">Fotos (URLs, eine pro Zeile)</label>
					<textarea
						id="fotos_mangel"
						bind:value={formData.fotos_mangel}
						placeholder="https://example.com/foto1.jpg&#10;https://example.com/foto2.jpg"
						rows="3"
					></textarea>
				</div>

				<div class="form-actions">
					<Button variant="secondary" onclick={closeModal} type="button">
						Abbrechen
					</Button>
					<Button variant="primary" type="submit" loading={formLoading}>
						{editingMangel ? 'Speichern' : 'Erstellen'}
					</Button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm && deletingMangel}
	<div class="modal-backdrop" onclick={cancelDelete}></div>
	<div class="modal modal-sm">
		<div class="modal-header">
			<h2>Mangel löschen?</h2>
			<button class="modal-close" onclick={cancelDelete}>&times;</button>
		</div>
		<div class="modal-body">
			<p>Möchten Sie den Mangel <strong>{deletingMangel.mangel_nr || deletingMangel.id.slice(0, 8)}</strong> wirklich löschen?</p>
			<p class="delete-warning">Diese Aktion kann nicht rückgängig gemacht werden.</p>

			<div class="form-actions">
				<Button variant="secondary" onclick={cancelDelete}>
					Abbrechen
				</Button>
				<Button variant="danger" onclick={deleteMangel} loading={deleteLoading}>
					Löschen
				</Button>
			</div>
		</div>
	</div>
{/if}

<style>
	.maengel-page {
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

	.stat-value.error {
		color: var(--color-error);
	}

	.stat-value.warning {
		color: var(--color-warning-dark);
	}

	.stat-value.success {
		color: var(--color-success-dark);
	}

	.stat-value.danger {
		color: var(--color-error-dark);
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

	/* Mängel Liste */
	.maengel-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-top: 1rem;
	}

	.mangel-card {
		display: block;
		background: white;
		border: 1px solid var(--color-gray-200);
		text-decoration: none;
		transition: all 0.15s ease;
	}

	.mangel-card:hover {
		border-color: var(--color-gray-300);
		box-shadow: var(--shadow-md);
	}

	.mangel-card .card-header {
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
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.mangel-id {
		font-family: var(--font-family-mono);
		font-weight: 600;
		font-size: 0.85rem;
		color: var(--color-gray-600);
	}

	.bv-nr {
		font-family: var(--font-family-mono);
		font-size: 0.8rem;
		color: var(--color-gray-500);
	}

	.icon-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		font-size: 1rem;
		opacity: 0.6;
		transition: opacity 0.15s ease;
	}

	.icon-btn:hover {
		opacity: 1;
	}

	.edit-btn {
		color: var(--color-gray-600);
	}

	.delete-btn {
		color: var(--color-error);
	}

	.mangel-card .card-body {
		padding: 1rem;
	}

	.beschreibung {
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-gray-800);
		margin: 0 0 0.25rem 0;
	}

	.adresse {
		font-size: 0.85rem;
		color: var(--color-gray-500);
		display: block;
		margin-bottom: 0.5rem;
	}

	.art-badge {
		display: inline-block;
		font-size: 0.75rem;
		padding: 0.15rem 0.5rem;
		background: var(--color-gray-100);
		color: var(--color-gray-600);
		margin-bottom: 0.75rem;
	}

	.card-meta {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
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

	/* Quick Actions */
	.card-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-top: 1px solid var(--color-gray-100);
		background: var(--color-gray-50);
	}

	.actions-label {
		font-size: 0.75rem;
		color: var(--color-gray-500);
		margin-right: 0.5rem;
	}

	.action-btn {
		padding: 0.25rem 0.75rem;
		font-size: 0.75rem;
		border: 1px solid var(--color-gray-300);
		background: white;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.action-btn:hover {
		background: var(--color-gray-100);
	}

	.action-btn.active {
		background: var(--color-gray-200);
		border-color: var(--color-gray-400);
	}

	.action-btn.success {
		border-color: var(--color-success);
		color: var(--color-success-dark);
	}

	.action-btn.success:hover,
	.action-btn.success.active {
		background: var(--color-success-light);
	}

	.action-btn.danger {
		border-color: var(--color-error);
		color: var(--color-error-dark);
	}

	.action-btn.danger:hover,
	.action-btn.danger.active {
		background: var(--color-error-light);
	}

	.mangel-card .card-footer {
		display: flex;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-top: 1px solid var(--color-gray-100);
		background: var(--color-gray-50);
		font-size: 0.8rem;
		color: var(--color-gray-500);
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

	/* Modal */
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: var(--z-modal-backdrop);
	}

	.modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: white;
		width: 90%;
		max-width: 600px;
		max-height: 90vh;
		overflow-y: auto;
		z-index: var(--z-modal);
		box-shadow: var(--shadow-xl);
	}

	.modal.modal-sm {
		max-width: 400px;
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
		font-size: 1.5rem;
		cursor: pointer;
		color: var(--color-gray-500);
		padding: 0;
		line-height: 1;
	}

	.modal-close:hover {
		color: var(--color-gray-800);
	}

	.modal-body {
		padding: 1.5rem;
	}

	/* Form Styles */
	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	@media (max-width: 500px) {
		.form-row {
			grid-template-columns: 1fr;
		}
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-group.full-width {
		grid-column: 1 / -1;
		margin-bottom: 1rem;
	}

	.form-group label {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-gray-700);
	}

	.form-group input,
	.form-group select,
	.form-group textarea {
		padding: 0.6rem 0.75rem;
		border: 1px solid var(--color-gray-300);
		font-size: 0.9rem;
		font-family: inherit;
	}

	.form-group input:focus,
	.form-group select:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: var(--color-brand-medium);
		box-shadow: 0 0 0 2px var(--input-focus-ring);
	}

	.form-group textarea {
		resize: vertical;
	}

	.manual-input {
		margin-top: 0.5rem;
		font-size: 0.8rem !important;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-gray-200);
	}

	.form-error {
		background: var(--color-error-light);
		color: var(--color-error-dark);
		padding: 0.75rem 1rem;
		margin-bottom: 1rem;
		font-size: 0.9rem;
	}

	.form-success {
		background: var(--color-success-light);
		color: var(--color-success-dark);
		padding: 0.75rem 1rem;
		margin-bottom: 1rem;
		font-size: 0.9rem;
	}

	.delete-warning {
		color: var(--color-error);
		font-size: 0.85rem;
		margin-top: 0.5rem;
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

		.card-actions {
			flex-wrap: wrap;
		}
	}
</style>
