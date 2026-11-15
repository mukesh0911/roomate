const { calculateCanonicalRoomCompatibility, COMPATIBILITY_ENGINE_VERSION } = require('./sharedMatching');

const cleanId = (value, label = 'id') => {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s || s.includes('/') || s.length > 128) throw new Error(`Invalid ${label}.`);
  return s;
};

const cleanText = (value, max = 2000) => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
};

const deterministicRoomId = (a, b) => [a, b].sort().join('___');
const isActiveUser = (user) => !!user && (user.status || 'active') === 'active';
const isPairBlocked = (a, b, uidA, uidB) =>
  (Array.isArray(a?.blockedUserIds) && a.blockedUserIds.includes(uidB)) ||
  (Array.isArray(b?.blockedUserIds) && b.blockedUserIds.includes(uidA));

const OWNER_TRANSITIONS = {
  pending: ['shortlisted', 'selected', 'rejected'],
  shortlisted: ['selected', 'rejected'],
  selected: ['rejected'],
};

const APPLICANT_TRANSITIONS = {
  pending: ['withdrawn'],
  shortlisted: ['withdrawn'],
  selected: ['withdrawn', 'declined_by_applicant'],
};

function sanitizeListingSnapshot(listingId, place) {
  const image =
    typeof place?.image === 'string' && place.image
      ? place.image
      : Array.isArray(place?.images) && typeof place.images[0] === 'string'
        ? place.images[0]
        : '';
  return {
    id: listingId,
    title: cleanText(place?.title || place?.name || 'Room listing', 160) || 'Room listing',
    rent: Number(place?.partnerShare || place?.monthlyRent || place?.rent || place?.totalRent || place?.price || 0) || 0,
    deposit: Number(place?.deposit || 0) || 0,
    locality: cleanText(place?.locality || place?.location || '', 120),
    city: cleanText(place?.city || '', 80),
    image: typeof image === 'string' ? image.slice(0, 1024) : '',
    roomType: cleanText(place?.roomType || '', 64),
    ownerId: typeof place?.ownerId === 'string' ? place.ownerId : '',
    available: place?.status === 'active' && place?.isDeleted !== true,
  };
}

function buildApplicationCardPayload({
  applicationId,
  listingId,
  listingSnapshot,
  applicantId,
  ownerId,
  applicantData,
  moveIn,
  note,
  questions,
  submittedAnswers,
  matchScore,
  matchReasons,
  scoringVersion = COMPATIBILITY_ENGINE_VERSION,
  status,
  declineReason = '',
}) {
  return {
    applicationId,
    listingId,
    listingTitle: listingSnapshot.title,
    listingRent: listingSnapshot.rent,
    listingLocality: listingSnapshot.locality,
    listingImage: listingSnapshot.image,
    applicantId,
    ownerId,
    applicantName: cleanText(applicantData?.name || 'Member', 80) || 'Member',
    applicantAvatar: typeof applicantData?.avatar === 'string' ? applicantData.avatar.slice(0, 1024) : '',
    applicantVerified: applicantData?.isVerified === true,
    applicantRole: cleanText(applicantData?.occupation || applicantData?.profession || '', 64),
    applicantBudget: Number(applicantData?.budget || applicantData?.housingPreferences?.budgetMax || applicantData?.budgetMax || 0) || 0,
    moveIn,
    note,
    answers: submittedAnswers,
    questions,
    matchScore,
    matchReasons,
    scoringVersion,
    status,
    declineReason,
  };
}

function safeMatchSummary(applicantData, place, ownerData) {
  try {
    const res = calculateCanonicalRoomCompatibility(applicantData || {}, place || {}, ownerData || {});
    return {
      score: Number.isFinite(res?.score) ? Math.max(0, Math.min(100, Math.round(res.score))) : 0,
      reasons: Array.isArray(res?.reasons) ? res.reasons.slice(0, 4).map((r) => cleanText(String(r), 120)).filter(Boolean) : [],
      scoringVersion: res?.engineVersion || COMPATIBILITY_ENGINE_VERSION,
    };
  } catch {
    return { score: 0, reasons: [], scoringVersion: COMPATIBILITY_ENGINE_VERSION };
  }
}

const VALID_DECISION_STATUSES = new Set(['shortlisted', 'selected', 'rejected', 'withdrawn', 'declined_by_applicant']);

function createApplicationChatService({ getDb, fieldValue, HttpsError }) {
  const fail = (code, message) => {
    throw new HttpsError(code, message);
  };

  function validateId(value, label) {
    try {
      return cleanId(value, label);
    } catch {
      fail('invalid-argument', `Valid ${label} is required.`);
    }
  }

  function hasOtherActiveCommunicationGrant(lpA, lpB, apA, apB, excludedAppId) {
    const lpValid = (snap) => {
      if (!snap?.exists) return false;
      const d = snap.data() || {};
      if (d.applicationId && d.applicationId === excludedAppId) return false;
      return Boolean(d.connectionId || d.applicationId);
    };
    const apValid = (snap) => snap?.exists && Boolean(snap.data()?.connectionId);
    return lpValid(lpA) || lpValid(lpB) || apValid(apA) || apValid(apB);
  }

  async function submitRoomApplication(request) {
    const uid = request.auth?.uid;
    if (!uid) fail('unauthenticated', 'Sign in to apply.');

    const data = request.data || {};
    const listingId = validateId(data.listingId, 'listingId');
    const rawAnswers = data.answers && typeof data.answers === 'object' ? data.answers : {};
    const cleanNote = cleanText(data.note || '', 2000);
    const cleanMoveIn = cleanText(data.moveIn || '', 64);

    const db = getDb();
    const listingRef = db.doc(`listings/${listingId}`);
    const applicantRef = db.doc(`users/${uid}`);
    const lockRef = db.doc(`applicationLocks/${listingId}___${uid}`);

    return db.runTransaction(async (tx) => {
      const [listingSnap, applicantSnap, lockSnap] = await Promise.all([
        tx.get(listingRef),
        tx.get(applicantRef),
        tx.get(lockRef),
      ]);

      if (!listingSnap.exists) fail('not-found', 'Listing unavailable.');
      const place = listingSnap.data() || {};
      const ownerId = typeof place.ownerId === 'string' ? place.ownerId : '';
      if (!ownerId) fail('failed-precondition', 'Listing unavailable.');
      if (ownerId === uid) fail('failed-precondition', 'You cannot apply to your own listing.');

      const ownerRef = db.doc(`users/${ownerId}`);
      const pairABRef = db.doc(`conversationPairs/${uid}___${ownerId}`);
      const pairBARef = db.doc(`conversationPairs/${ownerId}___${uid}`);
      const lpABRef = db.doc(`listingPairs/${uid}_${ownerId}`);
      const lpBARef = db.doc(`listingPairs/${ownerId}_${uid}`);
      const apABRef = db.doc(`acceptedPairs/${uid}_${ownerId}`);
      const apBARef = db.doc(`acceptedPairs/${ownerId}_${uid}`);

      const oldAppId = lockSnap.exists ? lockSnap.data()?.applicationId : '';
      const oldAppRef = oldAppId ? db.doc(`applications/${oldAppId}`) : null;

      const [ownerSnap, pairAB, pairBA, lpAB, lpBA, apAB, apBA, oldAppSnap] = await Promise.all([
        tx.get(ownerRef),
        tx.get(pairABRef),
        tx.get(pairBARef),
        tx.get(lpABRef),
        tx.get(lpBARef),
        tx.get(apABRef),
        tx.get(apBARef),
        oldAppRef ? tx.get(oldAppRef) : Promise.resolve(null),
      ]);

      if (
        place.status !== 'active' ||
        place.isDeleted === true ||
        !applicantSnap.exists ||
        !ownerSnap.exists ||
        !isActiveUser(applicantSnap.data()) ||
        !isActiveUser(ownerSnap.data()) ||
        isPairBlocked(applicantSnap.data(), ownerSnap.data(), uid, ownerId)
      ) {
        fail('failed-precondition', 'This listing cannot receive your application.');
      }

      let candidateRoomId =
        pairAB.exists && pairAB.data()?.roomId
          ? pairAB.data().roomId
          : pairBA.exists && pairBA.data()?.roomId
            ? pairBA.data().roomId
            : deterministicRoomId(uid, ownerId);

      const candidateRoomRef = db.doc(`chatRooms/${candidateRoomId}`);
      const candidateRoomSnap = await tx.get(candidateRoomRef);

      const roomHasMatchingParticipants = (snap) => {
        if (!snap.exists) return true;
        const p = snap.data()?.participants;
        return Array.isArray(p) && p.length === 2 && p.includes(uid) && p.includes(ownerId);
      };

      const roomRef = roomHasMatchingParticipants(candidateRoomSnap)
        ? candidateRoomRef
        : db.collection('chatRooms').doc();
      const roomId = roomRef.id;
      const roomSnap = roomId === candidateRoomId ? candidateRoomSnap : { exists: false, data: () => ({}) };

      const alreadyUnlocked = Boolean(
        (roomSnap.exists && roomSnap.data()?.unlocked === true) ||
          hasOtherActiveCommunicationGrant(lpAB, lpBA, apAB, apBA, '')
      );
      const bucket = alreadyUnlocked ? 'chats' : 'requests';
      const listingSnapshot = sanitizeListingSnapshot(listingId, place);
      const questions = Array.isArray(place.screeningQuestions)
        ? place.screeningQuestions.map((q) => cleanText(String(q || ''), 300)).filter(Boolean)
        : [];

      // Idempotent guard if applicant already has an active application for this room.
      if (oldAppSnap?.exists && ['pending', 'shortlisted', 'selected'].includes(oldAppSnap.data()?.status)) {
        const oldData = oldAppSnap.data() || {};
        const oldStatus = oldData.status;
        const existingRoomId = oldData.roomId || roomId;
        const existingCardRef = db.doc(`chatRooms/${existingRoomId}/messages/app_${oldAppSnap.id}_card`);
        const existingCardSnap = existingRoomId === roomId ? await tx.get(existingCardRef) : null;
        const oldUnlocked = Boolean(alreadyUnlocked || oldStatus === 'selected');
        const oldBucket = oldUnlocked ? 'chats' : 'requests';

        // Backfill chat card seamlessly if the active application predates chat-first threads.
        if (existingCardSnap && !existingCardSnap.exists) {
          const now = fieldValue.serverTimestamp();
          const backfillMatch = safeMatchSummary(applicantSnap.data(), place, ownerSnap.data());
          const backfillPayload = buildApplicationCardPayload({
            applicationId: oldAppSnap.id,
            listingId,
            listingSnapshot,
            applicantId: uid,
            ownerId,
            applicantData: applicantSnap.data(),
            moveIn: cleanText(oldData.moveIn || '', 64),
            note: cleanText(oldData.note || '', 2000),
            questions,
            submittedAnswers: oldData.screeningAnswers || {},
            matchScore: oldData.matchScore ?? backfillMatch.score,
            matchReasons: oldData.matchReasons || backfillMatch.reasons,
            status: oldStatus,
          });
          const summaryText = `Applied for ${listingSnapshot.title}`.slice(0, 200);
          tx.set(pairABRef, { participants: [uid, ownerId], roomId: existingRoomId }, { merge: true });
          tx.set(pairBARef, { participants: [ownerId, uid], roomId: existingRoomId }, { merge: true });
          tx.set(
            db.doc(`chatRooms/${existingRoomId}`),
            {
              participants: [uid, ownerId],
              listingId,
              contextListingId: listingId,
              listingContexts: Array.from(new Set([...(roomSnap.data()?.listingContexts || []), listingId])),
              listingSnapshot,
              threadType: 'application',
              latestApplicationId: oldAppSnap.id,
              latestApplicationStatus: oldStatus,
              applicantId: uid,
              ownerId,
              unlocked: oldUnlocked,
              inboxBucketByUser: { [uid]: oldBucket, [ownerId]: oldBucket },
              lastMessage: summaryText,
              lastMessageId: `app_${oldAppSnap.id}_card`,
              lastMessageType: 'application_card',
              lastMessageAt: now,
              updatedAt: now,
            },
            { merge: true }
          );
          tx.set(existingCardRef, {
            senderId: uid,
            kind: 'application_card',
            content: summaryText,
            imagePath: '',
            applicationId: oldAppSnap.id,
            listingId,
            payload: backfillPayload,
            read: false,
            createdAt: now,
          });
          tx.update(oldAppRef, { roomId: existingRoomId, updatedAt: now });
        }

        return {
          applicationId: oldAppSnap.id,
          roomId: existingRoomId,
          status: oldStatus,
          unlocked: oldUnlocked,
          inboxBox: oldBucket,
          alreadyExists: true,
        };
      }

      const submittedAnswers = Object.fromEntries(questions.map((q) => [q, cleanText(rawAnswers[q] || '', 2000)]));
      if (questions.some((q) => !submittedAnswers[q] || submittedAnswers[q].length > 2000)) {
        fail('invalid-argument', 'Answer every screening question (up to 2000 characters each).');
      }

      const match = safeMatchSummary(applicantSnap.data(), place, ownerSnap.data());
      const applicationRef = db.collection('applications').doc();
      const applicationId = applicationRef.id;
      const cardMessageId = `app_${applicationId}_card`;
      const messageRef = db.doc(`chatRooms/${roomId}/messages/${cardMessageId}`);
      const notifRef = db.doc(`notifications/${applicationId}_pending`);
      const now = fieldValue.serverTimestamp();

      const cardPayload = buildApplicationCardPayload({
        applicationId,
        listingId,
        listingSnapshot,
        applicantId: uid,
        ownerId,
        applicantData: applicantSnap.data(),
        moveIn: cleanMoveIn,
        note: cleanNote,
        questions,
        submittedAnswers,
        matchScore: match.score,
        matchReasons: match.reasons,
        status: 'pending',
      });

      const summaryText = `Applied for ${listingSnapshot.title}`.slice(0, 200);
      const prevRoom = roomSnap.exists ? roomSnap.data() || {} : {};
      const prevUnread = prevRoom.unreadBy || {};
      const prevContexts = Array.isArray(prevRoom.listingContexts) ? prevRoom.listingContexts : [];
      const listingContexts = Array.from(new Set([...prevContexts, listingId]));

      tx.set(applicationRef, {
        listingId,
        applicantId: uid,
        ownerId,
        roomId,
        status: 'pending',
        listingVersion: place.updatedAt || place.createdAt || null,
        screeningAnswers: submittedAnswers,
        ...(cleanNote ? { note: cleanNote } : {}),
        ...(cleanMoveIn ? { moveIn: cleanMoveIn } : {}),
        matchScore: match.score,
        matchReasons: match.reasons,
        scoringVersion: match.scoringVersion,
        createdAt: now,
        updatedAt: now,
      });

      tx.set(lockRef, { listingId, applicantId: uid, applicationId });
      tx.set(pairABRef, { participants: [uid, ownerId], roomId }, { merge: true });
      tx.set(pairBARef, { participants: [ownerId, uid], roomId }, { merge: true });

      tx.set(
        roomRef,
        {
          participants: Array.isArray(prevRoom.participants) && prevRoom.participants.length === 2 ? prevRoom.participants : [uid, ownerId],
          listingId,
          contextListingId: listingId,
          listingContexts,
          listingSnapshot,
          threadType: 'application',
          latestApplicationId: applicationId,
          latestApplicationStatus: 'pending',
          applicantId: uid,
          ownerId,
          unlocked: alreadyUnlocked,
          inboxBucketByUser: {
            [uid]: bucket,
            [ownerId]: bucket,
          },
          lastMessage: summaryText,
          lastMessageId: cardMessageId,
          lastMessageType: 'application_card',
          lastMessageAt: now,
          unreadBy: {
            ...prevUnread,
            [ownerId]: (Number(prevUnread[ownerId]) || 0) + 1,
          },
          ...(roomSnap.exists ? {} : { createdAt: now }),
          updatedAt: now,
        },
        { merge: true }
      );

      tx.set(messageRef, {
        senderId: uid,
        kind: 'application_card',
        content: summaryText,
        imagePath: '',
        applicationId,
        listingId,
        payload: cardPayload,
        read: false,
        createdAt: now,
      });

      const applicantLabel = cleanText(applicantSnap.data()?.name || 'A member', 80) || 'A member';
      const noteSnippet = cleanNote ? (cleanNote.length > 140 ? `${cleanNote.slice(0, 137)}...` : cleanNote) : '';
      const notifDesc =
        [cleanMoveIn ? `Move-in: ${cleanMoveIn}` : '', noteSnippet].filter(Boolean).join(' · ') ||
        `${applicantLabel} applied to ${listingSnapshot.title}.`;

      tx.set(notifRef, {
        userId: ownerId,
        actorId: uid,
        type: 'application',
        title: 'New room application',
        description: notifDesc.slice(0, 500),
        applicationId,
        listingId,
        roomId,
        inboxBox: bucket,
        actionUrl: `/messages?box=${bucket}&chat=${encodeURIComponent(roomId)}&app=${encodeURIComponent(applicationId)}`,
        read: false,
        createdAt: now,
      });

      return {
        applicationId,
        roomId,
        status: 'pending',
        unlocked: alreadyUnlocked,
        inboxBox: bucket,
        alreadyExists: false,
      };
    });
  }

  async function decideRoomApplication(request) {
    const uid = request.auth?.uid;
    if (!uid) fail('unauthenticated', 'Sign in required.');

    const data = request.data || {};
    const applicationId = validateId(data.applicationId, 'applicationId');
    const nextStatus = typeof data.nextStatus === 'string' ? data.nextStatus.trim() : '';
    if (!VALID_DECISION_STATUSES.has(nextStatus)) {
      fail('invalid-argument', 'Valid application decision status is required.');
    }
    const cleanReason = cleanText(data.reason || '', 240);

    const db = getDb();
    const appRef = db.doc(`applications/${applicationId}`);

    return db.runTransaction(async (tx) => {
      const appSnap = await tx.get(appRef);
      if (!appSnap.exists) fail('not-found', 'Application not found.');
      const app = appSnap.data() || {};
      const isOwner = app.ownerId === uid;
      const isApplicant = app.applicantId === uid;
      if (!isOwner && !isApplicant) fail('permission-denied', 'Not authorized.');

      if (app.status === nextStatus) {
        const roomFallback = app.roomId || deterministicRoomId(app.applicantId, app.ownerId);
        return {
          applicationId,
          status: nextStatus,
          roomId: roomFallback,
          unlocked: nextStatus === 'selected',
          inboxBox: nextStatus === 'selected' ? 'chats' : ['rejected', 'withdrawn', 'declined_by_applicant'].includes(nextStatus) ? 'closed' : 'requests',
          alreadyInState: true,
        };
      }

      const allowed = isOwner ? OWNER_TRANSITIONS[app.status] : APPLICANT_TRANSITIONS[app.status];
      if (!allowed || !allowed.includes(nextStatus)) {
        fail('failed-precondition', 'This application changed or the action is not permitted. Refresh and try again.');
      }

      const listingRef = db.doc(`listings/${app.listingId}`);
      const ownerRef = db.doc(`users/${app.ownerId}`);
      const applicantRef = db.doc(`users/${app.applicantId}`);
      const pairABRef = db.doc(`conversationPairs/${app.applicantId}___${app.ownerId}`);
      const pairBARef = db.doc(`conversationPairs/${app.ownerId}___${app.applicantId}`);
      const lpABRef = db.doc(`listingPairs/${app.applicantId}_${app.ownerId}`);
      const lpBARef = db.doc(`listingPairs/${app.ownerId}_${app.applicantId}`);
      const apABRef = db.doc(`acceptedPairs/${app.applicantId}_${app.ownerId}`);
      const apBARef = db.doc(`acceptedPairs/${app.ownerId}_${app.applicantId}`);

      const [listingSnap, ownerSnap, applicantSnap, pairAB, pairBA, lpAB, lpBA, apAB, apBA] = await Promise.all([
        tx.get(listingRef),
        tx.get(ownerRef),
        tx.get(applicantRef),
        tx.get(pairABRef),
        tx.get(pairBARef),
        tx.get(lpABRef),
        tx.get(lpBARef),
        tx.get(apABRef),
        tx.get(apBARef),
      ]);

      const ownerData = ownerSnap.exists ? ownerSnap.data() : {};
      const applicantData = applicantSnap.exists ? applicantSnap.data() : {};

      if (nextStatus === 'selected') {
        if (
          !ownerSnap.exists ||
          !applicantSnap.exists ||
          !isActiveUser(ownerData) ||
          !isActiveUser(applicantData) ||
          isPairBlocked(ownerData, applicantData, app.ownerId, app.applicantId)
        ) {
          fail('failed-precondition', 'Cannot open communication because one account is unavailable or blocked.');
        }
      }

      const roomId =
        app.roomId ||
        (pairAB.exists && pairAB.data()?.roomId) ||
        (pairBA.exists && pairBA.data()?.roomId) ||
        deterministicRoomId(app.applicantId, app.ownerId);

      const roomRef = db.doc(`chatRooms/${roomId}`);
      const cardRef = db.doc(`chatRooms/${roomId}/messages/app_${applicationId}_card`);
      const [roomSnap, cardSnap] = await Promise.all([tx.get(roomRef), tx.get(cardRef)]);

      const now = fieldValue.serverTimestamp();
      const hasOtherGrant = hasOtherActiveCommunicationGrant(lpAB, lpBA, apAB, apBA, applicationId);
      const isTerminal = ['rejected', 'withdrawn', 'declined_by_applicant'].includes(nextStatus);
      const unlocked = nextStatus === 'selected' ? true : isTerminal ? hasOtherGrant : Boolean(roomSnap.exists && roomSnap.data()?.unlocked === true) || hasOtherGrant;
      const bucket = nextStatus === 'selected' ? 'chats' : isTerminal ? (hasOtherGrant ? 'chats' : 'closed') : (unlocked ? 'chats' : 'requests');

      if (nextStatus === 'selected') {
        tx.set(lpABRef, {
          user1: app.applicantId,
          user2: app.ownerId,
          listingId: app.listingId,
          applicationId,
          grantedAt: now,
        });
        tx.set(lpBARef, {
          user1: app.ownerId,
          user2: app.applicantId,
          listingId: app.listingId,
          applicationId,
          grantedAt: now,
        });
      } else if (isTerminal) {
        if (lpAB.exists && lpAB.data()?.applicationId === applicationId) tx.delete(lpABRef);
        if (lpBA.exists && lpBA.data()?.applicationId === applicationId) tx.delete(lpBARef);
      }

      const ownerName = cleanText(ownerData?.name || 'Host', 80) || 'Host';
      const applicantName = cleanText(applicantData?.name || 'Applicant', 80) || 'Applicant';

      const sysMessages = {
        shortlisted: `Host shortlisted ${applicantName}'s application`,
        selected: `${ownerName} accepted ${applicantName}'s application — messaging is now open`,
        rejected: cleanReason ? `Application declined · ${cleanReason}` : 'Application was declined by the host',
        withdrawn: `${applicantName} withdrew the application`,
        declined_by_applicant: `${applicantName} declined the selection offer`,
      };
      const sysText = sysMessages[nextStatus];
      const sysMsgId = `sys_${applicationId}_${nextStatus}`;
      const sysMsgRef = db.doc(`chatRooms/${roomId}/messages/${sysMsgId}`);

      const place = listingSnap.exists ? listingSnap.data() || {} : {};
      const listingSnapshot = roomSnap.exists && roomSnap.data()?.listingSnapshot?.title
        ? roomSnap.data().listingSnapshot
        : sanitizeListingSnapshot(app.listingId, place);

      tx.set(pairABRef, { participants: [app.applicantId, app.ownerId], roomId }, { merge: true });
      tx.set(pairBARef, { participants: [app.ownerId, app.applicantId], roomId }, { merge: true });

      if (cardSnap.exists) {
        tx.update(cardRef, {
          'payload.status': nextStatus,
          ...(cleanReason ? { 'payload.declineReason': cleanReason } : {}),
          updatedAt: now,
        });
      } else {
        const questions = Array.isArray(place.screeningQuestions)
          ? place.screeningQuestions.map((q) => cleanText(String(q || ''), 300)).filter(Boolean)
          : Object.keys(app.screeningAnswers || {});
        const backfillMatch = safeMatchSummary(applicantData, place, ownerData);
        tx.set(cardRef, {
          senderId: app.applicantId,
          kind: 'application_card',
          content: `Applied for ${listingSnapshot.title}`.slice(0, 200),
          imagePath: '',
          applicationId,
          listingId: app.listingId,
          payload: buildApplicationCardPayload({
            applicationId,
            listingId: app.listingId,
            listingSnapshot,
            applicantId: app.applicantId,
            ownerId: app.ownerId,
            applicantData,
            moveIn: cleanText(app.moveIn || '', 64),
            note: cleanText(app.note || '', 2000),
            questions,
            submittedAnswers: app.screeningAnswers || {},
            matchScore: app.matchScore ?? backfillMatch.score,
            matchReasons: app.matchReasons || backfillMatch.reasons,
            status: nextStatus,
            declineReason: cleanReason,
          }),
          read: true,
          createdAt: app.createdAt || now,
        });
      }

      tx.set(sysMsgRef, {
        senderId: 'system',
        actorId: uid,
        kind: 'system_event',
        content: sysText,
        imagePath: '',
        applicationId,
        listingId: app.listingId,
        payload: {
          event: nextStatus,
          applicationId,
          listingId: app.listingId,
          reason: cleanReason,
          actorRole: isOwner ? 'host' : 'applicant',
        },
        read: false,
        createdAt: now,
      });

      const recipientUid = isOwner ? app.applicantId : app.ownerId;
      const prevRoom = roomSnap.exists ? roomSnap.data() || {} : {};
      const prevUnread = prevRoom.unreadBy || {};
      const prevContexts = Array.isArray(prevRoom.listingContexts) ? prevRoom.listingContexts : [];
      const listingContexts = Array.from(new Set([...prevContexts, app.listingId]));

      tx.set(
        roomRef,
        {
          participants: Array.isArray(prevRoom.participants) && prevRoom.participants.length === 2
            ? prevRoom.participants
            : [app.applicantId, app.ownerId],
          listingId: app.listingId,
          contextListingId: app.listingId,
          listingContexts,
          listingSnapshot,
          threadType: 'application',
          latestApplicationId: applicationId,
          latestApplicationStatus: nextStatus,
          applicantId: app.applicantId,
          ownerId: app.ownerId,
          unlocked,
          inboxBucketByUser: {
            [app.applicantId]: bucket,
            [app.ownerId]: bucket,
          },
          lastMessage: sysText,
          lastMessageId: sysMsgId,
          lastMessageType: 'system_event',
          lastMessageAt: now,
          unreadBy: {
            ...prevUnread,
            [recipientUid]: (Number(prevUnread[recipientUid]) || 0) + 1,
          },
          ...(roomSnap.exists ? {} : { createdAt: now }),
          updatedAt: now,
        },
        { merge: true }
      );

      tx.update(appRef, {
        status: nextStatus,
        roomId,
        ...(cleanReason ? { decisionReason: cleanReason } : {}),
        updatedAt: now,
      });

      const notificationTitles = {
        shortlisted: 'Application shortlisted',
        selected: 'Application accepted! Start chatting',
        rejected: 'Application declined',
        withdrawn: 'Application withdrawn',
        declined_by_applicant: 'Selection offer declined',
      };
      const notificationDescriptions = {
        shortlisted: `${ownerName} shortlisted your application for ${listingSnapshot.title}.`,
        selected: `${ownerName} accepted your application for ${listingSnapshot.title} — open Inbox to chat.`,
        rejected: cleanReason
          ? `${ownerName} declined your application (${cleanReason}).`
          : `${ownerName} declined your application for ${listingSnapshot.title}.`,
        withdrawn: `${applicantName} withdrew their application for ${listingSnapshot.title}.`,
        declined_by_applicant: `${applicantName} declined the selection offer for ${listingSnapshot.title}.`,
      };

      tx.set(db.doc(`notifications/${applicationId}_${nextStatus}`), {
        userId: recipientUid,
        actorId: uid,
        type: 'application',
        title: notificationTitles[nextStatus],
        description: notificationDescriptions[nextStatus].slice(0, 500),
        applicationId,
        listingId: app.listingId,
        roomId,
        inboxBox: bucket,
        actionUrl: `/messages?box=${bucket}&chat=${encodeURIComponent(roomId)}&app=${encodeURIComponent(applicationId)}`,
        read: false,
        createdAt: now,
      });

      return {
        applicationId,
        status: nextStatus,
        roomId,
        unlocked,
        inboxBox: bucket,
        alreadyInState: false,
      };
    });
  }

  async function syncCompatibilityForEntity({ userId = '', listingId = '' } = {}) {
    const db = getDb();
    const activeStatuses = ['pending', 'shortlisted', 'selected'];
    const appDocs = new Map();
    if (listingId) {
      const snap = await db.collection('applications').where('listingId', '==', listingId).get();
      for (const d of snap.docs) {
        if (activeStatuses.includes(d.data()?.status)) appDocs.set(d.id, d);
      }
    }
    if (userId) {
      const [asApplicant, asOwner] = await Promise.all([
        db.collection('applications').where('applicantId', '==', userId).get(),
        db.collection('applications').where('ownerId', '==', userId).get(),
      ]);
      for (const d of [...asApplicant.docs, ...asOwner.docs]) {
        if (activeStatuses.includes(d.data()?.status)) appDocs.set(d.id, d);
      }
    }
    if (!appDocs.size) return { updated: 0 };

    const users = new Map();
    const listings = new Map();
    const loadUser = async (uid) => {
      if (!uid) return null;
      if (!users.has(uid)) users.set(uid, db.doc(`users/${uid}`).get().then((s) => (s.exists ? s.data() : null)));
      return users.get(uid);
    };
    const loadListing = async (id) => {
      if (!id) return null;
      if (!listings.has(id)) listings.set(id, db.doc(`listings/${id}`).get().then((s) => (s.exists ? s.data() : null)));
      return listings.get(id);
    };

    let updated = 0;
    const now = fieldValue.serverTimestamp();
    await Promise.all([...appDocs.values()].map(async (appDoc) => {
      const app = appDoc.data() || {};
      const [applicantData, ownerData, place] = await Promise.all([
        loadUser(app.applicantId),
        loadUser(app.ownerId),
        loadListing(app.listingId),
      ]);
      if (!applicantData || !place) return;
      const match = safeMatchSummary(applicantData, { ...place, id: app.listingId }, ownerData || {});
      const budget = Number(applicantData?.budget || applicantData?.housingPreferences?.budgetMax || applicantData?.budgetMax || 0) || 0;
      const snapshot = sanitizeListingSnapshot(app.listingId, place);

      await appDoc.ref.set(
        {
          matchScore: match.score,
          matchReasons: match.reasons,
          scoringVersion: match.scoringVersion,
          matchUpdatedAt: now,
        },
        { merge: true }
      );

      if (app.roomId) {
        const cardRef = db.doc(`chatRooms/${app.roomId}/messages/app_${appDoc.id}_card`);
        const cardSnap = await cardRef.get();
        if (cardSnap.exists) {
          const prevPayload = cardSnap.data()?.payload || {};
          await cardRef.set(
            {
              payload: {
                ...prevPayload,
                listingTitle: snapshot.title,
                listingRent: snapshot.rent,
                listingLocality: snapshot.locality,
                listingImage: snapshot.image,
                listingSnapshot: snapshot,
                applicantBudget: budget,
                matchScore: match.score,
                matchReasons: match.reasons,
                scoringVersion: match.scoringVersion,
              },
            },
            { merge: true }
          );
        }
        if (listingId && app.listingId === listingId) {
          const roomRef = db.doc(`chatRooms/${app.roomId}`);
          const roomSnap = await roomRef.get();
          if (roomSnap.exists && roomSnap.data()?.listingId === listingId) {
            await roomRef.set({ listingSnapshot: snapshot }, { merge: true });
          }
        }
      }
      updated += 1;
    }));
    return { updated };
  }

  return { submitRoomApplication, decideRoomApplication, syncCompatibilityForEntity };
}

module.exports = { createApplicationChatService, sanitizeListingSnapshot };

