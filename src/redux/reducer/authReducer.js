import {
  LOAD_PROF,
  LOGIN_FAIL,
  LOGIN_REQ,
  LOGIN_SUCCESS,
  LOGOUT,
  LOAD_SESSION,
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

    case LOAD_SESSION:
      return {
        ...state,
        accessToken: action.payload.accessToken,
        user: action.payload.user,
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
        loading: false,
        error: null,
      };

    default:
      return state;
  }
};