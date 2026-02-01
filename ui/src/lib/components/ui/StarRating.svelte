<script lang="ts">
	interface Props {
		value: number;
		max?: number;
		readonly?: boolean;
		size?: 'sm' | 'md' | 'lg';
		onchange?: (value: number) => void;
	}

	let { value = 0, max = 5, readonly = false, size = 'md', onchange }: Props = $props();

	function handleClick(starIndex: number) {
		if (readonly) return;
		const newValue = starIndex + 1;
		onchange?.(newValue);
	}

	function handleKeydown(event: KeyboardEvent, starIndex: number) {
		if (readonly) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleClick(starIndex);
		}
	}

	let stars = $derived(Array.from({ length: max }, (_, i) => i < value));
</script>

<div class="star-rating star-rating-{size}" class:readonly role={readonly ? 'img' : 'group'} aria-label="Bewertung: {value} von {max}">
	{#each stars as filled, index}
		{#if readonly}
			<span class="star" class:filled>&#9733;</span>
		{:else}
			<button
				type="button"
				class="star"
				class:filled
				onclick={() => handleClick(index)}
				onkeydown={(e) => handleKeydown(e, index)}
				aria-label="Bewertung {index + 1} von {max}"
			>
				&#9733;
			</button>
		{/if}
	{/each}
</div>

<style>
	.star-rating {
		display: inline-flex;
		gap: 0.125rem;
	}

	.star-rating.readonly {
		pointer-events: none;
	}

	.star {
		color: var(--color-gray-300);
		transition: color 0.15s ease, transform 0.1s ease;
		line-height: 1;
	}

	.star.filled {
		color: #f59e0b;
	}

	button.star {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	button.star:hover {
		transform: scale(1.1);
	}

	button.star:hover,
	button.star:focus {
		color: #f59e0b;
	}

	/* Größen */
	.star-rating-sm .star {
		font-size: 0.875rem;
	}

	.star-rating-md .star {
		font-size: 1.125rem;
	}

	.star-rating-lg .star {
		font-size: 1.5rem;
	}
</style>
