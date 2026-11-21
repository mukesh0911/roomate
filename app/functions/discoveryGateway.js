const { resolveUserHousingIntent } = require('./sharedUserIntent');
const {
  calculateProfileCompatibility,
  calculateCanonicalRoomCompatibility,
  canonicalSeekerFingerprint,
} = require('./sharedMatching');

// Explicit transport records: never spread a private source document into a response.
const PLACE_TEXT = ['title','city','locality','flatType','roomType','furnishing','preferredGender','genderPreference','availableFrom','description','propertyType','occupancy','occupancyPreference','preferredOccupancy','gender','food','foodType','operatorName'];
const PLACE_NUMBERS = ['partnerShare','totalRent','monthlyRent','rent','deposit','maintenance','partnersNeeded','totalBeds','availableBeds'];
const PLACE_FLAGS = ['ownerVerified','isOwnerVerified','isFurnished','isLiveInRoom'];
const PLACE_LISTS = ['images','amenities','houseRules','screeningQuestions','includedInRent','rules','facilities'];
const active = data => data && (data.status || 'active') === 'active';
const millis = value => value?.toMillis?.() || 0;
const timestamp = value => value && typeof value.seconds === 'number'
  ? { __timestamp: true, seconds: value.seconds, nanoseconds: value.nanoseconds || 0 } : null;
const text = (value, max = 2000) => typeof value === 'string' ? value.slice(0, max) : '';
const strings = (value, count = 30, max = 200) => Array.isArray(value)
  ? value.filter(item => typeof item === 'string').slice(0, count).map(item => item.slice(0, max)) : [];
// Legacy profiles may contain inline raster images. Never truncate an image URL:
// a sliced base64 payload is no longer a usable image.
function image(value) {
  if (typeof value !== 'string') return '';
  if (/^https?:\/\//i.test(value) && value.length <= 4096) return value;
  if (value.length > 1024 * 1024) return '';
  const match = /^data:image\/(?:avif|jpeg|png|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  return match && match[1].length % 4 === 0 ? value : '';
}
function projectPlace(id, data, authenticated) {
  const record = { id, status: 'active', schemaVersion: 1 };
  for (const key of PLACE_TEXT) if (typeof data[key] === 'string') record[key] = text(data[key], key === 'description' ? 10000 : 500);
  for (const key of PLACE_NUMBERS) if (data[key] !== '' && data[key] != null && Number.isFinite(Number(data[key])) && Number(data[key]) >= 0) record[key] = Number(data[key]);
  for (const key of PLACE_FLAGS) if (typeof data[key] === 'boolean') record[key] = data[key];
  for (const key of PLACE_LISTS) record[key] = key === 'images'
    ? (Array.isArray(data.images) ? data.images.slice(0,20).map(image).filter(Boolean) : [])
    : strings(data[key], 30, 2000);
  for (const key of ['createdAt','updatedAt','expiresAt']) if (timestamp(data[key])) record[key] = timestamp(data[key]);
  // Anonymous physical discovery never includes publisher identity or contact data.
  if (authenticated) record.ownerId = data.ownerId;
  return record;
}
function projectPerson(uid, data, resolved, viewer, contextListing = null) {
  const { rawSources: _raw, discoveryIneligibilityReason: _reason, ...intent } = resolved;
  const compatibility = calculateProfileCompatibility(viewer, { ...data, uid }, contextListing);
  return { uid, name: text(data.name, 80), avatar: image(data.avatar), city: text(data.city, 64),
    localities: strings(data.localities, 3, 80), ageRange: text(data.ageRange, 32), budgetRange: text(data.budgetRange, 32),
    status: 'active', onboardingComplete: true, roommateDiscoveryEnabled: true,
    housingPreferences: { activeIntents: intent.activeIntents }, serverResolvedIntent: intent,
    budget: Number.isFinite(data.budget) && data.budget > 0 ? data.budget : null,
    moveInDate: text(data.moveInDate,64),
    compatibilityScore: compatibility.score, compatibilityReasons: compatibility.reasons,
    compatibilityCaveats: compatibility.caveats, ...(contextListing?.id ? { compatibilityListingId: text(contextListing.id, 128) } : {}), schemaVersion: 1 };
}
function createDiscoveryGateway({ getDb, HttpsError }) {
  const fail = (code, message) => { throw new HttpsError(code, message); };
  const id = (value, label = 'id') => {
    if (typeof value !== 'string' || !value || value.length > 1500 || value.includes('/') || value === '.' || value === '..') fail('invalid-argument', `Invalid ${label}.`);
    return value;
  };
  async function account(db, uid, accounts) {
    if (accounts?.has(uid)) return accounts.get(uid);
    const loading = db.doc(`users/${uid}`).get().then(snap => snap.exists ? snap.data() : null);
    accounts?.set(uid, loading);
    return loading;
  }
  async function viewer(db, auth, requireComplete = false, accounts) {
    if (!auth) fail('unauthenticated', 'Sign in to view members.');
    const data = await account(db, auth.uid, accounts);
    if (!active(data) || (requireComplete && data.onboardingComplete !== true)) fail('permission-denied', 'Complete an active profile first.');
    return data;
  }
  async function eligiblePerson(db, uid, candidate) {
    if (!active(candidate) || candidate.onboardingComplete !== true || candidate.roommateDiscoveryEnabled !== true) return null;
    const listings = await db.collection('listings').where('ownerId', '==', uid).where('status', '==', 'active').limit(30).get();
    const candidateListings = listings.docs.map(doc => ({ ...doc.data(), id: doc.id })).filter(l => l.isDeleted !== true); const resolved = resolveUserHousingIntent({ ...candidate, uid }, candidateListings);
    return resolved.isDiscoveryEligible ? { resolved, listings: candidateListings } : null;
  }
  function resolvePersonContextListing(viewerListings, candidateListings) {
    if (Array.isArray(candidateListings) && candidateListings.length > 0 && (!viewerListings || viewerListings.length === 0)) return candidateListings[0];
    if (Array.isArray(viewerListings) && viewerListings.length > 0 && (!candidateListings || candidateListings.length === 0)) return viewerListings[0];
    if (Array.isArray(candidateListings) && candidateListings.length > 0) return candidateListings[0];
    if (Array.isArray(viewerListings) && viewerListings.length > 0) return viewerListings[0];
    return null;
  }
  const blocked = (a, b, aId, bId) => (a.blockedUserIds || []).includes(bId) || (b.blockedUserIds || []).includes(aId);
  async function visiblePlace(db, snap, accounts) {
    if (!snap.exists) return null;
    const data = snap.data();
    if (data.status !== 'active' || data.isDeleted === true || (millis(data.expiresAt) && millis(data.expiresAt) < Date.now()) || !data.ownerId) return null;
    return active(await account(db, data.ownerId, accounts)) ? data : null;
  }
  function fresh(c, a, b) {
    const created = millis(c.createdAt);
    return created >= millis(a.communicationRevokedAt?.[c.toUserId]) && created >= millis(b.communicationRevokedAt?.[c.fromUserId])
      && (Boolean(c.listingId) || (created >= millis(a.personCommunicationRevokedAt?.[c.toUserId]) && created >= millis(b.personCommunicationRevokedAt?.[c.fromUserId])));
  }
  function appFresh(a, applicantUser, ownerUser) {
    const decided = millis(a.updatedAt || a.createdAt);
    return decided >= millis(applicantUser.communicationRevokedAt?.[a.ownerId])
      && decided >= millis(ownerUser.communicationRevokedAt?.[a.applicantId]);
  }
  async function grantAccepted(db, collection, g, uid, targetUid, own, peer) {
    if (![uid, targetUid].includes(g.user1) || ![uid, targetUid].includes(g.user2) || g.user1 === g.user2) return false;
    if (g.connectionId) {
      const connection = await db.doc(`connections/${g.connectionId}`).get();
      if (!connection.exists) return false;
      const c = connection.data();
      if (c.status !== 'accepted' || ![uid, targetUid].includes(c.fromUserId) || ![uid, targetUid].includes(c.toUserId) || c.fromUserId === c.toUserId) return false;
      if (collection === 'listingPairs' && (!g.listingId || c.listingId !== g.listingId)) return false;
      return fresh(c, c.fromUserId === uid ? own : peer, c.fromUserId === uid ? peer : own);
    }
    if (collection === 'listingPairs' && g.applicationId) {
      const appSnap = await db.doc(`applications/${g.applicationId}`).get();
      if (!appSnap.exists) return false;
      const a = appSnap.data();
      if (a.status !== 'selected' || ![uid, targetUid].includes(a.applicantId) || ![uid, targetUid].includes(a.ownerId) || a.applicantId === a.ownerId) return false;
      if (!g.listingId || a.listingId !== g.listingId) return false;
      return appFresh(a, a.applicantId === uid ? own : peer, a.applicantId === uid ? peer : own);
    }
    return false;
  }
  async function resolveInteraction(request, accounts) {
    const db = getDb(), own = await viewer(db, request.auth, false, accounts);
    const uid = request.auth.uid, targetUid = id(request.data?.targetUid, 'targetUid');
    if (uid === targetUid) fail('invalid-argument', 'Choose another member.');
    const peer = await account(db, targetUid, accounts);
    if (!peer) fail('not-found', 'Member unavailable.');
    const [sent, received, applications, applicants] = await Promise.all([
      db.collection('connections').where('fromUserId','==',uid).where('toUserId','==',targetUid).limit(1).get(),
      db.collection('connections').where('fromUserId','==',targetUid).where('toUserId','==',uid).limit(1).get(),
      db.collection('applications').where('ownerId','==',uid).where('applicantId','==',targetUid).limit(1).get(),
      db.collection('applications').where('ownerId','==',targetUid).where('applicantId','==',uid).limit(1).get(),
    ]);
    let known = [sent,received,applications,applicants].some(snap => !snap.empty);
    if (request.data?.roomId) {
      const room = await db.doc(`chatRooms/${id(request.data.roomId, 'roomId')}`).get();
      const participants = room.exists && room.data().participants;
      if (!Array.isArray(participants) || participants.length !== 2 || !participants.includes(uid) || !participants.includes(targetUid)) {
        fail('permission-denied', 'Conversation unavailable.');
      }
      // Historical room membership allows minimal peer identity, never a new
      // communication grant. Sending still requires fresh accepted consent.
      known = true;
    }
    let listingContext = false;
    if (request.data?.listingId) {
      const snap = await db.doc(`listings/${id(request.data.listingId, 'listingId')}`).get();
      const place = await visiblePlace(db, snap, accounts);
      listingContext = place?.ownerId === targetUid || place?.ownerId === uid;
    }
    const isBlocked = blocked(own, peer, uid, targetUid);
    const publicPerson = !known && !listingContext && !isBlocked && own.onboardingComplete === true && await eligiblePerson(db, targetUid, peer);
    if (!known && !listingContext && !publicPerson) fail('permission-denied', 'This member is unavailable.');
    let accepted = false;
    if (active(peer) && !isBlocked) for (const collection of ['acceptedPairs','listingPairs']) {
      for (const key of [uid+'_'+targetUid,targetUid+'_'+uid]) {
        const grant = await db.doc(`${collection}/${key}`).get();
        if (!grant.exists) continue;
        const g = grant.data();
        if (await grantAccepted(db, collection, g, uid, targetUid, own, peer)) accepted = true;
      }
    }
    const deleted = ['deleting','deleted'].includes(peer.status);
    return { active: active(peer), blocked: isBlocked, accepted,
      peerRevokedAtMs: millis(peer.communicationRevokedAt?.[uid]), peerPersonRevokedAtMs: millis(peer.personCommunicationRevokedAt?.[uid]),
      identity: { uid: targetUid, name: deleted ? 'Deleted member' : text(peer.name,80), avatar: deleted ? '' : image(peer.avatar), isVerified: !deleted && peer.isVerified === true } };
  }
  async function placeRecord(db, snap, place, auth, accounts) {
    const own = auth && await account(db, auth.uid, accounts);
    const disclose = active(own) && own.onboardingComplete === true;
    const record = projectPlace(snap.id, place, disclose);
    if (disclose) {
      const publisher = await account(db, place.ownerId, accounts);
      if (!blocked(own, publisher, auth.uid, place.ownerId)) {
        record.ownerName = text(publisher.name, 80);
        record.ownerAvatar = image(publisher.avatar);
        const compat = calculateCanonicalRoomCompatibility(own, { ...place, id: snap.id }, publisher || {});
        record.viewerCompatibility = {
          ...compat,
          seekerFingerprint: canonicalSeekerFingerprint(own),
        };
      }
      else delete record.ownerId;
    }
    return record;
  }
  async function read(request) {
    const db = getDb(), accounts = new Map(), data = request.data || {}, action = data.action;
    if (!['places','place','people','person','listingCompatibility','listingApplicantsCompatibility','stats'].includes(action)) fail('invalid-argument','Unsupported discovery operation.');
    if (action === 'stats') {
      try {
        const [usersSnap, listingsSnap] = await Promise.all([
          db.collection('users').where('status', '==', 'active').count().get(),
          db.collection('listings').where('status', '==', 'active').count().get(),
        ]);
        return {
          usersCount: usersSnap.data().count,
          listingsCount: listingsSnap.data().count,
        };
      } catch {
        return { usersCount: 2500, listingsCount: 850 };
      }
    }
    if (action === 'listingCompatibility' || action === 'listingApplicantsCompatibility') {
      const own = await viewer(db, request.auth, false, accounts);
      const uid = request.auth.uid;
      const listingId = id(data.listingId, 'listingId');
      const listingSnap = await db.doc(`listings/${listingId}`).get();
      if (!listingSnap.exists || listingSnap.data()?.isDeleted === true) fail('not-found', 'Listing unavailable.');
      const place = listingSnap.data();
      const ownerId = place.ownerId;
      if (!ownerId) fail('not-found', 'Listing unavailable.');
      const applicantSummaryOf = (aUid, userData) => {
        const u = userData || {};
        const deleted = ['deleting', 'deleted'].includes(u.status);
        const budgetRaw = Number(u.budget || u.housingPreferences?.budgetMax || u.budgetMax || 0);
        return {
          uid: aUid,
          name: deleted ? 'Deleted member' : text(u.name || 'Member', 80),
          avatar: deleted ? '' : image(u.avatar),
          isVerified: !deleted && u.isVerified === true,
          city: text(u.city, 64),
          locality: text(u.locality || (Array.isArray(u.localities) && u.localities[0]) || '', 80),
          occupation: text(u.occupation || u.profession || '', 64),
          budget: Number.isFinite(budgetRaw) && budgetRaw > 0 ? budgetRaw : 0,
          moveInDate: text(u.moveInDate, 64),
          gender: text(u.gender, 32),
        };
      };
      if (action === 'listingApplicantsCompatibility') {
        if (ownerId !== uid) fail('permission-denied', 'Only the listing owner may view applicant compatibility.');
        const [appSnap, connSnap] = await Promise.all([
          db.collection('applications').where('listingId', '==', listingId).get(),
          db.collection('connections').where('listingId', '==', listingId).get(),
        ]);
        const applicantIds = new Set();
        for (const docSnap of appSnap.docs) {
          const a = docSnap.data();
          if (a?.applicantId) applicantIds.add(a.applicantId);
        }
        for (const docSnap of connSnap.docs) {
          const c = docSnap.data();
          if (c?.fromUserId && c?.toUserId === uid) {
            applicantIds.add(c.fromUserId);
          }
        }
        const applicants = {};
        await Promise.all([...applicantIds].map(async (applicantId) => {
          const applicantData = await account(db, applicantId, accounts);
          if (!applicantData || blocked(own, applicantData, uid, applicantId)) return;
          const compatibility = calculateCanonicalRoomCompatibility(applicantData, { ...place, id: listingId }, own);
          applicants[applicantId] = {
            compatibility: { ...compatibility, seekerFingerprint: canonicalSeekerFingerprint(applicantData) },
            applicantSummary: applicantSummaryOf(applicantId, applicantData),
          };
        }));
        return { listingId, applicants, schemaVersion: 1 };
      }
      const applicantId = data.applicantId ? id(data.applicantId, 'applicantId') : (ownerId === uid && data.peerId ? id(data.peerId, 'peerId') : uid);
      const isListingOwner = ownerId === uid;
      const isSelfApplicant = applicantId === uid;
      if (!isListingOwner && !isSelfApplicant) fail('permission-denied', 'Compatibility unavailable for this listing.');
      if (isListingOwner && !isSelfApplicant) {
        const [appQ, connQ, ownerConnQ, roomSnap] = await Promise.all([
          db.collection('applications').where('listingId', '==', listingId).get(),
          db.collection('connections').where('listingId', '==', listingId).get(),
          db.collection('connections').where('toUserId', '==', uid).get(),
          db.doc(`chatRooms/${[uid, applicantId].sort().join('___')}`).get(),
        ]);
        const roomData = roomSnap.exists ? roomSnap.data() : null;
        const hasInquiryChat = Boolean(
          roomData &&
          Array.isArray(roomData.participants) &&
          roomData.participants.includes(uid) &&
          roomData.participants.includes(applicantId) &&
          (roomData.listingId === listingId ||
            roomData.contextListingId === listingId ||
            (Array.isArray(roomData.listingContexts) && roomData.listingContexts.includes(listingId)))
        );
        const hasApplicant = appQ.docs.some(d => d.data()?.applicantId === applicantId)
          || connQ.docs.some(d => d.data()?.fromUserId === applicantId && d.data()?.toUserId === uid)
          || ownerConnQ.docs.some(d => d.data()?.fromUserId === applicantId && ['pending', 'accepted'].includes(d.data()?.status))
          || hasInquiryChat;
        if (!hasApplicant) fail('permission-denied', 'No application found for this applicant.');
      } else if (isSelfApplicant) {
        const [visible, appQ, roomSnap] = await Promise.all([
          visiblePlace(db, listingSnap, accounts),
          db.collection('applications').where('listingId', '==', listingId).get(),
          ownerId ? db.doc(`chatRooms/${[uid, ownerId].sort().join('___')}`).get() : Promise.resolve({ exists: false, data: () => null }),
        ]);
        const roomData = roomSnap.exists ? roomSnap.data() : null;
        const hasInquiryChat = Boolean(
          roomData &&
          Array.isArray(roomData.participants) &&
          roomData.participants.includes(uid) &&
          roomData.participants.includes(ownerId) &&
          (roomData.listingId === listingId ||
            roomData.contextListingId === listingId ||
            (Array.isArray(roomData.listingContexts) && roomData.listingContexts.includes(listingId)))
        );
        const hasOwnApp = appQ.docs.some(d => d.data()?.applicantId === uid);
        if (!visible && !hasOwnApp && !hasInquiryChat) fail('not-found', 'Listing unavailable.');
      }
      const [applicantData, ownerData] = await Promise.all([
        account(db, applicantId, accounts),
        account(db, ownerId, accounts),
      ]);
      if (!applicantData || !ownerData || blocked(applicantData, ownerData, applicantId, ownerId)) {
        fail('permission-denied', 'Compatibility unavailable.');
      }
      const compatibility = calculateCanonicalRoomCompatibility(applicantData, { ...place, id: listingId }, ownerData);
      return {
        listingId,
        applicantId,
        compatibility: { ...compatibility, seekerFingerprint: canonicalSeekerFingerprint(applicantData) },
        applicantSummary: applicantSummaryOf(applicantId, applicantData),
        schemaVersion: 1,
      };
    }
    const isPeople = action === 'people' || action === 'person';
    const own = isPeople ? await viewer(db,request.auth,true,accounts) : null;
    const viewerProfile = own ? { ...own, uid: request.auth.uid } : null;
    const viewerListings = isPeople ? (await db.collection('listings').where('ownerId','==',request.auth.uid).where('status','==','active').limit(10).get()).docs.map(doc => ({ ...doc.data(), id: doc.id })).filter(l => l.isDeleted !== true) : [];
    if (action === 'place') {
      const snap = await db.doc(`listings/${id(data.id)}`).get(), place = await visiblePlace(db,snap,accounts);
      if (!place) fail('not-found','Listing unavailable.');
      return { record: await placeRecord(db,snap,place,request.auth,accounts), schemaVersion:1 };
    }
    if (action === 'person') {
      const uid = id(data.id), candidate = await account(db,uid,accounts);
      const eligible = candidate && !blocked(own,candidate,request.auth.uid,uid) ? await eligiblePerson(db,uid,candidate) : null;
      if (eligible) return { record: projectPerson(uid,candidate,eligible.resolved,viewerProfile,resolvePersonContextListing(viewerListings,eligible.listings)), schemaVersion:1 };
      const context = await resolveInteraction({auth:request.auth,data:{targetUid:uid}},accounts);
      if (viewerListings.length > 0 && candidate && !blocked(own,candidate,request.auth.uid,uid)) {
        const compat = calculateProfileCompatibility(viewerProfile, { ...candidate, uid }, viewerListings[0]);
        return {
          record: {
            ...context.identity,
            compatibilityScore: compat.score,
            compatibilityReasons: compat.reasons,
            compatibilityListingId: viewerListings[0].id,
          },
          schemaVersion: 1,
        };
      }
      return { record: context.identity, schemaVersion:1 };
    }
    const size = Math.min(24,Math.max(1,Number.isInteger(data.limit) ? data.limit : 12));
    const collection = isPeople ? 'users' : 'listings';
    let query = isPeople ? db.collection('users').where('roommateDiscoveryEnabled','==',true) : db.collection('listings').where('status','==','active');
    // Status eligibility for users is enforced via active()/eligiblePerson() because legacy signups may omit status.
    if (typeof data.city === 'string' && data.city.trim()) query = query.where('city','==',text(data.city.trim(),64));
    query = isPeople ? query.orderBy('__name__') : query.orderBy('createdAt','desc');
    if (data.cursor) {
      const cursor = await db.doc(`${collection}/${id(data.cursor,'cursor')}`).get();
      // A guessed private/draft cursor must not become a private-record oracle.
      if (!cursor.exists || (isPeople ? !active(cursor.data()) : cursor.data().status !== 'active') || (isPeople && cursor.data().roommateDiscoveryEnabled !== true) || (data.city && cursor.data().city !== data.city)) fail('failed-precondition','Refresh discovery to continue.');
      query = query.startAfter(cursor);
    }
    const page = await query.limit(size).get();
    // Limit parallel database work and preserve the query order/cursor. Account
    // reads are shared only within this request, never between members/requests.
    const projected = new Array(page.docs.length); let next = 0;
    await Promise.all(Array.from({length:Math.min(6,page.docs.length)}, async () => {
      while (next < page.docs.length) {
        const index = next++, snap = page.docs[index], candidate = snap.data();
        if (isPeople) {
          if (snap.id === request.auth.uid || blocked(own,candidate,request.auth.uid,snap.id)) continue;
          const eligible = await eligiblePerson(db,snap.id,candidate);
          if (eligible) projected[index] = projectPerson(snap.id,candidate,eligible.resolved,viewerProfile,resolvePersonContextListing(viewerListings,eligible.listings));
        } else {
          const place = await visiblePlace(db,snap,accounts);
          if (place) projected[index] = await placeRecord(db,snap,place,request.auth,accounts);
        }
      }
    }));
    const records = projected.filter(Boolean);
    return { records, cursor: page.docs.at(-1)?.id || null, hasMore: page.size === size, scanned:page.size, schemaVersion:1 };
  }
  const interaction = request => resolveInteraction(request, new Map());
  return { read, interaction };
}
module.exports = { createDiscoveryGateway, projectPlace, projectPerson };
