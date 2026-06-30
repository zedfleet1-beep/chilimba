<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGroupsStore } from '@/stores/groups';
import { navigateToGroup } from '@/lib/groupNavigation';
import { ChevronDown, Check, Users } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    /** Match the compact action buttons on group detail header */
    inline?: boolean;
  }>(),
  { inline: false },
);

const store = useGroupsStore();
const route = useRoute();
const router = useRouter();

const open = ref(false);
const root = ref<HTMLElement | null>(null);

const show = computed(() => store.groups.length > 1);

const currentGroupId = computed(() => {
  const param = route.params.id;
  if (typeof param === 'string' && param) return param;
  return store.activeGroupId;
});

const currentGroup = computed(
  () => store.groups.find((g) => g.id === currentGroupId.value) ?? store.activeGroup,
);

function toggle() {
  open.value = !open.value;
}

function select(groupId: string) {
  open.value = false;
  store.selectGroup(groupId);
  navigateToGroup(router, route, groupId);
}

function onDocumentClick(e: MouseEvent) {
  if (!open.value || !root.value) return;
  if (!root.value.contains(e.target as Node)) {
    open.value = false;
  }
}

onMounted(async () => {
  if (!store.groups.length) {
    await store.fetchMine();
  }
  document.addEventListener('click', onDocumentClick);
});

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick);
});
</script>

<template>
  <div
    v-if="show"
    ref="root"
    class="relative min-w-0"
    :class="inline ? 'w-full sm:w-auto' : 'max-w-full'"
  >
    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-lg text-sm font-medium transition-colors min-w-0"
      :class="
        inline
          ? 'w-full sm:w-auto max-w-full justify-between sm:justify-center px-3 h-9 border border-slate-200 text-slate-700 hover:bg-warm-50'
          : 'max-w-full justify-center px-3 h-10 border border-warm-200 bg-warm-50/60 text-slate-800 hover:bg-warm-50 hover:border-warm-300'
      "
      :aria-expanded="open"
      aria-haspopup="listbox"
      title="Switch group"
      @click.stop="toggle"
    >
      <span class="inline-flex items-center gap-1.5 min-w-0 flex-1 sm:flex-initial">
        <Users class="w-4 h-4 shrink-0" :class="inline ? 'text-slate-600' : 'text-warm-600'" />
        <span
          v-if="inline"
          class="truncate min-w-0 sm:max-w-[9rem]"
        >
          {{ currentGroup?.name ?? 'Group' }}
        </span>
        <span v-else class="truncate min-w-0 max-w-[10rem] sm:max-w-[14rem]">
          {{ currentGroup?.name ?? 'Select group' }}
        </span>
      </span>
      <ChevronDown
        class="w-4 h-4 shrink-0 text-slate-500 transition-transform"
        :class="{ 'rotate-180': open }"
      />
    </button>

    <div
      v-if="open"
      class="absolute z-30 mt-1 rounded-xl border border-warm-100 bg-white shadow-lg py-1 left-0 sm:min-w-[14rem] w-[min(20rem,calc(100vw-2.5rem))] sm:w-max sm:max-w-[20rem]"
      :class="inline ? 'sm:left-auto sm:right-0' : 'w-full sm:w-[min(20rem,calc(100vw-2.5rem))]'"
      role="listbox"
    >
      <p class="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide border-b border-warm-50">
        Your groups
      </p>
      <button
        v-for="group in store.groups"
        :key="group.id"
        type="button"
        role="option"
        class="w-full flex items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-warm-50 transition-colors"
        :class="group.id === currentGroupId ? 'bg-brand-50/50' : ''"
        :aria-selected="group.id === currentGroupId"
        @click="select(group.id)"
      >
        <Check
          class="w-4 h-4 mt-0.5 shrink-0"
          :class="group.id === currentGroupId ? 'text-brand-600' : 'text-transparent'"
        />
        <span class="min-w-0 flex-1">
          <span class="block font-medium text-slate-800 truncate">{{ group.name }}</span>
          <span class="block text-xs text-slate-500 capitalize">
            {{ group.myRole }} · {{ group.memberCount }} members
          </span>
        </span>
      </button>
    </div>
  </div>
</template>