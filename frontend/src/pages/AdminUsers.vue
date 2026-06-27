<script setup lang="ts">
import { onMounted } from 'vue';
import { useAdminStore } from '@/stores/admin';

const admin = useAdminStore();

onMounted(() => admin.fetchUsers());

async function onSuspend(id: string, name: string) {
  if (!confirm(`Suspend ${name}? They will not be able to log in.`)) return;
  await admin.suspendUser(id);
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="font-display text-2xl font-bold text-slate-900">All users</h2>
      <p class="text-sm text-slate-500">Platform accounts and membership counts.</p>
    </div>

    <div v-if="admin.loading" class="text-slate-500">Loading…</div>

    <div v-else class="bg-white rounded-2xl shadow-soft border border-warm-100 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-warm-50 text-slate-600">
          <tr>
            <th class="text-left px-4 py-3 font-medium">Name</th>
            <th class="text-left px-4 py-3 font-medium">Phone</th>
            <th class="text-left px-4 py-3 font-medium">Role</th>
            <th class="text-left px-4 py-3 font-medium">Groups</th>
            <th class="text-left px-4 py-3 font-medium">Status</th>
            <th class="text-right px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-warm-50">
          <tr v-for="user in admin.users" :key="user.id">
            <td class="px-4 py-3 font-medium text-slate-800">{{ user.firstName }} {{ user.lastName }}</td>
            <td class="px-4 py-3 font-mono text-slate-600">{{ user.phone }}</td>
            <td class="px-4 py-3 capitalize text-slate-700">{{ user.role.replace('_', ' ') }}</td>
            <td class="px-4 py-3 text-slate-700">{{ user.groupCount }}</td>
            <td class="px-4 py-3">
              <span
                class="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                :class="user.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-coral-50 text-coral-700'"
              >
                {{ user.status }}
              </span>
            </td>
            <td class="px-4 py-3 text-right">
              <button
                v-if="user.role !== 'super_admin' && user.status === 'active'"
                class="text-sm text-coral-600 hover:text-coral-700"
                @click="onSuspend(user.id, `${user.firstName} ${user.lastName}`)"
              >
                Suspend
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="admin.error" class="text-sm text-red-600">{{ admin.error }}</p>
  </div>
</template>