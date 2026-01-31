# Angebots-CPQ Implementation Guide

**Datum:** 2026-01-30
**Konzept:** docs/ANGEBOTS_CPQ_KONZEPT.md

---

## 1. DB-Migrationen

### Migration 1: Basis-Tabellen

```sql
-- =====================================================
-- ANGEBOTS-CPQ SYSTEM - MIGRATION 1: BASISTABELLEN
-- =====================================================

-- 1.1 Pricing Profiles
CREATE TABLE pricing_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  base_lv_typ TEXT,
  markup_percent NUMERIC(5,2) DEFAULT 0,
  per_trade_overrides JSONB DEFAULT '{}',
  target_margin NUMERIC(5,2) DEFAULT 25,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default-Profile einfügen
INSERT INTO pricing_profiles (name, base_lv_typ, markup_percent, target_margin, is_default) VALUES
  ('GWS Basis', 'GWS', 0, 25, TRUE),
  ('VBW Basis', 'VBW', 0, 22, FALSE),
  ('Covivio Basis', 'covivio', 0, 20, FALSE),
  ('neurealis Privat', 'neurealis', 0, 30, FALSE),
  ('Privataufschlag 15%', 'GWS', 15, 30, FALSE),
  ('Privataufschlag 20%', 'GWS', 20, 35, FALSE);

-- 1.2 Kunde Pricing (kundenspezifisch)
CREATE TABLE kunde_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kunde_id UUID REFERENCES kontakte(id),
  default_profile_id UUID REFERENCES pricing_profiles(id),
  custom_markup_percent NUMERIC(5,2),
  custom_trade_overrides JSONB,
  target_margin NUMERIC(5,2),
  custom_rules JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(kunde_id)
);

-- 1.3 Position Dependencies (Abhängigkeiten)
CREATE TABLE position_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_lv_position_id UUID REFERENCES lv_positionen(id),
  source_artikelnummer TEXT,
  target_lv_position_id UUID REFERENCES lv_positionen(id),
  target_artikelnummer TEXT,
  lv_typ TEXT,
  kunde_id UUID REFERENCES kontakte(id),
  dependency_type TEXT NOT NULL CHECK (dependency_type IN ('required', 'suggested', 'referenced_in_text', 'often_together')),
  condition JSONB,
  default_qty_factor NUMERIC(5,3),
  source TEXT NOT NULL CHECK (source IN ('admin_rule', 'text_analysis', 'customer_rule', 'learned')),
  confidence NUMERIC(3,2) DEFAULT 1.0,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dependencies_source_art ON position_dependencies(source_artikelnummer);
CREATE INDEX idx_dependencies_lv_typ ON position_dependencies(lv_typ);
CREATE INDEX idx_dependencies_active ON position_dependencies(is_active) WHERE is_active = TRUE;

-- 1.4 Angebote (Haupttabelle)
CREATE TABLE angebote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  angebot_nr TEXT UNIQUE NOT NULL,
  atbs_nummer TEXT NOT NULL,
  projekt_id TEXT,
  kunde_id UUID REFERENCES kontakte(id),
  struktur TEXT DEFAULT 'gewerk' CHECK (struktur IN ('gewerk', 'raum')),
  lv_typ TEXT NOT NULL,
  positionen JSONB NOT NULL DEFAULT '[]',
  zuschlaege JSONB DEFAULT '[]',
  aufmass_id UUID,
  summe_netto NUMERIC(12,2),
  summe_zuschlaege NUMERIC(12,2),
  summe_mwst NUMERIC(12,2),
  summe_brutto NUMERIC(12,2),
  durchschnitt_marge NUMERIC(5,2),
  pricing_profile_id UUID REFERENCES pricing_profiles(id),
  kundenspezifische_aufschlaege JSONB,
  status TEXT DEFAULT 'entwurf' CHECK (status IN ('entwurf', 'freigabe_angefordert', 'freigegeben', 'gesendet', 'angenommen', 'abgelehnt', 'storniert')),
  freigegeben_von UUID,
  freigegeben_am TIMESTAMPTZ,
  pdf_path TEXT,
  json_snapshot JSONB,
  email_text TEXT,
  gueltig_bis DATE,
  erstellt_von UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_angebote_atbs ON angebote(atbs_nummer);
CREATE INDEX idx_angebote_kunde ON angebote(kunde_id);
CREATE INDEX idx_angebote_status ON angebote(status);

-- 1.5 Angebots-Positionen (Detail)
CREATE TABLE angebots_positionen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  angebot_id UUID REFERENCES angebote(id) ON DELETE CASCADE,
  position_nr INTEGER NOT NULL,
  lv_position_id UUID REFERENCES lv_positionen(id),
  artikelnummer TEXT,
  bezeichnung TEXT NOT NULL,
  beschreibung TEXT,
  gewerk TEXT,
  menge NUMERIC(12,3),
  einheit TEXT,
  mengen_quelle JSONB,
  einzelpreis_ek NUMERIC(12,2),
  einzelpreis_vk NUMERIC(12,2),
  gesamtpreis NUMERIC(12,2),
  marge_prozent NUMERIC(5,2),
  ist_favorit BOOLEAN DEFAULT FALSE,
  ist_optional BOOLEAN DEFAULT FALSE,
  ist_abhaengigkeit BOOLEAN DEFAULT FALSE,
  abhaengig_von UUID REFERENCES angebots_positionen(id),
  sortierung INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ang_pos_angebot ON angebots_positionen(angebot_id);
CREATE INDEX idx_ang_pos_gewerk ON angebots_positionen(gewerk);

-- 1.6 Dokumenten-Nummern (Sequenzen)
CREATE TABLE dokument_sequenzen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atbs_nummer TEXT NOT NULL,
  dokument_typ TEXT NOT NULL CHECK (dokument_typ IN ('ANG', 'AB', 'NUA', 'RE')),
  letzte_nummer INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(atbs_nummer, dokument_typ)
);

-- Funktion: Nächste Dokumentnummer holen
CREATE OR REPLACE FUNCTION get_next_dokument_nr(p_atbs TEXT, p_typ TEXT)
RETURNS TEXT AS $$
DECLARE
  v_next INTEGER;
BEGIN
  INSERT INTO dokument_sequenzen (atbs_nummer, dokument_typ, letzte_nummer)
  VALUES (p_atbs, p_typ, 1)
  ON CONFLICT (atbs_nummer, dokument_typ)
  DO UPDATE SET letzte_nummer = dokument_sequenzen.letzte_nummer + 1, updated_at = NOW()
  RETURNING letzte_nummer INTO v_next;

  RETURN p_atbs || '-' || p_typ || LPAD(v_next::TEXT, 2, '0');
END;
$$ LANGUAGE plpgsql;

-- Beispiel: SELECT get_next_dokument_nr('ATBS-472', 'ANG'); → 'ATBS-472-ANG01'

-- 1.7 Favoriten für LV-Positionen
ALTER TABLE lv_positionen ADD COLUMN IF NOT EXISTS ist_favorit BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_lv_favoriten ON lv_positionen(ist_favorit) WHERE ist_favorit = TRUE;

-- 1.8 RLS Policies
ALTER TABLE angebote ENABLE ROW LEVEL SECURITY;
ALTER TABLE angebots_positionen ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kunde_pricing ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all
CREATE POLICY "Authenticated read angebote" ON angebote FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read ang_pos" ON angebots_positionen FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read dependencies" ON position_dependencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read profiles" ON pricing_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read kunde_pricing" ON kunde_pricing FOR SELECT TO authenticated USING (true);

-- Authenticated users can insert/update
CREATE POLICY "Authenticated insert angebote" ON angebote FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update angebote" ON angebote FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated insert ang_pos" ON angebots_positionen FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update ang_pos" ON angebots_positionen FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated manage dependencies" ON position_dependencies FOR ALL TO authenticated USING (true);
```

---

## 2. Aufmaß-Erweiterung

Die bestehende `aufmass_data` Tabelle nutzt JSONB für Räume. Wir erweitern das Schema:

```sql
-- Aufmaß-Daten Struktur erweitern
-- Die rooms JSONB soll folgende Struktur haben:

/*
{
  "rooms": [
    {
      "name": "Wohnzimmer",
      "etage": "EG",
      "geometrie": "rechteck",    -- rechteck, l_form, u_form
      "hoehe_m": 2.7,

      -- Bei Rechteck:
      "laenge_m": 5.5,
      "breite_m": 4.2,

      -- Bei L-Form / U-Form: Teilflächen
      "teilflaechen": [
        { "name": "A", "laenge_m": 4.5, "breite_m": 3.0, "flaeche_m2": 13.5 },
        { "name": "B", "laenge_m": 3.0, "breite_m": 2.0, "flaeche_m2": 6.0 }
      ],

      -- Gemeinsame Wände (Innenwände zwischen Teilflächen)
      "gemeinsame_waende": [
        { "von": "A", "zu": "B", "laenge_m": 3.0 }
      ],

      -- Berechnete Werte
      "netto_m2": 23.1,           -- Grundfläche netto
      "brutto_m2": 25.0,          -- Grundfläche brutto (inkl. Verkehr)
      "wandflaeche_m2": 48.9,     -- Berechnet: Außenumfang × H - Abzüge
      "deckenflaeche_m2": 23.1,   -- = netto_m2 (bei Standarddecke)
      "umfang_lfm": 19.4,         -- Außenumfang

      -- Abzüge von Wandfläche
      "abzuege": {
        "tueren": { "anzahl": 1, "flaeche_m2": 2.0 },
        "fenster": { "anzahl": 1, "flaeche_m2": 1.5 },
        "gesamt_m2": 3.5
      },

      "ist_nassraum": false,
      "bemerkungen": ""
    }
  ],
  "gesamt": {
    "netto_m2": 65.4,
    "brutto_m2": 72.0,
    "wandflaeche_m2": 185.0,
    "deckenflaeche_m2": 65.4,
    "anzahl_raeume": 7,
    "anzahl_tueren": 8,
    "anzahl_fenster": 5
  }
}
*/

-- TypeScript Interface
/*
interface Raum {
  name: string;
  etage?: string;
  geometrie: 'rechteck' | 'l_form' | 'u_form';
  hoehe_m: number;

  // Rechteck
  laenge_m?: number;
  breite_m?: number;

  // L-Form / U-Form
  teilflaechen?: Teilflaeche[];
  gemeinsame_waende?: GemeinsameWand[];

  // Berechnete Werte
  netto_m2: number;
  brutto_m2?: number;
  wandflaeche_m2: number;
  deckenflaeche_m2: number;
  umfang_lfm: number;

  // Abzüge
  abzuege?: {
    tueren?: { anzahl: number; flaeche_m2: number };
    fenster?: { anzahl: number; flaeche_m2: number };
    gesamt_m2: number;
  };

  ist_nassraum?: boolean;
  bemerkungen?: string;
}

interface Teilflaeche {
  name: string;          // "A", "B", "C"
  laenge_m: number;
  breite_m: number;
  flaeche_m2: number;    // berechnet
}

interface GemeinsameWand {
  von: string;           // "A"
  zu: string;            // "B"
  laenge_m: number;
}
*/

-- View für einfachen Zugriff
CREATE OR REPLACE VIEW aufmass_raeume AS
SELECT
  ad.atbs_nummer,
  r->>'name' AS raum_name,
  r->>'etage' AS etage,
  r->>'geometrie' AS geometrie,
  (r->>'netto_m2')::NUMERIC AS netto_m2,
  (r->>'wandflaeche_m2')::NUMERIC AS wandflaeche_m2,
  (r->>'deckenflaeche_m2')::NUMERIC AS deckenflaeche_m2,
  (r->>'umfang_lfm')::NUMERIC AS umfang_lfm,
  (r->>'ist_nassraum')::BOOLEAN AS ist_nassraum,
  (r->'oeffnungen'->>'tueren')::INTEGER AS tueren,
  (r->'oeffnungen'->>'fenster')::INTEGER AS fenster
FROM aufmass_data ad,
     jsonb_array_elements(ad.rooms->'rooms') AS r;
```

---

## 3. Beispiel-Abhängigkeiten (Seed Data)

```sql
-- =====================================================
-- MALER-ABHÄNGIGKEITEN (GWS-LV)
-- =====================================================

-- Raufaser tapezieren → Untergrund vorbereiten
INSERT INTO position_dependencies
  (source_artikelnummer, target_artikelnummer, lv_typ, dependency_type, source, is_active)
VALUES
  ('GWS.LV23-05.01.1', 'GWS.LV23-05.00.1', 'GWS', 'required', 'admin_rule', true);

-- Raufaser tapezieren → Q2 Ausbesserung (25%)
INSERT INTO position_dependencies
  (source_artikelnummer, target_artikelnummer, lv_typ, dependency_type, default_qty_factor, source, is_active)
VALUES
  ('GWS.LV23-05.01.1', 'GWS.LV23-05.00.2', 'GWS', 'suggested', 0.25, 'admin_rule', true);

-- Raufaser tapezieren → Streichen 2x
INSERT INTO position_dependencies
  (source_artikelnummer, target_artikelnummer, lv_typ, dependency_type, source, is_active)
VALUES
  ('GWS.LV23-05.01.1', 'GWS.LV23-05.02.1', 'GWS', 'required', 'admin_rule', true);

-- =====================================================
-- ELEKTRIK-ABHÄNGIGKEITEN (GWS-LV)
-- =====================================================

-- Unterverteilung → Zähleranlage
INSERT INTO position_dependencies
  (source_artikelnummer, target_artikelnummer, lv_typ, dependency_type, source, is_active)
VALUES
  ('GWS.LV23-02.01.1', 'GWS.LV23-02.01.5', 'GWS', 'suggested', 'admin_rule', true);

-- Heizkörper komplett → Zulage bis 1,50m
INSERT INTO position_dependencies
  (source_artikelnummer, target_artikelnummer, lv_typ, dependency_type, condition, source, is_active)
VALUES
  ('GWS.LV23-03.02.1', 'GWS.LV23-03.02.2', 'GWS', 'suggested', '{"heizkoerper_groesse": "bis_150cm"}', 'admin_rule', true);

-- =====================================================
-- BAD-ABHÄNGIGKEITEN (GWS-LV)
-- =====================================================

-- Bad komplett → Abdichtung
INSERT INTO position_dependencies
  (source_artikelnummer, target_artikelnummer, lv_typ, dependency_type, condition, source, is_active)
VALUES
  ('GWS.LV23-04.01.1', 'GWS.LV23-04.00.1', 'GWS', 'required', '{"ist_nassraum": true}', 'admin_rule', true);

-- Bad komplett → Rohinstallation
INSERT INTO position_dependencies
  (source_artikelnummer, target_artikelnummer, lv_typ, dependency_type, source, is_active)
VALUES
  ('GWS.LV23-04.01.1', 'GWS.LV23-04.00.2', 'GWS', 'required', 'admin_rule', true);
```

---

## 4. Edge Function: transcription-parse

```typescript
// functions/supabase/functions/transcription-parse/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { text, lv_typ, atbs_nummer } = await req.json();

    if (!text || !lv_typ) {
      return new Response(
        JSON.stringify({ error: "text und lv_typ sind erforderlich" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. GPT-5.2: Positionen aus Text extrahieren
    const extractionPrompt = `Du bist ein Experte für Wohnungssanierung. Analysiere den folgenden Text und extrahiere alle genannten Bauleistungen.

Text:
${text}

Gib die Ergebnisse als JSON zurück:
{
  "positionen": [
    {
      "beschreibung": "Was genau gemacht werden soll",
      "gewerk": "Maler|Elektrik|Sanitär|Boden|Heizung|Tischler|Trockenbau|Fliesen|Sonstiges",
      "oberflaeche": "wand|decke|boden|null",
      "raum": "Raumname wenn genannt, sonst null",
      "qualitaet": "Q2|Q3|Standard|null",
      "suchbegriffe": ["keyword1", "keyword2"]
    }
  ],
  "wohnungskontext": {
    "geschaetzte_flaeche_m2": null oder Zahl,
    "anzahl_raeume": null oder Zahl,
    "besonderheiten": []
  }
}`;

    const gptResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: "Du extrahierst Bauleistungen aus Texten. Antworte nur mit validem JSON." },
          { role: "user", content: extractionPrompt }
        ],
        max_completion_tokens: 2000,
        response_format: { type: "json_object" }
      }),
    });

    const gptData = await gptResponse.json();
    const extracted = JSON.parse(gptData.choices[0].message.content);

    // 2. Für jede Position: LV-Position suchen + Abhängigkeiten laden
    const gewerkeMap = new Map();

    for (const pos of extracted.positionen) {
      // Embedding für Suche erstellen
      const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: `${pos.beschreibung} ${pos.suchbegriffe?.join(" ") || ""}`
        }),
      });

      const embeddingData = await embeddingResponse.json();
      const embedding = embeddingData.data[0].embedding;

      // Semantische Suche in lv_positionen
      const { data: lvMatches } = await supabase.rpc("search_lv_positions", {
        query_embedding: embedding,
        match_count: 3,
        filter_lv_typ: lv_typ,
        filter_gewerk: pos.gewerk !== "Sonstiges" ? pos.gewerk : null
      });

      if (lvMatches && lvMatches.length > 0) {
        const bestMatch = lvMatches[0];

        // Abhängigkeiten laden
        const { data: dependencies } = await supabase
          .from("position_dependencies")
          .select(`
            target_artikelnummer,
            dependency_type,
            default_qty_factor,
            condition
          `)
          .eq("source_artikelnummer", bestMatch.artikelnummer)
          .eq("is_active", true)
          .or(`lv_typ.eq.${lv_typ},lv_typ.is.null`);

        // Abhängige Positionen laden
        const abhaengigkeiten = [];
        if (dependencies) {
          for (const dep of dependencies) {
            const { data: depPos } = await supabase
              .from("lv_positionen")
              .select("id, artikelnummer, bezeichnung, listenpreis, einheit")
              .eq("artikelnummer", dep.target_artikelnummer)
              .single();

            if (depPos) {
              abhaengigkeiten.push({
                ...depPos,
                dependency_type: dep.dependency_type,
                faktor: dep.default_qty_factor
              });
            }
          }
        }

        // In Gewerk-Map einsortieren
        const gewerk = pos.gewerk || bestMatch.gewerk || "Sonstiges";
        if (!gewerkeMap.has(gewerk)) {
          gewerkeMap.set(gewerk, []);
        }

        gewerkeMap.get(gewerk).push({
          beschreibung_original: pos.beschreibung,
          oberflaeche: pos.oberflaeche,
          raum: pos.raum,
          qualitaet: pos.qualitaet,
          lv_position: {
            id: bestMatch.id,
            artikelnummer: bestMatch.artikelnummer,
            bezeichnung: bestMatch.bezeichnung,
            listenpreis: bestMatch.listenpreis,
            einheit: bestMatch.einheit
          },
          confidence: bestMatch.similarity,
          abhaengigkeiten
        });
      }
    }

    // 3. Ergebnis formatieren
    const result = {
      gewerke: Array.from(gewerkeMap.entries()).map(([name, positionen]) => ({
        name,
        positionen
      })),
      wohnungskontext: extracted.wohnungskontext,
      original_text: text.substring(0, 500) + (text.length > 500 ? "..." : "")
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

---

## 5. Edge Function: analyze-lv-dependencies

```typescript
// functions/supabase/functions/analyze-lv-dependencies/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { lv_typ, dry_run = true } = await req.json();

    if (!lv_typ) {
      return new Response(
        JSON.stringify({ error: "lv_typ ist erforderlich" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Alle Positionen mit Langtext laden
    const { data: positionen } = await supabase
      .from("lv_positionen")
      .select("id, artikelnummer, bezeichnung, beschreibung, gewerk")
      .eq("lv_typ", lv_typ)
      .not("beschreibung", "is", null)
      .order("artikelnummer");

    if (!positionen || positionen.length === 0) {
      return new Response(
        JSON.stringify({ error: "Keine Positionen mit Langtext gefunden" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Artikelnummern-Index erstellen
    const artikelIndex = new Map();
    positionen.forEach(p => {
      artikelIndex.set(p.artikelnummer, p);
      // Auch kurze Varianten (z.B. "02.03.7" für "GWS.LV23-02.03.7")
      const shortNr = p.artikelnummer.split("-").pop();
      if (shortNr) artikelIndex.set(shortNr, p);
    });

    const erkannteAbhaengigkeiten = [];

    // 3. Batch-Verarbeitung (10 Positionen pro GPT-Call)
    const batchSize = 10;
    for (let i = 0; i < positionen.length; i += batchSize) {
      const batch = positionen.slice(i, i + batchSize);

      const analysisPrompt = `Analysiere die folgenden LV-Positionen (Leistungsverzeichnis) für Wohnungssanierung.
Finde Verweise auf andere Positionen und erkenne semantische Abhängigkeiten.

Positionen:
${batch.map(p => `
[${p.artikelnummer}] ${p.bezeichnung}
Langtext: ${p.beschreibung?.substring(0, 500) || "Kein Langtext"}
`).join("\n---\n")}

Suche nach:
1. Explizite Verweise: "siehe Pos.", "gem. Pos.", "wie Pos.", "inkl. Pos."
2. Zulagen: Positionen die "Zulage" heißen gehören zur Basis-Position davor
3. Semantische Abhängigkeiten: Wenn Raufaser, dann Untergrund + Streichen

Gib als JSON zurück:
{
  "abhaengigkeiten": [
    {
      "source_artikelnummer": "...",
      "target_artikelnummer": "...",
      "typ": "referenced_in_text|zulage|semantisch",
      "begruendung": "kurze Erklärung"
    }
  ]
}`;

      const gptResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5.2",
          messages: [
            { role: "system", content: "Du analysierst Leistungsverzeichnisse für Bauprojekte. Antworte nur mit validem JSON." },
            { role: "user", content: analysisPrompt }
          ],
          max_completion_tokens: 2000,
          response_format: { type: "json_object" }
        }),
      });

      const gptData = await gptResponse.json();
      const parsed = JSON.parse(gptData.choices[0].message.content);

      if (parsed.abhaengigkeiten) {
        for (const dep of parsed.abhaengigkeiten) {
          // Validieren dass beide Positionen existieren
          const sourcePos = artikelIndex.get(dep.source_artikelnummer);
          const targetPos = artikelIndex.get(dep.target_artikelnummer);

          if (sourcePos && targetPos) {
            erkannteAbhaengigkeiten.push({
              source_lv_position_id: sourcePos.id,
              source_artikelnummer: sourcePos.artikelnummer,
              target_lv_position_id: targetPos.id,
              target_artikelnummer: targetPos.artikelnummer,
              lv_typ,
              dependency_type: dep.typ === "zulage" ? "suggested" : "referenced_in_text",
              source: "text_analysis",
              confidence: 0.8,
              begruendung: dep.begruendung
            });
          }
        }
      }
    }

    // 4. Speichern (wenn nicht dry_run)
    if (!dry_run && erkannteAbhaengigkeiten.length > 0) {
      const { error } = await supabase
        .from("position_dependencies")
        .upsert(
          erkannteAbhaengigkeiten.map(d => ({
            source_lv_position_id: d.source_lv_position_id,
            source_artikelnummer: d.source_artikelnummer,
            target_lv_position_id: d.target_lv_position_id,
            target_artikelnummer: d.target_artikelnummer,
            lv_typ: d.lv_typ,
            dependency_type: d.dependency_type,
            source: d.source,
            confidence: d.confidence,
            is_active: true
          })),
          { onConflict: "source_artikelnummer,target_artikelnummer,lv_typ" }
        );

      if (error) throw error;
    }

    return new Response(JSON.stringify({
      lv_typ,
      positionen_analysiert: positionen.length,
      abhaengigkeiten_erkannt: erkannteAbhaengigkeiten.length,
      dry_run,
      abhaengigkeiten: erkannteAbhaengigkeiten
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

---

## 6. SvelteKit Route Struktur

```
ui/src/routes/angebote/
├── +page.svelte              # Liste aller Angebote
├── +page.server.ts           # Load: Angebote aus DB
├── neu/
│   ├── +page.svelte          # Wizard: Neues Angebot
│   └── +page.server.ts       # Actions: Speichern, etc.
├── [id]/
│   ├── +page.svelte          # Angebot Detail/Bearbeiten
│   └── +page.server.ts       # Load & Actions
├── regeln/
│   ├── +page.svelte          # Abhängigkeiten verwalten
│   └── +page.server.ts       # CRUD für Dependencies
└── components/
    ├── PositionSearch.svelte     # Katalogsuche mit KI
    ├── PositionList.svelte       # Positionen mit Abhängigkeiten
    ├── MengenZuweisung.svelte    # Aufmaß-basierte Mengen
    ├── KalkulationTable.svelte   # EK/VK/Marge Übersicht
    ├── FreigabeDialog.svelte     # 4-Augen Modal
    ├── PdfPreview.svelte         # PDF-Vorschau
    ├── AufmassImport.svelte      # CSV-Import Dialog (NEU)
    └── AufmassManual.svelte      # Manuelles Aufmaß (NEU)
```

---

## 6.1 CSV-Import Komponente (AufmassImport.svelte)

**Funktionalität:**
- Drag & Drop oder Datei-Auswahl für Matterport CSV
- Sofortige Vorschau der erkannten Räume
- Wandflächen automatisch berechnen (Umfang × Höhe)
- Speichern in `aufmass_data` Tabelle

**CSV-Parsing (Client-seitig):**
```typescript
// Matterport CSV Format
// Room Name,Net Area (m²),Gross Area (m²),Ceiling Height (cm)

function parseAufmassCSV(csvText: string) {
  const lines = csvText.split('\n');
  const rooms = [];

  for (let i = 1; i < lines.length; i++) { // Skip header
    const [name, netto, brutto, hoehe] = lines[i].split(',');
    if (!name?.trim()) continue;

    const nettoM2 = parseFloat(netto) || 0;
    const bruttoM2 = parseFloat(brutto) || 0;
    const hoeheM = (parseFloat(hoehe) || 270) / 100; // cm → m

    // Umfang schätzen aus Fläche (Quadrat-Approximation)
    const umfang = Math.sqrt(nettoM2) * 4;
    const wandflaeche = umfang * hoeheM;

    rooms.push({
      name: name.trim(),
      netto_m2: nettoM2,
      brutto_m2: bruttoM2,
      hoehe_m: hoeheM,
      umfang_lfm: Math.round(umfang * 10) / 10,
      wandflaeche_m2: Math.round(wandflaeche * 10) / 10,
      deckenflaeche_m2: nettoM2
    });
  }

  return {
    rooms,
    gesamt: {
      netto_m2: rooms.reduce((sum, r) => sum + r.netto_m2, 0),
      brutto_m2: rooms.reduce((sum, r) => sum + r.brutto_m2, 0),
      wandflaeche_m2: rooms.reduce((sum, r) => sum + r.wandflaeche_m2, 0)
    }
  };
}
```

**Speichern:**
```typescript
async function saveAufmass(atbsNummer: string, data: AufmassData) {
  const { error } = await supabase
    .from('aufmass_data')
    .upsert({
      atbs_nummer: atbsNummer,
      total_netto_m2: data.gesamt.netto_m2,
      total_brutto_m2: data.gesamt.brutto_m2,
      rooms: { rooms: data.rooms, gesamt: data.gesamt }
    }, { onConflict: 'atbs_nummer' });

  return !error;
}
```

---

## 6.2 Raumgeometrie-Berechnung

**Berechnungsfunktionen für Raumtypen:**

```typescript
interface Raum {
  geometrie: 'rechteck' | 'l_form' | 'u_form';
  hoehe_m: number;
  laenge_m?: number;
  breite_m?: number;
  teilflaechen?: { name: string; laenge_m: number; breite_m: number }[];
  gemeinsame_waende?: { von: string; zu: string; laenge_m: number }[];
  abzuege?: { tueren?: { anzahl: number; flaeche_m2: number }; fenster?: { anzahl: number; flaeche_m2: number } };
}

function berechneRaum(raum: Raum): {
  netto_m2: number;
  wandflaeche_m2: number;
  umfang_lfm: number;
  deckenflaeche_m2: number;
} {
  const h = raum.hoehe_m;

  if (raum.geometrie === 'rechteck') {
    const l = raum.laenge_m || 0;
    const b = raum.breite_m || 0;
    const netto = l * b;
    const umfang = (l + b) * 2;
    const wandBrutto = umfang * h;

    // Abzüge
    const abzug = (raum.abzuege?.tueren?.flaeche_m2 || 0) +
                  (raum.abzuege?.fenster?.flaeche_m2 || 0);

    return {
      netto_m2: round2(netto),
      wandflaeche_m2: round2(wandBrutto - abzug),
      umfang_lfm: round2(umfang),
      deckenflaeche_m2: round2(netto)
    };
  }

  if (raum.geometrie === 'l_form' || raum.geometrie === 'u_form') {
    // Teilflächen summieren
    const teilflaechen = raum.teilflaechen || [];
    const netto = teilflaechen.reduce((sum, t) => sum + t.laenge_m * t.breite_m, 0);

    // Außenumfang berechnen (vereinfacht: Summe aller Teilflächen-Umfänge minus gemeinsame Wände)
    let umfangBrutto = teilflaechen.reduce((sum, t) =>
      sum + (t.laenge_m + t.breite_m) * 2, 0);

    // Gemeinsame Wände abziehen (jede wird 2× im Brutto-Umfang gezählt)
    const gemeinsam = raum.gemeinsame_waende || [];
    const gemeinsamSumme = gemeinsam.reduce((sum, w) => sum + w.laenge_m, 0);
    const umfang = umfangBrutto - (gemeinsamSumme * 2);

    const wandBrutto = umfang * h;

    // Abzüge
    const abzug = (raum.abzuege?.tueren?.flaeche_m2 || 0) +
                  (raum.abzuege?.fenster?.flaeche_m2 || 0);

    return {
      netto_m2: round2(netto),
      wandflaeche_m2: round2(wandBrutto - abzug),
      umfang_lfm: round2(umfang),
      deckenflaeche_m2: round2(netto)
    };
  }

  return { netto_m2: 0, wandflaeche_m2: 0, umfang_lfm: 0, deckenflaeche_m2: 0 };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
```

**Beispiel L-Form:**
```typescript
const wohnzimmer: Raum = {
  geometrie: 'l_form',
  hoehe_m: 2.7,
  teilflaechen: [
    { name: 'A', laenge_m: 4.5, breite_m: 3.0 },  // 13,5 m²
    { name: 'B', laenge_m: 3.0, breite_m: 2.0 }   //  6,0 m²
  ],
  gemeinsame_waende: [
    { von: 'A', zu: 'B', laenge_m: 3.0 }
  ],
  abzuege: {
    tueren: { anzahl: 1, flaeche_m2: 2.0 },
    fenster: { anzahl: 1, flaeche_m2: 1.5 }
  }
};

const result = berechneRaum(wohnzimmer);
// → netto_m2: 19.5
// → umfang_lfm: 19.0  (Teil A: 15 + Teil B: 10 - gemeinsam: 6)
// → wandflaeche_m2: 47.8  (19.0 × 2.7 - 3.5)
// → deckenflaeche_m2: 19.5
```

---

## 7. Sidebar-Erweiterung

```svelte
<!-- In ui/src/lib/components/Sidebar.svelte -->

<!-- Unter "Einkauf" einfügen: -->
<SidebarItem
  href="/angebote"
  icon="📋"
  label="Angebote"
  badge={offeneAngebote}
>
  <SidebarSubItem href="/angebote/neu" label="Neues Angebot" />
  <SidebarSubItem href="/angebote" label="Übersicht" />
  <SidebarSubItem href="/angebote/regeln" label="Regeln" />
</SidebarItem>
```

---

## 8. Nächste Schritte

1. **Migration ausführen** → DB-Tabellen erstellen
2. **Edge Functions deployen** → transcription-parse, analyze-lv-dependencies
3. **LV-Analyse starten** → GWS-LV Abhängigkeiten erkennen
4. **Wizard UI bauen** → Schritt für Schritt
5. **PDF-Template anpassen** → Von LV-Export übernehmen

---

*Erstellt: 2026-01-30*
