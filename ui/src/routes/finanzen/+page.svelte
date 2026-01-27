<script lang="ts">
	import { Card, Badge, KPICard } from '$lib/components/ui';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';

	// State mit Svelte 5 Runes
	let loading = $state(true);
	let error = $state<string | null>(null);
	let activeTab = $state<'offen' | 'alle' | 'abgleich' | 'forecast' | 'phasen'>('offen');
	let filterTyp = $state<'alle' | 'AR' | 'ER'>('alle');

	// KPI-Daten
	let stats = $state({
		arOffenSumme: 0,
		arOffenAnzahl: 0,
		arBezahltSumme: 0,
		arBezahltAnzahl: 0,
		erOffenSumme: 0,
		erOffenAnzahl: 0,
		erBezahltSumme: 0,
		erBezahltAnzahl: 0
	});

	// Rechnungen
	let rechnungen = $state<Array<{
		id: string;
		dokument_nr: string;
		atbs_nummer: string;
		art_des_dokuments: string;
		betrag_brutto: number;
		betrag_netto: number;
		betrag_offen: number;
		status: string;
		datum_erstellt: string;
		datum_zahlungsfrist: string;
		rechnungssteller: string;
		projektname: string;
	}>>([]);

	// Zahlungen (AR-Zahl, ER-Zahl)
	let zahlungen = $state<Array<{
		id: string;
		dokument_nr: string;
		atbs_nummer: string;
		art_des_dokuments: string;
		betrag_brutto: number;
		datum_erstellt: string;
		rechnungssteller: string;
		projektname: string;
	}>>([]);

	// Phasen-Statistiken
	let phasenStats = $state<Array<{
		phase: string;
		anzahl_projekte: number;
		umsatz_ar: number;
		kosten_er: number;
		marge: number;
	}>>([]);

	// Forecast-Daten
	let forecastData = $state({
		erwarteteEinnahmen: 0,
		erwarteteAusgaben: 0,
		nettoPosition: 0,
		monat1: { einnahmen: 0, ausgaben: 0 },
		monat2: { einnahmen: 0, ausgaben: 0 },
		monat3: { einnahmen: 0, ausgaben: 0 }
	});

	// Abgleich-State
	let selectedZahlung = $state<string | null>(null);
	let abgleichFilter = $state<'alle' | 'offen'>('offen');

	// Derived: Gefilterte Rechnungen (nur echte Rechnungen, keine Zahlungen)
	let gefilterteRechnungen = $derived.by(() => {
		let filtered = rechnungen.filter(r => !r.art_des_dokuments?.includes('-Zahl'));

		// Tab-Filter
		if (activeTab === 'offen') {
			filtered = filtered.filter(r => r.status !== '(5) Bezahlt');
		}

		// Typ-Filter
		if (filterTyp === 'AR') {
			filtered = filtered.filter(r => r.art_des_dokuments?.startsWith('AR-'));
		} else if (filterTyp === 'ER') {
			filtered = filtered.filter(r => r.art_des_dokuments?.startsWith('ER-'));
		}

		return filtered;
	});

	// Derived: Offene Rechnungen für Abgleich
	let offeneRechnungen = $derived.by(() => {
		return rechnungen.filter(r =>
			!r.art_des_dokuments?.includes('-Zahl') &&
			r.status !== '(5) Bezahlt'
		);
	});

	// Derived: Zahlungen ohne ATBS (nicht zugeordnet)
	let offeneZahlungen = $derived.by(() => {
		if (abgleichFilter === 'offen') {
			return zahlungen.filter(z => !z.atbs_nummer || z.atbs_nummer.trim() === '' || z.atbs_nummer === ' ');
		}
		return zahlungen;
	});

	// Derived: Max-Wert für Cashflow-Chart
	let forecastMaxValue = $derived(Math.max(
		forecastData.monat1.einnahmen,
		forecastData.monat1.ausgaben,
		forecastData.monat2.einnahmen,
		forecastData.monat2.ausgaben,
		forecastData.monat3.einnahmen,
		forecastData.monat3.ausgaben,
		1
	));

	// Daten laden
	async function loadData() {
		loading = true;
		error = null;

		try {
			// KPIs laden - echte Rechnungen (nicht Zahlungen)
			const { data: kpiData, error: kpiError } = await supabase.rpc('get_finanzen_kpis');

			if (kpiError) {
				// Fallback: Direkte Query wenn RPC nicht existiert
				const { data: rawStats } = await supabase
					.from('softr_dokumente')
					.select('art_des_dokuments, betrag_brutto, status')
					.or('art_des_dokuments.like.AR-A%,art_des_dokuments.like.AR-S%,art_des_dokuments.like.ER-NU-%');

				if (rawStats) {
					// AR = Ausgangsrechnungen (Schluss + Abschlag)
					const arDocs = rawStats.filter(d =>
						d.art_des_dokuments?.includes('AR-A') ||
						d.art_des_dokuments?.includes('AR-S')
					);
					const arOffen = arDocs.filter(d => d.status !== '(5) Bezahlt');
					const arBezahlt = arDocs.filter(d => d.status === '(5) Bezahlt');

					// ER = Eingangsrechnungen NU
					const erDocs = rawStats.filter(d => d.art_des_dokuments?.includes('ER-NU-'));
					const erOffen = erDocs.filter(d => d.status !== '(5) Bezahlt');
					const erBezahlt = erDocs.filter(d => d.status === '(5) Bezahlt');

					stats = {
						arOffenSumme: arOffen.reduce((sum, d) => sum + (d.betrag_brutto || 0), 0),
						arOffenAnzahl: arOffen.length,
						arBezahltSumme: arBezahlt.reduce((sum, d) => sum + (d.betrag_brutto || 0), 0),
						arBezahltAnzahl: arBezahlt.length,
						erOffenSumme: erOffen.reduce((sum, d) => sum + (d.betrag_brutto || 0), 0),
						erOffenAnzahl: erOffen.length,
						erBezahltSumme: erBezahlt.reduce((sum, d) => sum + (d.betrag_brutto || 0), 0),
						erBezahltAnzahl: erBezahlt.length
					};
				}
			} else if (kpiData) {
				stats = kpiData;
			}

			// Rechnungen laden (echte Rechnungen)
			const { data: rechnungenData, error: rechnungenError } = await supabase
				.from('softr_dokumente')
				.select('id, dokument_nr, atbs_nummer, art_des_dokuments, betrag_brutto, betrag_netto, betrag_offen, status, datum_erstellt, datum_zahlungsfrist, rechnungssteller, projektname')
				.or('art_des_dokuments.like.AR-%,art_des_dokuments.like.ER-%')
				.order('datum_erstellt', { ascending: false })
				.limit(1000);

			if (rechnungenError) throw rechnungenError;
			rechnungen = rechnungenData || [];

			// Zahlungen separat laden (AR-Zahl, ER-Zahl)
			const { data: zahlungenData, error: zahlungenError } = await supabase
				.from('softr_dokumente')
				.select('id, dokument_nr, atbs_nummer, art_des_dokuments, betrag_brutto, datum_erstellt, rechnungssteller, projektname')
				.or('art_des_dokuments.like.AR-Zahl%,art_des_dokuments.like.ER-Zahl%')
				.order('datum_erstellt', { ascending: false })
				.limit(500);

			if (zahlungenError) throw zahlungenError;
			zahlungen = zahlungenData || [];

			// Phasen-Statistiken laden
			await loadPhasenStats();

			// Forecast berechnen
			calculateForecast();

		} catch (err) {
			error = err instanceof Error ? err.message : 'Fehler beim Laden';
			console.error('Finanzen laden fehlgeschlagen:', err);
		} finally {
			loading = false;
		}
	}

	// Phasen-Statistiken laden
	async function loadPhasenStats() {
		try {
			const { data, error: phasenError } = await supabase
				.from('monday_bauprozess')
				.select('name, group_title');

			if (phasenError) throw phasenError;

			// Projekte nach Phase gruppieren
			const phasenMap = new Map<string, { projekte: Set<string>; umsatz: number; kosten: number }>();

			// Alle Phasen initialisieren
			const allePhasen = [
				'(0) Bedarfsanalyse',
				'(2.1) Auftrag erhalten, Erstellung AB',
				'(4) Bauphase',
				'(5) Rechnungsstellung',
				'(7) Projekt abgeschlossen',
				'(9) Auftrag nicht erhalten'
			];

			allePhasen.forEach(p => {
				phasenMap.set(p, { projekte: new Set(), umsatz: 0, kosten: 0 });
			});

			// Projekte den Phasen zuordnen
			(data || []).forEach((item: { name: string; group_title: string }) => {
				const phase = item.group_title;
				if (phasenMap.has(phase)) {
					phasenMap.get(phase)!.projekte.add(item.name);
				}
			});

			// Umsatz und Kosten aus Rechnungen berechnen
			rechnungen.forEach(r => {
				if (!r.projektname || r.art_des_dokuments?.includes('-Zahl')) return;

				// Finde die Phase für das Projekt
				const mondayItem = data?.find((m: { name: string }) => m.name === r.projektname);
				if (mondayItem && phasenMap.has(mondayItem.group_title)) {
					const phaseData = phasenMap.get(mondayItem.group_title)!;
					if (r.art_des_dokuments?.startsWith('AR-')) {
						phaseData.umsatz += Number(r.betrag_brutto) || 0;
					} else if (r.art_des_dokuments?.startsWith('ER-')) {
						phaseData.kosten += Math.abs(Number(r.betrag_brutto) || 0);
					}
				}
			});

			// In Array umwandeln
			phasenStats = Array.from(phasenMap.entries())
				.map(([phase, data]) => ({
					phase,
					anzahl_projekte: data.projekte.size,
					umsatz_ar: data.umsatz,
					kosten_er: data.kosten,
					marge: data.umsatz - data.kosten
				}))
				.filter(p => p.anzahl_projekte > 0 || p.umsatz_ar > 0 || p.kosten_er > 0)
				.sort((a, b) => a.phase.localeCompare(b.phase));

		} catch (err) {
			console.error('Phasen-Stats laden fehlgeschlagen:', err);
		}
	}

	// Forecast berechnen
	function calculateForecast() {
		const heute = new Date();
		const monat1Ende = new Date(heute.getFullYear(), heute.getMonth() + 1, 0);
		const monat2Ende = new Date(heute.getFullYear(), heute.getMonth() + 2, 0);
		const monat3Ende = new Date(heute.getFullYear(), heute.getMonth() + 3, 0);

		let einnahmenTotal = 0;
		let ausgabenTotal = 0;
		const monat1 = { einnahmen: 0, ausgaben: 0 };
		const monat2 = { einnahmen: 0, ausgaben: 0 };
		const monat3 = { einnahmen: 0, ausgaben: 0 };

		// Offene Rechnungen durchgehen
		rechnungen.forEach(r => {
			if (r.status === '(5) Bezahlt' || r.art_des_dokuments?.includes('-Zahl')) return;

			const betrag = Math.abs(Number(r.betrag_offen) || Number(r.betrag_brutto) || 0);
			const frist = r.datum_zahlungsfrist ? new Date(r.datum_zahlungsfrist) : new Date(r.datum_erstellt);

			// AR = Einnahmen
			if (r.art_des_dokuments?.startsWith('AR-')) {
				einnahmenTotal += betrag;
				if (frist <= monat1Ende) {
					monat1.einnahmen += betrag;
				} else if (frist <= monat2Ende) {
					monat2.einnahmen += betrag;
				} else if (frist <= monat3Ende) {
					monat3.einnahmen += betrag;
				}
			}
			// ER = Ausgaben
			else if (r.art_des_dokuments?.startsWith('ER-')) {
				ausgabenTotal += betrag;
				if (frist <= monat1Ende) {
					monat1.ausgaben += betrag;
				} else if (frist <= monat2Ende) {
					monat2.ausgaben += betrag;
				} else if (frist <= monat3Ende) {
					monat3.ausgaben += betrag;
				}
			}
		});

		forecastData = {
			erwarteteEinnahmen: einnahmenTotal,
			erwarteteAusgaben: ausgabenTotal,
			nettoPosition: einnahmenTotal - ausgabenTotal,
			monat1,
			monat2,
			monat3
		};
	}

	onMount(() => {
		loadData();
	});

	function formatCurrency(value: number | null): string {
		if (value === null || value === undefined) return '-';
		return new Intl.NumberFormat('de-DE', {
			style: 'currency',
			currency: 'EUR',
			minimumFractionDigits: 2
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

	// Kurzform fuer Dokumenttyp
	function shortArt(art: string | null): string {
		if (!art) return '-';
		// "AR-S  Ausgangsrechnung - Schluss" -> "AR-S"
		return art.split(' ')[0];
	}

	// Badge-Variante basierend auf Dokumenttyp
	function getArtVariant(art: string | null): 'info' | 'warning' | 'success' | 'error' | 'default' {
		if (!art) return 'default';
		if (art.includes('AR-S')) return 'success';
		if (art.includes('AR-A')) return 'info';
		if (art.includes('AR-X')) return 'error';
		if (art.includes('AR-Zahl')) return 'success';
		if (art.includes('ER-NU')) return 'warning';
		if (art.includes('ER-Zahl')) return 'error';
		return 'default';
	}

	// Status-Badge
	function getStatusVariant(status: string | null): 'success' | 'warning' | 'error' | 'default' {
		if (!status) return 'default';
		if (status === '(5) Bezahlt') return 'success';
		if (status === '(2) Teilzahlung') return 'warning';
		if (status === '(1) Offen') return 'error';
		return 'default';
	}

	function getStatusLabel(status: string | null): string {
		if (!status) return 'Unbekannt';
		// "(5) Bezahlt" -> "Bezahlt"
		return status.replace(/^\(\d+\)\s*/, '');
	}

	// Monatsnamen für Forecast
	function getMonthName(offset: number): string {
		const date = new Date();
		date.setMonth(date.getMonth() + offset);
		return date.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
	}

	// Balken-Breite für Forecast-Chart (max 100%)
	function getBarWidth(value: number, max: number): string {
		if (max === 0) return '0%';
		return `${Math.min(100, (value / max) * 100)}%`;
	}

	// Phasen-Badge Farbe
	function getPhasenColor(phase: string): string {
		if (phase.includes('(0)')) return 'var(--status-0-bg)';
		if (phase.includes('(2')) return 'var(--status-2-bg)';
		if (phase.includes('(4)')) return 'var(--status-4-bg)';
		if (phase.includes('(5)')) return 'var(--status-5-bg)';
		if (phase.includes('(7)')) return 'var(--status-6-bg)';
		if (phase.includes('(9)')) return 'var(--color-gray-100)';
		return 'var(--color-gray-100)';
	}

	// Phasen-Label kürzen
	function shortPhase(phase: string): string {
		return phase.split(')')[0] + ')';
	}
</script>

<div class="finanzen-page">
	<header class="page-header">
		<h1>Finanzen</h1>
		<p class="subtitle">Rechnungen und Zahlungen</p>
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
			label="Offene AR (Ausgang)"
			value={loading ? '...' : formatCurrency(stats.arOffenSumme)}
			subvalue={loading ? '' : `${stats.arOffenAnzahl} Rechnungen`}
			icon="AR"
			color="red"
		/>
		<KPICard
			label="Bezahlte AR"
			value={loading ? '...' : formatCurrency(stats.arBezahltSumme)}
			subvalue={loading ? '' : `${stats.arBezahltAnzahl} Rechnungen`}
			icon="OK"
			color="green"
		/>
		<KPICard
			label="Offene ER (NU)"
			value={loading ? '...' : formatCurrency(stats.erOffenSumme)}
			subvalue={loading ? '' : `${stats.erOffenAnzahl} Rechnungen`}
			icon="ER"
			color="orange"
		/>
		<KPICard
			label="Bezahlte ER"
			value={loading ? '...' : formatCurrency(stats.erBezahltSumme)}
			subvalue={loading ? '' : `${stats.erBezahltAnzahl} Rechnungen`}
			icon="OK"
			color="blue"
		/>
	</section>

	<!-- Tabs -->
	<div class="tabs">
		<button
			class="tab"
			class:active={activeTab === 'offen'}
			onclick={() => activeTab = 'offen'}
		>
			Offene Rechnungen
		</button>
		<button
			class="tab"
			class:active={activeTab === 'alle'}
			onclick={() => activeTab = 'alle'}
		>
			Alle Rechnungen
		</button>
		<button
			class="tab"
			class:active={activeTab === 'abgleich'}
			onclick={() => activeTab = 'abgleich'}
		>
			Zahlungsabgleich
		</button>
		<button
			class="tab"
			class:active={activeTab === 'forecast'}
			onclick={() => activeTab = 'forecast'}
		>
			Forecast
		</button>
		<button
			class="tab"
			class:active={activeTab === 'phasen'}
			onclick={() => activeTab = 'phasen'}
		>
			Nach Phasen
		</button>
	</div>

	<!-- Tab: Offene Rechnungen / Alle Rechnungen -->
	{#if activeTab === 'offen' || activeTab === 'alle'}
		<!-- Filter -->
		<div class="filter-bar">
			<label class="filter-group">
				<span>Typ:</span>
				<select bind:value={filterTyp}>
					<option value="alle">Alle</option>
					<option value="AR">Ausgangsrechnungen (AR)</option>
					<option value="ER">Eingangsrechnungen (ER)</option>
				</select>
			</label>
			<span class="result-count">
				{gefilterteRechnungen.length} Dokumente
			</span>
		</div>

		<!-- Rechnungs-Tabelle -->
		<Card padding="none">
			{#if loading}
				<div class="loading-state">Lade Daten...</div>
			{:else if gefilterteRechnungen.length === 0}
				<div class="empty-state">Keine Dokumente gefunden</div>
			{:else}
				<table class="rechnungen-table">
					<thead>
						<tr>
							<th>Dok-Nr.</th>
							<th>BV</th>
							<th>Typ</th>
							<th>Betrag</th>
							<th>Datum</th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody>
						{#each gefilterteRechnungen as re (re.id)}
							<tr>
								<td class="re-nr">{re.dokument_nr || '-'}</td>
								<td class="atbs">{re.atbs_nummer || '-'}</td>
								<td>
									<Badge variant={getArtVariant(re.art_des_dokuments)} size="sm">
										{shortArt(re.art_des_dokuments)}
									</Badge>
								</td>
								<td class="betrag" class:negativ={re.betrag_brutto < 0}>
									{formatCurrency(re.betrag_brutto)}
								</td>
								<td>{formatDate(re.datum_erstellt)}</td>
								<td>
									<Badge variant={getStatusVariant(re.status)} size="sm">
										{getStatusLabel(re.status)}
									</Badge>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</Card>

		<!-- Legende -->
		<div class="legende">
			<h4>Dokumenttypen:</h4>
			<div class="legende-items">
				<span><Badge variant="success" size="sm">AR-S</Badge> Schlussrechnung (Ausgang)</span>
				<span><Badge variant="info" size="sm">AR-A</Badge> Abschlagsrechnung (Ausgang)</span>
				<span><Badge variant="warning" size="sm">ER-NU</Badge> Eingangsrechnung NU</span>
				<span><Badge variant="error" size="sm">AR-X</Badge> Storno</span>
			</div>
		</div>
	{/if}

	<!-- Tab: Zahlungsabgleich -->
	{#if activeTab === 'abgleich'}
		<div class="abgleich-container">
			<!-- Filter -->
			<div class="filter-bar">
				<label class="filter-group">
					<span>Zahlungen:</span>
					<select bind:value={abgleichFilter}>
						<option value="offen">Nur nicht zugeordnete</option>
						<option value="alle">Alle Zahlungen</option>
					</select>
				</label>
				<span class="result-count">
					{offeneZahlungen.length} Zahlungen | {offeneRechnungen.length} offene Rechnungen
				</span>
			</div>

			<div class="abgleich-grid">
				<!-- Linke Spalte: Zahlungen -->
				<div class="abgleich-column">
					<h3 class="column-header">
						<span class="icon">&#8592;</span> Zahlungseingänge/-ausgänge
					</h3>
					<div class="abgleich-list">
						{#if loading}
							<div class="loading-state">Lade...</div>
						{:else if offeneZahlungen.length === 0}
							<div class="empty-state">Keine offenen Zahlungen</div>
						{:else}
							{#each offeneZahlungen as z (z.id)}
								<div
									class="abgleich-item"
									class:selected={selectedZahlung === z.id}
									class:eingang={z.art_des_dokuments?.includes('AR-Zahl')}
									class:ausgang={z.art_des_dokuments?.includes('ER-Zahl')}
									onclick={() => selectedZahlung = selectedZahlung === z.id ? null : z.id}
								>
									<div class="item-header">
										<span class="item-nr">{z.dokument_nr}</span>
										<Badge variant={z.art_des_dokuments?.includes('AR-Zahl') ? 'success' : 'error'} size="sm">
											{z.art_des_dokuments?.includes('AR-Zahl') ? 'Eingang' : 'Ausgang'}
										</Badge>
									</div>
									<div class="item-betrag" class:positiv={Number(z.betrag_brutto) > 0} class:negativ={Number(z.betrag_brutto) < 0}>
										{formatCurrency(z.betrag_brutto)}
									</div>
									<div class="item-meta">
										<span>{z.rechnungssteller || '-'}</span>
										<span>{formatDate(z.datum_erstellt)}</span>
									</div>
									{#if z.atbs_nummer && z.atbs_nummer.trim() !== '' && z.atbs_nummer !== ' '}
										<div class="item-zugeordnet">
											<Badge variant="info" size="sm">&#10003; {z.atbs_nummer}</Badge>
										</div>
									{/if}
								</div>
							{/each}
						{/if}
					</div>
				</div>

				<!-- Rechte Spalte: Offene Rechnungen -->
				<div class="abgleich-column">
					<h3 class="column-header">
						<span class="icon">&#8594;</span> Offene Rechnungen
					</h3>
					<div class="abgleich-list">
						{#if loading}
							<div class="loading-state">Lade...</div>
						{:else if offeneRechnungen.length === 0}
							<div class="empty-state">Keine offenen Rechnungen</div>
						{:else}
							{#each offeneRechnungen.slice(0, 50) as re (re.id)}
								<div
									class="abgleich-item"
									class:ar={re.art_des_dokuments?.startsWith('AR-')}
									class:er={re.art_des_dokuments?.startsWith('ER-')}
								>
									<div class="item-header">
										<span class="item-nr">{re.dokument_nr}</span>
										<Badge variant={getArtVariant(re.art_des_dokuments)} size="sm">
											{shortArt(re.art_des_dokuments)}
										</Badge>
									</div>
									<div class="item-betrag">
										{formatCurrency(re.betrag_brutto)}
									</div>
									<div class="item-meta">
										<span>{re.rechnungssteller || '-'}</span>
										<span>{formatDate(re.datum_erstellt)}</span>
									</div>
									{#if re.atbs_nummer && re.atbs_nummer.trim() !== ''}
										<div class="item-atbs">{re.atbs_nummer}</div>
									{/if}
								</div>
							{/each}
						{/if}
					</div>
				</div>
			</div>

			<div class="abgleich-info">
				<strong>Hinweis:</strong> Der automatische Zahlungsabgleich erfolgt per Trigger bei jeder neuen Zahlung.
				Dabei werden ATBS-Nr. und Rechnungsnummern aus dem Verwendungszweck extrahiert.
			</div>
		</div>
	{/if}

	<!-- Tab: Forecast -->
	{#if activeTab === 'forecast'}
		<div class="forecast-container">
			<!-- KPI-Cards für Forecast -->
			<div class="forecast-kpis">
				<KPICard
					label="Erwartete Einnahmen"
					value={loading ? '...' : formatCurrency(forecastData.erwarteteEinnahmen)}
					subvalue="aus offenen AR"
					icon="+"
					color="green"
				/>
				<KPICard
					label="Erwartete Ausgaben"
					value={loading ? '...' : formatCurrency(forecastData.erwarteteAusgaben)}
					subvalue="aus offenen ER"
					icon="-"
					color="red"
				/>
				<KPICard
					label="Netto-Position"
					value={loading ? '...' : formatCurrency(forecastData.nettoPosition)}
					subvalue={forecastData.nettoPosition >= 0 ? 'positiv' : 'negativ'}
					icon="="
					color={forecastData.nettoPosition >= 0 ? 'green' : 'red'}
				/>
			</div>

			<!-- Cashflow-Chart (3 Monate) -->
			<Card>
				<h3 class="chart-title">Cashflow-Projektion (3 Monate)</h3>
				<div class="cashflow-chart">
					<!-- Monat 1 -->
					<div class="chart-row">
						<div class="chart-label">{getMonthName(1)}</div>
						<div class="chart-bars">
							<div class="bar-container">
								<div class="bar einnahmen" style="width: {getBarWidth(forecastData.monat1.einnahmen, forecastMaxValue)}">
									<span class="bar-value">{formatCurrency(forecastData.monat1.einnahmen)}</span>
								</div>
							</div>
							<div class="bar-container">
								<div class="bar ausgaben" style="width: {getBarWidth(forecastData.monat1.ausgaben, forecastMaxValue)}">
									<span class="bar-value">{formatCurrency(forecastData.monat1.ausgaben)}</span>
								</div>
							</div>
						</div>
						<div class="chart-netto" class:positiv={forecastData.monat1.einnahmen - forecastData.monat1.ausgaben >= 0}>
							{formatCurrency(forecastData.monat1.einnahmen - forecastData.monat1.ausgaben)}
						</div>
					</div>

					<!-- Monat 2 -->
					<div class="chart-row">
						<div class="chart-label">{getMonthName(2)}</div>
						<div class="chart-bars">
							<div class="bar-container">
								<div class="bar einnahmen" style="width: {getBarWidth(forecastData.monat2.einnahmen, forecastMaxValue)}">
									<span class="bar-value">{formatCurrency(forecastData.monat2.einnahmen)}</span>
								</div>
							</div>
							<div class="bar-container">
								<div class="bar ausgaben" style="width: {getBarWidth(forecastData.monat2.ausgaben, forecastMaxValue)}">
									<span class="bar-value">{formatCurrency(forecastData.monat2.ausgaben)}</span>
								</div>
							</div>
						</div>
						<div class="chart-netto" class:positiv={forecastData.monat2.einnahmen - forecastData.monat2.ausgaben >= 0}>
							{formatCurrency(forecastData.monat2.einnahmen - forecastData.monat2.ausgaben)}
						</div>
					</div>

					<!-- Monat 3 -->
					<div class="chart-row">
						<div class="chart-label">{getMonthName(3)}</div>
						<div class="chart-bars">
							<div class="bar-container">
								<div class="bar einnahmen" style="width: {getBarWidth(forecastData.monat3.einnahmen, forecastMaxValue)}">
									<span class="bar-value">{formatCurrency(forecastData.monat3.einnahmen)}</span>
								</div>
							</div>
							<div class="bar-container">
								<div class="bar ausgaben" style="width: {getBarWidth(forecastData.monat3.ausgaben, forecastMaxValue)}">
									<span class="bar-value">{formatCurrency(forecastData.monat3.ausgaben)}</span>
								</div>
							</div>
						</div>
						<div class="chart-netto" class:positiv={forecastData.monat3.einnahmen - forecastData.monat3.ausgaben >= 0}>
							{formatCurrency(forecastData.monat3.einnahmen - forecastData.monat3.ausgaben)}
						</div>
					</div>
				</div>

				<div class="chart-legend">
					<span class="legend-item"><span class="legend-color einnahmen"></span> Einnahmen (AR)</span>
					<span class="legend-item"><span class="legend-color ausgaben"></span> Ausgaben (ER)</span>
				</div>
			</Card>
		</div>
	{/if}

	<!-- Tab: Nach Phasen -->
	{#if activeTab === 'phasen'}
		<div class="phasen-container">
			<Card>
				<h3 class="section-title">Finanzen nach BV-Phase</h3>
				{#if loading}
					<div class="loading-state">Lade Phasen-Statistiken...</div>
				{:else if phasenStats.length === 0}
					<div class="empty-state">Keine Phasen-Daten vorhanden</div>
				{:else}
					<table class="phasen-table">
						<thead>
							<tr>
								<th>Phase</th>
								<th class="align-center">Projekte</th>
								<th class="align-right">Umsatz (AR)</th>
								<th class="align-right">Kosten (ER)</th>
								<th class="align-right">Marge</th>
							</tr>
						</thead>
						<tbody>
							{#each phasenStats as phase (phase.phase)}
								<tr>
									<td>
										<span class="phase-badge" style="background: {getPhasenColor(phase.phase)}">
											{shortPhase(phase.phase)}
										</span>
										<span class="phase-name">{phase.phase.split(')')[1]?.trim() || ''}</span>
									</td>
									<td class="align-center">{phase.anzahl_projekte}</td>
									<td class="align-right betrag">{formatCurrency(phase.umsatz_ar)}</td>
									<td class="align-right betrag negativ">{formatCurrency(phase.kosten_er)}</td>
									<td class="align-right betrag" class:positiv={phase.marge >= 0} class:negativ={phase.marge < 0}>
										{formatCurrency(phase.marge)}
									</td>
								</tr>
							{/each}
						</tbody>
						<tfoot>
							<tr>
								<td><strong>Gesamt</strong></td>
								<td class="align-center"><strong>{phasenStats.reduce((sum, p) => sum + p.anzahl_projekte, 0)}</strong></td>
								<td class="align-right betrag"><strong>{formatCurrency(phasenStats.reduce((sum, p) => sum + p.umsatz_ar, 0))}</strong></td>
								<td class="align-right betrag negativ"><strong>{formatCurrency(phasenStats.reduce((sum, p) => sum + p.kosten_er, 0))}</strong></td>
								<td class="align-right betrag" class:positiv={phasenStats.reduce((sum, p) => sum + p.marge, 0) >= 0}>
									<strong>{formatCurrency(phasenStats.reduce((sum, p) => sum + p.marge, 0))}</strong>
								</td>
							</tr>
						</tfoot>
					</table>
				{/if}
			</Card>

			<!-- Phasen-Info -->
			<div class="phasen-info">
				<h4>BV-Phasen Übersicht:</h4>
				<div class="phasen-legend">
					<span><span class="phase-dot" style="background: var(--status-0-bg)"></span> (0) Bedarfsanalyse</span>
					<span><span class="phase-dot" style="background: var(--status-2-bg)"></span> (2) Auftrag</span>
					<span><span class="phase-dot" style="background: var(--status-4-bg)"></span> (4) Bauphase</span>
					<span><span class="phase-dot" style="background: var(--status-5-bg)"></span> (5) Rechnungsstellung</span>
					<span><span class="phase-dot" style="background: var(--status-6-bg)"></span> (7) Abgeschlossen</span>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.finanzen-page {
		max-width: 1200px;
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

	.tabs {
		display: flex;
		gap: 0;
		margin-bottom: 1rem;
		border-bottom: 1px solid var(--color-gray-200);
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
	}

	.tab:hover {
		color: var(--color-gray-700);
	}

	.tab.active {
		color: var(--color-brand-medium);
		border-bottom-color: var(--color-brand-medium);
	}

	.filter-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding: 0.75rem 1rem;
		background: var(--color-gray-50);
		border-radius: 0.5rem;
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

	.loading-state,
	.empty-state {
		padding: 3rem;
		text-align: center;
		color: var(--color-gray-500);
	}

	.rechnungen-table {
		width: 100%;
		border-collapse: collapse;
	}

	.rechnungen-table th {
		text-align: left;
		padding: 0.75rem 1rem;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-gray-500);
		text-transform: uppercase;
		border-bottom: 1px solid var(--color-gray-200);
		background: var(--color-gray-50);
	}

	.rechnungen-table td {
		padding: 1rem;
		border-bottom: 1px solid var(--color-gray-100);
	}

	.rechnungen-table tbody tr:hover {
		background: var(--color-gray-50);
	}

	.re-nr {
		font-family: var(--font-family-mono);
		font-weight: 600;
		font-size: 0.875rem;
	}

	.atbs {
		font-family: var(--font-family-mono);
		font-size: 0.875rem;
		color: var(--color-gray-600);
	}

	.betrag {
		font-family: var(--font-family-mono);
		font-weight: 600;
		text-align: right;
	}

	.betrag.negativ {
		color: var(--color-red-600);
	}

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

	.legende-items {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.legende-items span {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		color: var(--color-gray-600);
	}

	/* ===== Zahlungsabgleich ===== */
	.abgleich-container {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.abgleich-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	@media (max-width: 1024px) {
		.abgleich-grid {
			grid-template-columns: 1fr;
		}
	}

	.abgleich-column {
		background: white;
		border: 1px solid var(--color-gray-200);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}

	.column-header {
		padding: 0.75rem 1rem;
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		background: var(--color-gray-50);
		border-bottom: 1px solid var(--color-gray-200);
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.column-header .icon {
		font-size: 1rem;
		color: var(--color-primary);
	}

	.abgleich-list {
		max-height: 500px;
		overflow-y: auto;
	}

	.abgleich-item {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-gray-100);
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.abgleich-item:hover {
		background: var(--color-gray-50);
	}

	.abgleich-item.selected {
		background: var(--color-primary-50);
		border-left: 3px solid var(--color-primary);
	}

	.abgleich-item.eingang {
		border-left: 3px solid var(--color-success);
	}

	.abgleich-item.ausgang {
		border-left: 3px solid var(--color-error);
	}

	.abgleich-item.ar {
		border-left: 3px solid var(--color-success);
	}

	.abgleich-item.er {
		border-left: 3px solid var(--color-warning);
	}

	.item-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.25rem;
	}

	.item-nr {
		font-family: var(--font-family-mono);
		font-size: 0.875rem;
		font-weight: 600;
	}

	.item-betrag {
		font-family: var(--font-family-mono);
		font-size: 1rem;
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	.item-betrag.positiv {
		color: var(--color-success-dark);
	}

	.item-betrag.negativ {
		color: var(--color-error-dark);
	}

	.item-meta {
		display: flex;
		justify-content: space-between;
		font-size: 0.75rem;
		color: var(--color-gray-500);
	}

	.item-zugeordnet,
	.item-atbs {
		margin-top: 0.25rem;
		font-size: 0.75rem;
	}

	.item-atbs {
		color: var(--color-info);
		font-family: var(--font-family-mono);
	}

	.abgleich-info {
		padding: 1rem;
		background: var(--color-info-light);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		color: var(--color-info-dark);
	}

	/* ===== Forecast ===== */
	.forecast-container {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.forecast-kpis {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
	}

	@media (max-width: 768px) {
		.forecast-kpis {
			grid-template-columns: 1fr;
		}
	}

	.chart-title {
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 1rem 0;
		color: var(--color-gray-700);
	}

	.cashflow-chart {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.chart-row {
		display: grid;
		grid-template-columns: 80px 1fr 100px;
		gap: 1rem;
		align-items: center;
	}

	.chart-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-gray-600);
	}

	.chart-bars {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.bar-container {
		height: 24px;
		background: var(--color-gray-100);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}

	.bar {
		height: 100%;
		display: flex;
		align-items: center;
		padding: 0 0.5rem;
		transition: width 0.3s ease;
		min-width: fit-content;
	}

	.bar.einnahmen {
		background: var(--color-success);
		color: white;
	}

	.bar.ausgaben {
		background: var(--color-error);
		color: white;
	}

	.bar-value {
		font-size: 0.75rem;
		font-family: var(--font-family-mono);
		white-space: nowrap;
	}

	.chart-netto {
		font-family: var(--font-family-mono);
		font-size: 0.875rem;
		font-weight: 600;
		text-align: right;
		color: var(--color-error-dark);
	}

	.chart-netto.positiv {
		color: var(--color-success-dark);
	}

	.chart-legend {
		display: flex;
		gap: 1.5rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-gray-200);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		color: var(--color-gray-600);
	}

	.legend-color {
		width: 12px;
		height: 12px;
		border-radius: 2px;
	}

	.legend-color.einnahmen {
		background: var(--color-success);
	}

	.legend-color.ausgaben {
		background: var(--color-error);
	}

	/* ===== Phasen ===== */
	.phasen-container {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.section-title {
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 1rem 0;
		color: var(--color-gray-700);
	}

	.phasen-table {
		width: 100%;
		border-collapse: collapse;
	}

	.phasen-table th {
		text-align: left;
		padding: 0.75rem 1rem;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-gray-500);
		text-transform: uppercase;
		border-bottom: 2px solid var(--color-gray-200);
		background: var(--color-gray-50);
	}

	.phasen-table td {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-gray-100);
		vertical-align: middle;
	}

	.phasen-table tbody tr:hover {
		background: var(--color-gray-50);
	}

	.phasen-table tfoot td {
		background: var(--color-gray-50);
		border-top: 2px solid var(--color-gray-200);
	}

	.align-center {
		text-align: center;
	}

	.align-right {
		text-align: right;
	}

	.phase-badge {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
		margin-right: 0.5rem;
	}

	.phase-name {
		font-size: 0.875rem;
		color: var(--color-gray-600);
	}

	.positiv {
		color: var(--color-success-dark);
	}

	.phasen-info {
		padding: 1rem;
		background: var(--color-gray-50);
		border-radius: var(--radius-lg);
	}

	.phasen-info h4 {
		font-size: 0.875rem;
		margin: 0 0 0.75rem 0;
		color: var(--color-gray-600);
	}

	.phasen-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.phasen-legend span {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		color: var(--color-gray-600);
	}

	.phase-dot {
		width: 12px;
		height: 12px;
		border-radius: 2px;
	}
</style>
