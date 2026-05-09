// src/redux/actions/signdataaction.js

import { db } from "../../firebase";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";

// ===================
// ACTION TYPES
// ===================
export const SIGNDATA_LOADING = "SIGNDATA_LOADING";
export const SIGNDATA_SUCCESS = "SIGNDATA_SUCCESS";
export const SIGNDATA_FAIL = "SIGNDATA_FAIL";

export const TOPUSERS_SUCCESS = "TOPUSERS_SUCCESS";
export const TOPUSERS_FAIL = "TOPUSERS_FAIL";

export const PRACTICE_ATTEMPT_ADD = "PRACTICE_ATTEMPT_ADD";

// ===================
// OPTIONAL: store attempts locally
// ===================
export const savePracticeAttempt = (payload) => (dispatch) => {
  dispatch({ type: PRACTICE_ATTEMPT_ADD, payload });
};

// ===================
// ADD SESSION + UPDATE USER TOTALS
// ===================
export const addSignData = (payload) => async (dispatch, getState) => {
  try {
    const state = getState();
    const authUser = state.auth?.user;

    const userId =
      payload.userId ||
      authUser?.userId ||
      authUser?.uid ||
      authUser?.id;

    if (!userId) {
      throw new Error("addSignData: userId is missing.");
    }

    const signsPerformed = Array.isArray(payload.signsPerformed)
      ? payload.signsPerformed
      : [];

    const stats = {
      attempts: Number(payload.stats?.attempts || 0),
      matches: Number(payload.stats?.matches || 0),
      totalPoints: Number(payload.stats?.totalPoints || 0),
    };

    const createdAtISO = payload.createdAt || new Date().toISOString();

    const sessionDoc = {
      createdAt: serverTimestamp(),
      createdAtISO,
      id: payload.id,
      mode: payload.mode || "detect",
      secondsSpent: Number(payload.secondsSpent || 0),
      userId,
      username:
        payload.username ||
        authUser?.name ||
        authUser?.displayName ||
        "Unknown",
      signsPerformed,
      stats,
    };

    await addDoc(collection(db, "sessions"), sessionDoc);

    if (sessionDoc.mode === "practice") {
      const userRef = doc(db, "users", userId);

      await setDoc(
        userRef,
        {
          uid: userId,
          username: sessionDoc.username,
          createdAt: serverTimestamp(),
          createdAtISO,
          practiceAttempts: 0,
          practiceMatches: 0,
          totalPoints: 0,
        },
        { merge: true }
      );

      await updateDoc(userRef, {
        username: sessionDoc.username,
        practiceAttempts: increment(stats.attempts),
        practiceMatches: increment(stats.matches),
        totalPoints: increment(stats.totalPoints),
      });
    }

    dispatch(getSignData(userId));
    dispatch(getTopUsers());
  } catch (err) {
    console.error("❌ addSignData failed:", err);
    alert("addSignData failed: " + (err?.message || String(err)));
  }
};

// ===================
// GET SESSIONS FOR CURRENT USER ONLY
// ===================
export const getSignData = (explicitUserId = null) => async (dispatch, getState) => {
  try {
    dispatch({ type: SIGNDATA_LOADING });

    const state = getState();
    const user = state.auth?.user;

    const userId =
      explicitUserId ||
      user?.userId ||
      user?.uid ||
      user?.id;

    if (!userId) {
      dispatch({ type: SIGNDATA_SUCCESS, payload: [] });
      return;
    }

    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    const userData = userSnap.exists() ? userSnap.data() : null;
    const userCreatedAtISO = userData?.createdAtISO || null;

    const userCreatedAtMs = userCreatedAtISO
      ? new Date(userCreatedAtISO).getTime()
      : 0;

    const q = query(
      collection(db, "sessions"),
      where("userId", "==", userId)
    );

    const snap = await getDocs(q);

    const list = snap.docs
      .map((d) => ({
        _docId: d.id,
        ...d.data(),
      }))
      .filter((item) => item?.userId === userId)
      .filter((item) => {
        if (!userCreatedAtMs) return true;

        const sessionMs = item?.createdAtISO
          ? new Date(item.createdAtISO).getTime()
          : 0;

        return sessionMs >= userCreatedAtMs;
      })
      .sort((a, b) => {
        const aTime = a?.createdAtISO ? new Date(a.createdAtISO).getTime() : 0;
        const bTime = b?.createdAtISO ? new Date(b.createdAtISO).getTime() : 0;
        return bTime - aTime;
      });

    dispatch({ type: SIGNDATA_SUCCESS, payload: list });
  } catch (err) {
    console.error("getSignData failed:", err);
    dispatch({ type: SIGNDATA_FAIL, payload: err?.message || String(err) });
  }
};

// ===================
// GET LEADERBOARD
// ===================
export const getTopUsers = () => async (dispatch) => {
  try {
    const q = query(
      collection(db, "users"),
      orderBy("totalPoints", "desc"),
      limit(10)
    );

    const snap = await getDocs(q);

    const list = snap.docs.map((d, idx) => ({
      uid: d.id,
      ...d.data(),
      rank: idx + 1,
    }));

    dispatch({ type: TOPUSERS_SUCCESS, payload: list });
  } catch (err) {
    console.error("getTopUsers failed:", err);
    dispatch({ type: TOPUSERS_FAIL, payload: err?.message || String(err) });
  }
};