#!/usr/bin/env python3
"""
LV-Abhaengigkeiten PDF Generator
Erstellt ein professionelles PDF-Dokument mit allen LV-Abhaengigkeiten
gruppiert nach LV-Typ und Gewerk.

Verwendung: python scripts/generate_lv_dependencies_pdf.py
"""

import json
import os
from datetime import datetime
from collections import defaultdict
from fpdf import FPDF


class LVDependencyPDF(FPDF):
    """PDF-Klasse fuer LV-Abhaengigkeiten mit professionellem Layout."""

    def __init__(self):
        super().__init__(orientation='L', unit='mm', format='A4')
        # Schriftarten laden (Arial fuer deutsche Umlaute)
        self.add_font('Arial', '', r'C:\Windows\Fonts\arial.ttf', uni=True)
        self.add_font('Arial', 'B', r'C:\Windows\Fonts\arialbd.ttf', uni=True)
        self.set_auto_page_break(auto=True, margin=20)

        # Farben
        self.COLOR_PRIMARY = (41, 65, 94)       # Dunkelblau
        self.COLOR_SECONDARY = (70, 130, 180)    # Stahlblau
        self.COLOR_HEADER_BG = (41, 65, 94)      # Dunkelblau
        self.COLOR_HEADER_TEXT = (255, 255, 255)  # Weiss
        self.COLOR_ROW_ALT = (240, 245, 250)     # Hellblau
        self.COLOR_GEWERK_BG = (220, 230, 240)   # Mittleres Blau
        self.COLOR_TEXT = (33, 33, 33)            # Fast-Schwarz
        self.COLOR_GRAY = (120, 120, 120)         # Grau

        # Abhaengigkeits-Typ Farben
        self.TYPE_COLORS = {
            'required': (220, 53, 69),       # Rot
            'often_together': (40, 167, 69),  # Gruen
            'referenced_in_text': (0, 123, 255),  # Blau
            'suggested': (255, 193, 7),       # Gelb/Orange
        }

        # LV-Typ Labels
        self.LV_LABELS = {
            'GWS': 'GWS (Auftraggeber)',
            'neurealis': 'neurealis (eigene Positionen)',
            'VBW': 'VBW (Verband Baden-Wuertt. Wohnungsunternehmen)',
        }

        # Abhaengigkeits-Typ Labels
        self.TYPE_LABELS = {
            'required': 'Erforderlich',
            'often_together': 'Oft zusammen',
            'referenced_in_text': 'Im Text referenziert',
            'suggested': 'Vorgeschlagen',
        }

    def header(self):
        """Kopfzeile mit Logo-Bereich und Titel."""
        # Hintergrundbalken
        self.set_fill_color(*self.COLOR_PRIMARY)
        self.rect(0, 0, self.w, 15, 'F')

        # Firmenname
        self.set_font('Arial', 'B', 10)
        self.set_text_color(*self.COLOR_HEADER_TEXT)
        self.set_xy(10, 3)
        self.cell(80, 9, 'neurealis GmbH', 0, 0, 'L')

        # Dokumenttitel rechts
        self.set_font('Arial', '', 8)
        self.set_xy(self.w - 110, 3)
        self.cell(100, 9, 'LV-Abh\u00e4ngigkeiten nach LV-Typ', 0, 0, 'R')

        self.ln(18)

    def footer(self):
        """Fusszeile mit Seitennummer und Datum."""
        self.set_y(-15)
        self.set_font('Arial', '', 7)
        self.set_text_color(*self.COLOR_GRAY)
        self.cell(0, 10,
                  f'Seite {self.page_no()}/{{nb}}  |  '
                  f'Erstellt: {datetime.now().strftime("%d.%m.%Y %H:%M")}  |  '
                  f'neurealis ERP', 0, 0, 'C')

    def add_title_page(self, stats):
        """Titelseite mit Zusammenfassung."""
        self.add_page()
        self.ln(30)

        # Haupttitel
        self.set_font('Arial', 'B', 28)
        self.set_text_color(*self.COLOR_PRIMARY)
        self.cell(0, 15, 'LV-Abh\u00e4ngigkeiten', 0, 1, 'C')

        self.set_font('Arial', '', 16)
        self.set_text_color(*self.COLOR_SECONDARY)
        self.cell(0, 10, 'nach Leistungsverzeichnis-Typ', 0, 1, 'C')

        self.ln(5)

        # Trennlinie
        self.set_draw_color(*self.COLOR_SECONDARY)
        self.set_line_width(0.5)
        self.line(60, self.get_y(), self.w - 60, self.get_y())
        self.ln(10)

        # Datum
        self.set_font('Arial', '', 12)
        self.set_text_color(*self.COLOR_TEXT)
        self.cell(0, 8, f'Stand: {datetime.now().strftime("%d.%m.%Y")}', 0, 1, 'C')
        self.ln(15)

        # Statistik-Box
        box_x = 60
        box_w = self.w - 120
        box_y = self.get_y()

        self.set_fill_color(*self.COLOR_ROW_ALT)
        self.set_draw_color(*self.COLOR_SECONDARY)
        self.rect(box_x, box_y, box_w, 60, 'DF')

        self.set_xy(box_x + 10, box_y + 5)
        self.set_font('Arial', 'B', 12)
        self.set_text_color(*self.COLOR_PRIMARY)
        self.cell(box_w - 20, 8, '\u00dcbersicht', 0, 1, 'L')

        self.set_font('Arial', '', 10)
        self.set_text_color(*self.COLOR_TEXT)

        y = box_y + 16
        for lv_typ, count in sorted(stats['by_type'].items()):
            label = self.LV_LABELS.get(lv_typ, lv_typ)
            self.set_xy(box_x + 15, y)
            self.cell(box_w - 60, 7, label, 0, 0, 'L')
            self.set_font('Arial', 'B', 10)
            self.cell(30, 7, f'{count} Abh\u00e4ngigkeiten', 0, 1, 'R')
            self.set_font('Arial', '', 10)
            y += 8

        self.set_xy(box_x + 15, y + 2)
        self.set_draw_color(*self.COLOR_SECONDARY)
        self.line(box_x + 15, y + 1, box_x + box_w - 15, y + 1)
        self.set_font('Arial', 'B', 11)
        self.cell(box_w - 60, 7, 'Gesamt', 0, 0, 'L')
        self.cell(30, 7, f'{stats["total"]} Abh\u00e4ngigkeiten', 0, 1, 'R')

        self.ln(20)

        # Legende
        self.set_xy(box_x, self.get_y())
        self.set_font('Arial', 'B', 11)
        self.set_text_color(*self.COLOR_PRIMARY)
        self.cell(0, 8, 'Legende - Abh\u00e4ngigkeitstypen:', 0, 1, 'L')
        self.ln(3)

        for dep_type, label in self.TYPE_LABELS.items():
            color = self.TYPE_COLORS.get(dep_type, (100, 100, 100))
            self.set_xy(box_x + 5, self.get_y())
            # Farbiger Punkt
            self.set_fill_color(*color)
            self.ellipse(box_x + 5, self.get_y() + 1.5, 4, 4, 'F')
            self.set_xy(box_x + 12, self.get_y())
            self.set_font('Arial', 'B', 9)
            self.set_text_color(*color)
            self.cell(40, 7, label, 0, 0, 'L')
            self.set_font('Arial', '', 9)
            self.set_text_color(*self.COLOR_TEXT)
            descriptions = {
                'required': 'Position A erfordert zwingend Position B',
                'often_together': 'Positionen werden h\u00e4ufig gemeinsam beauftragt',
                'referenced_in_text': 'Position A verweist im Langtext auf Position B',
                'suggested': 'Position B wird als Erg\u00e4nzung vorgeschlagen',
            }
            self.cell(0, 7, f'  \u2013  {descriptions.get(dep_type, "")}', 0, 1, 'L')

    def add_lv_section(self, lv_typ, dependencies):
        """Sektion fuer einen LV-Typ mit allen Abhaengigkeiten."""
        self.add_page()

        # Sektions-Ueberschrift
        self.set_fill_color(*self.COLOR_PRIMARY)
        self.set_text_color(*self.COLOR_HEADER_TEXT)
        self.set_font('Arial', 'B', 16)
        self.cell(0, 12, f'  {self.LV_LABELS.get(lv_typ, lv_typ)}', 1, 1, 'L', True)
        self.ln(3)

        # Statistik fuer diesen LV-Typ
        type_counts = defaultdict(int)
        for dep in dependencies:
            type_counts[dep['dependency_type']] += 1

        self.set_font('Arial', '', 9)
        self.set_text_color(*self.COLOR_GRAY)
        stats_parts = []
        for dt, label in self.TYPE_LABELS.items():
            if dt in type_counts:
                stats_parts.append(f'{label}: {type_counts[dt]}')
        self.cell(0, 6, f'{len(dependencies)} Abh\u00e4ngigkeiten  |  ' + '  |  '.join(stats_parts), 0, 1, 'L')
        self.ln(3)

        # Nach Gewerk gruppieren
        by_gewerk = defaultdict(list)
        for dep in dependencies:
            gewerk = dep.get('source_gewerk') or 'Ohne Gewerk-Zuordnung'
            by_gewerk[gewerk].append(dep)

        # Spaltenbreiten (Querformat A4 = 297mm, abzgl. Raender)
        col_widths = {
            'source_art': 38,
            'source_bez': 60,
            'type': 24,
            'target_art': 38,
            'target_bez': 60,
            'conf': 16,
            'grund': 37,
        }

        for gewerk in sorted(by_gewerk.keys()):
            deps = by_gewerk[gewerk]

            # Pruefen ob genug Platz fuer Gewerk-Header + mind. 2 Zeilen
            if self.get_y() > self.h - 40:
                self.add_page()

            # Gewerk-Header
            self.set_fill_color(*self.COLOR_GEWERK_BG)
            self.set_text_color(*self.COLOR_PRIMARY)
            self.set_font('Arial', 'B', 11)
            self.cell(0, 9, f'  {gewerk}  ({len(deps)} Abh\u00e4ngigkeiten)', 1, 1, 'L', True)
            self.ln(1)

            # Tabellenkopf
            self.set_fill_color(*self.COLOR_HEADER_BG)
            self.set_text_color(*self.COLOR_HEADER_TEXT)
            self.set_font('Arial', 'B', 7)

            headers = [
                ('Ausl\u00f6ser (Art.-Nr.)', col_widths['source_art']),
                ('Ausl\u00f6ser (Bezeichnung)', col_widths['source_bez']),
                ('Typ', col_widths['type']),
                ('Ben\u00f6tigt (Art.-Nr.)', col_widths['target_art']),
                ('Ben\u00f6tigt (Bezeichnung)', col_widths['target_bez']),
                ('Konf.', col_widths['conf']),
                ('Grund', col_widths['grund']),
            ]

            for header_text, width in headers:
                self.cell(width, 7, f' {header_text}', 1, 0, 'L', True)
            self.ln()

            # Datenzeilen
            self.set_text_color(*self.COLOR_TEXT)
            for idx, dep in enumerate(deps):
                # Alternating row colors
                if idx % 2 == 1:
                    self.set_fill_color(*self.COLOR_ROW_ALT)
                    fill = True
                else:
                    fill = False

                # Pruefen ob neue Seite noetig
                if self.get_y() > self.h - 25:
                    self.add_page()
                    # Tabellenkopf wiederholen
                    self.set_fill_color(*self.COLOR_GEWERK_BG)
                    self.set_text_color(*self.COLOR_PRIMARY)
                    self.set_font('Arial', 'B', 11)
                    self.cell(0, 9, f'  {gewerk}  (Fortsetzung)', 1, 1, 'L', True)
                    self.ln(1)
                    self.set_fill_color(*self.COLOR_HEADER_BG)
                    self.set_text_color(*self.COLOR_HEADER_TEXT)
                    self.set_font('Arial', 'B', 7)
                    for header_text, width in headers:
                        self.cell(width, 7, f' {header_text}', 1, 0, 'L', True)
                    self.ln()
                    self.set_text_color(*self.COLOR_TEXT)

                # Abhaengigkeits-Typ mit Farbe
                dep_type = dep.get('dependency_type', '')
                type_label = self.TYPE_LABELS.get(dep_type, dep_type)
                type_color = self.TYPE_COLORS.get(dep_type, (100, 100, 100))

                # Daten vorbereiten
                source_art = self._truncate(dep.get('source_artikelnummer') or '-', 32)
                source_bez = self._truncate(dep.get('source_bezeichnung') or '-', 50)
                target_art = self._truncate(dep.get('target_artikelnummer') or '-', 32)
                target_bez = self._truncate(dep.get('target_bezeichnung') or '-', 50)
                conf = dep.get('confidence', '')
                if conf:
                    conf = f'{float(conf)*100:.0f}%'
                grund = self._truncate(dep.get('grund') or '', 30)

                row_h = 6.5
                self.set_font('Arial', '', 6.5)

                if fill:
                    self.set_fill_color(*self.COLOR_ROW_ALT)

                self.cell(col_widths['source_art'], row_h, f' {source_art}', 1, 0, 'L', fill)
                self.cell(col_widths['source_bez'], row_h, f' {source_bez}', 1, 0, 'L', fill)

                # Typ-Zelle mit Farbe
                self.set_text_color(*type_color)
                self.set_font('Arial', 'B', 6.5)
                self.cell(col_widths['type'], row_h, f' {type_label}', 1, 0, 'L', fill)
                self.set_text_color(*self.COLOR_TEXT)
                self.set_font('Arial', '', 6.5)

                self.cell(col_widths['target_art'], row_h, f' {target_art}', 1, 0, 'L', fill)
                self.cell(col_widths['target_bez'], row_h, f' {target_bez}', 1, 0, 'L', fill)
                self.cell(col_widths['conf'], row_h, f' {conf}', 1, 0, 'C', fill)
                self.cell(col_widths['grund'], row_h, f' {grund}', 1, 0, 'L', fill)
                self.ln()

            self.ln(3)

    def _truncate(self, text, max_len):
        """Text kuerzen wenn zu lang."""
        if not text:
            return ''
        text = str(text)
        if len(text) > max_len:
            return text[:max_len - 2] + '..'
        return text


def main():
    """Hauptfunktion: Daten laden und PDF erstellen."""
    data_path = r'C:\Users\holge\neurealis-erp\docs\lv_dependencies_data.json'
    output_path = r'C:\Users\holge\neurealis-erp\docs\LV_Abhaengigkeiten.pdf'

    # Daten laden
    with open(data_path, 'r', encoding='utf-8') as f:
        dependencies = json.load(f)

    print(f'Geladene Abhaengigkeiten: {len(dependencies)}')

    # Nach LV-Typ gruppieren
    by_lv_typ = defaultdict(list)
    for dep in dependencies:
        lv_typ = dep.get('lv_typ', 'Unbekannt')
        by_lv_typ[lv_typ].append(dep)

    # Statistiken berechnen
    stats = {
        'total': len(dependencies),
        'by_type': {lv_typ: len(deps) for lv_typ, deps in by_lv_typ.items()},
    }

    print(f'LV-Typen: {dict(stats["by_type"])}')

    # PDF erstellen
    pdf = LVDependencyPDF()
    pdf.alias_nb_pages()

    # Titelseite
    pdf.add_title_page(stats)

    # Sektionen fuer jeden LV-Typ (sortiert: GWS, neurealis, VBW)
    lv_order = ['GWS', 'neurealis', 'VBW']
    for lv_typ in lv_order:
        if lv_typ in by_lv_typ:
            pdf.add_lv_section(lv_typ, by_lv_typ[lv_typ])

    # Restliche LV-Typen (falls vorhanden)
    for lv_typ in sorted(by_lv_typ.keys()):
        if lv_typ not in lv_order:
            pdf.add_lv_section(lv_typ, by_lv_typ[lv_typ])

    # PDF speichern
    pdf.output(output_path)
    print(f'\nPDF erstellt: {output_path}')
    print(f'Seiten: {pdf.page_no()}')


if __name__ == '__main__':
    main()
