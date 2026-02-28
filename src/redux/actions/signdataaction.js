// src/redux/actions/signdataaction.js

import { db } from "../../firebase";
import {
  collection,
  addDoc,
  getDocs,
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

// (optional) you can ignore this if you don't use it anymore
export const PRACTICE_ATTEMPT_ADD = "PRACTICE_ATTEMPT_ADD";

// ===================
// OPTIONAL: store attempts locally (not required)
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
      authUser?.uid ||
      authUser?.id ||
      authUser?.userId;

    console.log("[addSignData] payload =", payload);
    console.log("[addSignData] authUser =", authUser);
    console.log("[addSignData] resolved userId =", userId);

    if (!userId) {
      throw new Error("addSignData: userId is missing (auth user not loaded?)");
    }

    const signsPerformed = Array.isArray(payload.signsPerformed) ? payload.signsPerformed : [];
    const stats = {
      attempts: Number(payload.stats?.attempts || 0),
      matches: Number(payload.stats?.matches || 0),
      totalPoints: Number(payload.stats?.totalPoints || 0),
    };

    const sessionDoc = {
      createdAt: serverTimestamp(),
      createdAtISO: payload.createdAt || new Date().toISOString(),
      id: payload.id,
      mode: payload.mode || "detect",
      secondsSpent: Number(payload.secondsSpent || 0),

      userId,
      username: payload.username || authUser?.name || "Unknown",

      signsPerformed,
      stats,
    };

    console.log("[addSignData] writing sessionDoc =", sessionDoc);

    // 1) write session
    await addDoc(collection(db, "sessions"), sessionDoc);

    // 2) update users totals for practice
    if (sessionDoc.mode === "practice") {
      const userRef = doc(db, "users", userId);

      // ensure document exists
      await setDoc(
        userRef,
        {
          uid: userId,
          username: sessionDoc.username,
          createdAt: serverTimestamp(),
          practiceAttempts: 0,
          practiceMatches: 0,
          totalPoints: 0,
        },
        { merge: true }
      );

      // increment totals
      await updateDoc(userRef, {
        practiceAttempts: increment(stats.attempts),
        practiceMatches: increment(stats.matches),
        totalPoints: increment(stats.totalPoints),
      });

      console.log("[addSignData] ✅ updated user totals", stats);
    }

    // refresh dashboard data
    dispatch(getSignData());
    dispatch(getTopUsers());
  } catch (err) {
    console.error("❌ addSignData failed:", err);
    // keep alert because you asked for "no thinking" + clear failure visibility
    alert("addSignData failed: " + (err?.message || String(err)));
  }
};

// ===================
// GET SESSIONS FOR CURRENT USER
// FIX: NO MORE "missing userId" ERROR
// ===================
export const getSignData = () => async (dispatch, getState) => {
  try {
    dispatch({ type: SIGNDATA_LOADING });

    const state = getState();
    const user = state.auth?.user;

    // ✅ robust extraction (matches addSignData)
    const userId = user?.uid || user?.id || user?.userId;

    // If auth not ready, just return empty list (don't break dashboard)
    if (!userId) {
      dispatch({ type: SIGNDATA_SUCCESS, payload: [] });
      return;
    }

    const q = query(collection(db, "sessions"), where("userId", "==", userId));
    const snap = await getDocs(q);

    const list = snap.docs.map((d) => ({ _docId: d.id, ...d.data() }));

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
    const q = query(collection(db, "users"), orderBy("totalPoints", "desc"), limit(10));
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