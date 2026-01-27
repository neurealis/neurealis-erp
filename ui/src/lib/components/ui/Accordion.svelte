<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		subtitle?: string;
		badge?: Snippet;
		defaultOpen?: boolean;
		children: Snippet;
	}

	let { title, subtitle, badge, defaultOpen = false, children }: Props = $props();

	let isOpen = $state(defaultOpen);

	function toggle() {
		isOpen = !isOpen;
	}
</script>

<div class="accordion" class:open={isOpen}>
	<button class="accordion-header" onclick={toggle}>
		<div class="header-content">
			<span class="accordion-icon">{isOpen ? '▼' : '▶'}</span>
			<div class="header-text">
				<span class="title">{title}</span>
				{#if subtitle}
					<span class="subtitle">{subtitle}</span>
				{/if}
			</div>
		</div>
		{#if badge}
			<div class="header-badge">
				{@render badge()}
			</div>
		{/if}
	</button>

	{#if isOpen}
		<div class="accordion-content">
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.accordion {
		border: 1px solid var(--color-gray-200);
		background: white;
		margin-bottom: 0.5rem;
	}

	.accordion-header {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		transition: background 0.15s ease;
	}

	.accordion-header:hover {
		background: var(--color-gray-50);
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.accordion-icon {
		font-size: 0.7rem;
		color: var(--color-gray-500);
		transition: transform 0.2s ease;
	}

	.header-text {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.title {
		font-weight: 600;
		color: var(--color-gray-800);
		font-size: 0.95rem;
	}

	.subtitle {
		font-size: 0.8rem;
		color: var(--color-gray-500);
	}

	.accordion-content {
		padding: 1rem 1.25rem;
		border-top: 1px solid var(--color-gray-100);
		background: var(--color-gray-50);
	}
</style>
