// src/components/navbar/Navbar.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./Navbar.css";
import { Link, NavLink } from "react-router-dom";
import logo from "../../assests/logo2.png";
import { RiMenu3Line, RiCloseLine } from "react-icons/ri";
import { useDispatch, useSelector } from "react-redux";
import { login, logout } from "../../redux/actions/authaction";

const Navbar = ({ notifyMsg }) => {
  const [toggle, setToggle] = useState(false);
  const dispatch = useDispatch();

  const { user, accessToken, loading, error } = useSelector(
    (state) => state.auth
  );

  const isLoggedIn = useMemo(() => !!accessToken && !!user, [accessToken, user]);

  const welcomedRef = useRef(false);

  useEffect(() => {
    if (isLoggedIn && !welcomedRef.current) {
      welcomedRef.current = true;
      notifyMsg?.("success", `Welcome! ${user?.name}, You Logged in Successfully`);
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

  const handleLogout = () => {
    dispatch(logout());
    notifyMsg?.("success", "Logged Out Successfully !");
  };

  const navClass = ({ isActive }) => (isActive ? "nav_active" : undefined);

  return (
    <div className="signlang_navbar gradient__bg">
      <div className="singlang_navlinks">
        <div className="signlang_navlinks_logo">
          <a href="/">
            <img className="logo" src={logo} alt="logo" />
          </a>
        </div>

        <div className="signlang_navlinks_container">
          <p>
            <NavLink to="/" className={navClass}>
              Home
            </NavLink>
          </p>

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

          {accessToken && (
            <p>
              <NavLink to="/dashboard" className={navClass}>
                Dashboard
              </NavLink>
            </p>
          )}
        </div>

        <div className="signlang_auth-data">
          {accessToken ? (
            <>
              <img src={user?.photoURL} alt="user-icon" />
              <button type="button" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleLogin}
              disabled={!!loading}
              style={loading ? { opacity: 0.7, cursor: "not-allowed" } : undefined}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          )}
        </div>
      </div>

      <div className="signlang__navbar-menu">
        {toggle ? (
          <RiCloseLine color="#fff" size={27} onClick={() => setToggle(false)} />
        ) : (
          <RiMenu3Line color="#fff" size={27} onClick={() => setToggle(true)} />
        )}

        {toggle && (
          <div className="signlang__navbar-menu_container scale-up-center">
            <div className="signlang__navbar-menu_container-links">
              <p>
                <Link to="/" onClick={() => setToggle(false)}>
                  Home
                </Link>
              </p>

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

              {accessToken && (
                <p>
                  <Link to="/dashboard" onClick={() => setToggle(false)}>
                    Dashboard
                  </Link>
                </p>
              )}
            </div>

            <div className="signlang__navbar-menu_container-links-authdata">
              {accessToken ? (
                <>
                  <img src={user?.photoURL} alt="user-icon" />
                  <button type="button" onClick={handleLogout}>
                    Logout
                  </button>
                </>
              ) : (
                <button
                  type="button"
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
        )}
      </div>
    </div>
  );
};

export default Navbar;
