import { prepareAccountExportBackend, ACCOUNT_EXPORT_AVAILABLE } from './accountJobs';
import { readExploreLocation, buildExploreLocation } from './exploreNavigation';
// Existing imperative renderer, isolated from the typed React lifecycle.
import { getRoomMatchReasons, calculateRoomCompatibility, calculateProfileCompatibility } from '@/lib/matching';
import { applicationLabels } from '@/lib/applicationState';
import { relationshipState } from '@/lib/relationshipState';
import { sanitizeRenderedHtml } from '@/lib/sanitizeRenderedHtml';
import { buildProfileEditorUpdate, buildMatchingPreferencesUpdate } from '@/lib/profileEditor';
import { resolveUserHousingIntent } from '@/lib/userIntent';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, verifyBeforeUpdateEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { loadOlderMessagesBackend, fetchOwnApplicationBackend, fetchPersonByIdBackend, fetchPlaceByIdBackend, submitApplicationBackend, updateApplicationStatusBackend, disconnectConnectionBackend, blockUserBackend, unblockUserBackend, uploadChatImageBackend, markConversationReadBackend, uploadProfileAvatarBackend, getOrCreateChatRoomBackend, getVerificationDocumentBlobBackend, submitReportBackend, markNotificationReadBackend, markAllNotificationsReadBackend, fetchBoundedExploreListings, fetchBoundedExploreRoommates, subscribeBoundedListingsHead, subscribeLiveUserChats, subscribeLiveNotifications, subscribeOwnerListings, subscribeLiveConnections, createNewListingBackend, updateListingStatusBackend, updateListingBackend, deleteListingBackend, updateConnectionStatusBackend, withdrawConnectionRequestBackend, sendConnectionRequestBackend, sendMessageBackend, saveUserBookmarkBackend, updateUserProfileBackend, submitManualKycBackend, subscribeUserKycStatus, adminApproveVerificationBackend, adminRejectVerificationBackend, fetchAdminDataBackend, adminVerifyListingBackend, adminUpdateUserStatusBackend, adminResolveReportBackend, } from '@/lib/nestmateBackend';
export function mountExploreEngine({ initialNav, location, searchParams, user, profile, openAuthModal, refreshProfile, logout, navigate }) {
    // Determine initial navigation state from route or search params
    let initialCat = 0;
    const tabParam = searchParams.get('tab');
    if (tabParam === 'rooms')
        initialCat = 1;
    else if (tabParam === 'roommates')
        initialCat = 2;
    else if (tabParam === 'pg')
        initialCat = 3;
    let targetNav = initialNav;
    const pathname = location.pathname.replace(/^\//, '');
    if (['saved', 'messages', 'connections', 'listings', 'profile', 'explore', 'notifications'].includes(pathname)) {
        targetNav = pathname;
    }
    let disposed = false;
    let privatePreviewUrl = "";
    let exportInFlight = false;
    let settingsInFlight = false;
    // Cleanup registry
    const cleanupFns = [];
    function addDocListener(type, listener, options) {
        document.addEventListener(type, listener, options);
        cleanupFns.push(() => document.removeEventListener(type, listener, options));
    }
    function addWinListener(type, listener, options) {
        window.addEventListener(type, listener, options);
        cleanupFns.push(() => window.removeEventListener(type, listener, options));
    }
    const authUser = user || null;
    const currentProfile = profile || null;
    const passwordSignIn = !!authUser?.providerData?.some(provider => provider.providerId === 'password');
    // --- Embedded Realtime Engine ---
    (function initEngine() {
        let RM, RX, LIVE_CONNS, MY, CH, G, AF, AS, APS, ADM;
        let USER_KYC = { status: 'not_submitted', doc: null, loading: false };
        const CHAT_DRAFTS = new Map(), CHAT_SENDS = new Set(), CHAT_READS = new Set();
        let chatLoading = Boolean(authUser), chatError = false;
        let D = [];
        const S = { q: "", max: 100000, move: 999, gender: "Any", types: [], furn: 0, ver: 0, sort: "m", view: "grid", nav: "explore", cat: 0, pageLimit: { 0: 12, 1: 12, 2: 12, 3: 12 } }, SV = {};
        function isRoomSaved(x, idx) {
            if (!x) return false;
            const id = x[12];
            if (id && (SV[id] || (currentProfile && currentProfile.savedRoomIds && currentProfile.savedRoomIds.includes(id)))) return true;
            if (idx !== undefined && SV[idx]) return true;
            return false;
        }
        function isPgSaved(x, idx) {
            if (!x) return false;
            const id = x[11];
            if (id && (SV[id] || SV["p" + id] || (currentProfile && currentProfile.savedRoomIds && currentProfile.savedRoomIds.includes(id)))) return true;
            if (idx !== undefined && (SV["p" + idx] || SV[idx])) return true;
            return false;
        }
        function isProfileSaved(x, idx) {
            if (!x) return false;
            const id = x[9];
            if (id && (SV["r" + id] || SV[id] || (currentProfile && currentProfile.savedProfileIds && currentProfile.savedProfileIds.includes(id)))) return true;
            if (idx !== undefined && SV["r" + idx]) return true;
            return false;
        }
        function getSavedRoomCount() {
            const ids = new Set();
            if (currentProfile && currentProfile.savedRoomIds) {
                currentProfile.savedRoomIds.forEach(function (id) { ids.add(id); });
            }
            Object.keys(SV).forEach(function (k) {
                if (!SV[k]) return;
                if (!k.startsWith("r")) {
                    const cleanId = k.startsWith("p") ? k.slice(1) : k;
                    ids.add(cleanId);
                }
            });
            return ids.size;
        }
        function getSavedProfileCount() {
            const ids = new Set();
            if (currentProfile && currentProfile.savedProfileIds) {
                currentProfile.savedProfileIds.forEach(function (id) { ids.add(id); });
            }
            Object.keys(SV).forEach(function (k) {
                if (!SV[k]) return;
                if (k.startsWith("r")) {
                    ids.add(k.slice(1));
                }
            });
            return ids.size;
        }
        const $ = function (i) { return document.getElementById(i); };
        function P(d) { return '<svg class="i" viewBox="0 0 24 24">' + d + '</svg>'; }
        const IC = {
            pin: '<svg class="i" viewBox="0 0 24 24"><path d="M12 21s7-6.200 7-11.500A7 7 0 0 0 5 9.500C5 14.800 12 21 12 21z"/><circle cx="12" cy="9.500" r="2.500"/></svg>',
            heart: P('<path d="M12 20.500s-8-4.900-8-10.600A4.400 4.400 0 0 1 12 7.400a4.400 4.400 0 0 1 8 2.500c0 5.700-8 10.600-8 10.600z"/>'),
            chat: P('<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-5 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>'),
            chk: P('<path d="m5 12.500 4.500 4.500L19 7.500"/>'),
            exp: P('<circle cx="12" cy="12" r="9"/><path d="m15.500 8.500-2 5-5 2 2-5z"/>'),
            usr: P('<circle cx="9" cy="8" r="3.500"/><path d="M2.500 20c.6-3.600 3.200-5.500 6.500-5.500s5.900 1.900 6.500 5.500M16 5a3.500 3.500 0 0 1 0 6.500M18 14.700c1.800.7 3 2.400 3.500 5.300"/>'),
            home: P('<path d="M3 11 12 3l9 8v9H3z"/><path d="M9 20v-6h6v6"/>'),
            me: P('<circle cx="12" cy="8" r="4"/><path d="M4 20c.8-4 4-6 8-6s7.200 2 8 6"/>'),
            sh: P('<path d="M12 3 4.500 6v6c0 4.500 3.200 7.700 7.500 9 4.300-1.300 7.500-4.500 7.500-9V6z"/>'),
            plus: P('<path d="M12 5v14M5 12h14"/>'), chev: P('<path d="m9 6 6 6-6 6"/>')
        };
        function nv(n, l, ic, x) { return '<button class="nv" data-n="' + n + '"><span class="ic">' + ic + '</span>' + l + (x || "") + '</button>'; }
        IC.bed = P('<path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.500"/>');
        IC.wal = P('<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 14.500h2"/>');
        IC.cal = P('<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>');
        const SB = '<i class="nb sc"></i>';
        $("rail").innerHTML = sanitizeRenderedHtml('<div class="lg"><svg viewBox="0 0 24 24"><path d="M12 2.500 2.500 11H5v9h5.500v-6h3v6H19v-9h2.500z"/></svg></div>' + nv("explore", "Explore", IC.exp) + nv("saved", "Saved", IC.heart, SB) + nv("messages", "Messages", IC.chat, '<i class="nb mu"></i>') + nv("connections", "Connections", IC.usr) + nv("listings", "My listings", IC.home) + '<div class="sp"></div>' + nv("profile", "Profile", IC.me));
        $("bb").innerHTML = sanitizeRenderedHtml(nv("explore", "Explore", IC.exp) + nv("saved", "Saved", IC.heart, SB) + '<button class="nv" data-n="post" aria-label="Post a room"><span class="fab">' + IC.plus + '</span></button>' + nv("messages", "Messages", IC.chat, '<i class="nb mu"></i>') + nv("me", "Me", IC.me));
        function cf(n) { return n >= 100000 ? "₹" + (n / 100000).toFixed(2).replace(/\.?0+$/, "") + "L" : "₹" + Math.round(n / 1000) + "k"; }
        function fmt(n) { return "₹" + n.toLocaleString("en-IN"); }
        // --- Realtime Dynamic Compatibility Calculations ---
        function getActiveUserSignal() {
            const b = (currentProfile && typeof currentProfile.budget === 'number' && currentProfile.budget > 0)
                ? currentProfile.budget
                : (S.bud && S.bud < 100000 ? S.bud : (S.max && S.max < 100000 ? S.max : undefined));
            const bMin = b ? Math.max(5, Math.round((b * 0.7) / 1000)) : undefined;
            const bMax = b ? Math.round((b * 1.25) / 1000) : undefined;
            const areas = (currentProfile && currentProfile.localities && currentProfile.localities.length)
                ? currentProfile.localities
                : (currentProfile && currentProfile.locality)
                    ? [currentProfile.locality]
                    : (S.q ? [S.q] : []);
            let smoke = undefined;
            if (currentProfile) {
                const he = currentProfile.householdExpectations || {};
                const qa = currentProfile.quizAnswers || {};
                if (he.smokingPolicy === 'smoking_allowed' || qa.smoke === 'Smoker' || qa.smoking === 'yes' || qa.smoking === 'social') {
                    smoke = "Smoker";
                }
                else if (he.smokingPolicy === 'no_smoking' || qa.smoke === 'Non-smoker' || qa.smoking === 'never') {
                    smoke = "Non-smoker";
                }
            }
            let diet = undefined;
            if (currentProfile) {
                const he2 = currentProfile.householdExpectations || {};
                const qa2 = currentProfile.quizAnswers || {};
                diet = he2.dietPref || qa2.diet || qa2.food_pref || (currentProfile.lifestyle && currentProfile.lifestyle.diet) || undefined;
            }
            let sleep = undefined;
            if (currentProfile) {
                const he3 = currentProfile.householdExpectations || {};
                const qa3 = currentProfile.quizAnswers || {};
                sleep = he3.quietHoursPolicy || qa3.sleep || qa3.sleep_time || (currentProfile.lifestyle && currentProfile.lifestyle.sleep) || undefined;
            }
            return {
                budget: b,
                b: (bMin && bMax) ? [bMin, bMax] : undefined,
                bStr: (bMin && bMax) ? "₹" + bMin + "k–" + bMax + "k" : undefined,
                areas: areas,
                smoke: smoke,
                diet: diet,
                sleep: sleep,
            };
        }
        function calcRoomMatch(r) {
            if (!currentProfile || !r[21])
                return { total: 0, budgetPct: null, locationPct: null, lifestylePct: null };
            const listing = { ...r[21], monthlyRent: r[3], partnerShare: r[3] }, fit = getRoomMatchReasons(currentProfile, listing);
            return { total: fit.score, budgetPct: currentProfile.budget > 0 ? Math.round(fit.budgetScore / 25 * 100) : null, locationPct: currentProfile.city && listing.city ? Math.round(fit.locationScore / 20 * 100) : null, lifestylePct: Object.keys(currentProfile.quizAnswers || {}).length && (listing.houseRules || []).length ? Math.round(fit.rulesScore / 20 * 100) : null };
        }
        function parseBudget(t) {
            if (!t)
                return [0, 0];
            const m = String(t).match(/(\d+)k.*?(\d+)k/i);
            if (m)
                return [+m[1] * 1000, +m[2] * 1000];
            const nums = String(t).replace(/[^\d]/g, ' ').trim().split(/\s+/).filter(Boolean).map(Number);
            if (nums.length >= 2) {
                const n1 = nums[0] < 100 ? nums[0] * 1000 : nums[0];
                const n2 = nums[1] < 100 ? nums[1] * 1000 : nums[1];
                return [Math.min(n1, n2), Math.max(n1, n2)];
            }
            if (nums.length === 1) {
                const n = nums[0] < 100 ? nums[0] * 1000 : nums[0];
                return [n, n];
            }
            return [0, 0];
        }
        function parseMoveIn(str) {
            if (!str)
                return 0;
            const s = String(str).toLowerCase().trim();
            if (s.indexOf('now') > -1 || s.indexOf('imm') > -1)
                return 0;
            if (s.indexOf('15') > -1)
                return 15;
            if (s.indexOf('month') > -1 || s.indexOf('30') > -1)
                return 30;
            const now = new Date();
            const parsed = Date.parse(str + " " + now.getFullYear());
            if (!isNaN(parsed)) {
                const diffMs = parsed - now.getTime();
                const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                return diffDays > 0 ? diffDays : 0;
            }
            return 0;
        }
        function calcRoommateMatch(x, y) {
            if (!currentProfile || !x[17])
                return null;
            return Number.isFinite(x[17].compatibilityScore) ? x[17].compatibilityScore : calculateProfileCompatibility(currentProfile, x[17]).score;
        }
        function calcPGMatch(g) {
            if (!currentProfile || !g[18])
                return 0;
            return calculateRoomCompatibility(currentProfile, { ...g[18], monthlyRent: g[2], partnerShare: g[2] });
        }
        function list() {
            const r = D.filter(function (x) { return x[3] >= (S.min || 0) && x[3] <= S.max && x[5] <= S.move && (!S.types.length || S.types.indexOf(x[7]) > -1) && (!S.furn || x[8]) && (!S.ver || x[9]) && (S.gender == "Any" || x[10] == "Any" || x[10] == S.gender) && [x[1], x[2], x[21] && x[21].city].filter(Boolean).join(" ").toLowerCase().indexOf(S.q.toLowerCase().trim()) > -1; });
            r.forEach(function (x) { x[11] = calcRoomMatch(x).total; });
            r.sort(function (a, b) { return S.sort == "a" ? a[3] - b[3] : S.sort == "d" ? b[3] - a[3] : b[11] - a[11]; });
            return r;
        }
        function rml() {
            const q = (S.q || "").toLowerCase().trim();
            const indices = [];
            for (let i = 0; i < RM.length; i++) {
                const x = RM[i];
                if (!x || (S.nav === 'explore' && x[16] && x[16].isDiscoveryEligible === false))
                    continue;
                const y = RX[i] || [];
                x[7] = calcRoommateMatch(x, y);
                const b = parseBudget(x[4]);
                if (b[0] > S.max)
                    continue;
                if (q) {
                    const haystack = (x[1] + " " + x[2] + " " + x[3] + " " + (x[8] || []).join(" ")).toLowerCase();
                    if (haystack.indexOf(q) < 0)
                        continue;
                }
                if (S.ver && !x[6])
                    continue;
                if (S.gender && S.gender !== "Any") {
                    const gStr = String(x[11] || "").toLowerCase();
                    const tagStr = (x[8] || []).join(" ").toLowerCase();
                    const targetG = S.gender.toLowerCase();
                    if (gStr && gStr !== "any" && gStr.indexOf(targetG) < 0 && tagStr.indexOf(targetG) < 0) {
                        continue;
                    }
                }
                if (S.move < 999) {
                    const mDays = parseMoveIn(x[5]);
                    if (mDays > S.move)
                        continue;
                }
                indices.push(i);
            }
            indices.sort(function (ia, ib) {
                const a = RM[ia];
                const b = RM[ib];
                if (S.sort === "a") {
                    return parseBudget(a[4])[0] - parseBudget(b[4])[0];
                }
                else if (S.sort === "d") {
                    return parseBudget(b[4])[1] - parseBudget(a[4])[1];
                }
                else {
                    return b[7] - a[7];
                }
            });
            return indices;
        }
        const ART = '<svg viewBox="0 0 160 120" width="160" height="120" aria-hidden="true"><circle cx="80" cy="64" r="46" fill="var(--bs)"/><path d="M52 94V62l28-22 28 22v32z" fill="#f0541e"/><rect x="72" y="70" width="16" height="24" rx="4" fill="#fff"/><rect x="57" y="66" width="9" height="9" rx="2.500" fill="#fff" opacity=".7"/><rect x="94" y="66" width="9" height="9" rx="2.500" fill="#fff" opacity=".7"/><path d="M128 26l2.500 7 7 2.500-7 2.500-2.500 7-2.500-7-7-2.500 7-2.500z" fill="#f0541e"/><circle cx="32" cy="40" r="4" fill="#ff8a3d"/><circle cx="134" cy="86" r="3" fill="#ff8a3d"/></svg>';
        function em(t, d, x) { return '<div class="empty">' + ART + '<b>' + esc(t) + '</b>' + d + (x || "") + '</div>'; }
        const CAT_NAMES = ["All listings", "Rooms & flats", "Roommates", "PG & coliving"];
        const HUB = [["profile", "Profile", "Your details and preferences", IC.me], ["listings", "My listings", "Rooms you have posted", IC.home], ["connections", "My connections", "People you have connected with", IC.usr]];
        (RM = []);
        S.sub = 0;
        function chips(a) { return '<div class="subt">' + a.map(function (t, i) { return '<button class="chip" data-s="' + i + '" aria-pressed="' + (S.sub == i) + '">' + esc(t) + '</button>'; }).join("") + '</div>'; }
        function rc(x, i, m) {
            if (!x)
                return '';
            const targetUid = (x && x[9]) || '';
            // Defense-in-depth: Never render logged in user's own profile in Roommates
            if (authUser && (targetUid === authUser.uid || (authUser.email && targetUid === authUser.email)))
                return '';
            const rScore = calcRoommateMatch(x, RX[i]);
            x[7] = rScore;
            const mt = (typeof rScore === 'number')
                ? '<span class="mc"><i style="--m:' + rScore + '"></i>' + rScore + '% match</span>'
                : '<span class="mc" style="color:var(--ink2);font-weight:500;font-size:12px">More profile info needed for match</span>';
            const cardRelationship = relationshipState(authUser && authUser.uid, targetUid, LIVE_CONNS, currentProfile && currentProfile.blockedUserIds || [], CH.map(function (c) { return { id: c.id, participants: c.raw && c.raw.participants || [authUser && authUser.uid, c.p], authorized: c.authorized === true }; }));
            const ft = (cardRelationship.state === 'received' ? '' : mt) + connectionActionButtons(i);
            const init = (x && x[0] && x[0].length <= 3) ? x[0] : (x && x[1] ? x[1].split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase() : 'RM');
            const avContent = (x && x[10] && typeof x[10] === 'string' && /^(https?:|data:image\/)/.test(x[10]))
                ? '<img src="' + esc(x[10]) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" style="width:100%;height:100%;object-fit:cover;object-position:center;display:block;border-radius:inherit"><span style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-weight:700;font-size:18px">' + esc(init) + '</span>'
                : '<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;font-weight:700;font-size:18px">' + esc(init) + '</span>';
            // Canonical intent resolution
            const resolved = x[16];
            const activeIntents = (x[15] && Array.isArray(x[15])) ? x[15] : [];
            const rawIntent = (x && x[12]) || '';
            const isLiveInHost = Boolean(resolved ? resolved.isLiveInHost : (x[14] === 'live_in_host' || rawIntent.indexOf('Live-in Host') > -1 || rawIntent.indexOf('Room Available') > -1 || rawIntent === 'have_room' || rawIntent === 'Room available'));
            const isTeamUp = Boolean(resolved ? resolved.isTeamUpSeeker : (x[14] === 'team_up' || rawIntent.indexOf('Team Up') > -1 || rawIntent.indexOf('Flatmates') > -1 || rawIntent === 'team_up' || rawIntent.indexOf('roommate') > -1));
            const isFindRoom = Boolean(resolved ? resolved.isLookingForRoom : (x[14] === 'seeker' || rawIntent === 'find_room' || rawIntent.indexOf('Looking for a room') > -1));
            const badges = [];
            const haveRoomStyle = 'background:#fff3e0;color:#e65100;border:1px solid #ffe0b2;';
            const teamUpStyle = 'background:#e3f2fd;color:#1565c0;border:1px solid #bbdefb;';
            const findRoomStyle = 'background:#f0f4f8;color:#37474f;border:1px solid #cfd8dc;';
            // Strict check: Only show "Room available" if the user qualifies as genuine Live-in Host
            // with a valid associated active listing and required occupancy evidence
            if (isLiveInHost) {
                badges.push({ text: 'Room available', style: haveRoomStyle });
            }
            if (isTeamUp) {
                badges.push({ text: 'Looking for a roommate', style: teamUpStyle });
            }
            if (isFindRoom && !isLiveInHost && !isTeamUp) {
                badges.push({ text: 'Looking for a room', style: findRoomStyle });
            }
            else if (isFindRoom && activeIntents.includes('find_room') && !badges.some(function (b) { return b.text === 'Looking for a room'; })) {
                badges.push({ text: 'Looking for a room', style: findRoomStyle });
            }
            if (badges.length === 0) {
                badges.push({ text: 'Looking for a roommate', style: teamUpStyle });
            }
            const badgesHtml = badges.map(function (b) {
                return '<span class="rm-intent-badge" style="' + b.style + 'font-weight:600;font-size:11px;padding:2px 8px;border-radius:999px;display:inline-block;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">' + esc(b.text) + '</span>';
            }).join(' ');
            return '<article class="card rm" data-r="' + i + '"><div class="av2">' + avContent + (x[6] ? '<span class="vb" title="Verified">' + IC.chk + '</span>' : '') + '</div><div class="bd"><div class="tr"><div class="t">' + esc(x[1]) + '</div><button class="ib sv" data-id="r' + i + '" aria-pressed="' + (isProfileSaved(x, i) ? "true" : "false") + '" aria-label="Save">' + IC.heart + '</button></div><div class="rm-badge-row">' + badgesHtml + '</div><div class="loc">' + IC.pin + '<span>' + esc(x[3]) + (x[2] ? ' · ' + esc(x[2]) : '') + '</span></div><div class="fx"><div>' + IC.wal + esc(x[4]) + '</div><div>' + IC.cal + (x[5] == "Now" ? "Move in now" : "From " + esc(x[5])) + '</div></div><div class="tg">' + x[8].map(function (t) { return '<span>' + esc(t) + '</span>'; }).join("") + '</div><div class="ft">' + ft + '</div></div></article>';
        }
        S.room = 0;
        function rd(i) {
            let k;
            const x = D[i];
            if (!x)
                return em("Listing not found", "This room may have been taken or unlisted.");
            const posterName = x[16] || 'Host';
            const posterAv = x[17] || '';
            const f = posterName.split(" ")[0];
            const rmMatch = calcRoomMatch(x);
            const mt = rmMatch.total;
            x[11] = mt;
            const inc = (x[14] && x[14].length > 0) ? x[14] : (x[8] ? ["Furnished"] : []);
            const rules = (x[15] && x[15].length > 0) ? x[15] : [];
            const desc = x[18] || (x[1] + " located in " + x[2] + ".");
            const addr = x[19] || [x[2], x[21] && x[21].city].filter(Boolean).join(', ');
            const ot = [];
            for (k = 0; k < D.length; k++) {
                if (k !== i && D[k] && (D[k][2] === x[2] || Math.abs(D[k][3] - x[3]) <= 6000)) {
                    ot.push(k);
                    if (ot.length >= 3)
                        break;
                }
            }
            if (ot.length === 0) {
                for (k = 0; k < D.length; k++) {
                    if (k !== i && D[k]) {
                        ot.push(k);
                        if (ot.length >= 3)
                            break;
                    }
                }
            }
            const st = '<button class="ib sv" data-id="' + i + '" aria-pressed="' + (isRoomSaved(x, i) ? "true" : "false") + '" aria-label="Save">' + IC.heart + '</button>';
            const imgs = (x[13] && x[13].length > 0) ? x[13].filter(Boolean) : [];
            let galHtml = '';
            if (imgs.length === 0) {
                galHtml = '<div class="ph" style="height:260px;border-radius:22px;display:flex;align-items:center;justify-content:center;background:var(--bs);color:var(--brand);margin-bottom:28px">' +
                    '<svg style="width:52px;height:52px" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" d="M3 11 12 3l9 8v9H3z"/><path fill="none" stroke="currentColor" stroke-width="2" d="M9 20v-6h6v6"/></svg>' +
                    '</div>';
            }
            else if (imgs.length === 1) {
                galHtml = '<div class="gal" style="display:block;height:360px;margin-bottom:28px">' +
                    '<div class="ph" data-gal="1" style="width:100%;height:100%;border-radius:22px;overflow:hidden;cursor:pointer"><img src="' + esc(imgs[0]) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:22px"></div>' +
                    '<button class="ghb ga" data-gal="1">Show photo (1)</button>' +
                    '</div>';
            }
            else if (imgs.length === 2) {
                galHtml = '<div class="gal" style="grid-template-columns:1fr 1fr;grid-template-rows:360px">' +
                    '<div class="ph" data-gal="1" style="border-radius:22px 0 0 22px;cursor:pointer"><img src="' + esc(imgs[0]) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:22px 0 0 22px"></div>' +
                    '<div class="ph" data-gal="1" style="border-radius:0 22px 22px 0;cursor:pointer"><img src="' + esc(imgs[1]) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:0 22px 22px 0"></div>' +
                    '<button class="ghb ga" data-gal="1">Show all photos (2)</button>' +
                    '</div>';
            }
            else if (imgs.length === 3) {
                galHtml = '<div class="gal" style="grid-template-columns:2fr 1fr;grid-template-rows:176px 176px">' +
                    '<div class="ph" data-gal="1" style="grid-row:1/3;border-radius:22px 0 0 22px;cursor:pointer"><img src="' + esc(imgs[0]) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:22px 0 0 22px"></div>' +
                    '<div class="ph" data-gal="1" style="border-radius:0 22px 0 0;cursor:pointer"><img src="' + esc(imgs[1]) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:0 22px 0 0"></div>' +
                    '<div class="ph" data-gal="1" style="border-radius:0 0 22px 0;cursor:pointer"><img src="' + esc(imgs[2]) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:0 0 22px 0"></div>' +
                    '<button class="ghb ga" data-gal="1">Show all photos (3)</button>' +
                    '</div>';
            }
            else if (imgs.length === 4) {
                galHtml = '<div class="gal" style="grid-template-columns:1fr 1fr;grid-template-rows:176px 176px">' +
                    '<div class="ph" data-gal="1" style="border-radius:22px 0 0 0;cursor:pointer"><img src="' + esc(imgs[0]) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:22px 0 0 0"></div>' +
                    '<div class="ph" data-gal="1" style="border-radius:0 22px 0 0;cursor:pointer"><img src="' + esc(imgs[1]) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:0 22px 0 0"></div>' +
                    '<div class="ph" data-gal="1" style="border-radius:0 0 0 22px;cursor:pointer"><img src="' + esc(imgs[2]) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:0 0 0 22px"></div>' +
                    '<div class="ph" data-gal="1" style="border-radius:0 0 22px 0;cursor:pointer"><img src="' + esc(imgs[3]) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:0 0 22px 0"></div>' +
                    '<button class="ghb ga" data-gal="1">Show all photos (4)</button>' +
                    '</div>';
            }
            else {
                const count = Math.min(5, imgs.length);
                galHtml = '<div class="gal">';
                for (let g = 0; g < count; g++) {
                    galHtml += '<div class="ph" data-gal="1" style="cursor:pointer"><img src="' + esc(imgs[g]) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover"></div>';
                }
                galHtml += '<button class="ghb ga" data-gal="1">Show all photos (' + imgs.length + ')</button></div>';
            }
            const posterAvContent = posterAv
                ? '<img src="' + esc(posterAv) + '" alt="' + esc(posterName) + '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">'
                : (posterName.split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('') || 'H');
            const isOwn = Boolean(authUser && (x[20] === authUser.uid || (x[12] && MY.some(function (m) { return m && m.id === x[12]; }))));
            const sideCtas = isOwn
                ? '<span class="tag" style="background:#e8f5e9;color:#2e7d32;font-weight:700;padding:6px 14px;border-radius:20px;font-size:13px;display:inline-block;margin-bottom:12px">Your Listing</span><button class="msgb big" data-la="edit" data-q="' + (x[12] || i) + '"><em>Edit Listing</em></button><button class="ghb" data-n="listings">Manage in My listings</button>'
                : listingCommunicationButtons('r', i, true) + '<button class="ghb" data-apply-place="' + esc(x[12]) + '">Apply / application</button><button class="ghb" data-save="' + i + '">' + (isRoomSaved(x, i) ? "Saved ✓" : "Save for later") + '</button>';
            const bottomCta = isOwn
                ? '<button class="msgb" data-la="edit" data-q="' + (x[12] || i) + '"><em>Edit Listing</em></button>'
                : '<button class="ghb" data-apply-place="' + esc(x[12]) + '">Apply</button>' + listingCommunicationButtons('r', i);
            return '<div class="rd"><button class="ghb back" data-n="' + (S.back || "explore") + '">← Back</button>' + galHtml +
                '<div class="rl"><div class="mn"><section><div class="tgs"><span>' + esc(x[0]) + '</span>' + (x[9] ? '<span class="ok">✓ Verified listing</span>' : '') + (x[8] ? '<span>Furnished</span>' : '') + '<span>' + esc(x[7]) + '</span></div><h2>' + esc(x[1]) + '</h2><div class="tl"><div class="loc">' + IC.pin + esc(addr) + '</div><span class="sp2"></span><button class="ghb" data-shr2="1">Share</button>' + st + '<button class="ghb" data-rpt="l">Report</button></div></section>' +
                '<section><div class="kf"><div><small>Rent</small><b>' + fmt(x[3]) + '</b><span>per month</span></div><div><small>Deposit</small><b>' + (x[21] && x[21].deposit != null ? fmt(x[4]) : 'Not provided') + '</b><span>' + (x[21] && x[21].deposit != null ? (x[4] === 0 ? 'No deposit' : 'As listed') : '') + '</span></div><div><small>Available</small><b>' + (x[6] == "Now" ? "Now" : esc(x[6])) + '</b><span>move-in</span></div><div><small>Looking for</small><b>' + esc(x[21] && Number.isInteger(x[21].partnersNeeded) ? x[21].partnersNeeded + ' roommate(s)' : 'Not provided') + '</b><span>' + (x[10] == "Any" ? "Any gender" : esc(x[10])) + '</span></div></div></section>' +
                '<section><h3>About this place</h3><p style="color:var(--ink2);line-height:1.65;font-size:15px;margin:0 0 16px">' + esc(desc) + '</p></section>' +
                (inc.length ? '<section><h3>Included in rent</h3><div class="inc">' + inc.map(function (t) { return '<div><i>' + IC.chk + '</i>' + esc(t) + '</div>'; }).join("") + '</div></section>' : '') +
                (rules.length ? '<section><h3>House rules</h3><div class="inc">' + rules.map(function (t) { return '<div><i>' + IC.chk + '</i>' + esc(t) + '</div>'; }).join("") + '</div></section>' : '') +
                '<section><div class="mh"><div class="ring" style="--m:' + rmMatch.total + '"><b>' + rmMatch.total + '%</b></div><div><h3 style="margin:0">Why this matches you</h3><span style="color:var(--ink2);font-size:14px">Based on your matching preferences</span></div></div><div class="bars">' + [['Budget', rmMatch.budgetPct], ['Location', rmMatch.locationPct], ['Lifestyle', rmMatch.lifestylePct]].map(function (factor) { return '<div>' + factor[0] + '<u style="--w:' + (factor[1] == null ? 0 : factor[1]) + '%"></u><b>' + (factor[1] == null ? 'Unknown' : factor[1] + '%') + '</b></div>'; }).join('') + '</div></section>' +
                '<section><div class="safe">' + IC.sh + '<div><b>Stay safe</b><br>Never pay before you visit and verify the place. <a href="#">Read the Trust center</a></div></div></section>' +
                (ot.length ? '<section><h3>Similar rooms</h3><div class="sim">' + ot.map(function (k) {
                    const y = D[k];
                    const simImg = (y[13] && y[13][0]) ? '<img src="' + esc(y[13][0]) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover">' : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--bs);color:var(--brand)"><svg style="width:36px;height:36px" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" d="M3 11 12 3l9 8v9H3z"/></svg></div>';
                    return '<div data-i="' + k + '"><div class="ph">' + simImg + '</div><b>' + esc(y[1]) + '</b><small>' + esc(y[2]) + ' · ' + fmt(y[3]) + '</small></div>';
                }).join("") + '</div></section>' : '') + '</div>' +
                '<aside class="ra"><div class="rc2"><div class="rp"><b>' + fmt(x[3]) + '</b><span> / month</span></div><div class="sm">Deposit ' + fmt(x[4]) + ' · ' + (x[6] == "Now" ? "Available now" : "From " + esc(x[6])) + '</div>' + sideCtas + '<div class="who"><div class="av2">' + posterAvContent + '</div><div>' + esc(posterName) + (x[9] ? ' <span style="color:var(--ok)">✓</span>' : '') + '<small>Posted this room</small></div></div></div></aside></div>' +
                '<div class="rbar"><div><b>' + fmt(x[3]) + '</b><span> / mo</span></div>' + bottomCta + '</div></div>';
        }
        const YOU = { b: [0, 0], areas: [], smoke: "", diet: "", sleep: "" };
        (RX = []);
        S.rmi = 0;
        S.back = "explore";
        const CN = {};
        (LIVE_CONNS = { accepted: [], received: [], sent: [], restricted: [] });
        function connectionNotificationTab(id) { const request = [].concat(LIVE_CONNS.accepted, LIVE_CONNS.received, LIVE_CONNS.sent).find(function (c) { return c && c.id === id; }); return request && request.status === 'accepted' ? 0 : request && request.fromUserId === authUser.uid ? 2 : 1; }
        const CONNECTION_BUSY = {};
        const APPLICATION_ANS = {};
        function connectionActionButtons(i, big = false) {
            const target = RM[i] && RM[i][9];
            const relationship = relationshipState(authUser && authUser.uid, target, LIVE_CONNS, currentProfile && currentProfile.blockedUserIds || [], CH.map(function (c) { return { id: c.id, participants: c.raw && c.raw.participants || [authUser && authUser.uid, c.p], authorized: c.authorized === true }; }));
            const cls = big ? 'msgb big' : 'msgb';
            if (CONNECTION_BUSY[target])
                return '<button class="' + cls + '" disabled>Sending request…</button>';
            if (relationship.state === 'accepted')
                return '<button class="' + cls + '" data-msg="m:' + i + '">' + IC.chat + '<em>Message</em></button>';
            if (relationship.state === 'sent')
                return '<span class="tag">Pending</span><button class="gh" data-withdraw="' + esc(relationship.connectionId) + '" data-r-idx="' + i + '">Withdraw</button>';
            if (relationship.state === 'received')
                return '<button class="gh" data-conn-act="decline" data-conn-id="' + esc(relationship.connectionId) + '" data-r-idx="' + i + '">Decline</button><button class="' + cls + '" data-conn-act="accept" data-conn-id="' + esc(relationship.connectionId) + '" data-r-idx="' + i + '">Accept</button>';
            const label = { self: 'Your profile', unavailable: 'Profile unavailable', blocked: 'Connection blocked', restricted: 'Connection unavailable' }[relationship.state];
            if (label)
                return '<button class="' + cls + '" disabled>' + label + '</button>';
            return '<button class="' + cls + '" data-conn="' + i + '">' + IC.usr + '<em>Connect</em></button>';
        }
        function listingCommunicationButtons(kind, i, big = false) {
            const row = kind === 'r' ? D[i] : G[i];
            const uid = row && row[kind === 'r' ? 20 : 17];
            const relation = relationshipState(authUser && authUser.uid, uid, LIVE_CONNS, currentProfile && currentProfile.blockedUserIds || [], CH.map(function (c) { return { id: c.id, participants: c.raw && c.raw.participants || [authUser && authUser.uid, c.p], authorized: c.authorized === true }; }));
            const cls = big ? 'msgb big' : 'msgb';
            if (relation.state === 'sent') return '<span class="tag">Pending</span><button class="gh" data-withdraw="' + esc(relation.connectionId) + '">Withdraw</button>';
            if (relation.state === 'received') return '<button class="gh" data-conn-act="decline" data-conn-id="' + esc(relation.connectionId) + '">Decline</button><button class="' + cls + '" data-conn-act="accept" data-conn-id="' + esc(relation.connectionId) + '">Accept</button>';
            const disabled = { self: 'Your listing', unavailable: 'Sign in to connect', blocked: 'Connection blocked', restricted: 'Connection unavailable' }[relation.state];
            if (disabled && authUser) return '<button class="' + cls + '" disabled>' + disabled + '</button>';
            return '<button class="' + cls + '" data-msg="' + kind + ':' + i + '" aria-label="' + (relation.state === 'accepted' ? 'Message the poster' : 'Connect with the poster') + '">' + IC.chat + '<em>' + (relation.state === 'accepted' ? 'Message' : 'Connect') + '</em></button>';
        }
        let CONN_ID_MAP = {};
        function bn(t) {
            const b = parseBudget(t);
            return [Math.round(b[0] / 1000), Math.round(b[1] / 1000)];
        }
        function formatPrefLabel(val) {
            if (!val)
                return 'Not provided';
            const s = String(val).trim();
            if (s === 'veg')
                return 'Vegetarian';
            if (s === 'non_veg' || s === 'nonveg')
                return 'Non-vegetarian';
            if (s === '10_to_12')
                return '10 PM – 12 AM';
            if (s === 'before_10')
                return 'Before 10 PM';
            if (s === 'after_12')
                return 'After 12 AM';
            return s;
        }
        function rdr(i) {
            const x = RM[i];
            if (!x)
                return em("Profile not found", "This roommate profile is no longer available.");
            const y = RX[i] || ["", "", "", "", "", ""];
            const f = x[1].split(" ")[0];
            const uSig = getActiveUserSignal();
            const b = parseBudget(x[4]);
            const minB_k = Math.round(b[0] / 1000);
            const maxB_k = Math.round(b[1] / 1000);
            const uB = (uSig && uSig.b) ? uSig.b : [0, 0];
            const ov = b[1] > 0 && uB[1] > 0 && minB_k <= uB[1] && maxB_k >= uB[0];
            const uAreas = (uSig && uSig.areas && uSig.areas.length) ? uSig.areas : [];
            const ar = uAreas.some(function (a) { return x[3].toLowerCase().indexOf(a.toLowerCase()) > -1 || a.toLowerCase().indexOf(x[3].toLowerCase()) > -1; });
            const theirMove = Date.parse(x[17] && x[17].moveInDate || ''), myMove = Date.parse(currentProfile && currentProfile.moveInDate || '');
            const mv = Number.isFinite(theirMove) && Number.isFinite(myMove) && Math.abs(theirMove - myMove) <= 14 * 86400000;
            const rScore = calcRoommateMatch(x, y);
            x[7] = rScore;
            const rmDiet = String(y[0] || '').toLowerCase();
            const rmSmoke = String(y[1] || '').toLowerCase();
            const rmSleep = String(y[2] || '').toLowerCase();
            const uDiet = String((uSig && uSig.diet) || '').toLowerCase();
            const uSmoke = String((uSig && uSig.smoke) || '').toLowerCase();
            const uSleep = String((uSig && uSig.sleep) || '').toLowerCase();
            const smMatch = !!uSmoke && !!rmSmoke && ((uSmoke.indexOf('non') > -1) === (rmSmoke.indexOf('non') > -1));
            const dtMatch = !!uDiet && !!rmDiet && ((uDiet.indexOf('non') > -1) === (rmDiet.indexOf('non') > -1));
            const slMatch = !!uSleep && !!rmSleep && (uSleep === rmSleep || uSleep.indexOf('flex') > -1 || rmSleep.indexOf('flex') > -1 || (uSleep.indexOf('early') > -1 && rmSleep.indexOf('early') > -1));
            const rows = [
                ["Budget", x[4], (uSig && uSig.bStr) || ("₹" + uB[0] + "k–" + uB[1] + "k"), ov],
                ["Area", x[3], uAreas[0] || "Not provided", ar],
                ["Move-in", x[5] == "Now" ? "Now" : "From " + x[5], (currentProfile && currentProfile.moveInDate) || "Not provided", mv],
                ["Smoking", formatPrefLabel(y[1]), formatPrefLabel((uSig && uSig.smoke) || ""), smMatch],
                ["Diet", formatPrefLabel(y[0]), formatPrefLabel((uSig && uSig.diet) || ""), dtMatch],
                ["Sleep", formatPrefLabel(y[2]), formatPrefLabel((uSig && uSig.sleep) || ""), slMatch]
            ];
            const n = rows.filter(function (r) { return r[3]; }).length;
            const fitBudgetLimit = (uSig && uSig.b && uSig.b[1]) ? uSig.b[1] * 1000 : 25000;
            const fit = D.filter(function (d) { return d[3] <= Math.min(b[1], fitBudgetLimit); }).slice(0, 3);
            const isSelf = Boolean(authUser && (x[9] === authUser.uid || (authUser.email && x[9] === authUser.email)));
            const cb = connectionActionButtons(i, true);
            const rmInit = (x && x[0] && x[0].length <= 3) ? x[0] : (x && x[1] ? x[1].split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase() : 'RM');
            const rmAv = (x && x[10] && typeof x[10] === 'string' && x[10].startsWith('http'))
                ? '<img src="' + esc(x[10]) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" style="width:100%;height:100%;object-fit:cover;border-radius:inherit"><span style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-weight:700;font-size:24px">' + esc(rmInit) + '</span>'
                : '<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;font-weight:700;font-size:24px">' + esc(rmInit) + '</span>';
            // Host listing lookup for Live-in Host
            const isLiveInHost = Boolean(x[16] ? x[16].isLiveInHost : (x[14] === 'live_in_host' || (x[12] && x[12].indexOf('Room Available') > -1) || x[12] === 'have_room' || x[12] === 'Room available'));
            const isTeamUp = Boolean(x[16] ? x[16].isTeamUpSeeker : (x[14] === 'team_up' || (x[12] && x[12].indexOf('Team Up') > -1) || x[12] === 'team_up'));
            const rdrBadge = isLiveInHost
                ? '<span class="tag rm-intent-badge" style="background:#fff3e0;color:#e65100;border:1px solid #ffe0b2;font-weight:600;font-size:12px;padding:3px 10px;border-radius:999px">Room available</span>'
                : isTeamUp
                    ? '<span class="tag rm-intent-badge" style="background:#e3f2fd;color:#1565c0;border:1px solid #bbdefb;font-weight:600;font-size:12px;padding:3px 10px;border-radius:999px">Looking for a roommate</span>'
                    : '<span class="tag rm-intent-badge" style="background:#f0f4f8;color:#37474f;border:1px solid #cfd8dc;font-weight:600;font-size:12px;padding:3px 10px;border-radius:999px">Looking for a room</span>';
            const assocListId = (x && x[13]) || '';
            let hostListingSection = '';
            if (isLiveInHost && assocListId) {
                let hostListing = null;
                let hostListingIdx = -1;
                for (let k = 0; k < D.length; k++) {
                    if (D[k] && D[k][12] === assocListId) {
                        hostListing = D[k];
                        hostListingIdx = k;
                        break;
                    }
                }
                if (hostListing) {
                    const hlImg = (hostListing[13] && hostListing[13][0])
                        ? '<img src="' + esc(hostListing[13][0]) + '" alt="' + esc(hostListing[1]) + '" loading="lazy">'
                        : '<div class="hl-fallback"><svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" d="M3 11 12 3l9 8v9H3z"/></svg></div>';
                    hostListingSection = '<section class="hl-sec"><h3>Available room at ' + esc(f) + '\'s place</h3>' +
                        '<div class="card-room-preview" data-i="' + hostListingIdx + '" role="button" tabindex="0">' +
                        '<div class="hl-thumb">' + hlImg + '</div>' +
                        '<div class="hl-info">' +
                        '<b class="hl-title">' + esc(hostListing[1]) + '</b>' +
                        '<small class="hl-meta">' + esc(hostListing[2]) + ' · ' + fmt(hostListing[3]) + ' / mo</small>' +
                        '<span class="hl-link">View room listing →</span>' +
                        '</div>' +
                        '</div>' +
                        '</section>';
                }
            }
            const rmMatchScore = typeof x[7] === 'number' ? x[7] : (typeof x[7] === 'string' && !isNaN(parseInt(x[7])) ? parseInt(x[7]) : null);
            const matchDisplayStr = rmMatchScore !== null ? rmMatchScore + '%' : '—';
            const matchRingVal = rmMatchScore !== null ? rmMatchScore : 0;
            const matchSubText = rmMatchScore !== null ? 'Weighted fit from available preferences' : 'Preferences overview';
            return '<div class="rd"><button class="ghb back" data-n="' + (S.back || "explore") + '">← Back</button><div class="rl"><div class="mn">' +
                '<section><div class="rh"><div class="av2">' + rmAv + (x[6] ? '<span class="vb" title="Verified">' + IC.chk + '</span>' : '') + '</div><div class="rh-info"><div class="tgs">' + rdrBadge + (x[6] ? '<span class="ok">✓ ID verified</span>' : '<span style="background:var(--sunk);color:var(--ink2)">Not verified yet</span>') + '</div><h2>' + esc(x[1]) + '</h2><div class="loc" style="margin:0">' + IC.pin + esc(x[3]) + ' · ' + esc(x[2]) + '</div></div></div><p style="margin-top:16px;color:var(--ink2);max-width:60ch;line-height:1.6">' + esc(y[5]) + '</p><div class="tg" style="margin-top:12px">' + x[8].map(function (t) { return '<span>' + esc(t) + '</span>'; }).join("") + '</div></section>' +
                hostListingSection +
                '<section class="cmp-sec"><h3>You and ' + esc(f) + '</h3><div style="color:var(--ink2);font-size:14px;margin:-8px 0 12px">' + esc((x[17] && x[17].compatibilityReasons || []).join(' ? ') || 'Only provided preferences count towards this score.') + '</div><div class="cmp"><div class="h"></div><div class="h">' + esc(f) + '</div><div class="h">You</div><div class="h"></div>' + rows.map(function (r) { return '<div style="color:var(--ink2)">' + esc(r[0]) + '</div><div><b style="font-weight:600">' + esc(r[1]) + '</b></div><div>' + esc(r[2]) + '</div><div class="' + (r[3] ? "okc" : "df") + '" title="' + (r[3] ? "Matches" : "Different") + '">' + (r[3] ? "✓" : "≠") + '</div>'; }).join("") + '</div></section>' +
                '<section class="lf-sec"><h3>Lifestyle</h3><div class="lf"><div><small>Diet</small><b>' + formatPrefLabel(y[0]) + '</b></div><div><small>Smoking</small><b>' + formatPrefLabel(y[1]) + '</b></div><div><small>Sleep</small><b>' + formatPrefLabel(y[2]) + '</b></div><div><small>Guests</small><b>' + formatPrefLabel(y[3]) + '</b></div><div><small>Cleanliness</small><b>' + formatPrefLabel(y[4]) + '</b></div><div><small>Budget</small><b>' + esc(x[4]) + '</b></div></div></section>' +
                (fit.length ? '<section class="fit-sec"><h3>Rooms that fit you both</h3><div class="sim-rooms">' + fit.map(function (d) {
                    const k = D.indexOf(d);
                    const fitImg = (d[13] && d[13][0])
                        ? '<img src="' + esc(d[13][0]) + '" alt="" loading="lazy">'
                        : '<div class="hl-fallback"><svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" d="M3 11 12 3l9 8v9H3z"/></svg></div>';
                    return '<div class="sim-card" data-i="' + k + '" role="button" tabindex="0"><div class="ph">' + fitImg + '</div><b class="sim-title">' + esc(d[1]) + '</b><small class="sim-meta">' + esc(d[2]) + ' · ' + fmt(d[3]) + '</small></div>';
                }).join("") + '</div></section>' : '') +
                '<section class="tru-sec"><h3>Trust</h3><div class="tru"><div><i class="' + (x[6] ? "" : "no") + '">' + (x[6] ? "✓" : "–") + '</i>Government ID ' + (x[6] ? "verified" : "not verified yet") + '</div><div><i class="no">–</i>Phone verification not established</div></div>' +
                (x[6] ? '' : '<div class="safe" style="margin-top:12px">' + IC.sh + '<div>This profile has not completed ID verification. Meet in a public place first and never pay in advance.</div></div>') + '<div style="margin-top:14px"><button class="ghb" data-rpt="p">Report this profile</button></div></section></div>' +
                '<aside class="ra"><div class="rc2"><div class="cr"><div class="ring" style="--m:' + matchRingVal + '"><b>' + matchDisplayStr + '</b></div><div><b>Compatibility</b><small>' + matchSubText + '</small></div></div>' + cb + '<button class="ghb" data-save="r' + i + '">' + (isProfileSaved(x, i) ? "Saved ✓" : "Save profile") + '</button></div></aside></div>' +
                '<div class="rbar"><div><b>' + matchDisplayStr + '</b><span>' + (rmMatchScore !== null ? ' match' : ' overview') + '</span></div>' + connectionActionButtons(i) + '</div></div>';
        }
        const PAGINATION_STATE = {
            placesCursor: null,
            placesHasMore: false,
            placesLoading: false,
            roommatesCursor: null,
            roommatesHasMore: false,
            roommatesLoading: false,
        };
        function mapRoomToTuple(r) {
            return [
                r.flatType,
                r.title,
                r.locality,
                r.rent,
                r.deposit,
                r.moveInDays,
                r.availableFrom,
                r.roomType,
                r.isFurnished,
                r.isOwnerVerified,
                r.preferredGender,
                r.matchPct,
                r.id,
                r.images || [],
                r.amenities || [],
                r.houseRules || [],
                r.ownerName || '',
                r.ownerAvatar || '',
                r.description || '',
                r.address || '',
                r.ownerId || '', r.raw || {}
            ];
        }
        function mapPgToTuple(g) {
            const item = [
                g.title,
                g.locality,
                g.rent,
                g.sharingType,
                g.foodAmenities,
                g.residentsGender,
                g.deposit,
                g.availableFrom,
                g.isVerified,
                g.matchPct,
                g.tag,
                g.id,
                g.images || [],
                g.managerName || '',
                g.managerAvatar || '',
                [], [], g.ownerId || (g.raw && g.raw.ownerId) || '', g.raw || {}
            ];
            item.pg = 1;
            return item;
        }
        function mapRoommateToTuple(m) {
            return [
                m.initials,
                m.name,
                m.profession,
                m.locality,
                m.budgetStr,
                m.moveInStr,
                m.isVerified ? 1 : 0,
                m.matchPct,
                m.tags || [],
                m.uid,
                m.avatar || '',
                (m.raw && m.raw.gender) || (m.tags && m.tags.includes('Female') ? 'Female' : m.tags && m.tags.includes('Male') ? 'Male' : 'Any'),
                (m.resolvedIntent && m.resolvedIntent.displayBadge.text) || m.housingIntent || 'Roommate',
                m.associatedListingId || (m.resolvedIntent && m.resolvedIntent.associatedListingId) || '',
                (m.resolvedIntent && m.resolvedIntent.displayBadge.variant) || 'unknown',
                (m.resolvedIntent && m.resolvedIntent.activeIntents) || (m.housingIntent ? [m.housingIntent] : []),
                m.resolvedIntent || null, m.raw || {}
            ];
        }
        async function ensurePerson(uid) {
            let index = RM.findIndex(function (m) { return m && m[9] === uid; });
            if (index >= 0)
                return index;
            const person = await fetchPersonByIdBackend(uid);
            if (disposed)
                return -1;
            index = RM.findIndex(function (m) { return m && m[9] === uid; });
            if (index >= 0)
                return index;
            index = RM.length;
            RM.push(mapRoommateToTuple(person));
            RX.push([person.diet || "", person.smoking || "", person.sleep || "", person.guests || "", person.cleanliness || "", person.bio || ""]);
            return index;
        }
        async function openPersonByUid(uid, origin) {
            try {
                const index = await ensurePerson(uid);
                if (disposed || index < 0)
                    return;
                S.rmi = index;
                S.back = origin || S.nav;
                S.nav = "roommate";
                render();
                scrollTo(0, 0);
            }
            catch (error) {
                toast(error.message || "Profile unavailable");
            }
        }
        async function resolvePlace(id) {
            let ri = D.findIndex(function (x) { return x[12] === id; }), pi = G.findIndex(function (x) { return x[11] === id; });
            if (ri < 0 && pi < 0) {
                const place = await fetchPlaceByIdBackend(id, currentProfile);
                if (disposed)
                    return;
                if (place.roomType !== undefined) {
                    ri = D.length;
                    D.push(mapRoomToTuple(place));
                }
                else {
                    pi = G.length;
                    G.push(mapPgToTuple(place));
                }
            }
            return { room: ri, pg: pi };
        }
        let savedFetchPending = false;
        async function fetchSavedPlacesAndProfiles() {
            if (disposed || !currentProfile || savedFetchPending) return;
            const missingRooms = (currentProfile.savedRoomIds || []).filter(function (id) {
                return !D.some(function (d) { return d[12] === id; }) && !G.some(function (g) { return g[11] === id; });
            });
            const missingProfiles = (currentProfile.savedProfileIds || []).filter(function (id) {
                return !RM.some(function (m) { return m && m[9] === id; });
            });
            if (!missingRooms.length && !missingProfiles.length) return;
            savedFetchPending = true;
            try {
                const tasks = [];
                missingRooms.forEach(function (id) { tasks.push(resolvePlace(id)); });
                missingProfiles.forEach(function (id) { tasks.push(ensurePerson(id)); });
                await Promise.allSettled(tasks);
                if (!disposed && S.nav === "saved") {
                    render();
                }
            } catch (err) {
                console.error("fetchSavedPlacesAndProfiles error:", err);
            } finally {
                savedFetchPending = false;
            }
        }
        addDocListener("click", async function (e) {
            const b = e.target.closest('[data-apply-place],[data-app-submit],[data-app-own]');
            if (!b)
                return;
            if (!authUser) {
                openAuthModal();
                return;
            }
            b.disabled = true;
            try {
                if (b.dataset.applyPlace) {
                    const place = await fetchPlaceByIdBackend(b.dataset.applyPlace, currentProfile);
                    const qs = place.raw.screeningQuestions || [];
                    const own = await fetchOwnApplicationBackend(b.dataset.applyPlace);
                    sheetRows((own ? ['<p>Application: ' + esc(applicationLabels[own.status] || own.status) + '</p>', '<button class="ghb" data-app-own="' + own.id + '" data-status="withdrawn">Withdraw application</button>'].concat(own.status === 'selected' ? ['<button class="ghb" data-app-own="' + own.id + '" data-status="declined_by_applicant">Decline selection</button>'] : []) : []).concat(qs.map(function (q, i) { return '<label>' + esc(q) + '<textarea class="tx" id="answer-' + i + '" maxlength="2000"></textarea></label>'; })).concat(['<button class="msgb" data-app-submit="' + place.id + '" data-questions="' + esc(JSON.stringify(qs)) + '">Apply</button>']));
                }
                else if (b.dataset.appSubmit) {
                    const answers = {}, questions = JSON.parse(b.dataset.questions);
                    questions.forEach(function (q, i) { answers[q] = $('answer-' + i).value; });
                    await submitApplicationBackend(b.dataset.appSubmit, answers);
                    toast("Application submitted");
                    $("cfo").classList.remove("o");
                }
                else {
                    await updateApplicationStatusBackend(b.dataset.appOwn, b.dataset.status);
                    toast("Application updated");
                    $("cfo").classList.remove("o");
                }
            }
            catch (error) {
                toast(error.message || "Application could not be updated");
            }
            finally {
                b.disabled = false;
            }
        });
        let placesRequestVersion = 0, roommatesRequestVersion = 0;
        async function loadPlacesPage(isInitial) {
            if (disposed)
                return;
            if (PAGINATION_STATE.placesLoading && !isInitial)
                return;
            const requestVersion = ++placesRequestVersion;
            if (isInitial) {
                D = [];
                G = [];
                PAGINATION_STATE.placesCursor = null;
                PAGINATION_STATE.placesHasMore = false;
            }
            PAGINATION_STATE.placesError = false;
            PAGINATION_STATE.placesLoading = true;
            if (!isInitial)
                render();
            try {
                const catKey = S.cat === 1 ? 'rooms' : S.cat === 3 ? 'pg' : 'all';
                const cursor = isInitial ? null : PAGINATION_STATE.placesCursor;
                const res = await fetchBoundedExploreListings({
                    category: catKey,
                    city: S.city || undefined,
                    filters: { q: S.q, min: S.min, max: S.max, move: S.move, types: S.types, propertyType: S.propertyType, furn: S.furn, ver: S.ver, gender: S.gender },
                    pageSize: 12,
                    cursorDoc: cursor,
                    currentUserProfile: currentProfile,
                    maxReadBudget: 36
                });
                if (disposed || requestVersion !== placesRequestVersion)
                    return;
                const existingRoomIds = new Set(D.map(function (d) { return d[12]; }));
                const existingPgIds = new Set(G.map(function (g) { return g[11]; }));
                const newRooms = isInitial
                    ? (res.rooms || []).map(mapRoomToTuple)
                    : (res.rooms || []).filter(function (r) { return !existingRoomIds.has(r.id); }).map(mapRoomToTuple);
                const newPgs = isInitial
                    ? (res.pgs || []).map(mapPgToTuple)
                    : (res.pgs || []).filter(function (p) { return !existingPgIds.has(p.id); }).map(mapPgToTuple);
                if (isInitial) {
                    D = newRooms;
                    G = newPgs;
                }
                else {
                    D = D.concat(newRooms);
                    G = G.concat(newPgs);
                }
                if (S.nav === 'saved' && currentProfile) {
                    await Promise.allSettled((currentProfile.savedRoomIds || []).map(resolvePlace));
                    if (disposed)
                        return;
                }
                D.forEach(function (x, i) {
                    if (isRoomSaved(x, i)) {
                        SV[i] = true;
                        if (x[12]) SV[x[12]] = true;
                    }
                });
                G.forEach(function (x, i) {
                    if (isPgSaved(x, i)) {
                        SV["p" + i] = true;
                        if (x[11]) {
                            SV[x[11]] = true;
                            SV["p" + x[11]] = true;
                        }
                    }
                });
                const requestedRoom = searchParams.get("room");
                if (requestedRoom) {
                    const resolved = await resolvePlace(requestedRoom);
                    if (disposed)
                        return;
                    if (resolved.room >= 0) {
                        S.room = resolved.room;
                        S.nav = "room";
                    }
                    else if (resolved.pg >= 0) {
                        S.pg = resolved.pg;
                        S.nav = "pg";
                    }
                }
                PAGINATION_STATE.placesCursor = res.cursorDoc;
                PAGINATION_STATE.placesHasMore = res.hasMore;
            }
            catch (err) {
                if (disposed || requestVersion !== placesRequestVersion)
                    return;
                PAGINATION_STATE.placesError = true;
                console.error('loadPlacesPage error:', err);
                PAGINATION_STATE.placesHasMore = false;
            }
            finally {
                if (!disposed && requestVersion === placesRequestVersion) {
                    PAGINATION_STATE.placesLoading = false;
                    render();
                }
            }
        }
        async function loadRoommatesPage(isInitial) {
            if (disposed)
                return;
            if (PAGINATION_STATE.roommatesLoading && !isInitial)
                return;
            const requestVersion = ++roommatesRequestVersion;
            PAGINATION_STATE.roommatesError = false;
            PAGINATION_STATE.roommatesLoading = true;
            if (!isInitial)
                render();
            try {
                const cursor = isInitial ? null : PAGINATION_STATE.roommatesCursor;
                const res = await fetchBoundedExploreRoommates({
                    pageSize: 12,
                    cursorDoc: cursor,
                    currentUid: authUser ? authUser.uid : undefined,
                    currentUserProfile: currentProfile,
                    maxReadBudget: 48
                });
                if (disposed || requestVersion !== roommatesRequestVersion)
                    return;
                const existingUids = new Set(RM.map(function (r) { return r[9]; }));
                const newRm = [];
                const newRx = [];
                (res.roommates || []).forEach(function (m) {
                    if (isInitial || !existingUids.has(m.uid)) {
                        existingUids.add(m.uid);
                        newRm.push(mapRoommateToTuple(m));
                        const rawPref = (m.raw && m.raw.householdExpectations) || {};
                        newRx.push([
                            rawPref.dietPref || '',
                            rawPref.smokingPolicy === 'no_smoking' ? 'Non-smoker' : rawPref.smokingPolicy === 'smoking_allowed' ? 'Smoker' : '',
                            rawPref.quietHoursPolicy || '',
                            rawPref.guestPolicy || '',
                            rawPref.cleanlinessPolicy || '',
                            m.raw?.bio || 'Looking for compatible flatmates.'
                        ]);
                    }
                });
                if (isInitial) {
                    RM = newRm;
                    RX = newRx;
                }
                else {
                    RM = RM.concat(newRm);
                    RX = RX.concat(newRx);
                }
                if (S.nav === 'saved' && currentProfile) {
                    await Promise.allSettled((currentProfile.savedProfileIds || []).map(ensurePerson));
                    if (disposed)
                        return;
                }
                RM.forEach(function (x, i) {
                    if (x && isProfileSaved(x, i)) {
                        SV["r" + i] = true;
                        if (x[9]) SV["r" + x[9]] = true;
                    }
                });
                const personId = searchParams.get('person');
                if (personId) {
                    const personIndex = await ensurePerson(personId);
                    if (disposed) return;
                    if (personIndex >= 0) { S.rmi = personIndex; S.nav = 'roommate'; }
                }
                PAGINATION_STATE.roommatesCursor = res.cursorDoc;
                PAGINATION_STATE.roommatesHasMore = res.hasMore;
            }
            catch (err) {
                if (disposed || requestVersion !== roommatesRequestVersion)
                    return;
                PAGINATION_STATE.roommatesError = true;
                console.error('loadRoommatesPage error:', err);
                PAGINATION_STATE.roommatesHasMore = false;
            }
            finally {
                if (!disposed && requestVersion === roommatesRequestVersion) {
                    PAGINATION_STATE.roommatesLoading = false;
                    render();
                }
            }
        }
        let render = function () {
            if (disposed)
                return;
            let N = S.nav, ex = N == "explore" || N == "saved", h = "", r = [], t = "";
            if (N == "profile") {
                $("g").className = "grid";
                $("g").innerHTML = sanitizeRenderedHtml(ac());
                $("hero").style.display = "none";
                $("ctl").style.display = "none";
                $("cats").style.display = "none";
                $("h1").style.display = "none";
                $("n").textContent = "";
                document.querySelectorAll(".nv").forEach(function (b) { b.setAttribute("aria-current", b.dataset.n == "profile" || b.dataset.n == "me"); });
                sc();
                return;
            }
            if (N == "messages" || N == "notifications") {
                $("g").className = "grid";
                $("g").innerHTML = sanitizeRenderedHtml(N == "messages" ? mg() : nw());
                $("hero").style.display = "none";
                $("ctl").style.display = "none";
                $("cats").style.display = "none";
                $("h1").style.display = "none";
                $("n").textContent = "";
                document.querySelectorAll(".nv").forEach(function (b) { b.setAttribute("aria-current", b.dataset.n == N); });
                const ms = document.querySelector(".ms");
                if (ms)
                    ms.scrollTop = ms.scrollHeight;
                sc();
                return;
            }
            if (N == "listings" || N == "compare" || N == "applicants") {
                $("g").className = "grid";
                $("g").innerHTML = sanitizeRenderedHtml(N == "listings" ? ml() : N == "applicants" ? apl() : mc());
                $("hero").style.display = "none";
                $("ctl").style.display = "none";
                $("cats").style.display = "none";
                $("h1").style.display = "none";
                $("n").textContent = "";
                document.querySelectorAll(".nv").forEach(function (b) { b.setAttribute("aria-current", b.dataset.n == N); });
                sc();
                return;
            }
            if (N == "pg") {
                $("g").className = "grid";
                $("g").innerHTML = sanitizeRenderedHtml(rdg(S.pg));
                $("hero").style.display = "none";
                $("ctl").style.display = "none";
                $("cats").style.display = "none";
                $("h1").style.display = "none";
                $("n").textContent = "";
                document.querySelectorAll(".nv").forEach(function (b) { b.setAttribute("aria-current", b.dataset.n == (S.back || "explore")); });
                sc();
                return;
            }
            if (N == "roommate") {
                $("g").className = "grid";
                $("g").innerHTML = sanitizeRenderedHtml(rdr(S.rmi));
                $("hero").style.display = "none";
                $("ctl").style.display = "none";
                $("cats").style.display = "none";
                $("h1").style.display = "none";
                $("n").textContent = "";
                document.querySelectorAll(".nv").forEach(function (b) { b.setAttribute("aria-current", b.dataset.n == (S.back || "explore")); });
                sc();
                return;
            }
            if (N == "room") {
                $("g").className = "grid";
                $("g").innerHTML = sanitizeRenderedHtml(rd(S.room));
                $("hero").style.display = "none";
                $("ctl").style.display = "none";
                $("cats").style.display = "none";
                $("h1").style.display = "none";
                $("n").textContent = "";
                document.querySelectorAll(".nv").forEach(function (b) { b.setAttribute("aria-current", b.dataset.n == (S.back || "explore")); });
                sc();
                return;
            }
            let RMODE = (N == "explore" && S.cat == 2) || (N == "saved" && S.sub == 1) || N == "connections", sub = "";
            if (N == "saved")
                sub = chips(["Saved rooms", "Saved roommates"]);
            if (N == "connections")
                sub = chips(["Accepted", "Received", "Sent"]);
            if (RMODE) {
                const allRm = RM.map(function (_, idx) { return idx; });
                let ix = [];
                let md = "";
                if (N == "explore") {
                    ix = rml();
                }
                else if (N == "saved") {
                    ix = allRm.filter(function (i) { return isProfileSaved(RM[i], i); });
                }
                else if (N == "connections") {
                    md = ["acc", "recv", "sent"][S.sub] || "acc";
                    const connList = S.sub == 0 ? (LIVE_CONNS.accepted || []).filter(function (c) { return !c.listingId; }) : S.sub == 1 ? (LIVE_CONNS.received || []) : (LIVE_CONNS.sent || []);
                    const connUids = connList.map(function (c) {
                        return S.sub == 0
                            ? (c.fromUserId === (authUser ? authUser.uid : '') ? c.toUserId : c.fromUserId)
                            : S.sub == 1 ? c.fromUserId : c.toUserId;
                    }).filter(Boolean);
                    const foundIndices = [];
                    connUids.forEach(function (pUid) {
                        for (let rIdx = 0; rIdx < RM.length; rIdx++) {
                            if (RM[rIdx] && RM[rIdx][9] === pUid) {
                                if (foundIndices.indexOf(rIdx) < 0)
                                    foundIndices.push(rIdx);
                                break;
                            }
                        }
                    });
                    ix = foundIndices;
                }
                ix = ix.filter(function (i) { return !!RM[i]; });
                r = ix;
                h = ix.map(function (i) { return rc(RM[i], i, md); }).join("");
                if (N === "explore" && PAGINATION_STATE.roommatesHasMore) {
                    h += '<div class="lm-wrap" style="grid-column:1/-1;display:flex;justify-content:center;padding:24px 0 32px"><button class="pill" data-act="load-more-rm" style="height:44px;padding:0 24px;border-color:var(--brand);color:var(--brand);font-weight:600">' + (PAGINATION_STATE.roommatesLoading ? 'Loading...' : 'Show more roommates') + '</button></div>';
                }
                else if (N === "explore" && ix.length > 0) {
                    h += '<div class="lm-wrap" style="grid-column:1/-1;display:flex;justify-content:center;padding:24px 0 32px;color:var(--ink2);font-size:13px;font-weight:500"><span>Loaded ' + ix.length + ' roommates</span></div>';
                }
                if (N == "connections" && !h) {
                    const emptyTitles = ["No accepted connections yet", "No received requests", "No pending requests sent"];
                    const emptyDescs = [
                        "When someone accepts your connection request, you can message them here.",
                        "When another roommate wants to connect with you, their request appears here.",
                        "Connect with compatible roommates to explore living together."
                    ];
                    h = em(emptyTitles[S.sub] || "No connections yet", emptyDescs[S.sub] || "People you connect with show up here.", '<br><button class="pill" data-n="explore" style="margin:16px auto 0">Explore roommates</button>');
                }
            }
            else if (ex) {
                if (N == "saved") {
                    r = D.filter(function (x, i) { return isRoomSaved(x, i); }).concat(G.filter(function (x, i) { return isPgSaved(x, i); }));
                } else {
                    r = S.cat == 3 ? pgl() : S.cat == 0 ? mix() : list();
                }
            }
            if (!RMODE) {
                r.forEach(function (x) {
                    if (x.pg) {
                        h += pgc(x);
                        return;
                    }
                    const i = D.indexOf(x);
                    const coverUrl = (x[13] && x[13][0]) ? x[13][0] : '';
                    const coverImg = coverUrl
                        ? '<img src="' + esc(coverUrl) + '" alt="' + esc(x[1]) + '" loading="lazy" style="width:100%;height:100%;object-fit:cover">'
                        : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--bs);color:var(--brand)"><svg style="width:40px;height:40px" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" d="M3 11 12 3l9 8v9H3z"/><path fill="none" stroke="currentColor" stroke-width="2" d="M9 20v-6h6v6"/></svg></div>';
                    h += '<article class="card" data-i="' + i + '"><div class="ph">' + coverImg + '<span class="tag">' + esc(x[0]) + '</span>' + (x[9] ? '<span class="vb" title="Verified">' + IC.chk + '</span>' : '') + '<span class="mp"><i style="--m:' + esc(x[11]) + '"></i>' + (x[11] > 0 ? esc(x[11]) + '% match' : 'Set preferences') + '</span></div><div class="bd"><div class="tr"><div class="t">' + esc(x[1]) + '</div><button class="ib sv" data-id="' + i + '" aria-pressed="' + (isRoomSaved(x, i) ? "true" : "false") + '" aria-label="Save">' + IC.heart + '</button></div><div class="loc">' + IC.pin + esc(x[2]) + (x[8] ? ' · Furnished' : '') + '</div><div class="fx"><div title="Room type">' + IC.bed + esc(x[7]) + '</div><div title="Looking for">' + IC.usr + esc(x[21] && Number.isInteger(x[21].partnersNeeded) ? x[21].partnersNeeded + ' roommate(s)' : 'Not provided') + '</div><div title="Deposit">' + IC.wal + cf(x[4]) + ' deposit</div><div title="Available">' + IC.cal + (x[6] == "Now" ? "Available now" : "From " + esc(x[6])) + '</div></div><div class="ft"><div class="pr"><b>' + fmt(x[3]) + '</b><span>/mo</span></div>' + (authUser && (x[20] === authUser.uid || (x[12] && MY.some(function (m) { return m && m.id === x[12]; }))) ? '<button class="msgb" data-la="edit" data-q="' + (x[12] || i) + '" style="background:var(--sf);color:var(--brand);border:1px solid var(--brand)"><em>Your Listing · Edit</em></button>' : listingCommunicationButtons('r', i)) + '</div></div></article>';
                });
                if (N === "explore" && PAGINATION_STATE.placesHasMore) {
                    h += '<div class="lm-wrap" style="grid-column:1/-1;display:flex;justify-content:center;padding:24px 0 32px"><button class="pill" data-act="load-more" style="height:44px;padding:0 24px;border-color:var(--brand);color:var(--brand);font-weight:600">' + (PAGINATION_STATE.placesLoading ? 'Loading...' : 'Load more places') + '</button></div>';
                }
                else if (N === "explore" && r.length > 0) {
                    h += '<div class="lm-wrap" style="grid-column:1/-1;display:flex;justify-content:center;padding:24px 0 32px;color:var(--ink2);font-size:13px;font-weight:500"><span>Loaded ' + esc(r.length) + ' places</span></div>';
                }
            }
            if (N === "explore" && r.length && (S.cat === 2 ? PAGINATION_STATE.roommatesError : PAGINATION_STATE.placesError)) {
                h += '<div role="alert" style="grid-column:1/-1">Results could not refresh. Your loaded results are still shown. <button class="pill" data-sim="">Reload results</button></div>';
            }
            if (N == "explore" && !r.length) {
                const isRm = S.cat == 2;
                if (isRm && !authUser)
                    h = em("Sign in to discover roommates", "Member discovery is available to signed-in members with a complete profile.", '<br><button class="post" data-n="profile">Sign in</button>');
                else if (isRm && currentProfile && currentProfile.onboardingComplete !== true)
                    h = em("Complete your profile", "Complete your profile before discovering other members.", '<br><button class="post" data-n="profile">Open profile</button>');
                else if (isRm ? PAGINATION_STATE.roommatesError : PAGINATION_STATE.placesError)
                    h = erm();
                else if (isRm ? PAGINATION_STATE.roommatesLoading : PAGINATION_STATE.placesLoading)
                    h = sks();
            }
            if (!h) {
                if (N == "saved") {
                    if (S.sub == 1) {
                        const rmCnt = getSavedRoomCount();
                        h = rmCnt > 0
                            ? em("No saved roommates yet", "You have " + rmCnt + " saved room" + (rmCnt === 1 ? "" : "s") + " in your Saved rooms tab.", '<br><button class="pill" data-s="0" style="margin:16px auto 0">View saved rooms</button>')
                            : em("No saved roommates yet", "Tap the heart on any roommate profile to keep it here.");
                    } else {
                        const profCnt = getSavedProfileCount();
                        h = profCnt > 0
                            ? em("No saved rooms yet", "You have " + profCnt + " saved roommate" + (profCnt === 1 ? "" : "s") + " in your Saved roommates tab.", '<br><button class="pill" data-s="1" style="margin:16px auto 0">View saved roommates</button>')
                            : em("Nothing saved yet", "Tap the heart on any place to keep it here.");
                    }
                } else {
                    h = N == "explore" ? exem() :
                        N == "messages" ? em("No messages yet", "When you message a place or a roommate, the conversation shows up here.", '<br><button class="post" data-n="explore">Explore rooms</button>') :
                            N == "connections" ? em("No connections yet", "People you connect with show up here.") :
                                N == "listings" ? em("You have not posted a room", "Post a room and matching people can message you.", '<br><button class="post" data-n="post">Post a room</button>') :
                                    N == "post" ? em("Post a room", "The posting flow is its own screen.") : N == "profile" ? em("Profile", "Your profile screen opens here.") :
                                        '<div class="hub">' + HUB.map(function (x) { return '<button data-n="' + esc(x[0]) + '"><span class="ic2">' + x[3] + '</span><div>' + esc(x[1]) + '<small>' + esc(x[2]) + '</small></div>' + IC.chev + '</button>'; }).join("") + '</div>';
                }
            }
            t = N == "explore" ? CAT_NAMES[S.cat] + (S.city ? " in " + S.city : "") : N == "saved" ? (S.sub == 1 ? "Saved roommates" : "Saved places") : N == "me" ? "Your space" : N == "listings" ? "My listings" : N == "connections" ? "My connections" : N == "messages" ? "Messages" : N == "post" ? "Post a room" : "Profile";
            if (S.sim && N == "explore" && !RMODE)
                h = S.sim == "err" ? erm() : sks();
            $("g").className = "grid" + (S.view == "list" ? " list" : "");
            $("g").innerHTML = sanitizeRenderedHtml(sub + h);
            $("h1").textContent = t;
            $("h1").style.display = N == "explore" ? "none" : "block";
            $("hero").style.display = N == "explore" ? "block" : "none";
            $("n").textContent = (ex || N == "connections") ? (r.length + (RMODE ? (r.length === 1 ? " person" : " people") : (r.length === 1 ? " place" : " places"))) : "";
            if (N === "explore") {
                $("n").textContent += " loaded";
                $("n").title = "Search, filters and price order apply to loaded results. Load more to expand them.";
            }
            $("cats").style.display = N == "explore" ? "flex" : "none";
            $("ctl").style.display = N == "explore" ? "flex" : "none";
            const key = { me: "me", profile: "me", post: "post" }[N] || N;
            document.querySelectorAll(".nv").forEach(function (b) { b.setAttribute("aria-current", b.dataset.n == key); });
            $("ap").textContent = (S.cat === 2 ? "Show " + rml().length + " roommates" : S.cat === 3 ? "Show " + pgl().length + " places" : "Show " + (S.cat === 0 ? mix().length : list().length) + " places");
            $("bv").textContent = S.max >= 100000 ? "Up to ₹1,00,000+" : "Up to " + fmt(S.max);
            const c = (S.max < 100000) + (S.move < 999) + (S.gender != "Any") + S.types.length + S.furn + S.ver;
            $("cnt").textContent = c;
            $("cnt").style.display = c ? "grid" : "none";
            sc();
        };
        function sc() {
            const total = getSavedRoomCount() + getSavedProfileCount();
            document.querySelectorAll(".sc").forEach(function (e) {
                e.textContent = total;
                e.style.display = total ? "block" : "none";
            });
            ub();
        }
        function reset() {
            S.max = 100000;
            S.move = 999;
            S.gender = "Any";
            S.types = [];
            S.furn = 0;
            S.ver = 0;
            $("bud").value = 100000;
            document.querySelectorAll(".sg button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.v === "999" || b.dataset.v === "Any"); });
            loadPlacesPage(true);
            loadRoommatesPage(true);
        }
        $("fb").onclick = function () { pop(""); $("ov").classList.add("o"); };
        $("x").onclick = $("ap").onclick = function () { $("ov").classList.remove("o"); };
        $("ov").onclick = function (e) {
            if (e.target == this)
                this.classList.remove("o");
        };
        $("rs").onclick = reset;
        $("bud").oninput = function () { S.max = +this.value; render(); };
        $("q").oninput = function () {
            S.q = this.value; if (S.nav != "saved")
                S.nav = "explore"; render();
        };
        $("sort").onchange = function () { S.sort = this.value; render(); };
        addDocListener("click", function (e) {
            let o, o2, o3, id, isProfile, isPg, index, recordId, nextSaved, uid, q2;
            const bAct = e.target.closest("[data-act]");
            if (bAct) {
                if (bAct.dataset.act == "load-more") {
                    loadPlacesPage(false);
                    return;
                }
                if (bAct.dataset.act == "load-more-rm") {
                    loadRoommatesPage(false);
                    return;
                }
            }
            o = e.target.closest("[data-i]");
            o2 = e.target.closest("[data-r]");
            o3 = e.target.closest("[data-g]");
            if ((o || o2 || o3) && !e.target.closest("button")) {
                if (S.nav != "room" && S.nav != "roommate" && S.nav != "pg")
                    S.back = S.nav;
                if (o) {
                    S.room = +o.dataset.i;
                    S.nav = "room";
                }
                else if (o3) {
                    S.pg = +o3.dataset.g;
                    S.nav = "pg";
                }
                else {
                    S.rmi = +o2.dataset.r;
                    S.nav = "roommate";
                }
                render();
                scrollTo(0, 0);
                return;
            }
            const b = e.target.closest("button");
            if (!b)
                return;
            const d = b.dataset, sg = b.closest(".sg");
            if (d.i !== undefined) {
                if (S.nav != "room" && S.nav != "roommate" && S.nav != "pg")
                    S.back = S.nav;
                S.room = +d.i;
                S.nav = "room";
                render();
                scrollTo(0, 0);
                return;
            }
            if (sg && sg.dataset.g) {
                sg.querySelectorAll("button").forEach(function (o) { o.setAttribute("aria-pressed", o === b); });
                S[sg.dataset.g] = sg.dataset.g == "move" ? +b.dataset.v : b.dataset.v;
                render();
            }
            else if (sg && sg.id == "types") {
                b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") != "true");
                S.types = [].slice.call(sg.querySelectorAll("[aria-pressed=true]")).map(function (o) { return o.dataset.v; });
                render();
            }
            else if (sg && sg.id == "opts") {
                (o2 = b.getAttribute("aria-pressed") != "true");
                b.setAttribute("aria-pressed", o2);
                S[b.dataset.k] = o2 ? 1 : 0;
                render();
            }
            else if (b.classList.contains("sv")) {
                if (!authUser) {
                    openAuthModal();
                    return;
                }
                id = b.dataset.id;
                isProfile = id.startsWith("r");
                isPg = id.startsWith("p");
                index = Number(isProfile || isPg ? id.slice(1) : id);
                recordId = isProfile ? RM[index] && RM[index][9] : isPg ? G[index] && G[index][11] : D[index] && D[index][12];
                if (!recordId) {
                    toast("This item is unavailable. Refresh and try again.");
                    return;
                }
                nextSaved = isProfile ? !isProfileSaved(RM[index], index) : isPg ? !isPgSaved(G[index], index) : !isRoomSaved(D[index], index);
                b.disabled = true;
                saveUserBookmarkBackend(recordId, !isProfile, nextSaved).then(function () {
                    SV[id] = nextSaved;
                    if (recordId) {
                        if (isProfile) {
                            SV["r" + recordId] = nextSaved;
                            if (currentProfile) {
                                currentProfile.savedProfileIds = currentProfile.savedProfileIds || [];
                                if (nextSaved && !currentProfile.savedProfileIds.includes(recordId)) currentProfile.savedProfileIds.push(recordId);
                                else if (!nextSaved) currentProfile.savedProfileIds = currentProfile.savedProfileIds.filter(function (x) { return x !== recordId; });
                            }
                        } else {
                            SV[recordId] = nextSaved;
                            if (isPg) SV["p" + recordId] = nextSaved;
                            if (currentProfile) {
                                currentProfile.savedRoomIds = currentProfile.savedRoomIds || [];
                                if (nextSaved && !currentProfile.savedRoomIds.includes(recordId)) currentProfile.savedRoomIds.push(recordId);
                                else if (!nextSaved) currentProfile.savedRoomIds = currentProfile.savedRoomIds.filter(function (x) { return x !== recordId; });
                            }
                        }
                    }
                    b.setAttribute("aria-pressed", String(nextSaved));
                    sc();
                    if (S.nav == "saved")
                        render();
                }).catch(function (error) { toast(error.message || "Could not save bookmark."); }).finally(function () { b.disabled = false; });
            }
            else if (b.dataset.n == "post") {
                openPost();
            }
            else if (d.ada == "refresh") {
                loadAdminData();
                render();
            }
            else if (d.adtab !== undefined) {
                ADM.tab = +d.adtab;
                render();
            }
            else if (d.adact == "ver-list") {
                adminVerifyListingBackend(d.id, d.val == "true").then(function () { toast("Listing verification updated"); loadAdminData(); render(); }).catch(function (e) { console.warn(e); toast("Could not update verification"); loadAdminData(); render(); });
            }
            else if (d.adact == "status-list") {
                updateListingStatusBackend(d.id, d.val).then(function () { toast("Listing status updated to " + d.val); loadAdminData(); render(); }).catch(function (e) { console.warn(e); toast("Could not update status"); loadAdminData(); render(); });
            }
            else if (d.adact == "del-list") {
                cfm("Delete listing permanently?", "This will remove the listing record from Firestore.", "Delete", 1, function () { deleteListingBackend(d.id).then(function () { toast("Listing deleted"); loadAdminData(); render(); }).catch(function (e) { console.warn(e); toast("Could not delete listing"); loadAdminData(); render(); }); });
            }
            else if (d.adact == "ver-user") {
                adminUpdateUserStatusBackend(d.uid, d.val == "true" ? "verified" : "active").then(function () { toast("User KYC updated"); loadAdminData(); render(); }).catch(function (e) { console.warn(e); toast("Could not update verification"); loadAdminData(); render(); });
            }
            else if (d.adact == "status-user") {
                adminUpdateUserStatusBackend(d.uid, d.val).then(function () { toast("User status updated to " + d.val); loadAdminData(); render(); }).catch(function (e) { console.warn(e); toast("Could not update status"); loadAdminData(); render(); });
            }
            else if (d.adact == "res-rep") {
                adminResolveReportBackend(d.id, d.val).then(function () { toast("Report marked as " + d.val); loadAdminData(); render(); }).catch(function (e) { console.warn(e); toast("Could not resolve report"); loadAdminData(); render(); });
            }
            else if (d.adkyc == "view") {
                const nm = d.name;
                getVerificationDocumentBlobBackend(d.url).then(function (blob) {
                    if (disposed)
                        return;
                    if (privatePreviewUrl)
                        URL.revokeObjectURL(privatePreviewUrl);
                    privatePreviewUrl = URL.createObjectURL(blob);
                    const u = privatePreviewUrl;
                    dlg('<h3>Verification Document</h3><p>Uploaded by: <b>' + esc(nm) + '</b></p><div style="max-height:60vh;overflow:auto;margin:12px 0;display:flex;justify-content:center"><img src="' + esc(u) + '" alt="" style="max-width:100%;max-height:55vh;object-fit:contain;border-radius:12px"></div><div class="r"><a class="ghb" href="' + esc(u) + '" target="_blank" rel="noopener">Open full size</a><button class="ghb" data-cf="no">Close</button></div>', 1);
                }).catch(function (error) { toast(error.message || "Could not load private document."); });
            }
            else if (d.adkyc == "approve") {
                (uid = d.uid);
                cfm("Approve Government ID?", "This will mark the user profile as ID Verified and add the verified checkmark to their profile and listings.", "Approve KYC", 0, function () {
                    adminApproveVerificationBackend(uid, authUser ? (authUser.email || 'admin') : 'admin', "Manual approval by admin").then(function () {
                        toast("User ID verified successfully!");
                        loadAdminData();
                        render();
                    }).catch(function (e) {
                        console.warn(e);
                        toast("Approval note: " + (e?.message || "Updated"));
                        loadAdminData();
                        render();
                    });
                });
            }
            else if (d.adkyc == "reject") {
                (uid = d.uid);
                dlg('<h3>Reject KYC Submission</h3><p>Please enter the specific reason so the user knows what to correct (e.g. blurry document, name mismatch).</p><div class="pff"><label>Rejection reason</label><textarea class="tx" id="kyc-rej-reason" placeholder="e.g. Document image is not clear or edges are cropped"></textarea></div><div class="r"><button class="ghb" data-cf="no">Cancel</button><button class="msgb dg" data-adkyc-confirm-rej="' + esc(uid) + '"><em>Confirm rejection</em></button></div>');
            }
            else if (d.adkycConfirmRej) {
                (uid = d.adkycConfirmRej);
                const reason = ($("kyc-rej-reason") ? $("kyc-rej-reason").value.trim() : "") || "Document does not meet verification requirements";
                adminRejectVerificationBackend(uid, authUser ? (authUser.email || 'admin') : 'admin', reason).then(function () {
                    $("cfo").classList.remove("o");
                    toast("Verification rejected with note");
                    loadAdminData();
                    render();
                }).catch(function (e) {
                    console.warn(e);
                    $("cfo").classList.remove("o");
                    toast("Action note: " + (e?.message || "Updated"));
                    loadAdminData();
                    render();
                });
            }
            else if (b.dataset.n) {
                pop("");
                S.nav = b.dataset.n;
                if (b.dataset.as) {
                    S.as = b.dataset.as;
                }
                if (S.nav === "saved") {
                    const roomCnt = getSavedRoomCount();
                    const profCnt = getSavedProfileCount();
                    if (roomCnt === 0 && profCnt > 0) {
                        S.sub = 1;
                    } else {
                        S.sub = 0;
                    }
                    fetchSavedPlacesAndProfiles();
                } else {
                    S.sub = 0;
                }
                render();
                scrollTo(0, 0);
            }
            else if (b.dataset.save) {
                if (!authUser) {
                    openAuthModal();
                    return;
                }
                q2 = b.dataset.save;
                isProfile = q2.startsWith("r");
                isPg = q2.startsWith("p");
                index = Number(isProfile || isPg ? q2.slice(1) : q2);
                recordId = isProfile ? RM[index] && RM[index][9] : isPg ? G[index] && G[index][11] : D[index] && D[index][12];
                if (!recordId) {
                    toast("Item unavailable. Refresh and try again.");
                    return;
                }
                nextSaved = isProfile ? !isProfileSaved(RM[index], index) : isPg ? !isPgSaved(G[index], index) : !isRoomSaved(D[index], index);
                b.disabled = true;
                saveUserBookmarkBackend(recordId, !isProfile, nextSaved).then(function () {
                    SV[q2] = nextSaved;
                    if (recordId) {
                        if (isProfile) {
                            SV["r" + recordId] = nextSaved;
                            if (currentProfile) {
                                currentProfile.savedProfileIds = currentProfile.savedProfileIds || [];
                                if (nextSaved && !currentProfile.savedProfileIds.includes(recordId)) currentProfile.savedProfileIds.push(recordId);
                                else if (!nextSaved) currentProfile.savedProfileIds = currentProfile.savedProfileIds.filter(function (x) { return x !== recordId; });
                            }
                        } else {
                            SV[recordId] = nextSaved;
                            if (isPg) SV["p" + recordId] = nextSaved;
                            if (currentProfile) {
                                currentProfile.savedRoomIds = currentProfile.savedRoomIds || [];
                                if (nextSaved && !currentProfile.savedRoomIds.includes(recordId)) currentProfile.savedRoomIds.push(recordId);
                                else if (!nextSaved) currentProfile.savedRoomIds = currentProfile.savedRoomIds.filter(function (x) { return x !== recordId; });
                            }
                        }
                    }
                    b.textContent = nextSaved ? "Saved ✓" : isProfile ? "Save profile" : "Save for later";
                    sc();
                }).catch(function (error) { toast(error.message || "Could not save bookmark."); }).finally(function () { b.disabled = false; });
            }
            else if (b.dataset.s !== undefined) {
                S.sub = +b.dataset.s;
                render();
            }
            else if (b.dataset.c) {
                S.cat = +b.dataset.c;
                S.propertyType = '';
                document.querySelectorAll(".chip[data-c]").forEach(function (t) { t.setAttribute("aria-pressed", t === b); });
                if (S.cat === 2) {
                    if (!RM.length)
                        loadRoommatesPage(true);
                    else
                        render();
                }
                else {
                    loadPlacesPage(true);
                }
            }
            else if (b.dataset.v && b.closest(".vt")) {
                document.querySelectorAll(".vt button").forEach(function (t) { t.setAttribute("aria-pressed", t === b); });
                S.view = b.dataset.v;
                render();
            }
        });
        const LOC = ["Koramangala", "Indiranagar", "HSR Layout", "BTM Layout", "Whitefield", "Bellandur", "Marathahalli", "JP Nagar", "Jayanagar"], SQ = ["What is your work or study schedule?", "Do you smoke or drink?", "When can you move in?", "How long do you plan to stay?", "Do you have pets or plan to?"], INC = ["Wi-Fi", "Water", "Electricity", "Maintenance", "Housekeeping", "Cook"], LFS = ["Non-smoker", "Vegetarian", "Early riser", "Night owl", "Pet friendly", "No parties"], PS = ["Photos", "Place", "Rent", "People", "Review"];
        function pf0() { return { s: 0, ph: [], type: "", bhk: "", loc: "", title: "", desc: "", rent: "", dep: "", av: "", furn: "", inc: [], lk: "1 roommate", gd: "Any", lf: [], qs: [], er: {}, pub: 0, edit: null, isLiveInRoom: false }; }
        let PF = pf0();
        function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
        function pk(k, v, m) { return 'data-pk="' + k + '" data-pv="' + esc(v) + '"' + (m ? ' data-m="1"' : '') + ' aria-pressed="' + (m ? PF[k].indexOf(v) > -1 : PF[k] === v) + '"'; }
        function chs(k, a, m) { return '<div class="pfc">' + a.map(function (v) { return '<button ' + pk(k, v, m) + '>' + esc(v) + '</button>'; }).join("") + '</div>'; }
        function fl(id, lab, ctl, help) { return '<div class="pff' + (PF.er[id] ? ' e' : '') + '">' + (lab ? '<label>' + lab + '</label>' : '') + ctl + (help ? '<div class="hp">' + help + '</div>' : '') + '<div class="er">' + (PF.er[id] || "") + '</div></div>'; }
        function pst() { let p = PF, n = 0; p.ph = p.ph || []; p.inc = p.inc || []; p.lf = p.lf || []; p.qs = p.qs || []; n += (p.ph.length || p.edit != null) ? 15 : 0; n += p.ph.length >= 4 ? 5 : 0; n += p.type ? 10 : 0; n += p.loc ? 10 : 0; n += (p.title || "").trim().length >= 10 ? 10 : 0; n += (p.desc || "").trim().length >= 30 ? 10 : 0; n += +p.rent ? 15 : 0; n += p.dep !== "" ? 10 : 0; n += p.av ? 5 : 0; n += p.furn ? 5 : 0; n += (p.lf.length || p.qs.length) ? 5 : 0; return n; }
        function pval(s) {
            const e = {}, p = PF;
            p.ph = p.ph || [];
            p.inc = p.inc || [];
            p.lf = p.lf || [];
            p.qs = p.qs || [];
            p.er = p.er || {};
            if (s == 0 && !p.ph.length && p.edit == null)
                e.ph = "Add at least one photo";
            if (s == 1) {
                if (!p.type)
                    e.type = "Choose a place type";
                if (p.type && p.type != "PG / Coliving" && !p.bhk)
                    e.bhk = "Choose the BHK";
                if (!p.loc)
                    e.loc = "Choose a locality";
                if ((p.title || "").trim().length < 5)
                    e.title = "Add a title of at least 5 characters";
                if ((p.desc || "").trim().length < 10)
                    e.desc = "Tell people a little more (10+ characters)";
            }
            if (s == 2) {
                if (!(+p.rent >= 1000))
                    e.rent = "Enter the monthly rent";
                if (p.dep === "")
                    e.dep = "Enter the deposit (0 is fine)";
                if (!p.av)
                    e.av = "Choose when it is available";
                if (!p.furn)
                    e.furn = "Choose furnishing";
            }
            PF.er = e;
            return !Object.keys(e).length;
        }
        function pis() {
            const a = []; for (let s = 0; s < 3; s++) {
                if (!pval(s))
                    a.push([s, Object.keys(PF.er).map(function (k) { return PF.er[k]; })[0]]);
            } PF.er = {}; return a;
        }
        function pvc() { const p = PF, t = (p.title || "").trim(); p.ph = p.ph || []; return '<article class="card pvc"><div class="ph">' + (p.ph[0] ? '<img src="' + esc(p.ph[0]) + '" alt="" style="width:100%;height:100%;object-fit:cover">' : '') + '<span class="tag">' + (p.bhk || (p.type == "PG / Coliving" ? "PG" : "BHK")) + '</span></div><div class="bd"><div class="tr"><div class="t" style="' + (t ? '' : 'color:var(--ink2)') + '">' + esc(t || "Your title appears here") + '</div></div><div class="loc">' + IC.pin + (p.loc || "Locality") + (p.furn == "Fully furnished" ? " · Furnished" : "") + '</div><div class="fx"><div>' + IC.bed + (p.type || "Room type") + '</div><div>' + IC.usr + (p.lk || "1 roommate") + '</div><div>' + IC.wal + (p.dep !== "" ? cf(+p.dep) + " deposit" : "Deposit") + '</div><div>' + IC.cal + (p.av ? (p.av == "Now" ? "Available now" : esc(p.av)) : "Available") + '</div></div><div class="ft"><div class="pr"><b>' + (+p.rent ? fmt(+p.rent) : "₹ rent") + '</b><span>/mo</span></div></div></div></article>'; }
        function pnext() { const p = PF; p.ph = p.ph || []; return !p.ph.length && p.edit == null ? "Add a cover photo" : !p.type || !p.loc ? "Choose the place type and locality" : (p.title || "").trim().length < 10 ? "Write a clear title" : (p.desc || "").trim().length < 30 ? "Add a short description" : !+p.rent ? "Set the monthly rent" : p.dep === "" ? "Set the deposit" : !p.av ? "Say when it is available" : !p.furn ? "Choose furnishing" : p.ph.length < 4 ? "Add a few more photos" : "Looking good. Review and publish"; }
        function pfu() {
            if (disposed)
                return;
            const m = pst();
            $("pstr").innerHTML = sanitizeRenderedHtml('<span>Listing strength</span><div class="pring" style="--m:' + m + '"><b>' + m + '%</b></div>');
            $("pfp").innerHTML = sanitizeRenderedHtml('<div class="sk"><div class="pvh"><b>How seekers will see it</b><span>Live preview</span></div>' + pvc() + '<div class="hint"><div class="pring" style="--m:' + m + '"><b>' + m + '%</b></div><div><b>Next:</b> ' + pnext() + '</div></div></div>');
            const s = PF.s, is = s == 4 ? pis() : [];
            $("pfbar").innerHTML = sanitizeRenderedHtml(PF.pub ? '<span></span><span></span>' : (s ? '<button class="gb" data-p="bk">Back</button>' : '<span></span>') + '<button class="pvb" data-p="pv">Preview</button>' + (s == 4 ? '<button class="go2" data-p="pub"' + (is.length ? ' disabled' : '') + '>' + (PF.edit != null ? 'Save changes' : 'Publish listing') + '</button>' : '<button class="go2" data-p="nx">Continue</button>'));
        }
        const PI = ["M3 11 12 3l9 8v9H3z", "M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5", "M4 3h16v18H4zM8 7h2M14 7h2M8 11h2M14 11h2M10 21v-4h4v4"];
        function pf() {
            if (disposed)
                return;
            let s = PF.s, p = PF, h = "";
            p.ph = p.ph || [];
            p.inc = p.inc || [];
            p.lf = p.lf || [];
            p.qs = p.qs || [];
            $("pseg").innerHTML = sanitizeRenderedHtml(PS.map(function (t, i) { return '<button type="button" data-p="go" data-q="' + i + '" title="' + esc(t) + '" style="all:unset;cursor:pointer;flex:1;height:12px;padding:4px 0;display:flex;align-items:center"><i style="width:100%;height:5px;border-radius:3px;background:' + (i <= s ? "var(--g)" : "var(--sunk)") + ';display:block"></i></button>'; }).join(""));
            if (p.pub) {
                const isUserVerified = (ME && (ME.ver || (USER_KYC && USER_KYC.status === 'approved')));
                const isKycPending = (USER_KYC && USER_KYC.status === 'pending');
                if (p.edit != null) {
                    h = '<div class="dn"><svg viewBox="0 0 110 110"><circle cx="55" cy="55" r="48" fill="var(--bs)"/><path d="M30 76V52l25-20 25 20v24z" fill="#f0541e"/><rect x="48" y="58" width="14" height="18" rx="4" fill="#fff"/><path d="M84 22l2.500 7 7 2.500-7 2.500-2.500 7-2.500-7-7-2.500 7-2.500z" fill="#f0541e"/></svg><h2>Changes saved</h2><p class="sub" style="margin:0 auto">Your listing is updated.</p><div class="row2"><button class="pfbar go2" style="position:static;padding:0 26px;border:0" data-p="view">View my listings</button><button class="pvb" style="display:block" data-p="again">Post another</button></div></div>';
                } else if (!isUserVerified && !isKycPending) {
                    h = '<div class="dn"><svg viewBox="0 0 110 110"><circle cx="55" cy="55" r="48" fill="var(--bs)"/><path d="M30 76V52l25-20 25 20v24z" fill="#f0541e"/><rect x="48" y="58" width="14" height="18" rx="4" fill="#fff"/><path d="M84 22l2.500 7 7 2.500-7 2.500-2.500 7-2.500-7-7-2.500 7-2.500z" fill="#f0541e"/></svg>' +
                        '<h2>Listing submitted</h2>' +
                        '<div class="v-alert" style="background:#fff4e5;border:1px solid #ffd8a8;border-radius:14px;padding:16px 20px;margin:16px auto;max-width:460px;text-align:left;box-shadow:0 2px 8px rgba(0,0,0,0.03)">' +
                        '<div style="display:flex;gap:12px;align-items:flex-start">' +
                        '<svg style="width:24px;height:24px;flex-shrink:0;fill:#f0541e;margin-top:1px" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>' +
                        '<div><b style="color:#d9480f;display:block;margin-bottom:4px;font-size:14.5px">Complete verification to publish your listing</b>' +
                        '<p style="margin:0;font-size:13px;color:#495057;line-height:1.45">Your room listing has been created as <b>Pending verification</b>. To protect our community, listings cannot be published or displayed in discovery until your identity is verified.</p>' +
                        '</div></div></div>' +
                        '<div class="row2" style="margin-top:20px;gap:10px;justify-content:center;display:flex;flex-wrap:wrap">' +
                        '<button class="go2" style="position:static;padding:0 28px;border:0;background:var(--brand);color:#fff;font-weight:600" data-p="verify">Verify now</button>' +
                        '<button class="pvb" style="display:block" data-p="view">View my listings</button>' +
                        '<button class="pvb" style="display:block" data-p="again">Post another</button>' +
                        '</div></div>';
                } else if (isKycPending) {
                    h = '<div class="dn"><svg viewBox="0 0 110 110"><circle cx="55" cy="55" r="48" fill="var(--bs)"/><path d="M30 76V52l25-20 25 20v24z" fill="#f0541e"/><rect x="48" y="58" width="14" height="18" rx="4" fill="#fff"/><path d="M84 22l2.500 7 7 2.500-7 2.500-2.500 7-2.500-7-7-2.500 7-2.500z" fill="#f0541e"/></svg>' +
                        '<h2>Listing submitted · Verification in review</h2>' +
                        '<p class="sub" style="margin:0 auto;max-width:440px">Your identity document is currently under review by our moderation team. Your listing will automatically activate once approved.</p>' +
                        '<div class="row2" style="margin-top:20px;gap:10px;justify-content:center;display:flex">' +
                        '<button class="pfbar go2" style="position:static;padding:0 26px;border:0" data-p="view">View my listings</button>' +
                        '<button class="pvb" style="display:block" data-p="again">Post another</button>' +
                        '</div></div>';
                } else {
                    h = '<div class="dn"><svg viewBox="0 0 110 110"><circle cx="55" cy="55" r="48" fill="var(--bs)"/><path d="M30 76V52l25-20 25 20v24z" fill="#f0541e"/><rect x="48" y="58" width="14" height="18" rx="4" fill="#fff"/><path d="M84 22l2.500 7 7 2.500-7 2.500-2.500 7-2.500-7-7-2.500 7-2.500z" fill="#f0541e"/></svg>' +
                        '<h2>Listing submitted for review</h2>' +
                        '<p class="sub" style="margin:0 auto;max-width:440px">Your listing is queued for moderator review. You can track its status in My listings.</p>' +
                        '<div class="row2" style="margin-top:20px;gap:10px;justify-content:center;display:flex">' +
                        '<button class="pfbar go2" style="position:static;padding:0 26px;border:0" data-p="view">View my listings</button>' +
                        '<button class="pvb" style="display:block" data-p="again">Post another</button>' +
                        '</div></div>';
                }
            }
            else if (s == 0)
                h = '<h2>Show your place</h2><p class="sub">Good light and a tidy room make the first impression. Your first photo is the cover.</p>' + fl("ph", "", '<label class="drop" id="drop"><input type="file" id="pfile" accept="image/*" multiple hidden><svg viewBox="0 0 84 84"><rect x="8" y="18" width="68" height="52" rx="12" fill="var(--bs)"/><rect x="8" y="18" width="68" height="52" rx="12" fill="none" stroke="#f0541e" stroke-width="2"/><circle cx="42" cy="44" r="13" fill="#f0541e"/><circle cx="42" cy="44" r="6" fill="#fff"/><rect x="28" y="12" width="20" height="9" rx="4" fill="#f0541e"/></svg><b>Drag photos here, or browse</b><span>JPG or PNG · up to 10 photos</span></label>' + (p.ph.length ? '<div class="thumbs">' + p.ph.map(function (u, i) { return '<div class="th"><img src="' + u + '" alt=""><button class="rmv" data-p="rm" data-q="' + i + '" aria-label="Remove photo">×</button>' + (i ? '<button class="mk" data-p="cv" data-q="' + i + '">Make cover</button>' : '<span class="cv">Cover</span>') + '</div>'; }).join("") + '</div>' : ''), p.ph.length ? p.ph.length + " of 10 added" + (p.ph.length < 4 ? " · four or more works best" : "") : "");
            else if (s == 1)
                h = '<h2>Tell us about the place</h2><p class="sub">The basics seekers filter by.</p>' + fl("type", "What are you listing?", '<div class="pot">' + [["Private room", "A room in a shared flat"], ["Full flat", "The whole flat"], ["PG / Coliving", "A managed shared stay"]].map(function (x, i) { return '<button ' + pk("type", x[0]) + '><span class="ic"><svg class="i" viewBox="0 0 24 24"><path d="' + PI[i == 2 ? 2 : i == 1 ? 0 : 1] + '"/></svg></span><div><b>' + esc(x[0]) + '</b><span class="d">' + esc(x[1]) + '</span></div></button>'; }).join("") + '</div>') + (p.type && p.type != "PG / Coliving" ? fl("bhk", "How big is the flat?", chs("bhk", ["1 BHK", "2 BHK", "3 BHK", "4+ BHK"])) : "") + fl("loc", "Locality", chs("loc", LOC)) + fl("title", "Title", '<div class="pin"><input id="ptitle" maxlength="60" placeholder="e.g. Sunny private room in Koramangala" value="' + esc(p.title) + '"><em id="tc">' + esc(p.title.length) + '/60</em></div>', '<button class="lk2" data-p="sg" style="color:var(--brand);font-weight:600">Suggest a title</button>') + fl("desc", "Description", '<textarea class="tx" id="pdesc" placeholder="The flat, the neighbourhood, the people already living there">' + esc(p.desc) + '</textarea>', 'Minimum 30 characters.');
            else if (s == 2)
                h = '<h2>Rent and move-in</h2><p class="sub">Clear numbers earn replies from serious people.</p>' + fl("rent", "Monthly rent", '<div class="pin"><span>₹</span><input id="prent" inputmode="numeric" placeholder="14000" value="' + esc(p.rent) + '"><em>/ month</em></div>') + fl("dep", "Security deposit", '<div class="pin"><span>₹</span><input id="pdep" inputmode="numeric" placeholder="28000" value="' + esc(p.dep) + '"></div><div class="pfc" style="margin-top:10px">' + [1, 2, 3].map(function (n) { return '<button data-p="dp" data-q="' + n + '">' + n + (n > 1 ? " months" : " month") + ' rent</button>'; }).join("") + '<button data-p="dp" data-q="0">No deposit</button></div>') + fl("av", "Available from", chs("av", ["Now", "In 15 days", "In a month"])) + fl("furn", "Furnishing", chs("furn", ["Fully furnished", "Semi-furnished", "Unfurnished"])) + fl("inc", "Included in rent", chs("inc", INC, 1), "Pick everything the rent already covers.");
            else if (s == 3) {
                const cq = p.qs.filter(function (q) { return SQ.indexOf(q) < 0; });
                h = '<h2>Who are you looking for?</h2><p class="sub">This powers the match score seekers see. Everything here is optional.</p>' + fl("lk", "Roommates wanted", chs("lk", ["1 roommate", "2 roommates", "3 roommates"])) + fl("gd", "Gender preference", chs("gd", ["Any", "Female", "Male"])) + fl("lf", "Lifestyle you would like", chs("lf", LFS, 1)) + fl("qs", "Screening questions", chs("qs", SQ.concat(cq), 1) + '<div class="pin" style="margin-top:12px"><input id="pcq" placeholder="Write your own question"><button data-p="aq">Add</button></div>', 'Applicants answer these when they apply. Choose up to 5.');
            }
            else {
                const is = pis();
                h = '<h2>Review your listing</h2><p class="sub">One last look. You can edit anything after publishing.</p>' + (is.length ? '<div class="bad"><b>A few things need attention</b><br>' + is.map(function (x) { return '<button data-p="go" data-q="' + esc(x[0]) + '">' + PS[x[0]] + ': ' + esc(x[1]) + '</button>'; }).join("<br>") + '</div>' : '') + [["Photos", p.ph.length ? p.ph.length + " photo" + (p.ph.length > 1 ? "s" : "") : (p.edit != null ? "Existing photos kept" : "None yet"), 0], ["Place", (p.type || "–") + (p.bhk ? " · " + p.bhk : "") + " · " + (p.loc || "–") + (p.title.trim() ? '<br>' + esc(p.title.trim()) : ""), 1], ["Rent", (+p.rent ? fmt(+p.rent) + " / month" : "–") + " · deposit " + (p.dep !== "" ? fmt(+p.dep) : "–") + " · " + (p.av || "–") + " · " + (p.furn || "–"), 2], ["People", p.lk + " · gender: " + p.gd + (p.lf.length ? " · " + p.lf.length + " lifestyle tags" : ""), 3], ["Screening", p.qs.length ? p.qs.length + " question" + (p.qs.length > 1 ? "s" : "") : "None", 3]].map(function (r) { return '<div class="rv"><div><small>' + esc(r[0]) + '</small><b>' + esc(r[1]) + '</b></div><button data-p="go" data-q="' + esc(r[2]) + '">Edit</button></div>'; }).join("") + '<p class="hp" style="margin-top:18px">By publishing you agree to the Terms and confirm you are allowed to list this place.</p>';
            }
            if (s == 3 && !p.pub)
                h += '<div class="pff"><label style="display:flex;align-items:flex-start;gap:10px"><input type="checkbox" id="resident-confirm" ' + (p.isLiveInRoom === true ? 'checked' : '') + '>I live in this property and am offering a spare room</label><div class="hp">Select this only if you are a current resident. Property owners who do not live here should leave it unchecked.</div></div>';
            $("pfm").innerHTML = sanitizeRenderedHtml('<div class="pfi2">' + (p.pub ? "" : '<div class="eb">' + (s < 4 ? "Step " + (s + 1) + " of 4 · " + PS[s] : "Final check") + '</div>') + h + '</div>');
            pfu();
            const f = $("pfile");
            if (f)
                f.onchange = function () { addf(this.files); };
        }
        addDocListener("change", function (event) {
            if (event.target.id == "resident-confirm")
                PF.isLiveInRoom = event.target.checked;
        });
        function addf(fs) { [].slice.call(fs).slice(0, 10 - PF.ph.length).forEach(function (f) { const r = new FileReader(); r.onload = function () { PF.ph.push(r.result); PF.er = {}; pf(); }; r.readAsDataURL(f); }); }
        function openPost() {
            $("pf").classList.add("o"); if (PF.pub || PF.edit != null)
                PF = pf0(); pf();
        }
        addDocListener("click", function (e) {
            const b = e.target.closest("button");
            if (!b || !$("pf").classList.contains("o"))
                return;
            const d = b.dataset;
            if (d.pk) {
                const k = d.pk, v = d.pv;
                if (d.m) {
                    const i = PF[k].indexOf(v);
                    if (i > -1)
                        PF[k].splice(i, 1);
                    else if (k != "qs" || PF.qs.length < 5)
                        PF[k].push(v);
                }
                else
                    PF[k] = v;
                if (k == "type" && v == "PG / Coliving")
                    PF.bhk = "";
                delete PF.er[k];
                pf();
                return;
            }
            const a = d.p;
            if (!a)
                return;
            if (a == "exit")
                $("pf").classList.remove("o");
            else if (a == "nx") {
                if (pval(PF.s)) {
                    PF.s++;
                    pf();
                    $("pfm").scrollTop = 0;
                    $("pfb").scrollTop = 0;
                }
                else {
                    pf();
                    const x = document.querySelector(".pff.e");
                    if (x)
                        x.scrollIntoView({ block: "center", behavior: "smooth" });
                }
            }
            else if (a == "bk") {
                PF.s--;
                PF.er = {};
                pf();
            }
            else if (a == "go") {
                PF.s = +d.q;
                PF.er = {};
                pf();
            }
            else if (a == "rm") {
                PF.ph.splice(+d.q, 1);
                pf();
            }
            else if (a == "cv") {
                const u = PF.ph.splice(+d.q, 1)[0];
                PF.ph.unshift(u);
                pf();
            }
            else if (a == "sg") {
                PF.title = ((PF.bhk ? PF.bhk + " " : "") + (PF.type || "Room") + " in " + (PF.loc || "Bengaluru")).slice(0, 60);
                pf();
            }
            else if (a == "dp") {
                PF.dep = String((+PF.rent || 0) * (+d.q));
                if (!+PF.rent && +d.q)
                    PF.er.rent = "Enter the rent first";
                pf();
            }
            else if (a == "aq") {
                const q = $("pcq").value.trim();
                if (q && PF.qs.indexOf(q) < 0 && PF.qs.length < 5) {
                    PF.qs.push(q);
                    pf();
                }
            }
            else if (a == "pv")
                $("pfp").classList.toggle("show");
            else if (a == "pub") {
                const issues = pis();
                if (!issues.length) {
                    fin();
                } else {
                    PF.s = issues[0][0];
                    pf();
                    toast("Please complete: " + issues[0][1]);
                }
            }
            else if (a == "verify") {
                $("pf").classList.remove("o");
                S.nav = "profile";
                go("verify");
            }
            else if (a == "view") {
                $("pf").classList.remove("o");
                S.nav = "listings";
                render();
            }
            else if (a == "again") {
                PF = pf0();
                pf();
            }
        });
        addDocListener("input", function (e) {
            const t = e.target, id = t.id; if (id == "ptitle") {
                PF.title = t.value;
                $("tc").textContent = t.value.length + "/60";
            }
            else if (id == "pdesc")
                PF.desc = t.value;
            else if (id == "prent")
                PF.rent = t.value.replace(/\D/g, "");
            else if (id == "pdep")
                PF.dep = t.value.replace(/\D/g, "");
            else
                return; if (PF.er[{ ptitle: "title", pdesc: "desc", prent: "rent", pdep: "dep" }[id]]) {
                    delete PF.er[{ ptitle: "title", pdesc: "desc", prent: "rent", pdep: "dep" }[id]];
                    const f = t.closest(".pff");
                    if (f)
                        f.classList.remove("e");
                } pfu();
        });
        addDocListener("dragover", function (e) {
            if (e.target.closest && e.target.closest("#drop"))
                e.preventDefault();
        });
        addDocListener("drop", function (e) {
            if (e.target.closest && e.target.closest("#drop")) {
                e.preventDefault();
                addf(e.dataTransfer.files);
            }
        });
        function fd(i) { const x = D[i], t = x[1].replace(/&amp;/g, "&"); return { t: t, loc: x[2], rent: x[3], photo: "", pct: 100, f: Object.assign(pf0(), { type: x[7], bhk: x[0], loc: x[2], title: t, desc: "A bright, well-kept place close to cafes and transit. Calm building and an easy commute.", rent: String(x[3]), dep: String(x[4]), av: x[6] == "Now" ? "Now" : "In a month", furn: x[8] ? "Fully furnished" : "Unfurnished", inc: ["Wi-Fi", "Water"], gd: x[10] }) }; }
        (MY = []);
        const ANS = [];
        S.lt = 0;
        S.ck = 0;
        function toast(m) {
            if (disposed)
                return; const t = $("tst"); t.textContent = m; t.classList.add("o"); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove("o"); }, 2600);
        }
        function cfm(t, p, ok, dg, fn) {
            if (disposed)
                return; $("cfb").parentNode.className = "cfm"; $("cfb").innerHTML = sanitizeRenderedHtml('<h3>' + esc(t) + '</h3><p>' + p + '</p><div class="r"><button class="ghb" data-cf="no" style="height:46px">Cancel</button><button class="msgb' + (dg ? ' dg' : '') + '" data-cf="ok" style="height:46px;padding:0 22px;width:auto">' + ok + '</button></div>'); cfm.fn = fn; $("cfo").classList.add("o"); setTimeout(function () {
                    const f = $("cfb").querySelector("button"); if (f)
                        f.focus();
                }, 60);
        }
        async function fin() {
            if (PF.saving)
                return;
            if (!authUser) {
                openAuthModal();
                return;
            }
            const p = PF;
            p.saving = true;
            const button = document.querySelector('[data-p="pub"]');
            if (button)
                button.disabled = true;
            try {
                if (p.draftListingId) {
                    await updateListingBackend(p.draftListingId, Object.assign({}, p, { submitForReview: true }));
                    toast("Listing submitted for review");
                }
                else if (p.edit != null && MY[p.edit]) {
                    const existing = MY[p.edit];
                    if (!existing.id)
                        throw new Error("This listing has no saved record. Refresh and try again.");
                    const needsReview = existing.st === "Draft" || existing.st === "Rejected";
                    await updateListingBackend(existing.id, Object.assign({}, p, { submitForReview: needsReview }));
                    toast(needsReview ? "Listing submitted for review" : "Listing updated");
                }
                else {
                    await createNewListingBackend(p, authUser);
                    toast("Listing submitted. Publication depends on review and availability.");
                }
                p.pub = 1;
                pf();
            }
            catch (error) {
                console.error("[NestMate Save Listing Error]", error);
                if (error && error.draftListingId)
                    p.draftListingId = error.draftListingId;
                toast(error && error.message || "Could not save listing. Your changes are still here. Try again.");
            }
            finally {
                p.saving = false;
                if (button)
                    button.disabled = false;
            }
        }
        function oed(k) {
            const item = (typeof k === "number" && MY[k]) ? MY[k] : (MY.find(function (m) { return m && (m.id === k || m.id === String(k)); }) || MY[+k]);
            if (!item)
                return;
            const itemIndex = MY.indexOf(item);
            const raw = item.f || {};
            const f = pf0();
            if (typeof raw.isLiveInRoom === "boolean")
                f.isLiveInRoom = raw.isLiveInRoom;
            else
                delete f.isLiveInRoom;
            f.title = raw.title || item.t || "";
            f.loc = raw.locality || item.loc || "";
            f.rent = String(raw.partnerShare || raw.monthlyRent || raw.totalRent || item.rent || "");
            f.dep = String(raw.deposit !== undefined && raw.deposit !== null ? raw.deposit : "");
            f.ph = (Array.isArray(raw.images) && raw.images.length > 0) ? raw.images.slice() : (Array.isArray(raw.ph) ? raw.ph.slice() : (item.photo ? [item.photo] : []));
            f.type = raw.roomType || raw.type || (raw.flatType && String(raw.flatType).toLowerCase().includes("pg") ? "PG / Coliving" : "Private room");
            f.bhk = raw.flatType || raw.bhk || "";
            f.desc = raw.description || raw.desc || "";
            f.av = raw.availableFrom || raw.av || "";
            f.furn = raw.furnishing || raw.furn || "";
            f.inc = (Array.isArray(raw.amenities) && raw.amenities.length > 0) ? raw.amenities.slice() : (Array.isArray(raw.inc) ? raw.inc.slice() : []);
            f.lk = raw.lookingFor || raw.lk || "1 roommate";
            f.gd = raw.preferredGender || raw.genderPreference || raw.gd || "Any";
            f.lf = Array.isArray(raw.houseRules) ? raw.houseRules.slice() : (Array.isArray(raw.lifestyle) ? raw.lifestyle.slice() : (Array.isArray(raw.lf) ? raw.lf.slice() : []));
            f.qs = Array.isArray(raw.screeningQuestions) ? raw.screeningQuestions.slice() : (Array.isArray(raw.qs) ? raw.qs.slice() : []);
            f.edit = itemIndex > -1 ? itemIndex : (typeof k === "number" ? k : 0);
            f.pub = 0;
            f.er = {};
            f.s = 4;
            PF = f;
            $("pf").classList.add("o");
            pf();
        }
        addDocListener("click", function (e) {
            const b = e.target.closest("button");
            if (!b)
                return;
            const d = b.dataset;
            if (d.lt !== undefined) {
                S.lt = +d.lt;
                render();
            }
            else if (d.la) {
                const k = +d.q, x = (MY[k] || MY.find(function (m) { return m && m.id === d.q; }));
                if (d.la == "edit")
                    oed(d.q !== undefined ? d.q : k);
                else if (d.la == "apl") {
                    S.ck = k;
                    AS = [];
                    AF.st = "New";
                    AF.q = "";
                    AF.n = 12;
                    S.nav = "applicants";
                    render();
                    scrollTo(0, 0);
                }
                else if (d.la == "pz") {
                    if (!x || !x.id) {
                        toast("Refresh this listing before changing its status.");
                        return;
                    }
                    const nextStatus = x.st == "Active" ? "Paused" : "Active";
                    b.disabled = true;
                    updateListingStatusBackend(x.id, nextStatus).then(function () { toast(nextStatus == "Paused" ? "Listing paused" : "Listing resumed"); }).catch(function (error) { toast(error.message || "Could not change listing status."); }).finally(function () { b.disabled = false; });
                }
                else if (d.la == "del")
                    cfm("Delete this listing?", "This removes the saved listing record.", "Delete listing", 1, function () {
                        if (!x || !x.id) {
                            toast("Refresh this listing before deleting.");
                            return;
                        }
                        deleteListingBackend(x.id).then(function () { toast("Listing deleted"); }).catch(function (error) { toast(error.message || "Could not delete listing."); });
                    });
            }
            else if (d.sel) {
                toast("Roommate selection is unavailable. This action does not confirm occupancy or fill your listing.");
            }
            else if (d.cf) {
                $("cfo").classList.remove("o");
                if (d.cf == "ok" && cfm.fn)
                    cfm.fn();
            }
        });
        function Mg(w, t, d, tm) { return [w, t, "", d, tm]; }
        (CH = []);
        let NT = [];
        S.cid = null;
        S.cf = 0;
        S.cs = "";
        S.nf = 0;
        S.sbd = 0;
        S.eb = 1;
        const IS = { snd: P('<path d="M5 12h14M13 6l6 6-6 6"/>'), clip: P('<path d="m21 11-8.500 8.500a5 5 0 0 1-7-7L14 4a3.500 3.500 0 0 1 5 5l-8.500 8.500a2 2 0 0 1-3-3L15 6"/>'), flag: P('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'), bk: P('<path d="m15 6-6 6 6 6"/>'), spk: P('<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>'), ver: P('<path d="M12 3 4.500 6v6c0 4.500 3.200 7.700 7.500 9 4.300-1.300 7.500-4.500 7.500-9V6z"/><path d="m9 12 2 2 4-4"/>') };
        function ub() { const u = CH.reduce(function (a, c) { return a + c.un; }, 0), n = NT.filter(function (x) { return !x.r; }).length; document.querySelectorAll(".mu").forEach(function (e) { e.textContent = u; e.style.display = u ? "block" : "none"; }); document.querySelectorAll(".dot").forEach(function (e) { e.style.display = n ? "block" : "none"; }); }
        function av(i, c) {
            const x = RM[i] || (typeof i === 'string' ? RM.find(function (m) { return m && m[9] === i; }) : null);
            const avContent = (x && x[10]) ? '<img src="' + esc(x[10]) + '" alt="' + esc(x[1]) + '" style="width:100%;height:100%;object-fit:cover;object-position:center;border-radius:inherit">' : (x ? x[0] : (c && c.otherName ? c.otherName.slice(0, 2) : 'RM'));
            return '<div class="av2">' + avContent + ((x && x[6]) ? '<span class="vb">' + IC.chk + '</span>' : '') + '</div>';
        }
        function lastm(c) { return c.m.length ? c.m[c.m.length - 1] : ["t", "Say hello and ask your first question", "", "", "New"]; }
        function cxl(c) { return c.ctx[0] == "room" ? "Re: " + (D[c.ctx[1]] ? D[c.ctx[1]][1].replace(/&amp;/g, "&") : "Room") : c.ctx[0] == "pg" ? "Re: " + (G[c.ctx[1]] ? G[c.ctx[1]][0] : "PG") : "Roommate chat"; }
        function cl() {
            let q = S.cs.toLowerCase(), h = ""; CH.forEach(function (c, k) {
                const x = RM[c.p] || (typeof c.p === 'string' ? RM.find(function (m) { return m && m[9] === c.p; }) : null) || [c.otherName ? c.otherName.slice(0, 2) : "RM", c.otherName || "Roommate", "", "", "", "", c.otherVerified ? 1 : 0, null, [], c.p, c.otherAvatar || "", "Any"], l = lastm(c); if (!x)
                    return; if ((S.cf && !c.un) || (q && (x[1] + l[1]).toLowerCase().indexOf(q) < 0))
                    return; h += '<button class="ci' + (S.cid == k ? " on" : "") + (c.un ? " un" : "") + '" data-c2="' + k + '">' + av(c.p, c) + '<div><div class="n1"><b>' + esc(x[1]) + '</b><small>' + esc(l[4]) + '</small></div><div class="pv2">' + (l[0] == "me" ? "You: " : "") + esc(l[2] ? "Photo" : l[1]) + '</div><div class="cx">' + esc(cxl(c)) + '</div></div>' + (c.un ? '<span class="ub">' + esc(c.un) + '</span>' : '') + '</button>';
            }); return h || '<div class="plc"><div>' + (S.cf ? "No unread messages" : "No matches") + '</div></div>';
        }
        function thi() {
            const k = S.cid;
            if (k == null || !CH[k])
                return '<div class="plc"><div><svg viewBox="0 0 160 120" width="150" height="112"><circle cx="80" cy="62" r="46" fill="var(--bs)"/><rect x="40" y="38" width="62" height="40" rx="14" fill="#f0541e"/><path d="M58 78v14l16-14z" fill="#f0541e"/><rect x="74" y="54" width="52" height="34" rx="12" fill="#fff" stroke="#f0541e" stroke-width="2"/><circle cx="92" cy="71" r="3" fill="#f0541e"/><circle cx="100" cy="71" r="3" fill="#f0541e"/><circle cx="108" cy="71" r="3" fill="#f0541e"/></svg><b>Select a conversation</b>Your chats with posters and roommates appear here.</div></div>';
            let c = CH[k], x = RM.find(function (m) { return m && m[9] === c.p; }) || [c.otherName ? c.otherName.slice(0, 2) : "RM", c.otherName || "Roommate", "", "", "", "", 0, null, [], c.p, c.otherAvatar || "", "Any"], last = "", h = '<div class="hd2"><button class="bk3 ib" data-bk2="1" aria-label="Back">' + IS.bk + '</button>' + '<button class="hn" data-vp="' + esc(c.p) + '" aria-label="Open profile">' + av(c.p) + '<div><b>' + esc(x[1]) + '</b><small>' + (x[6] ? "ID verified" : "Not verified") + ' · ' + (x[17] && Number.isFinite(x[17].compatibilityScore) ? esc(x[17].compatibilityScore) + '% match' : 'Compatibility not available') + '</small></div></button><span class="sp3"></span><button class="ghb pf2" data-vp="' + esc(c.p) + '">Profile</button><button class="ghb" data-cm="' + k + '" aria-label="More options">' + P('<circle cx="5" cy="12" r="1.600"/><circle cx="12" cy="12" r="1.600"/><circle cx="19" cy="12" r="1.600"/>') + '<span>More</span></button></div>';
            if (c.historyError) h += '<div role="alert" class="hint">Messages could not be loaded. Refresh this page to try again. Your unread status is preserved.</div>';
            if (!S.sbd)
                h += '<div class="sb2">' + IC.sh + '<div>Keep payments and documents out of chat until you have visited. <a href="#">Trust center</a></div><button data-sbx="1" aria-label="Dismiss">×</button></div>';
            if (c.ctx[0] == "room") {
                const d = D[c.ctx[1]];
                if (d) {
                    const rImg = (d[13] && d[13][0]) ? '<img src="' + esc(d[13][0]) + '" alt="" style="width:100%;height:100%;object-fit:cover">' : '';
                    h += '<div class="ctxc" data-i="' + esc(c.ctx[1]) + '"><div class="ph">' + rImg + '</div><div><b>' + esc(d[1]) + '</b><small>' + fmt(d[3]) + ' / mo · deposit ' + cf(d[4]) + ' · ' + esc(d[2]) + '</small></div></div>';
                }
            }
            else if (c.ctx[0] == "pg") {
                const g = G[c.ctx[1]];
                if (g) {
                    const pImg = (g[12] && g[12][0]) ? '<img src="' + esc(g[12][0]) + '" alt="" style="width:100%;height:100%;object-fit:cover">' : '';
                    h += '<div class="ctxc" data-g="' + esc(c.ctx[1]) + '"><div class="ph">' + pImg + '</div><div><b>' + g[0] + '</b><small>' + fmt(g[2]) + ' / bed · ' + g[1] + '</small></div></div>';
                }
            }
            h += '<div class="ms">' + (c.hasOlder ? '<button class="ghb" data-history="' + esc(c.id) + '">Load earlier messages</button>' : '');
            c.m.forEach(function (m) {
                if (m[3] != last) {
                    last = m[3];
                    h += '<div class="dv">' + last + '</div>';
                } h += '<div class="b2' + (m[0] == "me" ? " me" : "") + '">' + (m[2] ? '<img src="' + esc(m[2]) + '" alt="">' : '') + (m[1] ? esc(m[1]) : '') + '<small>' + esc(m[4]) + '</small></div>';
            });
            if (!c.m.length)
                h += '<div class="plc" style="flex:1"><div><b>Start the conversation</b>Introduce yourself and ask about the place.</div></div>';
            if (c.ty)
                h += '<div class="tp"><i></i><i></i><i></i></div>';
            h += '</div>';
            if ((!c.m.length || c.m[c.m.length - 1][0] == "t") && !c.ty)
                h += '<div class="qr">' + (c.ctx[0] != "mate" ? ["Is it still available?", "Can I visit this weekend?", "What is the deposit?"] : ["Hi! Nice to match", "My schedule is flexible", "Tell me about your place"]).map(function (q) { return '<button data-qr="' + esc(q) + '">' + q + '</button>'; }).join("") + '</div>';
            if (c.authorized === false) {
                return h + '<div class="cp2" style="justify-content:center;color:var(--t3);font-size:14px;padding:12px;background:var(--s2)">Communication is unavailable for this conversation.</div>';
            }
            return h + '<div class="cp2"><label class="at" title="Attach photo"><span class="vh">Attach photo</span><input type="file" id="cfile" accept="image/*" hidden>' + IS.clip + '</label><input type="text" id="cin" placeholder="Write a message" autocomplete="off" value="' + esc(CHAT_DRAFTS.get(c.id) || '') + '"><button class="sd" data-snd="1" id="csd" ' + (!String(CHAT_DRAFTS.get(c.id) || '').trim() || CHAT_SENDS.has(c.id) ? 'disabled' : '') + ' aria-label="Send">' + IS.snd + '</button></div>';
        }
        function markVisibleChatRead() {
            const room = CH[S.cid], messageId = room?.m?.[room.m.length - 1]?.[5];
            if (disposed || S.nav !== 'messages' || !room?.un || room.historyError || !messageId || CHAT_READS.has(room.id)) return;
            CHAT_READS.add(room.id);
            markConversationReadBackend(room.id, messageId).then(function (read) {
                const current = CH.find(function (chat) { return chat.id === room.id; });
                if (!disposed && read && current?.m?.[current.m.length - 1]?.[5] === messageId) { current.un = 0; ub(); }
            }).catch(function () { if (!disposed) toast('Could not update read state.'); }).finally(function () {
                CHAT_READS.delete(room.id);
                const current = CH[S.cid];
                if (!disposed && current?.id === room.id && current?.m?.[current.m.length - 1]?.[5] !== messageId) markVisibleChatRead();
            });
        }
        function mg() {
            if (S.cid == null && innerWidth > 900 && CH.length)
                S.cid = 0;
            markVisibleChatRead();
            if (!CH.length)
                return chatLoading ? em("Loading conversations", "Your conversations are being retrieved.") : chatError ? em("Could not load conversations", "Refresh this page to try again.") : em("No conversations yet", "When you message a place or a roommate, the chat shows up here.");
            return (chatError ? '<div role="alert" class="hint">Conversations could not refresh. Your previously loaded history is still shown.</div>' : '') + '<div class="mg' + (S.cid != null ? " t" : "") + '"><aside class="cl"><div class="ch1"><h1>Messages</h1></div><div class="cs"><input id="cq" placeholder="Search messages" value="' + esc(S.cs) + '"></div><div class="cf"><button class="chip" data-cfl="0" aria-pressed="' + (S.cf == 0) + '">All</button><button class="chip" data-cfl="1" aria-pressed="' + (S.cf == 1) + '">Unread</button></div><div class="cli">' + cl() + '</div></aside><section class="th2">' + thi() + '</section></div>';
        }
        function rth(f) {
            const el = document.querySelector('.th2'); if (!el) return;
            const oldInput = $('cin'), focused = document.activeElement === oldInput;
            const selection = oldInput ? [oldInput.selectionStart, oldInput.selectionEnd] : null;
            el.innerHTML = sanitizeRenderedHtml(thi());
            const messages = el.querySelector('.ms'); if (messages) messages.scrollTop = messages.scrollHeight;
            const list = document.querySelector('.cli'); if (list) list.innerHTML = sanitizeRenderedHtml(cl());
            markVisibleChatRead();
            const input = $('cin');
            if ((f || focused) && input) { input.focus(); if (selection) input.setSelectionRange(selection[0], selection[1]); }
            persistNavigation();
        }
        async function snd(t, img) {
            const k = S.cid, c = CH[k];
            if (!c || !c.id || c.authorized === false) {
                toast("Communication is unavailable for this conversation.");
                return;
            }
            if (CHAT_SENDS.has(c.id)) return;
            CHAT_SENDS.add(c.id);
            const button = $("csd");
            if (button)
                button.disabled = true;
            try {
                if (!c.pendingMessage || c.pendingMessage.text !== t || c.pendingMessage.image !== img)
                    c.pendingMessage = { id: crypto.randomUUID(), text: t, image: img };
                await sendMessageBackend(c.id, t || "", img || "", c.pendingMessage.id);
                delete c.pendingMessage;
                const current = CH.find(function (room) { return room.id === c.id; }); if (current) delete current.pendingMessage;
                if (String(CHAT_DRAFTS.get(c.id) || '').trim() === String(t || '').trim()) CHAT_DRAFTS.delete(c.id);
                if (!disposed && CH[S.cid]?.id === c.id && $('cin')) $('cin').value = CHAT_DRAFTS.get(c.id) || '';
            }
            catch (error) {
                if (!disposed) toast(error.message || "Message was not sent. Please try again.");
            }
            finally {
                CHAT_SENDS.delete(c.id);
                if (!disposed && CH[S.cid]?.id === c.id && $('csd')) $('csd').disabled = !String(CHAT_DRAFTS.get(c.id) || '').trim();
            }
        }
        // Notification x is trusted formatter output: static markup with escaped title/body.
        function nw() {
            let un = NT.filter(function (x) { return !x.r; }).length, L = NT.filter(function (x) { return !S.nf || !x.r; }), ic = { req: IC.usr, msg: IC.chat, match: IS.spk, app: IC.home, ver: IS.ver, safe: IC.sh }, h = '<div class="nw"><div class="nh"><h1>Notifications</h1>' + '<div style="display:flex;gap:8px;flex-wrap:wrap">' + (un ? '<button class="ghb" data-mar="1">Mark all as read</button>' : '') + '<button class="ghb" data-ns="1">Settings</button></div></div>';
            if (S.eb)
                h += '<div class="ebn"><span class="ni">' + IC.chat + '</span><div><b>Get important updates by email</b><span>Connection requests and new messages, even when you are away.</span></div><button class="msgb" data-eb="on" style="height:40px;width:auto;padding:0 18px"><em>Turn on</em></button><button class="x2" data-eb="x" aria-label="Dismiss">×</button></div>';
            h += '<div class="cf" style="padding:0 0 8px"><button class="chip" data-nfl="0" aria-pressed="' + (S.nf == 0) + '">All</button><button class="chip" data-nfl="1" aria-pressed="' + (S.nf == 1) + '">Unread' + (un ? ' · ' + un : '') + '</button></div>';
            if (!L.length)
                return h + em("You are all caught up", "New requests, messages and matches will show up here.") + '</div>';
            ["Today", "Earlier"].forEach(function (g) {
                const a = L.filter(function (x) { return x.g == g; }); if (!a.length)
                    return; h += '<div class="ng">' + g + '</div>'; a.forEach(function (n) { const k = NT.indexOf(n); h += '<div class="nt' + (n.r ? "" : " u") + '" data-nt="' + k + '"><span class="ni' + (n.ty == "safe" ? " g" : "") + '">' + ic[n.ty] + '</span><div><p>' + (n.done ? 'You ' + n.done.toLowerCase() + ' the request from <b>' + (RM[n.ri] ? esc(RM[n.ri][1]) : "Roommate") + '</b>' : n.x) + '</p><small>' + esc(n.t) + '</small>' + (n.ty == "req" && n.actionable && !n.done ? '<div class="nts"><button class="msgb" data-na="Accepted" data-q="' + k + '"><em>Accept</em></button><button class="gh" data-na="Declined" data-q="' + k + '">Decline</button></div>' : '') + '</div>' + (n.r ? '' : '<span class="ud"></span>') + '</div>'; });
            });
            return h + '</div>';
        }
        addDocListener("click", async function (e) {
            const t = e.target.closest("[data-nt]"), b = e.target.closest("button"), d = b ? b.dataset : {};
            if (t && !b) {
                const n = NT[+t.dataset.nt];
                if (!n) return;
                pop("");
                if (n.id)
                    markNotificationReadBackend(n.id).catch(function () { toast("Could not mark notification read. Try again."); });
                if (n.ty == "msg") {
                    S.nav = "messages";
                    S.cid = CH.findIndex(function (c) { return c.id === n.roomId; });
                    if (S.cid < 0)
                        S.cid = null;
                }
                else if (n.ty == "match") {
                    S.back = "notifications";
                    try {
                        const targetId = n.roomId || n.room || n.listingId;
                        if (targetId) {
                            const place = await resolvePlace(targetId);
                            if (disposed) return;
                            if (place.room >= 0) { S.room = place.room; S.nav = "room"; }
                            else if (place.pg >= 0) { S.pg = place.pg; S.nav = "pg"; }
                        }
                    } catch (e) { }
                }
                else if (n.ty == "app") {
                    S.ck = MY.findIndex(function (l) { return l.id === n.listingId; });
                    if (S.ck < 0) {
                        try {
                            const place = await resolvePlace(n.listingId);
                            if (disposed)
                                return;
                            S.back = "notifications";
                            if (place.room >= 0) {
                                S.room = place.room;
                                S.nav = "room";
                            }
                            else if (place.pg >= 0) {
                                S.pg = place.pg;
                                S.nav = "pg";
                            }
                            else
                                throw Error("Listing unavailable");
                        }
                        catch (error) {
                            toast(error.message || "Listing unavailable");
                            return;
                        }
                    }
                    else {
                        AS = [];
                        AF.st = "All";
                        AF.q = "";
                        AF.n = 12;
                        S.nav = "applicants";
                    }
                }
                else if (n.ty == "req") {
                    S.nav = "connections";
                    S.sub = connectionNotificationTab(n.connectionId);
                }
                render();
                scrollTo(0, 0);
                return;
            }
            if (!b)
                return;
            if (d.history) {
                const current = CH.find(function (c) { return c.id === d.history; });
                if (!current || current.historyLoading)
                    return;
                current.historyLoading = true;
                loadOlderMessagesBackend(current.id, current.historyCursor).then(function (page) {
                    if (disposed) {
                        page.objectUrls.forEach(function (url) { URL.revokeObjectURL(url); });
                        return;
                    } cleanupFns.push(function () { page.objectUrls.forEach(function (url) { URL.revokeObjectURL(url); }); }); current.m = page.messages.concat(current.m); current.historyCursor = page.cursor; current.hasOlder = page.hasOlder; current.historyExpanded = true; render();
                }).catch(function (error) { toast(error.message || "Could not load history"); }).finally(function () { current.historyLoading = false; });
                return;
            }
            if (d.c2 !== undefined) {
                S.cid = +d.c2;
                render();
            }
            else if (d.bk2) {
                S.cid = null;
                render();
            }
            else if (d.cfl !== undefined) {
                S.cf = +d.cfl;
                render();
            }
            else if (d.nfl !== undefined) {
                S.nf = +d.nfl;
                render();
            }
            else if (d.snd) {
                const i = $("cin"), v = i.value.trim();
                if (v) {
                    snd(v);
                }
            }
            else if (d.qr) {
                snd(d.qr);
            }
            else if (d.sbx) {
                S.sbd = 1;
                rth();
            }
            else if (d.vp !== undefined) {
                openPersonByUid(d.vp, "messages");
            }
            else if (d.rp !== undefined) {
                cfm("Report this conversation?", "Tell us if something felt unsafe or like a scam. Our team will review the chat. You can also block this person.", "Send report", 1, function () { toast("Conversation reporting is not available here. Open the profile to report with a reason."); });
            }
            else if (d.mar) {
                if (authUser)
                    markAllNotificationsReadBackend(authUser.uid).then(function () { NT.forEach(function (x) { x.r = 1; }); render(); }).catch(function () { toast("Could not mark notifications read. Try again."); });
            }
            else if (d.eb) {
                if (d.eb == "on")
                    toast("Email updates are not available yet. No preference has been saved.");
                else
                    S.eb = 0;
                render();
            }
            else if (d.na) {
                const n2 = NT[+d.q], connectionId = n2.connectionId || (n2.raw && n2.raw.connectionId);
                if (!connectionId) {
                    toast("Open Connections to respond to this request.");
                    return;
                }
                b.disabled = true;
                updateConnectionStatusBackend(connectionId, d.na == "Accepted" ? "accepted" : "rejected").then(function () { toast(d.na == "Accepted" ? "Connection accepted" : "Request declined"); }).catch(function (error) { toast(error.message || "Could not update request."); }).finally(function () { b.disabled = false; });
            }
        });
        addDocListener("input", function (e) {
            if (e.target.id == "cin") {
                const roomId = CH[S.cid]?.id;
                if (roomId) CHAT_DRAFTS.set(roomId, e.target.value);
                $('csd').disabled = !e.target.value.trim() || CHAT_SENDS.has(roomId);
            }
            else if (e.target.id == "cq") {
                S.cs = e.target.value;
                const l = document.querySelector(".cli");
                if (l)
                    l.innerHTML = sanitizeRenderedHtml(cl());
            }
        });
        addDocListener("keydown", function (e) {
            if (e.target.id == "cin" && e.key == "Enter" && e.target.value.trim()) {
                e.preventDefault();
                snd(e.target.value.trim());
            }
        });
        addDocListener("change", function (e) {
            if (e.target.id == "cfile" && e.target.files[0]) {
                const c = CH[S.cid];
                if (!c)
                    return;
                uploadChatImageBackend(c.id, e.target.files[0]).then(function (path) { return snd("", path); }).catch(function (error) { toast(error.message || "Upload failed"); });
            }
        });
        function cl2(o) { return JSON.parse(JSON.stringify(o)); }
        let ME = {
            n: (currentProfile && currentProfile.name) || (authUser && (authUser.displayName || authUser.email?.split('@')[0])) || "My Account",
            job: (currentProfile && currentProfile.profession) || "",
            area: (currentProfile && (currentProfile.localities?.[0] || currentProfile.locality)) || "",
            city: (currentProfile && currentProfile.city) || "",
            activeIntents: currentProfile ? resolveUserHousingIntent(currentProfile).activeIntents : [],
            discover: Boolean(currentProfile && currentProfile.roommateDiscoveryEnabled === true),
            bio: (currentProfile && currentProfile.bio) || "",
            diet: (currentProfile && (currentProfile.householdExpectations?.dietPref || currentProfile.quizAnswers?.diet)) || "",
            smoke: (currentProfile && (currentProfile.householdExpectations?.smokingPolicy === 'smoking_allowed' ? "Smoker" : currentProfile.householdExpectations?.smokingPolicy === 'no_smoking' ? "Non-smoker" : currentProfile.quizAnswers?.smoke)) || "",
            sleep: (currentProfile && (currentProfile.householdExpectations?.quietHoursPolicy || currentProfile.quizAnswers?.sleep)) || "",
            guests: (currentProfile && (currentProfile.householdExpectations?.guestPolicy || currentProfile.quizAnswers?.guests)) || "",
            clean: (currentProfile && (currentProfile.householdExpectations?.cleanlinessPolicy || currentProfile.quizAnswers?.clean)) || "",
            ver: (currentProfile && currentProfile.isVerified) ? 1 : 0,
            ph: (currentProfile && currentProfile.avatar) || (authUser && authUser.photoURL) || "",
            phone: (currentProfile && currentProfile.phone) ? 1 : 0,
            email: (currentProfile && currentProfile.email) ? 1 : 0,
            em: (currentProfile && currentProfile.email) || (authUser && authUser.email) || "",
            phn: (currentProfile && currentProfile.phone) || (authUser && authUser.phoneNumber) || ""
        };
        let PR = { b: [currentProfile && currentProfile.budgetMin || 0, currentProfile && currentProfile.budget || 0], areas: currentProfile && currentProfile.localities || [], mv: currentProfile && currentProfile.moveInDate || "", types: currentProfile && currentProfile.preferredRoomTypes || [], gd: currentProfile && currentProfile.roommateGenderPreference || "Any", w: { smoke: 0, diet: 0, sleep: 0, guests: 0, clean: 0, pets: 0 } };
        const TG = { vis: currentProfile?.roommateDiscoveryEnabled === true ? "discoverable" : "hidden", bud: 1, broadcasts: currentProfile?.notificationPreferences?.broadcasts !== false };
        let DR = null, ER = {};
        S.as = "profile";
        S.st = 0;
        S.rs = 0;
        const ACS = [["profile", "Profile", IC.me], ["edit", "Edit profile", P('<path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/>')], ["verify", "Verification", IS.ver], ["prefs", "Matching preferences", P('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>')], ["settings", "Settings", P('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.600 5.600l2.100 2.100M16.300 16.300l2.100 2.100M5.600 18.400l2.100-2.100M16.300 7.700l2.100-2.100"/>')]];
        const TR = [["smoke", "Smoking"], ["diet", "Diet"], ["sleep", "Sleep schedule"], ["guests", "Guests"], ["clean", "Cleanliness"], ["pets", "Pets"]];
        function syn() { YOU.smoke = ME.smoke; YOU.diet = ME.diet; YOU.sleep = ME.sleep; YOU.b = [PR.b[0] / 1000, PR.b[1] / 1000]; YOU.areas = PR.areas.slice(); }
        function ps() { let m = ME, n = 0; n += m.ph ? 15 : 0; n += m.bio.trim().length >= 40 ? 15 : 0; n += m.job ? 10 : 0; n += (m.diet && m.smoke && m.sleep && m.guests && m.clean) ? 15 : 0; n += m.ver ? 25 : 0; n += m.phone ? 5 : 0; n += m.email ? 5 : 0; n += m.n.trim().length >= 2 ? 10 : 0; return n; }
        function ini(n) { return n.trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join("").toUpperCase() || "?"; }
        function avm(m, x) { return '<div class="avb">' + (m.ph ? '<img src="' + esc(m.ph) + '" alt="">' : ini(m.n)) + (m.ver ? '<span class="vb" title="ID verified">' + IC.chk + '</span>' : '') + '</div>'; }
        function dty() { return DR && JSON.stringify(DR) != JSON.stringify(S.as == "edit" ? ME : PR); }
        function sbu() {
            const e = $("svb"); if (e)
                e.style.display = dty() ? "flex" : "none";
        }
        function pm() { const b = DR ? DR : PR; return D.filter(function (d) { return d[3] >= b.b[0] && d[3] <= b.b[1] && b.areas.indexOf(d[2]) > -1 && (!b.types.length || b.types.indexOf(d[7]) > -1); }).length; }
        function ck(l, d, sec) { return '<div class="ck"><i class="' + (d ? "d" : "n") + '">' + (d ? "✓" : "") + '</i><div>' + l + '</div>' + (d ? '' : '<button data-as="' + sec + '">Do this</button>') + '</div>'; }
        function chp(k, a, m, src) { const o = src || DR; return '<div class="pfc">' + a.map(function (v) { const on = m ? o[k].indexOf(v) > -1 : o[k] === v; return '<button data-k2="' + k + '" data-v2="' + esc(v) + '"' + (m ? ' data-m2="1"' : '') + ' aria-pressed="' + on + '">' + esc(v) + '</button>'; }).join("") + '</div>'; }
        function ff(id, l, c, h) { return '<div class="pff' + (ER[id] ? " e" : "") + '"><label>' + l + '</label>' + c + (h ? '<div class="hp">' + h + '</div>' : '') + '<div class="er">' + (ER[id] || "") + '</div></div>'; }
        function sv() { return '<div class="svb" id="svb" style="display:' + (dty() ? "flex" : "none") + '"><span>You have unsaved changes</span><div style="display:flex;gap:8px"><button class="ghb" data-ds="1" style="height:44px">Discard</button><button class="msgb" data-sv="1"><em>Save changes</em></button></div></div>'; }
        function swt(k, v, lock) { return '<button class="sw" role="switch" aria-checked="' + (v ? "true" : "false") + '" data-sw="' + k + '"' + (lock ? " disabled" : "") + '></button>'; }
        function acP() {
            const m = ME, p = ps(), lf = [["Diet", m.diet], ["Smoking", m.smoke], ["Sleep", m.sleep], ["Guests", m.guests], ["Cleanliness", m.clean], ["Budget", "₹" + PR.b[0] / 1000 + "k–" + PR.b[1] / 1000 + "k"]];
            return '<div class="cd"><div class="phd pho">' + avm(m) + '<div style="flex:1;min-width:200px"><h1>' + esc(m.n) + '</h1><div class="loc" style="margin:0">' + IC.pin + esc(m.area) + ' · ' + esc(m.job) + '</div><div class="btns"><button class="msgb" data-as="edit"><em>Edit profile</em></button><button class="ghb" data-pvw="1">Preview</button><button class="ghb" data-shr="1">Share</button></div></div></div></div>' +
                '<div class="cd"><div class="sr"><div class="pring" style="--m:' + p + '"><b>' + p + '%</b></div><div><h2 style="margin:0">' + (p < 100 ? "Complete your profile" : "Your profile is complete") + '</h2><div class="s2" style="margin:0">Complete profiles get more replies and better matches.</div></div></div>' + ck("Add a profile photo", m.ph, "edit") + ck("Write a short bio (40+ characters)", m.bio.trim().length >= 40, "edit") + ck("Verify your ID", m.ver, "verify") + ck("Fill in your lifestyle", m.diet && m.smoke && m.sleep && m.guests && m.clean, "edit") + '</div>' +
                '<div class="cd"><h2>About</h2><p style="color:var(--ink2);margin:6px 0 16px">' + esc(m.bio) + '</p><div class="lf">' + lf.map(function (x) { return '<div><small>' + esc(x[0]) + '</small><b>' + esc(x[1]) + '</b></div>'; }).join("") + '</div></div>' +
                '<div class="cd"><h2>Trust</h2><div class="tru"><div><i class="' + (m.ver ? "" : "no") + '">' + (m.ver ? "✓" : "–") + '</i>Government ID ' + (m.ver ? "verified" : "not verified yet") + (m.ver ? '' : ' <button class="lk2" data-as="verify" style="color:var(--brand);font-weight:600;margin-left:8px">Verify now</button>') + '</div><div><i>✓</i>Email verified</div></div></div>' +
                '<p class="hp" style="margin-top:8px">Design state: <button data-rs="1" style="text-decoration:underline">' + (S.rs ? "Show normal account" : "Preview a restricted account") + '</button></p>';
        }
        function acE() {
            const d = DR;
            return '<h1>Edit profile</h1><div class="sub3">This is what people see when they open your profile.</div><div class="cd"><div class="phd">' + avm(d) + '<div><label class="ghb" style="cursor:pointer"><input type="file" id="efile" accept="image/*" hidden>Change photo</label>' + (d.ph ? ' <button class="ghb" data-rph="1">Remove</button>' : '') + '<div class="hp" style="margin-top:8px">A clear face photo builds trust.</div></div></div></div>' +
                '<div class="cd">' + ff("n", "Full name", '<div class="pin"><input id="ed-n" aria-label="Full name" value="' + esc(d.n) + '" placeholder="Your name"></div>') + ff("job", "What do you do?", '<div class="pin"><input id="ed-job" value="' + esc(d.job) + '" placeholder="e.g. Product manager"></div>') + ff("city", "City", '<div class="pin"><input id="ed-city" aria-label="City" value="' + esc(d.city) + '" placeholder="Your city" maxlength="64"></div>') + ff("area", "Locality", '<div class="pin"><input id="ed-area" aria-label="Locality" value="' + esc(d.area) + '" placeholder="Your locality" maxlength="128"></div>') + ff("bio", "About you", '<textarea class="tx" id="ed-bio" placeholder="A few lines about how you live">' + esc(d.bio) + '</textarea><div class="hp"><span id="bc">' + esc(d.bio.length) + '</span>/280</div>') + '</div>' +
                '<div class="cd"><h3>Housing intent</h3><p class="s2">Choose any that apply. Leave these blank if you only list property.</p>' + [["find_room", "Find a room"], ["team_up", "Team up to rent together"], ["have_room", "I live in a property and have a spare room"]].map(function (choice) { return '<label class="rw" style="display:flex;flex-wrap:nowrap;align-items:flex-start;justify-content:flex-start;gap:10px"><input style="width:16px;flex:0 0 16px;margin-top:3px" type="checkbox" data-housing-intent="' + choice[0] + '" ' + (d.activeIntents.indexOf(choice[0]) > -1 ? 'checked' : '') + '><span>' + choice[1] + '</span></label>'; }).join('') + '<label class="rw" style="display:flex;flex-wrap:nowrap;align-items:flex-start;justify-content:flex-start;gap:10px"><input style="width:16px;flex:0 0 16px;margin-top:3px" type="checkbox" id="ed-discover" ' + (d.discover ? 'checked' : '') + '><span>Show my profile in roommate discovery</span></label><p class="hp">Discovery includes Team-Up seekers and resident hosts with an eligible active listing. Finding a room alone does not make you a Team-Up candidate.</p></div>' +
                '<div class="cd"><h3>Lifestyle</h3><div class="s2">Used to calculate your match with rooms and roommates.</div>' + [["diet", "Diet", ["Vegetarian", "Eggetarian", "Non-vegetarian"]], ["smoke", "Smoking", ["Non-smoker", "Smoker"]], ["sleep", "Sleep", ["Early riser", "Night owl", "Flexible"]], ["guests", "Guests", ["Rarely", "Sometimes", "Often"]], ["clean", "Cleanliness", ["Very tidy", "Tidy", "Relaxed"]]].map(function (q) { return ff(q[0], q[1], chp(q[0], q[2])); }).join("") + '</div>' + sv();
        }
        function acV() {
            const isApproved = (USER_KYC.status === 'approved' || (ME && ME.ver));
            const isPending = (USER_KYC.status === 'pending');
            const isRejected = (USER_KYC.status === 'rejected' || USER_KYC.status === 'resubmission_required');
            const rejReason = (USER_KYC.doc && (USER_KYC.doc.reviewNote || USER_KYC.doc.rejectionReason)) || '';
            let statusBanner = '';
            if (isApproved) {
                statusBanner = '<div class="cd" style="background:#e4f5ee;border-color:transparent">' +
                    '<div class="rw" style="border:0;padding:0"><i class="ni g" style="background:#fff">' + IS.ver + '</i>' +
                    '<div><b>Identity document reviewed</b><small style="color:var(--ink)">Your submitted identity document passed manual review. Your room listings are now active and published to discovery.</small></div></div>' +
                    '<div style="margin-top:14px"><button class="ghb" data-n="listings" style="height:38px;padding:0 20px;font-size:13px">View my listings</button></div>' +
                    '</div>';
            }
            else if (isPending) {
                statusBanner = '<div class="cd" style="background:#fff4e5;border-color:transparent">' +
                    '<div class="rw" style="border:0;padding:0"><i class="ni" style="background:#fff">' + IC.sh + '</i>' +
                    '<div><b>Verification Under Review</b><small style="color:var(--ink)">Your document has been submitted and is currently being reviewed by our moderation team. Your listings will automatically be activated once verified.</small></div></div>' +
                    '<div style="margin-top:14px"><button class="ghb" data-n="listings" style="height:38px;padding:0 20px;font-size:13px">View my listings</button></div>' +
                    '</div>';
            }
            else if (isRejected) {
                statusBanner = '<div class="cd" style="background:#fde8e8;border-color:transparent">' +
                    '<div class="rw" style="border:0;padding:0"><i class="ni" style="background:#fff;color:var(--err)">✕</i>' +
                    '<div><b style="color:var(--err)">Verification Rejected</b><small style="color:var(--ink)">' + (rejReason ? 'Reason: ' + esc(rejReason) : 'The submitted document could not be verified.') + ' You may re-submit a clear document below to publish your room listing.</small></div></div>' +
                    '</div>';
            }
            let formHtml = '';
            if (!isApproved && !isPending) {
                formHtml = '<div class="cd">' +
                    '<div style="background:#fff4e5;border:1px solid #ffd8a8;border-radius:12px;padding:14px 16px;margin-bottom:18px;display:flex;gap:12px;align-items:center">' +
                    '<svg style="width:22px;height:22px;fill:#f0541e;flex-shrink:0" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>' +
                    '<div style="font-size:13.5px;color:#495057;line-height:1.45"><b style="color:#d9480f">Required to publish room listings:</b> Complete verification below so your room listing can be reviewed and published to discovery.</div>' +
                    '</div>' +
                    '<h3>Submit Government ID for Verification</h3>' +
                    '<p class="sub2" style="margin-bottom:16px">Upload a government-issued identification document to verify your account. Documents are kept strictly private and reviewed only by authorized NestMate admins.</p>' +
                    ff("kyc-type", "Document Type", '<select id="kyc-type" class="pill" style="width:100%;height:46px;padding:0 14px;border:1px solid var(--line);border-radius:12px;font-size:14px;background:var(--sf)">' +
                        '<option value="masked_aadhaar">Masked Aadhaar (Last 4 digits visible)</option>' +
                        '<option value="passport">Passport</option>' +
                        '<option value="voter_id">Voter ID</option>' +
                        '<option value="driving_license">Driving License</option>' +
                        '</select>') +
                    ff("kyc-name", "Full Legal Name", '<div class="pin"><input id="kyc-name" value="' + esc((ME && ME.n) || '') + '" placeholder="Full name as printed on document"></div>') +
                    '<div class="pff"><label>Document File (JPG, PNG, WebP or PDF · max 5MB)</label>' +
                    '<div class="pin" style="padding:10px 14px"><input type="file" id="kyc-file" accept=".jpg,.jpeg,.png,.webp,.pdf" style="font-size:13.5px"></div>' +
                    '<div class="hp">Ensure your photo, name, and document details are clearly legible.</div>' +
                    '</div>' +
                    '<div style="margin:16px 0;display:flex;align-items:flex-start;gap:10px">' +
                    '<input type="checkbox" id="kyc-consent" style="margin-top:3px;cursor:pointer">' +
                    '<label for="kyc-consent" style="font-size:13.5px;color:var(--ink2);line-height:1.45;cursor:pointer">I confirm this is my genuine government identification document and consent to manual verification by the NestMate moderation team.</label>' +
                    '</div>' +
                    '<div id="kyc-err" style="color:var(--err);font-size:13.5px;margin-bottom:12px;display:none"></div>' +
                    '<button class="msgb" data-kyc="submit" style="width:auto;padding:0 24px;height:46px"><em>Submit for Verification</em></button>' +
                    '</div>';
            }
            return '<h1>Verification</h1><div class="sub3">Verified people are easier to trust, for both sides of a room.</div>' +
                statusBanner +
                formHtml +
                '<div class="cd"><h3>Checks</h3><div class="tru" style="margin-top:8px">' +
                '<div><i class="' + (isApproved ? "" : "no") + '">' + (isApproved ? "✓" : "–") + '</i>Government ID ' + (isApproved ? "verified" : isPending ? "under review" : "not verified") + '</div>' +
                '<div><i class="' + (authUser && authUser.emailVerified ? "" : "no") + '">' + (authUser && authUser.emailVerified ? "✓" : "–") + '</i>Email address ' + (authUser && authUser.emailVerified ? "verified" : "registered") + '</div>' +
                '</div></div>' +
                '<div class="safe">' + IC.sh + '<div>Your document is stored in a private restricted bucket accessible only to administrators. NestMate never shares or displays it publicly.</div></div>';
        }
        function acR() {
            const d = DR;
            return '<h1>Matching preferences</h1><div class="sub3">Tell us what you are looking for. Your match scores update to fit.</div><div class="cd"><h3>Budget</h3><div class="s2">Monthly rent you are comfortable with.</div><div class="rg2"><div><label>Minimum · <b id="pl0">₹' + d.b[0].toLocaleString("en-IN") + '</b></label><input type="range" id="pb0" min="5000" max="60000" step="1000" value="' + esc(d.b[0]) + '"></div><div><label>Maximum · <b id="pl1">₹' + d.b[1].toLocaleString("en-IN") + '</b></label><input type="range" id="pb1" min="5000" max="60000" step="1000" value="' + esc(d.b[1]) + '"></div></div>' + (ER.b ? '<div class="er" style="display:block;color:#d92d20;font-size:13.5px;margin-top:6px">' + ER.b + '</div>' : '') + '</div>' +
                '<div class="cd">' + ff("areas", "Areas", chp("areas", LOC, 1), "Pick every area you would consider.") + ff("types", "Place type", chp("types", ["Private room", "Full flat", "PG / Coliving"], 1)) + ff("mv", "Move-in", chp("mv", ["Any time", "Within 15 days", "Within 30 days", "Within 60 days"])) + ff("gd", "Roommate gender", chp("gd", ["Any", "Female", "Male"])) + '</div>' +
                '<div class="cd"><h3>What matters to you</h3><div class="s2">Set how much each habit should count towards a match.</div>' + TR.map(function (t) { const w = d.w[t[0]]; return '<div class="rw"><div><b>' + t[1] + '</b></div><div class="sg3">' + ["Do not mind", "Prefer", "Must have"].map(function (l, i) { return '<button data-w="' + t[0] + '" data-v2="' + i + '" aria-pressed="' + (w == i) + '">' + l + '</button>'; }).join("") + '</div></div>'; }).join("") + '</div>' +
                '<div class="hint" style="background:var(--bs)">' + IS.spk + '<div><b id="pmc">' + pm() + ' of ' + esc(D.length) + '</b> sample rooms fit these preferences right now.</div></div>' + sv();
        }
        let acS = function () {
            let t = S.st, h = '<h1>Settings</h1><div class="sub3">Your account, privacy and notifications.</div><div class="cf" style="padding:0 0 16px">' + ["Account", "Privacy", "Notifications"].map(function (x, i) { return '<button class="chip" data-st="' + i + '" aria-pressed="' + (t == i) + '">' + x + '</button>'; }).join("") + '</div>';
            if (t == 0)
                h += '<div class="cd"><h3>Sign-in</h3><div class="rw" style="border:0"><div><b>Email</b><small>' + esc(ME.em) + '</small></div>' + (passwordSignIn ? '<button class="ghb" data-em="1">Change</button>' : '') + '</div><div class="rw" style="border:0;padding-top:0"><div><b>Phone</b><small>' + (ME.phn || 'Not provided') + '</small></div></div>' + (passwordSignIn ? ff("cp", "Current password", '<div class="pin"><input id="cp" type="password" autocomplete="current-password"></div>') + ff("np", "New password", '<div class="pin"><input id="np" type="password" autocomplete="new-password" placeholder="At least 8 characters"></div>') + ff("np2", "Confirm new password", '<div class="pin"><input id="np2" type="password" autocomplete="new-password"></div>') + '<button class="msgb" data-pw="1" style="width:auto;padding:0 22px;height:46px"><em>Update password</em></button>' : '<p class="hp">Your sign-in provider manages your credentials. Use that provider to update them.</p>') + '</div><div class="cd"><div class="rw" style="border:0;padding:0"><div><b>Download your data</b><small>Download a private compressed JSON record export, including shared message history. File references are included; image/document bytes are not embedded. The download expires after 24 hours.</small></div><button class="ghb" data-ex="1" ' + (exportInFlight || !ACCOUNT_EXPORT_AVAILABLE ? 'disabled' : '') + '>' + (!ACCOUNT_EXPORT_AVAILABLE ? 'Export unavailable' : exportInFlight ? 'Preparing export...' : 'Request export') + '</button></div></div><div class="cd dz"><div class="rw" style="border:0;padding:0"><div><b>Delete account</b><small>Removes account identity and owned data. Shared conversation history remains available to peers. Availability is pending coverage and service verification.</small></div><button class="ghb dng" disabled>Deletion unavailable</button></div></div>';
            else if (t == 1)
                h += '<div class="cd"><h3>Roommate discovery</h3><p class="hp">Choose whether your opted-in member card appears in roommate discovery. Your basic identity remains visible in existing conversations and applications.</p><div class="pfc" style="margin:10px 0 6px">' + [["discoverable", "Discoverable"], ["hidden", "Hidden from discovery"]].map(function (x) { return '<button data-vis="' + x[0] + '" aria-pressed="' + (TG.vis === x[0]) + '"' + (settingsInFlight ? ' disabled' : '') + '>' + x[1] + '</button>'; }).join('') + '</div><p class="hp">A complete profile and an active housing intent are required to appear in discovery. Edit your profile to manage the details shared on your member card.</p></div>';
            else
                h += '<div class="cd"><h3>In-app announcements</h3><div class="rw"><div><b>Community broadcasts</b><small>Receive new in-app announcements from NestMate. Existing notifications remain in your inbox.</small></div>' + swt('broadcasts', TG.broadcasts, settingsInFlight) + '</div><p class="hp">Messages, requests and application updates remain in your in-app inbox. Email delivery and category-specific controls are not available.</p></div>';
            return h;
        };
        function ac() {
            const h = '<div class="ac"><nav class="acn">' + ACS.map(function (a) { return '<button class="al" data-as="' + a[0] + '" aria-current="' + (S.as == a[0]) + '">' + a[2] + a[1] + (a[0] == "verify" ? '<span class="st3' + (ME.ver ? " ok" : "") + '"></span>' : "") + '</button>'; }).join("") + '<hr><button class="al" data-so="1">' + P('<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>') + 'Sign out</button></nav><div class="acc">' + ACS.map(function (a) { return '<button class="chip" data-as="' + a[0] + '" aria-pressed="' + (S.as == a[0]) + '">' + a[1] + '</button>'; }).join("") + '</div><div class="acm">' + (S.rs ? '<div class="rb">' + IC.sh + '<div><b>Your account is restricted</b><br>Messaging and posting are paused while we review a report. You can still browse.</div><button data-sup="1">Contact support</button></div>' : '') +
                (S.as == "profile" ? acP() : S.as == "edit" ? acE() : S.as == "verify" ? acV() : S.as == "prefs" ? acR() : acS()) + '</div></div>';
            return h;
        }
        function go(sec) { S.as = sec; DR = sec == "edit" ? cl2(ME) : sec == "prefs" ? cl2(PR) : null; ER = {}; render(); scrollTo(0, 0); }
        function dlg(h, w) {
            if (disposed)
                return; $("cfb").innerHTML = sanitizeRenderedHtml(h); $("cfb").parentNode.className = "cfm" + (w ? " w" : ""); $("cfo").classList.add("o"); setTimeout(function () {
                    const f = $("cfb").querySelector("input,textarea,button"); if (f)
                        f.focus();
                }, 60);
        }
        function vd(st, er) {
            const b = 'style="width:auto;padding:0 22px;height:46px"';
            if (st == 1)
                dlg('<h3>Verify with Aadhaar</h3><p>Enter your 12-digit Aadhaar number. It is only used to confirm it is you.</p><div class="pff' + (er ? " e" : "") + '"><div class="pin"><input id="vda" inputmode="numeric" maxlength="14" placeholder="1234 5678 9012" autocomplete="off"></div><div class="er">' + (er || "") + '</div></div><div class="r"><button class="ghb" data-cf="no" style="height:46px">Cancel</button><button class="msgb" data-vd="otp" ' + b + '><em>Send code</em></button></div>');
            else if (st == 2)
                dlg('<h3>Enter the code</h3><p>We sent a 6-digit code to the mobile number linked with your Aadhaar.</p><div class="pff' + (er ? " e" : "") + '"><div class="pin"><input id="vdo" class="otp" inputmode="numeric" maxlength="6" placeholder="······" autocomplete="one-time-code"></div><div class="er">' + (er || "") + '</div></div><div class="r"><button class="ghb" data-vd="start" style="height:46px">Back</button><button class="msgb" data-vd="ok" ' + b + '><em>Verify</em></button></div>');
            else
                dlg('<div style="text-align:center"><svg viewBox="0 0 92 92" width="92" height="92"><circle cx="46" cy="46" r="40" fill="var(--bs)"/><circle cx="46" cy="46" r="28" fill="#12805c"/><path d="m34 47 8 8 16-17" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg><h3 style="margin-top:12px">You are verified</h3><p>A verified badge now shows on your profile and listings.</p><button class="msgb" data-vd="done" style="width:100%;height:48px"><em>Done</em></button></div>');
        }
        function pvw() { const m = ME, t = [m.diet, m.smoke, m.sleep]; dlg('<div class="pvx"><div class="eb" style="color:var(--brand);font-weight:700;font-size:12px;letter-spacing:.07em;text-transform:uppercase;margin-bottom:12px">How others see you</div><div class="phd">' + avm(m) + '<div><h3 style="font-size:22px;margin:0">' + esc(m.n) + '</h3><div class="loc" style="margin:2px 0 0">' + IC.pin + esc(m.area) + ' · ' + esc(m.job) + '</div></div></div><p style="color:var(--ink2);margin:16px 0 10px">' + esc(m.bio) + '</p><div class="tg">' + t.map(function (x) { return '<span>' + x + '</span>'; }).join("") + '</div>' + (TG.bud ? '<div class="loc" style="margin-top:14px">' + IC.wal + "Budget ₹" + PR.b[0] / 1000 + "k–" + PR.b[1] / 1000 + "k</div>" : "") + '<div class="tru" style="margin-top:12px"><div><i class="' + (m.ver ? "" : "no") + '">' + (m.ver ? "✓" : "–") + '</i>' + (m.ver ? "ID verified" : "ID not verified yet") + '</div></div><div class="r" style="margin-top:20px"><button class="ghb" data-cf="no" style="height:46px">Close</button><button class="msgb" data-as="edit" data-cf="no" style="width:auto;padding:0 20px;height:46px"><em>Edit profile</em></button></div></div>', 1); }
        function shr() { toast("Public profile sharing is not available yet. No public link was created."); }
        addDocListener("click", function (e) {
            const b = e.target.closest("button");
            if (!b || S.nav != "profile" && !$("cfo").classList.contains("o"))
                return;
            const d = b.dataset;
            if (d.kyc == "submit") {
                const fileInput = $("kyc-file");
                const docTypeSelect = $("kyc-type");
                const nameInput = $("kyc-name");
                const consentCheck = $("kyc-consent");
                const errBox = $("kyc-err");
                const showErr = function (msg) {
                    if (errBox) {
                        errBox.textContent = msg;
                        errBox.style.display = "block";
                    }
                };
                if (!authUser || !authUser.uid) {
                    showErr("Please sign in to submit verification documents.");
                    return;
                }
                const f = fileInput && fileInput.files && fileInput.files[0];
                if (!f) {
                    showErr("Please select a document file to upload.");
                    return;
                }
                if (f.size > 5 * 1024 * 1024) {
                    showErr("File size must be 5MB or less.");
                    return;
                }
                const docType = docTypeSelect ? docTypeSelect.value : "Masked Aadhaar";
                const declaredName = (nameInput ? nameInput.value.trim() : "") || ME.n;
                if (declaredName.length < 2) {
                    showErr("Please enter your full legal name.");
                    return;
                }
                if (!consentCheck || !consentCheck.checked) {
                    showErr("You must confirm document authenticity and give consent.");
                    return;
                }
                if (errBox)
                    errBox.style.display = "none";
                b.disabled = true;
                b.innerHTML = sanitizeRenderedHtml("<em>Uploading document...</em>");
                submitManualKycBackend(f, docType, declaredName, true).then(function () {
                    toast("Verification document submitted! Our team will review it.");
                    USER_KYC.status = "pending";
                    USER_KYC.doc = { status: "pending", declaredName: declaredName, documentType: docType };
                    render();
                }).catch(function (err) {
                    b.disabled = false;
                    b.innerHTML = sanitizeRenderedHtml("<em>Submit for Verification</em>");
                    showErr(err?.message || "Failed to upload document. Please try again.");
                });
                return;
            }
            if (d.as && S.nav == "profile" || d.as && d.cf) {
                S.nav = "profile";
                go(d.as);
                return;
            }
            if (d.k2) {
                const o = DR, k = d.k2;
                if (d.m2) {
                    const i = o[k].indexOf(d.v2);
                    if (i > -1)
                        o[k].splice(i, 1);
                    else
                        o[k].push(d.v2);
                }
                else
                    o[k] = d.v2;
                delete ER[k];
                render();
            }
            else if (d.w) {
                toast("Matching weights cannot be saved yet. No change was made.");
            }
            else if (d.ds) {
                DR = cl2(S.as == "edit" ? ME : PR);
                ER = {};
                render();
            }
            else if (d.sv) {
                ER = {};
                if (S.as == "edit") {
                    if (DR.n.trim().length < 2)
                        ER.n = "Enter your name";
                    if (DR.bio.length > 280)
                        ER.bio = "Keep it under 280 characters";
                }
                else {
                    if (DR.b[0] > DR.b[1])
                        ER.b = "Minimum cannot be above maximum";
                    if (!DR.areas.length)
                        ER.areas = "Pick at least one area";
                }
                if (Object.keys(ER).length) {
                    render();
                }
                else {
                    let draft = cl2(DR), editing = S.as == "edit", payload;
                    try {
                        payload = editing ? buildProfileEditorUpdate(draft, currentProfile || {}) : buildMatchingPreferencesUpdate(draft, currentProfile || {});
                    }
                    catch (error) {
                        toast(error.message || "Check your profile details.");
                        return;
                    }
                    b.disabled = true;
                    updateUserProfileBackend(payload).then(function () {
                        if (editing)
                            ME = draft;
                        else
                            PR = draft; syn(); DR = cl2(editing ? ME : PR); toast(editing ? "Profile saved" : "Preferences saved"); render(); void refreshProfile();
                    }).catch(function (error) { toast(error.message || "Could not save changes. Your edits are still here."); }).finally(function () { b.disabled = false; });
                }
            }
            else if (d.rph) {
                DR.ph = "";
                render();
            }
            else if (d.pvw)
                pvw();
            else if (d.shr)
                shr();
            else if (d.cp) {
                const v = $("shl").value;
                navigator.clipboard.writeText(v).then(function () { toast("Link copied"); }).catch(function () { toast("Could not copy. Select and copy the link manually."); });
            }
            else if (d.st !== undefined && S.nav == "profile") {
                S.st = +d.st;
                render();
            }
            else if (d.sw === 'broadcasts' || d.vis) {
                if (settingsInFlight) return;
                if (!authUser || !currentProfile) { openAuthModal(); return; }
                const visibility = d.vis && (d.vis === 'discoverable' || d.vis === 'hidden');
                if (d.vis && !visibility) return;
                const visible = d.vis === 'discoverable';
                if (visibility && visible && !resolveUserHousingIntent(currentProfile).activeIntents.length) {
                    toast('Choose an active housing intent in Edit profile first.'); return;
                }
                const enabled = !TG.broadcasts;
                const update = visibility ? { roommateDiscoveryEnabled: visible } : { 'notificationPreferences.broadcasts': enabled };
                settingsInFlight = true; render();
                updateUserProfileBackend(update).then(function () {
                    if (visibility) { TG.vis = visible ? 'discoverable' : 'hidden'; ME.discover = visible; }
                    else TG.broadcasts = enabled;
                    toast('Setting saved.');
                    return refreshProfile();
                }).catch(function () { toast('Could not save this setting. Try again.'); }).finally(function () {
                    settingsInFlight = false; if (!disposed) render();
                });
            }
            else if (d.rs) {
                S.rs ^= 1;
                render();
            }
            else if (d.sup)
                navigate('/help');
            else if (d.so)
                cfm("Sign out?", "You can sign back in any time.", "Sign out", 0, function () { logout().then(function () { navigate("/"); }).catch(function () { toast("Could not sign out. Try again."); }); });
            else if (d.pw) {
                if (!passwordSignIn) return;
                ER = {};
                const a = $("cp").value, n = $("np").value, c = $("np2").value;
                if (!a)
                    ER.cp = "Enter your current password";
                if (n.length < 8)
                    ER.np = "Use at least 8 characters";
                if (c != n)
                    ER.np2 = "Passwords do not match";
                if (Object.keys(ER).length)
                    render();
                else {
                    if (!auth.currentUser || !auth.currentUser.email) {
                        toast("Sign in again to change your password.");
                        return;
                    }
                    b.disabled = true;
                    reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, a)).then(function () { return updatePassword(auth.currentUser, n); }).then(function () { ER = {}; toast("Password updated"); render(); }).catch(function (error) { toast(error.message || "Could not update password."); }).finally(function () { b.disabled = false; });
                }
            }
            else if (d.ex) {
                if (!ACCOUNT_EXPORT_AVAILABLE) { toast('Data exports are temporarily unavailable.'); return; }
                if (exportInFlight) return;
                exportInFlight = true;
                b.disabled = true;
                b.textContent = 'Preparing export...';
                prepareAccountExportBackend().then(function (result) {
                    if (disposed) return;
                    const url = URL.createObjectURL(result.blob), link = document.createElement('a');
                    link.href = url; link.download = result.fileName; document.body.appendChild(link); link.click(); link.remove();
                    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
                    toast('Export download started.');
                }).catch(function (error) { if (!disposed) toast(error.message || 'Could not prepare your export.'); })
                    .finally(function () { exportInFlight = false; if (!disposed) { const button = document.querySelector('[data-ex]'); if (button) { button.disabled = false; button.textContent = 'Request export'; } } });
            }
            else if (d.dl)
                toast("Account deletion is not available in this screen yet. Your account has not been changed.");
            else if (d.vd) {
                toast("Use the manual document upload for identity verification.");
            }
        });
        addDocListener("input", function (e) {
            const t = e.target, id = t.id;
            if (id == "vda") {
                const v = t.value.replace(/\D/g, "").slice(0, 12).replace(/(\d{4})(?=\d)/g, "$1 ");
                t.value = v;
                return;
            }
            if (!DR)
                return;
            if (id == "ed-n")
                DR.n = t.value;
            else if (id == "ed-job")
                DR.job = t.value;
            else if (id == "ed-city")
                DR.city = t.value;
            else if (id == "ed-area")
                DR.area = t.value;
            else if (id == "ed-bio") {
                DR.bio = t.value;
                $("bc").textContent = t.value.length;
            }
            else if (id == "pb0" || id == "pb1") {
                const i = +id[2];
                DR.b[i] = +t.value;
                $("pl" + i).textContent = "₹" + DR.b[i].toLocaleString("en-IN");
                $("pmc").textContent = pm() + " of " + D.length;
            }
            else
                return;
            sbu();
        });
        addDocListener("change", function (e) {
            if (e.target.id == "efile" && e.target.files[0]) {
                const draft = DR;
                uploadProfileAvatarBackend(e.target.files[0]).then(function (url) {
                    if (DR !== draft)
                        return; DR.ph = url; render();
                }).catch(function (error) { toast(error.message || "Could not upload profile photo."); });
            }
        });
        addDocListener("change", function (event) {
            if (!DR)
                return; const target = event.target, intent = target.dataset.housingIntent; if (intent) {
                    const selected = DR.activeIntents.indexOf(intent);
                    if (target.checked && selected < 0)
                        DR.activeIntents.push(intent);
                    else if (!target.checked && selected >= 0)
                        DR.activeIntents.splice(selected, 1);
                    sbu();
                }
            else if (target.id === "ed-discover") {
                DR.discover = target.checked;
                sbu();
            }
        });
        IC.meal = P('<path d="M6 3v8a2 2 0 0 0 2 2v8M10 3v6M6 7h4M17 3c-2 1-3 4-3 7h3v11"/>');
        (G = []);
        let RS = [];
        S.sim = "";
        function pgl() {
            const q = (S.q || "").toLowerCase().trim();
            return G.filter(function (x) {
                if (x[2] < (S.min || 0) || x[2] > S.max)
                    return false;
                if (S.propertyType && !String(x[18] && x[18].flatType || '').toLowerCase().includes(S.propertyType))
                    return false;
                if (S.ver && !x[8])
                    return false;
                if (S.gender && S.gender !== "Any") {
                    const gStr = String(x[5] || "").toLowerCase();
                    const targetG = S.gender.toLowerCase();
                    if (gStr !== "co-ed" && gStr !== "any" && gStr.indexOf(targetG) < 0)
                        return false;
                }
                if (S.move < 999) {
                    const mDays = parseMoveIn(x[7]);
                    if (mDays > S.move)
                        return false;
                }
                if (q && [x[0], x[1], x[18] && x[18].city].filter(Boolean).join(" ").toLowerCase().indexOf(q) < 0)
                    return false;
                return true;
            }).sort(function (a, b) { return S.sort == "a" ? a[2] - b[2] : S.sort == "d" ? b[2] - a[2] : b[9] - a[9]; });
        }
        function mix() { return list().concat(pgl()).sort(function (a, b) { const pa = a.pg ? a[2] : a[3], pb = b.pg ? b[2] : b[3], ma = a.pg ? a[9] : a[11], mb = b.pg ? b[9] : b[11]; return S.sort == "a" ? pa - pb : S.sort == "d" ? pb - pa : mb - ma; }); }
        function pgc(x) {
            const i = G.indexOf(x);
            const pgCover = (x[12] && x[12][0]) ? x[12][0] : '';
            const coverImg = pgCover
                ? '<img src="' + esc(pgCover) + '" alt="' + esc(x[0]) + '" loading="lazy" style="width:100%;height:100%;object-fit:cover">'
                : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--bs);color:var(--brand)"><svg style="width:40px;height:40px" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" d="M3 11 12 3l9 8v9H3z"/></svg></div>';
            return '<article class="card" data-g="' + i + '"><div class="ph">' + coverImg + '<span class="tag">' + esc(x[10]) + '</span>' + (x[8] ? '<span class="vb" title="Verified">' + IC.chk + '</span>' : '') + '<span class="mp"><i style="--m:' + esc(x[9]) + '"></i>' + (x[9] > 0 ? esc(x[9]) + '% match' : 'Set preferences') + '</span></div><div class="bd"><div class="tr"><div class="t">' + esc(x[0]) + '</div><button class="ib sv" data-id="p' + i + '" aria-pressed="' + (isPgSaved(x, i) ? "true" : "false") + '" aria-label="Save">' + IC.heart + '</button></div><div class="loc">' + IC.pin + esc(x[1]) + ' · ' + esc(x[7]) + '</div><div class="fx"><div title="Sharing">' + IC.bed + esc(x[3]) + '</div><div title="For">' + IC.usr + esc(x[5]) + '</div><div title="Food">' + IC.meal + esc(x[4]) + '</div><div title="Deposit">' + IC.wal + cf(x[6]) + ' deposit</div></div><div class="ft"><div class="pr"><b>' + fmt(x[2]) + '</b><span>/bed</span></div>' + listingCommunicationButtons('p', i) + '</div></div></article>';
        }
        function sks() {
            let h = ""; for (let i = 0; i < 6; i++)
                h += '<div class="card sk"><div class="ph"></div><div class="bd"><i style="width:80%"></i><i style="width:55%"></i><i style="width:90%"></i><i style="width:40%"></i></div></div>'; return h;
        }
        function erm() { return '<div class="empty"><svg viewBox="0 0 160 120" width="160" height="120" aria-hidden="true"><circle cx="80" cy="64" r="46" fill="var(--bs)"/><path d="M50 82a18 18 0 0 1 4-35 24 24 0 0 1 46-4 20 20 0 0 1 8 39z" fill="#f0541e"/><rect x="77" y="52" width="6" height="16" rx="3" fill="#fff"/><circle cx="80" cy="76" r="3.500" fill="#fff"/></svg><b>We could not load places</b>Check your connection and try again.<br><button class="post" data-sim="" style="display:inline-block">Try again</button></div>'; }
        function dsx() { return ""; }
        function exem() {
            if (S.q)
                return em("No results for \"" + esc(S.q) + "\"", "Check the spelling, or try a nearby area.", '<div class="ppc2">' + LOC.slice(0, 4).map(function (l) { return '<button class="pill" data-sq="' + l + '">' + l + '</button>'; }).join("") + '</div><button class="pill" data-sqc="1" style="margin:16px auto 0">Clear search</button>');
            if (S.cat === 2) {
                if (RM.length === 0) {
                    return em("No roommate candidates available right now", "Roommate discovery features verified Team-Up seekers and Live-in Hosts offering spare rooms.", (authUser ? '<div class="r" style="margin-top:16px;gap:8px;justify-content:center"><button class="pill" data-n="profile">Update your roommate preferences</button><button class="pill" data-n="post">Post a room</button></div>' : '<br><button class="pill" data-n="signin" style="margin:16px auto 0">Sign in to connect</button>'));
                }
                return em("No roommates match these filters", "Try a higher budget or a wider move-in window.", '<br><button class="pill" data-rs="1" style="margin:16px auto 0">Reset filters</button>');
            }
            if (D.length === 0) {
                return em("No places available right now", "Rooms and flats will appear here when posted.", '<br><button class="pill" data-n="post" style="margin:16px auto 0">Post a room</button>');
            }
            return em("No places match these filters", "Try a higher budget or a wider move-in window.", '<br><button class="pill" data-rs="1" style="margin:16px auto 0">Reset filters</button>');
        }
        function pop(k) {
            ["ppc", "ppq", "ppb"].forEach(function (i) { $(i).classList.remove("o"); });
            $("pps").classList.toggle("o", !!k && k != "q");
            document.body.classList.toggle("ppo", !!k);
            if (!k)
                return;
            const el = $("pp" + k);
            if (k == "c")
                el.innerHTML = sanitizeRenderedHtml('<div class="pph" style="padding:6px 8px 4px">Choose your city</div><button class="cti" data-pop="">' + IC.pin + 'Bengaluru<span class="ck2">✓</span></button>' + ["Hyderabad", "Mumbai", "Delhi NCR", "Chennai"].map(function (c) { return '<button class="cti" disabled>' + IC.pin + c + '<span class="sm">Coming soon</span></button>'; }).join(""));
            else if (k == "q")
                sgp();
            else {
                const un = NT.filter(function (x) { return !x.r; }).length, ic = { req: IC.usr, msg: IC.chat, match: IS.spk, app: IC.home, ver: IS.ver, safe: IC.sh };
                const itemsHtml = NT.length === 0
                    ? '<div class="plc" style="padding:24px 16px;text-align:center;color:var(--ink2);font-size:13px">No notifications yet</div>'
                    : NT.slice(0, 4).map(function (n) { const k2 = NT.indexOf(n); return '<div class="bpi' + (n.r ? "" : " u") + '" data-nt="' + k2 + '"><span class="ni">' + (ic[n.ty] || IC.usr) + '</span><div><p>' + (n.done ? 'You ' + n.done.toLowerCase() + ' the request' : n.x) + '</p><small>' + esc(n.t) + '</small></div></div>'; }).join("");
                el.innerHTML = sanitizeRenderedHtml('<div class="bph"><b>Notifications</b>' + (un ? '<button data-mar2="1">Mark all read</button>' : '') + '</div>' + itemsHtml + '<button class="bpf" data-n="notifications">See all notifications</button>');
            }
            el.classList.add("o");
        }
        function sgp() {
            let q = ($("q").value || "").trim().toLowerCase(), el = $("ppq"), h = '<button class="pcl" data-pop="">Cancel</button>';
            if (!q) {
                h += '<div class="pph">Popular localities</div><div class="ppc2">' + LOC.map(function (l) { return '<button data-sq="' + l + '">' + l + '</button>'; }).join("") + '</div>' + (RS.length ? '<div class="pph">Recent searches</div>' + RS.map(function (r) { return '<button class="sgr" data-sq="' + esc(r) + '">' + P('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>') + r + '</button>'; }).join("") : '');
            }
            else {
                const m = LOC.filter(function (l) { return l.toLowerCase().indexOf(q) > -1; }).slice(0, 4), t = D.filter(function (d) { return d[1].toLowerCase().indexOf(q) > -1; }).slice(0, 3);
                h += (m.length ? '<div class="pph">Localities</div>' + m.map(function (l) { return '<button class="sgr" data-sq="' + l + '">' + IC.pin + '<div>' + l + '<small>Bengaluru</small></div></button>'; }).join("") : '') + (t.length ? '<div class="pph" style="margin-top:8px">Places</div>' + t.map(function (d) { return '<button class="sgr" data-sq="' + esc(d[1].replace(/&amp;/g, "&")) + '">' + IC.home + '<div>' + esc(d[1]) + '<small>' + esc(d[2]) + '</small></div></button>'; }).join("") : '') || '<div class="pph" style="margin:8px 4px">No suggestions. Press Enter to search anyway.</div>';
            }
            el.innerHTML = sanitizeRenderedHtml(h);
        }
        function sq(v) {
            $("q").value = v; S.q = v; if (S.nav != "saved")
                S.nav = "explore"; if (v && RS.indexOf(v) < 0)
                RS.unshift(v); RS = RS.slice(0, 4); $("sqc").style.display = v ? "grid" : "none"; pop(""); render();
        }
        let GC = ["Living room", "Bedroom", "Kitchen", "Bathroom", "Balcony", "Entrance"], GI = 0;
        function gsh(n, ns) {
            const imgs = (S.nav === 'room' && D[S.room] && D[S.room][13] && D[S.room][13].length > 0)
                ? D[S.room][13]
                : (S.nav === 'pg' && G[S.pg] && G[S.pg][12] && G[S.pg][12].length > 0)
                    ? G[S.pg][12]
                    : [];
            if (!imgs.length)
                return;
            GI = (n + imgs.length) % imgs.length;
            $("gv").innerHTML = sanitizeRenderedHtml('<div class="gvh"><span id="gcn">' + (GI + 1) + ' / ' + imgs.length + '</span><button data-gx="1" aria-label="Close">×</button></div><div class="gm"><button data-gn="-1" aria-label="Previous">‹</button><div class="gsl" id="gsl">' + imgs.map(function (u, i) { return '<div class="ph gs' + (i == GI ? " on" : "") + '"><img src="' + esc(u) + '" alt="" style="width:100%;height:100%;object-fit:contain"></div>'; }).join("") + '</div><button data-gn="1" aria-label="Next">›</button></div><div class="gdt">' + imgs.map(function (_, i) { return '<i class="' + (i == GI ? "on" : "") + '"></i>'; }).join("") + '</div><div class="gt">' + imgs.map(function (u, i) { return '<div class="ph' + (i == GI ? " on" : "") + '" data-gt="' + i + '"><img src="' + esc(u) + '" alt="" style="width:100%;height:100%;object-fit:cover"></div>'; }).join("") + '</div>');
            if (innerWidth <= 900 && !ns) {
                const sl = $("gsl");
                if (sl)
                    sl.scrollLeft = GI * (sl.clientWidth * .88 + 10);
            }
        }
        addDocListener("scroll", function (e) {
            const t = e.target; if (t && t.id == "gsl") {
                const i = Math.max(0, Math.min(GC.length - 1, Math.round(t.scrollLeft / (t.clientWidth * .88 + 10))));
                if (i != GI) {
                    GI = i;
                    $("gcn").textContent = (i + 1) + " / " + GC.length;
                    document.querySelectorAll(".gdt i").forEach(function (d, j) { d.classList.toggle("on", j == i); });
                }
            }
        }, true);
        let RPO = { l: ["Scam or advance payment", "Misleading photos or details", "Already rented", "Offensive content", "Other"], p: ["Fake profile", "Harassment", "Asking for money", "Inappropriate behaviour", "Other"] }, RP = { r: "", d: "", e: "", k: "l" };
        function rpt(k) { RP = { r: "", d: "", e: "", k: k }; rpd(); }
        function rpd() { const k = RP.k; dlg('<h3>Report this ' + (k == "l" ? "listing" : "profile") + '</h3><p>Tell us what is wrong. Our team will review it. The person is not told who reported.</p><div class="pff rpq' + (RP.e ? " e" : "") + '"><label>What is the problem?</label><div class="pfc">' + RPO[k].map(function (x) { return '<button data-rr="' + x + '" aria-pressed="' + (RP.r == x) + '">' + x + '</button>'; }).join("") + '</div><div class="er">' + RP.e + '</div></div><div class="pff"><label>Details (optional)</label><textarea class="tx" id="rpd" placeholder="Anything that helps us understand">' + esc(RP.d) + '</textarea></div><div class="r"><button class="ghb" data-cf="no" style="height:46px">Cancel</button><button class="msgb" data-rsub="1" style="width:auto;padding:0 22px;height:46px"><em>Send report</em></button></div>'); }
        function shd() {
            const isPg = S.nav === 'pg'; const item = isPg ? G[S.pg] : D[S.room]; const id = item && item[isPg ? 11 : 12]; if (!id) {
                toast("This listing is unavailable.");
                return;
            } const u = window.location.origin + "/explore?room=" + encodeURIComponent(id); dlg('<h3>Share this room</h3><p>Send it to a friend or a future roommate.</p><div class="pin" style="margin-bottom:14px"><input id="shl" readonly value="' + u + '"><button data-cp3="1">Copy</button></div><div style="display:flex;gap:10px;flex-wrap:wrap"><a class="ghb" href="https://wa.me/?text=' + encodeURIComponent("Have a look at this room on NestMate: " + u) + '" target="_blank" rel="noopener">WhatsApp</a><a class="ghb" href="mailto:?subject=' + encodeURIComponent("A room on NestMate") + '&body=' + encodeURIComponent(u) + '">Email</a></div><div class="r" style="margin-top:20px"><button class="ghb" data-cf="no" style="height:46px">Done</button></div>');
        }
        addDocListener("click", function (e) {
            const t = e.target;
            if (!t.closest(".pp,[data-pop],#q,[data-sq]"))
                pop("");
            if (t.closest("[data-nt]"))
                setTimeout(function () { pop(""); });
            if (t.closest(".lg,.lgm")) {
                navigate("/");
                return;
            }
            if (t.closest("[data-n=\"signin\"]")) {
                openAuthModal();
                return;
            }
            const b = t.closest("button,a,[data-gt]");
            if (!b)
                return;
            const d = b.dataset;
            if (d.pop !== undefined) {
                const op = (d.pop && $("pp" + d.pop).classList.contains("o"));
                pop(op ? "" : d.pop);
            }
            else if (d.sq !== undefined)
                sq(d.sq);
            else if (d.sqc) {
                sq("");
            }
            else if (d.mar2) {
                if (authUser)
                    markAllNotificationsReadBackend(authUser.uid).then(function () { NT.forEach(function (x) { x.r = 1; }); pop("b"); ub(); }).catch(function () { toast("Could not mark notifications read. Try again."); });
            }
            else if (d.sim !== undefined) {
                S.sim = "";
                if (S.cat == 2)
                    loadRoommatesPage(true);
                else
                    loadPlacesPage(true);
            }
            else if (d.gal) {
                gsh(0);
                $("gv").classList.add("o");
            }
            else if (d.gx)
                $("gv").classList.remove("o");
            else if (d.gn)
                gsh(GI + +d.gn);
            else if (d.gt !== undefined)
                gsh(+d.gt);
            else if (d.shr2)
                shd();
            else if (d.cp3) {
                navigator.clipboard.writeText($("shl").value).then(function () { toast("Link copied"); }).catch(function () { toast("Copy failed. Select the link to copy it manually."); });
            }
            else if (d.rpt)
                rpt(d.rpt);
            else if (d.rr) {
                RP.r = d.rr;
                RP.e = "";
                RP.d = $("rpd") ? $("rpd").value : RP.d;
                rpd();
            }
            else if (d.rsub) {
                RP.d = $("rpd").value;
                if (!RP.r) {
                    RP.e = "Choose what is wrong";
                    rpd();
                }
                else {
                    if (!authUser) {
                        openAuthModal();
                        return;
                    }
                    const target = RP.k == "l" ? (S.nav == "pg" ? G[S.pg] && G[S.pg][11] : D[S.room] && D[S.room][12]) : RM[S.rmi] && RM[S.rmi][9];
                    if (!target) {
                        toast("Unable to identify this item. Please reopen it.");
                        return;
                    }
                    b.disabled = true;
                    submitReportBackend(RP.k == "l" ? "listing" : "user", target, RP.r, RP.d).then(function () { $("cfo").classList.remove("o"); toast("Report sent. Thank you"); }).catch(function (error) { toast(error.message || "Could not send report. Please try again."); }).finally(function () { b.disabled = false; });
                }
            }
        });
        addDocListener("input", function (e) {
            if (e.target.id == "q") {
                $("sqc").style.display = e.target.value ? "grid" : "none";
                if ($("ppq").classList.contains("o"))
                    sgp();
            }
        });
        addDocListener("focusin", function (e) {
            if (e.target.id == "q") {
                document.body.classList.remove("hdn");
                pop("q");
            }
        });
        addDocListener("keydown", function (e) {
            if (e.key == "Escape") {
                pop("");
                $("gv").classList.remove("o");
            } if (e.target.id == "q" && e.key == "Enter") {
                const v = e.target.value.trim();
                if (v && RS.indexOf(v) < 0) {
                    RS.unshift(v);
                    RS = RS.slice(0, 4);
                }
                pop("");
                e.target.blur();
            } if ($("gv").classList.contains("o")) {
                if (e.key == "ArrowRight")
                    gsh(GI + 1);
                if (e.key == "ArrowLeft")
                    gsh(GI - 1);
            }
        });
        const MT = { room: "Room", pg: "PG", roommate: "Profile", compare: "Compare", applicants: "Applicants" };
        function fixHd() {
            const isExplore = (S.nav === "explore");
            const h = document.querySelector(".hd"), v = [$("h1"), $("n"), $("ctl")].some(function (e) { return e.style.display != "none" && (e.id == "ctl" || e.textContent); });
            if (h)
                h.style.display = v ? "flex" : "none";
            document.body.classList.toggle("ns", !isExplore);
            const rootEl = document.querySelector(".nm-explore-root");
            if (rootEl)
                rootEl.classList.toggle("ns", !isExplore);
            const sBox = document.querySelector(".top .search");
            if (sBox)
                sBox.style.display = isExplore ? "" : "none";
            const mtt = $("mtt");
            if (mtt) {
                mtt.style.display = isExplore ? "none" : "block";
                mtt.textContent = MT[S.nav] || ({ listings: "My listings", profile: "Account", me: "Your space", messages: "Messages", connections: "Connections", saved: "Saved places", room: "Room details", pg: "PG details", roommate: "Roommate profile", applicants: "Applicants", compare: "Compare applicants" })[S.nav] || "NestMate";
                mtt.classList.toggle("br", !MT[S.nav]);
            }
            document.body.classList.toggle("chat", S.nav == "messages" && S.cid != null && innerWidth <= 900);
            document.body.classList.remove("hdn");
            $("pgt").textContent = ({ explore: "Explore rooms and roommates", saved: "Saved places", messages: "Messages", notifications: "Notifications", listings: "My listings", connections: "My connections", profile: "Account", me: "Your space", room: "Room details", pg: "PG details", roommate: "Roommate profile", applicants: "Applicants", compare: "Compare applicants" })[S.nav] || "NestMate";
            a11y();
            document.querySelectorAll(".cd h3,.sec h3,.rl h3,.acm h3").forEach(function (h) { h.setAttribute("role", "heading"); h.setAttribute("aria-level", "2"); });
        }
        function a11y() {
            document.querySelectorAll("input:not([type=hidden]):not([aria-label]),textarea:not([aria-label]),select:not([aria-label])").forEach(function (e) {
                if (e.labels && e.labels.length)
                    return; const w = e.closest(".pff,.f,.sec"), l = (e.parentElement && e.parentElement.querySelector("label")) || (w && w.querySelector("label,h3")); if (l)
                    e.setAttribute("aria-label", l.textContent.trim().slice(0, 60));
                else if (e.placeholder)
                    e.setAttribute("aria-label", e.placeholder);
            });
        }
        const _r = render;
        render = function (...args) {
            if (disposed)
                return; _r.apply(this, args); fixHd();
        };
        (function () {
            let ly = 0, tk = false; addWinListener("scroll", function () {
                if (tk)
                    return; tk = true; requestAnimationFrame(function () {
                        const y = scrollY, d = y - ly; if (innerWidth <= 900) {
                            if (y > 90 && d > 6)
                                document.body.classList.add("hdn");
                            else if (d < -6 || y <= 90)
                                document.body.classList.remove("hdn");
                        } const h = document.querySelector(".hd"); if (h)
                            h.classList.toggle("st", y > 140); ly = y; tk = false;
                    });
            }, { passive: true });
        })();
        /* Real applicants loaded dynamically from database */
        window.AN = window.AN || {};
        AF = { st: "New", q: "", ver: 0, fit: 0, soon: 0, sort: "m", n: 12 };
        AS = [];
        APS = {};
        function stg(k, i) { return APS[k + ":" + i] || "New"; }
        function fit(i, l) { return bn(RM[i][4])[1] * 1000 >= l.rent; }
        function soon(i) {
            const value = RM[i] && RM[i][5]; if (value == "Now")
                return true; const timestamp = Date.parse(value || ""); return Number.isFinite(timestamp) && timestamp >= Date.now() && timestamp - Date.now() <= 30 * 86400000;
        }
        function ago(i) {
            const m = window.AN[i]; if (m === undefined)
                return ""; return m < 60 ? m + "m ago" : m < 1440 ? Math.floor(m / 60) + "h ago" : Math.floor(m / 1440) + "d ago";
        }
        function IBS(d) { return P(d); }
        const STAR = P('<path d="M12 3l2.600 5.600 6 .8-4.400 4.200 1.100 6L12 16.800 6.700 19.600l1.100-6L3.400 9.400l6-.8z"/>'), XI = P('<path d="M6 6l12 12M18 6 6 18"/>');
        function apc(k, l, i) {
            const x = RM[i];
            const s = stg(k, i), sel = AS.indexOf(i) > -1, f = fit(i, l);
            const avContent = (x && x[10]) ? '<img src="' + esc(x[10]) + '" alt="' + esc(x[1]) + '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">' : (x ? x[0] : 'AP');
            return '<article class="apc' + (sel ? " sel" : "") + '" data-r="' + i + '"><div class="tp2"><div class="av2">' + avContent + ((x && x[6]) ? '<span class="vb">' + IC.chk + '</span>' : '') + '</div><div class="apb"><b>' + esc(x[1]) + '</b><div class="aps">' + esc(x[2]) + ' · ' + esc(x[3]) + '</div><div class="apt"><span class="' + (f ? "ok" : "no") + '">' + (f ? "Fits budget" : "Above budget") + '</span><span>' + esc(x[4]) + '</span><span>' + (x[5] == "Now" ? "Move in now" : "From " + esc(x[5])) + '</span>' + (s != "New" ? '<span class="st9">' + s + '</span>' : '') + '</div></div><div class="ring" style="--m:' + esc(x[7]) + '"><b>' + esc(x[7]) + '%</b></div></div><div class="apf"><button class="sl2" data-apsel="' + i + '" role="checkbox" aria-checked="' + sel + '"><span class="cb" aria-hidden="true">✓</span>Compare</button><button class="ibt" data-apst="' + i + '" aria-pressed="' + (s == "Shortlisted") + '" aria-label="Shortlist applicant">' + STAR + '</button><button class="ibt" data-app-select="' + i + '" aria-label="Select applicant">' + IC.chk + '</button><button class="ibt dc" data-apdc="' + i + '" aria-label="Decline">' + XI + '</button><button class="ibt" data-msg="m:' + i + '" aria-label="Message">' + IC.chat + '</button></div></article>';
        }
        function apl() {
            const k = S.ck, l = MY[k], f = AF, ids = l.ap.slice(), cn = { New: 0, Shortlisted: 0, Declined: 0 };
            ids.forEach(function (i) { cn[stg(k, i)]++; });
            const L = ids.filter(function (i) { const x = RM[i], s = stg(k, i); return (f.st == "All" || s == f.st) && (!f.q || (x[1] + x[2] + x[3]).toLowerCase().indexOf(f.q.toLowerCase()) > -1) && (!f.ver || x[6]) && (!f.fit || fit(i, l)) && (!f.soon || soon(i)); });
            L.sort(function (a, b) { return f.sort == "n" ? (window.AN[a] ?? Number.POSITIVE_INFINITY) - (window.AN[b] ?? Number.POSITIVE_INFINITY) : f.sort == "b" ? (fit(b, l) - fit(a, l)) || (RM[b][7] - RM[a][7]) : f.sort == "v" ? (RM[b][6] - RM[a][6]) || (RM[b][7] - RM[a][7]) : RM[b][7] - RM[a][7]; });
            let shown = L.slice(0, f.n), h = '<div class="lw" style="max-width:1000px"><button class="ghb back" data-n="listings">← My listings</button><div class="apt2"><div><h1>Applicants</h1><div class="sub4">' + esc(l.t) + ' · ' + fmt(l.rent) + ' / mo</div></div></div>';
            h += '<div class="stt">' + [["New", "New"], ["Shortlisted", "Shortlisted"], ["Declined", "Declined"], ["All", "All"]].map(function (t) { return '<button class="chip" data-aps="' + t[0] + '" aria-pressed="' + (f.st == t[0]) + '">' + t[1] + '<i>' + (t[0] == "All" ? ids.length : cn[t[0]]) + '</i></button>'; }).join("") + '</div>';
            h += '<div class="atb"><div class="lsr">' + P('<circle cx="11" cy="11" r="6.500"/><path d="m16 16 4.500 4.500"/>') + '<input id="apq" placeholder="Search applicants" value="' + esc(f.q) + '" aria-label="Search applicants"></div><select class="pill" id="aps" aria-label="Sort"><option value="m"' + (f.sort == "m" ? " selected" : "") + '>Best match</option><option value="n"' + (f.sort == "n" ? " selected" : "") + '>Newest first</option><option value="b"' + (f.sort == "b" ? " selected" : "") + '>Budget fit</option><option value="v"' + (f.sort == "v" ? " selected" : "") + '>Verified first</option></select></div>';
            h += '<div class="flt">' + [["ver", "Verified only"], ["fit", "Fits my rent"], ["soon", "Moves in within 15 days"]].map(function (t) { return '<button class="chip" data-apf="' + t[0] + '" aria-pressed="' + (f[t[0]] ? "true" : "false") + '">' + t[1] + '</button>'; }).join("") + '</div>';
            if (!L.length)
                h += em("No applicants match", "Try another stage or clear a filter.", '<br><button class="pill" data-apcf="1" style="margin:16px auto 0">Clear filters</button>');
            else
                h += '<div class="ah"><span>Showing ' + shown.length + ' of ' + L.length + '</span><button data-aptop="1">Select top 3 matches</button></div><div class="apg">' + shown.map(function (i) { return apc(k, l, i); }).join("") + '</div>' + (L.length > shown.length ? '<button class="mor" data-apm="1">Show ' + Math.min(12, L.length - shown.length) + ' more</button>' : '');
            if (AS.length)
                h += '<div style="height:96px"></div><div class="cbar"><span class="stk">' + AS.slice(0, 4).map(function (i) { return '<i>' + esc(RM[i][0]) + '</i>'; }).join("") + '</span><div class="tx2"><span class="cn3">' + AS.length + '</span><span class="lb2"> selected</span><small>' + (AS.length < 2 ? "Pick at least 2 to compare" : "Up to 4 at a time") + '</small></div><button class="ghb" data-apcl="1">Clear</button><button class="ghb" disabled title="Applicant tracking is not available yet">Shortlist unavailable</button><button class="msgb" data-apcmp="1"' + (AS.length < 2 ? " disabled" : "") + '><em>Compare</em></button></div>';
            return h + '</div>';
        }
        function mc() {
            const k = S.ck, l = MY[k], a = AS.slice(0, 4), sl = l.st == "Filled";
            if (a.length < 2)
                return '<div class="lw"><button class="ghb back" data-n="applicants">← Applicants</button>' + em("Pick people to compare", "Choose 2 to 4 applicants from the list, then tap Compare.", '<br><button class="post" data-n="applicants" style="display:inline-block">Back to applicants</button>') + '</div>';
            const best = Math.max.apply(null, a.map(function (i) { return RM[i][7]; })), qs = (l.f.screeningQuestions || l.f.qs || []).slice(0, 3), rows = [["Match", function (i) { const m = RM[i][7]; return [m + "%", m == best ? "best" : ""]; }], ["Budget", function (i) { const ok = fit(i, l); return [RM[i][4] + (ok ? " ✓" : " · below rent"), ok ? "g" : "w2"]; }], ["Move-in", function (i) { return [RM[i][5] == "Now" ? "Now" : "From " + RM[i][5], ""]; }], ["ID", function (i) { return [RM[i][6] ? "Verified ✓" : "Not verified", RM[i][6] ? "g" : "w2"]; }], ["Work", function (i) { return [RM[i][2], ""]; }], ["Smoking", function (i) { return [RX[i][1], ""]; }], ["Diet", function (i) { return [RX[i][0], ""]; }], ["Sleep", function (i) { return [RX[i][2], ""]; }], ["Guests", function (i) { return [RX[i][3], ""]; }], ["Cleanliness", function (i) { return [RX[i][4], ""]; }]];
            qs.forEach(function (q, qi) { rows.push([q, function (i) { return [(APPLICATION_ANS[k + ":" + i] || {})[q] || "Not provided", ""]; }]); });
            let df = S.diff, vis = rows.filter(function (r) {
                if (!df)
                    return true; const v = a.map(function (i) { return r[1](i)[0]; }); return v.filter(function (x, j) { return v.indexOf(x) == j; }).length > 1;
            }), h = '<div class="lw"><button class="ghb back" data-n="applicants">← Applicants</button><div class="lh"><div><h1>Compare</h1><div class="loc" style="margin-top:4px">' + esc(l.t) + ' · ' + fmt(l.rent) + ' / mo</div></div></div>' + (sl ? '<div class="sel"><b>' + (RM[l.sel] ? esc(RM[l.sel][1]) : "Occupancy not recorded") + '</b> is selected for this room.</div>' : '') + '<button class="dfr" data-diff="1" role="switch" aria-checked="' + (df ? "true" : "false") + '"><span class="sw" aria-hidden="true" style="pointer-events:none" ' + 'aria-checked="' + (df ? "true" : "false") + '"></span>Show only differences</button><div class="cpw"><div class="cpg" style="grid-template-columns:120px repeat(' + a.length + ',minmax(176px,1fr))"><div class="lab"></div>' + a.map(function (i) { const x = RM[i]; return '<div class="hc"><button class="xh" data-cmx="' + i + '" aria-label="Remove from comparison">×</button><div class="av2">' + ((x && x[10]) ? '<img src="' + esc(x[10]) + '" alt="' + esc(x[1]) + '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">' : (x ? esc(x[0]) : 'RM')) + (x[6] ? '<span class="vb">' + IC.chk + '</span>' : '') + '</div>' + (x[7] == best ? '<span class="bm">Best match</span>' : '') + '<b data-r="' + i + '">' + esc(x[1]) + '</b><small>' + esc(x[3]) + '</small></div>'; }).join("");
            vis.forEach(function (r) { h += '<div class="lab" style="' + (r[0].length > 14 ? "font-size:13px;line-height:1.3" : "") + '">' + esc(r[0]) + '</div>' + a.map(function (i) { const v = r[1](i); return '<div class="' + v[1] + '">' + esc(v[0]).replace(/&amp;(?=[a-z#]+;)/g, "&") + '</div>'; }).join(""); });
            if (!vis.length)
                h += '<div class="lab"></div><div style="grid-column:2/-1;color:var(--ink2)">These people are identical on every row.</div>';
            h += '<div class="lab ac"></div>' + a.map(function (i) { return '<div class="ac"><button class="msgb" data-msg="m:' + i + '">' + IC.chat + '<em>Message</em></button><button class="ghb" data-apst="' + i + '">' + (stg(k, i) == "Shortlisted" ? "Shortlisted ✓" : "Shortlist") + '</button>' + (sl ? '' : '<button class="ghb" data-app-select="' + i + '">Select applicant</button>') + '</div>'; }).join("") + '</div></div></div>';
            return h;
        }
        function mlf() {
            const C = ["All", "Active", "Paused", "Draft", "Filled"], q = (S.lq || "").toLowerCase(), cn = function (c) { return c == "All" ? MY.length : MY.filter(function (x) { return x.st == c; }).length; }, ncount = function (k) { return MY[k].ap.filter(function (i) { return stg(k, i) == "New"; }).length; }, totNew = MY.reduce(function (a, x, k) { return a + ncount(k); }, 0), totSl = MY.reduce(function (a, x, k) { return a + x.ap.filter(function (i) { return stg(k, i) == "Shortlisted"; }).length; }, 0), L = MY.map(function (x, k) { return [x, k]; }).filter(function (a) { return (S.lt == 0 || a[0].st == C[S.lt]) && (!q || (a[0].t + a[0].loc).toLowerCase().indexOf(q) > -1); });
            let h = '<div class="lw">';
            if (!MY.length)
                return h + em("You have not posted a room", "Post a room and matching people can message you.") + '</div>';
            const hasPendingListings = MY.some(function (x) { return x && (x.st === "Pending verification" || x.st === "pending_verification"); });
            const isUserVerified = (ME && (ME.ver || (USER_KYC && USER_KYC.status === 'approved')));
            const isKycPending = (USER_KYC && USER_KYC.status === 'pending');
            const isKycRejected = (USER_KYC && (USER_KYC.status === 'rejected' || USER_KYC.status === 'resubmission_required'));
            const rejReason = (USER_KYC && USER_KYC.doc && (USER_KYC.doc.reviewNote || USER_KYC.doc.rejectionReason)) || '';
            if (hasPendingListings) {
                if (!isUserVerified && !isKycPending && !isKycRejected) {
                    h += '<div class="ver-banner" style="background:#fff4e5;border:1px solid #ffd8a8;border-radius:14px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;box-shadow:0 2px 8px rgba(0,0,0,0.03)">' +
                        '<div style="display:flex;gap:14px;align-items:center">' +
                        '<span style="display:flex;width:40px;height:40px;border-radius:50%;background:#ffe8cc;align-items:center;justify-content:center;color:#e8590c;flex-shrink:0">' +
                        '<svg style="width:22px;height:22px;fill:currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>' +
                        '</span><div>' +
                        '<b style="font-size:14.5px;color:#d9480f;display:block">Verification required to publish your rooms</b>' +
                        '<span style="font-size:13px;color:#495057">Your room listing cannot appear in discovery until your identity is verified.</span>' +
                        '</div></div>' +
                        '<button class="msgb" data-n="profile" data-as="verify" style="height:38px;padding:0 20px;font-size:13px;width:auto"><em>Verify now</em></button>' +
                        '</div>';
                } else if (isKycPending) {
                    h += '<div class="ver-banner" style="background:#e7f5ff;border:1px solid #a5d8ff;border-radius:14px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:14px;box-shadow:0 2px 8px rgba(0,0,0,0.03)">' +
                        '<span style="display:flex;width:40px;height:40px;border-radius:50%;background:#d0ebff;align-items:center;justify-content:center;color:#1971c2;flex-shrink:0">' +
                        '<svg style="width:22px;height:22px;fill:currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>' +
                        '</span><div>' +
                        '<b style="font-size:14.5px;color:#1864ab;display:block">Verification under review</b>' +
                        '<span style="font-size:13px;color:#495057">Your identity documents are being reviewed. Your listing will be activated once verified.</span>' +
                        '</div></div>';
                } else if (isKycRejected) {
                    h += '<div class="ver-banner" style="background:#fde8e8;border:1px solid #f8b4b4;border-radius:14px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;box-shadow:0 2px 8px rgba(0,0,0,0.03)">' +
                        '<div style="display:flex;gap:14px;align-items:center">' +
                        '<span style="display:flex;width:40px;height:40px;border-radius:50%;background:#fbd5d5;align-items:center;justify-content:center;color:#e02424;flex-shrink:0">✕</span>' +
                        '<div>' +
                        '<b style="font-size:14.5px;color:#c81e1e;display:block">Verification needs attention</b>' +
                        '<span style="font-size:13px;color:#495057">' + (rejReason ? 'Reason: ' + esc(rejReason) : 'Your previous document could not be verified.') + ' Re-submit to publish your room listing.</span>' +
                        '</div></div>' +
                        '<button class="msgb" data-n="profile" data-as="verify" style="height:38px;padding:0 20px;font-size:13px;width:auto;background:#e02424"><em>Re-verify now</em></button>' +
                        '</div>';
                }
            }
            h += '<div class="lsum"><div><b>' + cn("Active") + '</b><span>Active listings</span></div><div><b>' + totNew + '</b><span>New applicants</span></div><div><b>' + totSl + '</b><span>Shortlisted</span></div></div><div class="lsr">' + P('<circle cx="11" cy="11" r="6.500"/><path d="m16 16 4.500 4.500"/>') + '<input id="lq" placeholder="Search your listings" value="' + esc(S.lq || "") + '" aria-label="Search listings"></div><div class="lcs">' + C.map(function (c, i) { return '<button class="chip" data-lt="' + i + '" aria-pressed="' + (S.lt == i) + '">' + c + '<i>' + cn(c) + '</i></button>'; }).join("") + '</div>';
            if (!L.length)
                h += em("Nothing here", "No listings match your search or filter.");
            L.forEach(function (a) {
                const x = a[0], k = a[1], n = x.ap.length, nw = ncount(k);
                let pri = '';
                if (x.st == "Draft") {
                    pri = '<button class="msgb" data-la="edit" data-q="' + k + '"><em>Continue editing</em></button>';
                } else if (x.st == "Pending verification") {
                    if (!isUserVerified && !isKycPending) {
                        pri = '<button class="msgb" data-n="profile" data-as="verify" style="height:38px;padding:0 16px;font-size:13px;width:auto"><em>Verify now</em></button>';
                    } else if (isKycPending) {
                        pri = '<span style="display:inline-flex;align-items:center;padding:6px 12px;border-radius:8px;background:#e7f5ff;color:#1864ab;font-size:12.5px;font-weight:600">Verification in review</span>';
                    } else if (isKycRejected) {
                        pri = '<button class="msgb" data-n="profile" data-as="verify" style="height:38px;padding:0 16px;font-size:13px;width:auto;background:#e02424"><em>Re-verify now</em></button>';
                    }
                } else if (x.st != "Filled" && n > 0) {
                    pri = '<button class="msgb" data-la="apl" data-q="' + k + '"><em>View applicants (' + n + ')</em></button>';
                }
                h += '<article class="lc"><div class="ph">' + ((x.photo || (x.f && x.f.images && x.f.images[0])) ? '<img src="' + esc(x.photo || x.f.images[0]) + '" alt="" style="width:100%;height:100%;object-fit:cover">' : '') + '<span class="stp st-' + esc(x.st) + '">' + esc(x.st) + '</span></div><div class="lb"><div class="lt"><b>' + esc(x.t) + '</b></div><div class="loc">' + IC.pin + esc(x.loc) + ' · ' + (x.rent ? fmt(x.rent) + " / mo" : "Rent not set") + '</div><div class="lap">' + (x.st == "Draft" ? 'Listing strength ' + esc(x.pct) + '%' : x.st == "Filled" ? 'Roommate: <b style="color:var(--ink)">' + (RM[x.sel] ? esc(RM[x.sel][1]) : "Occupancy not recorded") + '</b>' : n ? '<span class="stk">' + x.ap.slice(0, 3).map(function (i) { return '<i>' + esc(RM[i][0]) + '</i>'; }).join("") + '</span>' + n + ' applicant' + (n > 1 ? "s" : "") + (nw ? '<span class="nw2">' + nw + ' new</span>' : '') : 'No applicants yet') + '</div><div class="lac">' + pri + '<button class="ghb" data-la="edit" data-q="' + k + '">Edit</button>' + (x.st == "Active" || x.st == "Paused" ? '<button class="ghb" data-la="pz" data-q="' + k + '">' + (x.st == "Active" ? "Pause" : "Resume") + '</button>' : '') + '<button class="dl" data-la="del" data-q="' + k + '" aria-label="Delete listing"><svg class="i" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button></div></div></article>';
            });
            return h + '</div>';
        }
        (ADM = { users: [], listings: [], reports: [], verifications: [], loaded: false, tab: 0, loading: false });
        function loadAdminData() {
            if (ADM.loading)
                return;
            ADM.loading = true;
            fetchAdminDataBackend().then(function (res) {
                ADM.users = (res && res.users) || [];
                ADM.listings = (res && res.listings) || [];
                ADM.reports = (res && res.reports) || [];
                ADM.verifications = (res && res.verifications) || [];
                ADM.loaded = true;
                ADM.loading = false;
                if (S.nav === 'admin')
                    render();
            }).catch(function (e) {
                console.warn(e);
                ADM.loading = false;
            });
        }
        function adp() {
            if (!ADM.loaded && !ADM.loading) {
                loadAdminData();
            }
            const users = ADM.users || [];
            const listings = ADM.listings || [];
            const reports = ADM.reports || [];
            const verifications = ADM.verifications || [];
            const pendingKyc = verifications.filter(function (v) { return v.status === 'pending'; }).length;
            const verifiedUsers = users.filter(function (u) { return u.isVerified; }).length;
            const verifiedListings = listings.filter(function (l) { return l.ownerVerified || l.isOwnerVerified; }).length;
            let h = '<div class="lw"><div class="lh"><h1>Admin &amp; Moderation Portal</h1><button class="ghb" data-ada="refresh" style="display:inline-flex;align-items:center;gap:6px">' + P('<path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.8 1 6.4 2.6L21 8M21 3v5h-5"/>') + ' Refresh</button></div>';
            h += '<div class="lsum">' +
                '<div><b>' + listings.length + '</b><span>Total listings</span></div>' +
                '<div><b>' + users.length + '</b><span>Registered users</span></div>' +
                '<div><b>' + reports.length + '</b><span>Open reports</span></div>' +
                '<div><b>' + pendingKyc + '</b><span>Pending KYC</span></div>' +
                '</div>';
            const tabs = ["Listings (" + listings.length + ")", "Users (" + users.length + ")", "Reports (" + reports.length + ")", "KYC Requests (" + verifications.length + ")"];
            h += '<div class="lcs" style="margin-bottom:20px">' + tabs.map(function (t, i) {
                return '<button class="chip" data-adtab="' + i + '" aria-pressed="' + (ADM.tab == i) + '">' + esc(t) + '</button>';
            }).join('') + '</div>';
            if (ADM.loading) {
                return h + '<div style="padding:40px;text-align:center;color:var(--ink2)">Loading moderation queues from Firestore...</div></div>';
            }
            if (ADM.tab == 0) {
                if (!listings.length) {
                    h += em("No listings", "There are currently no listings in the database.");
                }
                else {
                    listings.forEach(function (l) {
                        const isVer = !!(l.ownerVerified || l.isOwnerVerified);
                        const isAct = (l.status || 'active') === 'active';
                        const photoUrl = (Array.isArray(l.images) && l.images[0]) || '';
                        const photoHtml = photoUrl ? '<img src="' + esc(photoUrl) + '" alt="" style="width:100%;height:100%;object-fit:cover">' : '';
                        h += '<article class="lc"><div class="ph">' + photoHtml + '<span class="stp st-' + (isAct ? 'Active' : 'Paused') + '">' + (isAct ? 'Active' : 'Paused') + '</span></div>' +
                            '<div class="lb"><div class="lt"><b>' + esc(l.title || 'Untitled Space') + '</b>' + (isVer ? ' <span style="color:var(--ok);font-size:13px;font-weight:700">✓ Verified</span>' : '') + '</div>' +
                            '<div class="loc">' + IC.pin + esc(l.locality || l.city || 'Bengaluru') + ' · ' + (l.monthlyRent || l.totalRent ? fmt(l.monthlyRent || l.totalRent) + ' / mo' : 'Rent not set') + '</div>' +
                            '<div class="lap">Host: <b style="color:var(--ink)">' + esc(l.ownerName || l.ownerId || 'Unknown') + '</b></div>' +
                            '<div class="lac">' +
                            '<button class="msgb" data-adact="ver-list" data-id="' + esc(l.id) + '" data-val="' + (!isVer) + '"><em>' + (isVer ? 'Revoke verification' : 'Verify listing') + '</em></button>' +
                            '<button class="ghb" data-adact="status-list" data-id="' + esc(l.id) + '" data-val="' + (isAct ? 'paused' : 'active') + '">' + (isAct ? 'Pause' : 'Activate') + '</button>' +
                            '<button class="dl" data-adact="del-list" data-id="' + esc(l.id) + '" aria-label="Delete listing"><svg class="i" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>' +
                            '</div></div></article>';
                    });
                }
            }
            else if (ADM.tab == 1) {
                if (!users.length) {
                    h += em("No users", "There are currently no registered users in the database.");
                }
                else {
                    users.forEach(function (u) {
                        const isVer = !!u.isVerified;
                        const isSusp = u.status === 'suspended';
                        const av = u.avatar ? '<img src="' + esc(u.avatar) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">' : (u.name ? u.name[0].toUpperCase() : 'U');
                        h += '<article class="lc"><div class="av2" style="margin:16px 0 0 16px;width:64px;height:64px;border-radius:18px;font-size:22px">' + av + (isVer ? '<span class="vb">' + IC.chk + '</span>' : '') + '</div>' +
                            '<div class="lb"><div class="lt"><b>' + esc(u.name || u.email || 'Member') + '</b>' + (isVer ? ' <span style="color:var(--ok);font-size:13px;font-weight:700">✓ ID Verified</span>' : '') + '</div>' +
                            '<div class="loc">' + esc(u.email || u.phone || 'No contact') + ' · ' + esc(u.city || u.locality || 'India') + '</div>' +
                            '<div class="lap">Role: <b>' + esc(u.role || 'Member') + '</b> · Status: <b style="color:' + (isSusp ? 'red' : 'inherit') + '">' + (isSusp ? 'Suspended' : 'Active') + '</b></div>' +
                            '<div class="lac">' +
                            '<button class="msgb" data-adact="ver-user" data-uid="' + esc(u.uid) + '" data-val="' + (!isVer) + '"><em>' + (isVer ? 'Revoke KYC' : 'Verify Gov ID') + '</em></button>' +
                            '<button class="ghb" data-adact="status-user" data-uid="' + esc(u.uid) + '" data-val="' + (isSusp ? 'active' : 'suspended') + '">' + (isSusp ? 'Reactivate' : 'Suspend account') + '</button>' +
                            '</div></div></article>';
                    });
                }
            }
            else if (ADM.tab == 2) {
                if (!reports.length) {
                    h += em("No pending reports", "Everything is clear! No active flags or user reports.");
                }
                else {
                    reports.forEach(function (r) {
                        const isRes = (r.status === 'dismissed' || r.status === 'resolved' || r.status === 'actioned');
                        h += '<article class="lc"><div class="lb" style="padding-left:18px">' +
                            '<div class="lt"><b style="color:var(--brand)">Report #' + r.id.slice(0, 8) + '</b> · Target: <b>' + esc(r.targetType || 'Item') + ' (' + esc(r.targetId || '') + ')</b>' + (isRes ? ' <span style="color:var(--ok);font-size:13px;font-weight:700">✓ Resolved (' + esc(r.status) + ')</span>' : '') + '</div>' +
                            '<div class="loc" style="margin:4px 0">Reason: <b>' + esc(r.reason || 'General concern') + '</b></div>' +
                            '<div class="lap">' + esc(r.details || 'No additional details provided.') + '</div>' +
                            (!isRes ? '<div class="lac" style="margin-top:10px">' +
                                '<button class="ghb" data-adact="res-rep" data-id="' + esc(r.id) + '" data-val="dismissed">Dismiss report</button>' +
                                '<button class="msgb" data-adact="res-rep" data-id="' + esc(r.id) + '" data-val="actioned"><em>Take down content</em></button>' +
                                '</div>' : '') +
                            '</div></article>';
                    });
                }
            }
            else if (ADM.tab == 3) {
                if (!verifications.length) {
                    h += em("No KYC requests", "No users have submitted documents for verification yet.");
                }
                else {
                    verifications.forEach(function (v) {
                        const isAppr = v.status === 'approved';
                        const isRej = v.status === 'rejected';
                        const isPend = v.status === 'pending';
                        const stClass = isAppr ? 'Active' : isRej ? 'Paused' : 'Draft';
                        const stLabel = isAppr ? 'Approved' : isRej ? 'Rejected' : 'Pending Review';
                        const docUrl = v.documentPath || '';
                        const dateStr = v.createdAt ? (typeof v.createdAt.toDate === 'function' ? v.createdAt.toDate().toLocaleDateString('en-IN') : String(v.createdAt).slice(0, 10)) : 'Recent';
                        h += '<article class="lc"><div class="lb" style="padding-left:18px">' +
                            '<div class="lt"><b>' + esc(v.declaredName || v.userName || 'Applicant') + '</b> <span class="stp st-' + stClass + '" style="position:static;display:inline-block;margin-left:8px">' + stLabel + '</span></div>' +
                            '<div class="loc" style="margin:4px 0">Document: <b>' + esc(v.documentType || 'ID Document') + '</b> · Submitted: ' + dateStr + '</div>' +
                            '<div class="lap">User ID: <code>' + esc(v.userId || v.id) + '</code>' + (v.rejectionReason ? ' · <span style="color:var(--err)">Reason: ' + esc(v.rejectionReason) + '</span>' : '') + '</div>' +
                            '<div class="lac" style="margin-top:10px">' +
                            (docUrl ? '<button class="ghb" data-adkyc="view" data-url="' + esc(docUrl) + '" data-name="' + esc(v.declaredName || v.userName || 'Document') + '">View Document</button>' : '') +
                            (isPend ? '<button class="msgb" data-adkyc="approve" data-document-path="' + esc(v.documentPath || '') + '" data-uid="' + esc(v.userId || v.id) + '"><em>Approve KYC</em></button>' : '') +
                            (isPend ? '<button class="ghb" style="color:var(--err)" data-adkyc="reject" data-document-path="' + esc(v.documentPath || '') + '" data-uid="' + esc(v.userId || v.id) + '">Reject KYC</button>' : '') +
                            '</div>' +
                            '</div></article>';
                    });
                }
            }
            return h + '</div>';
        }
        function ml() { return mlf(); }
        addDocListener("click", function (e) {
            const b = e.target.closest("button");
            if (!b)
                return;
            const d = b.dataset, k = S.ck;
            if (d.aps) {
                AF.st = d.aps;
                AF.n = 12;
                render();
            }
            else if (d.apf) {
                AF[d.apf] ^= 1;
                AF.n = 12;
                render();
            }
            else if (d.apm) {
                AF.n += 12;
                render();
            }
            else if (d.apcf) {
                AF.q = "";
                AF.ver = 0;
                AF.fit = 0;
                AF.soon = 0;
                AF.st = "All";
                render();
            }
            else if (d.apsel) {
                const i = +d.apsel, p = AS.indexOf(i);
                if (p > -1)
                    AS.splice(p, 1);
                else if (AS.length >= 4)
                    toast("You can compare up to 4 people");
                else
                    AS.push(i);
                const y = scrollY;
                render();
                scrollTo(0, y);
            }
            else if (d.apst !== undefined || d.apdc !== undefined || d.appSelect !== undefined) {
                const idx = +(d.apst !== undefined ? d.apst : d.apdc !== undefined ? d.apdc : d.appSelect);
                const appId = window.APC_MAP[k + ":" + idx];
                if (!appId) {
                    toast("This legacy application needs compatibility review; no connection was changed.");
                    return;
                }
                b.disabled = true;
                const next = d.apdc !== undefined ? "rejected" : d.appSelect !== undefined ? "selected" : "shortlisted";
                updateApplicationStatusBackend(appId, next).then(function () { toast("Application updated: " + (next === "selected" ? "Selected" : next === "shortlisted" ? "Shortlisted" : "Declined")); }).catch(function (error) { toast(error.message || "Could not update application"); }).finally(function () { b.disabled = false; });
            }
            else if (d.apmsg) {
                S.nav = "messages";
                S.cid = 0;
                render();
                toast("Chat opens with " + RM[+d.apmsg][1].split(" ")[0]);
            }
            else if (d.apcl) {
                AS = [];
                render();
            }
            else if (d.apsl) {
                toast("Applicant tracking is not available yet. No connection was changed.");
            }
            else if (d.apcmp) {
                S.nav = "compare";
                render();
                scrollTo(0, 0);
            }
            else if (d.aptop) {
                const l = MY[k], ids = l.ap.filter(function (i) { const x = RM[i], s = stg(k, i); return (AF.st == "All" || s == AF.st) && (!AF.q || (x[1] + x[2] + x[3]).toLowerCase().indexOf(AF.q.toLowerCase()) > -1) && (!AF.ver || x[6]) && (!AF.fit || fit(i, l)) && (!AF.soon || soon(i)); }).sort(function (a, b) { return RM[b][7] - RM[a][7]; }).slice(0, 3);
                AS = ids;
                render();
            }
            else if (d.cmx) {
                const i4 = +d.cmx;
                AS = AS.filter(function (x) { return x != i4; });
                render();
            }
            else if (d.diff) {
                S.diff = !S.diff;
                render();
            }
            else if (d.lt !== undefined) {
                S.lt = +d.lt;
            }
        });
        addDocListener("input", function (e) {
            const t = e.target; if (t.id == "apq") {
                AF.q = t.value;
                AF.n = 12;
                const p = t.selectionStart;
                render();
                const n = $("apq");
                n.focus();
                n.setSelectionRange(p, p);
            }
            else if (t.id == "lq") {
                S.lq = t.value;
                const p2 = t.selectionStart;
                render();
                const n2 = $("lq");
                n2.focus();
                n2.setSelectionRange(p2, p2);
            }
        });
        addDocListener("change", function (e) {
            if (e.target.id == "aps") {
                AF.sort = e.target.value;
                render();
            }
        });
        const mob = new MutationObserver(function () { document.documentElement.classList.toggle("lock", !!document.querySelector(".ov.o,.pf.o,.gv.o,.pp.o")); });
        mob.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
        cleanupFns.push(function () { mob.disconnect(); });
        /* ===== completeness: chat open, connect, block, email/phone, PG detail ===== */
        function sentL() { return Object.keys(CN).filter(function (k) { return CN[k]; }).map(Number); }
        async function openChat(kind, i) {
            if (!authUser) {
                openAuthModal();
                return;
            }
            const targetUid = kind == "m" ? RM[i] && RM[i][9] : kind == "r" ? D[i] && D[i][20] : G[i] && G[i][17];
            const listingId = kind == "r" ? D[i] && D[i][12] : kind == "p" ? G[i] && G[i][11] : undefined;
            if (!targetUid) {
                toast("This listing has no contact available.");
                return;
            }
            try {
                const chatId = await getOrCreateChatRoomBackend(targetUid, listingId);
                let k = CH.findIndex(function (c) { return c.id === chatId; });
                if (k < 0) {
                    CH.unshift({ id: chatId, p: targetUid, ctx: listingId ? [kind == "p" ? "pg" : "room", i] : ["mate"], un: 0, m: [], otherName: kind == "m" ? RM[i][1] : "Poster", authorized: true });
                    k = 0;
                }
                S.back = S.nav;
                S.nav = "messages";
                S.cid = k;
                render();
                scrollTo(0, 0);
            }
            catch (error) {
                if (listingId && String(error.message).includes("Request communication consent")) {
                    try {
                        await sendConnectionRequestBackend(targetUid, listingId);
                        toast("Listing communication request sent. The poster must accept before chat opens.");
                    }
                    catch (requestError) {
                        toast(requestError.message);
                    }
                }
                else
                    toast(error.message || "Communication unavailable.");
            }
        }
        function rdg(i) {
            let g;
            const x = G[i];
            if (!x)
                return em("PG not found", "This PG listing is no longer available.");
            const ot = [];
            for (let k = 0; k < G.length; k++) {
                if (k !== i && G[k]) {
                    ot.push(k);
                    if (ot.length >= 3)
                        break;
                }
            }
            const managerName = x[13] || (x.raw && x.raw.ownerName) || "PG Manager";
            const managerAv = x[14] || (x.raw && x.raw.ownerAvatar) || "";
            const f = managerName.split(" ")[0];
            const opts = (x[15] && x[15].length) ? x[15] : [[x[3] || "Standard sharing", x[2], 1]];
            const am = (x[16] && x[16].length) ? x[16] : (x[4] ? [x[4]] : []);
            const rules = (x.raw && Array.isArray(x.raw.houseRules) && x.raw.houseRules.length) ? x.raw.houseRules : [];
            const rulesSection = rules.length ? ('<section><h3>House rules</h3><div class="inc">' + rules.map(function (r) { return '<div><i>' + IC.chk + '</i>' + esc(r) + '</div>'; }).join("") + '</div></section>') : '';
            const simSection = ot.length ? ('<section><h3>Similar places</h3><div class="sim">' + ot.map(function (k) {
                const y = G[k];
                const pgSimImg = (y[12] && y[12][0]) ? '<img src="' + esc(y[12][0]) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover">' : '';
                return '<div data-g="' + k + '"><div class="ph">' + pgSimImg + '</div><b>' + esc(y[0]) + '</b><small>' + esc(y[1]) + ' · ' + fmt(y[2]) + ' / bed</small></div>';
            }).join("") + '</div></section>') : '';
            const st = '<button class="ib sv" data-id="p' + i + '" aria-pressed="' + (isPgSaved(x, i) ? "true" : "false") + '" aria-label="Save">' + IC.heart + '</button>';
            const imgs = (x[12] && x[12].length > 0) ? x[12].filter(Boolean) : [];
            let galHtml = '';
            if (imgs.length === 0) {
                galHtml = '<div class="gal" style="display:flex;align-items:center;justify-content:center;background:var(--bs);height:320px;border-radius:18px;color:var(--brand)"><svg viewBox="0 0 24 24" style="width:48px;height:48px;stroke:currentColor;fill:none;stroke-width:1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>';
            }
            else if (imgs.length === 1) {
                galHtml = '<div class="gal" style="display:block;height:360px;position:relative;border-radius:18px;overflow:hidden"><div class="ph" data-gal="1" style="height:100%"><img src="' + esc(imgs[0]) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover"></div><button class="ghb ga" data-gal="1" style="position:absolute;bottom:16px;right:16px">Show photo (1)</button></div>';
            }
            else if (imgs.length === 2) {
                galHtml = '<div class="gal" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;height:360px;border-radius:18px;overflow:hidden">';
                for (g = 0; g < 2; g++) {
                    galHtml += '<div class="ph" data-gal="1"><img src="' + esc(imgs[g]) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover"></div>';
                }
                galHtml += '<button class="ghb ga" data-gal="1">Show all photos (2)</button></div>';
            }
            else if (imgs.length === 3) {
                galHtml = '<div class="gal" style="display:grid;grid-template-columns:1.4fr 1fr;grid-template-rows:1fr 1fr;gap:8px;height:360px;border-radius:18px;overflow:hidden">';
                galHtml += '<div class="ph" data-gal="1" style="grid-row:span 2"><img src="' + esc(imgs[0]) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover"></div>';
                galHtml += '<div class="ph" data-gal="1"><img src="' + esc(imgs[1]) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover"></div>';
                galHtml += '<div class="ph" data-gal="1"><img src="' + esc(imgs[2]) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover"></div>';
                galHtml += '<button class="ghb ga" data-gal="1">Show all photos (3)</button></div>';
            }
            else {
                const count = Math.min(5, imgs.length);
                galHtml = '<div class="gal">';
                for (g = 0; g < count; g++) {
                    galHtml += '<div class="ph" data-gal="1"><img src="' + esc(imgs[g]) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover"></div>';
                }
                galHtml += '<button class="ghb ga" data-gal="1">Show all photos (' + imgs.length + ')</button></div>';
            }
            const mgrAvContent = managerAv
                ? '<img src="' + esc(managerAv) + '" alt="' + esc(managerName) + '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">'
                : (managerName.split(' ').map(function (w) { return w[0]; }).join('') || 'PG');
            return '<div class="rd"><button class="ghb back" data-n="' + (S.back || "explore") + '">← Back</button>' + galHtml + '<div class="rl"><div class="mn">' +
                '<section><div class="tgs"><span>' + esc(x[10]) + '</span>' + (x[8] ? '<span class="ok">✓ Verified</span>' : '') + '<span>' + esc(x[5]) + '</span></div><h2>' + esc(x[0]) + '</h2><div class="tl"><div class="loc">' + IC.pin + esc(x[1]) + ', Bengaluru</div><span class="sp2"></span><button class="ghb" data-shr2="1">Share</button>' + st + '<button class="ghb" data-rpt="l">Report</button></div></section>' +
                '<section><div class="kf"><div><small>From</small><b>' + fmt(x[2]) + '</b><span>per bed / month</span></div><div><small>Deposit</small><b>' + fmt(x[6]) + '</b><span>refundable</span></div><div><small>Available</small><b>' + (x[7] == "Available now" ? "Now" : x[7].replace("From ", "")) + '</b><span>move-in</span></div><div><small>For</small><b>' + esc(x[5]) + '</b><span>residents</span></div></div></section>' +
                '<section><h3>Room options</h3><table class="rtb"><thead><tr><th>Type</th><th>Per bed</th><th>Beds left</th></tr></thead><tbody>' + opts.map(function (o) { return '<tr><td><b>' + o[0] + '</b></td><td>' + fmt(o[1]) + '</td><td><span class="bds' + (o[2] < 2 ? " lo" : "") + '">' + o[2] + ' left</span></td></tr>'; }).join("") + '</tbody></table></section>' +
                '<section><h3>Food and amenities</h3><div class="inc"><div><i>' + IC.chk + '</i>' + esc(x[4]) + '</div>' + am.map(function (a) { return '<div><i>' + IC.chk + '</i>' + a + '</div>'; }).join("") + '</div></section>' +
                rulesSection +
                '<section><div class="safe">' + IC.sh + '<div><b>Stay safe</b><br>Visit before you pay and read the agreement. <a href="#">Read the Trust center</a></div></div></section>' +
                simSection + '</div>' +
                '<aside class="ra"><div class="rc2"><div class="rp"><b>' + fmt(x[2]) + '</b><span> / bed</span></div><div class="sm">Deposit ' + fmt(x[6]) + ' · ' + esc(x[7]) + '</div>' + listingCommunicationButtons('p', i, true) + '<button class="ghb" data-save="p' + i + '">' + (isPgSaved(x, i) ? "Saved ✓" : "Save for later") + '</button><div class="who"><div class="av2">' + mgrAvContent + '</div><div>' + managerName + (x[8] ? ' <span style="color:var(--ok)">✓</span>' : '') + '<small>Manages this place</small></div></div></div></aside></div><div class="rbar"><div><b>' + fmt(x[2]) + '</b><span> / bed</span></div><button class="msgb" data-msg="p:' + i + '"><em>Message ' + esc(f) + '</em></button></div></div>';
        }
        function sheetRows(rows) { dlg('<div style="padding-top:4px">' + rows.join("") + '</div><div class="r" style="margin-top:8px"><button class="ghb" data-cf="no" style="height:46px">Cancel</button></div>'); }
        function emd(er) { dlg('<h3>Change email</h3><p>We will send a confirmation link to the new address.</p><div class="pff' + (er && er.e ? " e" : "") + '"><label>New email</label><div class="pin"><input id="nem" type="email" placeholder="you@example.com" autocomplete="email"></div><div class="er">' + (er && er.e || "") + '</div></div><div class="pff' + (er && er.p ? " e" : "") + '"><label>Password</label><div class="pin"><input id="nemp" type="password" autocomplete="current-password"></div><div class="er">' + (er && er.p || "") + '</div></div><div class="r"><button class="ghb" data-cf="no" style="height:46px">Cancel</button><button class="msgb" data-emok="1" style="width:auto;padding:0 22px;height:46px"><em>Send confirmation</em></button></div>'); }
        // Phone OTP decommissioned
        function gone() { $("gone").classList.add("o"); }
        addDocListener("click", function (e) {
            let connId, chat;
            const el = e.target.closest("[data-disconnect],[data-msg],[data-conn],[data-cn],[data-cm],[data-blk],[data-ub],[data-ns],[data-em],[data-emok],[data-ph],[data-phs],[data-gone],[data-rs],[data-sqc],[data-withdraw],[data-conn-act]");
            if (!el)
                return;
            const d = el.dataset;
            if (d.disconnect) {
                const personConnection = LIVE_CONNS.accepted.find(function (c) { return !c.listingId && (c.fromUserId === d.disconnect || c.toUserId === d.disconnect); });
                if (!personConnection) {
                    toast("No active person connection. Listing permission is separate.");
                    return;
                }
                disconnectConnectionBackend(personConnection.id).then(function () { toast("Disconnected. Existing history is preserved."); }).catch(function (error) { toast(error.message); });
                return;
            }
            if (d.withdraw !== undefined) {
                (connId = d.withdraw);
                const rIdx = d.rIdx !== undefined ? +d.rIdx : -1;
                withdrawConnectionRequestBackend(connId).then(function () {
                    if (rIdx > -1)
                        CN[rIdx] = false;
                    toast("Connection request withdrawn");
                }).catch(function (err) {
                    console.warn("Withdraw note:", err);
                    toast("Could not withdraw request. Try again.");
                });
                render();
                return;
            }
            else if (d.connAct !== undefined) {
                const act = d.connAct;
                (connId = d.connId);
                const rIdx2 = d.rIdx !== undefined ? +d.rIdx : -1;
                updateConnectionStatusBackend(connId, act === "accept" ? "accepted" : "rejected").then(function () {
                    toast(act === "accept" ? "Connection request accepted!" : "Connection request declined");
                }).catch(function (err) {
                    console.warn("Connection update note:", err);
                    toast("Could not update request. Try again.");
                });
                render();
                return;
            }
            if (d.msg) {
                if (!authUser || !authUser.uid) {
                    toast("Please sign in to message roommates");
                    openAuthModal();
                    return;
                }
                const p = d.msg.split(":");
                openChat(p[0], +p[1]);
            }
            else if (d.conn !== undefined || d.cn !== undefined) {
                if (!authUser || !authUser.uid) {
                    toast("Please sign in to connect with roommates");
                    openAuthModal();
                    return;
                }
                const i = +(d.conn !== undefined ? d.conn : d.cn);
                const targetUid = RM[i] && RM[i][9];
                const relationship = relationshipState(authUser.uid, targetUid, LIVE_CONNS, currentProfile && currentProfile.blockedUserIds || [], CH.map(function (c) { return { id: c.id, participants: c.raw && c.raw.participants || [authUser && authUser.uid, c.p], authorized: c.authorized === true }; }));
                if (!['none', 'declined'].includes(relationship.state) || CONNECTION_BUSY[targetUid])
                    return;
                CONNECTION_BUSY[targetUid] = true;
                sendConnectionRequestBackend(targetUid).then(function () {
                    toast("Connection request sent");
                }).catch(function (err) {
                    toast(err && err.message ? err.message : "Could not send request. Try again.");
                }).finally(function () {
                    delete CONNECTION_BUSY[targetUid];
                    render();
                });
                render();
            }
            else if (d.ub) {
                unblockUserBackend(d.ub).then(function () { toast("Unblocked. Fresh consent is required."); refreshProfile(); render(); }).catch(function (error) { toast(error.message); });
            }
            else if (d.rs) {
                reset();
            }
            else if (d.sqc) {
                sq("");
            }
            else if (d.cm !== undefined) {
                (chat = CH[+d.cm]);
                if (!chat)
                    return;
                const hasPersonConnection = LIVE_CONNS.accepted.some(function (c) { return !c.listingId && (c.fromUserId === chat.p || c.toUserId === chat.p); });
                const menuRows = [];
                if (hasPersonConnection) {
                    menuRows.push('<button class="opt2" data-disconnect="' + esc(chat.p) + '">Disconnect person connection</button>');
                }
                menuRows.push('<button class="opt2" data-chat-report="' + esc(chat.p) + '" data-cf="no">Report conversation</button>');
                menuRows.push('<button class="opt2 dg2" data-blk="' + esc(d.cm) + '" data-cf="no">Block this person</button>');
                sheetRows(menuRows);
            }
            else if (d.chatReport) {
                if (!authUser)
                    return;
                el.disabled = true;
                submitReportBackend("user", d.chatReport, "Conversation concern", "Reported from private chat").then(function () { toast("Report sent"); }).catch(function (error) { toast(error.message || "Could not send report"); }).finally(function () { el.disabled = false; });
            }
            else if (d.blk !== undefined) {
                (chat = CH[+d.blk]);
                if (!chat)
                    return;
                cfm("Block this person?", "This restricts communication in every section.", "Block", 1, function () { blockUserBackend(chat.p).then(function () { S.cid = null; toast("Person blocked"); render(); }).catch(function (error) { toast(error.message || "Could not block person."); }); });
            }
            else if (d.ub !== undefined) {
                toast("Unblocking is not available yet. No change was made.");
            }
            else if (d.ns) {
                S.nav = "profile";
                S.as = "settings";
                S.st = 2;
                DR = null;
                render();
                scrollTo(0, 0);
            }
            else if (d.em && passwordSignIn)
                emd();
            else if (d.emok) {
                const em = $("nem").value.trim(), pw = $("nemp").value, er = {};
                if (!/^\S+@\S+\.\S+$/.test(em))
                    er.e = em ? "That email does not look right" : "Enter the new email";
                if (!pw)
                    er.p = "Enter your password to confirm";
                if (er.e || er.p)
                    emd(er);
                else {
                    if (!auth.currentUser || !auth.currentUser.email) {
                        toast("Sign in again to change email.");
                        return;
                    }
                    el.disabled = true;
                    reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, pw)).then(function () { return verifyBeforeUpdateEmail(auth.currentUser, em); }).then(function () { $("cfo").classList.remove("o"); toast("Confirmation sent to " + em); }).catch(function (error) { toast(error.message || "Could not request email change."); }).finally(function () { el.disabled = false; });
                }
            }
            else if (d.gone) {
                $("gone").classList.remove("o");
                navigate("/");
            }
        });
        const acS0 = acS;
        acS = function () {
            let h = acS0();
            if (S.st == 1) {
                const restrictedIds = new Set(currentProfile && currentProfile.blockedUserIds || []);
                (LIVE_CONNS.restricted || []).filter(function (c) { return c.status === 'blocked'; }).forEach(function (c) {
                    restrictedIds.add(c.fromUserId === (authUser && authUser.uid) ? c.toUserId : c.fromUserId);
                });
                const rows = Array.from(restrictedIds).map(function (uid) {
                    const person = RM.find(function (r) { return r[9] === uid; });
                    return '<div class="rw"><div><b>' + esc(person ? person[1] : 'Profile unavailable') + '</b><small>Connection blocked</small></div><button class="ghb" data-ub="' + esc(uid) + '">Unblock</button></div>';
                }).join('');
                h += '<div class="cd"><h3>Restricted connections</h3><p>A block restricts communication everywhere. Unblocking requires fresh consent before messaging resumes.</p>' + (rows || '<div class="s2" style="margin:6px 0 0">No blocked connections are currently loaded.</div>') + '</div>';
            }
            return h;
        };
        addDocListener("keydown", function (e) {
            if (e.key != "Escape")
                return; if ($("cfo").classList.contains("o"))
                $("cfo").classList.remove("o");
            else if ($("pf").classList.contains("o") && !document.querySelector(".pp.o,.gv.o"))
                $("pf").classList.remove("o");
        });
        render();
        // Sync User Profile from Firebase Auth
        if (currentProfile) {
            ME.n = currentProfile.name || ME.n;
            ME.job = currentProfile.profession || ME.job;
            ME.area = (currentProfile.localities && currentProfile.localities[0]) || currentProfile.city || ME.area;
            ME.bio = currentProfile.bio || ME.bio;
            ME.ver = currentProfile.isVerified ? 1 : 0;
            ME.ph = currentProfile.avatar || ME.ph;
            ME.em = currentProfile.email || ME.em;
            ME.phn = currentProfile.phone || ME.phn;
            if (currentProfile.budget) {
                PR.b = [currentProfile.budgetMin || 0, currentProfile.budget];
                PR.areas = currentProfile.localities || [];
            }
            if (currentProfile.savedRoomIds) {
                currentProfile.savedRoomIds.forEach(function (id) { SV[id] = true; });
            }
            if (currentProfile.savedProfileIds) {
                currentProfile.savedProfileIds.forEach(function (id) { SV['r' + id] = true; });
            }
            syn();
        }
        // Override S.nav and S.cat with incoming route state
        if (targetNav) {
            S.nav = targetNav;
        }
        const postParam = searchParams.get('post') || searchParams.get('action');
        if (postParam === '1' || postParam === 'post') {
            setTimeout(openPost, 150);
        }
        const route = readExploreLocation(location.pathname, searchParams);
        Object.assign(S, route.filters);
        S.sub = route.requests;
        if (S.nav === 'saved' && !searchParams.has('sub') && getSavedRoomCount() === 0 && getSavedProfileCount() > 0) {
            S.sub = 1;
        }
        if (route.section) S.as = route.section;
        S.st = route.settingsTab;
        $('q').value = S.q;
        $('bud').value = S.max;
        $('sort').value = S.sort;
        const roomParam = searchParams.get('room');
        if (roomParam) {
            const foundIdx = D.findIndex(function (r) { return r[12] === roomParam; });
            if (foundIdx > -1) {
                S.room = foundIdx;
                S.nav = 'room';
            }
        }
        if (initialCat) {
            S.cat = initialCat;
            document.querySelectorAll('.chip[data-c]').forEach(function (t) {
                t.setAttribute('aria-pressed', t.dataset.c === String(initialCat));
            });
        }
        // Persist canonical IDs and query state in browser history. Native
        // popstate is handled by React Router, which remounts this lifecycle.
        let navigationReady = false;
        addWinListener('popstate', function () {
            navigationReady = false;
            // Native pushState does not notify React Router. A Back destination
            // may equal its stale context, so replace that same entry through
            // the router to force a new lifecycle key without adding history.
            const state = window.history.state || {};
            const savedScroll = state.nestmateScroll;
            navigate(window.location.pathname + window.location.search + window.location.hash,
                { replace: true, preventScrollReset: true, state: state.usr });
            if (savedScroll) window.history.replaceState({
                ...window.history.state,
                nestmateScroll: savedScroll
            }, '', window.location.href);
        });
        addDocListener('click', function (event) {
            if (event.target.closest('[data-n],[data-i],[data-r],[data-g],[data-c]')) navigationReady = true;
        }, true);
        function persistNavigation(replace = false) {
            if (!navigationReady || disposed) return;
            const next = buildExploreLocation({
                ...S,
                roomId: S.nav === 'pg' ? G[S.pg]?.[11] : D[S.room]?.[12],
                personId: RM[S.rmi]?.[9], chatId: CH[S.cid]?.id || searchParams.get('chat'),
                section: S.as, settingsTab: S.st, requests: S.sub,
            });
            if (next === window.location.pathname + window.location.search) return;
            const previous = window.history.state || {};
            const scroll = { x: window.scrollX, y: window.scrollY };
            if (replace) window.history.replaceState(previous, '', next);
            else {
                window.history.replaceState({ ...previous, nestmateScroll: scroll }, '', window.location.href);
                window.history.pushState({
                    ...previous, idx: (previous.idx || 0) + 1,
                    key: crypto.randomUUID(), nestmateScroll: { x: 0, y: 0 }
                }, '', next);
            }
            searchParams = new URLSearchParams(window.location.search);
        }
        let lastQuerySignature = '', queryRefreshTimer;
        cleanupFns.push(function () { clearTimeout(queryRefreshTimer); });
        const origRender = render;
        render = function (...args) {
            if (disposed) return;
            origRender.apply(this, args);
            if (S.nav === 'explore') {
                const signature = JSON.stringify([S.cat, S.city, S.q, S.min, S.max, S.move, S.types, S.propertyType, S.furn, S.ver, S.gender]);
                if (signature !== lastQuerySignature) {
                    const hadQuery = !!lastQuerySignature;
                    lastQuerySignature = signature;
                    clearTimeout(queryRefreshTimer);
                    if (hadQuery) queryRefreshTimer = setTimeout(function () {
                        if (!disposed) { loadPlacesPage(true); loadRoommatesPage(true); }
                    }, 200);
                }
            }
            persistNavigation();
        };
        Promise.allSettled([loadPlacesPage(true), loadRoommatesPage(true)]).then(function () {
            if (disposed) return;
            navigationReady = true;
            persistNavigation(true);
            if (S.nav === 'saved') {
                fetchSavedPlacesAndProfiles();
            }
            const saved = window.history.state?.nestmateScroll;
            if (saved) requestAnimationFrame(function () { if (!disposed) window.scrollTo(saved.x, saved.y); });
        });

        // Lightweight bounded single-document listener for real-time head updates
        const unsubHead = subscribeBoundedListingsHead(function (latestItem) {
            if (!latestItem)
                return;
            const exists = D.some(function (d) { return d[12] === latestItem.id; }) || G.some(function (g) { return g[11] === latestItem.id; });
            if (!exists && !PAGINATION_STATE.placesLoading) {
                // Initial discovery already includes the head. Starting another
                // request here could supersede its deep-link resolution.
                // New listing detected at top: refresh bounded page 1
                loadPlacesPage(true);
            }
        });
        cleanupFns.push(unsubHead);
        // If user is logged in, subscribe to live user data
        if (authUser && authUser.uid) {
            const unsubKyc = subscribeUserKycStatus(authUser.uid, function (record) {
                USER_KYC.doc = record;
                const rawSt = record && record.status ? String(record.status).toLowerCase() : '';
                USER_KYC.status = rawSt ? rawSt : (currentProfile?.isVerified || (ME && ME.ver) ? 'approved' : 'not_submitted');
                if ((S.nav === 'profile' && S.as === 'verify') || S.nav === 'listings')
                    render();
            });
            cleanupFns.push(unsubKyc);
            let connectionVersion = 0;
            const unsubConns = subscribeLiveConnections(authUser.uid, async function (liveConns) {
                const version = ++connectionVersion;
                LIVE_CONNS = liveConns || { accepted: [], received: [], sent: [], restricted: [] };
                // Permission state does not depend on loading display profiles.
                if (['connections', 'roommate', 'room', 'pg', 'explore', 'saved'].includes(S.nav)) render();
                const people = [...liveConns.accepted, ...liveConns.received, ...liveConns.sent].map(function (c) { return c.fromUserId === authUser.uid ? c.toUserId : c.fromUserId; });
                await Promise.allSettled(Array.from(new Set(people)).map(ensurePerson));
                if (disposed || version !== connectionVersion)
                    return;
                LIVE_CONNS = liveConns || { accepted: [], received: [], sent: [], restricted: [] };
                CONN_ID_MAP = {};
                if (liveConns && liveConns.sent) {
                    liveConns.sent.forEach(function (sc) {
                        const targetId = sc.toUserId || sc.recipientId;
                        if (targetId)
                            CONN_ID_MAP[targetId] = sc.id;
                        for (let r = 0; r < RM.length; r++) {
                            if (RM[r] && (RM[r][9] === targetId)) {
                                CN[r] = true;
                                CONN_ID_MAP['r:' + r] = sc.id;
                            }
                        }
                    });
                }
                if (liveConns && liveConns.received) {
                    liveConns.received.forEach(function (rc) {
                        const senderId = rc.fromUserId || rc.senderId;
                        if (senderId)
                            CONN_ID_MAP[senderId] = rc.id;
                        for (let r = 0; r < RM.length; r++) {
                            if (RM[r] && (RM[r][9] === senderId)) {
                                CONN_ID_MAP['recv:' + r] = rc.id;
                            }
                        }
                    });
                }
                if (['connections', 'roommate', 'room', 'pg', 'explore', 'saved'].includes(S.nav))
                    render();
            });
            cleanupFns.push(unsubConns);
            let pendingChatId = searchParams.get('chat');
            const unsubChats = subscribeLiveUserChats(authUser.uid, function (liveChats) {
                chatLoading = false; chatError = false;
                if (liveChats) {
                    const selectedChatId = CH[S.cid]?.id;
                    CH = liveChats.map(function (c) {
                        const old = CH.find(function (x) { return x.id === c.id; }); if (old && old.pendingMessage)
                            c.pendingMessage = old.pendingMessage; if (old && old.historyExpanded) {
                                const merged = new Map(old.m.concat(c.m).map(function (m) { return [m[5], m]; }));
                                c.m = Array.from(merged.values()).sort(function (a, b) { return (a[6] || 0) - (b[6] || 0); });
                                c.historyCursor = old.historyCursor;
                                c.hasOlder = old.hasOlder;
                                c.historyExpanded = true;
                            } return c;
                    });
                    if (selectedChatId) { const index = CH.findIndex(function (room) { return room.id === selectedChatId; }); S.cid = index < 0 ? null : index; }
                    if (pendingChatId) {
                        const selectedIndex = CH.findIndex(function (chat) { return chat.id === pendingChatId; });
                        if (selectedIndex >= 0) { S.cid = selectedIndex; pendingChatId = null; }
                    }
                    ub();
                    if (S.nav === 'messages') {
                        if (!document.querySelector('.nm-explore-root .th2'))
                            render();
                        else
                            rth();
                    }
                }
            }, function () {
                if (disposed) return;
                chatLoading = false; chatError = true;
                if (S.nav === "messages") render();
            });
            cleanupFns.push(unsubChats);
            const unsubNotifs = subscribeLiveNotifications(authUser.uid, function (liveNotifs) {
                if (liveNotifs) {
                    NT = liveNotifs;
                    ub();
                    if (S.nav === 'notifications')
                        render();
                }
            });
            cleanupFns.push(unsubNotifs);
            const unsubOwner = subscribeOwnerListings(authUser.uid, function (ownerListings) {
                window.APC_MAP = window.APC_MAP || {};
                MY = (ownerListings || []).map(function (item, kIdx) {
                    const mappedAp = [];
                    if (Array.isArray(item.ap)) {
                        item.ap.forEach(function (applicant) {
                            const aUid = applicant.fromUserId || applicant.userId || (applicant.user && applicant.user.uid);
                            if (!aUid)
                                return;
                            let idx = -1;
                            for (let r = 0; r < RM.length; r++) {
                                if (RM[r] && RM[r][9] === aUid) {
                                    idx = r;
                                    break;
                                }
                            }
                            if (idx === -1 && applicant.user) {
                                const u = applicant.user;
                                idx = RM.length;
                                RM.push([
                                    u.initials || 'RM',
                                    u.name || 'Applicant',
                                    u.profession || '',
                                    u.locality || '',
                                    u.budgetStr || 'Flexible',
                                    u.moveInStr || 'Not provided',
                                    u.isVerified ? 1 : 0,
                                    u.matchPct || 0,
                                    u.tags || [],
                                    u.uid,
                                    u.avatar || '',
                                    (u.raw && u.raw.gender) || 'Any'
                                ]);
                                RX.push([
                                    u.diet || '',
                                    u.smoking || '',
                                    u.sleep || '',
                                    u.guests || '',
                                    u.cleanliness || '',
                                    u.bio || ''
                                ]);
                            }
                            if (idx > -1) {
                                mappedAp.push(idx);
                                const st = applicationLabels[applicant.applicantStage] || 'New';
                                APS[kIdx + ':' + idx] = st;
                                APPLICATION_ANS[kIdx + ':' + idx] = applicant.screeningAnswers || {};
                                if (applicant.applicationId) {
                                    window.APC_MAP[kIdx + ':' + idx] = applicant.applicationId;
                                }
                            }
                        });
                    }
                    item.ap = mappedAp;
                    return item;
                });
                if (S.nav === 'listings' || S.nav === 'applicants' || S.nav === 'compare')
                    render();
            });
            cleanupFns.push(unsubOwner);
        }
        // Initial render
        render();
    })();
    return () => {
        disposed = true;
        if (privatePreviewUrl)
            URL.revokeObjectURL(privatePreviewUrl);
        // Execute all cleanup handlers
        cleanupFns.forEach(fn => {
            try {
                fn();
            }
            catch (e) { /* ignore */ }
        });
        // Remove any modal or mobile classes added to body/document
        document.body.classList.remove('chat', 'ns', 'hdn', 'ppo');
        document.documentElement.classList.remove('lock');
    };
}
