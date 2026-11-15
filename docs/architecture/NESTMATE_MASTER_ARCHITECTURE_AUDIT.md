# NESTMATE — MASTER ARCHITECTURAL, DATA MODEL, MATCHING ENGINE & LIFECYCLE AUDIT

> **Document Status**: Complete Read-Only Technical Audit & Target Blueprint  
> **Target Version**: `redesign-v2`  
> **Environment**: Google Cloud Firestore, Firebase Cloud Functions, React + TypeScript + Vite  

---

## 1. Codebase Architecture & Data Model Audit

### 1.1 Collections & Schema Partitioning

NestMate’s backend persistence is partitioned across five core Firestore collections, enforcing data privacy and access security:

```
Firestore Database Root
├── users/ {uid}                   <-- Public identity, seeker preferences, habit quiz
├── privateUserData/ {uid}         <-- Strictly isolated contact information (phone, email)
├── listings/ {listingId}          <-- Property/room inventory & host-specific rules
├── applications/ {applicationId}  <-- Formal room application workflow records
├── applicationLocks/ {lockKey}    <-- Atomic concurrency locks: {listingId}___{applicantUid}
├── chatRooms/ {roomId}            <-- Direct messaging threads & interactive application cards
├── acceptedPairs/ {grantKey}      <-- Mutual communication grants between flatmate peers
└── listingPairs/ {grantKey}       <-- Mutual communication grants scoped to specific room listings
```

#### Detailed Schema Breakdown

| Collection / Path | Purpose & Access Boundary | Schema & Fields Stored |
| :--- | :--- | :--- |
| **`users/{uid}`** | **Public User Profile & Seeker Persona**<br>*(Public read via discovery gateway; update restricted to owner)* | • **Identity**: `uid`, `name`, `email`, `avatar`, `bio`, `profession`, `city`, `localities`, `gender`, `age`<br>• **Lifecycle Flags**: `status: 'active'`, `onboardingComplete` (boolean), `roommateDiscoveryEnabled` (boolean), `isLandlord` (boolean), `verificationLevel`<br>• **Seeker Criteria (`housingPreferences`)**:<br>  - `activeIntents`: `('find_room' \| 'team_up' \| 'have_room')[]`<br>  - `budgetMin`, `budgetMax`<br>  - `preferredCities`: `string[]`<br>  - `preferredLocalities`: `string[]`<br>  - `preferredRoomTypes`: `string[]`<br>  - `roommateGenderPreference`: `'Any' \| 'Female' \| 'Male'`<br>  - `moveInDate`: ISO date string<br>• **Habit Quiz (`quizAnswers`)**:<br>  - `diet` / `food_pref`: `'veg' \| 'non_veg' \| 'egg' \| 'flexible'`<br>  - `smoke` / `smoking`: `'never' \| 'outside' \| 'regular'`<br>  - `sleep` / `sleep_time`: `'before_10' \| 'after_12' \| 'flexible'`<br>  - `clean` / `cleanliness`: `'very' \| 'moderate' \| 'relaxed'`<br>  - `guests`: `'rarely' \| 'weekends' \| 'frequent'`<br>  - `pets`: `'no' \| 'yes' \| 'has_pets'` |
| **`privateUserData/{uid}`** | **Protected Contact Information**<br>*(Strictly isolated; readable ONLY by account owner or admin)* | • `phone`: E.164 phone string<br>• `email`: authenticated Google/password email<br>• `workEmail`: verified employer domain email<br>• `whatsappNumber`: opt-in messaging contact<br>• `updatedAt`: server timestamp |
| **`listings/{listingId}`** | **Room & Property Inventory**<br>*(Public read if active; editable only by `ownerId`)* | • **Property Specs**: `ownerId`, `title`, `description`, `city`, `locality`, `address`, `flatType` (`1BHK`, `2BHK`, etc.), `roomType` (`private` \| `shared`), `furnishing`, `images: string[]`<br>• **Pricing**: `monthlyRent`, `deposit`, `partnerShare`<br>• **Host Status**: `isLiveInRoom` (boolean — whether host resides on property)<br>• **Host Tenant Rules**: `preferredGender`, `houseRules: string[]` (e.g. veg only, no smoking), `screeningQuestions: string[]`<br>• **Lifecycle**: `status: 'active' \| 'pending_verification' \| 'draft' \| 'archived'` |
| **`applications/{appId}`** | **Application Workflow States**<br>*(Readable by applicant & listing owner)* | • `listingId`, `applicantId`, `ownerId`<br>• `status: 'pending' \| 'shortlisted' \| 'selected' \| 'rejected' \| 'withdrawn'`<br>• `screeningAnswers: Record<string, string>`<br>• `note`, `moveIn`, `matchScore`, `matchReasons` |

---

### 1.2 Who Owns What Preference? (The 3-Way Separation)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        USER PROFILE: users/{uid}                       │
│                                                                        │
│  1. WHO I AM (Personal Identity & Habits)                              │
│     • gender: "male"                                                   │
│     • profession: "Software Engineer"                                  │
│     • quizAnswers: { diet: "non_veg", smoking: "no", sleep: "late" }   │
│                                                                        │
│  2. WHAT I AM LOOKING FOR (Seeker Matching Criteria)                   │
│     • housingPreferences.budgetMax: 20000                              │
│     • housingPreferences.preferredLocalities: ["Koramangala", "HSR"]   │
│     • housingPreferences.roommateGenderPreference: "male"              │
│     • housingPreferences.activeIntents: ["find_room"]                  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   │ (Decoupled & Isolated)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   ROOM LISTING: listings/{listingId}                   │
│                                                                        │
│  3. WHO I WANT IN MY ROOM (Host / Property Rules)                      │
│     • monthlyRent: 15000, deposit: 30000                               │
│     • preferredGender: "female" (e.g. female-only flat)                │
│     • houseRules: ["veg only", "no smoking", "no pets"]                │
│     • isLiveInRoom: true (Host lives in room 1, renting out room 2)    │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Who I am (Personal Habits & Identity)**: Stored in `users/{uid}.quizAnswers` and top-level fields (`gender`, `profession`, `bio`). Shared with prospective roommates to evaluate compatibility.
2. **What I am looking for (Seeker Preferences)**: Stored in `users/{uid}.housingPreferences`. Used exclusively by the seeker recommendation engine to match rooms against personal budget, localities, and room type desires.
3. **Who I want in my room (Room Lister / Property Rules)**: Stored strictly on the listing in `listings/{listingId}`. Listers and Seekers do **NOT** share preference fields.
4. **Data Isolation Verdict**: Modifying seeker preferences never touches or corrupts existing room listings. Modifying listing rent or house rules never corrupts seeker profile criteria.

---

## 2. Onboarding, Google Sign-In & Preferences Banner

### 2.1 Post-Login Routing & Redirection
- **Auth Trigger**: Handled in `app/src/hooks/useAuth.ts:38–89` via `loginWithGoogle()` (`signInWithPopup(auth, googleProvider)`).
- **Auto-Provisioning**: If the user's Firestore document does not exist, `useAuth.ts` auto-creates a skeleton profile with `status: 'active'`, `onboardingComplete: false`, and `roommateDiscoveryEnabled: false`.
- **Destination**: The user is **never forced** into a blocking full-page modal. They land directly on `/explore` and can immediately browse all listings in Bengaluru/selected city.

### 2.2 The Matching Preferences Banner
- **Rendering Component**: Defined in `app/src/lib/exploreEngine.js:2322–2355` (`nm-pref-banner` / `ob-banner`).
- **Exact Trigger Condition**:
  ```javascript
  N === "explore" && 
  authUser && 
  !isProfileCalibrated() && 
  hasActiveSeekerIntent(currentProfile, MY) && 
  !isPrefsSnoozed()
  ```
- **Accuracy & Non-Blocking Nature**:
  - The banner is a **soft prompt**, not a hard block.
  - All room cards are loaded and visible underneath.
  - Room cards show neutral match badges (`--%`) rather than misleading personalized scores until the user sets their budget and localities.

### 2.3 The "Later" / Dismiss Button
- **Click Handlers**:
  - Close button (`×`): `window.__nmSnoozePrefs(24)` (snoozes for 24 hours).
  - "Remind me later" button: `window.__nmSnoozePrefs(48)` (snoozes for 48 hours).
- **State Storage**: Stored strictly in browser `localStorage` (`nm_prefs_snooze_<uid>`). No wasteful Firestore network writes.
- **Graceful Degradation**: Banner smoothly unmounts. User continues browsing with neutral badges (`--%`). No app features break or lock.

---

## 3. Deep-Dive into the Matching & Scoring Engine

### 3.1 Exact Match Score Formulas

#### A. Room Match Score (Seeker $\longleftrightarrow$ Listing)
Evaluated by `calculateCanonicalRoomCompatibility()` / `getRoomMatchReasons()` (`app/src/lib/matching.ts:337–518`):

$$\text{Total Base Score} = \text{Budget (25)} + \text{Location (20)} + \text{Gender (20)} + \text{Rules/Habits (20)} + \text{Preferences (15)}$$

1. **Budget Fit (Max 25 pts)**:
   - Budget $\ge$ Rent: **25 pts**
   - Budget $\ge$ Rent $\times 0.85$: **20 pts**
   - Budget $\ge$ Rent $\times 0.75$: **12 pts**
   - Budget $<$ Rent $\times 0.75$: **0 pts**
2. **Location & Locality Fit (Max 20 pts)**:
   - Same city: **14 pts**
   - Locality matches seeker's preferred list: **20 pts** (+6 locality bonus)
   - Different cities: **0 pts**
3. **Gender Requirement Fit (Max 20 pts)**:
   - Listing specifies gender and seeker matches: **20 pts**
   - Listing allows "Any" / "Co-ed": **20 pts**
   - Gender Mismatch: **0 pts** (also triggers hard score cap)
4. **House Rules & Habit Alignment (Max 20 pts)**:
   - Veg Kitchen match: **+5 pts**
   - Smoke-Free Home match: **+5 pts**
   - Pet Policy match: **+5 pts**
   - Host Lifestyle Quiz Overlap: up to **+5 pts** ($\frac{5 \times \text{same}}{\text{unionCount}}$)
5. **Preference Alignment (Max 15 pts)**:
   - Room Type Match: **+8 pts**
   - Occupancy Match: **+7 pts**

#### B. Roommate Match Score (Seeker A $\longleftrightarrow$ Seeker B)
Evaluated by `calculateProfileCompatibility()` (`app/src/lib/matching.ts:755–817`):

$$\text{Total Base Score} = \text{Location (25)} + \text{Budget (25)} + \text{Lifestyle (30)} + \text{RoomType (10)} + \text{Occupancy (10)}$$

1. **City & Locality (Max 25 pts)**: Same city = +15 pts; Overlapping preferred localities = +10 pts.
2. **Budget Proximity (Max 25 pts)**: $\text{Ratio} = \frac{\min(B_A, B_B)}{\max(B_A, B_B)}$; $\text{Score} = 25 \times \text{Ratio}$.
3. **Lifestyle Quiz Overlap (Max 30 pts)**: Identical answers on shared questions = $\frac{30 \times \text{same}}{\max(5, \text{unionKeys})}$.
4. **Room Type Overlap (Max 10 pts)**: Shared preferred room type = +10 pts.
5. **Occupancy Overlap (Max 10 pts)**: Same occupancy desire = +10 pts.

#### C. Hard Disqualifiers vs. Soft Penalties

| Condition | Penalty Type | Code Implementation |
| :--- | :--- | :--- |
| **Gender Mismatch** | **Hard Cap (40%)** | `if (genderMismatch) score = Math.min(40, score);` (`matching.ts:474`) |
| **City Mismatch** | **Hard Cap (60%) + 40% Penalty** | `if (ac && bc && ac !== bc) score = Math.min(60, score * 0.6);` (`matching.ts:475`) |
| **Budget Overage** | **Tiered Drop** | Drops from 25 to 20, 12, or 0 pts without zeroing other categories |
| **Uncalibrated Profile** | **Nullification (0%)** | `if (!calibrated) score = 0;` (`matching.ts:486`), displayed in UI as `--%` |

#### D. Calibration Check Requirements
In `matching.ts:283–298`, `isUserMatchingCalibrated(user)` returns `true` if and only if:
1. `user !== null`
2. `user.onboardingComplete !== false`
3. `hasActiveSeekerIntent(user) === true` (`'find_room'` or `'team_up'`)
4. `resolveSeekerBudget(user) > 0`
5. `resolveSeekerCity(user).length > 0`
6. `resolveSeekerLocalities(user).length >= 1`

---

## 4. Room Listing (`+` Button) & The Host 403 Lockout Bug

### 4.1 Room Listing Creation
The orange `+` button opens the 5-step wizard (`app/src/lib/exploreEngine.js:2480–2650`) and commits via `createNewListingBackend()` (`app/src/lib/nestmateBackend.ts:1229–1330`):
- Creates `listings/{listingId}` with property details, rent, and rules.
- Atomically updates `users/{uid}` using `writeBatch`:
  - Sets `isLandlord: true`
  - Adds `'have_room'` to `housingPreferences.activeIntents` via `arrayUnion`
  - Preserves all seeker budget and locality settings.

### 4.2 The Critical Bug: Room Host 403 Lockout
**Verified in Code**:
1. When a new user registers via Google Auth (`useAuth.ts:64`), their document is created with `onboardingComplete: false`.
2. The user lists a room via `+`. `createNewListingBackend()` sets `isLandlord: true` and `activeIntents: ['have_room']`, but **leaves `onboardingComplete: false`**.
3. When the user clicks the **"Roommates"** tab:
   - `exploreEngine.js` calls `loadRoommatesPage()` $\rightarrow$ `readDiscovery({ action: 'people' })`.
   - `discoveryGateway.js:321` calls `viewer(db, request.auth, true)` where `requireComplete = true`.
   - `discoveryGateway.js:69` executes:
     ```javascript
     if (!active(data) || (requireComplete && data.onboardingComplete !== true)) {
       fail('permission-denied', 'Complete an active profile first.');
     }
     ```
   - **Result**: The Cloud Function immediately responds with **HTTP 403 `permission-denied`**, locking the room host out of browsing roommates.

---

## 5. Post-Discovery Lifecycle (Apply $\rightarrow$ Chat $\rightarrow$ Contact Unlock)

```
Discovery Feed ──► Room Detail View ──► Click "Apply" Modal
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
          Answer Screening Questions                    Atomic Transaction:
          & Personal Note                               submitRoomApplication()
                                                              │
                      ┌───────────────────────────────────────┘
                      ▼
          1. applications/{appId} (status: 'pending')
          2. applicationLocks/{listingId}___{seekerUid} (idempotent lock)
          3. chatRooms/{roomId} (unlocked: false, inboxBox: 'requests')
          4. chatRooms/{roomId}/messages/app_{appId}_card (Interactive Card)
          5. notifications/{ownerId} (type: 'application')
                      │
                      ▼
          Host Inbox: [Requests Tab]
                      │
           ┌──────────┴──────────┐
           ▼                     ▼
     Click "Shortlist"     Click "Accept / Connect"
     (Status updates       (Atomic decideRoomApplication)
      in chat card)              │
                                 ▼
                     1. status: 'selected'
                     2. listingPairs/{seeker}_{owner} created
                     3. chatRooms/{roomId}.unlocked = true
                     4. Moves from 'requests' to 'chats' inbox
                     5. Messaging open! Exchange phone / schedule visit
```

### 5.1 Applying to a Room
- Executed by Cloud Function `submitRoomApplication` (`applicationChatService.js:135–437`).
- Active user can apply without completing seeker quiz.
- Commits application, lock, unverified chatRoom, and interactive in-chat card atomically.

### 5.2 Host Decision & Messaging Unlock
- Executed by Cloud Function `decideRoomApplication` (`applicationChatService.js:440–620`).
- Host accepts: status becomes `'selected'`, creates `listingPairs` bilateral grants, sets `chatRooms/{roomId}.unlocked = true`, and moves thread to active `'chats'` inbox.

### 5.3 Contact Privacy
- `privateUserData/{uid}` is strictly protected under `firestore.rules:236–239` (`allow read: if isOwner(userId) || isAdmin();`).
- Third parties can never directly read phone numbers or emails via Firestore queries. Contact exchange occurs safely inside unlocked chat threads.

---

## 6. Complete End-to-End Scenario Matrix

| Scenario | User Actions | Database Updates Committed | System State & Next Steps |
| :--- | :--- | :--- | :--- |
| **A. New Seeker (Fills immediately)** | Google login $\rightarrow$ clicks "Personalized Matching" $\rightarrow$ sets budget and localities | `users/{uid}`: `onboardingComplete: true`, `roommateDiscoveryEnabled: true`, `housingPreferences` populated | Banner permanently dismissed. Rooms display calibrated % match. Profile visible in Roommates tab. |
| **B. New Seeker (Clicks "Later")** | Google login $\rightarrow$ clicks "Remind me later" on banner | `localStorage`: `nm_prefs_snooze_<uid>` timestamp saved | Banner suppressed for 48 hours. Rooms display neutral `--% match`. Hidden from Roommates feed. |
| **C. New Lister (Posts room via `+`)** | Google login $\rightarrow$ clicks `+` $\rightarrow$ fills wizard $\rightarrow$ publishes | `listings/{id}` created; `users/{uid}`: `isLandlord: true`, `activeIntents: ['have_room']` | Room visible in "Rooms & flats". Host appears in Roommates tab with `Room available` badge (if `isLiveInRoom`). |
| **D. Dual-Intent User (Host + Seeker)** | Host with active room opens settings to find room in another city | `users/{uid}.housingPreferences`: `activeIntents: ['have_room', 'find_room']`, sets new budget | Listing untouched. Seeker matching scores activate for target city. |
| **E. Incomplete Profile visits Roommates** | User clicks "Roommates" before completing profile | Server returns 403 (guarded). Client catches response. | UI displays graceful banner: *"Complete your profile to unlock roommate discovery"*. |
| **F. User edits preferences in Settings** | Navigates to `/profile` $\rightarrow$ updates budget or diet | `users/{uid}.housingPreferences` & `quizAnswers` updated | Explore feed re-scores in memory instantly without network latency. |
| **G. Logged-out / Guest visitor** | Visits `/explore` without signing in | Public discovery query (no auth required for listings) | Browses rooms with neutral `--%` badges. Action buttons trigger login modal. |

---

## 7. Target Architecture & Implementation Plan

### 7.1 Progressive Disclosure (Zero 403 Errors)
1. **Auto-Complete Host Onboarding**: In `createNewListingBackend()`, atomically set `onboardingComplete: true` on `users/{uid}` when publishing a valid listing.
2. **Permissive Public People Browsing**: Update `discoveryGateway.js:69` so that uncalibrated viewers can browse public roommate cards with neutral badges (`--%`) rather than throwing an HTTP 403 error.

### 7.2 Multi-Intent Switcher
Expose interactive active intent chips on the Explore header:
```
[ 🏠 All Listings ]   [ 🛏️ Rooms & Flats ]   [ 👥 Roommates ]   [ 🏢 PG & Coliving ]
──────────────────────────────────────────────────────────────────────────────────
Active Goal: (● Looking for a Room)  (○ Offering a Spare Room)  (○ Teaming Up)
```

### 7.3 Transparent "Why this %?" Match Breakdown
Add an interactive 1-click modal to room cards displaying the exact 5-factor scoring breakdown:
- Budget Fit (25 pts)
- Location & Locality Fit (20 pts)
- Gender Requirement Fit (20 pts)
- House Rules & Habits Alignment (20 pts)
- Room & Occupancy Preferences (15 pts)
