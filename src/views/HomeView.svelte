<script lang="ts">
  import { formatAppName } from '../domain/format';

  const appName = formatAppName();
</script>

<main class="home">
  <h1>{appName}</h1>
  <p>Local-first workday companion</p>
</main>

<style>
  .home {
    margin: 0 auto;
    max-width: 40rem;
    padding: 2rem 1.5rem;
  }

  h1 {
    margin: 0 0 0.5rem;
    font-size: 2rem;
    font-weight: 600;
  }

  p {
    margin: 0;
    color: #4a5568;
  }
</style>
