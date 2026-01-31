import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mfpuijttdgkllnvhvjlu.supabase.co';
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { original_text, selected_position_id, lv_typ, falsche_position_id } = body;

		if (!original_text || !selected_position_id) {
			return json(
				{ error: 'original_text und selected_position_id sind erforderlich' },
				{ status: 400 }
			);
		}

		// Wenn Service Key vorhanden, in DB speichern
		if (supabaseServiceKey) {
			const supabase = createClient(supabaseUrl, supabaseServiceKey);

			// Korrektur in Lern-Tabelle speichern (fuer zukuenftiges ML)
			// Tabellen-Schema: original_text, korrekte_position_id, falsche_position_id, lv_typ, korrigiert_am
			const { error } = await supabase
				.from('position_corrections')
				.insert({
					original_text,
					korrekte_position_id: selected_position_id,
					falsche_position_id: falsche_position_id || null,
					lv_typ: lv_typ || null,
					korrigiert_am: new Date().toISOString()
				});

			if (error) {
				console.error('Korrektur speichern fehlgeschlagen:', error);
				// Nicht als Fehler zurueckgeben, da dies optional ist
			}
		}

		return json({ success: true });
	} catch (err) {
		console.error('Position correction error:', err);
		return json(
			{ error: 'Interner Serverfehler' },
			{ status: 500 }
		);
	}
};
