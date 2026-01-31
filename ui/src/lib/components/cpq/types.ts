/**
 * CPQ Komponenten Types
 */

export interface Position {
	id: string;
	artikelnummer: string;
	bezeichnung: string;
	menge: number;
	einheit: string;
	einzelpreis: number;
	beschreibung?: string;
}

export interface PositionGroupData {
	id: string;
	name: string;
	positionen: Position[];
}
