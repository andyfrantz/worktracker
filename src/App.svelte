<script lang="ts">
  import { onMount } from 'svelte';
  import { initializeApp } from './services';
  import HomeView from './views/HomeView.svelte';

  onMount(() => {
    void initializeApp();
  });
</script>

<HomeView />
