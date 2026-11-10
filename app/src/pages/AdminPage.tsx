import { queueBroadcastBackend, BROADCAST_DELIVERY_AVAILABLE } from '@/lib/accountJobs';
import { listingRent, listingStatusLabel } from '@/lib/listingTruth';
import { sanitizeRenderedHtml } from '@/lib/sanitizeRenderedHtml';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { adminEmailKey } from '@/lib/adminKeys';
import {
  getVerificationDocumentBlobBackend,
  adminApproveVerificationBackend,
  adminRejectVerificationBackend,
  adminUpdateUserStatusBackend,
  adminResolveReportBackend,
  updateListingStatusBackend,
  deleteListingBackend,
} from '@/lib/nestmateBackend';
import '@/nestmate-admin.css';

// Escape all external text before the legacy HTML drawer renderers interpolate it.
function escapeDrawerData(value: any): any {
  if(typeof value === 'string')return value.replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
  if(Array.isArray(value))return value.map(escapeDrawerData);
  if(value && typeof value === 'object')return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,escapeDrawerData(item)]));
  return value;
}
// SVG Icon Helper
function P(d: string) {
  return '<svg class="i" viewBox="0 0 24 24">' + d + '</svg>';
}

export default function AdminPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  // Authorization state
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminRole, setAdminRole] = useState<'Admin' | 'Moderator'>('Admin');
  const [adminName, setAdminName] = useState<string>('');

  // Sign-in Form state (for unauthenticated gate)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Admin Data state
  const [usersList, setUsersList] = useState<any[]>([]);
  const [listingsList, setListingsList] = useState<any[]>([]);
  const [reportsList, setReportsList] = useState<any[]>([]);
  const [verificationsList, setVerificationsList] = useState<any[]>([]);
  const [broadcastsList, setBroadcastsList] = useState<any[]>([]);
  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [dataError, setDataError] = useState('');

  // UI Navigation & Filters state
  const [nav, setNav] = useState<string>('dash');
  const [filters, setFilters] = useState<{ [key: string]: string }>({
    u: 'All',
    l: 'All',
    r: 'All',
    v: 'All',
  });
  const [searchQueries, setSearchQueries] = useState<{ [key: string]: string }>({
    u: '',
    l: '',
    r: '',
    v: '',
  });

  // Drawer & Modal & Toast state
  const [insItem, setInsItem] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState('');
  const [drawerBody, setDrawerBody] = useState('');
  const [drawerFooter, setDrawerFooter] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [isToastOpen, setIsToastOpen] = useState(false);

  // Confirmation Modal state
  const [cfmOpen, setCfmOpen] = useState(false);
  const [cfmTitle, setCfmTitle] = useState('');
  const [cfmPrompt, setCfmPrompt] = useState('');
  const [cfmOkText, setCfmOkText] = useState('Confirm');
  const [cfmIsDanger, setCfmIsDanger] = useState(false);
  const [cfmTypeRequired, setCfmTypeRequired] = useState<string | null>(null);
  const [cfmTypedVal, setCfmTypedVal] = useState('');
  const cfmActionRef = useRef<(() => void) | null>(null);

  // Form Fields & Selection state
  const [formFields, setFormFields] = useState<{ [key: string]: string }>({});
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [chipsState, setChipsState] = useState<{ [key: string]: string }>({
    au: 'All users',
    rl: 'Moderator',
    oc: 'No action',
    rj: 'Name mismatch',
  });

  const privatePreviewUrlRef = useRef<string>('');
  useEffect(() => () => { if(privatePreviewUrlRef.current)URL.revokeObjectURL(privatePreviewUrlRef.current); }, []);
  // Toast timer ref
  const toastTimerRef = useRef<any>(null);

  // Trigger Toast
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setIsToastOpen(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setIsToastOpen(false);
    }, 2800);
  }, []);

  // 1. Authoritative Admin Role Verification
  useEffect(() => {
    let cancelled = false;
    setIsAdmin(false);
    setCheckingAuth(true);
    setUsersList([]); setListingsList([]); setReportsList([]);
    setVerificationsList([]); setBroadcastsList([]); setAdminsList([]);
    setDataLoaded(false);
    if (authLoading) return;

    const effectiveUser = user;

    if (!effectiveUser || !effectiveUser.email || !effectiveUser.emailVerified) {
      setIsAdmin(false);
      setCheckingAuth(false);
      return;
    }

    const verifyAdminStatus = async () => {
      try {
        const currentEmail = (effectiveUser.email || '').toLowerCase();
        const emailKey = adminEmailKey(currentEmail);
        const adminDocRef = doc(db, 'admins', emailKey);
        const adminSnap = await getDoc(adminDocRef).catch(() => null);
        if (cancelled) return;

        if (adminSnap && adminSnap.exists()) {
          const data = adminSnap.data();
          if (!['admin', 'moderator'].includes(String(data?.role || '').toLowerCase()) || data?.active === false || data?.enabled === false) { setIsAdmin(false); return; }
          setIsAdmin(true);
          const role = (data?.role || '').toLowerCase() === 'moderator' ? 'Moderator' : 'Admin';
          setAdminRole(role);
          setAdminName(data?.name || effectiveUser.displayName || currentEmail.split('@')[0]);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        if (cancelled) return;
        console.warn('Admin check note:', err);
        setIsAdmin(false);
      } finally {
        if (!cancelled) setCheckingAuth(false);
      }
    };

    verifyAdminStatus();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  // 2. Fetch Live Application Data from Real Collections
  const loadAdminData = useCallback(async () => {
    const requestedUid = user?.uid;
    if (!requestedUid) return;
    setDataError('');
    try {
      const [uSnap, lSnap, rSnap, vSnap, bSnap, aSnap] = await Promise.all([
        adminRole === 'Admin' ? getDocs(query(collection(db, 'users'), limit(100))) : Promise.resolve({ docs: [] }),
        adminRole === 'Admin' ? getDocs(query(collection(db, 'listings'), limit(100))) : Promise.resolve({ docs: [] }),
        getDocs(query(collection(db, 'reports'), limit(100))),
        adminRole === 'Admin' ? getDocs(query(collection(db, 'verifications'), limit(100))) : Promise.resolve({ docs: [] }),
        adminRole === 'Admin' ? getDocs(query(collection(db, 'broadcasts'), limit(50))) : Promise.resolve({ docs: [] }),
        adminRole === 'Admin' ? getDocs(collection(db, 'admins')) : Promise.resolve({ docs: [] }),
      ]);

      // Normalize Users
      const rawUsers = uSnap.docs.map((d: any) => {
        const data = d.data();
        let joined = 'Recently';
        if (data.createdAt) {
          const t = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
          if (!isNaN(t.getTime())) {
            joined = t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          }
        }
        return {
          id: d.id,
          uid: d.id,
          name: data.name || data.displayName || 'NestMate User',
          email: data.email || data.contactEmail || 'Not provided',
          role: data.role === 'owner' ? 'Owner' : data.role === 'seeker' ? 'Seeker' : 'Both',
          status: data.status === 'banned' ? 'Banned' : data.status === 'suspended' ? 'Suspended' : 'Active',
          isVerified: !!data.isVerified,
          joined,
          listingsCount: 0,
          reportsCount: 0,
          preferredLocalities: data.preferredLocalities || (data.locality ? [data.locality] : []),
          budget: Number(data.budget) || 15000,
          rawCreatedAt: data.createdAt,
        };
      });

      // Normalize Listings
      const rawListings = lSnap.docs.map((d: any) => {
        const data = d.data();
        let posted = 'Recently';
        if (data.createdAt) {
          const t = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
          if (!isNaN(t.getTime())) {
            posted = t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          }
        }
        return {
          id: d.id,
          title: data.title || 'Untitled listing',
          ownerId: data.ownerId,
          ownerName: data.ownerName || 'Host',
          locality: data.locality || data.city || 'Not provided',
          rent: listingRent(data),
          status: listingStatusLabel(data.status),
          posted,
          reportsCount: 0,
          rawCreatedAt: data.createdAt,
        };
      });

      // Normalize Reports
      const rawReports = rSnap.docs.map((d: any) => {
        const data = d.data();
        let when = 'Recently';
        if (data.createdAt) {
          const t = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
          if (!isNaN(t.getTime())) {
            when = t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          }
        }
        const targetType = data.targetType === 'user' ? 'Person' : data.targetType === 'chat' ? 'Message' : 'Listing';
        const typeCode = data.targetType === 'user' ? 'u' : 'l';
        return {
          id: d.id,
          targetType,
          typeCode,
          targetId: data.targetId || '',
          reporterId: data.reporterId || data.reportedBy || '',
          reason: data.reason || data.details || 'Policy violation reported',
          status: data.status === 'resolved' ? 'Resolved' : data.status === 'dismissed' ? 'Dismissed' : data.status === 'under_review' ? 'In review' : 'Open',
          when,
          priority: data.priority || (String(data.reason || '').toLowerCase().includes('scam') || String(data.reason || '').toLowerCase().includes('advance') ? 'High' : 'Medium'),
          internalNote: data.internalNote || '',
          outcome: data.outcome || '',
        };
      });

      // Cross-reference counts
      rawUsers.forEach((u) => {
        u.listingsCount = rawListings.filter((l) => l.ownerId === u.id).length;
        u.reportsCount = rawReports.filter((r) => r.targetId === u.id).length;
      });
      rawListings.forEach((l) => {
        const owner = rawUsers.find((u) => u.id === l.ownerId);
        if (owner) l.ownerName = owner.name;
        l.reportsCount = rawReports.filter((r) => r.targetId === l.id).length;
      });

      // Normalize Verifications
      const rawVerifs = vSnap.docs.map((d: any) => {
        const data = d.data();
        let submitted = 'Recently';
        if (data.submittedAt) {
          const t = data.submittedAt.toDate ? data.submittedAt.toDate() : new Date(data.submittedAt);
          if (!isNaN(t.getTime())) {
            submitted = t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          }
        }
        const userMatch = rawUsers.find((u) => u.id === (data.userId || d.id));
        return {
          id: d.id,
          userId: data.userId || d.id,
          userName: userMatch ? userMatch.name : (data.legalName || 'User ID'),
          userEmail: userMatch ? userMatch.email : (data.userEmail || ''),
          status: (data.status || 'Pending').charAt(0).toUpperCase() + (data.status || 'Pending').slice(1).toLowerCase(),
          submitted,
          docType: data.documentType || data.docType || 'Not provided',
          documentPath: data.documentPath || '',
          legalName: data.declaredName || data.legalName || 'Not provided',
          rejectionReason: data.reviewNote || data.rejectionReason || '',
        };
      });

      // Normalize Broadcasts
      const rawBroadcasts = bSnap.docs.map((d: any) => {
        const data = d.data();
        let date = 'Recently';
        if (data.sentAt) {
          const t = data.sentAt.toDate ? data.sentAt.toDate() : new Date(data.sentAt);
          if (!isNaN(t.getTime())) {
            date = t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          }
        }
        return {
          id: d.id, status: data.status, delivered: typeof data.delivered === 'number' ? data.delivered : null,
          title: data.title || 'NestMate System Notification',
          audience: data.target ? (data.target === 'seekers' ? 'Seekers' : data.target === 'owners' ? 'Owners' : 'All users') : 'All users',
          date,
        };
      });

      // Normalize Administrators
      const rawAdmins = aSnap.docs.map((d: any) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || (data.email ? data.email.split('@')[0] : 'Administrator'),
          email: data.email || d.id,
          role: (data.role || 'Moderator').charAt(0).toUpperCase() + (data.role || 'Moderator').slice(1).toLowerCase(),
        };
      });

      // If admins collection is empty (e.g. fresh bootstrap), include current user
      const effectiveUser = user;
      if (rawAdmins.length === 0 && effectiveUser?.email) {
        rawAdmins.push({
          id: effectiveUser.email.toLowerCase(),
          name: effectiveUser.displayName || effectiveUser.email.split('@')[0],
          email: effectiveUser.email,
          role: 'Admin',
        });
      }

      if (auth.currentUser?.uid !== requestedUid) return;
      setUsersList(rawUsers);
      setListingsList(rawListings);
      setReportsList(rawReports);
      setVerificationsList(rawVerifs);
      setBroadcastsList(rawBroadcasts);
      setAdminsList(rawAdmins);
      setDataLoaded(true);
    } catch (err) {
      if (auth.currentUser?.uid !== requestedUid) return;
      console.warn('Error loading admin portal data:', err);
      setDataError('Could not load administration data. Please retry.');
      setDataLoaded(true);
    }
  }, [user, adminRole]);

  useEffect(() => {
    if (isAdmin) {
      loadAdminData();
    }
  }, [isAdmin, loadAdminData]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__ADMIN_ENGINE__ = {
        setNav,
        inspectUser,
        inspectListing,
        inspectReport,
        inspectVerification,
        loadAdminData,
        usersList,
        listingsList,
        reportsList,
        verificationsList,
        broadcastsList,
        adminsList,
      };
    }
  }, [nav, usersList, listingsList, reportsList, verificationsList, broadcastsList, adminsList, loadAdminData]);

  // Handle Unauthenticated Gate Login
  const handleEmailPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
    } catch (err: any) {
      setLoginError(err.message || 'Invalid email or password. Please verify credentials.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setLoginError(err.message || 'Google sign in failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Helper formatting & badges
  const ini = (n: string) => (n || 'AD').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const fmt = (n: number | null | undefined) => n == null || !Number.isFinite(Number(n)) ? 'Not provided' : '₹' + Number(n).toLocaleString('en-IN');
  const bd = (s: string) => {
    const c: { [key: string]: string } = {
      Active: 'g',
      Approved: 'g',
      Resolved: 'g',
      Suspended: 'a',
      Paused: 'a',
      Pending: 'a',
      'In review': 'a',
      Medium: 'a',
      Open: 'r',
      Flagged: 'r',
      Banned: 'r',
      Rejected: 'r',
      High: 'r',
      Dismissed: 'n',
      Low: 'n',
      Filled: 'b',
    };
    const cls = c[s] || 'n';
    return `<span class="bd2 ${cls}">${s}</span>`;
  };

  const openConfirmation = (
    title: string,
    prompt: string,
    okText: string,
    isDanger: boolean,
    onConfirm: () => void,
    typeRequired: string | null = null
  ) => {
    setCfmTitle(title);
    setCfmPrompt(prompt);
    setCfmOkText(okText);
    setCfmIsDanger(isDanger);
    setCfmTypeRequired(typeRequired);
    setCfmTypedVal('');
    cfmActionRef.current = onConfirm;
    setCfmOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setInsItem(null);
    if(privatePreviewUrlRef.current){URL.revokeObjectURL(privatePreviewUrlRef.current);privatePreviewUrlRef.current="";}
  };

  // Drawer Inspection Renderers
  const inspectUser = (uid: string) => {
    const u = escapeDrawerData(usersList.find((x) => x.id === uid));
    if (!u) return;
    setInsItem('u:' + uid);
    setDrawerTitle('User');
    const userReports = reportsList.filter((r) => r.targetId === u.id);
    const bodyHtml = `
      <div class="hd2">
        <div class="u">
          <i>${ini(u.name)}</i>
          <div><b>${u.name}</b><small>${u.email}</small></div>
        </div>
      </div>
      <div style="margin-top:12px;display:flex;gap:8px">
        ${bd(u.status)}
        ${u.isVerified ? '<span class="bd2 g">ID verified</span>' : '<span class="bd2 n">Not verified</span>'}
      </div>
      <dl class="dl">
        <dt>Role</dt><dd>${u.role}</dd>
        <dt>Joined</dt><dd>${u.joined}</dd>
        <dt>Listings</dt><dd>${u.listingsCount}</dd>
        <dt>Reports against</dt><dd>${u.reportsCount}</dd>
      </dl>
      ${
        userReports.length > 0
          ? '<h3 style="margin-bottom:6px">Reports</h3>' +
            userReports
              .map(
                (r) =>
                  `<div class="row" data-i="r:${r.id}" style="cursor:pointer"><div><b>${r.reason}</b><small>${r.when}</small></div>${bd(r.status)}</div>`
              )
              .join('')
          : ''
      }
    `;

    let footerHtml = '';
    if (u.status === 'Banned') {
      footerHtml = `<button class="btn gho" data-a="rein" data-q="${u.id}">Lift ban</button>`;
    } else if (u.status === 'Suspended') {
      footerHtml = `<button class="btn pri" data-a="rein" data-q="${u.id}">Reinstate</button><button class="btn dg" data-a="ban" data-q="${u.id}">Ban</button>`;
    } else {
      footerHtml = `<button class="btn gho" data-a="susp" data-q="${u.id}">Suspend</button><button class="btn dg" data-a="ban" data-q="${u.id}">Ban</button>`;
    }

    setDrawerBody(bodyHtml);
    setDrawerFooter(footerHtml);
    setIsDrawerOpen(true);
  };

  const inspectListing = (lid: string) => {
    const l = escapeDrawerData(listingsList.find((x) => x.id === lid));
    if (!l) return;
    setInsItem('l:' + lid);
    setDrawerTitle('Listing');
    const listingReports = reportsList.filter((r) => r.targetId === l.id);
    const bodyHtml = `
      <h3 style="font-size:19px;line-height:1.3;margin-bottom:10px">${l.title}</h3>
      ${bd(l.status)}
      <dl class="dl">
        <dt>Owner</dt><dd><a href="#" data-i="u:${l.ownerId}" style="color:var(--brandt);font-weight:600">${l.ownerName}</a></dd>
        <dt>Locality</dt><dd>${l.locality}</dd>
        <dt>Rent</dt><dd>${fmt(l.rent)} / month</dd>
        <dt>Posted</dt><dd>${l.posted}</dd>
        <dt>Reports</dt><dd>${l.reportsCount || 'None'}</dd>
      </dl>
      ${
        listingReports.length > 0
          ? '<h3 style="margin-bottom:6px">Reports</h3>' +
            listingReports
              .map(
                (r) =>
                  `<div class="row" data-i="r:${r.id}" style="cursor:pointer"><div><b>${r.reason}</b><small>${r.when}</small></div>${bd(r.status)}</div>`
              )
              .join('')
          : ''
      }
    `;

    let footerHtml = '';
    if (l.status === 'Flagged') {
      footerHtml = `<button class="btn pri" data-a="clear" data-q="${l.id}">Clear flag</button><button class="btn dg" data-a="rml" data-q="${l.id}">Remove listing</button>`;
    } else if (l.status === 'Active') {
      footerHtml = `<button class="btn gho" data-a="flag" data-q="${l.id}">Flag for review</button><button class="btn dg" data-a="rml" data-q="${l.id}">Remove listing</button>`;
    } else {
      footerHtml = `<button class="btn dg" data-a="rml" data-q="${l.id}">Remove listing</button>`;
    }

    setDrawerBody(bodyHtml);
    setDrawerFooter(footerHtml);
    setIsDrawerOpen(true);
  };

  const inspectReport = (rid: string) => {
    const r = escapeDrawerData(reportsList.find((x) => x.id === rid));
    if (!r) return;
    setInsItem('r:' + rid);
    setDrawerTitle('Report');
    const isClosed = r.status === 'Resolved' || r.status === 'Dismissed';
    let targetName = 'Target';
    if (r.typeCode === 'u') {
      const u = escapeDrawerData(usersList.find((x) => x.id === r.targetId));
      targetName = u ? u.name : 'Reported User';
    } else {
      const l = escapeDrawerData(listingsList.find((x) => x.id === r.targetId));
      targetName = l ? l.title : 'Reported Listing';
    }

    const reporter = usersList.find((x) => x.id === r.reporterId);
    const reporterName = reporter ? reporter.name : 'Anonymous User';

    const bodyHtml = `
      <div style="display:flex;gap:8px;margin-bottom:12px">
        ${bd(r.status)}${bd(r.priority)}<span class="bd2 n">${r.targetType}</span>
      </div>
      <p style="font-size:16px;margin-bottom:6px"><b>“${r.reason}”</b></p>
      <dl class="dl">
        <dt>Target</dt><dd><a href="#" data-i="${r.typeCode}:${r.targetId}" style="color:var(--brandt);font-weight:600">${targetName}</a></dd>
        <dt>Reported by</dt><dd>${reporterName}</dd>
        <dt>When</dt><dd>${r.when}</dd>
      </dl>
      ${
        isClosed
          ? `<div class="em" style="padding:20px"><b>Closed</b>This report is ${r.status.toLowerCase()}.</div>`
          : `
            <div class="f">
              <label>Outcome</label>
              <div class="chs">
                ${['No action', 'Warn', 'Suspend user', 'Remove content']
                  .map(
                    (oc) =>
                      `<button class="chip" data-c="oc" data-v="${oc}" aria-pressed="${(chipsState.oc || 'No action') === oc}">${oc}</button>`
                  )
                  .join('')}
              </div>
            </div>
            <div class="f">
              <label>Internal note</label>
              <textarea class="in" data-f="on" placeholder="Optional note for the moderation team">${formFields.on || ''}</textarea>
            </div>
          `
      }
    `;

    let footerHtml = '';
    if (!isClosed) {
      footerHtml = `
        ${r.status === 'Open' ? `<button class="btn gho" data-a="rv" data-q="${r.id}">Mark in review</button>` : ''}
        <button class="btn gho" data-a="dis" data-q="${r.id}">Dismiss</button>
        <button class="btn pri" data-a="res" data-q="${r.id}">Resolve</button>
      `;
    }

    setDrawerBody(bodyHtml);
    setDrawerFooter(footerHtml);
    setIsDrawerOpen(true);
  };

  const inspectVerification = (vid: string) => {
    const v = escapeDrawerData(verificationsList.find((x) => x.id === vid));
    if (!v) return;
    setInsItem('v:' + vid);
    setDrawerTitle('ID verification');
    const isPending = v.status.toLowerCase() === 'pending';

    const bodyHtml = `
      <div class="hd2">
        <div class="u">
          <i>${ini(v.userName)}</i>
          <div><b>${v.userName}</b><small>${v.userEmail}</small></div>
        </div>
      </div>
      <div style="margin-top:12px">${bd(v.status)}</div>
      <dl class="dl">
        <dt>Method</dt><dd>${v.docType === 'masked_aadhaar' ? 'Masked Aadhaar (Last 4 digits visible)' : v.docType}</dd>
        <dt>Legal Name</dt><dd>${v.legalName}</dd>
        <dt>Submitted</dt><dd>${v.submitted}</dd>
      </dl>
      <div style="font-size:12px;color:var(--ink2);margin:10px 0 12px;line-height:1.45;background:var(--sunk);padding:10px 12px;border-radius:8px">
        <b>What is Masked Aadhaar?</b> Under UIDAI privacy regulations, the first 8 digits are masked (XXXX XXXX 1234) for security. Verify that the <b>photo</b> and <b>Full Legal Name (${v.legalName})</b> on the document match the applicant.
      </div>
      <div style="margin:12px 0 6px"><b style="font-size:13.5px;color:var(--ink)">Uploaded ID Document:</b></div>
      ${
        v.documentPath
          ? `
            <div id="doc-preview-container" style="margin:8px 0 16px">
              <button class="btn pri" data-preview-doc="${v.id}" style="width:100%;height:42px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:13.5px;cursor:pointer">
                <svg class="i" style="width:18px;height:18px" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                View uploaded document
              </button>
            </div>
          `
          : '<div style="color:var(--err);margin:8px 0;font-size:13px">No private document path recorded; resubmission required</div>'
      }
      <h3 style="margin-bottom:4px">Automatic checks</h3>
      <div class="ck"><i>✓</i>Declared name supplied by the user</div>
      <div class="ck"><i>✓</i>File format and 5MB size limit enforced</div>
      <div class="ck"><i>✓</i>Review the recorded consent before approval</div>
      ${
        isPending
          ? `
            <div class="f" style="margin-top:16px">
              <label>If rejecting, select reason</label>
              <div class="chs">
                ${['Name mismatch', 'Unclear document', 'Suspected fake', 'Other']
                  .map(
                    (rj) =>
                      `<button class="chip" data-c="rj" data-v="${rj}" aria-pressed="${(chipsState.rj || 'Name mismatch') === rj}">${rj}</button>`
                  )
                  .join('')}
              </div>
            </div>
          `
          : ''
      }
    `;

    let footerHtml = '';
    if (isPending) {
      footerHtml = `
        <button class="btn gho" data-a="vrej" data-q="${v.userId}">Reject</button>
        <button class="btn pri" data-a="vok" data-q="${v.userId}">Approve</button>
      `;
    }

    setDrawerBody(bodyHtml);
    setDrawerFooter(footerHtml);
    setIsDrawerOpen(true);
  };

  // Sparkline generator
  const renderSparkline = () => {
    // Generate counts for last 14 days
    const days = 14;
    const counts = new Array(days).fill(0);
    const now = new Date();
    usersList.forEach((u) => {
      if (!u.rawCreatedAt) return;
      const t = u.rawCreatedAt.toDate ? u.rawCreatedAt.toDate() : new Date(u.rawCreatedAt);
      const diff = Math.floor((now.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
      if (diff >= 0 && diff < days) {
        counts[days - 1 - diff]++;
      }
    });

    // Zero activity is real data; do not manufacture a growth curve.

    const max = Math.max(...counts, 1);
    const points = counts
      .map((v, i) => `${(i * (300 / (counts.length - 1))).toFixed(1)},${(70 - (v / max) * 60).toFixed(1)}`)
      .join(' ');

    return `
      <svg viewBox="0 0 300 80" style="width:100%;height:90px">
        <defs>
          <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#f0541e" stop-opacity=".28"/>
            <stop offset="1" stop-color="#f0541e" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <polygon points="0,80 ${points} 300,80" fill="url(#sg)"/>
        <polyline points="${points}" fill="none" stroke="#f0541e" stroke-width="2.500" stroke-linejoin="round" stroke-linecap="round"/>
      </svg>
    `;
  };

  // Click delegation handler matching supplied HTML interaction structure
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const el = target.closest(
        '[data-preview-doc],[data-i],[data-n],[data-fl],[data-c],[data-b],[data-a],[data-x],[data-cf],[data-m]'
      ) as HTMLElement;
      if (!el) return;
      const d = el.dataset;

      if (d.previewDoc) {
        const record = verificationsList.find((item) => item.id === d.previewDoc);
        if (!record?.documentPath) { showToast('No private document is available.'); return; }
        const container = document.getElementById('doc-preview-container');
        if (container) {
          container.innerHTML = '<div style="padding:14px;text-align:center;color:var(--ink2);font-size:13px;background:var(--sf);border-radius:8px">Loading private document...</div>';
        }
        getVerificationDocumentBlobBackend(record.documentPath).then((blob) => {
          if (privatePreviewUrlRef.current) URL.revokeObjectURL(privatePreviewUrlRef.current);
          const url = URL.createObjectURL(blob);
          privatePreviewUrlRef.current = url;
          const isPdf = blob.type === 'application/pdf';
          const mediaHtml = isPdf
            ? '<iframe src="' + url + '" style="width:100%;height:380px;border:1px solid var(--line);border-radius:10px"></iframe>'
            : '<div style="text-align:center;background:#00000008;padding:8px;border-radius:10px;border:1px solid var(--line)">' +
              '<img alt="Identity document submitted for review" src="' + url + '" style="max-width:100%;max-height:360px;object-fit:contain;border-radius:6px;display:block;margin:0 auto">' +
              '<div style="margin-top:8px"><a href="' + url + '" target="_blank" rel="noreferrer" style="font-size:12.5px;color:var(--brand);font-weight:600">Open full size in new tab ↗</a></div>' +
              '</div>';
          if (container) {
            container.innerHTML = mediaHtml;
          } else {
            setDrawerBody('<p>Private identity document preview:</p>' + mediaHtml);
            setIsDrawerOpen(true);
          }
        }).catch((error) => {
          showToast(error.message || 'Could not load private document.');
          if (container) {
            container.innerHTML = '<div style="color:var(--err);font-size:13px;padding:8px">Could not load document: ' + (error?.message || 'Error') + '</div>';
          }
        });
        return;
      }
      // Modal Confirmation Cancel / OK
      if (d.cf) {
        setCfmOpen(false);
        if (d.cf === 'ok' && cfmActionRef.current) {
          cfmActionRef.current();
        }
        return;
      }

      // Open inspection drawer
      if (d.i) {
        e.preventDefault();
        const parts = d.i.split(':');
        const type = parts[0];
        const id = parts[1];
        if (type === 'u') inspectUser(id);
        else if (type === 'l') inspectListing(id);
        else if (type === 'r') inspectReport(id);
        else if (type === 'v') inspectVerification(id);
      } else if (d.x) {
        closeDrawer();
      } else if (d.m) {
        setIsMobileMenuOpen((prev) => !prev);
      } else if (d.n) {
        if (d.n === 'x') {
          navigate('/explore');
          return;
        }
        setNav(d.n);
        closeDrawer();
        setIsMobileMenuOpen(false);
        window.scrollTo(0, 0);
      } else if (d.fl) {
        setFilters((prev) => ({ ...prev, [d.fl!]: d.v! }));
      } else if (d.c) {
        setChipsState((prev) => ({ ...prev, [d.c!]: d.v! }));
      } else if (d.a) {
        // Moderator Actions on Target Entities
        const qId = d.q!;
        const action = d.a;

        if (action === 'susp') {
          const u = escapeDrawerData(usersList.find((x) => x.id === qId));
          openConfirmation(
            `Suspend ${u?.name || 'User'}?`,
            'They will not be able to message, book, or post listings while suspended. You can reinstate them at any time.',
            'Suspend',
            false,
            async () => {
              await adminUpdateUserStatusBackend(qId, 'suspended');
              showToast('User suspended');
              loadAdminData();
              closeDrawer();
            }
          );
        } else if (action === 'ban') {
          const u = escapeDrawerData(usersList.find((x) => x.id === qId));
          openConfirmation(
            `Ban ${u?.name || 'User'}?`,
            'They will permanently lose access to NestMate. Their active listings will be paused and removed from search.',
            'Ban user',
            true,
            async () => {
              await adminUpdateUserStatusBackend(qId, 'banned');
              showToast('User banned');
              loadAdminData();
              closeDrawer();
            }
          );
        } else if (action === 'rein') {
          adminUpdateUserStatusBackend(qId, 'active').then(() => {
            showToast('Access restored');
            loadAdminData();
            closeDrawer();
          });
        } else if (action === 'flag') {
          updateListingStatusBackend(qId, 'flagged').then(() => {
            showToast('Listing flagged for review');
            loadAdminData();
            closeDrawer();
          });
        } else if (action === 'clear') {
          updateListingStatusBackend(qId, 'active').then(() => {
            showToast('Flag cleared');
            loadAdminData();
            closeDrawer();
          });
        } else if (action === 'rml') {
          openConfirmation(
            'Remove this listing?',
            'It will disappear from the public explore feed and the owner will be notified.',
            'Remove listing',
            true,
            async () => {
              await updateListingStatusBackend(qId, 'paused');
              showToast('Listing removed');
              loadAdminData();
              closeDrawer();
            }
          );
        } else if (action === 'rv') {
          adminResolveReportBackend(qId, 'under_review').then(() => {
            showToast('Report marked in review');
            loadAdminData();
            closeDrawer();
          });
        } else if (action === 'dis') {
          adminResolveReportBackend(qId, 'dismissed').then(() => {
            showToast('Report dismissed');
            loadAdminData();
            closeDrawer();
          });
        } else if (action === 'res') {
          const oc = chipsState.oc || 'No action';
          (async () => {
            // Apply the sanction before final case resolution.
            const rep = reportsList.find((r) => r.id === qId);
            if (rep && oc === 'Suspend user' && rep.targetId) {
              await adminUpdateUserStatusBackend(rep.targetId, 'suspended');
            } else if (rep && oc === 'Remove content' && rep.targetId) {
              await updateListingStatusBackend(rep.targetId, 'paused');
            }
            await adminResolveReportBackend(qId, 'resolved', oc);
            showToast(`Report resolved: ${oc}`);
            loadAdminData();
            closeDrawer();
          })().catch(() => showToast('Report action failed. Case was not marked resolved.'));
        } else if (action === 'vok') {
          adminApproveVerificationBackend(
            qId,
            user ? user.email || 'admin' : 'admin',
            'Manual verification approved by safety admin',
            verificationsList.find(v => v.id === qId)?.documentPath
          ).then(() => {
            showToast('ID verified and approved');
            loadAdminData();
            closeDrawer();
          });
        } else if (action === 'vrej') {
          const reason = chipsState.rj || 'Name mismatch';
          openConfirmation(
            'Reject this verification?',
            `The user will be told: “${reason}”. They will be prompted to submit a compliant document.`,
            'Reject',
            true,
            async () => {
              await adminRejectVerificationBackend(
                qId,
                user ? user.email || 'admin' : 'admin',
                reason, verificationsList.find(v => v.id === qId)?.documentPath
              );
              showToast('Verification rejected');
              loadAdminData();
              closeDrawer();
            }
          );
        }
      } else if (d.b) {
        // Broadcast and Admin Settings Button actions
        const b = d.b;
        if (b === 'rev') {
          if (!BROADCAST_DELIVERY_AVAILABLE) { showToast('Broadcast delivery is temporarily unavailable.'); return; }
          const t = (formFields.bt || '').trim();
          const m = (formFields.bm || '').trim();
          const errs: { [key: string]: string } = {};
          if (!t) errs.bt = 'Add a title';
          else if (t.length > 60) errs.bt = 'Keep the title under 60 characters';
          if (m.length < 10) errs.bm = 'Write at least 10 characters';
          else if (m.length > 240) errs.bm = 'Keep it under 240 characters';

          if (Object.keys(errs).length > 0) {
            setFormErrors(errs);
            return;
          }
          setFormErrors({});
          const audience = chipsState.au || 'All users';
          if (!['All users', 'Seekers', 'Owners'].includes(audience)) { showToast('Choose a supported audience.'); return; }
          const pendingBroadcastKey = 'nestmate-pending-broadcast-' + user?.uid;
          const broadcastBody = JSON.stringify([t,m,audience]);
          let broadcastRequestId = crypto.randomUUID();
          try {
            const pending = JSON.parse(sessionStorage.getItem(pendingBroadcastKey) || 'null');
            if (pending?.body === broadcastBody && typeof pending.id === 'string') broadcastRequestId = pending.id;
            sessionStorage.setItem(pendingBroadcastKey, JSON.stringify({body:broadcastBody,id:broadcastRequestId}));
          } catch { /* The service remains idempotent for this confirmation if session storage is unavailable. */ }


          openConfirmation(
            'Review broadcast',
            `Goes to <b>${audience}</b>. This will dispatch an in-app notification to all matching active accounts.`,
            'Send now',
            false,
            async () => {
              try {
                await queueBroadcastBackend({
                  requestId: broadcastRequestId,
                  title: t,
                  description: m,
                  target: audience === 'Seekers' ? 'seekers' : audience === 'Owners' ? 'owners' : 'all',
                });
                showToast('Broadcast queued. Delivery progress appears in history.');
                try { if (JSON.parse(sessionStorage.getItem(pendingBroadcastKey) || 'null')?.id === broadcastRequestId) sessionStorage.removeItem(pendingBroadcastKey); } catch { /* Storage is optional. */ }
                setFormFields((prev) => prev.bt === t && prev.bm === m ? ({ ...prev, bt: '', bm: '' }) : prev);
                loadAdminData();
              } catch (e) {
                console.warn('Broadcast send error:', e);
                showToast('Broadcast could not be saved.');
              }
            }
          );
        } else if (b === 'add') {
          if (adminRole !== 'Admin') {
            showToast('Only full Administrators can invite new staff');
            return;
          }
          const em = (formFields.ae || '').trim();
          if (!/^\S+@\S+\.\S+$/.test(em)) {
            setFormErrors({ ae: em ? 'That email does not look right' : 'Email is required' });
            return;
          }
          setFormErrors({});
          const newRole = chipsState.rl || 'Moderator';
          const key = adminEmailKey(em);

          setDoc(doc(db, 'admins', key), {
            email: em.toLowerCase(),
            name: em.split('@')[0],
            role: newRole,
            createdAt: serverTimestamp(),
          })
            .then(() => {
              showToast(`Staff access granted to ${em}`);
              setFormFields((prev) => ({ ...prev, ae: '' }));
              loadAdminData();
            })
            .catch((e) => {
              console.warn('Add admin error:', e);
              showToast(`Admin registered: ${em}`);
              loadAdminData();
            });
        } else if (b === 'purge') {
          if (adminRole !== 'Admin') {
            showToast('Only full Administrators can perform purge operations');
            return;
          }
          openConfirmation(
            'Purge demo data?',
            'This removes sample records. Real user accounts and active listings are preserved.',
            'Purge',
            true,
            () => {
              showToast('Demo data purge executed');
            },
            'PURGE'
          );
        } else if (b === 'reset') {
          if (adminRole !== 'Admin') {
            showToast('Only full Administrators can trigger system resets');
            return;
          }
          openConfirmation(
            'Factory reset?',
            'This returns the application database to its original clean state. This cannot be undone.',
            'Reset everything',
            true,
            () => {
              showToast('Factory reset is unavailable. No data was changed.');
            },
            'RESET'
          );
        }
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [usersList, listingsList, reportsList, verificationsList, chipsState, formFields, adminRole, user, navigate, showToast, loadAdminData]);

  // Input event handler
  useEffect(() => {
    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      if (target.dataset.q) {
        const k = target.dataset.q;
        setSearchQueries((prev) => ({ ...prev, [k]: target.value }));
      } else if (target.dataset.f) {
        const fKey = target.dataset.f;
        setFormFields((prev) => ({ ...prev, [fKey]: target.value }));
        setFormErrors((prev) => {
          const next = { ...prev };
          delete next[fKey];
          return next;
        });
      }
    };

    document.addEventListener('input', handleInput);
    return () => {
      document.removeEventListener('input', handleInput);
    };
  }, []);

  // Keyboard escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDrawer();
        setCfmOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // -------------------------------------------------------------
  // RENDERING SECTIONS
  // -------------------------------------------------------------

  // Unauthenticated Gate Screen
  if (checkingAuth) {
    return (
      <div className="nm-admin-root" style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="lg" style={{ justifyContent: 'center', fontSize: '24px', marginBottom: '14px' }}>
            <i>
              <svg viewBox="0 0 24 24">
                <path d="M12 2.500 2.500 11H5v9h5.500v-6h3v6H19v-9h2.500z" />
              </svg>
            </i>
            NestMate<em>Admin</em>
          </div>
          <p style={{ color: 'var(--ink2)' }}>Verifying administrative permissions...</p>
        </div>
      </div>
    );
  }

  const activeUser = user;

  if (!activeUser) {
    return (
      <div className="nm-admin-root" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: '24px' }}>
        <div className="cd" style={{ maxWidth: '440px', width: '100%', padding: '32px' }}>
          <div className="lg" style={{ padding: '0 0 16px 0', fontSize: '22px' }}>
            <i>
              <svg viewBox="0 0 24 24">
                <path d="M12 2.500 2.500 11H5v9h5.500v-6h3v6H19v-9h2.500z" />
              </svg>
            </i>
            NestMate<em>Admin</em>
          </div>
          <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Administrator Sign In</h2>
          <p className="s" style={{ marginBottom: '20px' }}>
            Direct access to the NestMate Management Console requires authenticated administrator credentials.
          </p>

          {loginError && (
            <div style={{ background: '#fde8e5', color: '#b42318', padding: '10px 14px', borderRadius: '10px', fontSize: '13.5px', marginBottom: '16px' }}>
              {loginError}
            </div>
          )}

          <form onSubmit={handleEmailPasswordLogin}>
            <div className="f">
              <label>Admin Email</label>
              <input
                className="in"
                type="email"
                placeholder="admin@nestmate.app"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
            </div>
            <div className="f" style={{ marginBottom: '20px' }}>
              <label>Password</label>
              <input
                className="in"
                type="password"
                placeholder="••••••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>
            <button className="btn pri" type="submit" disabled={isLoggingIn} style={{ width: '100%', height: '46px' }}>
              {isLoggingIn ? 'Authenticating...' : 'Sign In to Console'}
            </button>
          </form>

          <div style={{ textAlign: 'center', margin: '16px 0 12px', color: 'var(--ink2)', fontSize: '13px' }}>or continue with</div>

          <button
            className="btn gho"
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            style={{ width: '100%', height: '44px', display: 'flex', gap: '10px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            Sign in with Google
          </button>

          <div style={{ borderTop: '1px solid var(--line)', marginTop: '24px', paddingTop: '16px', textAlign: 'center' }}>
            <button className="bk" onClick={() => navigate('/explore')} style={{ justifyContent: 'center', border: 0, padding: '4px' }}>
              ← Return to NestMate
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Access Denied Screen (403 Forbidden)
  if (!isAdmin) {
    return (
      <div className="nm-admin-root" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: '24px' }}>
        <div className="cd" style={{ maxWidth: '440px', width: '100%', textAlign: 'center', padding: '36px 28px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: '#fde8e5',
              color: '#b42318',
              margin: '0 auto 18px',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <svg className="i" style={{ width: '32px', height: '32px' }} viewBox="0 0 24 24">
              <path d="M12 9v4m0 4h.01M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9z" />
            </svg>
          </div>
          <h2 style={{ fontSize: '22px', marginBottom: '8px' }}>Access Denied (403)</h2>
          <p className="s" style={{ marginBottom: '14px' }}>
            The account <b>{activeUser?.email}</b> is not authorized to access the NestMate Administration Console.
          </p>
          <div style={{ background: 'var(--sunk)', padding: '12px', borderRadius: '12px', fontSize: '13px', color: 'var(--ink2)', marginBottom: '22px' }}>
            Contact the system owner if you believe you should have moderator or administrator privileges.
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn gho" onClick={() => signOut(auth)} style={{ flex: 1 }}>
              Sign Out
            </button>
            <button className="btn pri" onClick={() => navigate('/explore')} style={{ flex: 1 }}>
              Back to App
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Counters
  const openReportsCount = reportsList.filter((r) => r.status === 'Open').length;
  const pendingVerifsCount = verificationsList.filter((v) => v.status.toLowerCase() === 'pending').length;
  const activeUsersCount = usersList.filter((u) => u.status === 'Active').length;
  const activeListingsCount = listingsList.filter((l) => l.status === 'Active').length;

  // View Title
  const viewTitles: { [key: string]: string } = {
    dash: 'Dashboard',
    reports: 'Reports',
    verif: 'Verifications',
    users: 'Users',
    listings: 'Listings',
    market: 'Marketplace',
    notif: 'Notifications',
    settings: 'Settings',
  };

  // ----------------- SUB-VIEWS -----------------

  const renderDashboardView = () => {
    const topReports = reportsList
      .filter((r) => r.status === 'Open')
      .sort((a, b) => (a.priority === 'High' ? -1 : 1))
      .slice(0, 3);
    const topVerifs = verificationsList.filter((v) => v.status.toLowerCase() === 'pending').slice(0, 3);

    return (
      <>
        <div className="kp">
          <button className="k hot" data-n="reports">
            <small>Open reports</small>
            <b>{openReportsCount}</b>
            <span>Review these first</span>
          </button>
          <button className="k hot" data-n="verif">
            <small>Pending verifications</small>
            <b>{pendingVerifsCount}</b>
            <span>Waiting for a decision</span>
          </button>
          <button className="k" data-n="users">
            <small>Active users</small>
            <b>{activeUsersCount}</b>
            <span>of {usersList.length} accounts</span>
          </button>
          <button className="k" data-n="listings">
            <small>Active listings</small>
            <b>{activeListingsCount}</b>
            <span>of {listingsList.length} total</span>
          </button>
        </div>

        <div className="g2">
          <div>
            <div className="cd">
              <h2>Needs your attention</h2>
              <div className="s">Oldest and highest priority moderation tasks first.</div>
              {topReports.length > 0 || topVerifs.length > 0 ? (
                <>
                  {topReports.map((r) => (
                    <div className="row" key={r.id} data-i={`r:${r.id}`} style={{ cursor: 'pointer' }}>
                      <div>
                        <b>{r.reason}</b>
                        <small>
                          {r.targetType} report · {r.when}
                        </small>
                      </div>
                      <div dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(bd(r.priority)) }} />
                      <button className="btn gho" data-i={`r:${r.id}`}>
                        Review
                      </button>
                    </div>
                  ))}
                  {topVerifs.map((v) => (
                    <div className="row" key={v.id} data-i={`v:${v.id}`} style={{ cursor: 'pointer' }}>
                      <div>
                        <b>ID verification: {v.userName}</b>
                        <small>
                          {v.docType} · submitted {v.submitted}
                        </small>
                      </div>
                      <button className="btn gho" data-i={`v:${v.id}`}>
                        Review
                      </button>
                    </div>
                  ))}
                </>
              ) : (
                <div className="em">
                  <b>All clear</b>
                  No open moderation tasks.
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="cd">
              <h2>Sign-ups, last 14 days</h2>
              <div className="s">New accounts created per day</div>
              <div dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(renderSparkline()) }} />
            </div>

            <div className="cd">
              <h2>Recent activity</h2>
              <div className="s" style={{ marginBottom: '6px' }}>
                Latest application events
              </div>
              {usersList.slice(0, 4).map((u, idx) => (
                <div className="row" key={idx}>
                  <div>{u.name} joined as {u.role.toLowerCase()}</div>
                  <small>{u.joined}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderUsersView = () => {
    const q = (searchQueries.u || '').toLowerCase();
    const f = filters.u || 'All';
    const filtered = usersList.filter((u) => {
      if (f !== 'All' && u.status !== f) return false;
      if (q && !(u.name + ' ' + u.email).toLowerCase().includes(q)) return false;
      return true;
    });

    return (
      <>
        <div className="tl">
          <div className="sr">
            <span dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(P('<circle cx="11" cy="11" r="6.500"/><path d="m16 16 4.500 4.500"/>')) }} />
            <input data-q="u" placeholder="Search name or email" defaultValue={searchQueries.u} aria-label="Search" />
          </div>
          <div className="chs">
            {['All', 'Active', 'Suspended', 'Banned'].map((x) => (
              <button key={x} className="chip" data-fl="u" data-v={x} aria-pressed={f === x}>
                {x}
              </button>
            ))}
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th>Role</th>
                  <th>ID</th>
                  <th>Joined</th>
                  <th>Reports</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} data-i={`u:${u.id}`}>
                    <td>
                      <div className="u">
                        <i>{ini(u.name)}</i>
                        <div>
                          <b>{u.name}</b>
                          <small>{u.email}</small>
                        </div>
                      </div>
                    </td>
                    <td dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(bd(u.status)) }} />
                    <td>{u.role}</td>
                    <td>
                      {u.isVerified ? (
                        <span style={{ color: 'var(--ok)', fontWeight: 600 }}>✓ Verified</span>
                      ) : (
                        <span style={{ color: 'var(--ink2)' }}>Not yet</span>
                      )}
                    </td>
                    <td>{u.joined}</td>
                    <td>{u.reportsCount || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="em">
            <b>Nothing here</b>
            No users match your search or filter.
          </div>
        )}
      </>
    );
  };

  const renderListingsView = () => {
    const q = (searchQueries.l || '').toLowerCase();
    const f = filters.l || 'All';
    const filtered = listingsList.filter((l) => {
      if (f !== 'All' && l.status !== f) return false;
      if (q && !(l.title + ' ' + l.locality + ' ' + l.ownerName).toLowerCase().includes(q)) return false;
      return true;
    });

    return (
      <>
        <div className="tl">
          <div className="sr">
            <span dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(P('<circle cx="11" cy="11" r="6.500"/><path d="m16 16 4.500 4.500"/>')) }} />
            <input data-q="l" placeholder="Search title, locality or owner" defaultValue={searchQueries.l} aria-label="Search" />
          </div>
          <div className="chs">
            {['All', 'Active', 'Paused', 'Filled', 'Flagged'].map((x) => (
              <button key={x} className="chip" data-fl="l" data-v={x} aria-pressed={f === x}>
                {x}
              </button>
            ))}
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Listing</th>
                  <th>Status</th>
                  <th>Rent</th>
                  <th>Owner</th>
                  <th>Locality</th>
                  <th>Reports</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} data-i={`l:${l.id}`}>
                    <td>
                      <b>{l.title}</b>
                      <div style={{ color: 'var(--ink2)', fontSize: '13px' }}>{l.locality}</div>
                    </td>
                    <td dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(bd(l.status)) }} />
                    <td>{fmt(l.rent)}</td>
                    <td>{l.ownerName}</td>
                    <td>{l.locality}</td>
                    <td>{l.reportsCount || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="em">
            <b>Nothing here</b>
            No listings match your search or filter.
          </div>
        )}
      </>
    );
  };

  const renderReportsView = () => {
    const q = (searchQueries.r || '').toLowerCase();
    const f = filters.r || 'All';
    const filtered = reportsList.filter((r) => {
      if (f !== 'All' && r.status !== f) return false;
      if (q && !r.reason.toLowerCase().includes(q)) return false;
      return true;
    });

    return (
      <>
        <div className="tl">
          <div className="sr">
            <span dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(P('<circle cx="11" cy="11" r="6.500"/><path d="m16 16 4.500 4.500"/>')) }} />
            <input data-q="r" placeholder="Search reports" defaultValue={searchQueries.r} aria-label="Search" />
          </div>
          <div className="chs">
            {['All', 'Open', 'In review', 'Resolved', 'Dismissed'].map((x) => (
              <button key={x} className="chip" data-fl="r" data-v={x} aria-pressed={f === x}>
                {x}
              </button>
            ))}
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Target Type</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} data-i={`r:${r.id}`}>
                    <td>
                      <b>{r.reason}</b>
                      <div style={{ color: 'var(--ink2)', fontSize: '13px' }}>
                        {r.targetType} report · {r.when}
                      </div>
                    </td>
                    <td dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(bd(r.status)) }} />
                    <td dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(bd(r.priority)) }} />
                    <td>{r.targetType}</td>
                    <td>{r.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="em">
            <b>Nothing here</b>
            No reports match your criteria.
          </div>
        )}
      </>
    );
  };

  const renderVerificationsView = () => {
    const q = (searchQueries.v || '').toLowerCase();
    const f = filters.v || 'All';
    const filtered = verificationsList.filter((v) => {
      if (f !== 'All' && v.status !== f) return false;
      if (q && !(v.userName + ' ' + v.userEmail).toLowerCase().includes(q)) return false;
      return true;
    });

    return (
      <>
        <div className="tl">
          <div className="sr">
            <span dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(P('<circle cx="11" cy="11" r="6.500"/><path d="m16 16 4.500 4.500"/>')) }} />
            <input data-q="v" placeholder="Search name or email" defaultValue={searchQueries.v} aria-label="Search" />
          </div>
          <div className="chs">
            {['All', 'Pending', 'Approved', 'Rejected'].map((x) => (
              <button key={x} className="chip" data-fl="v" data-v={x} aria-pressed={f === x}>
                {x}
              </button>
            ))}
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Document Type</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.id} data-i={`v:${v.id}`}>
                    <td>
                      <div className="u">
                        <i>{ini(v.userName)}</i>
                        <div>
                          <b>{v.userName}</b>
                          <small>{v.userEmail}</small>
                        </div>
                      </div>
                    </td>
                    <td dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(bd(v.status)) }} />
                    <td>{v.submitted}</td>
                    <td>{v.docType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="em">
            <b>Nothing here</b>
            No identity verifications match.
          </div>
        )}
      </>
    );
  };

  const renderMarketplaceView = () => {
    // Calculate locality supply from real listings
    const localityCounts: { [key: string]: { count: number; rentSum: number; rents: number[] } } = {};
    const defaultLocalities = ['Koramangala', 'Indiranagar', 'HSR Layout', 'BTM Layout', 'Whitefield', 'Bellandur', 'Marathahalli', 'JP Nagar'];

    defaultLocalities.forEach((loc) => {
      localityCounts[loc] = { count: 0, rentSum: 0, rents: [] };
    });

    listingsList.forEach((l) => {
      const loc = defaultLocalities.find((dl) => l.locality.toLowerCase().includes(dl.toLowerCase())) || 'Other';
      if (!localityCounts[loc]) {
        localityCounts[loc] = { count: 0, rentSum: 0, rents: [] };
      }
      localityCounts[loc].count++;
      if (l.rent) {
        localityCounts[loc].rents.push(l.rent);
        localityCounts[loc].rentSum += l.rent;
      }
    });

    // Calculate seeker demand from real users preferred localities
    const localityDemand: { [key: string]: number } = {};
    defaultLocalities.forEach((loc) => (localityDemand[loc] = 0));
    usersList.forEach((u) => {
      if (u.preferredLocalities && u.preferredLocalities.length > 0) {
        u.preferredLocalities.forEach((pl: string) => {
          const loc = defaultLocalities.find((dl) => pl.toLowerCase().includes(dl.toLowerCase())) || 'Other';
          localityDemand[loc] = (localityDemand[loc] || 0) + 1;
        });
      } else {
        // baseline natural seeker interest distribution
        localityDemand['Koramangala'] = (localityDemand['Koramangala'] || 0) + 1;
      }
    });

    const marketRows = defaultLocalities.map((loc) => {
      const supply = Math.max(1, localityCounts[loc]?.count || 0);
      const demand = Math.max(2, localityDemand[loc] || 0);
      const rents = localityCounts[loc]?.rents || [];
      const medianRent = rents.length > 0 ? rents.sort((a, b) => a - b)[Math.floor(rents.length / 2)] : 14500;
      return { locality: loc, supply, demand, medianRent, ratio: demand / supply };
    });

    const maxVal = Math.max(...marketRows.map((r) => Math.max(r.supply, r.demand)), 10);
    const topDemand = [...marketRows].sort((a, b) => b.ratio - a.ratio)[0];

    const healthCounts = {
      Active: listingsList.filter((l) => l.status === 'Active').length,
      Paused: listingsList.filter((l) => l.status === 'Paused').length,
      Filled: listingsList.filter((l) => l.status === 'Filled').length,
      Flagged: listingsList.filter((l) => l.status === 'Flagged').length,
    };

    return (
      <>
        <div className="g2b">
          <div className="cd">
            <h2>Highest demand per listing</h2>
            <div className="s">Where seekers outnumber places the most.</div>
            <b style={{ fontSize: '28px', letterSpacing: '-0.02em', color: 'var(--brand)' }}>{topDemand.locality}</b>
            <div style={{ color: 'var(--ink2)' }}>{topDemand.ratio.toFixed(1)} seekers for every listing</div>
          </div>

          <div className="cd">
            <h2>Listing health</h2>
            <div className="s">Current status of all verified rooms.</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {(['Active', 'Paused', 'Filled', 'Flagged'] as const).map((st) => (
                <div key={st} style={{ flex: 1, minWidth: '80px' }}>
                  <b style={{ fontSize: '26px' }}>{healthCounts[st]}</b>
                  <div dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(bd(st)) }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="cd">
          <h2>Supply and demand by locality</h2>
          <div className="s">Listings (grey) against seekers searching (orange), with median rent.</div>
          {marketRows.map((m) => (
            <div className="mr" key={m.locality}>
              <b>{m.locality}</b>
              <div>
                <div className="bar2 s" style={{ marginBottom: '5px' }}>
                  <u style={{ width: `${(m.supply / maxVal) * 100}%` }}></u>
                </div>
                <div className="bar2">
                  <u style={{ width: `${(m.demand / maxVal) * 100}%` }}></u>
                </div>
              </div>
              <span style={{ textAlign: 'right', color: 'var(--ink2)' }}>{fmt(m.medianRent)}</span>
            </div>
          ))}
        </div>
      </>
    );
  };

  const renderNotificationsView = () => {
    const audience = chipsState.au || 'All users';


    return (
      <div className="g2">
        <div className="cd">
          <h2>New broadcast</h2>
          <div className="s">Sends an in-app notification to the active audience you choose.</div>

          <div className={`f ${formErrors.bt ? 'e' : ''}`}>
            <label>Title</label>
            <input
              className="in"
              data-f="bt"
              type="text"
              placeholder="e.g. New feature: Compare applicants side by side"
              defaultValue={formFields.bt || ''}
            />
            <div className="hp">Up to 60 characters.</div>
            <div className="er">{formErrors.bt}</div>
          </div>

          <div className={`f ${formErrors.bm ? 'e' : ''}`}>
            <label>Message</label>
            <textarea
              className="in"
              data-f="bm"
              placeholder="What do you want to inform verified members?"
              defaultValue={formFields.bm || ''}
            ></textarea>
            <div className="hp">10 to 240 characters.</div>
            <div className="er">{formErrors.bm}</div>
          </div>

          <div className="f">
            <label>Audience</label>
            <div className="chs">
              {['All users', 'Seekers', 'Owners'].map((x) => (
                <button key={x} className="chip" data-c="au" data-v={x} aria-pressed={audience === x}>
                  {x}
                </button>
              ))}
            </div>
            <div className="hp">Actual delivery counts appear in the delivery history.</div>
          </div>

          <button className="btn pri" data-b="rev" disabled={!BROADCAST_DELIVERY_AVAILABLE}>
            {BROADCAST_DELIVERY_AVAILABLE ? 'Review broadcast' : 'Broadcast delivery unavailable'}
          </button>
        </div>

        <div className="cd">
          <h2>Delivery history</h2>
          <button className="ghb" onClick={() => void loadAdminData()}>Refresh delivery status</button>
          <div className="s">Previous administrative broadcasts.</div>
          {broadcastsList.length > 0 ? (
            broadcastsList.map((b) => (
              <div className="row" key={b.id}>
                <div>
                  <b>{b.title}</b>
                  <div>{b.status || 'Legacy record'} - {b.delivered === null ? 'Delivery unknown' : b.delivered + ' delivered'}</div>
                  {BROADCAST_DELIVERY_AVAILABLE && b.status === 'failed' && <button className="ghb" onClick={async () => { try { await queueBroadcastBackend({action:'retry',requestId:b.id}); showToast('Delivery retry queued.'); await loadAdminData(); } catch(error) { showToast(error instanceof Error ? error.message : 'Could not queue delivery retry.'); } }}>Retry delivery</button>}
                  <small>
                    {b.audience} · {b.date}
                  </small>
                </div>
              </div>
            ))
          ) : (
            <div className="em">
              <b>No broadcasts yet</b>
              Broadcast history will appear here.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSettingsView = () => {
    const selectedRole = chipsState.rl || 'Moderator';

    return (
      <>
        <div className="g2b">
          <div className="cd">
            <h2>Administrators</h2>
            <div className="s">Team members with management access to this console.</div>
            {adminsList.map((a) => (
              <div className="row" key={a.id}>
                <div className="u">
                  <i>{ini(a.name)}</i>
                  <div>
                    <b>{a.name}</b>
                    <small>{a.email}</small>
                  </div>
                </div>
                <span className="bd2 n">{a.role}</span>
              </div>
            ))}
          </div>

          <div className="cd">
            <h2>Add administrator</h2>
            <div className="s">Add a team member to manage reports and verifications.</div>

            <div className={`f ${formErrors.ae ? 'e' : ''}`}>
              <label>Email</label>
              <input className="in" data-f="ae" type="email" placeholder="name@nestmate.app" defaultValue={formFields.ae || ''} />
              <div className="er">{formErrors.ae}</div>
            </div>

            <div className="f">
              <label>Role</label>
              <div className="chs">
                {['Moderator', 'Admin'].map((x) => (
                  <button key={x} className="chip" data-c="rl" data-v={x} aria-pressed={selectedRole === x}>
                    {x}
                  </button>
                ))}
              </div>
              <div className="hp">
                {selectedRole === 'Admin'
                  ? 'Admins can manage settings, roles, and all moderation queues.'
                  : 'Moderators can review reports, listings, and ID verifications.'}
              </div>
            </div>

            <button className="btn pri" data-b="add">
              Grant Role
            </button>
          </div>
        </div>

        <div className="cd" style={{ borderColor: '#f5c2bb', marginTop: '16px' }}>
          <h2 style={{ color: '#b42318' }}>Danger zone</h2>
          <div className="s">System-wide operational actions with confirmation gates.</div>
          <div className="row">
            <div>
              <b>Purge demo data</b>
              <small>Removes test accounts and placeholder records without affecting real users.</small>
            </div>
            <button className="btn gho" data-b="purge" style={{ color: '#b42318' }}>
              Purge demo data
            </button>
          </div>
          <div className="row">
            <div>
              <b>Factory reset</b>
              <small>Erases all sandbox test state and returns the application to fresh initialization.</small>
            </div>
            <button className="btn dg" data-b="reset">
              Factory reset
            </button>
          </div>
        </div>
      </>
    );
  };

  // -------------------------------------------------------------
  // MAIN RETURN
  // -------------------------------------------------------------

  return (
    <div className="nm-admin-root">
      {dataError && <div role="alert" style={{position:"fixed",top:8,left:"50%",transform:"translateX(-50%)",zIndex:100,background:"white",padding:12,border:"1px solid #d92d20",borderRadius:8}}>{dataError} <button className="ghb" onClick={() => void loadAdminData()}>Retry</button></div>}
      {/* Sidebar Navigation */}
      <aside className={`sd ${isMobileMenuOpen ? 'o' : ''}`} id="sd">
        <div className="lg">
          <i>
            <svg viewBox="0 0 24 24">
              <path d="M12 2.500 2.500 11H5v9h5.500v-6h3v6H19v-9h2.500z" />
            </svg>
          </i>
          NestMate<em>Admin</em>
        </div>

        <div className="gl">Overview</div>
        <button className="nv" data-n="dash" aria-current={nav === 'dash'}>
          <span dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(P('<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>')) }} />
          Dashboard
        </button>

        <div className="gl">Moderation</div>
        <button className="nv" data-n="reports" aria-current={nav === 'reports'}>
          <span dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(P('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>')) }} />
          Reports
          {openReportsCount > 0 && <span className="n">{openReportsCount}</span>}
        </button>
        <button className="nv" data-n="verif" aria-current={nav === 'verif'}>
          <span dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(P('<path d="M12 3 4.500 6v6c0 4.500 3.200 7.700 7.500 9 4.300-1.300 7.500-4.500 7.500-9V6z"/><path d="m9 12 2 2 4-4"/>')) }} />
          Verifications
          {pendingVerifsCount > 0 && <span className="n">{pendingVerifsCount}</span>}
        </button>

        <div className="gl">Community</div>
        <button className="nv" data-n="users" aria-current={nav === 'users'}>
          <span dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(P('<circle cx="9" cy="8" r="3.500"/><path d="M2.500 20c.6-3.600 3.200-5.500 6.500-5.500s5.900 1.900 6.500 5.500M16 5a3.500 3.500 0 0 1 0 6.500M18 14.700c1.800.7 3 2.400 3.500 5.300"/>')) }} />
          Users
        </button>
        <button className="nv" data-n="listings" aria-current={nav === 'listings'}>
          <span dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(P('<path d="M3 11 12 3l9 8v9H3z"/><path d="M9 20v-6h6v6"/>')) }} />
          Listings
        </button>
        <button className="nv" data-n="market" aria-current={nav === 'market'}>
          <span dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(P('<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>')) }} />
          Marketplace
        </button>

        <div className="gl">Communication</div>
        <button className="nv" data-n="notif" aria-current={nav === 'notif'}>
          <span dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(P('<path d="M6 17V11a6 6 0 0 1 12 0v6l1.500 2h-15zM10 21h4"/>')) }} />
          Notifications
        </button>

        <div className="gl">System</div>
        <button className="nv" data-n="settings" aria-current={nav === 'settings'}>
          <span dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(P('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.600 5.600l2.100 2.100M16.300 16.300l2.100 2.100M5.600 18.400l2.100-2.100M16.300 7.700l2.100-2.100"/>')) }} />
          Settings
        </button>

        <div className="sp"></div>
        <button className="bk" data-n="x">
          <span dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(P('<path d="m15 6-6 6 6 6"/>')) }} />
          Back to NestMate
        </button>
      </aside>

      {/* Main Top & Body */}
      <div className="mn">
        <header className="top">
          <button className="mb" data-m="1" aria-label="Menu">
            <svg className="i" viewBox="0 0 24 24">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <h1 id="ttl">{viewTitles[nav] || 'Dashboard'}</h1>
          <span className="env">{import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' ? 'Local emulators' : import.meta.env.MODE}</span>
          <span className="sp"></span>
          <div className="av" title={`${adminName} (${adminRole})`}>
            {ini(adminName)}
          </div>
        </header>

        <main className="pg" id="pg">
          {nav === 'dash' && renderDashboardView()}
          {nav === 'users' && renderUsersView()}
          {nav === 'listings' && renderListingsView()}
          {nav === 'reports' && renderReportsView()}
          {nav === 'verif' && renderVerificationsView()}
          {nav === 'market' && renderMarketplaceView()}
          {nav === 'notif' && renderNotificationsView()}
          {nav === 'settings' && renderSettingsView()}
        </main>
      </div>

      {/* Drawer Overlay & Slide-out Drawer */}
      <div className={`dov ${isDrawerOpen ? 'o' : ''}`} id="dov" onClick={closeDrawer}></div>
      <div className={`drw ${isDrawerOpen ? 'o' : ''}`} id="drw" role="dialog" aria-modal="true" aria-label="Details">
        <div className="dhd">
          <b id="dt">{drawerTitle}</b>
          <button className="x" data-x="1" aria-label="Close" onClick={closeDrawer}>
            <svg className="i" viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="db" id="db" dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(drawerBody) }}></div>
        <div className="df" id="df" dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(drawerFooter) }}></div>
      </div>

      {/* Confirmation Modal */}
      <div className={`cfo ${cfmOpen ? 'o' : ''}`} id="cfo">
        <div className="cfm">
          <div id="cfb">
            <h3>{cfmTitle}</h3>
            <p dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(cfmPrompt) }}></p>
            {cfmTypeRequired && (
              <div className="f">
                <label>
                  Type <b>{cfmTypeRequired}</b> to confirm
                </label>
                <input
                  className="in"
                  id="cty"
                  autoComplete="off"
                  value={cfmTypedVal}
                  onChange={(e) => setCfmTypedVal(e.target.value)}
                />
              </div>
            )}
            <div className="r">
              <button className="btn gho" data-cf="no">
                Cancel
              </button>
              <button
                className={`btn ${cfmIsDanger ? 'dg' : 'pri'}`}
                data-cf="ok"
                id="cok"
                disabled={cfmTypeRequired !== null && cfmTypedVal !== cfmTypeRequired}
              >
                {cfmOkText}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      <div className={`toast ${isToastOpen ? 'o' : ''}`} id="tst">
        {toastMessage}
      </div>
    </div>
  );
}
