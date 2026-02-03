<script lang="ts">
	import { Card, Badge, Button } from '$lib/components/ui';
	import { PositionGroupList } from '$lib/components/cpq';
	import type { PositionGroupData, Position } from '$lib/components/cpq/types';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	// Wizard Steps
	const steps = [
		{ id: 1, name: 'Projekt', short: 'Projekt' },
		{ id: 2, name: 'Eingabe', short: 'Text' },
		{ id: 3, name: 'Positionen prüfen', short: 'Prüfen' },
		{ id: 4, name: 'Gruppen bearbeiten', short: 'Gruppen' },
		{ id: 5, name: 'Abhängigkeiten', short: 'Abhängig' },
		{ id: 6, name: 'Aufmaß', short: 'Aufmaß' },
		{ id: 7, name: 'Preise/Margen', short: 'Preise' },
		{ id: 8, name: 'Freigabe', short: 'Export' }
	];

	let currentStep = $state(1);

	// Step 1: Projekt
	let projekte = $state<Array<{
		id: string;
		projektname: string;
		projektname_komplett: string;
		phase: number;
	}>>([]);
	let selectedProjektId = $state<string>('');
	let selectedProjekt = $derived(projekte.find(p => p.id === selectedProjektId));
	let lvTyp = $state<string>('neurealis');
	let strukturTyp = $state<'gewerk' | 'raum'>('gewerk');
	let matterportLink = $state('');

	// Step 2: Eingabe
	let transkriptionText = $state('');
	let isAnalyzing = $state(false);
	let analyzeError = $state<string | null>(null);

	// NEU: Kundenkontext (Wohnungsgröße etc.)
	interface KundenKontext {
		wohnungsgroesse_m2?: number;
		wohnungsgroesse_staffel?: string;
		raumanzahl?: number;
		stockwerk?: number;
		baujahr?: number;
	}
	let kundenKontext = $state<KundenKontext>({});
	let manuelleWohnungsgroesse = $state<string>(''); // Für manuelle Eingabe

	// Step 3: Positionen prüfen
	interface LvPositionRef {
		id: string;
		artikelnummer: string;
		bezeichnung: string;
		einzelpreis: number;
		listenpreis: number;
		is_fallback?: boolean;
		lv_typ?: string;
	}
	interface ParsedPosition {
		original_text: string;
		menge: number;
		einheit: string;
		gewerk: string;
		lv_position: LvPositionRef | null;
		selected_positions: LvPositionRef[]; // NEU: Mehrfachauswahl
		alternativen: Array<{
			id: string;
			artikelnummer: string;
			bezeichnung: string;
			einzelpreis: number;
			listenpreis?: number;
			lv_typ?: string;
			similarity?: number;
		}>;
		// NEU: LV-Typ-Filter für diese Position
		filter_lv_typ: string;
		// NEU: Freitextsuche
		search_query: string;
		search_results: LvPositionRef[];
		is_searching: boolean;
		// NEU: Einklappbar-Status für Vorschläge
		alternatives_collapsed: boolean;
	}
	let parsedPositions = $state<ParsedPosition[]>([]);
	let correctionsSaved = $state<Record<number, boolean>>({});

	// Verfügbare LV-Typen
	const lvTypOptions = ['GWS', 'VBW', 'vonovia', 'neurealis'];

	// Step 4: Gruppen
	let positionGroups = $state<PositionGroupData[]>([]);

	// Step 5: Abhängigkeiten
	interface Dependency {
		id: string;
		ausloeser_id: string;
		ausloeser_name: string;
		position_id: string;
		position_name: string;
		preis: number;
		grund?: string;
		optional: boolean;
		accepted: boolean;
	}
	let dependencies = $state<Dependency[]>([]);

	// Step 6: Aufmaß
	let allPositions = $derived.by(() => {
		const positions: Array<Position & { groupId: string; laenge?: number; breite?: number }> = [];
		positionGroups.forEach(group => {
			group.positionen.forEach(pos => {
				positions.push({ ...pos, groupId: group.id });
			});
		});
		return positions;
	});

	// Step 7: Preise
	let pricingProfiles = $state<Array<{
		id: string;
		name: string;
		aufschlag: number;
	}>>([]);
	let selectedProfileId = $state<string>('');
	let globalRabatt = $state(0);

	// Berechnungen
	let ekSumme = $derived(allPositions.reduce((sum, p) => sum + (p.menge * p.einzelpreis), 0));
	let aufschlag = $derived(pricingProfiles.find(p => p.id === selectedProfileId)?.aufschlag || 0);
	let vkSumme = $derived(ekSumme * (1 + aufschlag / 100) * (1 - globalRabatt / 100));
	let nettoSumme = $derived(vkSumme);
	let mwst = $derived(nettoSumme * 0.19);
	let bruttoSumme = $derived(nettoSumme + mwst);
	let gesamtNetto = $derived(allPositions.reduce((sum, p) => sum + (p.menge * p.einzelpreis), 0));

	// Step 8: Export
	let includeBedarfspositionen = $state(true);
	let includeAngebotsannahme = $state(true);
	let includeNUAVertragswerk = $state(false);
	let isNUA = $derived(false); // TODO: Detect NUA type
	let isSaving = $state(false);
	let angebotsVorschau = $state('');

	// Auftraggeber -> LV-Typ Mapping
	function mapAuftraggeberToLvTyp(projektname_komplett: string): string {
		if (!projektname_komplett) return 'neurealis';
		const auftraggeber = projektname_komplett.split('|')[0]?.trim().toLowerCase() || '';

		if (auftraggeber.includes('vbw')) return 'VBW';
		if (auftraggeber.includes('gws')) return 'GWS';
		if (auftraggeber.includes('covivio')) return 'GWS';
		if (auftraggeber.includes('vonovia')) return 'vonovia';
		if (auftraggeber.includes('forte')) return 'GWS';
		if (auftraggeber.includes('privat')) return 'neurealis';
		return 'neurealis';
	}

	// Projekt-Auswahl Handler
	function onProjektSelect() {
		if (selectedProjekt) {
			lvTyp = mapAuftraggeberToLvTyp(selectedProjekt.projektname_komplett);
		}
	}

	// Analyse Handler (Step 2)
	async function analyzeTranskription() {
		if (!transkriptionText.trim()) return;

		isAnalyzing = true;
		analyzeError = null;

		try {
			// Request-Body mit optionaler manueller Wohnungsgröße
			const requestBody: Record<string, unknown> = {
				transcription: transkriptionText,
				lv_typ: lvTyp,
				projekt_nr: selectedProjektId || undefined,
				prioritize_lv_typ: lvTyp  // Priorisiert den gewählten LV-Typ bei der Suche
			};

			// Manuelle Wohnungsgröße hinzufügen wenn angegeben
			if (manuelleWohnungsgroesse) {
				const parsed = parseFloat(manuelleWohnungsgroesse);
				if (!isNaN(parsed) && parsed > 0) {
					requestBody.wohnungsgroesse_m2 = parsed;
				}
			}

			const { data, error } = await supabase.functions.invoke('transcription-parse', {
				body: requestBody
			});

			if (error) {
				console.error('Supabase Functions Error:', error);
				throw error;
			}

			// Prüfe auf Fehler im Response-Body (success: false)
			if (data && data.success === false) {
				const errorMsg = data.error || data.message || 'Unbekannter Fehler in der Antwort';
				throw new Error(errorMsg);
			}

			// Kontext aus der Response speichern (Wohnungsgröße etc.)
			if (data?.kontext) {
				kundenKontext = {
					wohnungsgroesse_m2: data.kontext.wohnungsgroesse_m2,
					wohnungsgroesse_staffel: data.kontext.wohnungsgroesse_staffel,
					raumanzahl: data.kontext.raumanzahl,
					stockwerk: data.kontext.stockwerk,
					baujahr: data.kontext.baujahr
				};
				console.log('[CPQ] Kontext erkannt:', kundenKontext);
			}

			// Initialisiere neue Felder für jede Position
			const rawPositions = data?.positionen || [];
			parsedPositions = rawPositions.map((pos: ParsedPosition) => {
				// Sortiere Alternativen: Nach Similarity (höchste zuerst), dann nach listenpreis DESC
				const sortedAlternativen = (pos.alternativen || [])
					.map((alt: { id: string; artikelnummer: string; bezeichnung: string; einzelpreis: number; listenpreis?: number; lv_typ?: string; similarity?: number }) => ({
						...alt,
						listenpreis: alt.listenpreis || alt.einzelpreis,
						similarity: alt.similarity || 0
					}))
					.sort((a: { similarity: number; listenpreis: number }, b: { similarity: number; listenpreis: number }) => {
						if (b.similarity !== a.similarity) {
							return b.similarity - a.similarity;
						}
						return b.listenpreis - a.listenpreis;
					});

				// FIX: Stelle sicher dass lv_position korrekten listenpreis hat
				let initialPosition = pos.lv_position;
				if (initialPosition) {
					const preis = initialPosition.listenpreis || initialPosition.einzelpreis || 0;
					initialPosition = {
						...initialPosition,
						listenpreis: preis,
						einzelpreis: preis // Setze auch einzelpreis auf VK für konsistente Anzeige
					};
				}

				// NEU: Auto-Collapse wenn hohe Konfidenz (similarity > 0.9)
				const topSimilarity = sortedAlternativen[0]?.similarity || 0;
				const autoCollapse = topSimilarity > 0.9 && initialPosition !== null;

				return {
					...pos,
					alternativen: sortedAlternativen,
					lv_position: initialPosition,
					selected_positions: initialPosition ? [initialPosition] : [],
					filter_lv_typ: lvTyp, // Initialer Filter = gewählter LV-Typ
					search_query: '',
					search_results: [],
					is_searching: false,
					alternatives_collapsed: autoCollapse
				};
			});

			if (parsedPositions.length === 0) {
				analyzeError = 'Keine Positionen erkannt. Bitte prüfen Sie den Eingabetext.';
				return;
			}

			// Auto-advance to step 3
			currentStep = 3;
		} catch (err) {
			analyzeError = getErrorMessage(err) || 'Analyse fehlgeschlagen';
			console.error('Transkription-Analyse Fehler:', err);
		} finally {
			isAnalyzing = false;
		}
	}

	// NEU: LV-Typ ändern und neue Alternativen laden
	async function onFilterLvTypChange(index: number, newLvTyp: string) {
		parsedPositions[index].filter_lv_typ = newLvTyp;
		parsedPositions[index].is_searching = true;

		try {
			// Suche Alternativen für diesen LV-Typ
			const { data, error } = await supabase.functions.invoke('search-lv', {
				body: {
					query: parsedPositions[index].original_text,
					lv_typ: newLvTyp,
					limit: 10
				}
			});

			if (error) throw error;

			// Sortierung: Nach Similarity (höchste zuerst), dann nach listenpreis DESC
			const sortedPositions = (data?.positionen || [])
				.map((p: LvPositionRef & { similarity?: number }) => ({
					id: p.id,
					artikelnummer: p.artikelnummer,
					bezeichnung: p.bezeichnung,
					einzelpreis: p.listenpreis || p.einzelpreis,
					listenpreis: p.listenpreis || p.einzelpreis,
					lv_typ: newLvTyp,
					similarity: p.similarity || 0
				}))
				.sort((a: { similarity: number; listenpreis: number }, b: { similarity: number; listenpreis: number }) => {
					// Erst nach Similarity (höchste zuerst)
					if (b.similarity !== a.similarity) {
						return b.similarity - a.similarity;
					}
					// Bei gleicher Similarity: Nach listenpreis DESC (teurere zuerst)
					return b.listenpreis - a.listenpreis;
				});

			parsedPositions[index].alternativen = sortedPositions;
		} catch (err) {
			console.error('LV-Typ-Filter fehlgeschlagen:', err);
		} finally {
			parsedPositions[index].is_searching = false;
		}
	}

	// NEU: Position zur Mehrfachauswahl hinzufügen (Checkbox)
	// FIX: Svelte 5 Reaktivität - Array komplett neu zuweisen
	function togglePositionSelection(index: number, position: LvPositionRef, checked: boolean) {
		console.log('[CPQ] togglePositionSelection:', index, position.bezeichnung, checked);
		// Svelte 5: parsedPositions komplett neu zuweisen für Reaktivität
		parsedPositions = parsedPositions.map((pos, i) => {
			if (i !== index) return pos;
			let newSelected = [...pos.selected_positions];
			if (checked && !newSelected.some(p => p.id === position.id)) {
				newSelected = [...newSelected, position];
			} else if (!checked) {
				newSelected = newSelected.filter(p => p.id !== position.id);
			}
			return { ...pos, selected_positions: newSelected, lv_position: newSelected[0] || null };
		});
		console.log('[CPQ] Nach toggle:', parsedPositions[index].selected_positions.length);
	}

	// NEU: Position aus einer Alternative hinzufügen
	// FIX: Svelte 5 Reaktivität + listenpreis als VK
	function addPositionFromAlternative(index: number, alt: { id: string; artikelnummer: string; bezeichnung: string; einzelpreis: number; listenpreis?: number; lv_typ?: string }) {
		console.log('[CPQ] addPositionFromAlternative:', index, alt.bezeichnung);
		const preis = alt.listenpreis || alt.einzelpreis;
		const position: LvPositionRef = {
			id: alt.id,
			artikelnummer: alt.artikelnummer,
			bezeichnung: alt.bezeichnung,
			einzelpreis: preis,
			listenpreis: preis,
			is_fallback: false,
			lv_typ: alt.lv_typ
		};
		// Svelte 5: parsedPositions komplett neu zuweisen
		parsedPositions = parsedPositions.map((pos, i) => {
			if (i !== index || pos.selected_positions.some(p => p.id === position.id)) return pos;
			const newSelected = [...pos.selected_positions, position];
			return { ...pos, selected_positions: newSelected, lv_position: pos.lv_position || position };
		});
		console.log('[CPQ] Nach add:', parsedPositions[index].selected_positions.length);
	}

	// NEU: Ausgewählte Position entfernen
	// FIX: Svelte 5 Reaktivität
	function removeSelectedPosition(index: number, positionId: string) {
		console.log('[CPQ] removeSelectedPosition:', index, positionId);
		// Svelte 5: parsedPositions komplett neu zuweisen
		parsedPositions = parsedPositions.map((pos, i) => {
			if (i !== index) return pos;
			const newSelected = pos.selected_positions.filter(p => p.id !== positionId);
			return { ...pos, selected_positions: newSelected, lv_position: newSelected[0] || null };
		});
		console.log('[CPQ] Nach remove:', parsedPositions[index].selected_positions.length);
	}

	// NEU: Freitextsuche ausführen
	let searchDebounceTimers: Record<number, ReturnType<typeof setTimeout>> = {};

	async function onSearchQueryChange(index: number, query: string) {
		parsedPositions[index].search_query = query;

		// Debounce: 300ms warten nach Tippen
		if (searchDebounceTimers[index]) {
			clearTimeout(searchDebounceTimers[index]);
		}

		if (query.trim().length < 2) {
			parsedPositions[index].search_results = [];
			return;
		}

		searchDebounceTimers[index] = setTimeout(async () => {
			parsedPositions[index].is_searching = true;

			try {
				// ILIKE Suche in lv_positionen
				const searchPattern = `%${query}%`;
				const { data, error } = await supabase
					.from('lv_positionen')
					.select('id, artikelnummer, bezeichnung, preis, listenpreis, lv_typ')
					.or(`bezeichnung.ilike.${searchPattern},artikelnummer.ilike.${searchPattern}`)
					.limit(15);

				if (error) throw error;

				// Sortierung: Nach listenpreis DESC (teurere zuerst, da oft bessere Leistung)
				const results = (data || [])
					.map(p => ({
						id: p.id,
						artikelnummer: p.artikelnummer,
						bezeichnung: p.bezeichnung,
						einzelpreis: p.listenpreis || p.preis || 0,
						listenpreis: p.listenpreis || p.preis || 0,
						lv_typ: p.lv_typ
					}))
					.sort((a, b) => b.listenpreis - a.listenpreis);

				parsedPositions[index].search_results = results;
			} catch (err) {
				console.error('Freitextsuche fehlgeschlagen:', err);
				parsedPositions[index].search_results = [];
			} finally {
				parsedPositions[index].is_searching = false;
			}
		}, 300);
	}

	// Alternative auswählen (Step 3) - LEGACY, ersetzt durch Mehrfachauswahl
	// FIX: Verwende listenpreis (VK) statt einzelpreis (EK)
	async function selectAlternative(index: number, positionId: string) {
		if (!positionId) return;

		const alt = parsedPositions[index].alternativen.find(a => a.id === positionId);
		const originalPosition = parsedPositions[index].lv_position;
		if (alt) {
			// FIX: listenpreis ist VK-Preis, einzelpreis ist EK
			const preis = alt.listenpreis || alt.einzelpreis;
			const newPosition: LvPositionRef = {
				id: alt.id,
				artikelnummer: alt.artikelnummer,
				bezeichnung: alt.bezeichnung,
				einzelpreis: preis,
				listenpreis: preis,
				is_fallback: false
			};
			// Svelte 5: Komplette Neuzuweisung für Reaktivität
			parsedPositions = parsedPositions.map((pos, i) => {
				if (i !== index) return pos;
				return { ...pos, lv_position: newPosition, selected_positions: [newPosition] };
			});

			// Korrektur speichern mit der ursprünglichen (falschen) Position
			await saveCorrection(index, originalPosition?.id);
		}
	}

	// Korrektur speichern für Lern-System
	async function saveCorrection(index: number, falschePositionId?: string) {
		const pos = parsedPositions[index];
		if (!pos.lv_position) return;

		try {
			await fetch('/api/position-correction', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					original_text: pos.original_text,
					selected_position_id: pos.lv_position.id,
					falsche_position_id: falschePositionId || null,
					lv_typ: lvTyp
				})
			});
			correctionsSaved[index] = true;
		} catch (err) {
			console.error('Korrektur speichern fehlgeschlagen:', err);
		}
	}

	// Positionen zu Gruppen konvertieren (Step 3 -> 4)
	// NEU: Unterstützt Mehrfachauswahl (selected_positions Array)
	// FIX: Debug-Logging + explizite Snapshot-Erstellung für Svelte 5
	function convertToGroups() {
		console.log('[CPQ] convertToGroups gestartet');
		console.log('[CPQ] parsedPositions:', parsedPositions.length);

		const groups: Record<string, PositionGroupData> = {};
		let totalPositionsAdded = 0;

		// Expliziter Snapshot der aktuellen Werte (Svelte 5 Reaktivität)
		const currentPositions = [...parsedPositions];

		currentPositions.forEach((pos, idx) => {
			console.log(`[CPQ] Position ${idx}: selected=${pos.selected_positions.length}, lv_pos=${pos.lv_position?.bezeichnung || 'null'}`);

			// NEU: Alle ausgewählten Positionen verwenden, nicht nur lv_position
			const positionsToAdd = pos.selected_positions.length > 0
				? [...pos.selected_positions]  // Kopie erstellen
				: (pos.lv_position ? [pos.lv_position] : []);

			if (positionsToAdd.length === 0) {
				console.log(`[CPQ] Position ${idx}: Keine Positionen zum Hinzufügen`);
				return;
			}

			const gewerkName = pos.gewerk || 'Sonstige';

			if (!groups[gewerkName]) {
				groups[gewerkName] = {
					id: crypto.randomUUID(),
					name: gewerkName,
					positionen: []
				};
			}

			// Für jede ausgewählte Position einen Eintrag erstellen
			positionsToAdd.forEach(lvPos => {
				const preis = lvPos.listenpreis || lvPos.einzelpreis || 0;
				console.log(`[CPQ] Füge hinzu: ${lvPos.bezeichnung} @ ${preis} EUR`);
				groups[gewerkName].positionen.push({
					id: crypto.randomUUID(),
					artikelnummer: lvPos.artikelnummer,
					bezeichnung: lvPos.bezeichnung,
					menge: pos.menge,
					einheit: pos.einheit,
					einzelpreis: preis
				});
				totalPositionsAdded++;
			});
		});

		const newGroups = Object.values(groups);
		console.log(`[CPQ] convertToGroups fertig: ${newGroups.length} Gruppen, ${totalPositionsAdded} Positionen`);

		// Explizite Zuweisung für Svelte 5 Reaktivität
		positionGroups = newGroups;
	}

	// Abhängigkeiten laden (Step 5)
	async function loadDependencies() {
		const positionIds = allPositions.map(p => {
			// Find original LV-Position ID
			const parsed = parsedPositions.find(pp =>
				pp.lv_position?.artikelnummer === p.artikelnummer
			);
			return parsed?.lv_position?.id;
		}).filter(Boolean);

		if (positionIds.length === 0) return;

		try {
			// Nutze die echten FK-Spalten (source_lv_position_id, target_lv_position_id)
			// ausloeser_id und benoetigt_id sind generierte Alias-Spalten
			const { data, error } = await supabase
				.from('position_dependencies')
				.select(`
					id,
					source_lv_position_id,
					ausloeser:lv_positionen!source_lv_position_id_fkey(bezeichnung),
					target_lv_position_id,
					benoetigt:lv_positionen!target_lv_position_id_fkey(bezeichnung, listenpreis),
					grund,
					optional
				`)
				.in('source_lv_position_id', positionIds);

			if (error) throw error;

			dependencies = (data || []).map(d => ({
				id: d.id,
				ausloeser_id: d.source_lv_position_id,
				ausloeser_name: (d.ausloeser as any)?.bezeichnung || 'Unbekannt',
				position_id: d.target_lv_position_id,
				position_name: (d.benoetigt as any)?.bezeichnung || 'Unbekannt',
				preis: (d.benoetigt as any)?.listenpreis || 0,
				grund: d.grund,
				optional: d.optional ?? false,
				accepted: !(d.optional ?? false) // Pflicht-Abhängigkeiten standardmäßig akzeptiert
			}));
		} catch (err) {
			console.error('Abhängigkeiten laden fehlgeschlagen:', err);
		}
	}

	// Abhängigkeit toggle
	function toggleDep(depId: string) {
		const dep = dependencies.find(d => d.id === depId);
		if (dep) {
			dep.accepted = !dep.accepted;
			dependencies = [...dependencies];
		}
	}

	// Pricing Profiles laden
	async function loadPricingProfiles() {
		try {
			const { data, error } = await supabase
				.from('pricing_profiles')
				.select('id, name, aufschlag_prozent')
				.eq('aktiv', true)
				.order('name');

			if (error) throw error;

			pricingProfiles = (data || []).map(p => ({
				id: p.id,
				name: p.name,
				aufschlag: p.aufschlag_prozent
			}));

			if (pricingProfiles.length > 0) {
				selectedProfileId = pricingProfiles[0].id;
			}
		} catch (err) {
			console.error('Pricing Profiles laden fehlgeschlagen:', err);
		}
	}

	// Vorschau generieren
	function generatePreview() {
		const heute = new Date().toLocaleDateString('de-DE');
		let html = `
			<div style="font-family: Arial, sans-serif; max-width: 800px;">
				<h2>Angebot</h2>
				<p><strong>Datum:</strong> ${heute}</p>
				<p><strong>Projekt:</strong> ${selectedProjekt?.projektname || 'Kein Projekt'}</p>
				<p><strong>LV-Typ:</strong> ${lvTyp}</p>
				<hr>
				<h3>Positionen</h3>
				<table style="width: 100%; border-collapse: collapse;">
					<thead>
						<tr style="background: #f5f5f5;">
							<th style="text-align: left; padding: 8px; border: 1px solid #ddd;">Pos.</th>
							<th style="text-align: left; padding: 8px; border: 1px solid #ddd;">Bezeichnung</th>
							<th style="text-align: right; padding: 8px; border: 1px solid #ddd;">Menge</th>
							<th style="text-align: right; padding: 8px; border: 1px solid #ddd;">EP</th>
							<th style="text-align: right; padding: 8px; border: 1px solid #ddd;">GP</th>
						</tr>
					</thead>
					<tbody>
		`;

		let posNr = 1;
		positionGroups.forEach(group => {
			html += `<tr><td colspan="5" style="background: #e0e0e0; padding: 8px; font-weight: bold;">${group.name}</td></tr>`;
			group.positionen.forEach(pos => {
				const gp = pos.menge * pos.einzelpreis;
				html += `
					<tr>
						<td style="padding: 8px; border: 1px solid #ddd;">${posNr++}</td>
						<td style="padding: 8px; border: 1px solid #ddd;">${pos.bezeichnung}</td>
						<td style="text-align: right; padding: 8px; border: 1px solid #ddd;">${pos.menge.toFixed(2)} ${pos.einheit}</td>
						<td style="text-align: right; padding: 8px; border: 1px solid #ddd;">${pos.einzelpreis.toFixed(2)} EUR</td>
						<td style="text-align: right; padding: 8px; border: 1px solid #ddd;">${gp.toFixed(2)} EUR</td>
					</tr>
				`;
			});
		});

		html += `
					</tbody>
					<tfoot>
						<tr>
							<td colspan="4" style="text-align: right; padding: 8px; font-weight: bold;">Netto:</td>
							<td style="text-align: right; padding: 8px; font-weight: bold;">${nettoSumme.toFixed(2)} EUR</td>
						</tr>
						<tr>
							<td colspan="4" style="text-align: right; padding: 8px;">MwSt. (19%):</td>
							<td style="text-align: right; padding: 8px;">${mwst.toFixed(2)} EUR</td>
						</tr>
						<tr>
							<td colspan="4" style="text-align: right; padding: 8px; font-weight: bold; font-size: 1.1em;">Brutto:</td>
							<td style="text-align: right; padding: 8px; font-weight: bold; font-size: 1.1em;">${bruttoSumme.toFixed(2)} EUR</td>
						</tr>
					</tfoot>
				</table>
			</div>
		`;

		angebotsVorschau = html;
	}

	// Speichern und Exportieren
	async function saveAndExport() {
		isSaving = true;

		try {
			// Angebot in DB speichern
			const { data: angebotsNr, error: seqError } = await supabase
				.rpc('get_next_dokument_nr', { prefix: 'ANG' });

			if (seqError) throw seqError;

			const { data: angebot, error: saveError } = await supabase
				.from('angebote')
				.insert({
					angebotsnummer: angebotsNr,
					projekt_id: selectedProjektId || null,
					projektname: selectedProjekt?.projektname || null,
					auftraggeber: selectedProjekt?.projektname_komplett?.split('|')[0]?.trim() || null,
					lv_typ: lvTyp,
					status: 'entwurf',
					summe_netto: nettoSumme,
					summe_brutto: bruttoSumme,
					pricing_profile_id: selectedProfileId || null,
					rabatt_prozent: globalRabatt,
					include_bedarfspositionen: includeBedarfspositionen,
					include_angebotsannahme: includeAngebotsannahme,
					gueltig_bis: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
				})
				.select()
				.single();

			if (saveError) throw saveError;

			// Positionen speichern
			const positionen = allPositions.map((pos, index) => ({
				angebot_id: angebot.id,
				position_nr: index + 1,
				gewerk: positionGroups.find(g => g.positionen.some(p => p.id === pos.id))?.name || 'Sonstige',
				artikelnummer: pos.artikelnummer,
				bezeichnung: pos.bezeichnung,
				menge: pos.menge,
				einheit: pos.einheit,
				einzelpreis: pos.einzelpreis,
				gesamtpreis: pos.menge * pos.einzelpreis
			}));

			const { error: posError } = await supabase
				.from('angebots_positionen')
				.insert(positionen);

			if (posError) throw posError;

			// Zur Angebotsübersicht navigieren
			goto('/angebote');
		} catch (err) {
			console.error('Speichern fehlgeschlagen:', err);
			alert('Fehler beim Speichern: ' + getErrorMessage(err));
		} finally {
			isSaving = false;
		}
	}

	// PDF generieren (Platzhalter)
	function generatePDF() {
		alert('PDF-Generierung wird in der nächsten Version implementiert');
	}

	// Navigation
	function nextStep() {
		if (currentStep === 3) {
			convertToGroups();
		}
		if (currentStep === 4) {
			loadDependencies();
		}
		if (currentStep === 7) {
			generatePreview();
		}
		if (currentStep < steps.length) {
			currentStep++;
		}
	}

	function prevStep() {
		if (currentStep > 1) {
			currentStep--;
		}
	}

	// Can proceed?
	let canProceed = $derived.by(() => {
		switch (currentStep) {
			case 1: return selectedProjektId !== '' || lvTyp !== '';
			case 2: return transkriptionText.trim().length > 0;
			case 3: return parsedPositions.some(p => p.selected_positions.length > 0 || p.lv_position !== null);
			case 4: return positionGroups.length > 0;
			case 5: return true;
			case 6: return allPositions.length > 0;
			case 7: return selectedProfileId !== '';
			case 8: return true;
			default: return true;
		}
	});

	// Load initial data
	async function loadProjekte() {
		try {
			const { data, error } = await supabase
				.from('monday_bauprozess')
				.select('id, name, column_values')
				.order('name');

			if (error) throw error;

			// Filter und map: Phase < 6 (Phase ist im Format "(0) Offen", "(1) Geplant", etc.)
			projekte = (data || [])
				.map(p => {
					const columnValues = p.column_values as Record<string, { text?: string; value?: unknown }> | null;
					const phaseText = columnValues?.status__1?.text || '(0) Offen';
					// Extrahiere Phase-Nummer aus "(0) Offen" -> 0
					const phaseMatch = phaseText.match(/\((\d+)\)/);
					const phase = phaseMatch ? parseInt(phaseMatch[1]) : 0;

					// Auftraggeber und Adresse aus column_values extrahieren
					const auftraggeber = columnValues?.text_mkm11jca?.text || columnValues?.auftraggeber?.text || '';
					const adresse = columnValues?.text51__1?.text || '';
					// Vollständiger Name: "Auftraggeber | Projektname" für LV-Typ-Mapping
					const vollstaendigerName = auftraggeber ? `${auftraggeber} | ${p.name}` : p.name;

					return {
						id: p.id,
						projektname: p.name,
						projektname_komplett: vollstaendigerName,
						phase: phase
					};
				})
				.filter(p => p.phase < 6);
		} catch (err) {
			console.error('Projekte laden fehlgeschlagen:', err);
		}
	}

	onMount(() => {
		loadProjekte();
		loadPricingProfiles();
	});

	// Position manuell hinzufügen (Step 4)
	function addPositionManual() {
		// TODO: Modal für manuelle Position
		alert('Manuelle Position hinzufügen - wird implementiert');
	}

	// Handle groups change
	function handleGroupsChange(newGroups: PositionGroupData[]) {
		positionGroups = newGroups;
	}

	// Format helpers
	function formatCurrency(value: number): string {
		return value.toLocaleString('de-DE', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
	}

	// Robuste Fehlerbehandlung für Supabase und andere Fehlertypen
	function getErrorMessage(err: unknown): string {
		if (err instanceof Error) return err.message;
		if (typeof err === 'object' && err !== null) {
			// Supabase FunctionsHttpError oder ähnlich
			if ('message' in err && typeof (err as Record<string, unknown>).message === 'string') {
				return (err as Record<string, unknown>).message as string;
			}
			// Supabase error object mit context
			if ('context' in err) {
				const context = (err as Record<string, unknown>).context;
				if (typeof context === 'object' && context !== null && 'message' in context) {
					const msg = (context as Record<string, unknown>).message;
					if (typeof msg === 'string') return msg;
				}
			}
			// Fallback: JSON-Darstellung
			try {
				return JSON.stringify(err);
			} catch {
				return 'Unbekannter Fehler (Objekt)';
			}
		}
		return String(err);
	}
</script>

<svelte:head>
	<title>Neues Angebot - neurealis ERP</title>
</svelte:head>

<div class="wizard-container">
	<!-- Wizard Header -->
	<header class="wizard-header">
		<div class="header-title">
			<button class="back-btn" onclick={() => goto('/angebote')}>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M19 12H5M12 19l-7-7 7-7"/>
				</svg>
			</button>
			<h1>Neues Angebot erstellen</h1>
		</div>

		<!-- Progress Steps -->
		<div class="wizard-nav">
			<div class="steps">
				{#each steps as step, i}
					<div
						class="step"
						class:active={currentStep === step.id}
						class:completed={currentStep > step.id}
						class:clickable={currentStep > step.id}
						onclick={() => currentStep > step.id && (currentStep = step.id)}
					>
						<span class="step-number">
							{#if currentStep > step.id}
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
									<polyline points="20 6 9 17 4 12"/>
								</svg>
							{:else}
								{step.id}
							{/if}
						</span>
						<span class="step-name">{step.name}</span>
					</div>
				{/each}
			</div>
		</div>
	</header>

	<!-- Wizard Content -->
	<main class="wizard-content">
		<!-- Step 1: Projekt + Struktur -->
		{#if currentStep === 1}
			<Card>
				{#snippet header()}
					<h2>Projekt und Struktur auswählen</h2>
				{/snippet}

				<div class="form-grid">
					<div class="form-group">
						<label for="projekt">Projekt (optional)</label>
						<select id="projekt" bind:value={selectedProjektId} onchange={onProjektSelect}>
							<option value="">-- Kein Projekt (Freitext) --</option>
							{#each projekte as projekt}
								<option value={projekt.id}>
									{projekt.projektname_komplett || projekt.projektname}
								</option>
							{/each}
						</select>
						<p class="hint">Nur Projekte in Phase &lt; 6 werden angezeigt</p>
					</div>

					<div class="form-group">
						<label for="lvtyp">LV-Typ</label>
						<select id="lvtyp" bind:value={lvTyp}>
							<option value="GWS">GWS</option>
							<option value="VBW">VBW</option>
							<option value="vonovia">Vonovia</option>
							<option value="neurealis">neurealis (Privat)</option>
						</select>
						{#if selectedProjekt}
							<p class="hint">Automatisch aus Auftraggeber ermittelt</p>
						{/if}
					</div>

					<div class="form-group">
						<label>Angebots-Struktur</label>
						<div class="radio-group">
							<label class="radio-option">
								<input type="radio" bind:group={strukturTyp} value="gewerk" />
								<span class="radio-label">Nach Gewerken</span>
								<span class="radio-desc">Elektro, Sanitär, Maler, Boden...</span>
							</label>
							<label class="radio-option">
								<input type="radio" bind:group={strukturTyp} value="raum" />
								<span class="radio-label">Nach Räumen</span>
								<span class="radio-desc">Bad, Küche, Wohnzimmer...</span>
							</label>
						</div>
					</div>

					<div class="form-group">
						<label for="matterport">Matterport-Link (optional)</label>
						<input
							type="url"
							id="matterport"
							bind:value={matterportLink}
							placeholder="https://my.matterport.com/show/?m=..."
						/>
					</div>
				</div>
			</Card>
		{/if}

		<!-- Step 2: Eingabe -->
		{#if currentStep === 2}
			<Card>
				{#snippet header()}
					<h2>Transkription eingeben</h2>
				{/snippet}

				<div class="input-step">
					<!-- NEU: Optionale Wohnungsgröße für VBW-Staffelpreise -->
					{#if lvTyp === 'VBW'}
						<div class="wohnungsgroesse-input">
							<label for="wohnungsgroesse">
								Wohnungsgröße (optional, für Staffelpreise)
							</label>
							<div class="wohnungsgroesse-row">
								<input
									type="number"
									id="wohnungsgroesse"
									bind:value={manuelleWohnungsgroesse}
									placeholder="z.B. 65"
									min="10"
									max="300"
									step="1"
								/>
								<span class="unit">m²</span>
								{#if manuelleWohnungsgroesse}
									{@const parsed = parseFloat(manuelleWohnungsgroesse)}
									{@const staffel = parsed <= 45 ? 'bis 45 m²' : parsed <= 75 ? '45-75 m²' : parsed <= 110 ? '75-110 m²' : 'über 110 m²'}
									<Badge variant="info" size="sm">{staffel}</Badge>
								{/if}
							</div>
							<p class="hint">
								VBW hat Staffelpreise: bis 45 m², 45-75 m², 75-110 m². Die KI erkennt die Größe auch automatisch aus dem Text.
							</p>
						</div>
					{/if}

					<textarea
						class="transkription-input"
						bind:value={transkriptionText}
						placeholder="Baubesprechungs-Transkription oder Anfrage-Text hier einfügen...

Beispiel:
- Bad komplett neu fliesen, ca. 12 qm Wand und 6 qm Boden
- Neue Dusche installieren mit Glasabtrennung
- Elektrik: 5 neue Steckdosen, 3 Lichtauslässe
- Malerarbeiten Wohnzimmer 45 qm

Tipp: Wohnungsgröße erwähnen für korrekte VBW-Staffelpreise (z.B. 'Wohnung ca. 60 m²')
..."
					></textarea>

					{#if isAnalyzing}
						<div class="progress-container">
							<div class="progress-bar">
								<div class="progress-bar-indeterminate"></div>
							</div>
							<span class="progress-text">Analysiere Transkription...</span>
						</div>
					{/if}

					<p class="info-text">
						Die KI analysiert automatisch Deutsch, Englisch, Ungarisch, Rumänisch und Russisch.
						Mehrere Positionen werden automatisch erkannt und getrennt.
					</p>

					{#if analyzeError}
						<div class="error-message">
							{analyzeError}
						</div>
					{/if}

					<div class="input-actions">
						<Button
							variant="primary"
							onclick={analyzeTranskription}
							disabled={!transkriptionText.trim() || isAnalyzing}
							loading={isAnalyzing}
						>
							{isAnalyzing ? 'Analysiere...' : 'Analysieren'}
						</Button>
					</div>
				</div>
			</Card>
		{/if}

		<!-- Step 3: Positionen prüfen -->
		{#if currentStep === 3}
			<Card padding="none">
				{#snippet header()}
					<div class="step-header">
						<h2>Erkannte Positionen prüfen</h2>
						<div class="header-badges">
							<Badge variant="info">{parsedPositions.length} Positionen</Badge>
							{#if kundenKontext.wohnungsgroesse_staffel}
								<Badge variant="success">🏠 {kundenKontext.wohnungsgroesse_staffel}</Badge>
							{/if}
						</div>
					</div>
				{/snippet}

				<!-- NEU: Kontext-Info-Box -->
				{#if kundenKontext.wohnungsgroesse_m2 || kundenKontext.raumanzahl || kundenKontext.baujahr}
					<div class="kontext-info-box">
						<div class="kontext-header">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
								<polyline points="9 22 9 12 15 12 15 22"/>
							</svg>
							<span>Erkannte Wohnungsinformationen</span>
						</div>
						<div class="kontext-details">
							{#if kundenKontext.wohnungsgroesse_m2}
								<div class="kontext-item">
									<span class="label">Wohnungsgröße:</span>
									<span class="value">{kundenKontext.wohnungsgroesse_m2} m² ({kundenKontext.wohnungsgroesse_staffel})</span>
								</div>
							{/if}
							{#if kundenKontext.raumanzahl}
								<div class="kontext-item">
									<span class="label">Räume:</span>
									<span class="value">{kundenKontext.raumanzahl}</span>
								</div>
							{/if}
							{#if kundenKontext.stockwerk !== undefined}
								<div class="kontext-item">
									<span class="label">Stockwerk:</span>
									<span class="value">{kundenKontext.stockwerk === 0 ? 'Erdgeschoss' : kundenKontext.stockwerk < 0 ? 'Keller' : `${kundenKontext.stockwerk}. OG`}</span>
								</div>
							{/if}
							{#if kundenKontext.baujahr}
								<div class="kontext-item">
									<span class="label">Baujahr:</span>
									<span class="value">{kundenKontext.baujahr}</span>
								</div>
							{/if}
						</div>
						{#if lvTyp === 'VBW' && kundenKontext.wohnungsgroesse_staffel}
							<p class="kontext-hint">
								VBW-Staffelpositionen werden automatisch für "{kundenKontext.wohnungsgroesse_staffel}" priorisiert.
							</p>
						{/if}
					</div>
				{/if}

				<div class="position-check-list">
					{#each parsedPositions as pos, index}
						<div class="check-row-expanded" class:has-fallback={pos.lv_position?.is_fallback} class:no-match={!pos.lv_position && pos.selected_positions.length === 0}>
							<!-- Obere Zeile: Original-Text -->
							<div class="row-header">
								<div class="col-original">
									<label>Original-Text:</label>
									<p class="original-text">{pos.original_text}</p>
									<span class="meta">{pos.menge} {pos.einheit} | {pos.gewerk}</span>
								</div>
							</div>

							<!-- Ausgewählte Positionen (Mehrfachauswahl) -->
							<div class="selected-positions-section">
								<label>Ausgewählt für diese Leistung: {pos.selected_positions.length} Position(en)</label>
								{#if pos.selected_positions.length > 0}
									<div class="selected-positions-list">
										{#each pos.selected_positions as selPos}
											<div class="selected-item">
												<div class="selected-item-info">
													<Badge variant="success" size="sm">{selPos.lv_typ || pos.gewerk}</Badge>
													<strong>{selPos.bezeichnung}</strong>
													<span class="pos-nummer">{selPos.artikelnummer}</span>
													<span class="pos-price">{formatCurrency(selPos.listenpreis || selPos.einzelpreis)} EUR</span>
												</div>
												<button
													class="remove-btn"
													onclick={() => removeSelectedPosition(index, selPos.id)}
													title="Position entfernen"
												>
													<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
														<polyline points="3 6 5 6 21 6"/>
														<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
														<line x1="10" y1="11" x2="10" y2="17"/>
														<line x1="14" y1="11" x2="14" y2="17"/>
													</svg>
												</button>
											</div>
										{/each}
									</div>
								{:else}
									<div class="no-match-info">
										<Badge variant="error" size="sm">Keine Position ausgewählt</Badge>
										<p>Bitte wählen Sie unten Positionen aus</p>
									</div>
								{/if}
							</div>

							<!-- LV-Typ Filter + Alternativen (einklappbar) -->
							<div class="alternatives-section" class:collapsed={pos.alternatives_collapsed}>
								<button
									class="collapse-toggle"
									onclick={() => {
										parsedPositions = parsedPositions.map((p, i) =>
											i === index ? { ...p, alternatives_collapsed: !p.alternatives_collapsed } : p
										);
									}}
									title={pos.alternatives_collapsed ? 'Vorschläge anzeigen' : 'Vorschläge ausblenden'}
								>
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										class="chevron"
										class:rotated={!pos.alternatives_collapsed}
									>
										<polyline points="9 18 15 12 9 6"/>
									</svg>
									<span>Vorschläge ({pos.alternativen?.length || 0})</span>
									{#if pos.alternatives_collapsed && pos.alternativen?.[0]?.similarity}
										<Badge variant="success" size="sm">{Math.round((pos.alternativen[0].similarity || 0) * 100)}% Match</Badge>
									{/if}
								</button>

								{#if !pos.alternatives_collapsed}
									<div class="filter-row">
										<label for="lv-filter-{index}">LV-Typ filtern:</label>
										<select
											id="lv-filter-{index}"
											value={pos.filter_lv_typ}
											onchange={(e) => onFilterLvTypChange(index, (e.target as HTMLSelectElement).value)}
										>
											{#each lvTypOptions as typ}
												<option value={typ}>{typ}</option>
											{/each}
										</select>
										{#if pos.is_searching}
											<span class="loading-indicator">Lädt...</span>
										{/if}
									</div>

									{#if pos.alternativen && pos.alternativen.length > 0}
										<div class="alternatives-list">
											<label>Vorschläge ({pos.filter_lv_typ}):</label>
										{#each pos.alternativen as alt}
											{@const isSelected = pos.selected_positions.some(p => p.id === alt.id)}
											<div class="alternative-item" class:selected={isSelected}>
												<div class="alt-content">
													<label class="checkbox-label">
														<input
															type="checkbox"
															checked={isSelected}
															onchange={(e) => {
																const checked = (e.target as HTMLInputElement).checked;
																if (checked) {
																	addPositionFromAlternative(index, alt);
																} else {
																	removeSelectedPosition(index, alt.id);
																}
															}}
														/>
														<span class="alt-info">
															<span class="alt-name">{alt.bezeichnung}</span>
															<span class="alt-artikelnr">{alt.artikelnummer}</span>
															<span class="alt-price">{formatCurrency(alt.listenpreis || alt.einzelpreis)} €/{pos.einheit}</span>
														</span>
													</label>
													{#if !isSelected}
														<button
															class="add-btn"
															onclick={() => addPositionFromAlternative(index, alt)}
															title="Position hinzufügen"
														>
															<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
																<line x1="12" y1="5" x2="12" y2="19"/>
																<line x1="5" y1="12" x2="19" y2="12"/>
															</svg>
														</button>
													{/if}
												</div>
											</div>
										{/each}
									</div>
									{:else if !pos.is_searching}
										<p class="no-alternatives">Keine Vorschläge für {pos.filter_lv_typ}</p>
									{/if}
								{/if}
							</div>

							<!-- Freitextsuche -->
							<div class="search-section">
								<label for="search-{index}">Freitextsuche (alle LV-Typen):</label>
								<div class="search-input-row">
									<input
										type="text"
										id="search-{index}"
										placeholder="Artikelnummer oder Bezeichnung suchen..."
										value={pos.search_query}
										oninput={(e) => onSearchQueryChange(index, (e.target as HTMLInputElement).value)}
									/>
									{#if pos.is_searching}
										<span class="loading-indicator">Sucht...</span>
									{/if}
								</div>

								{#if pos.search_results.length > 0}
									<div class="search-results">
										{#each pos.search_results as result}
											{@const isSelected = pos.selected_positions.some(p => p.id === result.id)}
											<div class="search-result-item" class:selected={isSelected}>
												<div class="result-content">
													<label class="checkbox-label">
														<input
															type="checkbox"
															checked={isSelected}
															onchange={(e) => {
																const checked = (e.target as HTMLInputElement).checked;
																if (checked) {
																	addPositionFromAlternative(index, result);
																} else {
																	removeSelectedPosition(index, result.id);
																}
															}}
														/>
														<span class="result-info">
															<Badge variant="info" size="sm">{result.lv_typ || '?'}</Badge>
															<span class="result-name">{result.bezeichnung}</span>
															<span class="result-artikelnr">{result.artikelnummer}</span>
															<span class="result-price">{formatCurrency(result.listenpreis || result.einzelpreis)} €/{pos.einheit}</span>
														</span>
													</label>
													{#if !isSelected}
														<button
															class="add-btn"
															onclick={() => addPositionFromAlternative(index, result)}
															title="Position hinzufügen"
														>
															<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
																<line x1="12" y1="5" x2="12" y2="19"/>
																<line x1="5" y1="12" x2="19" y2="12"/>
															</svg>
														</button>
													{/if}
												</div>
											</div>
										{/each}
									</div>
								{:else if pos.search_query.length >= 2 && !pos.is_searching}
									<p class="no-results">Keine Ergebnisse für "{pos.search_query}"</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</Card>
		{/if}

		<!-- Step 4: Positionsgruppen bearbeiten -->
		{#if currentStep === 4}
			<Card padding="none">
				{#snippet header()}
					<h2>Positionsgruppen bearbeiten</h2>
				{/snippet}

				<div class="groups-editor">
					<PositionGroupList
						bind:groups={positionGroups}
						onGroupsChange={handleGroupsChange}
					/>

					<div class="group-actions">
						<Button variant="secondary" onclick={addPositionManual}>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<line x1="12" y1="5" x2="12" y2="19"/>
								<line x1="5" y1="12" x2="19" y2="12"/>
							</svg>
							Position manuell hinzufügen
						</Button>
					</div>
				</div>
			</Card>
		{/if}

		<!-- Step 5: Abhängigkeiten -->
		{#if currentStep === 5}
			<Card>
				{#snippet header()}
					<div class="step-header">
						<h2>Abhängigkeiten prüfen</h2>
						<Badge variant="info">{dependencies.length} Abhängigkeiten</Badge>
					</div>
				{/snippet}

				{#if dependencies.length === 0}
					<div class="empty-dependencies">
						<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
						</svg>
						<p>Keine Abhängigkeiten für die ausgewählten Positionen gefunden.</p>
					</div>
				{:else}
					<div class="dependencies-list">
						{#each dependencies as dep}
							<div class="dependency-row" class:rejected={!dep.accepted}>
								<label class="dep-checkbox">
									<input
										type="checkbox"
										checked={dep.accepted}
										onchange={() => toggleDep(dep.id)}
									/>
								</label>
								<div class="dep-content">
									<span class="dep-reason">
										<strong>{dep.ausloeser_name}</strong> erfordert:
									</span>
									<span class="dep-position">{dep.position_name}</span>
								</div>
								<span class="dep-price">{formatCurrency(dep.preis)} EUR</span>
							</div>
						{/each}
					</div>
				{/if}
			</Card>
		{/if}

		<!-- Step 6: Aufmaß-Anpassung -->
		{#if currentStep === 6}
			<Card padding="none">
				{#snippet header()}
					<h2>Aufmaß anpassen</h2>
				{/snippet}

				<div class="aufmass-wrapper">
					<table class="aufmass-table">
						<thead>
							<tr>
								<th>Position</th>
								<th class="text-right">Menge</th>
								<th>Einheit</th>
								<th>Kalkulator</th>
								<th class="text-right">EP</th>
								<th class="text-right">GP</th>
							</tr>
						</thead>
						<tbody>
							{#each allPositions as pos, index}
								<tr>
									<td class="pos-bezeichnung">{pos.bezeichnung}</td>
									<td class="text-right">
										<input
											type="number"
											class="menge-input"
											bind:value={pos.menge}
											min="0"
											step="0.01"
										/>
									</td>
									<td>{pos.einheit}</td>
									<td class="kalkulator">
										{#if pos.einheit === 'm2' || pos.einheit === 'qm'}
											<div class="calc-inputs">
												<input type="number" placeholder="L" bind:value={pos.laenge} step="0.01" />
												<span>x</span>
												<input type="number" placeholder="B" bind:value={pos.breite} step="0.01" />
												<button
													class="calc-btn"
													onclick={() => {
														if (pos.laenge && pos.breite) {
															pos.menge = pos.laenge * pos.breite;
														}
													}}
												>
													= m2
												</button>
											</div>
										{:else}
											<span class="no-calc">-</span>
										{/if}
									</td>
									<td class="text-right">{formatCurrency(pos.einzelpreis)} EUR</td>
									<td class="text-right gp">{formatCurrency(pos.menge * pos.einzelpreis)} EUR</td>
								</tr>
							{/each}
						</tbody>
						<tfoot>
							<tr class="total-row">
								<td colspan="5"><strong>Gesamt Netto:</strong></td>
								<td class="text-right"><strong>{formatCurrency(gesamtNetto)} EUR</strong></td>
							</tr>
						</tfoot>
					</table>
				</div>
			</Card>
		{/if}

		<!-- Step 7: Preise/Margen -->
		{#if currentStep === 7}
			<Card>
				{#snippet header()}
					<h2>Preiskonfiguration</h2>
				{/snippet}

				<div class="pricing-config">
					<div class="form-row">
						<div class="form-group">
							<label for="profile">Pricing-Profil</label>
							<select id="profile" bind:value={selectedProfileId}>
								{#each pricingProfiles as profile}
									<option value={profile.id}>
										{profile.name} (+{profile.aufschlag}%)
									</option>
								{/each}
							</select>
						</div>

						<div class="form-group">
							<label for="rabatt">Globaler Rabatt (%)</label>
							<input
								type="number"
								id="rabatt"
								bind:value={globalRabatt}
								min="0"
								max="100"
								step="0.5"
							/>
						</div>
					</div>

					<div class="margin-summary">
						<div class="margin-row">
							<span>EK-Summe:</span>
							<span class="value">{formatCurrency(ekSumme)} EUR</span>
						</div>
						<div class="margin-row">
							<span>Aufschlag ({aufschlag}%):</span>
							<span class="value">+{formatCurrency(ekSumme * aufschlag / 100)} EUR</span>
						</div>
						{#if globalRabatt > 0}
							<div class="margin-row">
								<span>Rabatt ({globalRabatt}%):</span>
								<span class="value discount">-{formatCurrency(ekSumme * (1 + aufschlag / 100) * globalRabatt / 100)} EUR</span>
							</div>
						{/if}
						<div class="margin-row">
							<span>VK-Summe:</span>
							<span class="value">{formatCurrency(vkSumme)} EUR</span>
						</div>
						<div class="margin-row highlight">
							<span>Marge:</span>
							<span class="value">{((vkSumme - ekSumme) / vkSumme * 100).toFixed(1)}%</span>
						</div>
					</div>

					<hr />

					<div class="totals">
						<div class="total-row">
							<span>Netto:</span>
							<span>{formatCurrency(nettoSumme)} EUR</span>
						</div>
						<div class="total-row">
							<span>MwSt (19%):</span>
							<span>{formatCurrency(mwst)} EUR</span>
						</div>
						<div class="total-row brutto">
							<span>Brutto:</span>
							<span>{formatCurrency(bruttoSumme)} EUR</span>
						</div>
					</div>
				</div>
			</Card>
		{/if}

		<!-- Step 8: Freigabe + Export -->
		{#if currentStep === 8}
			<Card>
				{#snippet header()}
					<h2>Angebot abschließen</h2>
				{/snippet}

				<div class="export-step">
					<div class="options">
						<label class="checkbox-option">
							<input type="checkbox" bind:checked={includeBedarfspositionen} />
							<span>Bedarfspositionen anhängen (Regiearbeiten, etc.)</span>
						</label>

						<label class="checkbox-option">
							<input type="checkbox" bind:checked={includeAngebotsannahme} />
							<span>Angebotsannahme-Formular anhängen</span>
						</label>

						{#if isNUA}
							<label class="checkbox-option">
								<input type="checkbox" bind:checked={includeNUAVertragswerk} />
								<span>NUA-Vertragswerk anhängen (Paragraf 1-12)</span>
							</label>
						{/if}
					</div>

					<div class="preview-section">
						<h3>Vorschau</h3>
						<div class="preview-frame">
							{@html angebotsVorschau}
						</div>
					</div>

					<div class="export-actions">
						<Button variant="secondary" onclick={generatePDF}>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
								<polyline points="14 2 14 8 20 8"/>
								<line x1="16" y1="13" x2="8" y2="13"/>
								<line x1="16" y1="17" x2="8" y2="17"/>
								<polyline points="10 9 9 9 8 9"/>
							</svg>
							PDF Vorschau
						</Button>
						<Button variant="primary" onclick={saveAndExport} loading={isSaving} disabled={isSaving}>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
								<polyline points="17 21 17 13 7 13 7 21"/>
								<polyline points="7 3 7 8 15 8"/>
							</svg>
							{isSaving ? 'Speichern...' : 'Speichern & Exportieren'}
						</Button>
					</div>
				</div>
			</Card>
		{/if}
	</main>

	<!-- Wizard Footer -->
	<footer class="wizard-footer">
		<div class="nav-buttons">
			{#if currentStep > 1}
				<Button variant="secondary" onclick={prevStep}>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M19 12H5M12 19l-7-7 7-7"/>
					</svg>
					Zurück
				</Button>
			{:else}
				<div></div>
			{/if}

			{#if currentStep < steps.length}
				<Button variant="primary" onclick={nextStep} disabled={!canProceed}>
					Weiter
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M5 12h14M12 5l7 7-7 7"/>
					</svg>
				</Button>
			{/if}
		</div>
	</footer>
</div>

<style>
	.wizard-container {
		display: flex;
		flex-direction: column;
		min-height: calc(100vh - 120px);
	}

	/* Header */
	.wizard-header {
		background: white;
		border-bottom: 1px solid var(--color-gray-200);
		padding: 1rem 1.5rem;
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.header-title {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.header-title h1 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.back-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border: 1px solid var(--color-gray-300);
		background: white;
		color: var(--color-gray-600);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.back-btn:hover {
		background: var(--color-gray-50);
		color: var(--color-gray-800);
	}

	/* Steps Nav */
	.wizard-nav {
		overflow-x: auto;
	}

	.steps {
		display: flex;
		gap: 0;
	}

	.step {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		white-space: nowrap;
		color: var(--color-gray-400);
		border-bottom: 2px solid transparent;
		transition: all 0.15s ease;
	}

	.step.active {
		color: var(--color-brand-medium);
		border-bottom-color: var(--color-brand-medium);
	}

	.step.completed {
		color: var(--color-success);
	}

	.step.clickable {
		cursor: pointer;
	}

	.step.clickable:hover {
		background: var(--color-gray-50);
	}

	.step-number {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		font-size: 0.75rem;
		font-weight: 600;
		background: var(--color-gray-200);
		color: var(--color-gray-600);
	}

	.step.active .step-number {
		background: var(--color-brand-medium);
		color: white;
	}

	.step.completed .step-number {
		background: var(--color-success);
		color: white;
	}

	.step-name {
		font-size: 0.85rem;
		font-weight: 500;
	}

	/* Content */
	.wizard-content {
		flex: 1;
		padding: 1.5rem;
	}

	.wizard-content h2 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 600;
	}

	.step-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	/* Form Elements */
	.form-grid {
		display: grid;
		gap: 1.5rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-group label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-gray-700);
	}

	.form-group select,
	.form-group input[type="text"],
	.form-group input[type="url"],
	.form-group input[type="number"] {
		padding: 0.6rem 0.75rem;
		border: 1px solid var(--color-gray-300);
		font-size: 0.9rem;
	}

	.form-group select:focus,
	.form-group input:focus {
		outline: none;
		border-color: var(--color-brand-medium);
	}

	.hint {
		font-size: 0.75rem;
		color: var(--color-gray-500);
		margin: 0;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	/* Radio Group */
	.radio-group {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.radio-option {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 1rem;
		border: 1px solid var(--color-gray-200);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.radio-option:hover {
		border-color: var(--color-gray-300);
		background: var(--color-gray-50);
	}

	.radio-option:has(input:checked) {
		border-color: var(--color-brand-medium);
		background: var(--color-brand-light, #FFF5F5);
	}

	.radio-option input {
		margin-top: 0.15rem;
	}

	.radio-label {
		font-weight: 500;
		display: block;
	}

	.radio-desc {
		font-size: 0.8rem;
		color: var(--color-gray-500);
		display: block;
		margin-top: 0.25rem;
	}

	/* Step 2: Eingabe */
	.input-step {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.transkription-input {
		width: 100%;
		min-height: 300px;
		padding: 1rem;
		border: 1px solid var(--color-gray-300);
		font-size: 0.9rem;
		font-family: inherit;
		resize: vertical;
	}

	.transkription-input:focus {
		outline: none;
		border-color: var(--color-brand-medium);
	}

	.info-text {
		font-size: 0.85rem;
		color: var(--color-gray-500);
		margin: 0;
	}

	.error-message {
		padding: 0.75rem 1rem;
		background: var(--color-error-light);
		color: var(--color-error-dark);
		font-size: 0.875rem;
	}

	.input-actions {
		display: flex;
		justify-content: flex-end;
	}

	/* Progress Bar */
	.progress-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem;
		background: var(--color-gray-50);
		border: 1px solid var(--color-gray-200);
	}

	.progress-bar {
		width: 100%;
		height: 6px;
		background: var(--color-gray-200);
		overflow: hidden;
	}

	.progress-bar-indeterminate {
		width: 30%;
		height: 100%;
		background: var(--color-brand-medium);
		animation: indeterminate 1.5s ease-in-out infinite;
	}

	@keyframes indeterminate {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(400%);
		}
	}

	.progress-text {
		font-size: 0.85rem;
		color: var(--color-gray-600);
		font-weight: 500;
	}

	/* Step 3: Position Check - Erweitert */
	.position-check-list {
		display: flex;
		flex-direction: column;
	}

	.check-row-expanded {
		padding: 1.25rem;
		border-bottom: 2px solid var(--color-gray-200);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.check-row-expanded:hover {
		background: var(--color-gray-25, #fcfcfc);
	}

	.check-row-expanded.has-fallback {
		background: var(--color-warning-light);
	}

	.check-row-expanded.no-match {
		background: var(--color-error-light);
	}

	.check-row-expanded label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-gray-500);
		text-transform: uppercase;
		letter-spacing: 0.025em;
		margin-bottom: 0.5rem;
		display: block;
	}

	.row-header {
		display: flex;
		gap: 1.5rem;
	}

	.col-original {
		display: flex;
		flex-direction: column;
		flex: 1;
	}

	.original-text {
		margin: 0 0 0.5rem;
		font-size: 0.95rem;
		color: var(--color-gray-800);
		font-weight: 500;
	}

	.meta {
		font-size: 0.75rem;
		color: var(--color-gray-500);
	}

	/* Ausgewählte Positionen (Mehrfachauswahl) */
	.selected-positions-section {
		background: var(--color-gray-50);
		padding: 1rem;
		border: 1px solid var(--color-gray-200);
	}

	.selected-positions-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.selected-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem;
		background: white;
		border: 1px solid var(--color-success-light, #c6f6d5);
	}

	.selected-item-info {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.selected-item-info strong {
		font-size: 0.9rem;
	}

	.remove-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: 1px solid var(--color-gray-300);
		background: white;
		color: var(--color-gray-500);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.remove-btn:hover {
		background: var(--color-error-light);
		border-color: var(--color-error);
		color: var(--color-error);
	}

	.pos-nummer {
		font-size: 0.75rem;
		color: var(--color-gray-500);
		font-family: monospace;
	}

	.pos-price {
		font-weight: 600;
		color: var(--color-gray-800);
	}

	.no-match-info {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.no-match-info p {
		margin: 0;
		font-size: 0.8rem;
		color: var(--color-gray-600);
	}

	/* LV-Typ Filter + Alternativen */
	.alternatives-section {
		border: 1px solid var(--color-gray-200);
		padding: 1rem;
	}

	.alternatives-section.collapsed {
		padding: 0.5rem 1rem;
	}

	.collapse-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.5rem 0;
		border: none;
		background: transparent;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--color-gray-700);
		text-align: left;
	}

	.collapse-toggle:hover {
		color: var(--color-brand-medium);
	}

	.collapse-toggle .chevron {
		transition: transform 0.2s ease;
	}

	.collapse-toggle .chevron.rotated {
		transform: rotate(90deg);
	}

	.filter-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.filter-row label {
		margin: 0;
		white-space: nowrap;
	}

	.filter-row select {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-gray-300);
		font-size: 0.9rem;
		min-width: 150px;
	}

	.loading-indicator {
		font-size: 0.8rem;
		color: var(--color-brand-medium);
		font-style: italic;
	}

	.alternatives-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.alternatives-list > label:first-of-type {
		margin-bottom: 0.5rem;
	}

	.alternative-item {
		padding: 0.5rem;
		background: white;
		border: 1px solid var(--color-gray-200);
		transition: all 0.15s ease;
	}

	.alternative-item:hover {
		border-color: var(--color-gray-300);
		background: var(--color-gray-50);
	}

	.alternative-item.selected {
		border-color: var(--color-success);
		background: var(--color-success-light, #f0fff4);
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
	}

	.checkbox-label input[type="checkbox"] {
		width: 18px;
		height: 18px;
		cursor: pointer;
	}

	.alt-info, .result-info {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
	}

	.alt-artikelnr, .result-artikelnr {
		font-family: monospace;
		font-size: 0.8rem;
		color: var(--color-gray-500);
		min-width: 120px;
	}

	.alt-name, .result-name {
		flex: 1;
		font-size: 0.9rem;
		color: var(--color-gray-800);
	}

	.alt-price, .result-price {
		font-weight: 600;
		color: var(--color-gray-800);
		white-space: nowrap;
	}

	.no-alternatives, .no-results {
		font-size: 0.8rem;
		color: var(--color-gray-500);
		font-style: italic;
		margin: 0.5rem 0 0;
	}

	/* "+" Button für Mehrfachauswahl */
	.alt-content, .result-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		gap: 0.5rem;
	}

	.add-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		min-width: 32px;
		border: 1px solid var(--color-success);
		background: white;
		color: var(--color-success);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.add-btn:hover {
		background: var(--color-success);
		color: white;
	}

	.add-btn:active {
		transform: scale(0.95);
	}

	/* Freitextsuche */
	.search-section {
		border: 1px solid var(--color-gray-200);
		padding: 1rem;
		background: var(--color-gray-25, #fcfcfc);
	}

	.search-input-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.search-input-row input {
		flex: 1;
		padding: 0.6rem 0.75rem;
		border: 1px solid var(--color-gray-300);
		font-size: 0.9rem;
	}

	.search-input-row input:focus {
		outline: none;
		border-color: var(--color-brand-medium);
	}

	.search-results {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		max-height: 300px;
		overflow-y: auto;
	}

	.search-result-item {
		padding: 0.5rem;
		background: white;
		border: 1px solid var(--color-gray-200);
		transition: all 0.15s ease;
	}

	.search-result-item:hover {
		border-color: var(--color-gray-300);
		background: var(--color-gray-50);
	}

	.search-result-item.selected {
		border-color: var(--color-success);
		background: var(--color-success-light, #f0fff4);
	}

	/* Step 4: Groups Editor */
	.groups-editor {
		padding: 1rem;
	}

	.group-actions {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-gray-200);
	}

	/* Step 5: Dependencies */
	.empty-dependencies {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 3rem 2rem;
		color: var(--color-gray-500);
		text-align: center;
	}

	.empty-dependencies svg {
		margin-bottom: 1rem;
		color: var(--color-success);
	}

	.dependencies-list {
		display: flex;
		flex-direction: column;
	}

	.dependency-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		border-bottom: 1px solid var(--color-gray-100);
	}

	.dependency-row:hover {
		background: var(--color-gray-50);
	}

	.dependency-row.rejected {
		opacity: 0.5;
		text-decoration: line-through;
	}

	.dep-checkbox input {
		width: 18px;
		height: 18px;
		cursor: pointer;
	}

	.dep-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.dep-reason {
		font-size: 0.85rem;
		color: var(--color-gray-600);
	}

	.dep-position {
		font-weight: 500;
		color: var(--color-gray-800);
	}

	.dep-price {
		font-weight: 600;
		color: var(--color-gray-800);
		white-space: nowrap;
	}

	/* Step 6: Aufmass */
	.aufmass-wrapper {
		overflow-x: auto;
	}

	.aufmass-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	.aufmass-table th {
		padding: 0.75rem 1rem;
		text-align: left;
		font-weight: 600;
		color: var(--color-gray-600);
		background: var(--color-gray-50);
		border-bottom: 1px solid var(--color-gray-200);
	}

	.aufmass-table td {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-gray-100);
		vertical-align: middle;
	}

	.aufmass-table .text-right {
		text-align: right;
	}

	.pos-bezeichnung {
		max-width: 300px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.menge-input {
		width: 80px;
		padding: 0.4rem;
		border: 1px solid var(--color-gray-300);
		text-align: right;
	}

	.kalkulator {
		min-width: 200px;
	}

	.calc-inputs {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.calc-inputs input {
		width: 50px;
		padding: 0.3rem;
		border: 1px solid var(--color-gray-300);
		text-align: center;
	}

	.calc-btn {
		padding: 0.3rem 0.5rem;
		border: 1px solid var(--color-brand-medium);
		background: var(--color-brand-light);
		color: var(--color-brand-medium);
		font-size: 0.75rem;
		cursor: pointer;
	}

	.calc-btn:hover {
		background: var(--color-brand-medium);
		color: white;
	}

	.no-calc {
		color: var(--color-gray-400);
	}

	.gp {
		font-weight: 600;
	}

	.aufmass-table tfoot .total-row {
		background: var(--color-gray-800);
		color: white;
	}

	.aufmass-table tfoot td {
		padding: 1rem;
	}

	/* Step 7: Pricing */
	.pricing-config {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.margin-summary {
		background: var(--color-gray-50);
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.margin-row {
		display: flex;
		justify-content: space-between;
		font-size: 0.9rem;
	}

	.margin-row .value {
		font-weight: 500;
	}

	.margin-row .discount {
		color: var(--color-error);
	}

	.margin-row.highlight {
		padding-top: 0.5rem;
		border-top: 1px solid var(--color-gray-300);
		font-weight: 600;
	}

	.totals {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.total-row {
		display: flex;
		justify-content: space-between;
		font-size: 0.95rem;
	}

	.total-row.brutto {
		font-size: 1.2rem;
		font-weight: 700;
		padding-top: 0.5rem;
		border-top: 2px solid var(--color-gray-300);
	}

	hr {
		border: none;
		border-top: 1px solid var(--color-gray-200);
		margin: 0;
	}

	/* Step 8: Export */
	.export-step {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.options {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.checkbox-option {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
	}

	.checkbox-option input {
		width: 18px;
		height: 18px;
	}

	.preview-section h3 {
		margin: 0 0 0.75rem;
		font-size: 1rem;
		font-weight: 600;
	}

	.preview-frame {
		border: 1px solid var(--color-gray-300);
		padding: 1rem;
		max-height: 400px;
		overflow-y: auto;
		background: white;
	}

	.export-actions {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
	}

	/* Footer */
	.wizard-footer {
		padding: 1rem 1.5rem;
		background: white;
		border-top: 1px solid var(--color-gray-200);
		position: sticky;
		bottom: 0;
	}

	.nav-buttons {
		display: flex;
		justify-content: space-between;
	}

	/* NEU: Wohnungsgröße-Eingabe (Step 2) */
	.wohnungsgroesse-input {
		margin-bottom: 1rem;
		padding: 1rem;
		background: var(--color-info-light, #e8f4fd);
		border: 1px solid var(--color-info, #3b82f6);
	}

	.wohnungsgroesse-input label {
		display: block;
		font-weight: 500;
		margin-bottom: 0.5rem;
	}

	.wohnungsgroesse-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.wohnungsgroesse-row input {
		width: 100px;
		padding: 0.5rem;
		border: 1px solid var(--color-gray-300);
		font-size: 1rem;
	}

	.wohnungsgroesse-row .unit {
		font-weight: 500;
		color: var(--color-gray-600);
	}

	/* NEU: Header-Badges (mehrere Badges nebeneinander) */
	.header-badges {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	/* NEU: Kontext-Info-Box (Step 3) */
	.kontext-info-box {
		background: var(--color-success-light, #f0fff4);
		border: 1px solid var(--color-success, #10b981);
		padding: 1rem;
		margin: 0 1rem 1rem 1rem;
	}

	.kontext-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
		color: var(--color-success-dark, #047857);
		margin-bottom: 0.75rem;
	}

	.kontext-details {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.5rem;
	}

	.kontext-item {
		display: flex;
		gap: 0.5rem;
		font-size: 0.9rem;
	}

	.kontext-item .label {
		font-weight: 500;
		color: var(--color-gray-600);
	}

	.kontext-item .value {
		color: var(--color-gray-800);
	}

	.kontext-hint {
		margin: 0.75rem 0 0 0;
		font-size: 0.85rem;
		font-style: italic;
		color: var(--color-success-dark, #047857);
	}

	/* Mobile */
	@media (max-width: 768px) {
		.step-name {
			display: none;
		}

		.check-row {
			grid-template-columns: 1fr;
		}

		.form-row {
			grid-template-columns: 1fr;
		}

		.export-actions {
			flex-direction: column;
		}

		.kontext-details {
			grid-template-columns: 1fr;
		}

		.header-badges {
			flex-wrap: wrap;
		}
	}
</style>
