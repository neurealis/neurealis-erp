<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props<T> {
		items: T[];
		onReorder?: (items: T[]) => void;
		renderItem: Snippet<[T, number]>;
		itemKey?: (item: T) => string;
	}

	let {
		items = $bindable([]),
		onReorder,
		renderItem,
		itemKey = (item: any) => item.id ?? String(items.indexOf(item))
	}: Props<any> = $props();

	let draggedIndex = $state<number | null>(null);
	let dragOverIndex = $state<number | null>(null);

	// Touch state
	let touchStartY = $state(0);
	let touchCurrentY = $state(0);
	let isTouching = $state(false);
	let touchedElement = $state<HTMLElement | null>(null);

	function handleDragStart(e: DragEvent, index: number) {
		draggedIndex = index;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', String(index));
		}
		// Add dragging class after a small delay to prevent flicker
		setTimeout(() => {
			const target = e.target as HTMLElement;
			target.classList.add('dragging');
		}, 0);
	}

	function handleDragEnd(e: DragEvent) {
		const target = e.target as HTMLElement;
		target.classList.remove('dragging');
		draggedIndex = null;
		dragOverIndex = null;
	}

	function handleDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		dragOverIndex = index;
	}

	function handleDragLeave(e: DragEvent) {
		// Only clear if we're leaving the container
		const related = e.relatedTarget as HTMLElement;
		if (!related || !e.currentTarget || !(e.currentTarget as HTMLElement).contains(related)) {
			dragOverIndex = null;
		}
	}

	function handleDrop(e: DragEvent, index: number) {
		e.preventDefault();
		if (draggedIndex !== null && draggedIndex !== index) {
			const newItems = [...items];
			const [removed] = newItems.splice(draggedIndex, 1);
			newItems.splice(index, 0, removed);
			items = newItems;
			onReorder?.(newItems);
		}
		draggedIndex = null;
		dragOverIndex = null;
	}

	// Touch handlers for mobile support
	function handleTouchStart(e: TouchEvent, index: number) {
		const touch = e.touches[0];
		touchStartY = touch.clientY;
		touchCurrentY = touch.clientY;
		draggedIndex = index;
		isTouching = true;
		touchedElement = e.currentTarget as HTMLElement;
		touchedElement.classList.add('dragging');
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isTouching || draggedIndex === null) return;

		const touch = e.touches[0];
		touchCurrentY = touch.clientY;

		// Find element under touch point
		const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
		const listItem = elements.find(el => el.classList.contains('draggable-item'));

		if (listItem) {
			const index = parseInt(listItem.getAttribute('data-index') || '-1');
			if (index >= 0 && index !== draggedIndex) {
				dragOverIndex = index;
			}
		}

		// Prevent page scroll while dragging
		e.preventDefault();
	}

	function handleTouchEnd(e: TouchEvent) {
		if (!isTouching || draggedIndex === null) return;

		if (dragOverIndex !== null && draggedIndex !== dragOverIndex) {
			const newItems = [...items];
			const [removed] = newItems.splice(draggedIndex, 1);
			newItems.splice(dragOverIndex, 0, removed);
			items = newItems;
			onReorder?.(newItems);
		}

		if (touchedElement) {
			touchedElement.classList.remove('dragging');
		}

		draggedIndex = null;
		dragOverIndex = null;
		isTouching = false;
		touchedElement = null;
	}
</script>

<div
	class="draggable-list"
	role="list"
	ontouchmove={handleTouchMove}
	ontouchend={handleTouchEnd}
>
	{#each items as item, index (itemKey(item))}
		<div
			class="draggable-item"
			class:drag-over={dragOverIndex === index && draggedIndex !== index}
			class:is-dragged={draggedIndex === index}
			data-index={index}
			draggable="true"
			role="listitem"
			ondragstart={(e) => handleDragStart(e, index)}
			ondragend={handleDragEnd}
			ondragover={(e) => handleDragOver(e, index)}
			ondragleave={handleDragLeave}
			ondrop={(e) => handleDrop(e, index)}
			ontouchstart={(e) => handleTouchStart(e, index)}
		>
			{@render renderItem(item, index)}
		</div>
	{/each}
</div>

<style>
	.draggable-list {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.draggable-item {
		transition: transform 0.15s ease, opacity 0.15s ease, background 0.15s ease;
		position: relative;
		touch-action: none;
	}

	.draggable-item.dragging,
	.draggable-item.is-dragged {
		opacity: 0.5;
		background: var(--color-gray-100);
	}

	.draggable-item.drag-over {
		border-top: 2px solid var(--color-primary, #C41E3A);
		background: rgba(196, 30, 58, 0.05);
	}

	.draggable-item.drag-over::before {
		content: '';
		position: absolute;
		top: -2px;
		left: 0;
		right: 0;
		height: 2px;
		background: var(--color-primary, #C41E3A);
	}

	/* Global dragging styles */
	:global(.draggable-item.dragging) {
		opacity: 0.5;
	}
</style>
