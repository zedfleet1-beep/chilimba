import type { RouteLocationNormalizedLoaded, Router } from 'vue-router';

const GROUP_ROUTE_NAMES = new Set([
  'group-detail',
  'group-settings',
  'group-cycles',
  'group-reports',
  'group-loans',
]);

export function isGroupRoute(route: RouteLocationNormalizedLoaded): boolean {
  return typeof route.params.id === 'string' && route.path.startsWith('/groups/');
}

export function navigateToGroup(
  router: Router,
  route: RouteLocationNormalizedLoaded,
  groupId: string,
): void {
  const name = route.name;
  if (typeof name === 'string' && GROUP_ROUTE_NAMES.has(name)) {
    router.push({ name, params: { ...route.params, id: groupId } });
    return;
  }
  router.push({ name: 'group-detail', params: { id: groupId } });
}