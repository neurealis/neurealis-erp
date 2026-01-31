# T4: Drag&Drop Komponenten - Ergebnis

**Datum:** 2026-01-30
**Status:** Fertig

---

## Erstellte Komponenten

### 1. DraggableList.svelte
**Pfad:** `ui/src/lib/components/cpq/DraggableList.svelte`

Generische Drag&Drop Liste mit:
- Native HTML5 Drag&Drop API (keine externe Library)
- Touch-Support für Mobile (ontouchstart, ontouchmove, ontouchend)
- Props: `items`, `onReorder`, `renderItem`, `itemKey`
- Visual Feedback: Border-Top-Indikator beim Ziehen, Opacity-Effekt

**Props:**
```typescript
interface Props<T> {
    items: T[];                           // Bindable Array
    onReorder?: (items: T[]) => void;     // Callback nach Neuordnung
    renderItem: Snippet<[T, number]>;     // Render-Snippet für Items
    itemKey?: (item: T) => string;        // Optional: Key-Funktion
}
```

### 2. PositionItem.svelte
**Pfad:** `ui/src/lib/components/cpq/PositionItem.svelte`

Einzelne Position mit:
- Drag-Handle (SVG dots pattern)
- Artikelnummer, Bezeichnung, Menge, Einheit, Einzelpreis, Gesamtpreis
- Inline-Edit für Menge (Doppelklick)
- Edit/Delete Actions (on hover sichtbar)
- Responsive: Mobile-optimierte Grid-Ansicht

**Props:**
```typescript
interface Props {
    position: Position;
    onEdit?: (position: Position) => void;
    onDelete?: () => void;
    onMengeChange?: (menge: number) => void;
    readonly?: boolean;
}
```

**Position Type:**
```typescript
interface Position {
    id: string;
    artikelnummer: string;
    bezeichnung: string;
    menge: number;
    einheit: string;
    einzelpreis: number;
    beschreibung?: string;
}
```

### 3. PositionGroup.svelte
**Pfad:** `ui/src/lib/components/cpq/PositionGroup.svelte`

Collapsible Gruppe mit:
- Header: Gewerk-Name, Positions-Count, Summe
- Expand/Collapse mit Animation
- Inline-Rename (Doppelklick auf Namen)
- Actions: Kopieren, Löschen
- Enthält DraggableList für Positionen
- Positions-Header mit Spaltenüberschriften

**Props:**
```typescript
interface Props {
    group: PositionGroupData;
    expanded?: boolean;                                    // Bindable
    onToggle?: () => void;
    onCopy?: () => void;
    onDelete?: () => void;
    onRename?: (name: string) => void;
    onPositionMove?: (groupId: string, newOrder: Position[]) => void;
    onPositionEdit?: (position: Position) => void;
    onPositionDelete?: (positionId: string) => void;
    onPositionMengeChange?: (positionId: string, menge: number) => void;
    readonly?: boolean;
}
```

### 4. PositionGroupList.svelte
**Pfad:** `ui/src/lib/components/cpq/PositionGroupList.svelte`

Container für mehrere Gruppen:
- Drag&Drop für ganze Gruppen
- Toolbar: Info (Gewerke/Positionen Count), Alle aufklappen/zuklappen
- "Neues Gewerk hinzufugen" Button (gestrichelter Rahmen)
- Gesamtsummen-Footer (dunkler Hintergrund)
- Default-Implementierung für Add/Copy/Delete/Rename

**Props:**
```typescript
interface Props {
    groups: PositionGroupData[];               // Bindable Array
    onGroupsChange?: (groups: PositionGroupData[]) => void;
    onGroupAdd?: () => void;                   // Custom oder Default
    onGroupCopy?: (groupId: string) => void;   // Custom oder Default
    onGroupDelete?: (groupId: string) => void; // Custom oder Default
    onGroupRename?: (groupId: string, name: string) => void;
    onPositionEdit?: (groupId: string, position: Position) => void;
    onPositionDelete?: (groupId: string, positionId: string) => void;
    onPositionMengeChange?: (groupId: string, positionId: string, menge: number) => void;
    readonly?: boolean;
    showAddButton?: boolean;
}
```

### 5. index.ts (Export)
**Pfad:** `ui/src/lib/components/cpq/index.ts`

Re-exportiert alle Komponenten und Types für einfachen Import.

---

## Verwendungsbeispiel

```svelte
<script lang="ts">
    import { PositionGroupList, type PositionGroupData } from '$lib/components/cpq';

    let groups: PositionGroupData[] = $state([
        {
            id: '1',
            name: 'Elektroarbeiten',
            positionen: [
                {
                    id: 'p1',
                    artikelnummer: 'GWS.LV23-01.01.1',
                    bezeichnung: 'Unterverteilung komplett',
                    menge: 1,
                    einheit: 'Stk',
                    einzelpreis: 850.00
                },
                {
                    id: 'p2',
                    artikelnummer: 'GWS.LV23-01.01.2',
                    bezeichnung: 'Steckdose Aufputz',
                    menge: 12,
                    einheit: 'Stk',
                    einzelpreis: 45.00
                }
            ]
        },
        {
            id: '2',
            name: 'Sanitärarbeiten',
            positionen: [
                {
                    id: 'p3',
                    artikelnummer: 'GWS.LV23-02.01.1',
                    bezeichnung: 'Waschtisch komplett',
                    menge: 1,
                    einheit: 'Stk',
                    einzelpreis: 320.00
                }
            ]
        }
    ]);

    function handleGroupsChange(newGroups: PositionGroupData[]) {
        console.log('Groups changed:', newGroups);
        // Hier: Speichern in DB
    }

    function handlePositionEdit(groupId: string, position: Position) {
        console.log('Edit position:', groupId, position);
        // Hier: Modal öffnen
    }
</script>

<PositionGroupList
    bind:groups
    onGroupsChange={handleGroupsChange}
    onPositionEdit={handlePositionEdit}
/>
```

---

## Design-Entscheidungen

1. **Eckiges Design:** `border-radius: 0` durchgehend (neurealis Corporate)
2. **Farben:** Nutzt CSS-Variablen aus `tokens.css` (--color-primary, etc.)
3. **Drag-Handle:** SVG-Punktmuster (6 Punkte) statt Unicode-Zeichen
4. **Touch-Support:** Eigene Touch-Handler statt Polyfill-Library
5. **Responsive:** Grid-basiert mit CSS Media Queries

---

## Bekannte Einschränkungen

1. **Cross-Group Drag&Drop:** Positionen können aktuell NUR innerhalb ihrer Gruppe umsortiert werden. Verschieben zwischen Gruppen erfordert zusätzliche Implementierung.

2. **Touch-Drag Performance:** Bei langen Listen kann Touch-Scrolling vs. Dragging kollidieren. Workaround: Nur Drag-Handle für Touch-Initiierung.

3. **Keyboard Navigation:** Aktuell nur Tab-Navigation, keine Keyboard-basierte Umsortierung (ARIA Drag&Drop).

4. **Undo/Redo:** Nicht implementiert. Für vollständiges CPQ empfohlen.

---

## Nächste Schritte

1. **Cross-Group Drag&Drop:** Implementieren via dataTransfer mit groupId
2. **Position hinzufugen:** Modal/Drawer für LV-Suche + Position-Konfiguration
3. **Angebots-Header:** Kunde, Projekt, Datum, Nummer
4. **PDF-Export:** jsPDF Integration aus LV-Export

---

*Erstellt: 2026-01-30*
