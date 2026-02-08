import React, { useEffect, useMemo, useRef, useState } from "react";
import "./Navbar.css";
import { Link, NavLink } from "react-router-dom";
import logo from "../../assests/logo.png";
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
    <nav className="signlang_navbar gradient__bg">
      <div className="singlang_navlinks">
        {/* LOGO */}
        <div className="signlang_navlinks_logo">
          <Link to="/home">
            <img className="logo" src={logo} alt="logo" />
          </Link>
        </div>

        {/* DESKTOP LINKS */}
        <div className="signlang_navlinks_container">
          <p>
            <NavLink to="/home" className={navClass}>
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
              <img src={user?.photoURL} alt="user-icon" />
              <button onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <button
              onClick={handleLogin}
              disabled={!!loading}
              style={loading ? { opacity: 0.7, cursor: "not-allowed" } : undefined}
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
                <Link to="/home" onClick={() => setToggle(false)}>
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
                  <img src={user?.photoURL} alt="user-icon" />
                  <button onClick={handleLogout}>Logout</button>
                </>
              ) : (
                <button
                  onClick={handleLogin}
                  disabled={!!loading}
                >
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
