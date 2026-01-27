<script lang="ts">
	import Sidebar from './Sidebar.svelte';
	import Header from './Header.svelte';
	import BottomNav from './BottomNav.svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		user?: { email: string; name?: string; role?: string } | null;
		children: Snippet;
	}

	let { user, children }: Props = $props();

	let sidebarCollapsed = $state(false);
	let mobileMenuOpen = $state(false);

	function toggleSidebar() {
		sidebarCollapsed = !sidebarCollapsed;
	}

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}

	let userRole = $derived(user?.role || 'mitarbeiter');
	let userName = $derived(user?.name);
	let userEmail = $derived(user?.email);
</script>

<div class="app-shell" class:sidebar-collapsed={sidebarCollapsed}>
	<!-- Sidebar (Desktop) -->
	<Sidebar
		{userRole}
		{userName}
		{userEmail}
		isCollapsed={sidebarCollapsed}
		onToggle={toggleSidebar}
	/>

	<!-- Mobile Sidebar Overlay -->
	{#if mobileMenuOpen}
		<button class="mobile-overlay" onclick={closeMobileMenu} aria-label="Menü schließen"></button>
		<div class="mobile-sidebar">
			<Sidebar
				{userRole}
				{userName}
				{userEmail}
				isCollapsed={false}
				onToggle={closeMobileMenu}
			/>
		</div>
	{/if}

	<!-- Header -->
	<Header
		{user}
		sidebarCollapsed={sidebarCollapsed}
		onMenuToggle={toggleMobileMenu}
	/>

	<!-- Main Content -->
	<main class="main-content">
		{@render children()}
	</main>

	<!-- Bottom Navigation (Mobile) -->
	<BottomNav {userRole} />
</div>

<style>
	.app-shell {
		min-height: 100vh;
	}

	.main-content {
		margin-left: var(--sidebar-width);
		margin-top: var(--header-height);
		padding: 1.5rem;
		min-height: calc(100vh - var(--header-height));
		background: var(--color-gray-50);
		transition: margin-left 0.2s ease;
	}

	.app-shell.sidebar-collapsed .main-content {
		margin-left: var(--sidebar-width-collapsed);
	}

	/* Mobile */
	@media (max-width: 1024px) {
		.main-content {
			margin-left: 0;
			padding-bottom: calc(var(--bottom-nav-height) + 1.5rem);
		}

		.app-shell.sidebar-collapsed .main-content {
			margin-left: 0;
		}
	}

	/* Mobile Overlay */
	.mobile-overlay {
		display: none;
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 60;
		border: none;
		cursor: pointer;
	}

	.mobile-sidebar {
		display: none;
		position: fixed;
		left: 0;
		top: 0;
		z-index: 70;
	}

	@media (max-width: 1024px) {
		.mobile-overlay {
			display: block;
		}

		.mobile-sidebar {
			display: block;
		}

		.mobile-sidebar :global(.sidebar) {
			transform: translateX(0);
		}
	}
</style>
