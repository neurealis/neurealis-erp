/**
 * Blog-Editor - Daten laden
 */

import { supabase } from '$lib/supabase';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export interface BlogPost {
	id: string;
	post_nr: number;
	titel: string;
	slug: string | null;
	inhalt: string | null;
	excerpt: string | null;
	status: 'entwurf' | 'review' | 'veroeffentlicht';
	keywords: string[] | null;
	meta_title: string | null;
	meta_description: string | null;
	kategorie: string | null;
	autor: string | null;
	bild_url: string | null;
	veroeffentlicht_am: string | null;
	erstellt_von: string | null;
	created_at: string;
	updated_at: string | null;
	cluster: string | null;
	target_keyword: string | null;
	word_count: number | null;
	internal_links: string[] | null;
	pipeline_run_id: string | null;
	review_status: 'draft' | 'pending' | 'approved' | 'rejected' | null;
	confidence_score: number | null;
	wordpress_post_id: number | null;
	wordpress_synced_at: string | null;
	wordpress_sync_status: string | null;
}

export const load: PageLoad = async ({ params }) => {
	const { id } = params;

	const { data, error: err } = await supabase
		.from('blog_posts')
		.select('*')
		.eq('id', id)
		.single();

	if (err || !data) {
		throw error(404, 'Blog-Artikel nicht gefunden');
	}

	return {
		post: data as BlogPost
	};
};
