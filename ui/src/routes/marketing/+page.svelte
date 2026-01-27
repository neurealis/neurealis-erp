<script lang="ts">
	import { Card, Badge, Button, KPICard } from '$lib/components/ui';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';

	// Types
	interface SocialPost {
		id: string;
		post_nr: number;
		plattform: string;
		titel: string | null;
		text: string;
		bild_url: string | null;
		status: 'entwurf' | 'geplant' | 'veroeffentlicht';
		geplant_fuer: string | null;
		veroeffentlicht_am: string | null;
		created_at: string;
	}

	interface BlogPost {
		id: string;
		post_nr: number;
		titel: string;
		slug: string | null;
		excerpt: string | null;
		status: 'entwurf' | 'review' | 'veroeffentlicht';
		keywords: string[] | null;
		meta_description: string | null;
		kategorie: string | null;
		autor: string | null;
		veroeffentlicht_am: string | null;
		created_at: string;
	}

	// Tab State
	let activeTab = $state<'social' | 'blog' | 'analytics'>('social');

	// Social Media State
	let socialPosts = $state<SocialPost[]>([]);
	let socialLoading = $state(true);
	let socialError = $state<string | null>(null);
	let socialFilterStatus = $state<string>('alle');
	let socialFilterPlattform = $state<string>('alle');

	// Blog State
	let blogPosts = $state<BlogPost[]>([]);
	let blogLoading = $state(true);
	let blogError = $state<string | null>(null);
	let blogFilterStatus = $state<string>('alle');

	// Plattformen und Status-Konfigurationen
	const plattformen = ['Instagram', 'Facebook', 'LinkedIn', 'X/Twitter', 'TikTok', 'YouTube'];

	const socialStatusConfig = {
		entwurf: { label: 'Entwurf', variant: 'default' as const, color: '#6b7280' },
		geplant: { label: 'Geplant', variant: 'warning' as const, color: '#f59e0b' },
		veroeffentlicht: { label: 'Veröffentlicht', variant: 'success' as const, color: '#10b981' }
	};

	const blogStatusConfig = {
		entwurf: { label: 'Entwurf', variant: 'default' as const, color: '#6b7280' },
		review: { label: 'Review', variant: 'warning' as const, color: '#f59e0b' },
		veroeffentlicht: { label: 'Veröffentlicht', variant: 'success' as const, color: '#10b981' }
	};

	const plattformIcons: Record<string, string> = {
		'Instagram': 'instagram',
		'Facebook': 'facebook',
		'LinkedIn': 'linkedin',
		'X/Twitter': 'twitter',
		'TikTok': 'tiktok',
		'YouTube': 'youtube'
	};

	// Filtered Data
	let filteredSocialPosts = $derived(() => {
		return socialPosts.filter(p => {
			if (socialFilterStatus !== 'alle' && p.status !== socialFilterStatus) return false;
			if (socialFilterPlattform !== 'alle' && p.plattform !== socialFilterPlattform) return false;
			return true;
		});
	});

	let filteredBlogPosts = $derived(() => {
		return blogPosts.filter(p => {
			if (blogFilterStatus !== 'alle' && p.status !== blogFilterStatus) return false;
			return true;
		});
	});

	// Statistics
	let socialStats = $derived(() => {
		const total = socialPosts.length;
		const entwurf = socialPosts.filter(p => p.status === 'entwurf').length;
		const geplant = socialPosts.filter(p => p.status === 'geplant').length;
		const veroeffentlicht = socialPosts.filter(p => p.status === 'veroeffentlicht').length;
		return { total, entwurf, geplant, veroeffentlicht };
	});

	let blogStats = $derived(() => {
		const total = blogPosts.length;
		const entwurf = blogPosts.filter(p => p.status === 'entwurf').length;
		const review = blogPosts.filter(p => p.status === 'review').length;
		const veroeffentlicht = blogPosts.filter(p => p.status === 'veroeffentlicht').length;
		return { total, entwurf, review, veroeffentlicht };
	});

	// Daten laden
	async function loadSocialPosts() {
		socialLoading = true;
		socialError = null;

		const { data, error: err } = await supabase
			.from('social_media_posts')
			.select('*')
			.order('created_at', { ascending: false });

		if (err) {
			socialError = err.message;
			socialLoading = false;
			return;
		}

		socialPosts = data || [];
		socialLoading = false;
	}

	async function loadBlogPosts() {
		blogLoading = true;
		blogError = null;

		const { data, error: err } = await supabase
			.from('blog_posts')
			.select('*')
			.order('created_at', { ascending: false });

		if (err) {
			blogError = err.message;
			blogLoading = false;
			return;
		}

		blogPosts = data || [];
		blogLoading = false;
	}

	onMount(() => {
		loadSocialPosts();
		loadBlogPosts();
	});

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: '2-digit'
		});
	}

	function formatDateTime(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function truncateText(text: string, maxLength: number): string {
		if (text.length <= maxLength) return text;
		return text.substring(0, maxLength) + '...';
	}
</script>

<div class="marketing-page">
	<header class="page-header">
		<div class="header-content">
			<h1>Marketing</h1>
			<p class="subtitle">Social Media, SEO Blog und Analytics</p>
		</div>
	</header>

	<!-- Tabs -->
	<div class="tabs">
		<button
			class="tab"
			class:active={activeTab === 'social'}
			onclick={() => activeTab = 'social'}
		>
			Social Media
			{#if socialPosts.length > 0}
				<span class="tab-badge">{socialPosts.length}</span>
			{/if}
		</button>
		<button
			class="tab"
			class:active={activeTab === 'blog'}
			onclick={() => activeTab = 'blog'}
		>
			SEO Blog
			{#if blogPosts.length > 0}
				<span class="tab-badge">{blogPosts.length}</span>
			{/if}
		</button>
		<button
			class="tab"
			class:active={activeTab === 'analytics'}
			onclick={() => activeTab = 'analytics'}
		>
			Analytics
		</button>
	</div>

	<!-- Social Media Tab -->
	{#if activeTab === 'social'}
		<div class="tab-content">
			<!-- KPI Cards -->
			<div class="kpi-row">
				<KPICard
					label="Gesamt"
					value={socialStats().total}
					color="blue"
				/>
				<KPICard
					label="Entwürfe"
					value={socialStats().entwurf}
					color="gray"
				/>
				<KPICard
					label="Geplant"
					value={socialStats().geplant}
					color="yellow"
				/>
				<KPICard
					label="Veröffentlicht"
					value={socialStats().veroeffentlicht}
					color="green"
				/>
			</div>

			<!-- Filter & Actions -->
			<div class="filter-row">
				<div class="filter-group">
					<label for="social-status">Status</label>
					<select id="social-status" bind:value={socialFilterStatus}>
						<option value="alle">Alle Status</option>
						<option value="entwurf">Entwurf</option>
						<option value="geplant">Geplant</option>
						<option value="veroeffentlicht">Veröffentlicht</option>
					</select>
				</div>
				<div class="filter-group">
					<label for="social-plattform">Plattform</label>
					<select id="social-plattform" bind:value={socialFilterPlattform}>
						<option value="alle">Alle Plattformen</option>
						{#each plattformen as plattform}
							<option value={plattform}>{plattform}</option>
						{/each}
					</select>
				</div>
				<div class="filter-actions">
					<Button variant="primary">+ Neuer Post</Button>
				</div>
			</div>

			<!-- Error -->
			{#if socialError}
				<div class="error-banner">
					<span>Fehler: {socialError}</span>
					<Button variant="secondary" size="sm" onclick={() => loadSocialPosts()}>
						Erneut versuchen
					</Button>
				</div>
			{/if}

			<!-- Content -->
			{#if socialLoading}
				<div class="loading-state">
					<div class="spinner"></div>
					<p>Lade Social Media Posts...</p>
				</div>
			{:else if filteredSocialPosts().length === 0}
				<div class="empty-state">
					<div class="empty-icon">
						<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/>
						</svg>
					</div>
					<h3>Keine Posts vorhanden</h3>
					<p>Erstelle deinen ersten Social Media Post.</p>
					<Button variant="primary">+ Neuer Post</Button>
				</div>
			{:else}
				<div class="posts-grid">
					{#each filteredSocialPosts() as post}
						<Card>
							<div class="post-header">
								<div class="post-plattform">
									<span class="plattform-badge" data-plattform={post.plattform}>
										{post.plattform}
									</span>
								</div>
								<Badge variant={socialStatusConfig[post.status].variant} size="sm">
									{socialStatusConfig[post.status].label}
								</Badge>
							</div>

							{#if post.titel}
								<h3 class="post-titel">{post.titel}</h3>
							{/if}

							<p class="post-text">{truncateText(post.text, 150)}</p>

							{#if post.bild_url}
								<div class="post-image">
									<img src={post.bild_url} alt="Post-Bild" />
								</div>
							{/if}

							<div class="post-meta">
								{#if post.status === 'geplant' && post.geplant_fuer}
									<div class="meta-item">
										<span class="meta-label">Geplant für</span>
										<span class="meta-value">{formatDateTime(post.geplant_fuer)}</span>
									</div>
								{:else if post.status === 'veroeffentlicht' && post.veroeffentlicht_am}
									<div class="meta-item">
										<span class="meta-label">Veröffentlicht</span>
										<span class="meta-value">{formatDateTime(post.veroeffentlicht_am)}</span>
									</div>
								{:else}
									<div class="meta-item">
										<span class="meta-label">Erstellt</span>
										<span class="meta-value">{formatDate(post.created_at)}</span>
									</div>
								{/if}
							</div>
						</Card>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Blog Tab -->
	{#if activeTab === 'blog'}
		<div class="tab-content">
			<!-- KPI Cards -->
			<div class="kpi-row">
				<KPICard
					label="Gesamt"
					value={blogStats().total}
					color="blue"
				/>
				<KPICard
					label="Entwürfe"
					value={blogStats().entwurf}
					color="gray"
				/>
				<KPICard
					label="In Review"
					value={blogStats().review}
					color="yellow"
				/>
				<KPICard
					label="Veröffentlicht"
					value={blogStats().veroeffentlicht}
					color="green"
				/>
			</div>

			<!-- Filter & Actions -->
			<div class="filter-row">
				<div class="filter-group">
					<label for="blog-status">Status</label>
					<select id="blog-status" bind:value={blogFilterStatus}>
						<option value="alle">Alle Status</option>
						<option value="entwurf">Entwurf</option>
						<option value="review">Review</option>
						<option value="veroeffentlicht">Veröffentlicht</option>
					</select>
				</div>
				<div class="filter-actions">
					<Button variant="primary">+ Neuer Artikel</Button>
				</div>
			</div>

			<!-- Error -->
			{#if blogError}
				<div class="error-banner">
					<span>Fehler: {blogError}</span>
					<Button variant="secondary" size="sm" onclick={() => loadBlogPosts()}>
						Erneut versuchen
					</Button>
				</div>
			{/if}

			<!-- Content -->
			{#if blogLoading}
				<div class="loading-state">
					<div class="spinner"></div>
					<p>Lade Blog-Artikel...</p>
				</div>
			{:else if filteredBlogPosts().length === 0}
				<div class="empty-state">
					<div class="empty-icon">
						<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
							<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
						</svg>
					</div>
					<h3>Keine Blog-Artikel vorhanden</h3>
					<p>Erstelle deinen ersten SEO-optimierten Artikel.</p>
					<Button variant="primary">+ Neuer Artikel</Button>
				</div>
			{:else}
				<div class="blog-list">
					{#each filteredBlogPosts() as post}
						<Card>
							<div class="blog-header">
								<div class="blog-meta-left">
									<span class="blog-nr">#{post.post_nr}</span>
									{#if post.kategorie}
										<Badge variant="default" size="sm">{post.kategorie}</Badge>
									{/if}
								</div>
								<Badge variant={blogStatusConfig[post.status].variant} size="sm">
									{blogStatusConfig[post.status].label}
								</Badge>
							</div>

							<h3 class="blog-titel">{post.titel}</h3>

							{#if post.excerpt}
								<p class="blog-excerpt">{post.excerpt}</p>
							{/if}

							{#if post.keywords && post.keywords.length > 0}
								<div class="blog-keywords">
									{#each post.keywords.slice(0, 5) as keyword}
										<span class="keyword-tag">{keyword}</span>
									{/each}
									{#if post.keywords.length > 5}
										<span class="keyword-more">+{post.keywords.length - 5}</span>
									{/if}
								</div>
							{/if}

							{#if post.meta_description}
								<div class="seo-preview">
									<span class="seo-label">Meta-Description:</span>
									<span class="seo-text">{truncateText(post.meta_description, 160)}</span>
								</div>
							{/if}

							<div class="blog-footer">
								<div class="blog-meta">
									{#if post.autor}
										<span class="meta-item">Von {post.autor}</span>
									{/if}
									{#if post.veroeffentlicht_am}
										<span class="meta-item">{formatDate(post.veroeffentlicht_am)}</span>
									{:else}
										<span class="meta-item">Erstellt: {formatDate(post.created_at)}</span>
									{/if}
								</div>
								<div class="blog-actions">
									<Button variant="secondary" size="sm">Bearbeiten</Button>
								</div>
							</div>
						</Card>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Analytics Tab -->
	{#if activeTab === 'analytics'}
		<div class="tab-content">
			<!-- Placeholder KPIs -->
			<div class="kpi-row">
				<KPICard
					label="Besucher (30 Tage)"
					value="-"
					subvalue="Daten nicht verfügbar"
					color="blue"
				/>
				<KPICard
					label="Seitenaufrufe"
					value="-"
					subvalue="Daten nicht verfügbar"
					color="purple"
				/>
				<KPICard
					label="Conversion Rate"
					value="-"
					subvalue="Daten nicht verfügbar"
					color="green"
				/>
				<KPICard
					label="Absprungrate"
					value="-"
					subvalue="Daten nicht verfügbar"
					color="yellow"
				/>
			</div>

			<!-- Analytics Sections -->
			<div class="analytics-grid">
				<Card>
					<div class="analytics-section">
						<h3>Website Analytics</h3>
						<div class="placeholder-content">
							<div class="placeholder-icon">
								<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
									<path d="M18 20V10"/>
									<path d="M12 20V4"/>
									<path d="M6 20v-6"/>
								</svg>
							</div>
							<p class="placeholder-text">Analytics-Integration kommt bald</p>
							<p class="placeholder-subtext">Google Analytics, Matomo oder Plausible werden hier angebunden.</p>
						</div>
					</div>
				</Card>

				<Card>
					<div class="analytics-section">
						<h3>SEO Performance</h3>
						<div class="placeholder-content">
							<div class="placeholder-icon">
								<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
									<circle cx="11" cy="11" r="8"/>
									<line x1="21" y1="21" x2="16.65" y2="16.65"/>
								</svg>
							</div>
							<p class="placeholder-text">SEO-Daten werden integriert</p>
							<p class="placeholder-subtext">Google Search Console Anbindung in Planung.</p>
						</div>
					</div>
				</Card>

				<Card>
					<div class="analytics-section">
						<h3>SEA Performance</h3>
						<div class="placeholder-content">
							<div class="placeholder-icon">
								<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
									<circle cx="12" cy="12" r="10"/>
									<path d="M12 6v6l4 2"/>
								</svg>
							</div>
							<p class="placeholder-text">Google Ads Integration geplant</p>
							<p class="placeholder-subtext">Kampagnen-Performance und Kosten.</p>
						</div>
					</div>
				</Card>

				<Card>
					<div class="analytics-section">
						<h3>Social Ads</h3>
						<div class="placeholder-content">
							<div class="placeholder-icon">
								<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
									<path d="M17 2H7a5 5 0 0 0-5 5v10a5 5 0 0 0 5 5h10a5 5 0 0 0 5-5V7a5 5 0 0 0-5-5z"/>
									<path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/>
									<path d="M17.5 6.5h.01"/>
								</svg>
							</div>
							<p class="placeholder-text">Social Ads Tracking geplant</p>
							<p class="placeholder-subtext">Meta Ads, LinkedIn Ads Performance.</p>
						</div>
					</div>
				</Card>
			</div>

			<!-- Info Banner -->
			<div class="info-banner">
				<div class="info-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10"/>
						<line x1="12" y1="16" x2="12" y2="12"/>
						<line x1="12" y1="8" x2="12.01" y2="8"/>
					</svg>
				</div>
				<div class="info-content">
					<strong>Analytics-Integration in Entwicklung</strong>
					<p>Die Anbindung an Google Analytics, Search Console und Werbe-Plattformen wird in einer zukünftigen Version verfügbar sein.</p>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.marketing-page {
		max-width: 1400px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 1.5rem;
	}

	.page-header h1 {
		font-size: 1.75rem;
		margin-bottom: 0.25rem;
	}

	.subtitle {
		color: var(--color-gray-500);
		margin: 0;
	}

	/* Tabs */
	.tabs {
		display: flex;
		gap: 0.25rem;
		border-bottom: 1px solid var(--color-gray-200);
		margin-bottom: 1.5rem;
	}

	.tab {
		padding: 0.75rem 1.25rem;
		border: none;
		background: transparent;
		color: var(--color-gray-600);
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		transition: all 0.15s ease;
	}

	.tab:hover {
		color: var(--color-primary);
	}

	.tab.active {
		color: var(--color-primary);
	}

	.tab.active::after {
		content: '';
		position: absolute;
		bottom: -1px;
		left: 0;
		right: 0;
		height: 2px;
		background: var(--color-primary);
	}

	.tab-badge {
		background: var(--color-gray-100);
		color: var(--color-gray-600);
		padding: 0.1rem 0.4rem;
		border-radius: 10px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.tab.active .tab-badge {
		background: var(--color-primary-100);
		color: var(--color-primary);
	}

	/* Tab Content */
	.tab-content {
		animation: fadeIn 0.2s ease;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	/* KPI Row */
	.kpi-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	@media (max-width: 900px) {
		.kpi-row {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 500px) {
		.kpi-row {
			grid-template-columns: 1fr;
		}
	}

	/* Filter Row */
	.filter-row {
		display: flex;
		gap: 1rem;
		align-items: flex-end;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.filter-group label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-gray-600);
		text-transform: uppercase;
	}

	.filter-group select {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-gray-300);
		border-radius: 4px;
		font-size: 0.9rem;
		min-width: 150px;
		background: white;
	}

	.filter-group select:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.filter-actions {
		margin-left: auto;
	}

	/* Error Banner */
	.error-banner {
		background: var(--color-error-light, #fef2f2);
		border: 1px solid var(--color-error, #ef4444);
		color: var(--color-error-dark, #991b1b);
		padding: 1rem;
		margin-bottom: 1rem;
		border-radius: 4px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	/* Loading State */
	.loading-state {
		text-align: center;
		padding: 3rem 1rem;
		color: var(--color-gray-500);
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid var(--color-gray-200);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto 1rem;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* Empty State */
	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		background: var(--color-gray-50);
		border-radius: 8px;
		border: 1px dashed var(--color-gray-300);
	}

	.empty-icon {
		color: var(--color-gray-400);
		margin-bottom: 1rem;
	}

	.empty-state h3 {
		font-size: 1.1rem;
		margin-bottom: 0.5rem;
		color: var(--color-gray-700);
	}

	.empty-state p {
		color: var(--color-gray-500);
		margin-bottom: 1.5rem;
	}

	/* Posts Grid (Social Media) */
	.posts-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
	}

	@media (max-width: 1100px) {
		.posts-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 700px) {
		.posts-grid {
			grid-template-columns: 1fr;
		}
	}

	.post-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.plattform-badge {
		display: inline-block;
		padding: 0.2rem 0.6rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 600;
		background: var(--color-gray-100);
		color: var(--color-gray-700);
	}

	.plattform-badge[data-plattform="Instagram"] {
		background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
		color: white;
	}

	.plattform-badge[data-plattform="Facebook"] {
		background: #1877f2;
		color: white;
	}

	.plattform-badge[data-plattform="LinkedIn"] {
		background: #0a66c2;
		color: white;
	}

	.plattform-badge[data-plattform="X/Twitter"] {
		background: #000;
		color: white;
	}

	.plattform-badge[data-plattform="TikTok"] {
		background: #000;
		color: white;
	}

	.plattform-badge[data-plattform="YouTube"] {
		background: #ff0000;
		color: white;
	}

	.post-titel {
		font-size: 1rem;
		margin: 0 0 0.5rem 0;
	}

	.post-text {
		font-size: 0.9rem;
		color: var(--color-gray-600);
		line-height: 1.5;
		margin: 0 0 0.75rem 0;
	}

	.post-image {
		margin-bottom: 0.75rem;
		border-radius: 4px;
		overflow: hidden;
	}

	.post-image img {
		width: 100%;
		height: 150px;
		object-fit: cover;
	}

	.post-meta {
		border-top: 1px solid var(--color-gray-100);
		padding-top: 0.75rem;
	}

	.meta-item {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.meta-label {
		font-size: 0.7rem;
		color: var(--color-gray-500);
		text-transform: uppercase;
	}

	.meta-value {
		font-size: 0.85rem;
		color: var(--color-gray-700);
	}

	/* Blog List */
	.blog-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.blog-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.blog-meta-left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.blog-nr {
		font-family: var(--font-family-mono);
		font-size: 0.8rem;
		color: var(--color-gray-500);
	}

	.blog-titel {
		font-size: 1.1rem;
		margin: 0 0 0.5rem 0;
	}

	.blog-excerpt {
		font-size: 0.9rem;
		color: var(--color-gray-600);
		margin: 0 0 0.75rem 0;
		line-height: 1.5;
	}

	.blog-keywords {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.keyword-tag {
		background: var(--color-primary-50);
		color: var(--color-primary-700);
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
	}

	.keyword-more {
		color: var(--color-gray-500);
		font-size: 0.75rem;
	}

	.seo-preview {
		background: var(--color-gray-50);
		padding: 0.75rem;
		border-radius: 4px;
		margin-bottom: 0.75rem;
	}

	.seo-label {
		font-size: 0.7rem;
		color: var(--color-gray-500);
		text-transform: uppercase;
		display: block;
		margin-bottom: 0.25rem;
	}

	.seo-text {
		font-size: 0.85rem;
		color: var(--color-gray-700);
	}

	.blog-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: 0.75rem;
		border-top: 1px solid var(--color-gray-100);
	}

	.blog-meta {
		display: flex;
		gap: 1rem;
		font-size: 0.8rem;
		color: var(--color-gray-500);
	}

	/* Analytics Grid */
	.analytics-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	@media (max-width: 768px) {
		.analytics-grid {
			grid-template-columns: 1fr;
		}
	}

	.analytics-section h3 {
		font-size: 1rem;
		margin: 0 0 1.5rem 0;
		color: var(--color-gray-700);
	}

	.placeholder-content {
		text-align: center;
		padding: 2rem 1rem;
	}

	.placeholder-icon {
		color: var(--color-gray-300);
		margin-bottom: 1rem;
	}

	.placeholder-text {
		font-size: 1rem;
		color: var(--color-gray-600);
		margin: 0 0 0.5rem 0;
	}

	.placeholder-subtext {
		font-size: 0.85rem;
		color: var(--color-gray-500);
		margin: 0;
	}

	/* Info Banner */
	.info-banner {
		display: flex;
		gap: 1rem;
		padding: 1rem;
		background: var(--color-info-light, #eff6ff);
		border: 1px solid var(--color-info, #3b82f6);
		border-radius: 4px;
	}

	.info-icon {
		color: var(--color-info, #3b82f6);
		flex-shrink: 0;
	}

	.info-content strong {
		display: block;
		margin-bottom: 0.25rem;
		color: var(--color-info-dark, #1e40af);
	}

	.info-content p {
		margin: 0;
		font-size: 0.9rem;
		color: var(--color-gray-700);
	}
</style>
