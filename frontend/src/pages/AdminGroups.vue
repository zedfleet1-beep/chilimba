<script setup lang="ts">
import { onMounted } from 'vue';
import { useAdminStore } from '@/stores/admin';
import { formatNgwe } from '@/lib/money';

const admin = useAdminStore();

onMounted(() => admin.fetchGroups());

async function onSuspend(id: string) {
  if (!confirm('Suspend this group? Members will not be able to run cycles.')) return;
  await admin.suspendGroup(id);
}

async function onReactivate(id: string) {
  await admin.reactivateGroup(id);
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="font-display text-2xl font-bold text-slate-900">All groups</h2>
      <p class="text-sm text-slate-500">Read-only overview with suspend/reactivate controls.</p>
    </div>

    <div v-if="admin.loading" class="text-slate-500">Loading…</div>

    <div v-else class="bg-white rounded-2xl shadow-soft border border-warm-100 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-warm-50 text-slate-600">
          <tr>
            <th class="text-left px-4 py-3 font-medium">Group</th>
            <th class="text-left px-4 py-3 font-medium">Owner</th>
            <th class="text-left px-4 py-3 font-medium">Members</th>
            <th class="text-left px-4 py-3 font-medium">Contribution</th>
            <th class="text-left px-4 py-3 font-medium">Status</th>
            <th class="text-right px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-warm-50">
          <tr v-for="group in admin.groups" :key="group.id">
            <td class="px-4 py-3">
              <p class="font-medium text-slate-800">{{ group.name }}</p>
              <p class="text-xs text-slate-500 capitalize">{{ group.template.replace('_', ' ') }}</p>
            </td>
            <td class="px-4 py-3 text-slate-700">
              {{ group.owner.firstName }} {{ group.owner.lastName }}
              <p class="text-xs font-mono text-slate-500">{{ group.owner.phone }}</p>
            </td>
            <td class="px-4 py-3 text-slate-700">{{ group.memberCount }}</td>
            <td class="px-4 py-3 text-slate-700">
              <template v-if="group.settings">
                {{ formatNgwe(group.settings.contributionAmountNgwe) }}
                <span class="text-xs text-slate-500">/ {{ group.settings.contributionFrequency }}</span>
              </template>
              <span v-else>—</span>
            </td>
            <td class="px-4 py-3">
              <span
                class="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                :class="group.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-coral-50 text-coral-700'"
              >
                {{ group.status }}
              </span>
            </td>
            <td class="px-4 py-3 text-right">
              <button
                v-if="group.status === 'active'"
                class="text-sm text-coral-600 hover:text-coral-700"
                @click="onSuspend(group.id)"
              >
                Suspend
              </button>
              <button
                v-else-if="group.status === 'suspended'"
                class="text-sm text-brand-600 hover:text-brand-700"
                @click="onReactivate(group.id)"
              >
                Reactivate
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="admin.groups.length === 0" class="p-8 text-center text-slate-500">No groups yet.</p>
    </div>

    <p v-if="admin.error" class="text-sm text-red-600">{{ admin.error }}</p>
  </div>
</template>