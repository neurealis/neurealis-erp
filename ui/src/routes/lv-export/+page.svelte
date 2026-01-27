<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { jsPDF } from 'jspdf';
	import autoTable from 'jspdf-autotable';

	// === Typen ===
	interface LVPosition {
		id: string;
		artikelnummer: string;
		bezeichnung: string;
		beschreibung: string | null;
		preis: number | null;
		listenpreis: number | null;
		einheit: string | null;
		gewerk: string | null;
	}

	interface LVTypInfo {
		lv_typ: string;
		anzahl: number;
	}

	// Kunden-LV Konfigurationen (wie Softr)
	const kundenLvConfig: Record<string, { name: string; beschreibung: string; farbe: string }> = {
		'GWS': { name: 'GWS', beschreibung: 'GWS Wohnungsgesellschaft', farbe: '#3B82F6' },
		'VBW': { name: 'VBW', beschreibung: 'VBW Bauen und Wohnen', farbe: '#10B981' },
		'covivio': { name: 'Covivio', beschreibung: 'Covivio Deutschland', farbe: '#F59E0B' },
		'neurealis': { name: 'neurealis', beschreibung: 'neurealis Standard-LV', farbe: '#C41E3A' },
		'Artikel': { name: 'Artikel', beschreibung: 'Artikelstamm / Einkauf', farbe: '#6B7280' },
	};

	// === State ===
	let currentStep = $state(1);
	const totalSteps = 3;

	let isLoading = $state(true);
	let isGenerating = $state(false);
	let lvTypen = $state<LVTypInfo[]>([]);
	let lvPositionen = $state<LVPosition[]>([]);

	// Auswahl
	let selectedLvTyp = $state('');
	let textOption = $state<'kurz' | 'lang'>('kurz');
	let preisOption = $state<'mit' | 'ohne'>('mit');

	// Ergebnis
	let generatedPdfUrl = $state('');
	let generatedFileName = $state('');

	// Berechnete Werte
	let positionenMitPreisCount = $derived(
		lvPositionen.filter(pos =>
			(pos.listenpreis !== null && pos.listenpreis !== undefined && pos.listenpreis > 0) ||
			(pos.preis !== null && pos.preis !== undefined && pos.preis > 0)
		).length
	);

	// === Lifecycle ===
	onMount(async () => {
		await loadLvTypen();
	});

	// === Daten laden ===
	async function loadLvTypen() {
		isLoading = true;
		try {
			const { data, error } = await supabase.rpc('get_lv_typ_counts');

			if (error) {
				// Fallback: Direkter Query
				const { data: fallbackData } = await supabase
					.from('lv_positionen')
					.select('lv_typ')
					.eq('aktiv', true);

				if (fallbackData) {
					const counts: Record<string, number> = {};
					for (const row of fallbackData) {
						counts[row.lv_typ] = (counts[row.lv_typ] || 0) + 1;
					}
					lvTypen = Object.entries(counts)
						.map(([lv_typ, anzahl]) => ({ lv_typ, anzahl }))
						.sort((a, b) => a.lv_typ.localeCompare(b.lv_typ));
				}
			} else {
				lvTypen = data || [];
			}
		} catch (err) {
			console.error('Fehler beim Laden der LV-Typen:', err);
		} finally {
			isLoading = false;
		}
	}

	async function loadPositionen() {
		if (!selectedLvTyp) return;

		isLoading = true;
		try {
			const { data, error } = await supabase
				.from('lv_positionen')
				.select('id, artikelnummer, bezeichnung, beschreibung, preis, listenpreis, einheit, gewerk')
				.eq('lv_typ', selectedLvTyp)
				.eq('aktiv', true)
				.order('gewerk')
				.order('artikelnummer');

			if (!error && data) {
				lvPositionen = data;
			}
		} catch (err) {
			console.error('Fehler beim Laden der Positionen:', err);
		} finally {
			isLoading = false;
		}
	}

	// === Navigation ===
	function canProceed(step: number): boolean {
		switch (step) {
			case 1: return !!selectedLvTyp;
			case 2: return true; // Optionen haben Defaults
			case 3: return true;
			default: return false;
		}
	}

	async function nextStep() {
		if (currentStep === 1 && selectedLvTyp) {
			await loadPositionen();
		}
		if (canProceed(currentStep) && currentStep < totalSteps) {
			currentStep++;
		}
		if (currentStep === 3) {
			await generatePdf();
		}
	}

	function prevStep() {
		if (currentStep > 1) {
			currentStep--;
		}
	}

	// === Hilfsfunktionen ===
	function stripHtml(html: string | null): string {
		if (!html) return '';
		return html
			.replace(/<br\s*\/?>/gi, '\n')
			.replace(/<\/p>/gi, '\n')
			.replace(/<\/li>/gi, '\n')
			.replace(/<li>/gi, '  - ')
			.replace(/<[^>]*>/g, '')
			.replace(/&nbsp;/g, ' ')
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.replace(/\n{3,}/g, '\n\n')
			.trim();
	}

	function formatPreis(preis: number | null): string {
		if (preis === null || preis === undefined) return '-';
		return preis.toLocaleString('de-DE', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}) + ' €';
	}

	function getFileName(): string {
		const heute = new Date();
		const datum = heute.toISOString().split('T')[0];
		const textSuffix = textOption === 'lang' ? 'Langtexte' : 'Kurztexte';
		const preisSuffix = preisOption === 'mit' ? 'mit Preisen' : 'ohne Preise';
		return `${datum} neurealis - Leistungsverzeichnis - ${selectedLvTyp} - ${textSuffix} - ${preisSuffix}.pdf`;
	}

	// === PDF Generierung ===
	async function generatePdf() {
		isGenerating = true;

		try {
			const doc = new jsPDF({
				orientation: 'portrait',
				unit: 'mm',
				format: 'a4'
			});

			const heute = new Date();
			const datumFormatiert = heute.toLocaleDateString('de-DE', {
				day: '2-digit',
				month: '2-digit',
				year: 'numeric'
			});
			const version = `v${heute.getFullYear()}.${String(heute.getMonth() + 1).padStart(2, '0')}.${String(heute.getDate()).padStart(2, '0')}`;

			// Farben
			const primaryColor: [number, number, number] = [26, 54, 93]; // #1a365d
			const accentColor: [number, number, number] = [66, 153, 225]; // #4299e1
			const textColor: [number, number, number] = [45, 55, 72]; // #2d3748
			const grayColor: [number, number, number] = [113, 128, 150]; // #718096

			// Artikel ohne Preise herausfiltern
			const positionenMitPreis = lvPositionen.filter(pos =>
				(pos.listenpreis !== null && pos.listenpreis !== undefined && pos.listenpreis > 0) ||
				(pos.preis !== null && pos.preis !== undefined && pos.preis > 0)
			);

			// Nach Gewerk gruppieren
			const gewerke: Record<string, LVPosition[]> = {};
			for (const pos of positionenMitPreis) {
				const gewerk = pos.gewerk || 'Sonstiges';
				if (!gewerke[gewerk]) gewerke[gewerk] = [];
				gewerke[gewerk].push(pos);
			}

			const sortedGewerke = Object.keys(gewerke).sort();

			// === TITELSEITE (Seite 1) ===
			// Header-Balken
			doc.setFillColor(...primaryColor);
			doc.rect(0, 0, 210, 60, 'F');

			// Titel
			doc.setTextColor(255, 255, 255);
			doc.setFontSize(28);
			doc.setFont('helvetica', 'bold');
			doc.text('LEISTUNGSVERZEICHNIS', 105, 30, { align: 'center' });

			doc.setFontSize(16);
			doc.setFont('helvetica', 'normal');
			doc.text(selectedLvTyp, 105, 45, { align: 'center' });

			// neurealis Logo-Text
			doc.setTextColor(...primaryColor);
			doc.setFontSize(36);
			doc.setFont('helvetica', 'bold');
			doc.text('neurealis GmbH', 105, 90, { align: 'center' });

			// Trennlinie
			doc.setDrawColor(...accentColor);
			doc.setLineWidth(1);
			doc.line(50, 105, 160, 105);

			// Info-Box
			doc.setFillColor(248, 250, 252);
			doc.setDrawColor(226, 232, 240);
			doc.roundedRect(40, 120, 130, 80, 3, 3, 'FD');

			doc.setTextColor(...textColor);
			doc.setFontSize(11);
			doc.setFont('helvetica', 'normal');

			let yPos = 135;
			doc.text('Version:', 55, yPos);
			doc.setFont('helvetica', 'bold');
			doc.text(version, 100, yPos);

			yPos += 15;
			doc.setFont('helvetica', 'normal');
			doc.text('Datum:', 55, yPos);
			doc.setFont('helvetica', 'bold');
			doc.text(datumFormatiert, 100, yPos);

			yPos += 15;
			doc.setFont('helvetica', 'normal');
			doc.text('Positionen:', 55, yPos);
			doc.setFont('helvetica', 'bold');
			doc.text(positionenMitPreis.length.toString(), 100, yPos);

			yPos += 15;
			doc.setFont('helvetica', 'normal');
			doc.text('Textformat:', 55, yPos);
			doc.setFont('helvetica', 'bold');
			doc.text(textOption === 'lang' ? 'Langtexte' : 'Kurztexte', 100, yPos);

			yPos += 15;
			doc.setFont('helvetica', 'normal');
			doc.text('Preise:', 55, yPos);
			doc.setFont('helvetica', 'bold');
			doc.text(preisOption === 'mit' ? 'Ja' : 'Nein', 100, yPos);

			// Kontakt
			doc.setTextColor(...grayColor);
			doc.setFontSize(10);
			doc.setFont('helvetica', 'normal');
			doc.text('neurealis GmbH', 105, 240, { align: 'center' });
			doc.text('Wohnungssanierung & Modernisierung', 105, 247, { align: 'center' });
			doc.text('www.neurealis.de', 105, 254, { align: 'center' });

			// === INHALTSVERZEICHNIS (Seite 2) ===
			doc.addPage();

			// Header
			doc.setFillColor(...primaryColor);
			doc.rect(0, 0, 210, 30, 'F');

			doc.setTextColor(255, 255, 255);
			doc.setFontSize(18);
			doc.setFont('helvetica', 'bold');
			doc.text('INHALTSVERZEICHNIS', 105, 20, { align: 'center' });

			// Inhalt - wir merken uns die Seiten später
			const tocStartY = 50;
			yPos = tocStartY;

			// Platzhalter für TOC-Links (werden später gesetzt)
			const tocEntries: { gewerk: string; y: number }[] = [];

			doc.setTextColor(...textColor);
			doc.setFontSize(11);

			for (const gewerk of sortedGewerke) {
				tocEntries.push({ gewerk, y: yPos });

				doc.setFont('helvetica', 'normal');
				doc.text(gewerk, 25, yPos);

				doc.setFont('helvetica', 'normal');
				doc.text(`${gewerke[gewerk].length} Pos.`, 170, yPos, { align: 'right' });

				// Punktlinie
				doc.setDrawColor(200, 200, 200);
				doc.setLineDash([1, 2], 0);
				doc.line(80, yPos - 1, 155, yPos - 1);
				doc.setLineDash([]);

				yPos += 10;
			}

			// Footer Seite 2
			doc.setTextColor(...grayColor);
			doc.setFontSize(8);
			doc.text(`${selectedLvTyp} Leistungsverzeichnis ${version} - Seite 2`, 105, 290, { align: 'center' });

			// === POSITIONEN - Alle fortlaufend in einer großen Tabelle ===
			doc.addPage();

			// Anzahl der Spalten
			const numCols = preisOption === 'mit' ? 4 : 3;

			// Alle Positionen in einer Tabelle sammeln
			const allTableData: any[][] = [];
			let posNr = 0;

			for (const gewerk of sortedGewerke) {
				// Gewerk-Header als Zeile über volle Breite (colSpan)
				const gewerkRow: any[] = [{
					content: gewerk.toUpperCase(),
					colSpan: numCols,
					styles: {
						fontStyle: 'bold',
						fillColor: [26, 54, 93],
						textColor: [255, 255, 255],
						fontSize: 11,
						halign: 'left',
						cellPadding: { top: 6, bottom: 6, left: 8, right: 8 }
					}
				}];
				allTableData.push(gewerkRow);

				for (const pos of gewerke[gewerk]) {
					posNr++;

					// Text zusammenbauen: Artikelnummer klein + Bezeichnung
					let displayText = '';

					// Artikelnummer als kleine graue Zeile
					if (pos.artikelnummer) {
						displayText = `[${pos.artikelnummer}]\n`;
					}

					// Bezeichnung oder Langtext
					if (textOption === 'lang' && pos.beschreibung) {
						displayText += stripHtml(pos.beschreibung).substring(0, 800);
					} else {
						displayText += pos.bezeichnung || '(ohne Bezeichnung)';
					}

					if (preisOption === 'mit') {
						allTableData.push([
							posNr.toString(),
							displayText,
							pos.einheit || 'Stk',
							formatPreis(pos.listenpreis || pos.preis)
						]);
					} else {
						allTableData.push([
							posNr.toString(),
							displayText,
							pos.einheit || 'Stk'
						]);
					}
				}
			}

			const columns = preisOption === 'mit'
				? ['Nr.', 'Artikel', 'Einheit', 'Preis']
				: ['Nr.', 'Artikel', 'Einheit'];

			const columnStyles = preisOption === 'mit'
				? {
					0: { cellWidth: 12, halign: 'center' as const },
					1: { cellWidth: 'auto' },
					2: { cellWidth: 18, halign: 'center' as const },
					3: { cellWidth: 25, halign: 'right' as const }
				}
				: {
					0: { cellWidth: 12, halign: 'center' as const },
					1: { cellWidth: 'auto' },
					2: { cellWidth: 20, halign: 'center' as const }
				};

			autoTable(doc, {
				head: [columns],
				body: allTableData,
				startY: 15,
				styles: {
					fontSize: 9,
					cellPadding: 4,
					textColor: textColor,
					lineColor: [226, 232, 240],
					lineWidth: 0.1,
					overflow: 'linebreak'
				},
				headStyles: {
					fillColor: [243, 244, 246],
					textColor: [75, 85, 99],
					fontStyle: 'bold',
					fontSize: 9
				},
				alternateRowStyles: {
					fillColor: [252, 252, 253]
				},
				columnStyles: columnStyles,
				margin: { left: 15, right: 15, top: 15, bottom: 20 },
				didParseCell: (data) => {
					// Artikelnummer in eckigen Klammern grau und kleiner darstellen
					if (data.column.index === 1 && data.section === 'body') {
						const rawText = data.cell.raw as string;
						if (rawText && rawText.startsWith('[')) {
							// Erste Zeile ist Artikelnummer - wird automatisch angezeigt
							data.cell.styles.fontSize = 8;
						}
					}
				},
				didDrawPage: () => {
					// Footer auf jeder Seite
					const pageNumber = doc.getNumberOfPages();
					doc.setTextColor(...grayColor);
					doc.setFontSize(8);
					doc.text(
						`${selectedLvTyp} Leistungsverzeichnis ${version} - Seite ${pageNumber}`,
						105, 290,
						{ align: 'center' }
					);
				}
			});

			// === LETZTE SEITE ===
			doc.addPage();

			// Header
			doc.setFillColor(...primaryColor);
			doc.rect(0, 0, 210, 30, 'F');

			doc.setTextColor(255, 255, 255);
			doc.setFontSize(18);
			doc.setFont('helvetica', 'bold');
			doc.text('HINWEISE & KONTAKT', 105, 20, { align: 'center' });

			// Hinweise
			doc.setTextColor(...textColor);
			doc.setFontSize(10);
			doc.setFont('helvetica', 'normal');

			const hinweise = [
				'Alle Preise verstehen sich als Nettopreise zzgl. gesetzlicher MwSt.',
				'Preise gültig ab dem Ausstellungsdatum dieses Dokuments.',
				'Änderungen und Irrtümer vorbehalten.',
				'Für Großprojekte und Rahmenverträge gelten separate Konditionen.',
				'Technische Änderungen der Leistungsbeschreibungen vorbehalten.'
			];

			yPos = 50;
			for (const hinweis of hinweise) {
				doc.text('•  ' + hinweis, 20, yPos);
				yPos += 8;
			}

			// Kontakt-Box
			doc.setFillColor(255, 255, 255);
			doc.setDrawColor(226, 232, 240);
			doc.roundedRect(40, 100, 130, 60, 3, 3, 'FD');

			doc.setTextColor(...primaryColor);
			doc.setFontSize(14);
			doc.setFont('helvetica', 'bold');
			doc.text('neurealis GmbH', 105, 115, { align: 'center' });

			doc.setTextColor(...textColor);
			doc.setFontSize(10);
			doc.setFont('helvetica', 'normal');
			doc.text('Ihr Partner für Wohnungssanierung', 105, 125, { align: 'center' });
			doc.text('E-Mail: kontakt@neurealis.de', 105, 140, { align: 'center' });
			doc.text('Web: www.neurealis.de', 105, 148, { align: 'center' });

			// Copyright
			doc.setTextColor(...grayColor);
			doc.setFontSize(8);
			doc.text(
				`© ${heute.getFullYear()} neurealis GmbH - Alle Rechte vorbehalten`,
				105, 280,
				{ align: 'center' }
			);
			doc.text(
				`Dokumentversion: ${version}`,
				105, 286,
				{ align: 'center' }
			);

			// Seite 2: Inhaltsverzeichnis mit klickbaren Links nachträglich hinzufügen
			doc.setPage(2);
			yPos = tocStartY;

			for (let i = 0; i < sortedGewerke.length; i++) {
				// Link zur Seite 3 (Positionen beginnen dort)
				doc.link(20, yPos - 5, 160, 10, { pageNumber: 3 });
				yPos += 10;
			}

			// PDF als Blob erstellen
			const pdfBlob = doc.output('blob');
			generatedPdfUrl = URL.createObjectURL(pdfBlob);
			generatedFileName = getFileName();

		} catch (err) {
			console.error('PDF-Generierung fehlgeschlagen:', err);
		} finally {
			isGenerating = false;
		}
	}

	function downloadPdf() {
		if (!generatedPdfUrl) return;

		const link = document.createElement('a');
		link.href = generatedPdfUrl;
		link.download = generatedFileName;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	function neuerExport() {
		currentStep = 1;
		selectedLvTyp = '';
		textOption = 'kurz';
		preisOption = 'mit';
		lvPositionen = [];
		if (generatedPdfUrl) {
			URL.revokeObjectURL(generatedPdfUrl);
			generatedPdfUrl = '';
		}
		generatedFileName = '';
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
			<h1>LV-Export</h1>
		</div>
	</header>

	<!-- Progress Steps -->
	<nav class="progress-bar" aria-label="Fortschritt">
		{#each ['LV-Typ', 'Optionen', 'Download'] as title, i}
			{@const stepNum = i + 1}
			{@const isActive = currentStep === stepNum}
			{@const isComplete = currentStep > stepNum}
			<button
				class="progress-step"
				class:active={isActive}
				class:complete={isComplete}
				onclick={() => { if (stepNum < currentStep) currentStep = stepNum; }}
				disabled={stepNum > currentStep}
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
			{#if i < 2}
				<div class="progress-line" class:complete={currentStep > stepNum}></div>
			{/if}
		{/each}
	</nav>

	<main class="main">
		{#if isLoading && currentStep === 1}
			<div class="loading">
				<div class="spinner-large"></div>
				<p>Lade LV-Typen...</p>
			</div>

		{:else}
			<!-- Step 1: LV-Typ auswählen -->
			{#if currentStep === 1}
				<div class="step-content">
					<h2 class="step-heading">Welches Leistungsverzeichnis möchtest du exportieren?</h2>

					<div class="lv-grid">
						{#each lvTypen as typ}
							{@const config = kundenLvConfig[typ.lv_typ]}
							<button
								class="lv-card"
								class:selected={selectedLvTyp === typ.lv_typ}
								onclick={() => selectedLvTyp = typ.lv_typ}
								style={config ? `--card-accent: ${config.farbe}` : ''}
							>
								<div class="lv-badge" style={config ? `background: ${config.farbe}` : ''}>
									{config?.name || typ.lv_typ}
								</div>
								<div class="lv-name">{config?.beschreibung || typ.lv_typ}</div>
								<div class="lv-count">{typ.anzahl} Positionen</div>
								{#if selectedLvTyp === typ.lv_typ}
									<div class="lv-check">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
											<path d="M5 13l4 4L19 7"/>
										</svg>
									</div>
								{/if}
							</button>
						{/each}
					</div>
				</div>

			<!-- Step 2: Optionen -->
			{:else if currentStep === 2}
				<div class="step-content">
					<h2 class="step-heading">Wie soll das PDF aufgebaut sein?</h2>

					<div class="options-grid">
						<!-- Text-Option -->
						<div class="option-group">
							<h3>Textformat</h3>
							<div class="option-cards">
								<button
									class="option-card"
									class:selected={textOption === 'kurz'}
									onclick={() => textOption = 'kurz'}
								>
									<div class="option-icon">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M4 6h16M4 12h10"/>
										</svg>
									</div>
									<div class="option-label">Kurztexte</div>
									<div class="option-desc">Nur Artikelbezeichnung</div>
								</button>

								<button
									class="option-card"
									class:selected={textOption === 'lang'}
									onclick={() => textOption = 'lang'}
								>
									<div class="option-icon">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M4 6h16M4 10h16M4 14h16M4 18h12"/>
										</svg>
									</div>
									<div class="option-label">Langtexte</div>
									<div class="option-desc">Vollständige Beschreibung</div>
								</button>
							</div>
						</div>

						<!-- Preis-Option -->
						<div class="option-group">
							<h3>Preisanzeige</h3>
							<div class="option-cards">
								<button
									class="option-card"
									class:selected={preisOption === 'mit'}
									onclick={() => preisOption = 'mit'}
								>
									<div class="option-icon">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
										</svg>
									</div>
									<div class="option-label">Mit Preisen</div>
									<div class="option-desc">Listenpreise anzeigen</div>
								</button>

								<button
									class="option-card"
									class:selected={preisOption === 'ohne'}
									onclick={() => preisOption = 'ohne'}
								>
									<div class="option-icon">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<circle cx="12" cy="12" r="10"/>
											<path d="m4.93 4.93 14.14 14.14"/>
										</svg>
									</div>
									<div class="option-label">Ohne Preise</div>
									<div class="option-desc">Nur Leistungen</div>
								</button>
							</div>
						</div>
					</div>

					<!-- Vorschau-Info -->
					<div class="preview-info">
						<h4>Zusammenfassung</h4>
						<ul>
							<li><strong>LV-Typ:</strong> {selectedLvTyp}</li>
							<li><strong>Positionen:</strong> {positionenMitPreisCount} von {lvPositionen.length} (nur mit Preis)</li>
							<li><strong>Format:</strong> {textOption === 'lang' ? 'Langtexte' : 'Kurztexte'}, {preisOption === 'mit' ? 'mit Preisen' : 'ohne Preise'}</li>
							<li><strong>Dateiname:</strong> {getFileName()}</li>
						</ul>
					</div>
				</div>

			<!-- Step 3: Download -->
			{:else if currentStep === 3}
				<div class="step-content download-step">
					{#if isGenerating}
						<div class="generating">
							<div class="spinner-large"></div>
							<p>PDF wird generiert...</p>
							<p class="generating-detail">{lvPositionen.length} Positionen werden verarbeitet</p>
						</div>
					{:else if generatedPdfUrl}
						<div class="download-ready">
							<div class="success-icon">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
									<polyline points="14 2 14 8 20 8"/>
									<path d="m9 15 2 2 4-4"/>
								</svg>
							</div>
							<h2>PDF erfolgreich erstellt!</h2>
							<p class="filename">{generatedFileName}</p>

							<div class="download-actions">
								<button class="btn btn-primary btn-large" onclick={downloadPdf}>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
										<polyline points="7 10 12 15 17 10"/>
										<line x1="12" y1="15" x2="12" y2="3"/>
									</svg>
									PDF herunterladen
								</button>

								<a href={generatedPdfUrl} target="_blank" class="btn btn-secondary">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
										<polyline points="15 3 21 3 21 9"/>
										<line x1="10" y1="14" x2="21" y2="3"/>
									</svg>
									Vorschau öffnen
								</a>
							</div>

							<button class="btn-link new-export" onclick={neuerExport}>
								Neuen Export starten
							</button>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Footer Actions -->
			{#if currentStep < 3}
				<div class="footer-actions">
					{#if currentStep > 1}
						<button class="btn btn-secondary" onclick={prevStep}>
							Zurück
						</button>
					{:else}
						<div></div>
					{/if}

					<button
						class="btn btn-primary"
						onclick={nextStep}
						disabled={!canProceed(currentStep) || isLoading}
					>
						{#if isLoading}
							<span class="spinner"></span>
							Lade...
						{:else if currentStep === 2}
							PDF generieren
						{:else}
							Weiter
						{/if}
					</button>
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
		padding: var(--spacing-2) var(--spacing-3);
		opacity: 0.5;
	}

	.progress-step.active,
	.progress-step.complete {
		opacity: 1;
	}

	.progress-step:not(:disabled) {
		cursor: pointer;
	}

	.step-number {
		width: 32px;
		height: 32px;
		border-radius: 0;
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
		width: 60px;
		height: 2px;
		background: var(--color-gray-300);
		margin-top: 23px;
	}

	.progress-line.complete {
		background: var(--color-success);
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
	.loading, .generating {
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

	.generating-detail {
		font-size: var(--font-size-sm);
		color: var(--color-gray-500);
	}

	/* Step Content */
	.step-content {
		background: white;
		border-radius: 0;
		box-shadow: var(--shadow-md);
		padding: var(--spacing-6);
		border: 1px solid var(--color-gray-200);
	}

	.step-heading {
		font-size: var(--font-size-lg);
		color: var(--color-gray-800);
		margin-bottom: var(--spacing-6);
	}

	/* LV-Grid (Step 1) */
	.lv-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: var(--spacing-4);
	}

	.lv-card {
		position: relative;
		background: white;
		border: 2px solid var(--color-gray-200);
		border-radius: 0;
		padding: var(--spacing-5);
		padding-top: var(--spacing-8);
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: left;
	}

	.lv-card:hover {
		border-color: var(--card-accent, var(--color-brand-medium));
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.lv-card.selected {
		border-color: var(--card-accent, var(--color-brand-medium));
		border-width: 3px;
		background: var(--color-gray-50);
	}

	.lv-badge {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		padding: var(--spacing-1) var(--spacing-3);
		background: var(--color-gray-500);
		color: white;
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-bold);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.lv-name {
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-base);
		margin-bottom: var(--spacing-2);
		color: var(--color-gray-800);
	}

	.lv-card.selected .lv-name {
		color: var(--color-gray-900);
	}

	.lv-count {
		font-size: var(--font-size-sm);
		color: var(--color-gray-500);
		font-family: var(--font-family-mono);
	}

	.lv-card.selected .lv-count {
		color: var(--color-gray-600);
	}

	.lv-check {
		position: absolute;
		bottom: var(--spacing-3);
		right: var(--spacing-3);
		width: 28px;
		height: 28px;
		background: var(--card-accent, var(--color-brand-medium));
		border-radius: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.lv-check svg {
		width: 16px;
		height: 16px;
		color: white;
	}

	/* Options Grid (Step 2) */
	.options-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: var(--spacing-6);
		margin-bottom: var(--spacing-6);
	}

	.option-group h3 {
		font-size: var(--font-size-sm);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--color-gray-500);
		margin-bottom: var(--spacing-3);
	}

	.option-cards {
		display: flex;
		gap: var(--spacing-3);
	}

	.option-card {
		flex: 1;
		background: white;
		border: 2px solid var(--color-gray-200);
		border-radius: 0;
		padding: var(--spacing-4);
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: center;
	}

	.option-card:hover {
		border-color: var(--color-brand-medium);
	}

	.option-card.selected {
		border-color: var(--color-brand-medium);
		border-width: 3px;
		background: var(--color-primary-50);
	}

	.option-icon {
		width: 48px;
		height: 48px;
		margin: 0 auto var(--spacing-3);
		background: var(--color-gray-100);
		border-radius: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.option-card.selected .option-icon {
		background: var(--color-brand-medium);
	}

	.option-icon svg {
		width: 24px;
		height: 24px;
		color: var(--color-gray-600);
	}

	.option-card.selected .option-icon svg {
		color: white;
	}

	.option-label {
		font-weight: var(--font-weight-semibold);
		margin-bottom: var(--spacing-1);
	}

	.option-desc {
		font-size: var(--font-size-xs);
		color: var(--color-gray-500);
	}

	/* Preview Info */
	.preview-info {
		background: var(--color-gray-50);
		border-radius: 0;
		padding: var(--spacing-4);
		border-left: 4px solid var(--color-brand-medium);
	}

	.preview-info h4 {
		font-size: var(--font-size-sm);
		color: var(--color-gray-600);
		margin-bottom: var(--spacing-2);
	}

	.preview-info ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.preview-info li {
		font-size: var(--font-size-sm);
		padding: var(--spacing-1) 0;
	}

	/* Download Step */
	.download-step {
		text-align: center;
		padding: var(--spacing-10);
	}

	.download-ready {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-4);
	}

	.success-icon {
		width: 80px;
		height: 80px;
		background: var(--color-success-light);
		border-radius: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.success-icon svg {
		width: 40px;
		height: 40px;
		color: var(--color-success);
	}

	.download-ready h2 {
		font-size: var(--font-size-2xl);
		color: var(--color-gray-900);
	}

	.filename {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
		background: var(--color-gray-100);
		padding: var(--spacing-2) var(--spacing-4);
		border-radius: 0;
		color: var(--color-gray-700);
	}

	.download-actions {
		display: flex;
		gap: var(--spacing-4);
		margin-top: var(--spacing-4);
	}

	.btn-large {
		padding: var(--spacing-4) var(--spacing-8);
		font-size: var(--font-size-lg);
	}

	.btn-large svg {
		width: 24px;
		height: 24px;
	}

	.new-export {
		margin-top: var(--spacing-6);
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
		border-radius: 0;
		font-weight: var(--font-weight-medium);
		font-size: var(--font-size-base);
		cursor: pointer;
		border: none;
		transition: all 0.15s ease;
		text-decoration: none;
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

	/* Mobile */
	@media (max-width: 767px) {
		.main {
			padding: var(--spacing-3);
			padding-bottom: 100px;
		}

		.step-content {
			padding: var(--spacing-4);
		}

		.lv-grid {
			grid-template-columns: 1fr;
		}

		.options-grid {
			grid-template-columns: 1fr;
		}

		.option-cards {
			flex-direction: column;
		}

		.download-actions {
			flex-direction: column;
			width: 100%;
		}

		.download-actions .btn {
			width: 100%;
		}

		.footer-actions {
			padding: var(--spacing-3);
		}
	}
</style>
