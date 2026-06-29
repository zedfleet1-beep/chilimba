import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as cyclesApi from '@/api/cycles';
import { getErrorMessage } from '@/api/client';

export const useCyclesStore = defineStore('cycles', () => {
  const cycles = ref<cyclesApi.Cycle[]>([]);
  const current = ref<cyclesApi.CycleDetail | null>(null);
  const contributions = ref<cyclesApi.Contribution[]>([]);
  const payouts = ref<cyclesApi.CyclePayout[]>([]);
  const selectedRoundId = ref<string | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);

  const selectedRound = computed(() =>
    current.value?.rounds.find((round) => round.id === selectedRoundId.value) ?? current.value?.rounds[0] ?? null,
  );

  const activeCycle = computed(() =>
    cycles.value.find((cycle) => cycle.status === 'open' || cycle.status === 'in_progress') ?? null,
  );

  const canOpenCycle = computed(() => !activeCycle.value);

  async function fetchCycles(groupId: string) {
    loading.value = true;
    error.value = null;
    try {
      cycles.value = await cyclesApi.listCycles(groupId);
      const toShow = activeCycle.value ?? cycles.value[0] ?? null;
      if (toShow) {
        await fetchCycle(groupId, toShow.id);
      } else {
        current.value = null;
        selectedRoundId.value = null;
        contributions.value = [];
        payouts.value = [];
      }
    } catch (e) {
      error.value = getErrorMessage(e);
    } finally {
      loading.value = false;
    }
  }

  async function fetchCycle(groupId: string, cycleId: string) {
    current.value = await cyclesApi.getCycle(groupId, cycleId);
    selectedRoundId.value = selectedRoundId.value && current.value.rounds.some((round) => round.id === selectedRoundId.value)
      ? selectedRoundId.value
      : current.value.rounds[0]?.id ?? null;
    await fetchRoundLedger(groupId);
  }

  async function fetchRoundLedger(groupId: string) {
    if (!current.value || !selectedRound.value) return;
    const cycleId = current.value.id;
    const roundId = selectedRound.value.id;
    const [nextContributions, nextPayouts] = await Promise.all([
      cyclesApi.listContributions(groupId, cycleId, roundId),
      cyclesApi.listPayouts(groupId, cycleId, roundId),
    ]);
    contributions.value = nextContributions;
    payouts.value = nextPayouts;
  }

  async function open(groupId: string) {
    saving.value = true;
    error.value = null;
    try {
      current.value = await cyclesApi.openCycle(groupId);
      await fetchCycles(groupId);
    } catch (e) {
      error.value = getErrorMessage(e);
      throw e;
    } finally {
      saving.value = false;
    }
  }

  async function start(groupId: string) {
    if (!current.value) return;
    saving.value = true;
    error.value = null;
    try {
      current.value = await cyclesApi.startCycle(groupId, current.value.id);
      await fetchCycles(groupId);
    } catch (e) {
      error.value = getErrorMessage(e);
      throw e;
    } finally {
      saving.value = false;
    }
  }

  async function complete(groupId: string) {
    if (!current.value) return;
    saving.value = true;
    error.value = null;
    try {
      await cyclesApi.completeCycle(groupId, current.value.id);
      await fetchCycles(groupId);
    } catch (e) {
      error.value = getErrorMessage(e);
      throw e;
    } finally {
      saving.value = false;
    }
  }

  async function selectRound(groupId: string, roundId: string) {
    selectedRoundId.value = roundId;
    error.value = null;
    try {
      await fetchRoundLedger(groupId);
    } catch (e) {
      error.value = getErrorMessage(e);
    }
  }

  async function uploadProof(groupId: string, memberId: string, file: File) {
    if (!current.value || !selectedRound.value) return;
    saving.value = true;
    error.value = null;
    try {
      await cyclesApi.uploadContributionProof(groupId, current.value.id, selectedRound.value.id, memberId, file);
      await fetchRoundLedger(groupId);
    } catch (e) {
      error.value = getErrorMessage(e);
      throw e;
    } finally {
      saving.value = false;
    }
  }

  async function record(groupId: string, memberId: string, notes?: string) {
    if (!current.value || !selectedRound.value) return;
    saving.value = true;
    error.value = null;
    try {
      await cyclesApi.recordContribution(groupId, current.value.id, selectedRound.value.id, memberId, notes);
      await fetchCycle(groupId, current.value.id);
    } catch (e) {
      error.value = getErrorMessage(e);
      throw e;
    } finally {
      saving.value = false;
    }
  }

  async function approve(groupId: string, memberId: string) {
    if (!current.value || !selectedRound.value) return;
    saving.value = true;
    error.value = null;
    try {
      await cyclesApi.approveContribution(groupId, current.value.id, selectedRound.value.id, memberId);
      await fetchCycle(groupId, current.value.id);
    } catch (e) {
      error.value = getErrorMessage(e);
      throw e;
    } finally {
      saving.value = false;
    }
  }

  async function waive(groupId: string, memberId: string) {
    if (!current.value || !selectedRound.value) return;
    saving.value = true;
    error.value = null;
    try {
      await cyclesApi.waiveContribution(groupId, current.value.id, selectedRound.value.id, memberId);
      await fetchCycle(groupId, current.value.id);
    } catch (e) {
      error.value = getErrorMessage(e);
      throw e;
    } finally {
      saving.value = false;
    }
  }

  async function recordPayout(groupId: string, input: { notes?: string; file?: File }) {
    if (!current.value || !selectedRound.value) return;
    saving.value = true;
    error.value = null;
    try {
      await cyclesApi.recordPayout(groupId, current.value.id, selectedRound.value.id, input);
      await fetchCycle(groupId, current.value.id);
    } catch (e) {
      error.value = getErrorMessage(e);
      throw e;
    } finally {
      saving.value = false;
    }
  }

  async function reroll(groupId: string) {
    if (!current.value || !selectedRound.value) return;
    saving.value = true;
    error.value = null;
    try {
      await cyclesApi.rerollPayouts(groupId, current.value.id, selectedRound.value.id);
      await fetchCycle(groupId, current.value.id);
    } catch (e) {
      error.value = getErrorMessage(e);
      throw e;
    } finally {
      saving.value = false;
    }
  }

  async function assignRecipients(groupId: string, memberIds: string[]) {
    if (!current.value || !selectedRound.value) return;
    saving.value = true;
    error.value = null;
    try {
      await cyclesApi.assignPayoutRecipients(groupId, current.value.id, selectedRound.value.id, memberIds);
      await fetchCycle(groupId, current.value.id);
    } catch (e) {
      error.value = getErrorMessage(e);
      throw e;
    } finally {
      saving.value = false;
    }
  }

  return {
    cycles,
    current,
    activeCycle,
    canOpenCycle,
    contributions,
    payouts,
    selectedRoundId,
    selectedRound,
    loading,
    saving,
    error,
    fetchCycles,
    fetchCycle,
    selectRound,
    open,
    start,
    complete,
    uploadProof,
    record,
    approve,
    waive,
    recordPayout,
    reroll,
    assignRecipients,
  };
});
