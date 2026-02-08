import { getAuth } from "firebase/auth";
import {
  collection,
  addDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  setDoc,
  getDoc,
  updateDoc,
  increment,
} from "firebase/firestore";

import { db } from "../../firebase"; // <-- SCHIMBĂ dacă ai alt path

export const ADD_SIGNDATA_REQUEST = "ADD_SIGNDATA_REQUEST";
export const ADD_SIGNDATA_SUCCESS = "ADD_SIGNDATA_SUCCESS";
export const ADD_SIGNDATA_FAIL = "ADD_SIGNDATA_FAIL";

export const GET_SIGNDATA_REQUEST = "GET_SIGNDATA_REQUEST";
export const GET_SIGNDATA_SUCCESS = "GET_SIGNDATA_SUCCESS";
export const GET_SIGNDATA_FAIL = "GET_SIGNDATA_FAIL";

export const GET_TOPUSERS_REQUEST = "GET_TOPUSERS_REQUEST";
export const GET_TOPUSERS_SUCCESS = "GET_TOPUSERS_SUCCESS";
export const GET_TOPUSERS_FAIL = "GET_TOPUSERS_FAIL";

// ---------- helpers ----------
async function ensureUserDoc({ uid, username, photoURL }) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid,
      username: username || "Unknown",
      photoURL: photoURL || "",
      createdAt: serverTimestamp(),
      totalPoints: 0,
      practiceAttempts: 0,
      practiceMatches: 0,
    });
  }
}

function getUidAndProfile(getState) {
  const authFirebase = getAuth();
  const firebaseUser = authFirebase.currentUser;

  if (!firebaseUser) {
    console.error("❌ Firebase Auth currentUser is NULL (not logged in?)");
    return { uid: null, username: null, photoURL: null };
  }

  const state = getState?.();
  const reduxUser = state?.auth?.user;

  const uid = firebaseUser.uid;
  const username = reduxUser?.name || firebaseUser.displayName || "Unknown";
  const photoURL = reduxUser?.photoURL || firebaseUser.photoURL || "";

  return { uid, username, photoURL };
}

// ---------- actions ----------
export const addSignData = (data) => async (dispatch, getState) => {
  try {
    dispatch({ type: ADD_SIGNDATA_REQUEST });

    const { uid, username, photoURL } = getUidAndProfile(getState);
    if (!uid) throw new Error("No UID - user not logged in");

    await ensureUserDoc({ uid, username, photoURL });

    const payload = {
      ...data,
      userId: uid,
      username: username || data.username || "Unknown",
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, "sessions"), payload);

    console.log("✅ Firestore write OK: sessions", payload);

    dispatch({ type: ADD_SIGNDATA_SUCCESS });
  } catch (err) {
    console.error("❌ addSignData failed:", err);
    dispatch({ type: ADD_SIGNDATA_FAIL, payload: err?.message || String(err) });
  }
};
export const getSignData = () => async (dispatch, getState) => {
  try {
    dispatch({ type: GET_SIGNDATA_REQUEST });

    const { uid } = getUidAndProfile(getState);
    if (!uid) throw new Error("No UID - user not logged in");

    // ✅ no orderBy => no composite index needed
    const q = query(
      collection(db, "sessions"),
      where("userId", "==", uid),
      limit(200),
    );

    const snap = await getDocs(q);
    const items = snap.docs.map((d) => ({ _docId: d.id, ...d.data() }));

    // sort in JS instead of Firestore
    items.sort((a, b) => {
      const ta = a.createdAt?.seconds ? a.createdAt.seconds : 0;
      const tb = b.createdAt?.seconds ? b.createdAt.seconds : 0;
      return tb - ta;
    });

    dispatch({ type: GET_SIGNDATA_SUCCESS, payload: items });
  } catch (err) {
    console.error("❌ getSignData failed:", err);
    dispatch({ type: GET_SIGNDATA_FAIL, payload: err?.message || String(err) });
  }
};

export const getTopUsers = () => async (dispatch) => {
  try {
    dispatch({ type: GET_TOPUSERS_REQUEST });

    const q = query(
      collection(db, "users"),
      orderBy("totalPoints", "desc"),
      limit(10),
    );

    const snap = await getDocs(q);
    const users = snap.docs.map((d, idx) => {
      const u = d.data();
      return {
        rank: idx + 1,
        username: u.username || "Unknown",
        totalPoints: u.totalPoints || 0,
        photoURL: u.photoURL || "",
      };
    });

    console.log("✅ Firestore read OK: topUsers count =", users.length);

    dispatch({ type: GET_TOPUSERS_SUCCESS, payload: users });
  } catch (err) {
    console.error("❌ getTopUsers failed:", err);
    dispatch({ type: GET_TOPUSERS_FAIL, payload: err?.message || String(err) });
  }
};

export const savePracticeAttempt =
  ({ targetSign, detectedSign, score, matched, points }) =>
  async (dispatch, getState) => {
    try {
      const { uid, username, photoURL } = getUidAndProfile(getState);
      if (!uid) return;

      await ensureUserDoc({ uid, username, photoURL });

      await addDoc(collection(db, "practice_attempts"), {
        userId: uid,
        username,
        targetSign,
        detectedSign,
        score,
        matched: !!matched,
        points: Number(points) || 0,
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "users", uid), {
        totalPoints: increment(Number(points) || 0),
        practiceAttempts: increment(1),
        practiceMatches: increment(matched ? 1 : 0),
      });

      console.log("✅ Firestore write OK: practice_attempts + users update");
    } catch (err) {
      console.error("❌ savePracticeAttempt failed:", err);
    }
  };
