<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	interface HilfeDoc {
		title: string;
		description: string;
		htmlUrl: string;
		pdfUrl: string;
		icon: string;
		version: string;
		updated: string;
	}

	const hilfeDocs: HilfeDoc[] = [
		{
			title: 'Telegram-Bot Anleitung',
			description: 'Vollständige Anleitung für den neurealis Telegram-Bot für Bauleiter. Mängel melden, Nachträge erfassen, Status prüfen und mehr.',
			htmlUrl: '/docs/TELEGRAM_BOT_USER_GUIDE.html',
			pdfUrl: '/docs/TELEGRAM_BOT_USER_GUIDE.pdf',
			icon: '🤖',
			version: 'v74',
			updated: '2026-02-01'
		}
	];

	function openHtml(url: string) {
		window.open(url, '_blank');
	}

	function downloadPdf(url: string, title: string) {
		const link = document.createElement('a');
		link.href = url;
		link.download = title.replace(/\s+/g, '_') + '.pdf';
		link.click();
	}
</script>

<svelte:head>
	<title>Hilfe - neurealis ERP</title>
</svelte:head>

<div class="hilfe-page">
	<header class="page-header">
		<h1>Hilfe & Dokumentation</h1>
		<p class="subtitle">Anleitungen und Handbücher für das neurealis ERP-System</p>
	</header>

	<section class="docs-grid">
		{#each hilfeDocs as doc}
			<Card>
				<div class="doc-card">
					<div class="doc-icon">{doc.icon}</div>
					<div class="doc-content">
						<h2>{doc.title}</h2>
						<p class="doc-description">{doc.description}</p>
						<div class="doc-meta">
							<span class="version">{doc.version}</span>
							<span class="updated">Aktualisiert: {doc.updated}</span>
						</div>
					</div>
					<div class="doc-actions">
						<Button variant="secondary" onclick={() => openHtml(doc.htmlUrl)}>
							<span class="btn-icon">📖</span> Online lesen
						</Button>
						<Button variant="primary" onclick={() => downloadPdf(doc.pdfUrl, doc.title)}>
							<span class="btn-icon">📥</span> PDF Download
						</Button>
					</div>
				</div>
			</Card>
		{/each}
	</section>

	<section class="quick-links">
		<h2>Schnellhilfe</h2>
		<div class="links-grid">
			<a href="https://t.me/neurealis_bedarfsanalyse_bot" target="_blank" class="quick-link">
				<span class="link-icon">💬</span>
				<span class="link-text">Telegram-Bot öffnen</span>
			</a>
			<a href="mailto:holger.neumann@neurealis.de" class="quick-link">
				<span class="link-icon">📧</span>
				<span class="link-text">Support kontaktieren</span>
			</a>
		</div>
	</section>
</div>

<style>
	.hilfe-page {
		padding: var(--spacing-lg);
		max-width: 1200px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: var(--spacing-xl);
	}

	.page-header h1 {
		font-size: 1.75rem;
		font-weight: 600;
		color: var(--color-text);
		margin: 0 0 var(--spacing-xs) 0;
	}

	.subtitle {
		color: var(--color-text-secondary);
		margin: 0;
	}

	.docs-grid {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-xl);
	}

	.doc-card {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-md);
		padding: var(--spacing-md);
	}

	.doc-icon {
		font-size: 2.5rem;
		flex-shrink: 0;
	}

	.doc-content {
		flex: 1;
	}

	.doc-content h2 {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0 0 var(--spacing-xs) 0;
		color: var(--color-text);
	}

	.doc-description {
		color: var(--color-text-secondary);
		margin: 0 0 var(--spacing-sm) 0;
		line-height: 1.5;
	}

	.doc-meta {
		display: flex;
		gap: var(--spacing-md);
		font-size: 0.85rem;
	}

	.version {
		background: var(--color-primary);
		color: white;
		padding: 2px 8px;
		border-radius: 4px;
		font-weight: 500;
	}

	.updated {
		color: var(--color-text-secondary);
	}

	.doc-actions {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
		flex-shrink: 0;
	}

	.btn-icon {
		margin-right: var(--spacing-xs);
	}

	.quick-links {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-lg);
	}

	.quick-links h2 {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0 0 var(--spacing-md) 0;
		color: var(--color-text);
	}

	.links-grid {
		display: flex;
		gap: var(--spacing-md);
		flex-wrap: wrap;
	}

	.quick-link {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		text-decoration: none;
		color: var(--color-text);
		transition: all 0.2s ease;
	}

	.quick-link:hover {
		border-color: var(--color-primary);
		background: var(--color-primary-light);
	}

	.link-icon {
		font-size: 1.25rem;
	}

	.link-text {
		font-weight: 500;
	}

	@media (max-width: 768px) {
		.doc-card {
			flex-direction: column;
		}

		.doc-actions {
			flex-direction: row;
			width: 100%;
		}

		.doc-actions :global(button) {
			flex: 1;
		}
	}
</style>
