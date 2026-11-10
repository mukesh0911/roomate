export interface DiscoveryFilters {
  q: string; city: string; min: number; max: number; move: number;
  types: string[]; propertyType: string; furn: number; ver: number;
  gender: string; sort: string; view: string;
}
export interface ExploreRouteState extends DiscoveryFilters {
  nav: string; cat: number; roomId?: string; personId?: string; chatId?: string;
  section?: string; settingsTab?: number; requests?: number;
}
const routes = new Set(['explore','saved','messages','connections','listings','profile','notifications']);
const days: Record<string, number> = { Immediately: 0, 'Within 7 days': 7, 'Within 15 days': 15, 'Within 30 days': 30, 'Next month': 60 };
const number = (value: string | null, fallback: number) => value !== null && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : fallback;
export function readExploreLocation(pathname: string, params: URLSearchParams) {
  const nav = pathname.replace(/^\//, '');
  return {
    nav: routes.has(nav) ? nav : 'explore',
    cat: Math.max(0, ['all','rooms','roommates','pg'].indexOf(params.get('tab') || 'all')),
    filters: {
      q: params.get('q') || '', city: params.get('city') || '',
      min: number(params.get('min'), 0), max: number(params.get('max'), 100000),
      move: days[params.get('move') || ''] ?? number(params.get('move'), 999),
      types: params.getAll('type').filter(t => ['Private room','Shared room','Entire flat','Full flat'].includes(t)),
      propertyType: params.get('propertyType') === 'coliving' ? 'coliving' : '',
      furn: params.get('furn') === '1' ? 1 : 0, ver: params.get('ver') === '1' ? 1 : 0,
      gender: ['Female','Male'].includes(params.get('gender') || '') ? params.get('gender')! : 'Any',
      sort: ['a','d'].includes(params.get('sort') || '') ? params.get('sort')! : 'm',
      view: params.get('view') === 'list' ? 'list' : 'grid',
    } satisfies DiscoveryFilters,
    personId: params.get('person'), chatId: params.get('chat'),
    section: params.get('section'), settingsTab: number(params.get('settingsTab'), 0),
    requests: Math.min(2, number(params.get('requests'), 0)),
  };
}
export function buildExploreLocation(state: ExploreRouteState): string {
  const params = new URLSearchParams();
  const set = (key: string, value: unknown, fallback: unknown = '') => {
    if (value !== undefined && value !== null && value !== fallback) params.set(key, String(value));
  };
  set('tab', ['all','rooms','roommates','pg'][state.cat] || 'all', 'all');
  set('q', state.q); set('city', state.city); set('min', state.min, 0); set('max', state.max, 100000);
  set('move', state.move, 999); set('propertyType', state.propertyType);
  state.types.forEach(type => params.append('type', type));
  set('furn', state.furn, 0); set('ver', state.ver, 0); set('gender', state.gender, 'Any');
  set('sort', state.sort, 'm'); set('view', state.view, 'grid');
  let nav = routes.has(state.nav) ? state.nav : 'explore';
  if (state.nav === 'room' || state.nav === 'pg') set('room', state.roomId);
  if (state.nav === 'roommate') set('person', state.personId);
  if (nav === 'messages') set('chat', state.chatId);
  if (nav === 'profile') { set('section', state.section, 'profile'); set('settingsTab', state.settingsTab, 0); }
  if (nav === 'connections') set('requests', state.requests, 0);
  if (['compare','applicants'].includes(state.nav)) nav = 'listings';
  return '/' + nav + (params.size ? '?' + params.toString() : '');
}
