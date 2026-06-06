// src/redux/actions/signdataaction.js

import { db } from "../../firebase";
import {
  collection,
  addDoc,
  getDocsFromServer,
  query,
  where,
  orderBy,
  limit,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  deleteDoc,
  increment,
} from "firebase/firestore";

export const SIGNDATA_LOADING = "SIGNDATA_LOADING";
export const SIGNDATA_SUCCESS = "SIGNDATA_SUCCESS";
export const SIGNDATA_FAIL = "SIGNDATA_FAIL";

export const TOPUSERS_SUCCESS = "TOPUSERS_SUCCESS";
export const TOPUSERS_FAIL = "TOPUSERS_FAIL";

export const PRACTICE_ATTEMPT_ADD = "PRACTICE_ATTEMPT_ADD";

export const savePracticeAttempt = (payload) => (dispatch) => {
  dispatch({ type: PRACTICE_ATTEMPT_ADD, payload });
};

const getUserIdFromAuth = (authUser) =>
  authUser?.userId || authUser?.uid || authUser?.id || null;

const normalizeSignsPerformed = (signsPerformed) => {
  if (!Array.isArray(signsPerformed)) return [];

  return signsPerformed
    .filter((item) => item?.SignDetected || item?.signDetected)
    .map((item) => ({
      SignDetected: item.SignDetected || item.signDetected,
      count: Number(item.count || 0),
    }))
    .filter((item) => item.count > 0);
};

const countMatchedSigns = (signsPerformed) => {
  return signsPerformed.reduce(
    (acc, item) => acc + (Number(item.count) || 0),
    0
  );
};

export const addSignData = (payload) => async (dispatch, getState) => {
  try {
    const state = getState();
    const authUser = state.auth?.user;

    const userId = payload.userId || getUserIdFromAuth(authUser);

    if (!userId) {
      throw new Error("addSignData: userId is missing.");
    }

    const mode = payload.mode || "detect";
    const signsPerformed = normalizeSignsPerformed(payload.signsPerformed);
    const matchedSignsCount = countMatchedSigns(signsPerformed);

    const rawAttempts = Number(payload.stats?.attempts ?? 0);
    const rawMatches = Number(payload.stats?.matches ?? 0);
    const rawTotalPoints = Number(payload.stats?.totalPoints ?? 0);

    const stats =
      mode === "practice"
        ? {
            attempts: rawAttempts,
            matches: matchedSignsCount,
            totalPoints: rawTotalPoints,
          }
        : {
            attempts: rawAttempts,
            matches: rawMatches,
            totalPoints: rawTotalPoints,
          };

    const createdAtISO = payload.createdAt || new Date().toISOString();

    const sessionDoc = {
      createdAt: serverTimestamp(),
      createdAtISO,
      id: payload.id,
      mode,
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

    console.log("[ADD SIGN DATA] before save", {
      mode,
      userId,
      signsPerformed,
      matchedSignsCount,
      rawStatsFromPayload: payload.stats,
      finalStatsSaved: stats,
    });

    const sessionRef = await addDoc(collection(db, "sessions"), sessionDoc);

    console.log("[ADD SIGN DATA] saved in Firestore", {
      firestoreDocId: sessionRef.id,
      sessionDoc,
    });

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

      console.log("[ADD SIGN DATA] user totals updated", {
        userId,
        incrementedAttempts: stats.attempts,
        incrementedMatches: stats.matches,
        incrementedPoints: stats.totalPoints,
      });
    }

    dispatch(getSignData(userId));
    dispatch(getTopUsers());
  } catch (err) {
    console.error("❌ addSignData failed:", err);
    alert("addSignData failed: " + (err?.message || String(err)));
  }
};

export const getSignData =
  (explicitUserId = null) =>
  async (dispatch, getState) => {
    try {
      dispatch({ type: SIGNDATA_LOADING });

      const state = getState();
      const user = state.auth?.user;

      const userId = explicitUserId || getUserIdFromAuth(user);

      if (!userId) {
        dispatch({ type: SIGNDATA_SUCCESS, payload: [] });
        return;
      }

      const q = query(
        collection(db, "sessions"),
        where("userId", "==", userId)
      );

      const snap = await getDocsFromServer(q);

      const list = snap.docs
        .map((sessionDocSnap) => {
          const session = {
            _docId: sessionDocSnap.id,
            ...sessionDocSnap.data(),
          };

          const signsPerformed = normalizeSignsPerformed(session.signsPerformed);
          const matchedSignsCount = countMatchedSigns(signsPerformed);

          const stats =
            session.stats && typeof session.stats === "object"
              ? session.stats
              : {};

          const normalizedStats =
            session.mode === "practice"
              ? {
                  attempts: Number(stats.attempts ?? 0),
                  matches: Number(stats.matches ?? matchedSignsCount),
                  totalPoints: Number(stats.totalPoints ?? 0),
                }
              : {
                  attempts: Number(stats.attempts ?? 0),
                  matches: Number(stats.matches ?? 0),
                  totalPoints: Number(stats.totalPoints ?? 0),
                };

          if (session.mode === "practice") {
            console.log("[GET SIGN DATA] practice session loaded", {
              docId: sessionDocSnap.id,
              createdAtISO: session.createdAtISO,
              signsPerformed,
              matchedSignsCount,
              savedStats: stats,
              normalizedStats,
            });
          }

          return {
            ...session,
            signsPerformed,
            stats: normalizedStats,
          };
        })
        .sort((a, b) => {
          const aTime = a?.createdAtISO
            ? new Date(a.createdAtISO).getTime()
            : 0;

          const bTime = b?.createdAtISO
            ? new Date(b.createdAtISO).getTime()
            : 0;

          return bTime - aTime;
        });

      console.log("[GET SIGN DATA] all sessions loaded", {
        userId,
        totalSessions: list.length,
        practiceSessions: list.filter((s) => s.mode === "practice").length,
      });

      dispatch({ type: SIGNDATA_SUCCESS, payload: list });
    } catch (err) {
      console.error("getSignData failed:", err);
      dispatch({
        type: SIGNDATA_FAIL,
        payload: err?.message || String(err),
      });
    }
  };

export const getTopUsers = () => async (dispatch) => {
  try {
    const q = query(
      collection(db, "users"),
      orderBy("totalPoints", "desc"),
      limit(10)
    );

    const snap = await getDocsFromServer(q);

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

export const deleteTodayPracticeSessions =
  (userId) =>
  async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, "sessions"),
      where("userId", "==", userId),
      where("mode", "==", "practice")
    );

    const snap = await getDocsFromServer(q);

    const todayDocs = snap.docs.filter((document) => {
      const data = document.data();
      const createdAtISO = data?.createdAtISO;

      if (!createdAtISO) return false;

      const createdAt = new Date(createdAtISO);

      return createdAt >= start && createdAt <= end;
    });

    await Promise.all(
      todayDocs.map((document) =>
        deleteDoc(doc(db, "sessions", document.id))
      )
    );

    console.log(`[CLEANUP TODAY] Deleted ${todayDocs.length} practice sessions from today`);
  };