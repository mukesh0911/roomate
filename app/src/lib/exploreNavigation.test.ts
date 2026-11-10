import { describe, expect, it } from 'vitest';
import { buildExploreLocation, readExploreLocation } from './exploreNavigation';
const filters = readExploreLocation('/explore', new URLSearchParams()).filters;
describe('canonical discovery navigation', () => {
  it('round trips every supported filter without dropping locality or category', () => {
    const state = { ...filters, nav: 'explore', cat: 1, city: 'Pune', q: 'Baner & Aundh', min: 5000, max: 20000,
      move: 15, types: ['Private room', 'Shared room'], propertyType: 'coliving', furn: 1, ver: 1, gender: 'Female', sort: 'a', view: 'list' };
    const url = new URL(buildExploreLocation(state), 'https://example.test');
    const restored = readExploreLocation(url.pathname, url.searchParams);
    const { nav: _nav, cat: _cat, ...expected } = state;
    expect(restored.filters).toEqual(expected);
    expect(restored.nav).toBe('explore'); expect(restored.cat).toBe(1);
  });
  it('uses stable property and person IDs rather than page indices', () => {
    expect(buildExploreLocation({ ...filters, nav: 'room', cat: 1, roomId: 'f-id/?' })).toContain('room=f-id%2F%3F');
    expect(buildExploreLocation({ ...filters, nav: 'pg', cat: 3, roomId: 'pg-id' })).toContain('room=pg-id');
    expect(buildExploreLocation({ ...filters, nav: 'roommate', cat: 2, personId: 'person-id' })).toContain('person=person-id');
  });
  it('keeps selected conversation, received requests and settings destinations', () => {
    expect(buildExploreLocation({ ...filters, nav: 'messages', cat: 0, chatId: 'room-id' })).toBe('/messages?chat=room-id');
    expect(buildExploreLocation({ ...filters, nav: 'connections', cat: 0, requests: 1 })).toBe('/connections?requests=1');
    expect(buildExploreLocation({ ...filters, nav: 'profile', cat: 0, section: 'settings', settingsTab: 2 })).toBe('/profile?section=settings&settingsTab=2');
    expect(readExploreLocation('/notifications', new URLSearchParams()).nav).toBe('notifications');
  });
  it('accepts the existing hero move-in values and rejects invalid numeric filters', () => {
    expect(readExploreLocation('/explore', new URLSearchParams('move=Immediately')).filters.move).toBe(0);
    expect(readExploreLocation('/explore', new URLSearchParams('move=Within+15+days')).filters.move).toBe(15);
    const restored=readExploreLocation('/explore', new URLSearchParams('max=Infinity&min=-2&type=unknown&sort=unknown'));
    expect(restored.filters.max).toBe(100000); expect(restored.filters.min).toBe(0); expect(restored.filters.types).toEqual([]); expect(restored.filters.sort).toBe('m');
  });
});
