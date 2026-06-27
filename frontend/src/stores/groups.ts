/**
 * Groups store — list, current, members. Used by the customer's
 * dashboard, group detail, and settings pages.
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import * as groupsApi from '@/api/groups';
import { getErrorMessage } from '@/api/client';

export const useGroupsStore = defineStore('groups', () => {
  const groups = ref<Array<groupsApi.Group & { memberCount: number; myRole: groupsApi.MemberRole }>>([]);
  const current = ref<groupsApi.Group | null>(null);
  const members = ref<groupsApi.GroupMember[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchMine() {
    loading.value = true;
    error.value = null;
    try {
      groups.value = await groupsApi.listMyGroups();
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
    fetchMine,
    fetchOne,
    updateSettings,
    addMember,
    removeMember,
  };
});
