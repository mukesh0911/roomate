import { useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStore } from '@/store/useStore';
import { mountExploreEngine } from '@/lib/exploreEngine';
import '../nestmate-explore.css';

export type CategoryTab = 'all' | 'rooms' | 'roommates' | 'pg' | 'saved' | 'connections';

interface ExplorePageProps {
  initialNav?: string;
}

export default function ExplorePage({ initialNav = 'explore' }: ExplorePageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, profile, logout, refreshProfile, isLoading: authLoading } = useAuth();
  const { openAuthModal } = useStore();

  useEffect(() => {
    if (!rootRef.current || authLoading) return;

    // The imperative renderer also writes native history. Re-read the current
    // URL when auth/profile updates remount it, rather than a stale route snapshot.
    return mountExploreEngine({initialNav,location: {pathname: window.location.pathname},
      searchParams: new URLSearchParams(window.location.search),user,profile,
      openAuthModal,refreshProfile,logout,navigate});
  }, [initialNav, location, searchParams, navigate, user, profile, openAuthModal, refreshProfile, logout, authLoading]);

  if (authLoading) return <main role="status" aria-live="polite" style={{ padding: '2rem' }}>Loading your account...</main>;

  return (
    <div className="nm-explore-root" ref={rootRef}>
      <aside className="rail" id="rail"></aside>
      <div className="app">
        <header className="top">
          <div
            className="lgm"
            role="button"
            aria-label="NestMate Home"
            tabIndex={0}
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate('/');
              }
            }}
          >
            <svg viewBox="0 0 24 24"><path d="M12 2.500 2.500 11H5v9h5.500v-6h3v6H19v-9h2.500z"/></svg>
          </div>
          <div className="mtt" id="mtt"></div>
          <div className="search" role="search">
            <button className="city" data-pop="c" aria-label="Change city" aria-haspopup="true">
              {(profile?.city) || 'All Cities'} <svg className="i" style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <input id="q" placeholder="Search locality or landmark" aria-label="Search" />
            <button className="ib" id="sqc" data-sqc="1" style={{ display: 'none', width: '32px', height: '32px' }} aria-label="Clear search">×</button>
            <button className="go" aria-label="Search">
              <svg className="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.500"/><path d="m16 16 4.500 4.500"/></svg>
            </button>
            <div className="pp" id="ppc"></div>
            <div className="pp" id="ppq"></div>
          </div>
          <div className="tr2" style={{ position: 'relative' }}>
            <button className="post" data-n="post">Post a room</button>
            <button className="ib" data-pop="b" aria-label="Notifications" aria-haspopup="true">
              <svg className="i" viewBox="0 0 24 24"><path d="M6 17V11a6 6 0 0 1 12 0v6l1.500 2h-15zM10 21h4"/></svg>
              <span className="dot"></span>
            </button>
            <div className="pp" id="ppb"></div>
          </div>
        </header>
        <main className="pg">
          <h1 className="vh" id="pgt"></h1>
          <div className="hero" id="hero">
            <svg className="art" viewBox="0 0 380 170" aria-hidden="true">
              <circle cx="300" cy="46" r="74" fill="#fff" opacity=".09"/>
              <circle cx="352" cy="140" r="54" fill="#fff" opacity=".08"/>
              <g fill="#fff" opacity=".17">
                <rect x="120" y="82" width="38" height="88" rx="7"/>
                <rect x="166" y="46" width="46" height="124" rx="7"/>
                <rect x="220" y="96" width="36" height="74" rx="7"/>
              </g>
              <g fill="#fff" opacity=".55">
                <rect x="130" y="96" width="7" height="9" rx="2"/>
                <rect x="141" y="96" width="7" height="9" rx="2"/>
                <rect x="130" y="112" width="7" height="9" rx="2"/>
                <rect x="177" y="60" width="8" height="10" rx="2"/>
                <rect x="191" y="60" width="8" height="10" rx="2"/>
                <rect x="177" y="78" width="8" height="10" rx="2"/>
                <rect x="191" y="96" width="8" height="10" rx="2"/>
                <rect x="230" y="110" width="7" height="9" rx="2"/>
              </g>
              <path d="M268 170v-66l36-30 36 30v66z" fill="#fff"/>
              <rect x="293" y="132" width="22" height="38" rx="5" fill="#f0541e"/>
              <rect x="276" y="108" width="12" height="12" rx="3" fill="#ffd0b5"/>
              <rect x="320" y="108" width="12" height="12" rx="3" fill="#ffd0b5"/>
              <path d="M226 40a15 15 0 1 1 30 0c0 12-15 28-15 28s-15-16-15-28z" fill="#fff"/>
              <circle cx="241" cy="40" r="5.500" fill="#f0541e"/>
              <path d="M196 16l3.500 9 9 3.500-9 3.500-3.500 9-3.500-9-9-3.500 9-3.500z" fill="#fff"/>
              <path d="M350 70c0-6 9-8 12-2 3-6 12-4 12 2 0 7-12 14-12 14s-12-7-12-14z" fill="#fff" opacity=".85"/>
            </svg>
            <h2 style={{ color: '#ffffff' }}>Find a room that fits your life</h2>
            <p>Verified places in {(profile?.city) || 'India'}, matched to you.</p>
            <div className="cats" id="cats">
              <button className="chip" data-c="0" aria-pressed="true">All listings</button>
              <button className="chip" data-c="1" aria-pressed="false">Rooms &amp; flats</button>
              <button className="chip" data-c="2" aria-pressed="false">Roommates</button>
              <button className="chip" data-c="3" aria-pressed="false">PG &amp; coliving</button>
            </div>
          </div>
          <div className="hd">
            <h1 id="h1"></h1>
            <p id="n"></p>
            <div className="ctl" id="ctl">
              <select className="pill" id="sort" aria-label="Sort">
                <option value="m">Best match</option>
                <option value="recent">Active recently</option>
                <option value="a">Price: low to high</option>
                <option value="d">Price: high to low</option>
              </select>
              <button className="pill" id="fb">
                <svg className="i" style={{ width: '18px', height: '18px' }} viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>
                Filters<span className="cnt" id="cnt">0</span>
              </button>
              <button className="pill" id="hm" type="button" aria-pressed="false" title="Filter to 70%+ compatibility matches">
                70%+ Best matches
              </button>
              <div className="vt">
                <button aria-pressed="true" data-v="grid" aria-label="Grid view">
                  <svg className="i" viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>
                </button>
                <button aria-pressed="false" data-v="list" aria-label="List view">
                  <svg className="i" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
                </button>
              </div>
            </div>
          </div>
          <section className="grid" id="g"></section>
        </main>
      </div>
      <nav className="bb" id="bb"></nav>
      <div className="ov" id="ov">
        <div className="sh" role="dialog" aria-modal="true" aria-label="Filters">
          <header>Filters<button className="ib" id="x" aria-label="Close"><svg className="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header>
          <div className="sb">
            <div className="sec"><h3>Monthly budget <span id="bv"></span></h3><input type="range" id="bud" min="5000" max="100000" step="1000" defaultValue="100000" /></div>
            <div className="sec"><h3>Move-in</h3><div className="sg" data-g="move"><button data-v="999" aria-pressed="true">Any time</button><button data-v="7">Within 7 days</button><button data-v="15">Within 15 days</button><button data-v="30">Within 30 days</button></div></div>
            <div className="sec"><h3>Place</h3><div className="sg" id="types"><button data-v="Private room" aria-pressed="false">Private room</button><button data-v="Full flat" aria-pressed="false">Full flat</button></div></div>
            <div className="sec"><h3>Roommate gender</h3><div className="sg" data-g="gender"><button data-v="Any" aria-pressed="true">Any</button><button data-v="Female">Female</button><button data-v="Male">Male</button></div></div>
            <div className="sec"><h3>Good to have</h3><div className="sg" id="opts"><button data-k="furn" aria-pressed="false">Fully furnished</button><button data-k="ver" aria-pressed="false">Verified only</button></div></div>
          </div>
          <footer><button className="ln" id="rs">Reset all</button><button className="apply" id="ap"></button></footer>
        </div>
      </div>
      <div className="ov" id="cfo"><div className="cfm" role="dialog" aria-modal="true"><div id="cfb"></div></div></div>
      <div className="toast" id="tst" role="status" aria-live="polite"></div>
      <div className="gone" id="gone">
        <div>
          <svg viewBox="0 0 160 120" width="150" height="112" aria-hidden="true"><circle cx="80" cy="62" r="46" fill="var(--bs)"/><path d="M52 90V60l28-22 28 22v30z" fill="#f0541e"/><rect x="72" y="68" width="16" height="22" rx="4" fill="#fff"/></svg>
          <h2>Your account has been deleted</h2>
          <p>Your account and private data have been removed. Shared messages remain available to other participants without your profile identity.</p>
          <button className="post" data-gone="1" style={{ display: 'inline-block' }}>Back to the start</button>
        </div>
      </div>
      <div className="pps" id="pps"></div>
      <div className="gv" id="gv" role="dialog" aria-modal="true" aria-label="Photos"></div>
      <div className="pf" id="pf" role="dialog" aria-modal="true" aria-label="Post a room">
        <div className="pft">
          <div className="lgm"><svg viewBox="0 0 24 24"><path d="M12 2.500 2.500 11H5v9h5.500v-6h3v6H19v-9h2.500z"/></svg></div>
          <div className="pseg" id="pseg"></div>
          <div className="pstr" id="pstr"></div>
          <button className="ghb" data-p="exit">Close</button>
        </div>
        <div className="pfb" id="pfb">
          <div className="pfm" id="pfm"></div>
          <aside className="pfp" id="pfp"></aside>
        </div>
        <div className="pfbar" id="pfbar"></div>
      </div>
      {/* 5-Factor Match Breakdown Modal ("Why this %?") */}
      <div className="ov" id="nm-breakdown-ov" role="dialog" aria-modal="true" aria-label="Match Compatibility Breakdown">
        <div className="nm-breakdown-card">
          <div className="nm-breakdown-header">
            <div className="nm-breakdown-score-badge">
              <span className="nm-breakdown-score-num" id="nm-modal-score">0%</span>
              <span>Match</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 id="nm-modal-title">Compatibility Breakdown</h3>
              <p id="nm-modal-subtitle">How your preferences align with this room</p>
            </div>
            <button type="button" className="nm-chooser-close" data-close-breakdown="1" aria-label="Close dialog">&times;</button>
          </div>
          <div className="nm-breakdown-body">
            <div className="nm-factor-row">
              <div className="nm-factor-info">
                <b>Budget Fit</b>
                <span id="nm-score-budget-text">0 / 25 pts</span>
              </div>
              <div className="nm-bar-track"><div className="nm-bar-fill" id="nm-bar-budget" style={{ width: '0%' }}></div></div>
            </div>
            <div className="nm-factor-row">
              <div className="nm-factor-info">
                <b>Location &amp; Locality</b>
                <span id="nm-score-location-text">0 / 20 pts</span>
              </div>
              <div className="nm-bar-track"><div className="nm-bar-fill" id="nm-bar-location" style={{ width: '0%' }}></div></div>
            </div>
            <div className="nm-factor-row">
              <div className="nm-factor-info">
                <b>Gender Requirement</b>
                <span id="nm-score-gender-text">0 / 20 pts</span>
              </div>
              <div className="nm-bar-track"><div className="nm-bar-fill" id="nm-bar-gender" style={{ width: '0%' }}></div></div>
            </div>
            <div className="nm-factor-row">
              <div className="nm-factor-info">
                <b>House Rules &amp; Lifestyle Habits</b>
                <span id="nm-score-rules-text">0 / 20 pts</span>
              </div>
              <div className="nm-bar-track"><div className="nm-bar-fill" id="nm-bar-rules" style={{ width: '0%' }}></div></div>
            </div>
            <div className="nm-factor-row">
              <div className="nm-factor-info">
                <b>Room &amp; Occupancy Preferences</b>
                <span id="nm-score-pref-text">0 / 15 pts</span>
              </div>
              <div className="nm-bar-track"><div className="nm-bar-fill" id="nm-bar-pref" style={{ width: '0%' }}></div></div>
            </div>
            <div className="nm-reasons-box" id="nm-reasons-box" style={{ display: 'none' }}>
              <h4>Positive Match Highlights</h4>
              <ul id="nm-reasons-list"></ul>
            </div>
            <div className="nm-caveats-box" id="nm-caveats-box" style={{ display: 'none' }}>
              <h4>Things to Keep in Mind</h4>
              <ul id="nm-caveats-list"></ul>
            </div>
          </div>
          <div className="nm-breakdown-footer">
            <button type="button" className="ghb" data-action="fast-prefs">Refine my preferences</button>
            <button type="button" className="msgb" data-close-breakdown="1" style={{ width: 'auto', padding: '0 24px' }}><em>Done</em></button>
          </div>
        </div>
      </div>
      {/* Interactive Tour & Visit Scheduler Modal */}
      <div className="ov" id="nm-tour-scheduler-ov" role="dialog" aria-modal="true" aria-label="Schedule a Room Visit">
        <div className="nm-breakdown-card nm-tour-modal-card">
          <div className="nm-breakdown-header">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: '19px', fontWeight: 700 }}>Schedule a Visit</h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--ink2)' }}>Propose an in-person or live video tour directly in chat</p>
            </div>
            <button type="button" className="nm-chooser-close" data-close-tour-scheduler="1" aria-label="Close dialog">&times;</button>
          </div>
          <div className="nm-tour-modal-body">
            <label className="nm-tour-label">Tour Type</label>
            <div className="nm-tour-type-chips">
              <button type="button" className="chip active" data-tour-type="in_person">🏡 In-Person Visit</button>
              <button type="button" className="chip" data-tour-type="video_tour">📱 Live Video Tour</button>
            </div>

            <label className="nm-tour-label" htmlFor="nm-tour-date-input">Preferred Date</label>
            <input type="date" id="nm-tour-date-input" className="nm-tour-input" />

            <label className="nm-tour-label" htmlFor="nm-tour-slot-select">Preferred Time Window</label>
            <select id="nm-tour-slot-select" className="nm-tour-input" defaultValue="Afternoon (2:00 PM - 4:00 PM)">
              <option value="Morning (10:00 AM - 12:00 PM)">Morning (10:00 AM - 12:00 PM)</option>
              <option value="Afternoon (2:00 PM - 4:00 PM)">Afternoon (2:00 PM - 4:00 PM)</option>
              <option value="Evening (5:00 PM - 7:00 PM)">Evening (5:00 PM - 7:00 PM)</option>
              <option value="Night (7:00 PM - 8:30 PM)">Night (7:00 PM - 8:30 PM)</option>
            </select>

            <label className="nm-tour-label" htmlFor="nm-tour-note-input">Note for Host (Optional)</label>
            <input type="text" id="nm-tour-note-input" className="nm-tour-input" placeholder="e.g. Checking proximity to metro / move-in timeline" maxLength={150} />
          </div>
          <div className="nm-breakdown-footer">
            <button type="button" className="ghb" data-close-tour-scheduler="1">Cancel</button>
            <button type="button" className="msgb" data-submit-tour="1" style={{ width: 'auto', padding: '0 24px' }}><em>Propose Visit</em></button>
          </div>
        </div>
      </div>
      {/* Zero-Brokerage Digital Co-Living Agreement Generator */}
      <div className="ov" id="nm-agreement-modal-ov" role="dialog" aria-modal="true" aria-label="Digital Co-Living Agreement Generator">
        <div className="nm-breakdown-card nm-agreement-modal-card">
          <div className="nm-breakdown-header">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="nm-agreement-badge">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span>Zero-Brokerage Protection</span>
              </div>
              <h3 style={{ margin: '4px 0 2px', fontSize: '19px', fontWeight: 700 }}>Co-Living &amp; Flatmate Agreement</h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--ink2)' }}>Standard fair agreement based on Model Tenancy principles</p>
            </div>
            <button type="button" className="nm-chooser-close" data-close-agreement="1" aria-label="Close dialog">&times;</button>
          </div>

          <div className="nm-agreement-tabs">
            <button type="button" className="chip active" data-ag-tab="config">1. Agreement Terms</button>
            <button type="button" className="chip" data-ag-tab="preview">2. Document Preview</button>
          </div>

          <div id="nm-ag-config-panel" className="nm-ag-panel">
            <div className="nm-ag-form-grid">
              <div>
                <label className="nm-tour-label" htmlFor="nm-ag-host-name">Host / Primary Resident</label>
                <input type="text" id="nm-ag-host-name" className="nm-tour-input" placeholder="Host full name" />
              </div>
              <div>
                <label className="nm-tour-label" htmlFor="nm-ag-tenant-name">Incoming Flatmate / Tenant</label>
                <input type="text" id="nm-ag-tenant-name" className="nm-tour-input" placeholder="Flatmate full name" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="nm-tour-label" htmlFor="nm-ag-address">Property Address / Premises</label>
                <input type="text" id="nm-ag-address" className="nm-tour-input" placeholder="Flat No., Building, Locality, City" />
              </div>
              <div>
                <label className="nm-tour-label" htmlFor="nm-ag-rent">Monthly Rent (₹/mo)</label>
                <input type="number" id="nm-ag-rent" className="nm-tour-input" placeholder="e.g. 14000" />
              </div>
              <div>
                <label className="nm-tour-label" htmlFor="nm-ag-deposit">Security Deposit (₹)</label>
                <input type="number" id="nm-ag-deposit" className="nm-tour-input" placeholder="e.g. 28000" />
              </div>
              <div>
                <label className="nm-tour-label" htmlFor="nm-ag-movein">Occupancy / Move-in Date</label>
                <input type="date" id="nm-ag-movein" className="nm-tour-input" />
              </div>
              <div>
                <label className="nm-tour-label" htmlFor="nm-ag-notice">Notice Period</label>
                <select id="nm-ag-notice" className="nm-tour-input" defaultValue="30 days">
                  <option value="15 days">15 days</option>
                  <option value="30 days">30 days (Standard)</option>
                  <option value="45 days">45 days</option>
                  <option value="60 days">60 days</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="nm-tour-label" htmlFor="nm-ag-utilities">Utility &amp; Maintenance Sharing</label>
                <input type="text" id="nm-ag-utilities" className="nm-tour-input" defaultValue="Shared equally (Electricity, High-speed Wi-Fi, Water &amp; Maid)" />
              </div>
            </div>
            <div className="nm-breakdown-footer" style={{ marginTop: '16px' }}>
              <button type="button" className="ghb" data-close-agreement="1">Cancel</button>
              <button type="button" className="msgb" data-ag-to-preview="1" style={{ width: 'auto', padding: '0 24px' }}><em>Generate Preview &rarr;</em></button>
            </div>
          </div>

          <div id="nm-ag-preview-panel" className="nm-ag-panel" style={{ display: 'none' }}>
            <div className="nm-ag-doc" id="nm-ag-doc-content"></div>
            <div className="nm-breakdown-footer" style={{ marginTop: '16px' }}>
              <button type="button" className="ghb" data-ag-back-config="1">&larr; Edit Terms</button>
              <button type="button" className="ghb" data-ag-copy="1">📋 Copy Text</button>
              <button type="button" className="msgb" data-ag-print="1" style={{ width: 'auto', padding: '0 24px' }}><em>🖨️ Print / Save PDF</em></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
