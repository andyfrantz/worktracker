<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import {
    formatClockTime,
    formatDuration,
    formatWorkdayStatus,
    HISTORICAL_START_PRESET_MINUTES,
    parseTimeInputValue,
    startedAtMinutesAgo,
    type WorkdaySummary,
  } from '../domain';
  import {
    initializeApp,
    loadWorkdaySummary,
    runWorkdayAction,
    startWorkAt,
    type WorkdayAction,
  } from '../services';

  let ready = $state(false);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let summary = $state<WorkdaySummary | null>(null);
  let actionPending = $state(false);
  let exactStartTime = $state('');

  let refreshTimer: ReturnType<typeof setInterval> | undefined;

  async function refresh(now = Date.now()) {
    summary = await loadWorkdaySummary(now);
  }

  async function handleAction(action: WorkdayAction) {
    actionPending = true;
    error = null;

    try {
      await runWorkdayAction(action);
      await refresh();
    } catch (caught) {
      error = caught instanceof Error ? caught.message : 'Something went wrong.';
    } finally {
      actionPending = false;
    }
  }

  async function handleStartAt(startedAt: number) {
    actionPending = true;
    error = null;

    try {
      await startWorkAt(startedAt);
      exactStartTime = '';
      await refresh();
    } catch (caught) {
      error = caught instanceof Error ? caught.message : 'Something went wrong.';
    } finally {
      actionPending = false;
    }
  }

  async function handlePresetStart(minutesAgo: number) {
    await handleStartAt(startedAtMinutesAgo(Date.now(), minutesAgo));
  }

  async function handleExactStart() {
    const startedAt = parseTimeInputValue(Date.now(), exactStartTime);
    if (startedAt === null) {
      error = 'Choose a time earlier today.';
      return;
    }

    await handleStartAt(startedAt);
  }

  const statusLabel = $derived(summary ? formatWorkdayStatus(summary.status) : '');
  const workedLabel = $derived(summary ? formatDuration(summary.workedMs) : '--');
  const remainingLabel = $derived.by(() => {
    if (!summary?.targetProgress.hasTarget) {
      return 'No daily target';
    }

    if (summary.targetProgress.targetReached) {
      return `Overtime ${formatDuration(summary.targetProgress.overtimeMs)}`;
    }

    return formatDuration(summary.targetProgress.remainingMs);
  });
  const finishLabel = $derived.by(() => {
    if (!summary?.context.expectedFinishEnabled) {
      return 'Expected finish not enabled';
    }

    if (!summary.targetProgress.hasTarget) {
      return 'No target configured';
    }

    if (summary.targetProgress.targetReached) {
      return 'Target reached';
    }

    return summary.expectedFinish ? formatClockTime(summary.expectedFinish) : '--';
  });
  const progressPercent = $derived.by(() => {
    if (!summary?.progressRatio) {
      return 0;
    }

    return Math.min(summary.progressRatio, 1) * 100;
  });
  const showOvertimeProgress = $derived(
    summary?.targetProgress.hasTarget === true && summary.targetProgress.targetReached === true,
  );

  onMount(async () => {
    try {
      await initializeApp();
      await refresh();
      ready = true;
      refreshTimer = setInterval(() => {
        void refresh();
      }, 1000);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : 'Unable to start WorkTrack.';
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }
  });
</script>

<main class="workday-screen">
  {#if loading}
    <p class="loading" role="status">Loading your workday…</p>
  {:else if !ready || !summary}
    <p class="error" role="alert">{error ?? 'Work context is not available yet.'}</p>
  {:else}
    <header class="screen-header">
      <div>
        <p class="eyebrow">Today</p>
        <h1>{summary.context.name}</h1>
      </div>
      <p class="status-badge" aria-live="polite">{statusLabel}</p>
    </header>

    <section class="hero" aria-labelledby="worked-heading">
      <div class="hero-primary">
        <h2 id="worked-heading">Worked</h2>
        <p class="hero-value" aria-live="polite">{workedLabel}</p>
      </div>
      <div class="hero-secondary">
        <h2 id="remaining-heading">
          {summary.targetProgress.hasTarget && summary.targetProgress.targetReached
            ? 'Overtime'
            : 'Remaining'}
        </h2>
        <p class="hero-value secondary" aria-live="polite">{remainingLabel}</p>
      </div>
      <div class="hero-secondary">
        <h2 id="finish-heading">Expected finish</h2>
        <p class="hero-value secondary" aria-live="polite">{finishLabel}</p>
      </div>
    </section>

    {#if summary.targetProgress.hasTarget}
      <section class="progress-section" aria-labelledby="progress-heading">
        <div class="progress-header">
          <h2 id="progress-heading">Daily progress</h2>
          <span>{Math.round((summary.progressRatio ?? 0) * 100)}%</span>
        </div>
        <div
          class="progress-track"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax={100}
          aria-valuenow={Math.round((summary.progressRatio ?? 0) * 100)}
          aria-labelledby="progress-heading"
        >
          <div
            class="progress-fill"
            class:overtime={showOvertimeProgress}
            style={`width: ${progressPercent}%`}
          ></div>
        </div>
      </section>
    {/if}

    <section class="actions" aria-label="Workday controls">
      {#if summary.status === 'idle'}
        <button type="button" disabled={actionPending} onclick={() => handleAction('start')}>
          Start now
        </button>

        <div class="started-earlier" aria-labelledby="started-earlier-heading">
          <p id="started-earlier-heading" class="started-earlier-label">Started earlier</p>
          <div class="preset-actions">
            {#each HISTORICAL_START_PRESET_MINUTES as minutesAgo}
              <button
                type="button"
                class="secondary preset"
                disabled={actionPending}
                aria-label={`Start work from ${minutesAgo} minutes ago`}
                onclick={() => handlePresetStart(minutesAgo)}
              >
                −{minutesAgo}m
              </button>
            {/each}
          </div>
          <div class="exact-start">
            <label for="exact-start-time">Exact time today</label>
            <div class="exact-start-row">
              <input
                id="exact-start-time"
                type="time"
                bind:value={exactStartTime}
                disabled={actionPending}
              />
              <button
                type="button"
                class="secondary"
                disabled={actionPending || exactStartTime === ''}
                onclick={handleExactStart}
              >
                Start at time
              </button>
            </div>
          </div>
        </div>
      {:else if summary.status === 'working'}
        <div class="active-actions">
          <button type="button" disabled={actionPending} onclick={() => handleAction('pause')}>
            Pause
          </button>
          <button type="button" disabled={actionPending} onclick={() => handleAction('lunch')}>
            Lunch
          </button>
          <button type="button" class="secondary" disabled={actionPending} onclick={() => handleAction('stop')}>
            Stop
          </button>
        </div>
      {:else}
        <div class="active-actions">
          <button type="button" disabled={actionPending} onclick={() => handleAction('resume')}>
            Resume
          </button>
          <button type="button" class="secondary" disabled={actionPending} onclick={() => handleAction('stop')}>
            Stop
          </button>
        </div>
      {/if}
    </section>

    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}
  {/if}
</main>

<style>
  .workday-screen {
    margin: 0 auto;
    max-width: 42rem;
    padding: 1.5rem 1rem 2rem;
    display: grid;
    gap: 1.5rem;
  }

  .screen-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .eyebrow {
    margin: 0 0 0.25rem;
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #4a5568;
  }

  h1 {
    margin: 0;
    font-size: clamp(1.75rem, 4vw, 2.25rem);
    font-weight: 700;
  }

  .status-badge {
    margin: 0;
    padding: 0.4rem 0.75rem;
    border-radius: 999px;
    background: #edf2f7;
    color: #2d3748;
    font-weight: 600;
    white-space: nowrap;
  }

  .hero {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 1rem;
    padding: 1.25rem;
    border-radius: 1rem;
    background: #ffffff;
    border: 1px solid #e2e8f0;
  }

  .hero h2 {
    margin: 0 0 0.35rem;
    font-size: 0.95rem;
    font-weight: 600;
    color: #4a5568;
  }

  .hero-value {
    margin: 0;
    font-size: clamp(1.75rem, 5vw, 2.5rem);
    font-weight: 700;
    line-height: 1.1;
  }

  .hero-value.secondary {
    font-size: clamp(1.35rem, 4vw, 1.85rem);
  }

  .progress-section {
    display: grid;
    gap: 0.5rem;
  }

  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
  }

  .progress-header h2 {
    margin: 0;
    font-size: 1rem;
  }

  .progress-track {
    height: 0.75rem;
    border-radius: 999px;
    background: #e2e8f0;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #3182ce;
    transition: width 0.3s ease;
  }

  .progress-fill.overtime {
    background: #d69e2e;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .started-earlier {
    display: grid;
    gap: 0.75rem;
    padding-top: 0.25rem;
  }

  .started-earlier-label {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: #4a5568;
  }

  .preset-actions,
  .exact-start-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .exact-start {
    display: grid;
    gap: 0.35rem;
  }

  .exact-start label {
    font-size: 0.875rem;
    color: #4a5568;
  }

  input[type='time'] {
    min-height: 2.75rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid #cbd5e0;
    border-radius: 0.75rem;
    font: inherit;
    background: #ffffff;
  }

  input[type='time']:focus-visible {
    outline: 3px solid #63b3ed;
    outline-offset: 2px;
  }

  button.preset {
    min-width: 4.5rem;
  }

  button {
    appearance: none;
    border: none;
    border-radius: 0.75rem;
    padding: 0.85rem 1.2rem;
    font: inherit;
    font-weight: 600;
    color: #ffffff;
    background: #2b6cb0;
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    background: #2c5282;
  }

  button:focus-visible {
    outline: 3px solid #63b3ed;
    outline-offset: 2px;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  button.secondary {
    background: #4a5568;
  }

  button.secondary:hover:not(:disabled) {
    background: #2d3748;
  }

  .active-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .loading,
  .error {
    margin: 0;
  }

  .error {
    color: #c53030;
  }
</style>
