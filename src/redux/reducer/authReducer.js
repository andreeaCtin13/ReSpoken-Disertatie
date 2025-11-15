// src/redux/reducer/authReducer.js
import {
  LOAD_PROF,
  LOGIN_FAIL,
  LOGIN_REQ,
  LOGIN_SUCCESS,
  LOGOUT,
} from "../action-types";

const initialState = {
  accessToken: null,
  user: null,
  loading: false,
  error: null,
};

export const authReducer = (state = initialState, action) => {
  switch (action.type) {
    case LOGIN_REQ:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case LOGIN_SUCCESS:
      return {
        ...state,
        loading: false,
        accessToken: action.payload,
      };

    case LOAD_PROF:
      return {
        ...state,
        user: action.payload,
      };

    case LOGIN_FAIL:
      return {
        ...state,
        loading: false,
        error: action.payload,
      };

    case LOGOUT:
      return {
        ...state,
        accessToken: null,
        user: null,
      };

    default:
      return state;
  }
};
