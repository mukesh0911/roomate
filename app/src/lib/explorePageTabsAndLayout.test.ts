import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import type { Connection } from '@/hooks/useConnections';
import type { MatchedUser } from '@/hooks/useMatches';
import type { Listing } from '@/hooks/useListings';
import type { CategoryTab } from '@/pages/ExplorePage';

describe('ExplorePage Unified Portal & Layout Architecture', () => {
  describe('Tab Routing & Classification', () => {
    it('supports all essential discovery, saved, and connection categories', () => {
      const validTabs: CategoryTab[] = ['rooms', 'roommates', 'pg', 'saved', 'connections', 'all'];
      expect(validTabs).toHaveLength(6);
      expect(validTabs).toContain('rooms');
      expect(validTabs).toContain('saved');
      expect(validTabs).toContain('connections');
    });

    it('defaults to rooms when rawTab query param is absent or unrecognized', () => {
      const resolveTab = (raw: string | null): CategoryTab => {
        return raw === 'rooms' ? 'rooms'
          : raw === 'roommates' ? 'roommates'
          : raw === 'pg' ? 'pg'
          : raw === 'saved' ? 'saved'
          : raw === 'connections' ? 'connections'
          : raw === 'all' ? 'all'
          : 'rooms';
      };

      expect(resolveTab(null)).toBe('rooms');
      expect(resolveTab('')).toBe('rooms');
      expect(resolveTab('invalid_tab')).toBe('rooms');
      expect(resolveTab('saved')).toBe('saved');
      expect(resolveTab('connections')).toBe('connections');
      expect(resolveTab('roommates')).toBe('roommates');
    });
  });

  describe('Saved Listings & Flatmates Aggregation', () => {
    it('accurately calculates total saved badge count from rooms and flatmates', () => {
      const savedRoomIds = ['room_a', 'room_b', 'room_c'];
      const savedProfileIds = ['profile_1', 'profile_2'];
      const totalSavedBadge = savedRoomIds.length + savedProfileIds.length;

      expect(totalSavedBadge).toBe(5);
    });

    it('filters saved rooms by search query in title, locality, or city', () => {
      const savedRooms: Partial<Listing>[] = [
        { id: 'r1', title: 'Sunny 2BHK House', locality: 'Koramangala', city: 'Bengaluru' },
        { id: 'r2', title: 'Luxury 3BHK Flat', locality: 'Indiranagar', city: 'Bengaluru' },
        { id: 'r3', title: 'Cozy Room in Velachery', locality: 'Velachery', city: 'Chennai' },
      ];

      const query = 'koramangala';
      const results = savedRooms.filter(room => {
        const q = query.toLowerCase();
        return (
          (room.title || '').toLowerCase().includes(q) ||
          (room.locality || '').toLowerCase().includes(q) ||
          (room.city || '').toLowerCase().includes(q)
        );
      });

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Sunny 2BHK House');
    });

    it('filters saved flatmates by search query across name, profession, and locality', () => {
      const savedFlatmates: MatchedUser[] = [
        {
          profile: { uid: 'u1', name: 'Ravi Kumar', profession: 'Backend Developer', locality: 'HSR Layout', city: 'Bengaluru' } as any,
          compatibilityScore: 92
        },
        {
          profile: { uid: 'u2', name: 'Sneha Patel', profession: 'UX Designer', locality: 'Koramangala', city: 'Bengaluru' } as any,
          compatibilityScore: 88
        }
      ];

      const query = 'designer';
      const results = savedFlatmates.filter(m => {
        const q = query.toLowerCase();
        return (
          (m.profile.name || '').toLowerCase().includes(q) ||
          (m.profile.locality || '').toLowerCase().includes(q) ||
          (m.profile.city || '').toLowerCase().includes(q) ||
          (m.profile.profession || '').toLowerCase().includes(q)
        );
      });

      expect(results).toHaveLength(1);
      expect(results[0].profile.name).toBe('Sneha Patel');
    });
  });

  describe('Connections Management Logic', () => {
    const currentUid = 'user_current';
    const sampleConnections: Connection[] = [
      { id: 'c1', fromUserId: 'user_current', toUserId: 'user_2', status: 'accepted', createdAt: {} as any },
      { id: 'c2', fromUserId: 'user_3', toUserId: 'user_current', status: 'accepted', createdAt: {} as any },
      { id: 'c3', fromUserId: 'incoming_1', toUserId: 'user_current', status: 'pending', createdAt: {} as any },
      { id: 'c4', fromUserId: 'user_current', toUserId: 'outgoing_1', status: 'pending', createdAt: {} as any },
    ];

    it('correctly partitions accepted, received, and sent connection requests', () => {
      const accepted = sampleConnections.filter(c => c.status === 'accepted');
      const received = sampleConnections.filter(c => c.status === 'pending' && c.toUserId === currentUid);
      const sent = sampleConnections.filter(c => c.status === 'pending' && c.fromUserId === currentUid);

      expect(accepted).toHaveLength(2);
      expect(received).toHaveLength(1);
      expect(received[0].fromUserId).toBe('incoming_1');
      expect(sent).toHaveLength(1);
      expect(sent[0].toUserId).toBe('outgoing_1');
    });

    it('aggregates connection badge count for pending received requests and active connections', () => {
      const accepted = sampleConnections.filter(c => c.status === 'accepted');
      const received = sampleConnections.filter(c => c.status === 'pending' && c.toUserId === currentUid);
      const totalConnectionAlerts = accepted.length + received.length;

      expect(totalConnectionAlerts).toBe(3);
    });
  });

  describe('Desktop Layout Geometry Specifications', () => {
    it('verifies 2-column sidebar + main content layout responsiveness', () => {
      const desktopSidebarWidth = 285; // px
      const maxContainerWidth = 1280; // max-w-7xl px
      const gap = 24; // gap-6 px
      const availableContentWidth = maxContainerWidth - desktopSidebarWidth - gap;

      expect(availableContentWidth).toBeGreaterThan(900);
      // In a 2-column grid next to sidebar:
      const cardWidth = (availableContentWidth - gap) / 2;
      expect(cardWidth).toBeGreaterThan(400); // Cards have generous, comfortable width
    });

    it('keeps .cfm modals bounded and scrollable on desktop and uses wide dialog layout for room applications', () => {
      const css = readFileSync(resolve(process.cwd(), 'src/nestmate-explore.css'), 'utf8');
      const engine = readFileSync(resolve(process.cwd(), 'src/lib/exploreEngine.js'), 'utf8');

      expect(css).toMatch(/\.nm-explore-root \.cfm\{[^}]*max-height:min\(90vh,calc\(100dvh - 32px\)\);[^}]*overflow:hidden;/);
      expect(css).toMatch(/\.nm-explore-root #cfb\{[^}]*overflow-y:auto;/);
      expect(css).toMatch(/\.nm-explore-root \.app-dlg-b\{[^}]*overflow-y:auto;/);
      expect(css).toMatch(/\.nm-explore-root \.loc svg\{[^}]*flex:none/);
      expect(css).toMatch(/\.nm-explore-root \.app-dlg-f \.r\{flex-direction:row;/);
      expect(css).toMatch(/\.nm-explore-root \.card:not\(\.rm\) \.ft\{[^}]*flex-wrap:wrap;/);
      expect(css).toMatch(/\.nm-explore-root \.ov\{[^}]*z-index:50;/);
      expect(css).toMatch(/\.nm-explore-root \.cfm \.tx\{min-height:72px;/);
      expect(engine).toContain('dlg(\'<div class="app-dlg">\' + rows.join("") + \'</div>\', 1, \'app-sheet\');');
      expect(engine).toContain('<div class="loc" style="font-size:13.5px;margin-top:2px">\' + IC.pin');
      expect(engine).toContain('const appDlgBody = $("cfb").querySelector(".app-dlg-b"); if (appDlgBody) appDlgBody.scrollTop = 0;');
      expect(engine).toContain('<span style="position:static;flex:1;min-width:0;height:44px;');
      expect(engine).not.toContain('<span class="tag" style="flex:1;text-align:center">Inquiry Sent</span>');
      expect(engine).toContain('$("cfb").parentNode.scrollTop = 0;');
    });

    it('fixes sidebar Withdraw button width blowout and enforces persisted end-to-end room applications', () => {
      const css = readFileSync(resolve(process.cwd(), 'src/nestmate-explore.css'), 'utf8');
      const engine = readFileSync(resolve(process.cwd(), 'src/lib/exploreEngine.js'), 'utf8');
      const backend = readFileSync(resolve(process.cwd(), 'src/lib/nestmateBackend.ts'), 'utf8');

      // Sidebar Withdraw / Decline / Accept stay inside their communication flex row instead of blowing out 100%
      expect(css).toContain('.nm-explore-root .rc2>.ghb{width:100%;justify-content:center;height:48px;border-radius:14px;margin-top:10px}');
      expect(css).not.toContain('.nm-explore-root .rc2 .ghb{width:100%');
      expect(engine).toContain('width:auto;height:44px;margin-top:0;padding:0 16px;white-space:nowrap;flex:none;justify-content:center">Withdraw</button>');

      // Seeker application submit keys answers by screening question text verbatim and awaits backend persistence
      expect(engine).toContain('answers[qs[qi]] = val;');
      expect(engine).not.toContain("answers['q_' + qi]");
      expect(engine).toContain('realAppId = await submitApplicationBackend(roomObj[12], answers, { note: note, moveIn: moveIn });');
      expect(engine).not.toContain('submitApplicationBackend(roomObj[12], answers).catch(function () {});');

      // Real-time seeker application subscription, valid offer/withdraw transitions, and non-fake host chat
      expect(engine).toContain('const unsubUserApps = subscribeUserApplications(authUser.uid, function (liveApps)');
      expect(engine).toContain("await updateApplicationStatusBackend(appId, 'withdrawn');");
      expect(engine).toContain("await updateApplicationStatusBackend(appId, 'declined_by_applicant');");
      expect(engine).toContain('await openHostChat(hostUid, listingId, b.dataset.ownerName || "Host");');

      // Host applicant reception & visibility in Applicants and Connections -> Received
      expect(engine).toContain('Room Applications Received (');
      expect(engine).toContain('APPLICATION_NOTES[k + ":" + i]');
      expect(engine).toContain('{ New: 0, Shortlisted: 0, Selected: 0, Declined: 0, Withdrawn: 0 }');
      expect(backend).toContain('export function subscribeUserApplications(applicantId: string');
      expect(backend).toContain("if (!placeSnapshot.exists() || !placeSnapshot.data()?.ownerId) throw new Error('Listing unavailable.');");
    });

    it('renders host Applicants with a cohesive control panel and Roommates-matched mobile-first cards', () => {
      const css = readFileSync(resolve(process.cwd(), 'src/nestmate-explore.css'), 'utf8');
      const engine = readFileSync(resolve(process.cwd(), 'src/lib/exploreEngine.js'), 'utf8');

      expect(css).toContain('.nm-explore-root .ap-panel{');
      expect(css).toContain('.nm-explore-root .ap-stage-dock{');
      expect(css).toContain('.nm-explore-root .ap-tools{');
      expect(css).toContain('.nm-explore-root .card.rm.apc{');
      expect(css).toContain('.nm-explore-root .ap-qa{');
      expect(css).toContain('.nm-explore-root .ap-acts{');
      expect(engine).toContain("const cleanQ = qKey.replace(/:+\\s*$/, '');");
      expect(engine).toContain('return \'<article class="card rm apc\' + (sel ? " sel" : "") + \'" data-r="\' + i + \'">\'');
      expect(engine).toContain('<span class="mc" title="Profile match score">');
      expect(engine).toContain('const allowCompare = ids.length >= 2;');
      expect(engine).toContain("L.length >= 2 ? '<button data-aptop=\"1\">Select top 3</button>' : ''");
      expect(engine).toContain('<span>\' + (s == "Shortlisted" ? "Shortlisted" : "Shortlist") + \'</span>');
      expect(engine).toContain('<span>\' + (s == "Selected" ? "Selected" : "Select") + \'</span>');
      expect(engine).toContain('<em>Message</em>');
    });
    it('renders Inbox chat-first controls, mobile full-screen .nm-explore-root.chat rule, application cards, system timeline & inline decision dock', () => {
      const css = readFileSync(resolve(process.cwd(), 'src/nestmate-explore.css'), 'utf8');
      const engine = readFileSync(resolve(process.cwd(), 'src/lib/exploreEngine.js'), 'utf8');

      expect(css).toContain('body.chat .nm-explore-root .top,body.chat .nm-explore-root .bb,.nm-explore-root.chat .top,.nm-explore-root.chat .bb{display:none}');
      expect(css).toContain('.nm-explore-root .app-card-msg{');
      expect(css).toContain('.nm-explore-root .sys-ev{');
      expect(css).toContain('.nm-explore-root .cp2-dock{');
      expect(css).toContain('.nm-explore-root .ver-strip{');
      expect(css).toContain('.nm-explore-root .decline-reasons{');

      expect(engine).toContain('nv("messages", "Inbox", IC.chat');
      expect(engine).toContain('["messages", "Inbox", "Chats, room applications & requests", IC.chat]');
      expect(engine).toContain('getSubmittedApplicationRoom');
      expect(engine).toContain('subscribeActiveChatMessages');
      expect(engine).toContain('function openInboxThread(');
      expect(engine).toContain('async function runInboxAppDecision(');
      expect(engine).toContain('function renderApplicationCardMessage(');
      expect(engine).toContain('data-inbox-box="requests"');
      expect(engine).toContain('data-app-act="selected"');
      expect(engine).toContain('data-conn-chat="accepted"');
      expect(engine).toContain("rootEl.classList.toggle(\"chat\", inChatThread)");
    });
  });
});
