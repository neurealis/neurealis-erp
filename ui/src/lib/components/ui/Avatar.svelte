<script lang="ts">
	interface Props {
		name: string;
		size?: 'sm' | 'md' | 'lg' | 'xl';
		imageUrl?: string | null;
	}

	let { name, size = 'md', imageUrl }: Props = $props();

	// Initialen aus dem Namen generieren
	function getInitials(fullName: string): string {
		if (!fullName) return '?';
		const parts = fullName.trim().split(/\s+/);
		if (parts.length === 1) {
			return parts[0].substring(0, 2).toUpperCase();
		}
		return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
	}

	// Konsistente Farbe aus dem Namen generieren
	function getColorFromName(fullName: string): string {
		const colors = [
			'#C41E3A', // neurealis rot
			'#3B82F6', // blau
			'#10B981', // grün
			'#8B5CF6', // violett
			'#F59E0B', // orange
			'#EC4899', // pink
			'#06B6D4', // cyan
			'#6366F1', // indigo
			'#84CC16', // lime
			'#EF4444'  // rot
		];

		let hash = 0;
		for (let i = 0; i < fullName.length; i++) {
			hash = fullName.charCodeAt(i) + ((hash << 5) - hash);
		}

		return colors[Math.abs(hash) % colors.length];
	}

	let initials = $derived(getInitials(name));
	let bgColor = $derived(getColorFromName(name));
</script>

<div class="avatar avatar-{size}" style="--avatar-bg: {bgColor}">
	{#if imageUrl}
		<img src={imageUrl} alt={name} class="avatar-image" />
	{:else}
		<span class="avatar-initials">{initials}</span>
	{/if}
</div>

<style>
	.avatar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--avatar-bg, var(--color-gray-400));
		color: white;
		font-weight: 600;
		flex-shrink: 0;
		overflow: hidden;
	}

	.avatar-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar-initials {
		text-transform: uppercase;
	}

	/* Größen */
	.avatar-sm {
		width: 28px;
		height: 28px;
		font-size: 0.65rem;
	}

	.avatar-md {
		width: 36px;
		height: 36px;
		font-size: 0.8rem;
	}

	.avatar-lg {
		width: 48px;
		height: 48px;
		font-size: 1rem;
	}

	.avatar-xl {
		width: 64px;
		height: 64px;
		font-size: 1.25rem;
	}
</style>
