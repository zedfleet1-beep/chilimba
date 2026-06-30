/**
 * Groups store — list, current, members. Used by the customer's
 * dashboard, group detail, and settings pages.
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import * as groupsApi from '@/api/groups';
import { getErrorMessage } from '@/api/client';

const SELECTED_GROUP_KEY = 'chilimba.selectedGroupId';

export type MyGroup = groupsApi.Group & {
  settings: groupsApi.GroupSetting | null;
  memberCount: number;
  myRole: groupsApi.MemberRole;
};

function readStoredSelection(): string | null {
  try {
    return localStorage.getItem(SELECTED_GROUP_KEY);
  } catch {
    return null;
  }
}

function writeStoredSelection(id: string | null) {
  try {
    if (id) localStorage.setItem(SELECTED_GROUP_KEY, id);
    else localStorage.removeItem(SELECTED_GROUP_KEY);
  } catch {
    // ignore
  }
}

export const useGroupsStore = defineStore('groups', () => {
  const groups = ref<MyGroup[]>([]);
  const current = ref<groupsApi.Group | null>(null);
  const members = ref<groupsApi.GroupMember[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const selectedGroupId = ref<string | null>(readStoredSelection());

  const activeGroup = computed(() => {
    if (!groups.value.length) return null;
    if (selectedGroupId.value) {
      const match = groups.value.find((g) => g.id === selectedGroupId.value);
      if (match) return match;
    }
    return groups.value[0] ?? null;
  });

  const activeGroupId = computed(() => activeGroup.value?.id ?? null);

  function persistSelection(id: string | null) {
    selectedGroupId.value = id;
    writeStoredSelection(id);
  }

  function reconcileSelection() {
    if (!groups.value.length) {
      persistSelection(null);
      return;
    }
    if (selectedGroupId.value && groups.value.some((g) => g.id === selectedGroupId.value)) {
      return;
    }
    persistSelection(groups.value[0].id);
  }

  function selectGroup(groupId: string) {
    if (groups.value.some((g) => g.id === groupId)) {
      persistSelection(groupId);
    }
  }

  function syncSelectionFromRoute(groupId: string) {
    if (groups.value.some((g) => g.id === groupId)) {
      persistSelection(groupId);
    }
  }

  function clearSelection() {
    persistSelection(null);
    groups.value = [];
    current.value = null;
    members.value = [];
  }

  async function fetchMine() {
    loading.value = true;
    error.value = null;
    try {
      groups.value = await groupsApi.listMyGroups();
      reconcileSelection();
    } catch (e) {
      error.value = getErrorMessage(e);
    } finally {
      loading.value = false;
    }
  }

  async function fetchOne(id: string) {
    loading.value = true;
    error.value = null;
    current.value = null;
    members.value = [];
    try {
      current.value = await groupsApi.getGroup(id);
      members.value = current.value.members ?? [];
      if (groups.value.some((g) => g.id === id)) {
        syncSelectionFromRoute(id);
      }
    } catch (e) {
      error.value = getErrorMessage(e);
      current.value = null;
      members.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function updateSettings(id: string, patch: groupsApi.UpdateGroupSettingsInput) {
    error.value = null;
    try {
      await groupsApi.updateGroupSettings(id, patch);
      if (current.value?.id === id) {
        current.value = await groupsApi.getGroup(id);
      }
      await fetchMine();
    } catch (e) {
      error.value = getErrorMessage(e);
      throw e;
    }
  }

  async function addMember(groupId: string, input: groupsApi.AddMemberInput) {
    error.value = null;
    try {
      await groupsApi.addMember(groupId, input);
      await fetchOne(groupId);
      await fetchMine();
    } catch (e) {
      error.value = getErrorMessage(e);
      throw e;
    }
  }

  async function removeMember(groupId: string, memberId: string) {
    error.value = null;
    try {
      await groupsApi.removeMember(groupId, memberId);
      await fetchOne(groupId);
      await fetchMine();
    } catch (e) {
      error.value = getErrorMessage(e);
      throw e;
    }
  }

  return {
    groups,
    current,
    members,
    loading,
    error,
    selectedGroupId,
    activeGroup,
    activeGroupId,
    fetchMine,
    fetchOne,
    updateSettings,
    addMember,
    removeMember,
    selectGroup,
    syncSelectionFromRoute,
    clearSelection,
  };
});