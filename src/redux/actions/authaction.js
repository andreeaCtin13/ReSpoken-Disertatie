// src/redux/actions/authaction.js
import { auth, googleProvider } from "../../firebase";
import Cookies from "js-cookie";
import {
  LOAD_PROF,
  LOGIN_FAIL,
  LOGIN_REQ,
  LOGIN_SUCCESS,
  LOGOUT,
} from "../action-types";
import { signInWithPopup, signOut } from "firebase/auth";

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
    };

    Cookies.set("sign-language-ai-access-token", accessToken, { expires: 2 });
    Cookies.set("sign-language-ai-user", JSON.stringify(profile), {
      expires: 2,
    });

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
  await signOut(auth);

  dispatch({ type: LOGOUT });

  Cookies.remove("sign-language-ai-access-token");
  Cookies.remove("sign-language-ai-user");
};
