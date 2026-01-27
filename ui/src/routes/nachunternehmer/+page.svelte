<script lang="ts">
	import { Card, Badge, KPICard } from '$lib/components/ui';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';

	// Types
	interface Nachunternehmer {
		id: string;
		kontakt_nr: number;
		firma_kurz: string;
		firma_lang: string | null;
		email: string | null;
		telefon_mobil: string | null;
		telefon_festnetz: string | null;
		strasse: string | null;
		plz: string | null;
		ort: string | null;
		aktiv: boolean;
		compliance_docs: Record<string, NachweisDokument> | null;
		created_at: string;
		// NU-spezifische Felder (aus kontakte_nachunternehmer)
		gewerke: string[] | null;
		hauptgewerk: string | null;
		compliance_status: string | null;
		bewertung_qualitaet: number | null;
		bewertung_termintreue: number | null;
		bewertung_kommunikation: number | null;
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

	// State
	let loading = $state(true);
	let error = $state<string | null>(null);
	let activeTab = $state<'alle' | 'aktiv' | 'qualifizierung' | 'nachweise' | 'warnungen'>('alle');
	let searchQuery = $state('');
	let filterGewerk = $state<string>('alle');
	let selectedNU = $state<Nachunternehmer | null>(null);

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
					email,
					telefon_mobil,
					telefon_festnetz,
					strasse,
					plz,
					ort,
					aktiv,
					compliance_docs,
					created_at,
					kontakte_nachunternehmer (
						gewerke,
						hauptgewerk,
						compliance_status,
						bewertung_qualitaet,
						bewertung_termintreue,
						bewertung_kommunikation
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
					email: k.email,
					telefon_mobil: k.telefon_mobil,
					telefon_festnetz: k.telefon_festnetz,
					strasse: k.strasse,
					plz: k.plz,
					ort: k.ort,
					aktiv: k.aktiv ?? true,
					compliance_docs: k.compliance_docs,
					created_at: k.created_at,
					// NU-Details aus Join
					gewerke: k.kontakte_nachunternehmer?.[0]?.gewerke || null,
					hauptgewerk: k.kontakte_nachunternehmer?.[0]?.hauptgewerk || null,
					compliance_status: k.kontakte_nachunternehmer?.[0]?.compliance_status || null,
					bewertung_qualitaet: k.kontakte_nachunternehmer?.[0]?.bewertung_qualitaet || null,
					bewertung_termintreue: k.kontakte_nachunternehmer?.[0]?.bewertung_termintreue || null,
					bewertung_kommunikation: k.kontakte_nachunternehmer?.[0]?.bewertung_kommunikation || null,
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

	// === Erinnerungs-Logik (vorbereitet) ===

	interface NachweisErinnerung {
		nu: Nachunternehmer;
		nachweisTyp: string;
		nachweisLabel: string;
		status: NachweisStatus;
		gueltigBis: string | null;
		tageVerbleibend: number | null;
	}

	function getErinnerungen(): NachweisErinnerung[] {
		const erinnerungen: NachweisErinnerung[] = [];

		nachunternehmer.forEach(nu => {
			NACHWEIS_TYPEN.filter(n => n.pflicht).forEach(nachweis => {
				const status = getNachweisStatus(nu, nachweis.key);
				if (status === 'ungueltig' || status === 'bald_ungueltig' || status === 'fehlend') {
					const doc = nu.compliance_docs?.[nachweis.key];
					let tageVerbleibend: number | null = null;

					if (doc?.gueltig_bis) {
						const gueltigBis = new Date(doc.gueltig_bis);
						tageVerbleibend = Math.ceil((gueltigBis.getTime() - heute.getTime()) / (1000 * 60 * 60 * 24));
					}

					erinnerungen.push({
						nu,
						nachweisTyp: nachweis.key,
						nachweisLabel: nachweis.label,
						status,
						gueltigBis: doc?.gueltig_bis || null,
						tageVerbleibend
					});
				}
			});
		});

		// Sortieren: Ungültig zuerst, dann nach verbleibenden Tagen
		return erinnerungen.sort((a, b) => {
			if (a.status === 'ungueltig' && b.status !== 'ungueltig') return -1;
			if (b.status === 'ungueltig' && a.status !== 'ungueltig') return 1;
			if (a.tageVerbleibend === null) return 1;
			if (b.tageVerbleibend === null) return -1;
			return a.tageVerbleibend - b.tageVerbleibend;
		});
	}

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
		<h1>Nachunternehmer</h1>
		<p class="subtitle">Verwaltung und Qualifizierung</p>
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
			<div class="empty-state">Keine Nachunternehmer gefunden</div>
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
							<th class="th-action">Aktion</th>
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
								<td>
									{#if fehlende.length > 0 && nu.email}
										<a href={generateReminderEmail(nu, fehlende)} class="btn-remind" title="Erinnerung senden">
											Erinnern
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

						<!-- Gemeinsame Projekte Button -->
						{#if nu.projekte.length > 0}
							<button class="btn-projekte" onclick={() => selectedNU = nu}>
								Projekte anzeigen ({nu.projekte.length})
							</button>
						{/if}
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
				{@const zeitraum = getProjektZeitraum(selectedNU.projekte)}
				{#if zeitraum}
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

<style>
	.nu-page {
		max-width: 1400px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 1.5rem;
	}

	.page-header h1 {
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

	/* Projekte Button */
	.btn-projekte {
		margin-top: 0.5rem;
		padding: 0.5rem 1rem;
		background: var(--color-gray-100);
		border: 1px solid var(--color-gray-200);
		border-radius: 0.25rem;
		cursor: pointer;
		font-size: 0.8rem;
		transition: all 0.15s;
	}

	.btn-projekte:hover {
		background: var(--color-gray-200);
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
		min-width: 80px;
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

	.modal-body {
		padding: 1.5rem;
		overflow-y: auto;
	}

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
	}
</style>
