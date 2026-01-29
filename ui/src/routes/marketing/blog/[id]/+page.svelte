<script lang="ts">
	import { Card, Badge, Button } from '$lib/components/ui';
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import type { BlogPost } from './+page';

	// Props von load function
	let { data } = $props();

	// Reaktive Kopie für Bearbeitung
	let post = $state<BlogPost>({ ...data.post });

	// UI State
	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let saveSuccess = $state(false);

	let aiPrompt = $state('');
	let aiLoading = $state(false);
	let aiError = $state<string | null>(null);

	let wpPushing = $state(false);
	let wpPublishing = $state(false);
	let wpError = $state<string | null>(null);
	let wpSuccess = $state<string | null>(null);

	// Keywords als String für Eingabe
	let keywordsInput = $state(post.keywords?.join(', ') || '');

	// Derived
	let hasChanges = $derived(() => {
		return JSON.stringify(post) !== JSON.stringify(data.post) ||
			keywordsInput !== (data.post.keywords?.join(', ') || '');
	});

	let wordCount = $derived(() => {
		if (!post.inhalt) return 0;
		return post.inhalt.trim().split(/\s+/).filter(w => w.length > 0).length;
	});

	let isWordPressPushed = $derived(() => post.wordpress_post_id !== null);

	// Status-Konfiguration
	const statusConfig = {
		entwurf: { label: 'Entwurf', variant: 'default' as const },
		review: { label: 'Review', variant: 'warning' as const },
		veroeffentlicht: { label: 'Veröffentlicht', variant: 'success' as const }
	};

	// Speichern
	async function savePost() {
		saving = true;
		saveError = null;
		saveSuccess = false;

		// Keywords aus Eingabe parsen
		const keywords = keywordsInput
			.split(',')
			.map(k => k.trim())
			.filter(k => k.length > 0);

		const updateData = {
			titel: post.titel,
			inhalt: post.inhalt,
			excerpt: post.excerpt,
			meta_description: post.meta_description,
			keywords: keywords.length > 0 ? keywords : null,
			status: post.status,
			word_count: wordCount(),
			updated_at: new Date().toISOString()
		};

		const { error: err } = await supabase
			.from('blog_posts')
			.update(updateData)
			.eq('id', post.id);

		if (err) {
			saveError = err.message;
		} else {
			saveSuccess = true;
			// Update lokale Kopie für hasChanges
			data.post = { ...post, keywords, word_count: wordCount() };
			setTimeout(() => saveSuccess = false, 3000);
		}

		saving = false;
	}

	// KI-Überarbeitung
	async function aiRewrite() {
		if (!aiPrompt.trim()) {
			aiError = 'Bitte gib eine Anweisung für die KI ein.';
			return;
		}

		aiLoading = true;
		aiError = null;

		try {
			const { data: result, error: err } = await supabase.functions.invoke('blog-ai-rewrite', {
				body: {
					postId: post.id,
					inhalt: post.inhalt,
					titel: post.titel,
					anweisung: aiPrompt
				}
			});

			if (err) {
				aiError = err.message;
			} else if (result?.inhalt) {
				post.inhalt = result.inhalt;
				if (result.titel) post.titel = result.titel;
				if (result.excerpt) post.excerpt = result.excerpt;
				if (result.meta_description) post.meta_description = result.meta_description;
				aiPrompt = '';
			} else {
				aiError = 'Keine Antwort von der KI erhalten.';
			}
		} catch (e) {
			aiError = e instanceof Error ? e.message : 'Unbekannter Fehler';
		}

		aiLoading = false;
	}

	// WordPress Push (als Entwurf)
	async function pushToWordPress() {
		wpPushing = true;
		wpError = null;
		wpSuccess = null;

		try {
			const { data: result, error: err } = await supabase.functions.invoke('blog-wordpress-sync', {
				body: {
					postId: post.id,
					action: 'push_draft'
				}
			});

			if (err) {
				wpError = err.message;
			} else if (result?.wordpress_post_id) {
				post.wordpress_post_id = result.wordpress_post_id;
				post.wordpress_synced_at = result.wordpress_synced_at;
				post.wordpress_sync_status = result.wordpress_sync_status || 'draft';
				wpSuccess = 'Artikel erfolgreich als Entwurf nach WordPress gepusht.';
				setTimeout(() => wpSuccess = null, 5000);
			} else {
				wpError = 'WordPress-Sync fehlgeschlagen.';
			}
		} catch (e) {
			wpError = e instanceof Error ? e.message : 'Unbekannter Fehler';
		}

		wpPushing = false;
	}

	// WordPress Veröffentlichen
	async function publishToWordPress() {
		if (!post.wordpress_post_id) {
			wpError = 'Artikel muss zuerst nach WordPress gepusht werden.';
			return;
		}

		wpPublishing = true;
		wpError = null;
		wpSuccess = null;

		try {
			const { data: result, error: err } = await supabase.functions.invoke('blog-wordpress-sync', {
				body: {
					postId: post.id,
					action: 'publish'
				}
			});

			if (err) {
				wpError = err.message;
			} else if (result?.success) {
				post.wordpress_sync_status = 'published';
				post.wordpress_synced_at = result.wordpress_synced_at;
				post.status = 'veroeffentlicht';
				post.veroeffentlicht_am = new Date().toISOString();
				wpSuccess = 'Artikel erfolgreich auf WordPress veröffentlicht!';
				setTimeout(() => wpSuccess = null, 5000);
			} else {
				wpError = 'Veröffentlichung fehlgeschlagen.';
			}
		} catch (e) {
			wpError = e instanceof Error ? e.message : 'Unbekannter Fehler';
		}

		wpPublishing = false;
	}

	// Formatierung
	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="blog-editor-page">
	<!-- Header -->
	<header class="page-header">
		<div class="header-left">
			<a href="/marketing" class="back-link">
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M19 12H5M12 19l-7-7 7-7"/>
				</svg>
				Zurück zu Marketing
			</a>
			<h1>Blog-Editor</h1>
			<div class="header-meta">
				<span class="post-nr">#{post.post_nr}</span>
				<Badge variant={statusConfig[post.status].variant}>
					{statusConfig[post.status].label}
				</Badge>
				{#if post.pipeline_run_id || post.confidence_score}
					<Badge variant="info">KI-generiert</Badge>
				{/if}
				{#if post.cluster}
					<Badge variant="default">{post.cluster}</Badge>
				{/if}
			</div>
		</div>
		<div class="header-actions">
			{#if hasChanges()}
				<span class="unsaved-indicator">Ungespeicherte Änderungen</span>
			{/if}
			<Button
				variant="primary"
				loading={saving}
				disabled={!hasChanges()}
				onclick={savePost}
			>
				Änderungen speichern
			</Button>
		</div>
	</header>

	<!-- Erfolgs-/Fehlermeldungen -->
	{#if saveSuccess}
		<div class="alert alert-success">
			Änderungen erfolgreich gespeichert.
		</div>
	{/if}
	{#if saveError}
		<div class="alert alert-error">
			Fehler beim Speichern: {saveError}
		</div>
	{/if}

	<div class="editor-layout">
		<!-- Hauptbereich -->
		<div class="editor-main">
			<!-- Titel -->
			<Card>
				<div class="form-group">
					<label for="titel">Titel</label>
					<input
						type="text"
						id="titel"
						bind:value={post.titel}
						placeholder="Artikel-Titel eingeben..."
						class="input-lg"
					/>
				</div>
			</Card>

			<!-- Inhalt -->
			<Card>
				<div class="form-group">
					<div class="label-row">
						<label for="inhalt">Inhalt</label>
						<span class="word-count">{wordCount()} Wörter</span>
					</div>
					<textarea
						id="inhalt"
						bind:value={post.inhalt}
						placeholder="Artikel-Inhalt hier eingeben (Markdown unterstützt)..."
						rows="25"
						class="editor-textarea"
					></textarea>
				</div>
			</Card>

			<!-- KI-Überarbeitung -->
			<Card>
				<div class="ai-section">
					<h3>KI-Überarbeitung</h3>
					<p class="ai-hint">Gib der KI eine Anweisung, wie der Artikel überarbeitet werden soll.</p>

					<div class="ai-input-row">
						<input
							type="text"
							bind:value={aiPrompt}
							placeholder="z.B. 'Kürze den Artikel auf 500 Wörter' oder 'Füge mehr SEO-Keywords ein'"
							class="ai-input"
							disabled={aiLoading}
						/>
						<Button
							variant="secondary"
							loading={aiLoading}
							onclick={aiRewrite}
						>
							KI überarbeiten
						</Button>
					</div>

					{#if aiError}
						<div class="alert alert-error alert-sm">
							{aiError}
						</div>
					{/if}

					<div class="ai-suggestions">
						<span class="suggestions-label">Vorschläge:</span>
						<button class="suggestion-chip" onclick={() => aiPrompt = 'Kürze den Artikel auf etwa 600 Wörter'}>
							Kürzen
						</button>
						<button class="suggestion-chip" onclick={() => aiPrompt = 'Füge mehr SEO-Keywords zum Thema Wohnungssanierung ein'}>
							Mehr SEO
						</button>
						<button class="suggestion-chip" onclick={() => aiPrompt = 'Schreibe die Einleitung ansprechender'}>
							Bessere Einleitung
						</button>
						<button class="suggestion-chip" onclick={() => aiPrompt = 'Füge einen Call-to-Action am Ende hinzu'}>
							CTA hinzufügen
						</button>
					</div>
				</div>
			</Card>
		</div>

		<!-- Sidebar -->
		<div class="editor-sidebar">
			<!-- SEO / Meta -->
			<Card>
				<h3>SEO & Meta</h3>

				<div class="form-group">
					<label for="excerpt">Excerpt / Kurzfassung</label>
					<textarea
						id="excerpt"
						bind:value={post.excerpt}
						placeholder="Kurze Zusammenfassung für Vorschau..."
						rows="3"
					></textarea>
				</div>

				<div class="form-group">
					<label for="meta_description">Meta-Description</label>
					<textarea
						id="meta_description"
						bind:value={post.meta_description}
						placeholder="SEO Meta-Description (max. 160 Zeichen)..."
						rows="3"
						maxlength="160"
					></textarea>
					{#if post.meta_description}
						<span class="char-count" class:warning={post.meta_description.length > 155}>
							{post.meta_description.length}/160
						</span>
					{/if}
				</div>

				<div class="form-group">
					<label for="keywords">Keywords (kommagetrennt)</label>
					<input
						type="text"
						id="keywords"
						bind:value={keywordsInput}
						placeholder="z.B. Wohnungssanierung, Dortmund, Kosten..."
					/>
					{#if keywordsInput}
						<div class="keywords-preview">
							{#each keywordsInput.split(',').map(k => k.trim()).filter(k => k) as keyword}
								<span class="keyword-tag">{keyword}</span>
							{/each}
						</div>
					{/if}
				</div>

				{#if post.target_keyword}
					<div class="info-box">
						<span class="info-label">Ziel-Keyword</span>
						<span class="info-value highlight">{post.target_keyword}</span>
					</div>
				{/if}
			</Card>

			<!-- Status -->
			<Card>
				<h3>Status</h3>

				<div class="form-group">
					<label for="status">Artikelstatus</label>
					<select id="status" bind:value={post.status}>
						<option value="entwurf">Entwurf</option>
						<option value="review">Review</option>
						<option value="veroeffentlicht">Veröffentlicht</option>
					</select>
				</div>

				{#if post.confidence_score !== null}
					<div class="info-box">
						<span class="info-label">KI-Confidence</span>
						<span class="info-value confidence" class:high={post.confidence_score >= 0.8} class:medium={post.confidence_score >= 0.5 && post.confidence_score < 0.8} class:low={post.confidence_score < 0.5}>
							{Math.round(post.confidence_score * 100)}%
						</span>
					</div>
				{/if}

				<div class="info-box">
					<span class="info-label">Erstellt am</span>
					<span class="info-value">{formatDate(post.created_at)}</span>
				</div>

				{#if post.updated_at}
					<div class="info-box">
						<span class="info-label">Zuletzt bearbeitet</span>
						<span class="info-value">{formatDate(post.updated_at)}</span>
					</div>
				{/if}
			</Card>

			<!-- WordPress-Sync -->
			<Card>
				<h3>WordPress-Sync</h3>

				{#if wpSuccess}
					<div class="alert alert-success alert-sm">
						{wpSuccess}
					</div>
				{/if}
				{#if wpError}
					<div class="alert alert-error alert-sm">
						{wpError}
					</div>
				{/if}

				{#if isWordPressPushed()}
					<div class="wp-status">
						<div class="info-box">
							<span class="info-label">WordPress Post-ID</span>
							<span class="info-value mono">{post.wordpress_post_id}</span>
						</div>
						<div class="info-box">
							<span class="info-label">Sync-Status</span>
							<Badge variant={post.wordpress_sync_status === 'published' ? 'success' : 'warning'}>
								{post.wordpress_sync_status === 'published' ? 'Veröffentlicht' : 'Entwurf'}
							</Badge>
						</div>
						{#if post.wordpress_synced_at}
							<div class="info-box">
								<span class="info-label">Zuletzt synchronisiert</span>
								<span class="info-value">{formatDate(post.wordpress_synced_at)}</span>
							</div>
						{/if}
					</div>

					<div class="wp-actions">
						<Button
							variant="secondary"
							fullWidth
							loading={wpPushing}
							onclick={pushToWordPress}
						>
							Aktualisieren (Entwurf)
						</Button>
						{#if post.wordpress_sync_status !== 'published'}
							<Button
								variant="primary"
								fullWidth
								loading={wpPublishing}
								onclick={publishToWordPress}
							>
								Auf WordPress veröffentlichen
							</Button>
						{/if}
					</div>
				{:else}
					<p class="wp-hint">Artikel wurde noch nicht nach WordPress übertragen.</p>
					<Button
						variant="secondary"
						fullWidth
						loading={wpPushing}
						onclick={pushToWordPress}
					>
						Nach WordPress pushen (Entwurf)
					</Button>
				{/if}
			</Card>

			<!-- Interne Links -->
			{#if post.internal_links && post.internal_links.length > 0}
				<Card>
					<h3>Interne Links</h3>
					<div class="internal-links">
						{#each post.internal_links as link}
							<a href={link} target="_blank" rel="noopener" class="internal-link">
								{link}
							</a>
						{/each}
					</div>
				</Card>
			{/if}
		</div>
	</div>
</div>

<style>
	.blog-editor-page {
		max-width: 1400px;
		margin: 0 auto;
	}

	/* Header */
	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.header-left {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--color-gray-600);
		text-decoration: none;
		font-size: 0.9rem;
		transition: color 0.15s;
	}

	.back-link:hover {
		color: var(--color-primary);
	}

	.page-header h1 {
		font-size: 1.5rem;
		margin: 0;
	}

	.header-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.post-nr {
		font-family: var(--font-family-mono);
		color: var(--color-gray-500);
		font-size: 0.85rem;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.unsaved-indicator {
		color: var(--color-warning);
		font-size: 0.85rem;
		font-weight: 500;
	}

	/* Layout */
	.editor-layout {
		display: grid;
		grid-template-columns: 1fr 350px;
		gap: 1.5rem;
	}

	@media (max-width: 1100px) {
		.editor-layout {
			grid-template-columns: 1fr;
		}
	}

	.editor-main {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.editor-sidebar {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	/* Cards */
	.editor-sidebar :global(.card) {
		padding: 1rem;
	}

	.editor-sidebar h3 {
		font-size: 0.95rem;
		margin: 0 0 1rem 0;
		color: var(--color-gray-700);
		border-bottom: 1px solid var(--color-gray-100);
		padding-bottom: 0.5rem;
	}

	/* Form Groups */
	.form-group {
		margin-bottom: 1rem;
	}

	.form-group:last-child {
		margin-bottom: 0;
	}

	.form-group label {
		display: block;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-gray-600);
		text-transform: uppercase;
		margin-bottom: 0.4rem;
	}

	.label-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.4rem;
	}

	.label-row label {
		margin-bottom: 0;
	}

	.word-count {
		font-size: 0.8rem;
		color: var(--color-gray-500);
		font-family: var(--font-family-mono);
	}

	/* Inputs */
	input[type="text"],
	textarea,
	select {
		width: 100%;
		padding: 0.6rem 0.75rem;
		border: 1px solid var(--color-gray-300);
		border-radius: 4px;
		font-size: 0.9rem;
		font-family: inherit;
		background: white;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	input[type="text"]:focus,
	textarea:focus,
	select:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px var(--color-primary-100);
	}

	.input-lg {
		font-size: 1.25rem;
		padding: 0.75rem 1rem;
		font-weight: 600;
	}

	.editor-textarea {
		font-family: var(--font-family-mono);
		font-size: 0.9rem;
		line-height: 1.6;
		resize: vertical;
		min-height: 400px;
	}

	/* Character Count */
	.char-count {
		display: block;
		text-align: right;
		font-size: 0.75rem;
		color: var(--color-gray-500);
		margin-top: 0.25rem;
	}

	.char-count.warning {
		color: var(--color-warning);
	}

	/* Keywords Preview */
	.keywords-preview {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.5rem;
	}

	.keyword-tag {
		background: var(--color-primary-50);
		color: var(--color-primary-700);
		padding: 0.15rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
	}

	/* Info Boxes */
	.info-box {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--color-gray-100);
	}

	.info-box:last-child {
		border-bottom: none;
	}

	.info-label {
		font-size: 0.8rem;
		color: var(--color-gray-500);
	}

	.info-value {
		font-size: 0.85rem;
		color: var(--color-gray-700);
	}

	.info-value.mono {
		font-family: var(--font-family-mono);
	}

	.info-value.highlight {
		background: var(--color-primary-50);
		color: var(--color-primary-700);
		padding: 0.15rem 0.5rem;
		border-radius: 4px;
		font-weight: 500;
	}

	/* Confidence */
	.info-value.confidence {
		padding: 0.15rem 0.5rem;
		border-radius: 4px;
		font-weight: 600;
		font-family: var(--font-family-mono);
	}

	.info-value.confidence.high {
		background: var(--color-success-light, #dcfce7);
		color: var(--color-success-dark, #166534);
	}

	.info-value.confidence.medium {
		background: var(--color-warning-light, #fef3c7);
		color: var(--color-warning-dark, #92400e);
	}

	.info-value.confidence.low {
		background: var(--color-error-light, #fef2f2);
		color: var(--color-error-dark, #991b1b);
	}

	/* AI Section */
	.ai-section h3 {
		font-size: 1rem;
		margin: 0 0 0.5rem 0;
	}

	.ai-hint {
		color: var(--color-gray-600);
		font-size: 0.85rem;
		margin: 0 0 1rem 0;
	}

	.ai-input-row {
		display: flex;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.ai-input {
		flex: 1;
	}

	.ai-suggestions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.suggestions-label {
		font-size: 0.8rem;
		color: var(--color-gray-500);
	}

	.suggestion-chip {
		background: var(--color-gray-100);
		border: none;
		padding: 0.3rem 0.6rem;
		border-radius: 4px;
		font-size: 0.8rem;
		color: var(--color-gray-700);
		cursor: pointer;
		transition: background 0.15s;
	}

	.suggestion-chip:hover {
		background: var(--color-gray-200);
	}

	/* WordPress */
	.wp-status {
		margin-bottom: 1rem;
	}

	.wp-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.wp-hint {
		color: var(--color-gray-500);
		font-size: 0.85rem;
		margin: 0 0 1rem 0;
	}

	/* Internal Links */
	.internal-links {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.internal-link {
		display: block;
		color: var(--color-primary);
		font-size: 0.85rem;
		text-decoration: none;
		word-break: break-all;
	}

	.internal-link:hover {
		text-decoration: underline;
	}

	/* Alerts */
	.alert {
		padding: 0.75rem 1rem;
		border-radius: 4px;
		margin-bottom: 1rem;
	}

	.alert-sm {
		padding: 0.5rem 0.75rem;
		font-size: 0.85rem;
	}

	.alert-success {
		background: var(--color-success-light, #dcfce7);
		color: var(--color-success-dark, #166534);
		border: 1px solid var(--color-success, #10b981);
	}

	.alert-error {
		background: var(--color-error-light, #fef2f2);
		color: var(--color-error-dark, #991b1b);
		border: 1px solid var(--color-error, #ef4444);
	}
</style>
