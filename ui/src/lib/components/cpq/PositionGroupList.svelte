<script lang="ts">
	import DraggableList from './DraggableList.svelte';
	import PositionGroup from './PositionGroup.svelte';
	import type { Position, PositionGroupData } from './types';

	interface Props {
		groups: PositionGroupData[];
		onGroupsChange?: (groups: PositionGroupData[]) => void;
		onGroupAdd?: () => void;
		onGroupCopy?: (groupId: string) => void;
		onGroupDelete?: (groupId: string) => void;
		onGroupRename?: (groupId: string, name: string) => void;
		onPositionEdit?: (groupId: string, position: Position) => void;
		onPositionDelete?: (groupId: string, positionId: string) => void;
		onPositionMengeChange?: (groupId: string, positionId: string, menge: number) => void;
		readonly?: boolean;
		showAddButton?: boolean;
	}

	let {
		groups = $bindable([]),
		onGroupsChange,
		onGroupAdd,
		onGroupCopy,
		onGroupDelete,
		onGroupRename,
		onPositionEdit,
		onPositionDelete,
		onPositionMengeChange,
		readonly = false,
		showAddButton = true
	}: Props = $props();

	// Expanded state pro Gruppe
	let expandedStates = $state<Record<string, boolean>>({});

	// Gesamtsumme
	let gesamtsumme = $derived(
		groups.reduce((total, group) => {
			return total + group.positionen.reduce((sum, p) => sum + (p.menge * p.einzelpreis), 0);
		}, 0)
	);

	// Gesamtanzahl Positionen
	let gesamtPositionen = $derived(
		groups.reduce((total, group) => total + group.positionen.length, 0)
	);

	function handleGroupsReorder(newGroups: PositionGroupData[]) {
		groups = newGroups;
		onGroupsChange?.(newGroups);
	}

	function handlePositionMove(groupId: string, newOrder: Position[]) {
		const groupIndex = groups.findIndex(g => g.id === groupId);
		if (groupIndex >= 0) {
			groups[groupIndex].positionen = newOrder;
			groups = [...groups]; // Trigger reactivity
			onGroupsChange?.(groups);
		}
	}

	function addGroup() {
		if (onGroupAdd) {
			onGroupAdd();
		} else {
			// Default: Neue leere Gruppe erstellen
			const newGroup: PositionGroupData = {
				id: crypto.randomUUID(),
				name: 'Neue Gruppe',
				positionen: []
			};
			groups = [...groups, newGroup];
			expandedStates[newGroup.id] = true;
			onGroupsChange?.(groups);
		}
	}

	function copyGroup(groupId: string) {
		if (onGroupCopy) {
			onGroupCopy(groupId);
		} else {
			// Default: Gruppe kopieren
			const group = groups.find(g => g.id === groupId);
			if (group) {
				const copy: PositionGroupData = {
					id: crypto.randomUUID(),
					name: group.name + ' (Kopie)',
					positionen: group.positionen.map(p => ({
						...p,
						id: crypto.randomUUID()
					}))
				};
				groups = [...groups, copy];
				expandedStates[copy.id] = true;
				onGroupsChange?.(groups);
			}
		}
	}

	function deleteGroup(groupId: string) {
		if (onGroupDelete) {
			onGroupDelete(groupId);
		} else {
			// Default: Gruppe löschen
			groups = groups.filter(g => g.id !== groupId);
			delete expandedStates[groupId];
			onGroupsChange?.(groups);
		}
	}

	function renameGroup(groupId: string, name: string) {
		if (onGroupRename) {
			onGroupRename(groupId, name);
		} else {
			// Default: Gruppe umbenennen
			const groupIndex = groups.findIndex(g => g.id === groupId);
			if (groupIndex >= 0) {
				groups[groupIndex].name = name;
				groups = [...groups]; // Trigger reactivity
				onGroupsChange?.(groups);
			}
		}
	}

	function toggleGroup(groupId: string) {
		expandedStates[groupId] = !expandedStates[groupId];
	}

	function isExpanded(groupId: string): boolean {
		return expandedStates[groupId] !== false; // Default true
	}

	function expandAll() {
		groups.forEach(g => {
			expandedStates[g.id] = true;
		});
	}

	function collapseAll() {
		groups.forEach(g => {
			expandedStates[g.id] = false;
		});
	}

	function formatCurrency(value: number): string {
		return value.toLocaleString('de-DE', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
	}
</script>

<div class="position-group-list">
	<!-- Toolbar -->
	<div class="toolbar">
		<div class="toolbar-info">
			<span class="info-text">{groups.length} Gewerke, {gesamtPositionen} Positionen</span>
		</div>
		<div class="toolbar-actions">
			<button class="toolbar-btn" onclick={expandAll} title="Alle aufklappen">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M6 9l6 6 6-6"/>
				</svg>
				Alle aufklappen
			</button>
			<button class="toolbar-btn" onclick={collapseAll} title="Alle zuklappen">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M9 18l6-6-6-6"/>
				</svg>
				Alle zuklappen
			</button>
		</div>
	</div>

	<!-- Groups -->
	{#if groups.length > 0}
		<DraggableList
			bind:items={groups}
			onReorder={handleGroupsReorder}
			itemKey={(g) => g.id}
		>
			{#snippet renderItem(group, index)}
				<PositionGroup
					{group}
					expanded={expandedStates[group.id] ?? true}
					{readonly}
					onToggle={() => toggleGroup(group.id)}
					onCopy={() => copyGroup(group.id)}
					onDelete={() => deleteGroup(group.id)}
					onRename={(name) => renameGroup(group.id, name)}
					onPositionMove={handlePositionMove}
					onPositionEdit={onPositionEdit ? (p) => onPositionEdit?.(group.id, p) : undefined}
					onPositionDelete={onPositionDelete ? (pId) => onPositionDelete?.(group.id, pId) : undefined}
					onPositionMengeChange={onPositionMengeChange ? (pId, m) => onPositionMengeChange?.(group.id, pId, m) : undefined}
				/>
			{/snippet}
		</DraggableList>
	{:else}
		<div class="empty-state">
			<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
			</svg>
			<p>Noch keine Gewerke vorhanden</p>
			<p class="hint">Fugen Sie ein Gewerk hinzu, um Positionen zu erstellen</p>
		</div>
	{/if}

	<!-- Add Button -->
	{#if showAddButton && !readonly}
		<button class="add-group-btn" onclick={addGroup}>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="12" y1="5" x2="12" y2="19"/>
				<line x1="5" y1="12" x2="19" y2="12"/>
			</svg>
			Neues Gewerk hinzufugen
		</button>
	{/if}

	<!-- Footer mit Gesamtsumme -->
	{#if groups.length > 0}
		<div class="footer">
			<div class="footer-label">Gesamtsumme (netto)</div>
			<div class="footer-value">{formatCurrency(gesamtsumme)} EUR</div>
		</div>
	{/if}
</div>

<style>
	.position-group-list {
		display: flex;
		flex-direction: column;
	}

	.toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		background: var(--color-gray-50);
		border: 1px solid var(--color-gray-200);
		margin-bottom: 0.75rem;
	}

	.toolbar-info {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.info-text {
		font-size: 0.875rem;
		color: var(--color-gray-600);
	}

	.toolbar-actions {
		display: flex;
		gap: 0.5rem;
	}

	.toolbar-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		font-size: 0.8rem;
		color: var(--color-gray-600);
		background: white;
		border: 1px solid var(--color-gray-300);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.toolbar-btn:hover {
		background: var(--color-gray-50);
		border-color: var(--color-gray-400);
		color: var(--color-gray-700);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem 2rem;
		color: var(--color-gray-500);
		text-align: center;
		border: 2px dashed var(--color-gray-200);
		background: var(--color-gray-50);
	}

	.empty-state svg {
		margin-bottom: 1rem;
		color: var(--color-gray-400);
	}

	.empty-state p {
		margin: 0;
		font-size: 0.95rem;
	}

	.empty-state .hint {
		margin-top: 0.5rem;
		font-size: 0.8rem;
		color: var(--color-gray-400);
	}

	.add-group-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		padding: 1rem;
		margin-top: 0.5rem;
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--color-primary, #C41E3A);
		background: var(--color-primary-50, #FFF5F5);
		border: 2px dashed var(--color-primary-200, #FFCCD2);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.add-group-btn:hover {
		background: var(--color-primary-100, #FFE5E8);
		border-color: var(--color-primary-300);
	}

	.footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.25rem;
		margin-top: 0.75rem;
		background: var(--color-gray-800);
		color: white;
	}

	.footer-label {
		font-size: 0.9rem;
		font-weight: 500;
	}

	.footer-value {
		font-size: 1.25rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	/* Mobile */
	@media (max-width: 768px) {
		.toolbar {
			flex-direction: column;
			gap: 0.75rem;
			align-items: stretch;
		}

		.toolbar-info {
			justify-content: center;
		}

		.toolbar-actions {
			justify-content: center;
		}

		.footer {
			flex-direction: column;
			gap: 0.25rem;
			text-align: center;
		}
	}
</style>
