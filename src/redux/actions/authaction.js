import { auth, googleProvider } from "../../firebase";
import Cookies from "js-cookie";
import {
  LOAD_PROF,
  LOGIN_FAIL,
  LOGIN_REQ,
  LOGIN_SUCCESS,
  LOGOUT,
  LOAD_SESSION,
} from "../action-types";
import { signInWithPopup, signOut } from "firebase/auth";

const ACCESS_TOKEN_COOKIE = "sign-language-ai-access-token";
const USER_COOKIE = "sign-language-ai-user";

const getTwoHoursFromNow = () => {
  return new Date(Date.now() + 2 * 60 * 60 * 1000);
};

const cookieOptions = {
  expires: getTwoHoursFromNow(),
  sameSite: "Lax",
};

export const loadSessionFromCookies = () => (dispatch) => {
  const accessToken = Cookies.get(ACCESS_TOKEN_COOKIE);
  const userCookie = Cookies.get(USER_COOKIE);

  if (!accessToken || !userCookie) {
    return;
  }

  try {
    const user = JSON.parse(userCookie);

    dispatch({
      type: LOAD_SESSION,
      payload: {
        accessToken,
        user,
      },
    });
  } catch (error) {
    Cookies.remove(ACCESS_TOKEN_COOKIE);
    Cookies.remove(USER_COOKIE);
  }
};

export const login = () => async (dispatch) => {
  try {
    dispatch({ type: LOGIN_REQ });

    const res = await signInWithPopup(auth, googleProvider);

    const credential = res._tokenResponse;
    const accessToken = credential.oauthAccessToken || credential.idToken;

    const profile = {
      name: res.user.displayName,
      photoURL: res.user.photoURL,
      userId: res.user.uid,
      email: res.user.email,
    };

    Cookies.set(ACCESS_TOKEN_COOKIE, accessToken, cookieOptions);
    Cookies.set(USER_COOKIE, JSON.stringify(profile), cookieOptions);

    dispatch({
      type: LOGIN_SUCCESS,
      payload: accessToken,
    });

    dispatch({
      type: LOAD_PROF,
      payload: profile,
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    dispatch({
      type: LOGIN_FAIL,
      payload: error.message,
    });
  }
};

export const logout = () => async (dispatch) => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("LOGOUT ERROR:", error);
  }

  Cookies.remove("sign-language-ai-access-token");
  Cookies.remove("sign-language-ai-user");

  localStorage.clear();
  sessionStorage.clear();

  dispatch({ type: LOGOUT });
};