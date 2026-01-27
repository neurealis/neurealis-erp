<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		padding?: 'none' | 'sm' | 'md' | 'lg';
		children: Snippet;
		header?: Snippet;
		footer?: Snippet;
	}

	let { padding = 'md', children, header, footer }: Props = $props();
</script>

<div class="card">
	{#if header}
		<div class="card-header">
			{@render header()}
		</div>
	{/if}

	<div class="card-body padding-{padding}">
		{@render children()}
	</div>

	{#if footer}
		<div class="card-footer">
			{@render footer()}
		</div>
	{/if}
</div>

<style>
	.card {
		background: white;
		border: 1px solid var(--color-gray-200);
		overflow: hidden;
	}

	.card-header {
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--color-gray-100);
		font-weight: 600;
	}

	.card-body.padding-none {
		padding: 0;
	}

	.card-body.padding-sm {
		padding: 0.75rem;
	}

	.card-body.padding-md {
		padding: 1.25rem;
	}

	.card-body.padding-lg {
		padding: 1.5rem;
	}

	.card-footer {
		padding: 1rem 1.25rem;
		border-top: 1px solid var(--color-gray-100);
		background: var(--color-gray-50);
	}
</style>
