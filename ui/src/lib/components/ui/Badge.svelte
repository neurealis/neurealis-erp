<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'phase';
		phase?: number;
		size?: 'sm' | 'md';
		children: Snippet;
	}

	let { variant = 'default', phase, size = 'md', children }: Props = $props();

	// Phase-basierte Farben
	let phaseStyle = $derived(() => {
		if (variant !== 'phase' || phase === undefined) return '';
		return `background: var(--status-${phase}-bg); color: var(--status-${phase}-text);`;
	});
</script>

<span
	class="badge badge-{variant} badge-{size}"
	style={phaseStyle()}
>
	{@render children()}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		font-weight: 500;
		white-space: nowrap;
	}

	.badge-sm {
		font-size: 0.7rem;
		padding: 0.15rem 0.4rem;
	}

	.badge-md {
		font-size: 0.8rem;
		padding: 0.25rem 0.6rem;
	}

	/* Variants */
	.badge-default {
		background: var(--color-gray-100);
		color: var(--color-gray-700);
	}

	.badge-success {
		background: var(--color-success-light);
		color: var(--color-success-dark);
	}

	.badge-warning {
		background: var(--color-warning-light);
		color: var(--color-warning-dark);
	}

	.badge-error {
		background: var(--color-error-light);
		color: var(--color-error-dark);
	}

	.badge-info {
		background: var(--color-info-light);
		color: var(--color-info-dark);
	}

	/* Phase variant - Farben werden über style gesetzt */
	.badge-phase {
		/* Basis-Styling, Farben aus CSS-Variable */
	}
</style>
