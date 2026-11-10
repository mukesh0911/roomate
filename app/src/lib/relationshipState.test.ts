import { describe, expect, it } from 'vitest';
import { relationshipState, type ConnectionRecord, type LiveRelationships } from './relationshipState';

const record = (status: string, fromUserId = 'a', toUserId = 'b'): ConnectionRecord =>
  ({ id: 'connection', status, fromUserId, toUserId });
const live = (records: ConnectionRecord[]): LiveRelationships =>
  ({ accepted: [], received: [], sent: [], restricted: records });

describe('relationship actions across cards and profile details', () => {
  it('distinguishes sent and incoming pending requests by participant identity', () => {
    expect(relationshipState('a', 'b', live([record('pending')]))).toEqual({state:'sent', connectionId:'connection'});
    expect(relationshipState('b', 'a', live([record('pending')]))).toEqual({state:'received', connectionId:'connection'});
  });
  it('does not use an unrelated relationship to authorize a message action', () => {
    expect(relationshipState('a', 'b', live([record('accepted','c','b')])).state).toBe('none');
  });
  it('gives a block precedence over a stale accepted or pending record', () => {
    expect(relationshipState('a','b',live([record('accepted'),record('blocked'),record('pending')])).state).toBe('blocked');
    expect(relationshipState('a','b',live([record('accepted')]),['b']).state).toBe('blocked');
  });
  it('uses an accepted relationship despite older declined records', () => {
    expect(relationshipState('a','b',live([record('rejected'),record('accepted')])).state).toBe('accepted');
  });
  it('preserves declined history while allowing a new request after terminal states', () => {
    expect(relationshipState('a','b',live([record('rejected')])).state).toBe('declined');
    expect(relationshipState('a','b',live([record('superseded')])).state).toBe('none');
    expect(relationshipState('a','b',live([record('disconnected')])).state).toBe('none');
  });
  it('uses authorized listing communication without inventing a person connection', () => {
    const rooms = [{id:'listing-room', participants:['a','b'], authorized:true}];
    expect(relationshipState('a','b',live([]),[],rooms)).toEqual({state:'accepted',conversationId:'listing-room'});
    expect(relationshipState('a','b',live([]),['b'],rooms).state).toBe('blocked');
    expect(relationshipState('a','b',live([]),[],[{...rooms[0],authorized:false}]).state).toBe('none');
  });
  it('handles anonymous, own and missing profiles without a fabricated relationship', () => {
    expect(relationshipState(undefined,'b',live([record('accepted')])).state).toBe('none');
    expect(relationshipState('a','a',live([])).state).toBe('self');
    expect(relationshipState('a',undefined,live([])).state).toBe('unavailable');
  });
});
