// src/redux/store.js
import { createStore, applyMiddleware, combineReducers } from "redux";
import thunk from "redux-thunk";
import { authReducer } from "./reducer/authReducer";
import { SignReducer, TopSignUsersReducer } from "./reducer/signReducer";

const rootReducer = combineReducers({
  auth: authReducer,
  signData: SignReducer,
  topUsers: TopSignUsersReducer,
});

const store = createStore(rootReducer, applyMiddleware(thunk));

export default store;
