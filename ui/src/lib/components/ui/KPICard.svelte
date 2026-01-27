<script lang="ts">
	interface Props {
		label: string;
		value: string | number;
		subvalue?: string;
		icon?: string;
		trend?: string;
		trendUp?: boolean;
		color?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
		href?: string;
	}

	let { label, value, subvalue, icon, trend, trendUp, color = 'blue', href }: Props = $props();
</script>

{#if href}
	<a {href} class="kpi-card kpi-{color}">
		<div class="kpi-content">
			{#if icon}
				<span class="kpi-icon">{icon}</span>
			{/if}
			<div class="kpi-data">
				<span class="kpi-value">{value}</span>
				<span class="kpi-label">{label}</span>
				{#if subvalue}
					<span class="kpi-subvalue">{subvalue}</span>
				{/if}
			</div>
		</div>
		{#if trend}
			<span class="kpi-trend" class:up={trendUp} class:down={!trendUp}>
				{trendUp ? '↑' : '↓'} {trend}
			</span>
		{/if}
	</a>
{:else}
	<div class="kpi-card kpi-{color}">
		<div class="kpi-content">
			{#if icon}
				<span class="kpi-icon">{icon}</span>
			{/if}
			<div class="kpi-data">
				<span class="kpi-value">{value}</span>
				<span class="kpi-label">{label}</span>
				{#if subvalue}
					<span class="kpi-subvalue">{subvalue}</span>
				{/if}
			</div>
		</div>
		{#if trend}
			<span class="kpi-trend" class:up={trendUp} class:down={!trendUp}>
				{trendUp ? '↑' : '↓'} {trend}
			</span>
		{/if}
	</div>
{/if}

<style>
	.kpi-card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.25rem;
		background: white;
		border: 1px solid var(--color-gray-200);
		text-decoration: none;
		transition: all 0.15s ease;
	}

	a.kpi-card:hover {
		border-color: var(--color-gray-300);
		transform: translateY(-2px);
		box-shadow: var(--shadow-md);
	}

	.kpi-content {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
	}

	.kpi-icon {
		font-size: 1.5rem;
		line-height: 1;
	}

	.kpi-data {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.kpi-value {
		font-size: 1.75rem;
		font-weight: 700;
		line-height: 1;
	}

	.kpi-label {
		font-size: 0.85rem;
		color: var(--color-gray-500);
	}

	.kpi-subvalue {
		font-size: 0.75rem;
		color: var(--color-gray-400);
		margin-top: 0.125rem;
	}

	.kpi-trend {
		font-size: 0.8rem;
		font-weight: 500;
	}

	.kpi-trend.up {
		color: var(--color-success);
	}

	.kpi-trend.down {
		color: var(--color-error);
	}

	/* Color variants */
	.kpi-blue .kpi-value {
		color: var(--color-primary-600);
	}

	.kpi-green .kpi-value {
		color: var(--color-success-dark);
	}

	.kpi-orange .kpi-value {
		color: var(--color-warning-dark);
	}

	.kpi-red .kpi-value {
		color: var(--color-error);
	}

	.kpi-purple .kpi-value {
		color: #7c3aed;
	}
</style>
