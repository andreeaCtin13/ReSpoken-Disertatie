import React, { useEffect, useMemo, useRef, useState } from "react";
import "./Navbar.css";
import { Link, NavLink } from "react-router-dom";
import { RiMenu3Line, RiCloseLine } from "react-icons/ri";
import { useDispatch, useSelector } from "react-redux";
import {
  login,
  logout,
  loadSessionFromCookies,
} from "../../redux/actions/authaction";

// 👉 pune aici un default avatar (poți schimba linkul)
const DEFAULT_AVATAR =
  "https://cdn-icons-png.flaticon.com/512/149/149071.png";

const Navbar = ({ notifyMsg }) => {
  const [toggle, setToggle] = useState(false);
  const dispatch = useDispatch();

  const { user, accessToken, loading, error } = useSelector(
    (state) => state.auth
  );

  const isLoggedIn = useMemo(() => !!accessToken && !!user, [accessToken, user]);
  const welcomedRef = useRef(false);

  useEffect(() => {
    dispatch(loadSessionFromCookies());
  }, [dispatch]);

  useEffect(() => {
    if (isLoggedIn && !welcomedRef.current) {
      welcomedRef.current = true;
      notifyMsg?.(
        "success",
        `Welcome! ${user?.name}, You Logged in Successfully`
      );
    }

    if (!isLoggedIn) {
      welcomedRef.current = false;
    }
  }, [isLoggedIn, user, notifyMsg]);

  useEffect(() => {
    if (error && error !== "Login cancelled.") {
      notifyMsg?.("error", error);
    }
  }, [error, notifyMsg]);

  const handleLogin = () => {
    if (loading) return;
    dispatch(login());
  };

 const handleLogout = async () => {
  await dispatch(logout());
  notifyMsg?.("success", "Logged Out Successfully !");
  setToggle(false);
};

  const navClass = ({ isActive }) => (isActive ? "nav_active" : undefined);

  // 👉 helper pentru fallback imagine
  const handleImgError = (e) => {
    e.target.onerror = null; // previne loop infinit
    e.target.src = DEFAULT_AVATAR;
  };

  return (
    <nav className="signlang_navbar gradient__bg">
      <div className="singlang_navlinks">
        {/* DESKTOP LINKS */}
        <div className="signlang_navlinks_container">
          <p>
            <NavLink to="/" className={navClass}>
              Home
            </NavLink>
          </p>

          {isLoggedIn && (
            <>
              <p>
                <NavLink to="/detect" className={navClass}>
                  Detect
                </NavLink>
              </p>
              <p>
                <NavLink to="/practice" className={navClass}>
                  Practice
                </NavLink>
              </p>
              <p>
                <NavLink to="/dashboard" className={navClass}>
                  Dashboard
                </NavLink>
              </p>
            </>
          )}
        </div>

        {/* AUTH */}
        <div className="signlang_auth-data">
          {isLoggedIn ? (
            <>
              <img
                src={user?.photoURL || DEFAULT_AVATAR}
                alt="user-icon"
                onError={handleImgError}
              />
              <button onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <button
              onClick={handleLogin}
              disabled={!!loading}
              style={
                loading ? { opacity: 0.7, cursor: "not-allowed" } : undefined
              }
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          )}
        </div>
      </div>

      {/* MOBILE MENU */}
      <div className="signlang__navbar-menu">
        {toggle ? (
          <RiCloseLine size={27} onClick={() => setToggle(false)} />
        ) : (
          <RiMenu3Line size={27} onClick={() => setToggle(true)} />
        )}

        {toggle && (
          <div className="signlang__navbar-menu_container scale-up-center">
            <div className="signlang__navbar-menu_container-links">
              <p>
                <Link to="/" onClick={() => setToggle(false)}>
                  Home
                </Link>
              </p>

              {isLoggedIn && (
                <>
                  <p>
                    <Link to="/detect" onClick={() => setToggle(false)}>
                      Detect
                    </Link>
                  </p>
                  <p>
                    <Link to="/practice" onClick={() => setToggle(false)}>
                      Practice
                    </Link>
                  </p>
                  <p>
                    <Link to="/dashboard" onClick={() => setToggle(false)}>
                      Dashboard
                    </Link>
                  </p>
                </>
              )}
            </div>

            <div className="signlang__navbar-menu_container-links-authdata">
              {isLoggedIn ? (
                <>
                  <img
                    src={user?.photoURL || DEFAULT_AVATAR}
                    alt="user-icon"
                    onError={handleImgError}
                  />
                  <button onClick={handleLogout}>Logout</button>
                </>
              ) : (
                <button onClick={handleLogin} disabled={!!loading}>
                  {loading ? "Logging in..." : "Login"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;