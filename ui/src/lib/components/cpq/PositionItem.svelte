<script lang="ts">
	import type { Position } from './types';

	interface Props {
		position: Position;
		onEdit?: (position: Position) => void;
		onDelete?: () => void;
		onMengeChange?: (menge: number) => void;
		readonly?: boolean;
	}

	let {
		position,
		onEdit,
		onDelete,
		onMengeChange,
		readonly = false
	}: Props = $props();

	let editingMenge = $state(false);
	let mengeInput = $state(position.menge);
	let inputRef = $state<HTMLInputElement | null>(null);

	// Gesamtpreis berechnet
	let gesamtpreis = $derived(position.menge * position.einzelpreis);

	function startEditMenge() {
		if (readonly) return;
		mengeInput = position.menge;
		editingMenge = true;
		// Focus nach render
		setTimeout(() => inputRef?.focus(), 0);
	}

	function saveMenge() {
		if (mengeInput !== position.menge && mengeInput > 0) {
			onMengeChange?.(mengeInput);
		}
		editingMenge = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			saveMenge();
		} else if (e.key === 'Escape') {
			mengeInput = position.menge;
			editingMenge = false;
		}
	}

	function formatCurrency(value: number): string {
		return value.toLocaleString('de-DE', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
	}
</script>

<div class="position-item" class:readonly>
	<!-- Drag Handle -->
	{#if !readonly}
		<span class="drag-handle" title="Ziehen zum Sortieren">
			<svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
				<circle cx="3" cy="2" r="1.5"/>
				<circle cx="9" cy="2" r="1.5"/>
				<circle cx="3" cy="8" r="1.5"/>
				<circle cx="9" cy="8" r="1.5"/>
				<circle cx="3" cy="14" r="1.5"/>
				<circle cx="9" cy="14" r="1.5"/>
			</svg>
		</span>
	{/if}

	<!-- Artikelnummer -->
	<span class="artikelnummer" title={position.artikelnummer}>
		{position.artikelnummer}
	</span>

	<!-- Bezeichnung -->
	<span class="bezeichnung" title={position.bezeichnung}>
		{position.bezeichnung}
	</span>

	<!-- Menge (editierbar) -->
	<span class="menge-wrapper">
		{#if editingMenge}
			<input
				bind:this={inputRef}
				type="number"
				class="menge-input"
				bind:value={mengeInput}
				onblur={saveMenge}
				onkeydown={handleKeydown}
				min="0.01"
				step="0.01"
			/>
		{:else}
			<span
				class="menge"
				class:editable={!readonly}
				ondblclick={startEditMenge}
				title={readonly ? '' : 'Doppelklick zum Bearbeiten'}
			>
				{formatCurrency(position.menge)}
			</span>
		{/if}
		<span class="einheit">{position.einheit}</span>
	</span>

	<!-- Einzelpreis -->
	<span class="einzelpreis">
		{formatCurrency(position.einzelpreis)} EUR
	</span>

	<!-- Gesamtpreis -->
	<span class="gesamtpreis">
		{formatCurrency(gesamtpreis)} EUR
	</span>

	<!-- Actions -->
	{#if !readonly}
		<div class="actions">
			{#if onEdit}
				<button
					class="action-btn edit"
					onclick={() => onEdit?.(position)}
					title="Bearbeiten"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
					</svg>
				</button>
			{/if}
			{#if onDelete}
				<button
					class="action-btn delete"
					onclick={() => onDelete?.()}
					title="Entfernen"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"/>
						<line x1="6" y1="6" x2="18" y2="18"/>
					</svg>
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.position-item {
		display: grid;
		grid-template-columns: auto minmax(80px, 120px) 1fr minmax(80px, 100px) minmax(80px, 100px) minmax(80px, 110px) auto;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: white;
		border-bottom: 1px solid var(--color-gray-100);
		font-size: 0.875rem;
		transition: background 0.15s ease;
	}

	.position-item:hover {
		background: var(--color-gray-50);
	}

	.position-item.readonly {
		grid-template-columns: minmax(80px, 120px) 1fr minmax(80px, 100px) minmax(80px, 100px) minmax(80px, 110px);
	}

	.drag-handle {
		cursor: grab;
		color: var(--color-gray-400);
		padding: 0.25rem;
		display: flex;
		align-items: center;
		user-select: none;
		transition: color 0.15s ease;
	}

	.drag-handle:hover {
		color: var(--color-gray-600);
	}

	.drag-handle:active {
		cursor: grabbing;
		color: var(--color-primary);
	}

	.artikelnummer {
		font-family: var(--font-family-mono, monospace);
		font-size: 0.75rem;
		color: var(--color-gray-500);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.bezeichnung {
		font-weight: 500;
		color: var(--color-gray-800);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.menge-wrapper {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.menge {
		text-align: right;
		min-width: 50px;
		padding: 0.125rem 0.25rem;
	}

	.menge.editable {
		cursor: pointer;
		border-bottom: 1px dashed var(--color-gray-300);
	}

	.menge.editable:hover {
		background: var(--color-primary-50, #FFF5F5);
		border-color: var(--color-primary);
	}

	.menge-input {
		width: 60px;
		padding: 0.25rem;
		border: 1px solid var(--color-primary);
		font-size: 0.875rem;
		text-align: right;
		outline: none;
	}

	.einheit {
		color: var(--color-gray-500);
		font-size: 0.75rem;
		min-width: 30px;
	}

	.einzelpreis,
	.gesamtpreis {
		text-align: right;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.gesamtpreis {
		font-weight: 600;
		color: var(--color-gray-800);
	}

	.actions {
		display: flex;
		gap: 0.25rem;
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.position-item:hover .actions {
		opacity: 1;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		background: transparent;
		color: var(--color-gray-500);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.action-btn:hover {
		background: var(--color-gray-100);
		color: var(--color-gray-700);
	}

	.action-btn.delete:hover {
		background: var(--color-error-light);
		color: var(--color-error);
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.position-item {
			grid-template-columns: auto 1fr auto;
			grid-template-rows: auto auto;
			gap: 0.5rem;
			padding: 0.75rem;
		}

		.position-item.readonly {
			grid-template-columns: 1fr auto;
		}

		.drag-handle {
			grid-row: span 2;
		}

		.artikelnummer {
			display: none;
		}

		.bezeichnung {
			grid-column: 2;
		}

		.menge-wrapper,
		.einzelpreis {
			display: none;
		}

		.gesamtpreis {
			grid-column: 2;
			grid-row: 2;
			justify-self: start;
			font-size: 0.8rem;
		}

		.actions {
			grid-row: span 2;
			opacity: 1;
		}
	}
</style>
