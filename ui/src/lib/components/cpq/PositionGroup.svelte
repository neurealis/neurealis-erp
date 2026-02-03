<script lang="ts">
	import type { Snippet } from 'svelte';
	import DraggableList from './DraggableList.svelte';
	import PositionItem from './PositionItem.svelte';
	import type { Position, PositionGroupData } from './types';

	interface Props {
		group: PositionGroupData;
		expanded?: boolean;
		onToggle?: () => void;
		onCopy?: () => void;
		onDelete?: () => void;
		onRename?: (name: string) => void;
		onPositionMove?: (groupId: string, newOrder: Position[]) => void;
		onPositionEdit?: (position: Position) => void;
		onPositionDelete?: (positionId: string) => void;
		onPositionMengeChange?: (positionId: string, menge: number) => void;
		readonly?: boolean;
		dragHandle?: Snippet;
	}

	let {
		group = $bindable(),
		expanded = $bindable(true),
		onToggle,
		onCopy,
		onDelete,
		onRename,
		onPositionMove,
		onPositionEdit,
		onPositionDelete,
		onPositionMengeChange,
		readonly = false,
		dragHandle
	}: Props = $props();

	let isRenaming = $state(false);
	let renameInput = $state(group.name);
	let inputRef = $state<HTMLInputElement | null>(null);

	// Berechnete Summe
	let summe = $derived(
		group.positionen.reduce((sum, p) => sum + (p.menge * p.einzelpreis), 0)
	);

	function toggleExpanded() {
		expanded = !expanded;
		onToggle?.();
	}

	function startRename(e: MouseEvent) {
		e.stopPropagation();
		renameInput = group.name;
		isRenaming = true;
		setTimeout(() => {
			inputRef?.focus();
			inputRef?.select();
		}, 0);
	}

	function saveRename() {
		if (renameInput.trim() && renameInput !== group.name) {
			onRename?.(renameInput.trim());
		}
		isRenaming = false;
	}

	function handleRenameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			saveRename();
		} else if (e.key === 'Escape') {
			renameInput = group.name;
			isRenaming = false;
		}
	}

	function handlePositionReorder(newOrder: Position[]) {
		onPositionMove?.(group.id, newOrder);
	}

	function formatCurrency(value: number): string {
		return value.toLocaleString('de-DE', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
	}
</script>

<div class="position-group" class:expanded class:readonly>
	<!-- Header -->
	<div class="group-header" role="button" tabindex="0" onclick={toggleExpanded} onkeydown={(e) => e.key === 'Enter' && toggleExpanded()}>
		<!-- Drag Handle (von DraggableList durchgereicht) -->
		{#if dragHandle && !readonly}
			<span class="drag-handle-slot">
				{@render dragHandle()}
			</span>
		{:else if !readonly}
			<span class="drag-handle" title="Gruppe ziehen">
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

		<!-- Expand Icon -->
		<span class="expand-icon">
			{#if expanded}
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M6 9l6 6 6-6"/>
				</svg>
			{:else}
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M9 18l6-6-6-6"/>
				</svg>
			{/if}
		</span>

		<!-- Group Name -->
		<div class="group-info">
			{#if isRenaming}
				<input
					bind:this={inputRef}
					type="text"
					class="rename-input"
					bind:value={renameInput}
					onblur={saveRename}
					onkeydown={handleRenameKeydown}
					onclick={(e) => e.stopPropagation()}
				/>
			{:else}
				<span class="group-name">{group.name}</span>
			{/if}
		</div>

		<!-- Count Badge -->
		<span class="group-count">
			{group.positionen.length} {group.positionen.length === 1 ? 'Position' : 'Positionen'}
		</span>

		<!-- Sum -->
		<span class="group-summe">
			{formatCurrency(summe)} EUR
		</span>

		<!-- Actions -->
		{#if !readonly}
			<div class="group-actions">
				{#if onRename}
					<button
						class="action-btn"
						onclick={startRename}
						title="Umbenennen"
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
							<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
						</svg>
					</button>
				{/if}
				{#if onCopy}
					<button
						class="action-btn"
						onclick={(e) => { e.stopPropagation(); onCopy?.(); }}
						title="Gruppe kopieren"
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<rect x="9" y="9" width="13" height="13" rx="2"/>
							<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
						</svg>
					</button>
				{/if}
				{#if onDelete}
					<button
						class="action-btn delete"
						onclick={(e) => { e.stopPropagation(); onDelete?.(); }}
						title="Gruppe löschen"
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M3 6h18"/>
							<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
							<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
						</svg>
					</button>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Body (Positionen) -->
	{#if expanded}
		<div class="group-body">
			{#if group.positionen.length > 0}
				<!-- Table Header -->
				<div class="positions-header" class:readonly>
					{#if !readonly}<span></span>{/if}
					<span>Artikelnr.</span>
					<span>Bezeichnung</span>
					<span class="text-right">Menge</span>
					<span class="text-right">EP</span>
					<span class="text-right">Gesamt</span>
					{#if !readonly}<span></span>{/if}
				</div>

				<DraggableList
					items={group.positionen}
					onReorder={handlePositionReorder}
					itemKey={(p) => p.id}
				>
					{#snippet renderItem(position, index)}
						<PositionItem
							{position}
							{readonly}
							onEdit={onPositionEdit ? () => onPositionEdit?.(position) : undefined}
							onDelete={onPositionDelete ? () => onPositionDelete?.(position.id) : undefined}
							onMengeChange={onPositionMengeChange ? (m) => onPositionMengeChange?.(position.id, m) : undefined}
						/>
					{/snippet}
				</DraggableList>
			{:else}
				<div class="empty-state">
					Keine Positionen vorhanden
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.position-group {
		background: white;
		border: 1px solid var(--color-gray-200);
		margin-bottom: 0.75rem;
		overflow: hidden;
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.875rem 1rem;
		background: var(--color-gray-50);
		cursor: pointer;
		user-select: none;
		transition: background 0.15s ease;
	}

	.group-header:hover {
		background: var(--color-gray-100);
	}

	.drag-handle,
	.drag-handle-slot {
		cursor: grab;
		color: var(--color-gray-400);
		padding: 0.25rem;
		display: flex;
		align-items: center;
		transition: color 0.15s ease;
	}

	.drag-handle:hover,
	.drag-handle-slot:hover {
		color: var(--color-gray-600);
	}

	.drag-handle:active,
	.drag-handle-slot:active {
		cursor: grabbing;
		color: var(--color-primary);
	}

	.expand-icon {
		display: flex;
		align-items: center;
		color: var(--color-gray-500);
		transition: transform 0.2s ease;
	}

	.group-info {
		flex: 1;
		min-width: 0;
	}

	.group-name {
		font-weight: 600;
		color: var(--color-gray-800);
		font-size: 0.95rem;
	}

	.rename-input {
		font-size: 0.95rem;
		font-weight: 600;
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--color-primary);
		outline: none;
		width: 200px;
	}

	.group-count {
		font-size: 0.8rem;
		color: var(--color-gray-500);
		padding: 0.25rem 0.5rem;
		background: var(--color-gray-200);
	}

	.group-summe {
		font-weight: 600;
		color: var(--color-gray-800);
		font-size: 0.9rem;
		min-width: 100px;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.group-actions {
		display: flex;
		gap: 0.25rem;
		margin-left: 0.5rem;
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
		background: white;
		color: var(--color-gray-700);
	}

	.action-btn.delete:hover {
		background: var(--color-error-light);
		color: var(--color-error);
	}

	.group-body {
		border-top: 1px solid var(--color-gray-200);
	}

	.positions-header {
		display: grid;
		grid-template-columns: auto minmax(80px, 120px) 1fr minmax(80px, 100px) minmax(80px, 100px) minmax(80px, 110px) auto;
		gap: 0.75rem;
		padding: 0.5rem 1rem;
		background: var(--color-gray-100);
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-gray-600);
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.positions-header.readonly {
		grid-template-columns: minmax(80px, 120px) 1fr minmax(80px, 100px) minmax(80px, 100px) minmax(80px, 110px);
	}

	.positions-header .text-right {
		text-align: right;
	}

	.empty-state {
		padding: 2rem;
		text-align: center;
		color: var(--color-gray-500);
		font-size: 0.875rem;
	}

	/* Mobile */
	@media (max-width: 768px) {
		.group-header {
			flex-wrap: wrap;
			gap: 0.5rem;
		}

		.group-count {
			display: none;
		}

		.group-summe {
			margin-left: auto;
		}

		.positions-header {
			display: none;
		}
	}
</style>
