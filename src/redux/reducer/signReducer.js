import {
  SIGNDATA_LOADING,
  SIGNDATA_SUCCESS,
  SIGNDATA_FAIL,
  TOPUSERS_SUCCESS,
  TOPUSERS_FAIL,
} from "../actions/signdataaction";

const initialState = {
  loading: false,
  signDataList: [],
  error: null,

  topUsers: [],
  topUsersError: null,
};

export default function signReducer(state = initialState, action) {
  switch (action.type) {
    case SIGNDATA_LOADING:
      return { ...state, loading: true, error: null };

    case SIGNDATA_SUCCESS:
      return { ...state, loading: false, signDataList: action.payload || [], error: null };

    case SIGNDATA_FAIL:
      return { ...state, loading: false, error: action.payload };

    case TOPUSERS_SUCCESS:
      return { ...state, topUsers: action.payload || [], topUsersError: null };

    case TOPUSERS_FAIL:
      return { ...state, topUsersError: action.payload };

    default:
      return state;
  }
}