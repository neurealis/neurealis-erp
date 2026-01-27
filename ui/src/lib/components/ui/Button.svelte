<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'sm' | 'md' | 'lg';
		loading?: boolean;
		fullWidth?: boolean;
		children: Snippet;
	}

	let {
		variant = 'primary',
		size = 'md',
		loading = false,
		fullWidth = false,
		children,
		disabled,
		...rest
	}: Props = $props();
</script>

<button
	class="btn btn-{variant} btn-{size}"
	class:loading
	class:full-width={fullWidth}
	disabled={disabled || loading}
	{...rest}
>
	{#if loading}
		<span class="spinner"></span>
	{/if}
	{@render children()}
</button>

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		font-family: inherit;
		font-weight: 600;
		border: none;
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn.full-width {
		width: 100%;
	}

	/* Sizes */
	.btn-sm {
		font-size: 0.8rem;
		padding: 0.4rem 0.75rem;
	}

	.btn-md {
		font-size: 0.9rem;
		padding: 0.6rem 1rem;
	}

	.btn-lg {
		font-size: 1rem;
		padding: 0.75rem 1.5rem;
	}

	/* Variants */
	.btn-primary {
		background: var(--color-brand-medium);
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--color-brand-dark);
	}

	.btn-secondary {
		background: white;
		color: var(--color-gray-700);
		border: 1px solid var(--color-gray-300);
	}

	.btn-secondary:hover:not(:disabled) {
		background: var(--color-gray-50);
		border-color: var(--color-gray-400);
	}

	.btn-ghost {
		background: transparent;
		color: var(--color-gray-600);
	}

	.btn-ghost:hover:not(:disabled) {
		background: var(--color-gray-100);
		color: var(--color-gray-800);
	}

	.btn-danger {
		background: var(--color-error);
		color: white;
	}

	.btn-danger:hover:not(:disabled) {
		background: var(--color-error-dark);
	}

	/* Loading spinner */
	.spinner {
		width: 1em;
		height: 1em;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
