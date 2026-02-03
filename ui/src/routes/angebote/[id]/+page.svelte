<script lang="ts">
	import { page } from '$app/stores';
	import { Card, Badge, Button } from '$lib/components/ui';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	// Types
	interface Angebot {
		id: string;
		angebotsnummer: string;
		atbs_nummer: string;
		projekt_id: string;
		projektname: string;
		auftraggeber: string;
		lv_typ: string;
		status: string;
		summe_netto: number;
		summe_brutto: number;
		summe_mwst: number;
		erstellt_am: string;
		gueltig_bis: string;
		pdf_path: string | null;
		rabatt_prozent: number;
	}

	interface Position {
		id: string;
		position_nr: number;
		artikelnummer: string;
		bezeichnung: string;
		gewerk: string;
		menge: number;
		einheit: string;
		einzelpreis: number;
		gesamtpreis: number;
	}

	interface Empfaenger {
		name: string;
		firma: string;
		strasse: string;
		plz: string;
		ort: string;
		email: string;
		telefon: string;
	}

	// State
	let loading = $state(true);
	let saving = $state(false);
	let error = $state<string | null>(null);
	let angebot = $state<Angebot | null>(null);
	let positionen = $state<Position[]>([]);
	let empfaenger = $state<Empfaenger | null>(null);
	let pdfGenerating = $state(false);

	// Angebot-ID aus Route
	let angebotId = $derived($page.params.id);

	async function loadAngebot() {
		loading = true;
		error = null;

		try {
			// Angebot laden
			const { data: angData, error: angError } = await supabase
				.from('angebote')
				.select('*')
				.eq('id', angebotId)
				.single();

			if (angError) throw angError;
			angebot = angData;

			// Positionen laden
			const { data: posData, error: posError } = await supabase
				.from('angebots_positionen')
				.select('*')
				.eq('angebot_id', angebotId)
				.order('position_nr');

			if (posError) throw posError;
			positionen = posData || [];

			// Empfängerdaten aus monday_bauprozess laden
			if (angebot?.projektname) {
				const { data: bpData } = await supabase
					.from('monday_bauprozess')
					.select('name, auftraggeber, adresse, ag_name, ag_email, ag_telefon, kunde_firma, kunde_vorname, kunde_nachname, kunde_adresse')
					.eq('name', angebot.projektname)
					.single();

				if (bpData) {
					// Adresse parsen (Format: "Name | Straße, PLZ Ort | Zusatz")
					const adressTeile = (bpData.adresse || '').split('|').map((s: string) => s.trim());
					const strasseOrt = adressTeile[0] || '';
					const strasseMatch = strasseOrt.match(/^(.+?),?\s*(\d{5})?\s*(.*)$/);

					empfaenger = {
						name: bpData.kunde_vorname && bpData.kunde_nachname
							? `${bpData.kunde_vorname} ${bpData.kunde_nachname}`.trim()
							: bpData.ag_name || bpData.auftraggeber || '',
						firma: bpData.kunde_firma || bpData.auftraggeber || '',
						strasse: strasseMatch?.[1]?.trim() || strasseOrt,
						plz: strasseMatch?.[2] || '',
						ort: strasseMatch?.[3]?.trim() || '',
						email: bpData.ag_email || '',
						telefon: bpData.ag_telefon || ''
					};
				}
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Fehler beim Laden';
			console.error('Angebot laden fehlgeschlagen:', err);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadAngebot();
	});

	// Formatierung
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
			year: 'numeric'
		});
	}

	function getStatusVariant(status: string): 'default' | 'warning' | 'success' | 'error' | 'info' {
		switch (status) {
			case 'entwurf': return 'default';
			case 'gesendet': return 'info';
			case 'angenommen': return 'success';
			case 'abgelehnt': return 'error';
			default: return 'default';
		}
	}

	function getStatusLabel(status: string): string {
		switch (status) {
			case 'entwurf': return 'Entwurf';
			case 'gesendet': return 'Gesendet';
			case 'angenommen': return 'Angenommen';
			case 'abgelehnt': return 'Abgelehnt';
			default: return status;
		}
	}

	// Positionen nach Gewerk gruppieren
	let positionenNachGewerk = $derived.by(() => {
		const groups: Record<string, Position[]> = {};
		for (const pos of positionen) {
			const gewerk = pos.gewerk || 'Sonstige';
			if (!groups[gewerk]) groups[gewerk] = [];
			groups[gewerk].push(pos);
		}
		return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
	});

	// HTML für PDF generieren
	function generatePdfHtml(): string {
		if (!angebot) return '';

		const heute = new Date().toLocaleDateString('de-DE');
		const mwstBetrag = (angebot.summe_netto || 0) * 0.19;

		// Positionen-Tabelle
		let positionenHtml = '';
		let posNr = 1;
		for (const [gewerk, poss] of positionenNachGewerk) {
			positionenHtml += `
				<tr class="gewerk-header">
					<td colspan="6"><strong>${gewerk}</strong></td>
				</tr>
			`;
			for (const pos of poss) {
				positionenHtml += `
					<tr>
						<td class="pos-nr">${posNr++}</td>
						<td class="bezeichnung">${pos.bezeichnung}</td>
						<td class="menge">${Number(pos.menge).toLocaleString('de-DE', {minimumFractionDigits: 2})}</td>
						<td class="einheit">${pos.einheit}</td>
						<td class="preis">${Number(pos.einzelpreis).toLocaleString('de-DE', {minimumFractionDigits: 2})} €</td>
						<td class="preis">${Number(pos.gesamtpreis).toLocaleString('de-DE', {minimumFractionDigits: 2})} €</td>
					</tr>
				`;
			}
		}

		return `<!DOCTYPE html>
<html lang="de">
<head>
	<meta charset="UTF-8">
	<title>Angebot ${angebot.angebotsnummer}</title>
	<style>
		@page { size: A4; margin: 15mm 20mm; }
		* { box-sizing: border-box; margin: 0; padding: 0; }
		body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #333; line-height: 1.4; }

		.header { display: flex; justify-content: space-between; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 2px solid #C41E3A; }
		.logo { font-size: 24pt; font-weight: bold; color: #C41E3A; }
		.logo-sub { font-size: 9pt; color: #666; }
		.doc-info { text-align: right; }
		.doc-info h1 { font-size: 18pt; color: #333; margin-bottom: 5px; }
		.doc-info .nr { font-size: 12pt; color: #C41E3A; font-weight: 600; }

		.addresses { display: flex; gap: 40px; margin-bottom: 25px; }
		.address-block { flex: 1; }
		.address-label { font-size: 8pt; color: #999; text-transform: uppercase; margin-bottom: 5px; }
		.address-content { font-size: 10pt; }
		.address-content strong { font-size: 11pt; }

		.meta-info { display: flex; gap: 30px; margin-bottom: 20px; padding: 12px 15px; background: #f5f5f5; }
		.meta-item { }
		.meta-label { font-size: 8pt; color: #666; }
		.meta-value { font-size: 10pt; font-weight: 600; }

		.intro { margin-bottom: 20px; padding: 15px; background: #fafafa; border-left: 3px solid #C41E3A; }

		table.positionen { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
		table.positionen th { background: #333; color: white; padding: 8px 10px; text-align: left; font-size: 9pt; }
		table.positionen th:nth-child(3), table.positionen th:nth-child(4),
		table.positionen th:nth-child(5), table.positionen th:nth-child(6) { text-align: right; }
		table.positionen td { padding: 6px 10px; border-bottom: 1px solid #eee; font-size: 9pt; }
		table.positionen .gewerk-header td { background: #f0f0f0; font-size: 10pt; padding: 8px 10px; }
		table.positionen .pos-nr { width: 30px; color: #999; }
		table.positionen .bezeichnung { }
		table.positionen .menge, table.positionen .einheit, table.positionen .preis { text-align: right; }
		table.positionen .einheit { width: 50px; }
		table.positionen .preis { width: 90px; }

		.summen { margin-left: auto; width: 300px; }
		.summen-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; }
		.summen-row.total { font-size: 12pt; font-weight: bold; border-top: 2px solid #333; border-bottom: none; padding-top: 10px; }
		.summen-row.total .value { color: #C41E3A; }

		.footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 8pt; color: #666; }
		.footer-row { display: flex; justify-content: space-between; }

		.bedingungen { margin-top: 25px; font-size: 9pt; }
		.bedingungen h3 { font-size: 10pt; margin-bottom: 8px; }
		.bedingungen ul { margin-left: 20px; }
		.bedingungen li { margin-bottom: 4px; }
	</style>
</head>
<body>
	<div class="header">
		<div class="logo-block">
			<div class="logo">neurealis</div>
			<div class="logo-sub">Wohnungssanierung aus einer Hand</div>
		</div>
		<div class="doc-info">
			<h1>Angebot</h1>
			<div class="nr">${angebot.angebotsnummer}</div>
		</div>
	</div>

	<div class="addresses">
		<div class="address-block">
			<div class="address-label">Absender</div>
			<div class="address-content">
				<strong>neurealis GmbH</strong><br>
				Kleyer Weg 40<br>
				44149 Dortmund<br>
				Tel: +49 231 586 959 70<br>
				E-Mail: kontakt@neurealis.de
			</div>
		</div>
		<div class="address-block">
			<div class="address-label">Empfänger</div>
			<div class="address-content">
				${empfaenger ? `
					<strong>${empfaenger.firma || empfaenger.name}</strong><br>
					${empfaenger.name && empfaenger.firma ? empfaenger.name + '<br>' : ''}
					${empfaenger.strasse}<br>
					${empfaenger.plz} ${empfaenger.ort}
				` : `
					<strong>${angebot.auftraggeber}</strong>
				`}
			</div>
		</div>
	</div>

	<div class="meta-info">
		<div class="meta-item">
			<div class="meta-label">Datum</div>
			<div class="meta-value">${heute}</div>
		</div>
		<div class="meta-item">
			<div class="meta-label">Projekt</div>
			<div class="meta-value">${angebot.projektname || '-'}</div>
		</div>
		<div class="meta-item">
			<div class="meta-label">LV-Typ</div>
			<div class="meta-value">${angebot.lv_typ || '-'}</div>
		</div>
		<div class="meta-item">
			<div class="meta-label">Gültig bis</div>
			<div class="meta-value">${formatDate(angebot.gueltig_bis)}</div>
		</div>
	</div>

	<div class="intro">
		Sehr geehrte Damen und Herren,<br><br>
		vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot für die Sanierungsarbeiten:
	</div>

	<table class="positionen">
		<thead>
			<tr>
				<th>Pos.</th>
				<th>Bezeichnung</th>
				<th>Menge</th>
				<th>Einheit</th>
				<th>EP</th>
				<th>GP</th>
			</tr>
		</thead>
		<tbody>
			${positionenHtml}
		</tbody>
	</table>

	<div class="summen">
		<div class="summen-row">
			<span>Zwischensumme netto</span>
			<span>${formatCurrency(angebot.summe_netto)}</span>
		</div>
		${angebot.rabatt_prozent ? `
		<div class="summen-row">
			<span>Rabatt (${angebot.rabatt_prozent}%)</span>
			<span>-${formatCurrency((angebot.summe_netto || 0) * (angebot.rabatt_prozent / 100))}</span>
		</div>
		` : ''}
		<div class="summen-row">
			<span>MwSt. (19%)</span>
			<span>${formatCurrency(mwstBetrag)}</span>
		</div>
		<div class="summen-row total">
			<span>Gesamtbetrag</span>
			<span class="value">${formatCurrency(angebot.summe_brutto)}</span>
		</div>
	</div>

	<div class="bedingungen">
		<h3>Hinweise und Bedingungen</h3>
		<ul>
			<li>Dieses Angebot ist gültig bis zum ${formatDate(angebot.gueltig_bis)}.</li>
			<li>Zahlungsbedingungen: 30% Anzahlung bei Auftragserteilung, 70% nach Fertigstellung.</li>
			<li>Lieferzeit: Nach Vereinbarung, abhängig von Materialverfügbarkeit.</li>
			<li>Es gelten unsere allgemeinen Geschäftsbedingungen.</li>
		</ul>
	</div>

	<div class="footer">
		<div class="footer-row">
			<span>neurealis GmbH | Kleyer Weg 40 | 44149 Dortmund</span>
			<span>Geschäftsführer: Holger Neumann</span>
		</div>
		<div class="footer-row">
			<span>Tel: +49 231 586 959 70 | kontakt@neurealis.de</span>
			<span>HRB 12345 | USt-IdNr: DE123456789</span>
		</div>
	</div>
</body>
</html>`;
	}

	// PDF generieren und speichern
	async function generateAndSavePdf() {
		if (!angebot) return;

		pdfGenerating = true;

		try {
			const html = generatePdfHtml();

			// PDF via Edge Function generieren
			const response = await fetch('https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/generate-pdf', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
				},
				body: JSON.stringify({
					html,
					filename: `Angebot_${angebot.angebotsnummer.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`
				})
			});

			if (!response.ok) {
				// Fallback: HTML-Preview öffnen
				const blob = new Blob([html], { type: 'text/html' });
				const url = URL.createObjectURL(blob);
				window.open(url, '_blank');
				alert('PDF-Service nicht verfügbar. HTML-Vorschau wurde geöffnet.');
				return;
			}

			const result = await response.json();

			// Angebot mit PDF-Pfad aktualisieren
			await supabase
				.from('angebote')
				.update({ pdf_path: result.path })
				.eq('id', angebot.id);

			// In Dokumente-Tabelle einfügen
			await saveToDokumente(result.path, result.url);

			angebot.pdf_path = result.path;
			alert('PDF wurde erfolgreich erstellt und gespeichert!');

		} catch (err) {
			console.error('PDF-Generierung fehlgeschlagen:', err);
			// Fallback: Lokale HTML-Vorschau
			const html = generatePdfHtml();
			const blob = new Blob([html], { type: 'text/html' });
			const url = URL.createObjectURL(blob);
			window.open(url, '_blank');
		} finally {
			pdfGenerating = false;
		}
	}

	// Raw-Text aus Positionen generieren
	function generateRawText(): string {
		if (!angebot) return '';

		let text = `ANGEBOT ${angebot.angebotsnummer}\n`;
		text += `Projekt: ${angebot.projektname || '-'}\n`;
		text += `Auftraggeber: ${angebot.auftraggeber || '-'}\n`;
		text += `LV-Typ: ${angebot.lv_typ || '-'}\n`;
		text += `Erstellt: ${formatDate(angebot.erstellt_am)}\n`;
		text += `Gültig bis: ${formatDate(angebot.gueltig_bis)}\n\n`;

		if (empfaenger) {
			text += `Empfänger:\n`;
			text += `${empfaenger.firma || empfaenger.name}\n`;
			if (empfaenger.name && empfaenger.firma) text += `${empfaenger.name}\n`;
			text += `${empfaenger.strasse}\n`;
			text += `${empfaenger.plz} ${empfaenger.ort}\n\n`;
		}

		text += `POSITIONEN:\n`;
		text += `${'='.repeat(60)}\n`;

		for (const [gewerk, poss] of positionenNachGewerk) {
			text += `\n${gewerk}\n${'-'.repeat(40)}\n`;
			for (const pos of poss) {
				text += `${pos.position_nr}. ${pos.bezeichnung}\n`;
				text += `   ${Number(pos.menge).toFixed(2)} ${pos.einheit} × ${formatCurrency(pos.einzelpreis)} = ${formatCurrency(pos.gesamtpreis)}\n`;
			}
		}

		text += `\n${'='.repeat(60)}\n`;
		text += `Summe netto: ${formatCurrency(angebot.summe_netto)}\n`;
		text += `MwSt. (19%): ${formatCurrency((angebot.summe_netto || 0) * 0.19)}\n`;
		text += `GESAMTBETRAG: ${formatCurrency(angebot.summe_brutto)}\n`;

		return text;
	}

	// In Dokumente-Tabelle speichern
	async function saveToDokumente(pdfPath?: string, pdfUrl?: string) {
		if (!angebot) return;

		saving = true;

		try {
			// Prüfen ob schon ein Dokument existiert
			const { data: existing } = await supabase
				.from('dokumente')
				.select('id')
				.eq('dokument_nr', angebot.angebotsnummer)
				.single();

			const dokumentData = {
				dokument_nr: angebot.angebotsnummer,
				atbs_nummer: angebot.atbs_nummer || null,
				art_des_dokuments: 'ANG',
				art_des_dokuments_id: 'ANG',
				betrag_netto: angebot.summe_netto,
				betrag_brutto: angebot.summe_brutto,
				status: angebot.status === 'entwurf' ? 'Entwurf' : 'Erstellt',
				datum_erstellt: angebot.erstellt_am?.split('T')[0] || new Date().toISOString().split('T')[0],
				projektname: angebot.projektname,
				datei_url: pdfUrl || null,
				datei_name: pdfPath ? pdfPath.split('/').pop() : null,
				quelle: 'CPQ',
				raw_text: generateRawText(),
				erstellt_von: 'CPQ-System',
				empfaenger_name_erkannt: empfaenger?.name || angebot.auftraggeber,
				empfaenger_adresse_erkannt: empfaenger ? `${empfaenger.strasse}, ${empfaenger.plz} ${empfaenger.ort}` : null
			};

			if (existing) {
				await supabase
					.from('dokumente')
					.update(dokumentData)
					.eq('id', existing.id);
			} else {
				await supabase
					.from('dokumente')
					.insert({
						id: angebot.id, // Gleiche ID wie Angebot
						...dokumentData
					});
			}

			alert('Dokument wurde gespeichert!');
		} catch (err) {
			console.error('Dokument speichern fehlgeschlagen:', err);
			alert('Fehler beim Speichern: ' + (err instanceof Error ? err.message : String(err)));
		} finally {
			saving = false;
		}
	}

	// PDF herunterladen (falls vorhanden)
	async function downloadPdf() {
		if (!angebot?.pdf_path) {
			// HTML-Fallback generieren
			const html = generatePdfHtml();
			const blob = new Blob([html], { type: 'text/html' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `Angebot_${angebot?.angebotsnummer || 'export'}.html`;
			a.click();
			return;
		}

		const { data } = supabase.storage.from('dokumente').getPublicUrl(angebot.pdf_path);
		window.open(data.publicUrl, '_blank');
	}
</script>

<svelte:head>
	<title>{angebot?.angebotsnummer || 'Angebot'} - neurealis ERP</title>
</svelte:head>

<div class="page-container">
	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Lade Angebot...</p>
		</div>
	{:else if error}
		<div class="error-state">
			<p>{error}</p>
			<Button variant="secondary" onclick={() => goto('/angebote')}>Zurück zur Übersicht</Button>
		</div>
	{:else if angebot}
		<header class="page-header">
			<div class="header-left">
				<button class="back-btn" onclick={() => goto('/angebote')}>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="m15 18-6-6 6-6"/>
					</svg>
				</button>
				<div>
					<h1>{angebot.angebotsnummer}</h1>
					<p class="subtitle">{angebot.projektname || 'Kein Projekt'}</p>
				</div>
			</div>
			<div class="header-right">
				<Badge variant={getStatusVariant(angebot.status)} size="lg">
					{getStatusLabel(angebot.status)}
				</Badge>
			</div>
		</header>

		<!-- Meta-Infos -->
		<div class="meta-grid">
			<Card padding="md">
				<div class="meta-item">
					<span class="meta-label">Auftraggeber</span>
					<span class="meta-value">{angebot.auftraggeber || '-'}</span>
				</div>
			</Card>
			<Card padding="md">
				<div class="meta-item">
					<span class="meta-label">LV-Typ</span>
					<span class="meta-value">{angebot.lv_typ || '-'}</span>
				</div>
			</Card>
			<Card padding="md">
				<div class="meta-item">
					<span class="meta-label">Erstellt am</span>
					<span class="meta-value">{formatDate(angebot.erstellt_am)}</span>
				</div>
			</Card>
			<Card padding="md">
				<div class="meta-item">
					<span class="meta-label">Gültig bis</span>
					<span class="meta-value">{formatDate(angebot.gueltig_bis)}</span>
				</div>
			</Card>
		</div>

		<!-- Empfänger -->
		{#if empfaenger}
			<Card padding="md">
				<h3 class="section-title">Empfänger</h3>
				<div class="empfaenger-info">
					<div class="empfaenger-name">
						<strong>{empfaenger.firma || empfaenger.name}</strong>
						{#if empfaenger.name && empfaenger.firma}
							<br>{empfaenger.name}
						{/if}
					</div>
					<div class="empfaenger-adresse">
						{empfaenger.strasse}<br>
						{empfaenger.plz} {empfaenger.ort}
					</div>
					<div class="empfaenger-kontakt">
						{#if empfaenger.email}<span>{empfaenger.email}</span>{/if}
						{#if empfaenger.telefon}<span>{empfaenger.telefon}</span>{/if}
					</div>
				</div>
			</Card>
		{/if}

		<!-- Positionen -->
		<Card padding="none">
			<div class="card-header">
				<h3>Positionen ({positionen.length})</h3>
			</div>
			<div class="table-wrapper">
				<table class="data-table">
					<thead>
						<tr>
							<th>Pos.</th>
							<th>Bezeichnung</th>
							<th>Gewerk</th>
							<th class="text-right">Menge</th>
							<th>Einheit</th>
							<th class="text-right">EP</th>
							<th class="text-right">GP</th>
						</tr>
					</thead>
					<tbody>
						{#each positionen as pos}
							<tr>
								<td class="pos-nr">{pos.position_nr}</td>
								<td class="bezeichnung">{pos.bezeichnung}</td>
								<td class="gewerk">{pos.gewerk || '-'}</td>
								<td class="text-right">{Number(pos.menge).toLocaleString('de-DE', {minimumFractionDigits: 2})}</td>
								<td>{pos.einheit}</td>
								<td class="text-right">{formatCurrency(pos.einzelpreis)}</td>
								<td class="text-right font-semibold">{formatCurrency(pos.gesamtpreis)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Card>

		<!-- Summen -->
		<Card padding="md">
			<div class="summen">
				<div class="summen-row">
					<span>Summe netto</span>
					<span>{formatCurrency(angebot.summe_netto)}</span>
				</div>
				{#if angebot.rabatt_prozent}
					<div class="summen-row rabatt">
						<span>Rabatt ({angebot.rabatt_prozent}%)</span>
						<span>-{formatCurrency((angebot.summe_netto || 0) * (angebot.rabatt_prozent / 100))}</span>
					</div>
				{/if}
				<div class="summen-row">
					<span>MwSt. (19%)</span>
					<span>{formatCurrency((angebot.summe_netto || 0) * 0.19)}</span>
				</div>
				<div class="summen-row total">
					<span>Gesamtbetrag brutto</span>
					<span>{formatCurrency(angebot.summe_brutto)}</span>
				</div>
			</div>
		</Card>

		<!-- Aktionen -->
		<div class="actions-bar">
			<Button variant="secondary" onclick={downloadPdf}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
					<polyline points="7 10 12 15 17 10"/>
					<line x1="12" y1="15" x2="12" y2="3"/>
				</svg>
				{angebot.pdf_path ? 'PDF herunterladen' : 'HTML exportieren'}
			</Button>
			<Button variant="secondary" onclick={generateAndSavePdf} loading={pdfGenerating} disabled={pdfGenerating}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
					<polyline points="14 2 14 8 20 8"/>
				</svg>
				{pdfGenerating ? 'Generiere...' : 'PDF generieren'}
			</Button>
			<Button variant="primary" onclick={() => saveToDokumente()} loading={saving} disabled={saving}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
					<polyline points="17 21 17 13 7 13 7 21"/>
					<polyline points="7 3 7 8 15 8"/>
				</svg>
				{saving ? 'Speichere...' : 'In Dokumente speichern'}
			</Button>
		</div>
	{/if}
</div>

<style>
	.page-container {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.back-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border: 1px solid var(--color-gray-300);
		background: white;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.back-btn:hover {
		background: var(--color-gray-100);
	}

	.page-header h1 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-gray-900);
	}

	.subtitle {
		margin: 0.25rem 0 0;
		font-size: 0.9rem;
		color: var(--color-gray-500);
	}

	/* Meta Grid */
	.meta-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
	}

	.meta-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.meta-label {
		font-size: 0.75rem;
		color: var(--color-gray-500);
		text-transform: uppercase;
	}

	.meta-value {
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-gray-900);
	}

	/* Section */
	.section-title {
		margin: 0 0 1rem;
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-gray-800);
	}

	/* Empfänger */
	.empfaenger-info {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 1.5rem;
	}

	.empfaenger-name {
		font-size: 0.95rem;
	}

	.empfaenger-adresse {
		font-size: 0.9rem;
		color: var(--color-gray-600);
	}

	.empfaenger-kontakt {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.9rem;
		color: var(--color-gray-600);
	}

	/* Card Header */
	.card-header {
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--color-gray-200);
	}

	.card-header h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
	}

	/* Table */
	.table-wrapper {
		overflow-x: auto;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	.data-table th {
		padding: 0.75rem 1rem;
		text-align: left;
		font-weight: 600;
		color: var(--color-gray-600);
		background: var(--color-gray-50);
		border-bottom: 1px solid var(--color-gray-200);
		white-space: nowrap;
	}

	.data-table td {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-gray-100);
	}

	.text-right {
		text-align: right;
	}

	.font-semibold {
		font-weight: 600;
	}

	.pos-nr {
		color: var(--color-gray-400);
		width: 50px;
	}

	.bezeichnung {
		font-weight: 500;
	}

	.gewerk {
		color: var(--color-gray-500);
		font-size: 0.8rem;
	}

	/* Summen */
	.summen {
		max-width: 400px;
		margin-left: auto;
	}

	.summen-row {
		display: flex;
		justify-content: space-between;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--color-gray-100);
	}

	.summen-row.rabatt {
		color: var(--color-success);
	}

	.summen-row.total {
		font-size: 1.1rem;
		font-weight: 700;
		border-top: 2px solid var(--color-gray-300);
		border-bottom: none;
		padding-top: 0.75rem;
		margin-top: 0.5rem;
	}

	.summen-row.total span:last-child {
		color: var(--color-brand-medium);
	}

	/* Actions */
	.actions-bar {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
		padding-top: 1rem;
		border-top: 1px solid var(--color-gray-200);
	}

	/* States */
	.loading-state,
	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		background: white;
		border: 1px solid var(--color-gray-200);
		text-align: center;
		gap: 1rem;
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--color-gray-200);
		border-top-color: var(--color-brand-medium);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* Mobile */
	@media (max-width: 768px) {
		.page-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.meta-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.empfaenger-info {
			grid-template-columns: 1fr;
		}

		.actions-bar {
			flex-direction: column;
		}
	}
</style>
