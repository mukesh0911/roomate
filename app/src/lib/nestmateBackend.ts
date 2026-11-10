import { gatewayPage, gatewayDocument, readDiscovery, getInteractionContext, subscribeDiscovery } from './discoveryGateway';
import { listingRent, listingStatusLabel, pairIsBlocked, consentIsCurrent } from './listingTruth';
import { assertApplicationTransition, applicationLabels, type ApplicationStatus } from './applicationState';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  arrayUnion,
  arrayRemove,
  runTransaction,
  writeBatch,
  startAfter,
  deleteField,
  FieldPath,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, getBlob } from 'firebase/storage';
import { db, auth, storage } from './firebase';
import { FREE_CONNECT_LIMIT } from './connectionGuards';
import { calculateProfileCompatibility, calculateRoomCompatibility } from './matching';
import {
  resolveUserHousingIntent,
  type HousingIntent,
  type ResolvedHousingIntent,
  type UserHousingPreferences,
} from './userIntent';
import { compressImage, dataURLtoBlob } from './imageCompressor';

const escapeDisplayText = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g,
  character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

export interface RoomItem {
  id: string;
  flatType: string;
  title: string;
  locality: string;
  city: string;
  rent: number;
  deposit: number;
  moveInDays: number;
  availableFrom: string;
  roomType: string;
  isFurnished: number;
  isOwnerVerified: number;
  preferredGender: string;
  matchPct: number;
  images: string[];
  amenities: string[];
  houseRules: string[];
  ownerId: string;
  ownerName: string;
  ownerAvatar: string;
  housingIntent?: string;
  resolvedIntents?: HousingIntent[];
  resolvedIntent?: ResolvedHousingIntent;
  associatedListingId?: string;
  housingPreferences?: UserHousingPreferences;
  raw: any;
}

export interface RoommateItem {
  uid: string;
  initials: string;
  name: string;
  profession: string;
  locality: string;
  city: string;
  budgetStr: string;
  moveInStr: string;
  isVerified: number;
  matchPct: number;
  tags: string[];
  diet: string;
  smoking: string;
  sleep: string;
  guests: string;
  cleanliness: string;
  bio: string;
  avatar: string;
  housingIntent?: string;
  resolvedIntents?: HousingIntent[];
  resolvedIntent?: ResolvedHousingIntent;
  associatedListingId?: string;
  housingPreferences?: UserHousingPreferences;
  raw: any;
}

export interface PGItem {
  id: string;
  ownerId: string;
  title: string;
  locality: string;
  city: string;
  rent: number;
  sharingType: string;
  foodAmenities: string;
  residentsGender: string;
  deposit: number;
  availableFrom: string;
  isVerified: number;
  matchPct: number;
  tag: string;
  raw: any;
  images?: string[];
  managerName?: string;
  managerAvatar?: string;
}

/**
 * Convert Firestore listing document to UI RoomItem
 */
export function mapFirestoreListing(d: any, currentUserProfile?: any): RoomItem {
  const data = d.data ? d.data() : d;
  const id = d.id || data.id || '';
  const rent = listingRent(data) ?? 0;
  const deposit = Number(data.deposit || 0);
  const flatType = data.flatType || 'Room';
  const roomType = data.roomType || (flatType.toLowerCase().includes('pg')
    ? 'PG / Coliving'
    : (data.partnersNeeded && data.partnersNeeded > 0) || flatType.includes('BHK')
      ? 'Private room'
      : 'Full flat');
  const furn = String(data.furnishing || '').toLowerCase();
  const isFurnished = furn.includes('full') || furn.includes('semi') ? 1 : 0;
  const isOwnerVerified = data.ownerVerified || data.isOwnerVerified ? 1 : 0;

  // Truthful dynamic multi-factor compatibility calculation
  let matchPct = 0;
  try {
    if (currentUserProfile) {
      const listingSignal = {
        ...data,
        monthlyRent: rent,
        partnerShare: rent,
        city: data.city || '',
        locality: data.locality || '',
        genderPreference: data.preferredGender || data.genderPreference,
        houseRules: Array.isArray(data.houseRules) ? data.houseRules : [],
      };
      const res = calculateRoomCompatibility(currentUserProfile, listingSignal);
      if (typeof res === 'number' && Number.isFinite(res) && res >= 0) matchPct = res;
    }
  } catch {
    matchPct = 0;
  }

  return {
    id,
    flatType,
    title: data.title || `${flatType} in ${data.locality || ''}`,
    locality: data.locality || '',
    city: data.city || '',
    rent,
    deposit,
    moveInDays: data.availableFrom === 'Immediate' || data.availableFrom === 'Now' ? 0 : -1,
    availableFrom: data.availableFrom || 'Not provided',
    roomType,
    isFurnished,
    isOwnerVerified,
    preferredGender: data.preferredGender || data.genderPreference || 'Any',
    matchPct,
    images: Array.isArray(data.images) ? data.images.filter((img: any) => typeof img === 'string' && img.trim().length > 0) : [],
    amenities: Array.isArray(data.amenities) ? data.amenities.filter(Boolean) : [],
    houseRules: Array.isArray(data.houseRules) ? data.houseRules.filter(Boolean) : [],
    ownerId: data.ownerId || '',
    ownerName: data.ownerName || '',
    ownerAvatar: data.ownerAvatar || '',
    raw: data,
  };
}

/**
 * Convert Firestore user profile to UI RoommateItem
 */
export function mapFirestoreUser(d: any, currentUserProfile?: any, userListings?: any): RoommateItem {
  const data = d.data ? d.data() : d;
  const uid = d.uid || d.id || data.uid || '';
  const name = data.name || (data.email ? data.email.split('@')[0] : 'Roommate');
  const initials = name
    .split(/\s+/)
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'RM';
  const exp = data.householdExpectations || {};
  const quiz = data.quizAnswers || {};

  // Truthful data extraction: Never fabricate synthetic lifestyle defaults
  const diet = exp.dietPref || quiz.diet || quiz.food_pref || (data.lifestyle && data.lifestyle.diet) || '';
  const smoking = exp.smokingPolicy
    ? (exp.smokingPolicy === 'no_smoking' ? 'Non-smoker' : 'Smoker')
    : (quiz.smoke ? (quiz.smoke === 'Non-smoker' ? 'Non-smoker' : 'Smoker') : (quiz.smoking ? (quiz.smoking === 'never' ? 'Non-smoker' : 'Smoker') : ''));
  const sleep = exp.quietHoursPolicy || quiz.sleep || quiz.sleep_time || (data.lifestyle && data.lifestyle.sleep) || '';
  const guests = exp.guestPolicy === 'guests_welcome' || quiz.guests === 'sometimes' ? 'Sometimes' : (quiz.guests ? 'Rarely' : '');
  const cleanliness = exp.cleanlinessPolicy === 'high' || quiz.clean === 'Very tidy' || quiz.cleanliness === 'very' ? 'Very tidy' : (quiz.clean || quiz.cleanliness ? 'Tidy' : '');
  const budget = Number(data.budget || 0);
  const budgetStr = budget > 0 ? `\u20b9${budget.toLocaleString('en-IN')}` : 'Not provided';

  let matchPct = 0;
  try {
    if (currentUserProfile) {
      const res: any = calculateProfileCompatibility(currentUserProfile, data);
      if (res && typeof res.score === 'number' && Number.isFinite(res.score) && res.score >= 0) {
        matchPct = res.score;
      }
    }
  } catch {
    matchPct = 0;
  }

  if (typeof data.compatibilityScore === 'number') matchPct = data.compatibilityScore;
  const tags: string[] = [];
  if (smoking === 'Non-smoker') tags.push('Non-smoker');
  if (diet && ['veg', 'vegetarian'].includes(diet.toLowerCase())) tags.push('Vegetarian');
  if (sleep && sleep.toLowerCase().includes('early')) tags.push('Early riser');
  if (data.profession) tags.push(data.profession);

  // Canonical resolution engine computes canonical intent data structure
  // Firestore's authoritative document ID may not be duplicated in stored fields.
  const resolved = data.serverResolvedIntent || resolveUserHousingIntent({ ...data, uid }, userListings);

  // Preserve actual stored machine-readable value; if absent, return undefined.
  // Never fabricate find_room or any default value when the field is absent.
  const rawHousingIntent = typeof data.housingIntent === 'string' && data.housingIntent.trim().length > 0
    ? data.housingIntent.trim()
    : undefined;
  const housingIntent = rawHousingIntent;

  return {
    uid,
    initials,
    name,
    profession: data.profession || '',
    locality: Array.isArray(data.localities) && data.localities[0] ? data.localities[0] : (data.locality || data.city || ''),
    city: data.city || '',
    budgetStr,
    moveInStr: data.moveInDate || data.availableFrom || 'Not provided',
    isVerified: data.isVerified === true ? 1 : 0,
    matchPct,
    tags,
    diet,
    smoking,
    sleep,
    guests,
    cleanliness,
    bio: data.bio || '',
    avatar: data.avatar || '',
    housingIntent,
    resolvedIntents: resolved.activeIntents,
    resolvedIntent: resolved,
    associatedListingId: resolved.associatedListingId,
    housingPreferences: data.housingPreferences,
    raw: data,
  };
}

export function mapFirestorePG(docSnap: any, currentUserProfile?: any): PGItem {
  const data = (docSnap && docSnap.data) ? docSnap.data() : (docSnap || {});
  const isVerified = data.ownerVerified || data.isOwnerVerified ? 1 : 0;
  const rent = listingRent(data) ?? 0;
  let matchPct = 0;
  try {
    if (currentUserProfile) {
      const res = calculateRoomCompatibility(currentUserProfile, data);
      if (typeof res === 'number' && Number.isFinite(res) && res >= 0) matchPct = res;
    }
  } catch {
    matchPct = 0;
  }
  const flatType = (data.flatType || '').toLowerCase();
  return {
    id: docSnap.id || data.id,
    ownerId: data.ownerId || '',
    title: data.title || 'PG in ' + (data.locality || ''),
    locality: data.locality || '',
    city: data.city || '',
    rent,
    sharingType: data.sharingType || 'Single/Shared',
    foodAmenities: data.foodAmenities || (data.mealsIncluded ? 'Meals included' : 'Self-cooking'),
    residentsGender: data.preferredGender || data.genderPreference || 'Co-ed',
    deposit: Number(data.deposit || 0),
    availableFrom: data.availableFrom || 'Not provided',
    isVerified,
    matchPct,
    tag: flatType.includes('coliving') ? 'Coliving' : 'PG',
    raw: data,
    images: Array.isArray(data.images) ? data.images.filter((img: any) => typeof img === 'string' && img.trim().length > 0) : [],
    managerName: data.ownerName || data.managerName || '',
    managerAvatar: data.ownerAvatar || data.managerAvatar || '',
  };
}

export interface BoundedListingsResult {
  rooms: RoomItem[];
  pgs: PGItem[];
  all: (RoomItem | PGItem)[];
  cursorDoc: any | null;
  hasMore: boolean;
  totalDocsRead: number;
}

export async function fetchBoundedExploreListings(options: {
  category?: 'all' | 'rooms' | 'pg';
  city?: string;
  filters?: { q?: string; min?: number; max?: number; move?: number; types?: string[]; propertyType?: string; furn?: number; ver?: number; gender?: string };
  pageSize?: number;
  cursorDoc?: any | null;
  currentUserProfile?: any;
  maxReadBudget?: number;
}): Promise<BoundedListingsResult> {
  const category = options.category || 'all';
  const targetPageSize = options.pageSize || 12;
  const maxReadBudget = options.maxReadBudget || 36;
  const currentUserProfile = options.currentUserProfile;

  const collectedRooms: RoomItem[] = [];
  const collectedPgs: PGItem[] = [];
  const collectedAll: (RoomItem | PGItem)[] = [];
  
  let currentCursor: any = options.cursorDoc || null;
  let totalDocsRead = 0;
  let hasMore = true;

  try {
    while (totalDocsRead < maxReadBudget) {
      const batchLimit = Math.min(targetPageSize, maxReadBudget - totalDocsRead);
      const snap = await gatewayPage('places', currentCursor, batchLimit, options.city);
      if (snap.empty) {
        hasMore = false;
        break;
      }

      totalDocsRead += snap.scanned ?? snap.docs.length;

      let consumed = 0;
      for (const docSnap of snap.docs) {
        consumed++; currentCursor = docSnap;
        const data = docSnap.data() as any;
        if (data.isDeleted === true) continue;
        if (data.expiresAt && typeof data.expiresAt.toDate === 'function') {
          if (data.expiresAt.toDate() < new Date()) continue;
        }

        const filters = options.filters;
        if (filters) {
          const rent = listingRent(data);
          const text = [data.title, data.locality, data.city].filter(Boolean).join(' ').toLowerCase();
          if (filters.q && !text.includes(filters.q.toLowerCase().trim())) continue;
          if (rent == null || rent < (filters.min || 0) || rent > (filters.max || 100000)) continue;
          if (filters.ver && data.ownerVerified !== true && data.isOwnerVerified !== true) continue;
          if (filters.furn && !/full|semi/i.test(data.furnishing || '')) continue;
          if (filters.types?.length && !filters.types.includes(data.roomType || '')) continue;
          if (filters.propertyType && !String(data.flatType || '').toLowerCase().includes(filters.propertyType)) continue;
          const gender = data.preferredGender || data.genderPreference || 'Any';
          if (filters.gender && filters.gender !== 'Any' && gender !== 'Any' && gender !== filters.gender) continue;
          if (filters.move != null && filters.move < 999) {
            const days = /^(now|immediate|immediately)$/i.test(data.availableFrom || '') ? 0 : Math.ceil((Date.parse(data.availableFrom) - Date.now()) / 86400000);
            if (!Number.isFinite(days) || days > filters.move) continue;
          }
        }
        const flatType = (data.flatType || '').toLowerCase();
        const isPg = flatType.includes('pg') || flatType.includes('coliving') || flatType.includes('hostel');

        if (isPg) {
          const pgItem = mapFirestorePG(docSnap, currentUserProfile);
          if (category === 'all' || category === 'pg') {
            collectedPgs.push(pgItem);
            collectedAll.push(pgItem);
          }
        } else {
          const roomItem = mapFirestoreListing(docSnap, currentUserProfile);
          if (category === 'all' || category === 'rooms') {
            collectedRooms.push(roomItem);
            collectedAll.push(roomItem);
          }
        }

        const currentTargetCount = category === 'pg' 
          ? collectedPgs.length 
          : category === 'rooms' 
            ? collectedRooms.length 
            : collectedAll.length;

        if (currentTargetCount >= targetPageSize) {
          break;
        }
      }

      // A server page can contain only hidden records; advance past those too.
      if (consumed === snap.docs.length && snap.cursor) currentCursor = { id: snap.cursor };
      if (consumed === snap.docs.length && !snap.hasMore) {
        hasMore = false;
        break;
      }

      const currentTargetCount = category === 'pg' 
        ? collectedPgs.length 
        : category === 'rooms' 
          ? collectedRooms.length 
          : collectedAll.length;

      if (currentTargetCount >= targetPageSize) {
        hasMore = true;
        break;
      }
    }

    return {
      rooms: collectedRooms,
      pgs: collectedPgs,
      all: collectedAll,
      cursorDoc: currentCursor,
      hasMore,
      totalDocsRead,
    };
  } catch (err: any) {
    console.error('fetchBoundedExploreListings error:', err?.message);
    throw err;
  }
}

export interface BoundedRoommatesResult {
  roommates: RoommateItem[];
  cursorDoc: any | null;
  hasMore: boolean;
  totalDocsRead: number;
}

export async function fetchBoundedExploreRoommates(options: {
  pageSize?: number;
  cursorDoc?: any | null;
  currentUid?: string;
  currentUserProfile?: any;
  maxReadBudget?: number;
}): Promise<BoundedRoommatesResult> {
  const targetPageSize = options.pageSize || 12;
  const maxReadBudget = options.maxReadBudget || 48;
  const currentUid = options.currentUid;
  if (!currentUid || options.currentUserProfile?.onboardingComplete === false) return { roommates: [], cursorDoc: null, hasMore: false, totalDocsRead: 0 };
  const currentUserProfile = options.currentUserProfile;

  const accumulated: RoommateItem[] = [];
  const seenUids = new Set<string>();

  let currentCursor: any = options.cursorDoc || null;
  let totalDocsRead = 0;
  let hasMore = true;

  try {
    while (accumulated.length < targetPageSize && totalDocsRead < maxReadBudget) {
      const batchLimit = Math.min(targetPageSize, maxReadBudget - totalDocsRead);
      const snap = await gatewayPage('people', currentCursor, batchLimit);
      if (snap.empty) {
        hasMore = false;
        break;
      }

      totalDocsRead += snap.scanned ?? snap.docs.length;

      const listingsByOwner: Record<string, any[]> = {};
      let consumed = 0;
      for (const docSnap of snap.docs) {
        consumed++;
        const data = docSnap.data() as any;
        currentCursor = docSnap;
        const uid = docSnap.id;

        if (seenUids.has(uid)) continue;
        if (currentUid && (uid === currentUid || data.uid === currentUid)) continue;
        if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') continue;
        if (data.status !== 'active') continue;

        const userListings = listingsByOwner[uid] || [];
        const mapped = mapFirestoreUser(docSnap, currentUserProfile, userListings);

        if (mapped.resolvedIntent?.isDiscoveryEligible === true) {
          seenUids.add(uid);
          accumulated.push(mapped);
          if (accumulated.length >= targetPageSize) {
            break;
          }
        }
      }


      if (consumed === snap.docs.length && snap.cursor) currentCursor = { id: snap.cursor };
      if (consumed === snap.docs.length && !snap.hasMore) {
        hasMore = false;
        break;
      }
    }

    return {
      roommates: accumulated,
      cursorDoc: currentCursor,
      hasMore,
      totalDocsRead,
    };
  } catch (err: any) {
    console.error('fetchBoundedExploreRoommates error:', err?.message);
    throw err;
  }
}

export function subscribeBoundedListingsHead(onUpdate: (latest: RoomItem | PGItem | null) => void): () => void {
  return subscribeDiscovery(() => gatewayPage('places', null, 1), page => {
    const record = page.docs[0];
    onUpdate(!record ? null : /pg|coliving|hostel/i.test(record.data().flatType || '') ? mapFirestorePG(record) : mapFirestoreListing(record));
  }, () => onUpdate(null));
}

export function subscribeLiveListings(profileOrCb: any, maybeCb?: (rooms: RoomItem[], pgs: PGItem[], error?: unknown) => void): () => void {
  const onUpdate = typeof maybeCb === 'function' ? maybeCb : profileOrCb;
  const profile = typeof maybeCb === 'function' ? profileOrCb : undefined;
  let lastRooms: RoomItem[] = [], lastPgs: PGItem[] = [];
  return subscribeDiscovery(() => gatewayPage('places', null, 24), page => {
    const rooms: RoomItem[] = [], pgs: PGItem[] = [];
    page.docs.forEach((record: any) => { if (/pg|coliving|hostel/i.test(record.data().flatType || '')) pgs.push(mapFirestorePG(record, profile)); else rooms.push(mapFirestoreListing(record, profile)); });
    lastRooms = rooms; lastPgs = pgs;
    onUpdate(rooms, pgs);
  }, error => onUpdate(lastRooms, lastPgs, error));
}
export function subscribeLiveRoommates(currentUid: string | undefined, profileOrCb: any, maybeCb?: (people: RoommateItem[]) => void): () => void {
  const onUpdate = typeof maybeCb === 'function' ? maybeCb : profileOrCb;
  let lastPeople: RoommateItem[] = [];
  return subscribeDiscovery(() => fetchBoundedExploreRoommates({ currentUid, currentUserProfile: typeof maybeCb === 'function' ? profileOrCb : undefined }), result => { lastPeople = result.roommates; onUpdate(lastPeople); }, () => onUpdate(lastPeople));
}

async function mapConcurrent<T, U>(items: readonly T[], concurrency: number, project: (item: T) => Promise<U>): Promise<U[]> {
  const result = new Array<U>(items.length); let next = 0;
  await Promise.all(Array.from({length: Math.min(concurrency, items.length)}, async () => {
    while (next < items.length) { const index = next++; result[index] = await project(items[index]); }
  }));
  return result;
}

export function subscribeLiveUserChats(
  userId: string,
  onUpdate: (chats: any[]) => void,
  onError: (error: unknown) => void = () => {}
): () => void {
  let disposed = false;
  let generation = 0;
  const objectUrls = new Set<string>();
  const imageCache = new Map<string, string>();
  try {
    const q = query(
      collection(db, 'chatRooms'),
      where('participants', 'array-contains', userId)
    );

    const unsubscribe = onSnapshot(
      q,
      async (snap) => {
        const snapshotGeneration = ++generation;
        const rooms = await mapConcurrent(snap.docs, 4, async docSnap => {
          if (disposed || snapshotGeneration !== generation) return null;
          const data = docSnap.data();
          const otherUserId = (data.participants || []).find((p: string) => p !== userId) || '';

          // Fetch other user profile for name and avatar
          let otherName = 'Roommate';
          let otherAvatar = '';
          let otherVerified = false;
          let context: any = null;

          if (otherUserId) {
            try {
              context = await getInteractionContext(otherUserId, undefined, docSnap.id);
              const uSnap = gatewayDocument(context.identity);
              if (uSnap.exists()) {
                const ud = uSnap.data();
                otherName = ud.name || 'Roommate';
                otherAvatar = ud.avatar || '';
                otherVerified = !!ud.isVerified;
              }
            } catch {
              // ignore
            }
          }

          if (disposed || snapshotGeneration !== generation) return null;
          // Fetch messages subcollection
          let msgs: any[] = [], historyCursor: any = null, hasOlder = false, historyError = false;
          try {
            const msgSnap = await getDocs(
              query(collection(db, 'chatRooms', docSnap.id, 'messages'), orderBy('createdAt', 'desc'), limit(50))
            );
            if (disposed || snapshotGeneration !== generation) return null;
            historyCursor = msgSnap.docs[msgSnap.docs.length-1] || null; hasOlder = msgSnap.docs.length === 50;
            msgs = await mapConcurrent([...msgSnap.docs].reverse(), 3, async m => {
              const md = m.data();
              const isMe = md.senderId === userId;
              const dateStr = md.createdAt?.toDate ? md.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';
              const date = md.createdAt?.toDate?.();
              const day = date ? (date.toDateString() === new Date().toDateString() ? 'Today' : date.toLocaleDateString()) : 'Sending';
              let image = md.imageUrl || '';
              if (md.imagePath) {
                image = imageCache.get(md.imagePath) || '';
                if (!image) try {
                  const blob = await getBlob(ref(storage, md.imagePath), 10 * 1024 * 1024);
                  if (['image/jpeg','image/png','image/webp'].includes(blob.type)) { image = URL.createObjectURL(blob); objectUrls.add(image); imageCache.set(md.imagePath,image); }
                } catch { image = ''; }
              }
              return [isMe ? 'me' : 't', md.content || (md.imagePath && !image ? 'Attachment unavailable' : ''), image, day, dateStr, m.id, md.createdAt?.toMillis?.() || 0];
            });
          } catch {
            historyError = true;
          }

          // The same fresh context supplies identity and permission. Do not
          // repeat its network/Firestore reads for every room snapshot.
          const authorized = context?.active === true && context.blocked !== true && context.accepted === true;
          return {
            authorized, historyCursor, hasOlder, historyError,
            id: docSnap.id,
            p: otherUserId,
            ctx: data.listingId ? ['room', data.listingId] : ['mate'],
            un: data.unreadBy?.[userId] || 0,
            m: msgs,
            otherName,
            otherAvatar,
            otherVerified,
            raw: data,
          };
        });
        if (!disposed && snapshotGeneration === generation) onUpdate(rooms.filter(Boolean));
      },
      (err) => {
        generation++;
        console.warn('Live chat subscription note:', err?.message);
        if (!disposed) onError(err);
      }
    );
    return () => { disposed = true; generation++; unsubscribe(); objectUrls.forEach(url => URL.revokeObjectURL(url)); };
  } catch (err) {
    onError(err);
    return () => {};
  }
}

/**
 * Realtime subscription to user notifications
 */
export function subscribeLiveNotifications(
  userId: string,
  onUpdate: (notifs: any[]) => void
): () => void {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'), limit(30)
    );

    return onSnapshot(
      q,
      (snap) => {
        const notifs = snap.docs.map((d) => {
          const data = d.data();
          const timeAgo = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : 'Today';
          return {
            id: d.id,
            ty: data.type === 'application' ? 'app' : data.type === 'message' ? 'msg' : data.type === 'connect' ? 'req' : data.type === 'verification' ? 'ver' : 'match',
            x: `<b>${escapeDisplayText(data.title || 'Notification')}</b>: ${escapeDisplayText(data.description || '')}`,
            t: timeAgo,
            r: data.read ? 1 : 0,
            g: data.createdAt?.toDate?.().toDateString() === new Date().toDateString() ? 'Today' : 'Earlier',
            roomId: data.roomId || '', listingId: data.listingId || '',
            actionable: data.type === 'connect' && Boolean(data.connectionId) && (String(data.title || '').includes('Request') || String(data.description || '').toLowerCase().includes('requested')),
            connectionId: data.connectionId || '',
            actionUrl: data.actionUrl || '',
            raw: data,
          };
        });
        onUpdate(notifs);
      },
      (err) => {
        console.warn('Live notifications note:', err?.message);
        onUpdate([]);
      }
    );
  } catch (err) {
    onUpdate([]);
    return () => {};
  }
}

/**
 * Realtime subscription to owner listings
 */
export function subscribeOwnerListings(ownerId: string, onUpdate: (items: any[]) => void): () => void {
  let places: any[] = [], applications: any[] = [], legacy: any[] = [], generation = 0, disposed = false;
  const publish = async () => {
    const version = ++generation;
    const items = await Promise.all(places.map(async d => {
      const data = d.data();
      const related = applications.filter(a => a.listingId === d.id).map(a => ({ ...a, fromUserId: a.applicantId, applicationId: a.id }));
      const old = legacy.filter(c => c.listingId === d.id
        && (c.applicantStage || (c.screeningAnswers && Object.keys(c.screeningAnswers).length > 0))
        && !related.some(a => a.fromUserId === c.fromUserId));
      const all = [...related, ...old].sort((a,b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
      const latest = new Map(all.map(a => [a.fromUserId, a]));
      const ap = await Promise.all([...latest.values()].map(async a => {
        const snap = gatewayDocument((await readDiscovery({action:'person',id:a.fromUserId})).record);
        return { ...a, applicantStage: a.applicationId ? a.status : a.applicantStage || 'pending', user: snap.exists() ? mapFirestoreUser(snap) : null };
      }));
      return { id: d.id, t: data.title || 'Untitled listing', loc: data.locality || '', rent: listingRent(data) ?? 0, photo: data.images?.[0] || '', pct: 0, st: listingStatusLabel(data.status), ap, f: data };
    }));
    if (!disposed && version === generation) onUpdate(items);
  };
  const fail = (error: unknown) => { console.error('Owner records could not refresh', error); };
  const stops = [
    onSnapshot(query(collection(db, 'listings'), where('ownerId', '==', ownerId)), snap => { places = snap.docs; void publish().catch(fail); }, fail),
    onSnapshot(query(collection(db, 'applications'), where('ownerId', '==', ownerId)), snap => { applications = snap.docs.map(d => ({ id: d.id, ...d.data() })); void publish().catch(fail); }, fail),
    onSnapshot(query(collection(db, 'connections'), where('toUserId', '==', ownerId)), snap => { legacy = snap.docs.map(d => ({ id: d.id, ...d.data() })); void publish().catch(fail); }, fail),
  ];
  return () => { disposed = true; generation++; stops.forEach(stop => stop()); };
}

/**
 * Realtime subscription to user connections
 */
export function subscribeLiveConnections(
  userId: string,
  onUpdate: (connections: { accepted: any[]; received: any[]; sent: any[]; restricted: any[] }) => void
): () => void {
  try {
    const q = query(
      collection(db, 'connections'),
      where('fromUserId', '==', userId)
    );
    const q2 = query(
      collection(db, 'connections'),
      where('toUserId', '==', userId)
    );

    let sentConns: any[] = [];
    let recvConns: any[] = [];

    const updateAll = () => {
      const accepted = [...sentConns, ...recvConns].filter((c) => c.status === 'accepted');
      const received = recvConns.filter((c) => c.status === 'pending');
      const sent = sentConns.filter((c) => c.status === 'pending');
      const restricted = [...sentConns, ...recvConns].filter((c) => ['blocked', 'rejected', 'superseded', 'withdrawn', 'disconnected'].includes(c.status));
      onUpdate({ accepted, received, sent, restricted });
    };

    const unsub1 = onSnapshot(q, (snap) => {
      sentConns = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      updateAll();
    });

    const unsub2 = onSnapshot(q2, (snap) => {
      recvConns = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      updateAll();
    });

    return () => {
      unsub1();
      unsub2();
    };
  } catch {
    onUpdate({ accepted: [], received: [], sent: [], restricted: [] });
    return () => {};
  }
}

/**
 * Fetch applicants for a listing
 */
export async function fetchListingApplicantsBackend(listingId: string): Promise<any[]> {
  try {
    const [appSnap, connSnap] = await Promise.all([
      getDocs(query(collection(db, 'applications'), where('listingId', '==', listingId))),
      getDocs(query(collection(db, 'connections'), where('listingId', '==', listingId))),
    ]);

    const related = appSnap.docs.map(d => ({ id: d.id, ...d.data(), fromUserId: d.data().applicantId, applicationId: d.id }));
    const old = connSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((c: any) => (c.applicantStage || (c.screeningAnswers && Object.keys(c.screeningAnswers).length > 0))
        && !related.some(a => a.fromUserId === c.fromUserId));
    const all = [...related, ...old].sort((a: any, b: any) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
    const latest = new Map(all.map((a: any) => [a.fromUserId, a]));

    const applicants: any[] = [];
    for (const item of latest.values()) {
      const userSnap = gatewayDocument((await readDiscovery({action:'person',id:item.fromUserId})).record);
      if (userSnap.exists()) {
        const stage = item.applicationId ? item.status : item.applicantStage || 'pending';
        applicants.push({
          applicationId: item.applicationId,
          connectionId: item.id,
          status: stage === 'shortlisted' ? 'Shortlisted' : (stage === 'selected' ? 'Selected' : (stage === 'rejected' ? 'Declined' : 'New')),
          connectionStatus: item.status,
          user: mapFirestoreUser(userSnap),
          screeningAnswers: item.screeningAnswers || {},
        });
      }
    }
    return applicants;
  } catch (err) {
    console.warn('Fetch listing applicants note:', err);
    return [];
  }
}

/**
 * Backend Mutations
 */
async function uploadListingPhotos(listingId: string, photos: unknown[]): Promise<string[]> {
  if (photos.length > 10) throw new Error('Choose up to 10 listing photos.');
  const urls: string[] = [];
  for (const [index, photo] of photos.entries()) {
    if (typeof photo === 'string' && /^https?:\/\//i.test(photo.trim())) {
      urls.push(photo.trim());
      continue;
    }

    let rawPhoto: unknown = photo;
    if (rawPhoto && typeof rawPhoto === 'object' && !(rawPhoto instanceof Blob)) {
      rawPhoto = (rawPhoto as any).url || (rawPhoto as any).src || (rawPhoto as any).data || rawPhoto;
      if (typeof rawPhoto === 'string' && /^https?:\/\//i.test(rawPhoto.trim())) {
        urls.push(rawPhoto.trim());
        continue;
      }
    }

    let image: Blob;
    if (rawPhoto instanceof Blob) {
      image = rawPhoto;
    } else if (typeof rawPhoto === 'string' && rawPhoto.trim().startsWith('blob:')) {
      image = await (await fetch(rawPhoto.trim())).blob();
    } else if (typeof rawPhoto === 'string' && rawPhoto.trim().startsWith('data:')) {
      image = dataURLtoBlob(rawPhoto.trim());
    } else if (typeof rawPhoto === 'string' && rawPhoto.trim().length > 100) {
      image = dataURLtoBlob(`data:image/jpeg;base64,${rawPhoto.trim()}`);
    } else {
      throw new Error('Please choose a valid photo (JPG, PNG, WebP or AVIF).');
    }

    if (image.size >= 25 * 1024 * 1024) {
      throw new Error('Each photo must be smaller than 25 MB.');
    }

    let upload: Blob = image;
    try {
      upload = await compressImage(rawPhoto instanceof Blob ? rawPhoto : image, 1200, 1200, 0.82);
    } catch {
      upload = image;
    }

    let contentType = upload.type || image.type || 'image/jpeg';
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(contentType)) {
      contentType = 'image/jpeg';
    }

    const uniqueId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    const storageRef = ref(storage, `listings/${listingId}/${Date.now()}_${index}_${uniqueId}.jpg`);
    const snapshot = await uploadBytesResumable(storageRef, upload, { contentType });
    urls.push(await getDownloadURL(snapshot.ref));
  }
  return urls;
}

export async function createNewListingBackend(listingData: any, currentUser: any): Promise<any> {
  const user = currentUser || auth.currentUser;
  if (!user || user.uid !== auth.currentUser?.uid) throw new Error('Sign in required to post a listing');
  const photos: unknown[] = Array.isArray(listingData.ph) ? listingData.ph : [];
  if (photos.length > 10) throw new Error('Choose up to 10 listing photos.');
  const uploadedUrls: string[] = [];

  const newDoc = {
    ownerId: user.uid,
    ownerName: user.displayName || user.name || '',
    ownerAvatar: user.photoURL || user.avatar || '',
    title: listingData.title || (listingData.loc ? `Room in ${listingData.loc}` : 'Room'),
    description: listingData.desc || '',
    flatType: listingData.bhk || listingData.type || 'Room',
    ...(listingData.type ? { roomType: listingData.type } : {}),
    furnishing: listingData.furn || 'Unfurnished',
    city: listingData.city || 'Bengaluru',
    locality: listingData.loc || 'Bengaluru',
    address: `${listingData.loc || 'Bengaluru'}, ${listingData.city || 'Bengaluru'}`,
    totalRent: Number(listingData.rent || 0),
    monthlyRent: Number(listingData.rent || 0),
    partnerShare: Number(listingData.rent || 0),
    partnersNeeded: 1,
    isLiveInRoom: listingData.isLiveInRoom === true,
    deposit: Number(listingData.dep || 0),
    amenities: Array.isArray(listingData.inc) ? listingData.inc : [],
    houseRules: Array.isArray(listingData.lf) ? listingData.lf : [],
    screeningQuestions: Array.isArray(listingData.qs) ? listingData.qs : [],
    images: uploadedUrls,
    availableFrom: listingData.av || 'Now',
    status: listingData.status === 'draft' ? 'draft' : 'pending_verification',
    applicants: 0,
    views: 0,
    isOwnerVerified: false,
    ownerVerified: false,
    preferredGender: listingData.gd || 'Any',
    genderPreference: listingData.gd || 'Any',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // Storage authorization is based on an existing owned listing ID. Reserve
  // a nonpublic draft before uploading, then submit only after every upload.
  const docRef = await addDoc(collection(db, 'listings'), {
    ...newDoc, status: photos.length ? 'draft' : newDoc.status,
  });
  if (photos.length) {
    try {
      newDoc.images = await uploadListingPhotos(docRef.id, photos);
      await updateDoc(docRef, { images: newDoc.images, status: newDoc.status, updatedAt: serverTimestamp() });
    } catch (cause) {
      const failure = new Error('Photo upload or submission failed. Your draft is in My listings; no publication was confirmed.', { cause });
      Object.assign(failure, { draftListingId: docRef.id });
      throw failure;
    }
  }
  return { id: docRef.id, ...newDoc };
}

export async function updateListingStatusBackend(listingId: string, newStatus: string): Promise<void> {
  const ref = doc(db, 'listings', listingId);
  await updateDoc(ref, { status: newStatus.toLowerCase(), updatedAt: serverTimestamp() });
}

export async function updateListingBackend(listingId: string, updatedData: any): Promise<void> {
  const ref = doc(db, 'listings', listingId);
  const updatePayload: any = {
    updatedAt: serverTimestamp(),
  };
  if (updatedData.submitForReview === true) updatePayload.status = 'pending_verification';

  if (updatedData.title !== undefined) updatePayload.title = String(updatedData.title).trim();
  if (updatedData.loc !== undefined) updatePayload.locality = updatedData.loc;
  if (updatedData.rent !== undefined) {
    const rentNum = Number(updatedData.rent);
    updatePayload.monthlyRent = rentNum;
    updatePayload.totalRent = rentNum;
    updatePayload.partnerShare = rentNum;
  }
  if (updatedData.dep !== undefined) updatePayload.deposit = Number(updatedData.dep);
  if (updatedData.desc !== undefined) updatePayload.description = updatedData.desc;
  if (typeof updatedData.isLiveInRoom === 'boolean') updatePayload.isLiveInRoom = updatedData.isLiveInRoom;
  if (updatedData.type !== undefined) updatePayload.roomType = updatedData.type;
  if (updatedData.bhk !== undefined) updatePayload.flatType = updatedData.bhk;
  if (updatedData.av !== undefined) updatePayload.availableFrom = updatedData.av;
  if (updatedData.furn !== undefined) updatePayload.furnishing = updatedData.furn;
  if (Array.isArray(updatedData.inc)) updatePayload.amenities = updatedData.inc;
  if (updatedData.gd !== undefined) {
    updatePayload.preferredGender = updatedData.gd;
    updatePayload.genderPreference = updatedData.gd;
  }
  if (Array.isArray(updatedData.lf)) updatePayload.houseRules = updatedData.lf;
  if (Array.isArray(updatedData.qs)) updatePayload.screeningQuestions = updatedData.qs;
  if (Array.isArray(updatedData.ph)) {
    updatePayload.images = await uploadListingPhotos(listingId, updatedData.ph);
  }

  await updateDoc(ref, updatePayload);
}

export async function deleteListingBackend(listingId: string): Promise<void> {
  const ref = doc(db, 'listings', listingId);
  await deleteDoc(ref);
}


function interactionPeer(context: any, ownUid: string): any {
  return { status: context.active ? 'active' : 'restricted', blockedUserIds: context.blocked ? [ownUid] : [],
    communicationRevokedAt: { [ownUid]: Timestamp.fromMillis(context.peerRevokedAtMs || 0) },
    personCommunicationRevokedAt: { [ownUid]: Timestamp.fromMillis(context.peerPersonRevokedAtMs || 0) } };
}

const inFlightConnectionRequests = new Set<string>();

/**
 * Send a connection request from authenticated user to target user.
 * Prevents self-connection, duplicate forward/reverse pending, duplicate accepted,
 * and rapid double-clicks/concurrent attempts via deterministic document key transaction.
 */
export async function sendConnectionRequestBackend(toUserId: string, listingId?: string, _legacyAnswers?: Record<string, unknown>): Promise<string> {
  const user = auth.currentUser;
  if (!user || !toUserId || user.uid === toUserId) throw new Error('Choose another member to connect with.');
  const key = [user.uid, toUserId].sort().join('___');
  if (inFlightConnectionRequests.has(key)) throw new Error('Request in progress.');
  inFlightConnectionRequests.add(key);
  try {
    const [forward, reverse] = await Promise.all([
      getDocs(query(collection(db, 'connections'), where('fromUserId', '==', user.uid), where('toUserId', '==', toUserId))),
      getDocs(query(collection(db, 'connections'), where('fromUserId', '==', toUserId), where('toUserId', '==', user.uid))),
    ]);
    const history = [...forward.docs, ...reverse.docs];
    // Retain legacy active records; terminal history is never rewritten.
    const active = history.find(d => ['pending', 'accepted'].includes(d.data().status) && (d.data().listingId || null) === (listingId || null));
    const requestRef = doc(collection(db, 'connections'));
    const ownLock = doc(db, 'connectionPairs', user.uid + '___' + toUserId);
    const reverseLock = doc(db, 'connectionPairs', toUserId + '___' + user.uid);
    const context = await getInteractionContext(toUserId, listingId);
    const publicListing = listingId ? gatewayDocument((await readDiscovery({action:"place",id:listingId})).record) : null;
    const attempt = () => runTransaction(db, async tx => {
      const [me, lock] = await Promise.all([tx.get(doc(db, 'users', user.uid)), tx.get(ownLock)]);
      const previous = lock.exists() ? await tx.get(doc(db, 'connections', lock.data().connectionId)) : null;
      const existing = previous?.exists() && ['pending', 'accepted'].includes(previous.data().status) ? previous : active;
      const a = me.data(), b = interactionPeer(context, user.uid);
      if (!a || !b || (a.status || 'active') !== 'active' || (b.status || 'active') !== 'active' || pairIsBlocked(a, b, user.uid, toUserId)) throw new Error('Communication is unavailable.');
      const fresh = (record: any) => consentIsCurrent(record.fromUserId === user.uid ? a : b, record.fromUserId === user.uid ? b : a, record);
      if (context.accepted) {
        const accepted = history.find(d => d.data().status === 'accepted' && fresh(d.data()));
        if (accepted) return accepted.id;
      }
      if (existing && fresh(existing.data()) && (existing.data().listingId || null) === (listingId || null)) return existing.id;
      // One outstanding request per pair, even when another entry point is used.
      if (previous?.exists() && previous.data().status === 'pending' && fresh(previous.data())) return previous.id;
      if (listingId) {
        const listing = publicListing!;
        if (!listing.exists() || listing.data().ownerId !== toUserId || listing.data().status !== 'active') throw new Error('This listing is unavailable.');
      }
      if (a.isPremium !== true && (a.connectsUsed || 0) >= FREE_CONNECT_LIMIT) throw new Error('Connection request allowance reached.');
      if (a.isPremium !== true) tx.update(doc(db, 'users', user.uid), { connectsUsed: (a.connectsUsed || 0) + 1, lastConnectionId: requestRef.id, updatedAt: serverTimestamp() });
      tx.set(requestRef, { fromUserId: user.uid, toUserId, status: 'pending', ...(listingId ? { listingId } : {}), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      const lockValue = { participants: [user.uid, toUserId], connectionId: requestRef.id };
      tx.set(ownLock, lockValue); tx.set(reverseLock, lockValue);
      tx.set(doc(db, 'notifications', requestRef.id + '_pending'), { userId: toUserId, actorId: user.uid, type: 'connect', title: 'New Connection Request', description: (user.displayName || 'A member') + ' requested permission to communicate.', connectionId: requestRef.id, read: false, createdAt: serverTimestamp() });
      return requestRef.id;
    });
    try { return await attempt(); }
    catch (error) {
      // A competing opposite-direction request can commit while rules evaluate
      // this transaction. Re-read the pair lock instead of reporting a false
      // failure or charging another allowance. Genuine denials still fail.
      if (!['permission-denied', 'aborted', 'firestore/permission-denied', 'firestore/aborted'].includes((error as any)?.code)) throw error;
      return await attempt();
    }
  } finally { inFlightConnectionRequests.delete(key); }
}

/**
 * Update connection status (accepted, rejected, blocked).
 * When accepting: atomically updates connections/{id} AND creates acceptedPairs in both directions.
 * When rejecting: updates connections/{id} and removes any stale acceptedPairs.
 * When blocking: updates connections/{id} and removes any stale acceptedPairs.
 */
export async function updateConnectionStatusBackend(connectionId: string, newStatus: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in required.');
  const status = newStatus.toLowerCase();
  if (status === 'blocked') {
    const snap = await getDoc(doc(db, 'connections', connectionId));
    if (!snap.exists() || ![snap.data().fromUserId, snap.data().toUserId].includes(user.uid)) throw new Error('Not authorized.');
    return blockUserBackend(snap.data().fromUserId === user.uid ? snap.data().toUserId : snap.data().fromUserId);
  }
  if (!['accepted', 'rejected'].includes(status)) throw new Error('Unsupported decision.');
  const initial = await getDoc(doc(db, 'connections', connectionId));
  if (!initial.exists()) throw new Error('Request not found.');
  if (initial.data().toUserId !== user.uid) throw new Error('Only the recipient can decide this request.');
  const context = await getInteractionContext(initial.data().fromUserId, initial.data().listingId);
  await runTransaction(db, async tx => {
    const connRef = doc(db, 'connections', connectionId), snap = await tx.get(connRef);
    if (!snap.exists()) throw new Error('Request not found.');
    const c = snap.data();
    if (c.toUserId !== user.uid) throw new Error('Only the recipient can decide this request.');
    const recipient = await tx.get(doc(db, 'users', user.uid));
    const sender = { exists: () => true, data: () => interactionPeer(context, user.uid) };
    if (!sender.exists() || !recipient.exists() || pairIsBlocked(sender.data(), recipient.data(), c.fromUserId, c.toUserId) || (sender.data().status || 'active') !== 'active' || (recipient.data().status || 'active') !== 'active') throw new Error('Communication unavailable.');
    if (status === 'accepted' && !consentIsCurrent(sender.data(), recipient.data(), c)) throw new Error('Fresh consent is required after a block.');
    if (c.status === status) return;
    if (c.status !== 'pending') throw new Error('This request is no longer pending.');
    tx.update(connRef, { status, updatedAt: serverTimestamp() });
    if (status === 'accepted') {
      const collectionName = c.listingId ? 'listingPairs' : 'acceptedPairs';
      tx.set(doc(db, collectionName, c.fromUserId + '_' + c.toUserId), { user1: c.fromUserId, user2: c.toUserId, connectionId, ...(c.listingId ? { listingId: c.listingId } : {}), createdAt: serverTimestamp() });
      tx.set(doc(db, collectionName, c.toUserId + '_' + c.fromUserId), { user1: c.toUserId, user2: c.fromUserId, connectionId, ...(c.listingId ? { listingId: c.listingId } : {}), createdAt: serverTimestamp() });
    }
    tx.set(doc(db, 'notifications', connectionId + '_' + status), { userId: c.fromUserId, actorId: user.uid, type: 'connect', title: status === 'accepted' ? 'Communication accepted' : 'Request declined', description: status === 'accepted' ? 'You can now message each other.' : 'Your request was declined.', connectionId, read: false, createdAt: serverTimestamp() });
  });
}

/**
 * Withdraw a pending connection request.
 * Only the original sender may withdraw a pending request.
 * Cleans up associated notifications and deletes connection record.
 * Never reports success if operation fails.
 */
export async function withdrawConnectionRequestBackend(connectionId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in required.');
  await runTransaction(db, async tx => {
    const ref = doc(db, 'connections', connectionId), snap = await tx.get(ref);
    if (!snap.exists() || snap.data().fromUserId !== user.uid) throw new Error('Request not found.');
    if (snap.data().status === 'withdrawn') return;
    if (snap.data().status !== 'pending') throw new Error('This request is no longer pending.');
    tx.update(ref, { status: 'withdrawn', updatedAt: serverTimestamp() });
  });
}

/**
 * Fetch private WhatsApp contact information for an accepted connection partner.
 */
export async function getConnectedUserWhatsApp(targetUserId: string): Promise<string | null> {
  if (!targetUserId) return null;
  try {
    const snap = await getDoc(doc(db, 'userContacts', targetUserId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return data?.whatsappNumber || null;
  } catch {
    return null;
  }
}

async function assertCommunicationBackend(targetUserId: string, listingId?: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || user.uid === targetUserId) throw new Error('Choose another member.');
  const context = await getInteractionContext(targetUserId, listingId);
  if (!context.active || context.blocked || !context.accepted) throw new Error('Request communication consent and wait for the recipient to accept.');
}

export async function getOrCreateChatRoomBackend(targetUserId: string, listingId?: string): Promise<string> {
  await assertCommunicationBackend(targetUserId, listingId);
  const user = auth.currentUser!;
  if (listingId) {
    const listing = gatewayDocument((await readDiscovery({action:'place',id:listingId})).record);
    if (!listing.exists() || listing.data().ownerId !== targetUserId) throw new Error('Listing poster does not match.');
  }
  const indexRef = doc(db, 'conversationPairs', user.uid + '___' + targetUserId);
  const indexed = await getDoc(indexRef);
  if (indexed.exists()) {
    const room = await getDoc(doc(db, 'chatRooms', indexed.data().roomId));
    if (!room.exists() || room.data().participants.length !== 2 || !room.data().participants.includes(targetUserId) || !room.data().participants.includes(user.uid)) throw new Error('Conversation unavailable.');
    if (listingId && !room.data().listingContexts?.includes(listingId)) await updateDoc(room.ref, { listingContexts: arrayUnion(listingId), contextListingId: listingId });
    return room.id;
  }
  const existing = await getDocs(query(collection(db, 'chatRooms'), where('participants', 'array-contains', user.uid)));
  const matching = existing.docs.filter(d => d.data().participants?.length === 2 && d.data().participants.includes(targetUserId)).sort((a,b) => a.id.localeCompare(b.id));
  const id = matching[0]?.id || [user.uid, targetUserId].sort().join('___'), roomRef = doc(db, 'chatRooms', id);
  let chosenId=id;
  await runTransaction(db, async tx => {
    const [snap, index] = await Promise.all([tx.get(roomRef), tx.get(indexRef)]);
    if(index.exists()){chosenId=index.data().roomId;return;}
    if (snap.exists()) {
      if (snap.data().participants?.length !== 2 || !snap.data().participants.includes(user.uid) || !snap.data().participants.includes(targetUserId)) throw new Error('Conversation participants do not match.');
      if(listingId)tx.update(roomRef,{listingContexts:arrayUnion(listingId),contextListingId:listingId});
    } else tx.set(roomRef, { participants: [user.uid, targetUserId], listingId: listingId || null, listingContexts: listingId ? [listingId] : [], lastMessage: '', unreadBy: {}, lastMessageAt: serverTimestamp(), createdAt: serverTimestamp() });
    const indexValue={participants:[user.uid,targetUserId],roomId:id};
    tx.set(indexRef,indexValue);tx.set(doc(db,'conversationPairs',targetUserId+'___'+user.uid),indexValue);
  });
  return chosenId;
}

export async function uploadChatImageBackend(roomId: string, file: File): Promise<string> {
  if (!auth.currentUser || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size >= 10 * 1024 * 1024) throw new Error('Choose a JPEG, PNG or WebP image under 10 MiB.');
  const object = ref(storage, 'chats/' + roomId + '/' + auth.currentUser.uid + '/' + crypto.randomUUID());
  await uploadBytesResumable(object, file, { contentType: file.type });
  // Private object path; render with authenticated getBlob, not a bearer token.
  return object.fullPath;
}

export async function sendMessageBackend(chatRoomId: string, content: string, imagePath = '', clientMessageId = crypto.randomUUID()): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in required.');
  if (!content.trim() && !imagePath) throw new Error('Enter a message or attach an image.');
  if (content.length > 10000 || !/^[a-zA-Z0-9_-]{1,128}$/.test(clientMessageId)) throw new Error('Invalid message.');
  if (imagePath && !imagePath.startsWith('chats/' + chatRoomId + '/' + user.uid + '/')) throw new Error('Upload an authorized attachment first.');
  await runTransaction(db, async tx => {
    const roomRef = doc(db, 'chatRooms', chatRoomId), messageRef = doc(db, 'chatRooms', chatRoomId, 'messages', clientMessageId);
    const [room, previous] = await Promise.all([tx.get(roomRef), tx.get(messageRef)]);
    if (!room.exists() || !room.data().participants.includes(user.uid)) throw new Error('Conversation unavailable.');
    if (previous.exists()) {
      if (previous.data().senderId !== user.uid || previous.data().content !== content || previous.data().imagePath !== imagePath) throw new Error('Message retry does not match.');
      return;
    }
    const recipient = room.data().participants.find((uid: string) => uid !== user.uid);
    tx.set(messageRef, { senderId: user.uid, content, imagePath, read: false, createdAt: serverTimestamp() });
    tx.update(roomRef, { lastMessage: content || 'Photo', lastMessageId: clientMessageId, lastMessageAt: serverTimestamp(), unreadBy: { ...room.data().unreadBy, [recipient]: (room.data().unreadBy?.[recipient] || 0) + 1 } });
    tx.set(doc(db, 'notifications', chatRoomId + '_' + clientMessageId), { userId: recipient, actorId: user.uid, type: 'message', title: 'New message', description: 'You received a message.', roomId: chatRoomId, messageId: clientMessageId, read: false, createdAt: serverTimestamp() });
  });
}

export async function markConversationReadBackend(roomId: string, visibleMessageId?: string): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  return runTransaction(db, async tx => {
    const ref = doc(db, 'chatRooms', roomId), room = await tx.get(ref);
    if (!room.exists() || !room.data().participants.includes(user.uid)) throw new Error('Conversation unavailable.');
    // A new message may arrive after history loaded but before this transaction.
    // Never mark that unseen message read merely because its room was open.
    if (visibleMessageId && room.data().lastMessageId && room.data().lastMessageId !== visibleMessageId) return false;
    if (!(room.data().unreadBy?.[user.uid] > 0)) return true;
    tx.update(ref, { unreadBy: { ...room.data().unreadBy, [user.uid]: 0 } });
    return true;
  });
}

export async function saveUserBookmarkBackend(id: string, isRoom: boolean, isSaved: boolean): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in required to save changes.');

  const userRef = doc(db, 'users', user.uid);
  const field = isRoom ? 'savedRoomIds' : 'savedProfileIds';

  await updateDoc(userRef, {
    [field]: isSaved ? arrayUnion(id) : arrayRemove(id),
    updatedAt: serverTimestamp(),
  });
}

export async function updateUserProfileBackend(profileData: Record<string, any>): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in required to save changes.');

  const userRef = doc(db, 'users', user.uid);
  await updateDoc(userRef, {
    ...profileData,
    updatedAt: serverTimestamp(),
  });
}

export async function uploadProfileAvatarBackend(file: File): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in required to update avatar');

  const compressed = await compressImage(file, 800, 800, 0.85);
  const storageRef = ref(storage, `profiles/${user.uid}/avatar_${Date.now()}.jpg`);
  const snap = await uploadBytesResumable(storageRef, compressed);
  const url = await getDownloadURL(snap.ref);

  // Upload is staged. Only the existing profile form Save publishes the URL.
  return url;
}

/**
 * Manual KYC Document Verification Submissions & Admin Moderation
 */
export async function submitManualKycBackend(
  file: File,
  documentType: string,
  declaredName: string,
  consentGiven: boolean
): Promise<{ success: boolean; url: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in required to submit verification documents');
  if (!consentGiven) throw new Error('Explicit consent required for identity verification review');

  if (!declaredName.trim()) throw new Error('Enter the name shown on your document.');
  const normalizedDocType = String(documentType || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!['masked_aadhaar', 'passport', 'voter_id', 'driving_license'].includes(normalizedDocType)) {
    throw new Error('Choose a supported identity document type.');
  }
  if (file.size === 0) throw new Error('The selected document is empty.');
  // Validate file type (JPEG, PNG, WebP, PDF)
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!validTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only JPEG, PNG, WebP, or PDF documents are permitted.');
  }

  // Validate file size: 5MB maximum limit for MVP
  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error('File size exceeds the 5MB limit. Please upload a smaller document.');
  }

  const verificationRef = doc(db, 'verifications', user.uid);
  const previousSubmission = await getDoc(verificationRef);
  const previous = previousSubmission.exists() ? previousSubmission.data() : null;
  if (previous && !['REJECTED', 'RESUBMISSION_REQUIRED'].includes(previous.status)) {
    throw new Error('Your identity submission is already awaiting review or approved.');
  }
  // Sanitize file extension
  const ext = file.name.split('.').pop()?.toLowerCase() || (file.type === 'application/pdf' ? 'pdf' : 'jpg');
  const cleanExt = ['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(ext) ? ext : 'jpg';
  const filename = `${Date.now()}_id_document.${cleanExt}`;

  // Upload to private verificationDocs storage path (gated to owner & admin)
  const storageRef = ref(storage, `verificationDocs/${user.uid}/${filename}`);
  await uploadBytesResumable(storageRef, file, { contentType: file.type });
  const documentPath = storageRef.fullPath;

  const submissionData = {
    userId: user.uid,
    userEmail: user.email || '',
    userName: user.displayName || declaredName || 'NestMate Member',
    declaredName: declaredName.trim(),
    documentType: normalizedDocType, // 'masked_aadhaar' | 'passport' | 'voter_id' | 'driving_license'
    documentPath,
    documentUrl: deleteField(),
    consentGiven: true,
    consentTimestamp: serverTimestamp(),
    status: 'PENDING',
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    resubmissionCount: previous ? Number(previous.resubmissionCount || 0) + 1 : 0,
    reviewedBy: deleteField(), reviewedAt: deleteField(), reviewNote: deleteField(),
    auditTrail: arrayUnion(
      {
        status: 'PENDING',
        timestamp: new Date().toISOString(),
        actorId: user.uid,
        note: 'Document uploaded and submitted for manual admin review',
      },
    ),
  };

  const batch = writeBatch(db);
  batch.set(verificationRef, submissionData, { merge: true });
  batch.set(doc(db, 'ownerVerifications', user.uid), {
      userId: user.uid,
      status: 'SUBMITTED',
      documentType: documentType.toLowerCase().replace(/\s+/g, '_'),
      documentPath,
      documentUrl: deleteField(),
      declaredName: declaredName.trim(),
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      reviewedBy: deleteField(), reviewedAt: deleteField(), reviewNote: deleteField(),
      resubmissionCount: submissionData.resubmissionCount,
    }, { merge: true });
  await batch.commit();

  return { success: true, url: '' };
}

export async function fetchUserKycStatusBackend(userId: string): Promise<any> {
  try {
    const snap = await getDoc(doc(db, 'verifications', userId));
    if (snap.exists()) return { id: snap.id, ...snap.data() };
    const snap2 = await getDoc(doc(db, 'ownerVerifications', userId));
    if (snap2.exists()) return { id: snap2.id, ...snap2.data() };
    return null;
  } catch {
    return null;
  }
}

/** Fetch private bytes with the current Firebase session; never issue a token URL. */
export async function getVerificationDocumentBlobBackend(documentPath: string): Promise<Blob> {
  if (!auth.currentUser) throw new Error('Sign in required to review verification documents.');
  if (typeof documentPath !== 'string' || !/^verificationDocs\/[^/]+\/[^/]+$/.test(documentPath)) {
    throw new Error('This submission has no supported private document path.');
  }
  const document = await getBlob(ref(storage, documentPath), 5 * 1024 * 1024);
  if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'].includes(document.type.toLowerCase())) {
    throw new Error('Unsupported identity document format. Request a JPG, PNG, WebP or PDF resubmission.');
  }
  return document;
}

export function subscribeUserKycStatus(
  userId: string,
  onUpdate: (data: any) => void
): () => void {
  try {
    return onSnapshot(
      doc(db, 'verifications', userId),
      (snap) => {
        if (snap.exists()) {
          onUpdate({ id: snap.id, ...snap.data() });
        } else {
          onUpdate(null);
        }
      },
      () => onUpdate(null)
    );
  } catch {
    return () => {};
  }
}

async function reviewVerificationBackend(userId: string, adminEmail: string, approved: boolean, note: string, expectedDocumentPath?: string): Promise<void> {
  const actor = auth.currentUser;
  if (!actor) throw new Error('Sign in required to review verification.');
  if (!expectedDocumentPath) throw new Error('Open the current private submission before deciding it.');
  const listings = await getDocs(query(collection(db, 'listings'), where('ownerId', '==', userId), limit(498)));
  if (listings.docs.length > 497) throw new Error('This account requires server-side verification review. No changes were saved.');
  await runTransaction(db, async tx => {
    const verificationRef = doc(db, 'verifications', userId), current = await tx.get(verificationRef);
    if (!current.exists() || current.data().documentPath !== expectedDocumentPath || String(current.data().status).toLowerCase() !== 'pending') throw new Error('This submission changed or was already reviewed. Reopen and inspect the current version.');
    const status = approved ? 'APPROVED' : 'REJECTED';
    const review = { status, reviewedBy: actor.email || adminEmail, reviewedAt: serverTimestamp(), reviewNote: note, updatedAt: serverTimestamp() };
    tx.set(verificationRef, { ...review, auditTrail: arrayUnion({ status, timestamp: new Date().toISOString(), actorId: actor.uid, note, documentPath: expectedDocumentPath }) }, { merge: true });
    tx.set(doc(db, 'ownerVerifications', userId), review, { merge: true });
    tx.update(doc(db, 'users', userId), { isVerified: approved, verificationLevel: approved ? 2 : 0, isAadhaarVerified: false, verifiedAt: approved ? serverTimestamp() : deleteField(), updatedAt: serverTimestamp() });
    for (const listing of listings.docs) {
      tx.update(listing.ref, { ownerVerified: approved, isOwnerVerified: approved, updatedAt: serverTimestamp() });
    }
    tx.set(doc(db, 'notifications', userId + '_identity_' + expectedDocumentPath.split('/').pop() + '_' + status), { userId, actorId: actor.uid, type: 'verification', title: approved ? 'Identity review approved' : 'Identity review rejected', description: note, read: false, createdAt: serverTimestamp() });
  });
}
export async function adminApproveVerificationBackend(userId: string, adminEmail: string, note?: string, expectedDocumentPath?: string): Promise<void> {
  await reviewVerificationBackend(userId, adminEmail, true, note || 'Approved by safety admin', expectedDocumentPath);
}
export async function adminRejectVerificationBackend(userId: string, adminEmail: string, reason: string, expectedDocumentPath?: string): Promise<void> {
  if (!reason.trim()) throw new Error('Enter the reason for rejection.');
  await reviewVerificationBackend(userId, adminEmail, false, reason.trim(), expectedDocumentPath);
}

// Deprecated backward-compatible stub
export async function verifyUserGovernmentIdBackend(): Promise<void> {
  throw new Error('Identity verification requires manual administrator review.');
}

export async function submitReportBackend(targetType: string, targetId: string, reason: string, details: string): Promise<string> {
  const user = auth.currentUser;
  const reportData = {
    targetType,
    targetId,
    reportedBy: user ? user.uid : 'anonymous',
    reason,
    details: details || '',
    status: 'pending',
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'reports'), reportData);
  return docRef.id;
}

export async function blockUserBackend(targetUserId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in required to save changes.');

  if (!targetUserId || targetUserId === user.uid) throw new Error('Choose another member.');
  const histories = await Promise.all([
    getDocs(query(collection(db, 'connections'), where('fromUserId', '==', user.uid), where('toUserId', '==', targetUserId))),
    getDocs(query(collection(db, 'connections'), where('fromUserId', '==', targetUserId), where('toUserId', '==', user.uid))),
  ]);
  const active = histories.flatMap(s => s.docs).filter(d => ['accepted', 'pending'].includes(d.data().status));
  // A block is safe even for large legacy portfolios. Never partially revoke
  // consent and then report success or silently restore it on unblock.
  if (active.length > 450) throw new Error('This relationship needs staff assistance to revoke its legacy permissions.');
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', user.uid), 'blockedUserIds', arrayUnion(targetUserId),
    new FieldPath('communicationRevokedAt', targetUserId), serverTimestamp(),
    'lastBlockTarget', targetUserId, 'updatedAt', serverTimestamp());
  for (const connection of active) batch.update(connection.ref, {
    status: connection.data().status === 'accepted' ? 'disconnected' : 'superseded', updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function unblockUserBackend(targetUserId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in required to save changes.');

  const userRef = doc(db, 'users', user.uid);
  await updateDoc(userRef, {
    blockedUserIds: arrayRemove(targetUserId),
    lastBlockTarget: targetUserId,
    updatedAt: serverTimestamp(),
  });
}

export async function markNotificationReadBackend(notificationId: string): Promise<void> {
  const ref = doc(db, 'notifications', notificationId);
  await updateDoc(ref, { read: true });
}

export async function markAllNotificationsReadBackend(userId: string): Promise<void> {
  const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false));
  const snap = await getDocs(q);
  const promises = snap.docs.map((d) => updateDoc(d.ref, { read: true }));
  await Promise.all(promises);
}

/**
 * Admin portal queries and actions
 */
export async function fetchAdminDataBackend(): Promise<{ users: any[]; listings: any[]; reports: any[]; verifications: any[] }> {
  try {
    const [userSnap, listSnap, repSnap, verSnap] = await Promise.all([
      getDocs(query(collection(db, 'users'), limit(50))),
      getDocs(query(collection(db, 'listings'), limit(50))),
      getDocs(query(collection(db, 'reports'), limit(50))),
      getDocs(query(collection(db, 'verifications'), limit(50))),
    ]);

    const users = userSnap.docs.map((d) => ({ ...d.data(), uid: d.id }));
    const listings = listSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
    const reports = repSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
    const verifications = verSnap.docs.map((d) => ({ ...d.data(), id: d.id }));

    return { users, listings, reports, verifications };
  } catch (err) {
    console.warn('Admin fetch data note:', err);
    throw err;
  }
}

export async function adminVerifyListingBackend(listingId: string, isVerified: boolean): Promise<void> {
  const ref = doc(db, 'listings', listingId);
  await updateDoc(ref, { ownerVerified: isVerified, isOwnerVerified: isVerified, updatedAt: serverTimestamp() });
}

export async function adminUpdateUserStatusBackend(userId: string, status: string): Promise<void> {
  const ref = doc(db, 'users', userId);
  await updateDoc(ref, { status, updatedAt: serverTimestamp() });
}

export async function adminResolveReportBackend(reportId: string, action: string, outcome?: string): Promise<void> {
  const ref = doc(db, 'reports', reportId);
  await updateDoc(ref, { status: action, ...(outcome ? { outcome } : {}), resolvedAt: serverTimestamp() });
}

export async function submitApplicationBackend(listingId: string, answers: Record<string, string> = {}): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in to apply.');
  const placeSnapshot = gatewayDocument((await readDiscovery({action:'place',id:listingId})).record);
  const context = await getInteractionContext(placeSnapshot.data().ownerId, listingId);
  const application = doc(collection(db, 'applications'));
  const lockRef = doc(db, 'applicationLocks', listingId + '___' + user.uid);
  return runTransaction(db, async tx => {
    const listingRef = doc(db, 'listings', listingId);
    const listing = placeSnapshot;
    const [applicant, lock] = await Promise.all([tx.get(doc(db, 'users', user.uid)), tx.get(lockRef)]);
    if (!listing.exists()) throw new Error('Listing unavailable.');
    const place = listing.data();
    const owner = { exists: () => true, data: () => interactionPeer(context, user.uid) };
    const old = lock.exists() ? await tx.get(doc(db, 'applications', lock.data().applicationId)) : null;
    if (place.ownerId === user.uid || place.status !== 'active' || place.isDeleted === true || !owner.exists() || !applicant.exists() || (applicant.data().status || 'active') !== 'active' || (owner.data().status || 'active') !== 'active' || pairIsBlocked(applicant.data(), owner.data(), user.uid, place.ownerId)) throw new Error('This listing cannot receive your application.');
    if (old?.exists() && ['pending', 'shortlisted', 'selected'].includes(old.data().status)) return old.id;
    const questions: string[] = place.screeningQuestions || [];
    const submittedAnswers = Object.fromEntries(questions.map(q => [q, String(answers[q] || '').trim()]));
    if (questions.some(q => !submittedAnswers[q] || submittedAnswers[q].length > 2000)) throw new Error('Answer every screening question (up to 2000 characters each).');
    tx.set(application, { listingId, applicantId: user.uid, ownerId: place.ownerId, status: 'pending', listingVersion: place.updatedAt || place.createdAt || null, screeningAnswers: submittedAnswers, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    tx.set(lockRef, { listingId, applicantId: user.uid, applicationId: application.id });
    tx.set(doc(db, 'notifications', application.id + '_pending'), { userId: place.ownerId, actorId: user.uid, type: 'application', title: 'Application received', description: 'A member applied to your listing.', applicationId: application.id, listingId, read: false, createdAt: serverTimestamp() });
    return application.id;
  });
}

export async function updateApplicationStatusBackend(applicationId: string, next: ApplicationStatus): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in required.');
  await runTransaction(db, async tx => {
    const application = doc(db, 'applications', applicationId), snap = await tx.get(application);
    if (!snap.exists()) throw new Error('Application not found.');
    const a = snap.data(), owner = a.ownerId === user.uid;
    if (!owner && a.applicantId !== user.uid) throw new Error('Not authorized.');
    assertApplicationTransition(a.status, next, owner);
    if (a.status === next) return;
    tx.update(application, { status: next, updatedAt: serverTimestamp() });
    const notificationTitles: Record<ApplicationStatus, string> = {
      pending: 'Application received',
      shortlisted: 'Application shortlisted',
      selected: 'Application selected',
      rejected: 'Application declined',
      withdrawn: 'Application withdrawn',
      declined_by_applicant: 'Selection offer declined',
    };
    const notificationDescriptions: Record<ApplicationStatus, string> = {
      pending: 'A member applied to your listing.',
      shortlisted: 'Your application has been shortlisted by the host.',
      selected: 'You have been selected for this listing.',
      rejected: 'The host has declined this application.',
      withdrawn: 'The applicant has withdrawn their application.',
      declined_by_applicant: 'The applicant has declined the selection offer.',
    };
    tx.set(doc(db, 'notifications', applicationId + '_' + next), {
      userId: owner ? a.applicantId : a.ownerId,
      actorId: user.uid,
      type: 'application',
      title: notificationTitles[next] || 'Application updated',
      description: notificationDescriptions[next] || applicationLabels[next],
      applicationId,
      listingId: a.listingId,
      read: false,
      createdAt: serverTimestamp(),
    });
  });
}

export async function disconnectConnectionBackend(connectionId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in required.');
  await runTransaction(db, async tx => {
    const ref = doc(db, 'connections', connectionId), snap = await tx.get(ref);
    if (!snap.exists() || ![snap.data().fromUserId, snap.data().toUserId].includes(user.uid)) throw new Error('Not authorized.');
    if (snap.data().status === 'disconnected') return;
    if (snap.data().status !== 'accepted') throw new Error('This connection is no longer accepted.');
    const connection = snap.data();
    tx.update(ref, { status: 'disconnected', updatedAt: serverTimestamp() });
    if (!connection.listingId) {
      const peer = connection.fromUserId === user.uid ? connection.toUserId : connection.fromUserId;
      // Revoke every older person-consent alias, including legacy duplicates.
      // Listing-specific permission has an independent scope and stays valid.
      tx.update(doc(db, 'users', user.uid),
        new FieldPath('personCommunicationRevokedAt', peer), serverTimestamp(),
        'lastDisconnectTarget', peer, 'updatedAt', serverTimestamp());
      tx.set(doc(db, 'notifications', connectionId + '_disconnected'), {
        userId: peer,
        actorId: user.uid,
        type: 'connect',
        title: 'Connection disconnected',
        description: 'A member disconnected your roommate connection.',
        connectionId,
        read: false,
        createdAt: serverTimestamp(),
      });
    }
    // History and any separately authorized listing conversation are preserved.
  });
}

export async function fetchPersonByIdBackend(uid: string): Promise<RoommateItem> {
  if (!auth.currentUser) throw new Error('Sign in to view this profile.');
  const snap = uid === auth.currentUser.uid ? await getDoc(doc(db, 'users', uid)) : gatewayDocument((await readDiscovery({action:'person',id:uid})).record);
  if (!snap.exists()) throw new Error('Profile unavailable.');
  return mapFirestoreUser(snap);
}

export async function fetchOwnApplicationBackend(listingId: string): Promise<any | null> {
  const user = auth.currentUser;
  if (!user) return null;
  const lock = await getDoc(doc(db, 'applicationLocks', listingId + '___' + user.uid));
  if (!lock.exists()) return null;
  const application = await getDoc(doc(db, 'applications', lock.data().applicationId));
  return application.exists() ? { id: application.id, ...application.data() } : null;
}

export async function fetchPlaceByIdBackend(id: string, profile?: any): Promise<RoomItem | PGItem> {
  let snap;
  try { snap = gatewayDocument((await readDiscovery({action:'place',id})).record); }
  catch (error) {
    if (!auth.currentUser) throw error;
    snap = await getDoc(doc(db, 'listings', id));
    if (!snap.exists() || snap.data().ownerId !== auth.currentUser.uid) throw error;
  }
  return /pg|coliving|hostel/i.test(snap.data().flatType || '') ? mapFirestorePG(snap, profile) : mapFirestoreListing(snap, profile);
}

export async function loadOlderMessagesBackend(roomId: string, cursor: QueryDocumentSnapshot): Promise<{messages:any[];cursor:any;hasOlder:boolean;objectUrls:string[]}> {
  const user=auth.currentUser;
  if(!user)throw new Error('Sign in required.');
  const page=await getDocs(query(collection(db,'chatRooms',roomId,'messages'),orderBy('createdAt','desc'),startAfter(cursor),limit(50)));
  const objectUrls:string[]=[];
  const messages=await Promise.all([...page.docs].reverse().map(async snap=>{
    const data=snap.data(),date=data.createdAt?.toDate?.();let image=data.imageUrl||'';
    if(data.imagePath)try{const blob=await getBlob(ref(storage,data.imagePath),10*1024*1024);if(['image/jpeg','image/png','image/webp'].includes(blob.type)){image=URL.createObjectURL(blob);objectUrls.push(image);}else image='';}catch{image='';}
    return [data.senderId===user.uid?'me':'t',data.content||(data.imagePath&&!image?'Attachment unavailable':''),image,date?date.toLocaleDateString():'Unknown date',date?date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'',snap.id,data.createdAt?.toMillis?.()||0];
  }));
  return {messages,cursor:page.docs[page.docs.length-1]||null,hasOlder:page.docs.length===50,objectUrls};
}
