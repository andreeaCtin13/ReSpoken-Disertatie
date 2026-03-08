/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo } from "react";
import "./Dashboard.css";
import { useDispatch, useSelector } from "react-redux";
import { getSignData, getTopUsers } from "../../redux/actions/signdataaction";
import ChartComp from "./Chart/ChartComp";

import GoldTrophy from "../../assests/gold.png";
import SilverTrophy from "../../assests/silver.png";
import BronzeTrophy from "../../assests/bronze.png";
import NoData from "../../assests/No-data.svg";

import { quote } from "../../data/quotes";
import Spinner from "../Spinner/Spinner";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { loading: authLoader, accessToken } = useSelector((state) => state.auth || {});

  const { signDataList = [], loading = false, topUsers = [], error = null } = useSelector(
    (state) => state.signData || {}
  );

  useEffect(() => {
    if (!authLoader && !accessToken) {
      navigate("/");
      return;
    }

    if (accessToken) {
      dispatch(getSignData());
      dispatch(getTopUsers());
    }
  }, [accessToken, authLoader, navigate, dispatch]);

  const practiceSessions = useMemo(
    () => (signDataList || []).filter((s) => s?.mode === "practice"),
    [signDataList]
  );

  const flatSigns = useMemo(() => {
    return practiceSessions
      .map((s) => (Array.isArray(s.signsPerformed) ? s.signsPerformed : []))
      .flat();
  }, [practiceSessions]);

  const topFive = useMemo(() => {
    const map = new Map();

    for (const item of flatSigns) {
      if (!item?.SignDetected) continue;
      const prev = map.get(item.SignDetected) || 0;
      map.set(item.SignDetected, prev + (Number(item.count) || 0));
    }

    return Array.from(map.entries())
      .map(([SignDetected, count]) => ({ SignDetected, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [flatSigns]);

  const totalPracticeSessions = practiceSessions.length;

  const totalDetectedSigns = useMemo(() => {
    return topFive.reduce((acc, item) => acc + (Number(item.count) || 0), 0);
  }, [topFive]);

  const currentTopUser = (topUsers || [])[0];

  useEffect(() => {
    console.log("[DASHBOARD] signDataList len =", signDataList?.length);
    console.log("[DASHBOARD] practiceSessions len =", practiceSessions?.length);
    console.log("[DASHBOARD] topUsers len =", topUsers?.length);
    if (error) console.log("[DASHBOARD] error =", error);
  }, [signDataList, practiceSessions, topUsers, error]);

  const showNoData =
    !loading &&
    !authLoader &&
    (signDataList?.length === 0 || practiceSessions.length === 0);

  const getTrophy = (rank) => {
    if (rank === 1) return GoldTrophy;
    if (rank === 2) return SilverTrophy;
    if (rank === 3) return BronzeTrophy;
    return "";
  };

  return (
    <section className="signlang_dashboard-page">
      <div className="signlang_dashboard-bg signlang_dashboard-bg--one" />
      <div className="signlang_dashboard-bg signlang_dashboard-bg--two" />

      <div className="signlang_dashboard-container">
        {loading || authLoader ? (
          <Spinner />
        ) : showNoData ? (
          <div className="signlang__nodata-cont">
            <div className="signlang__nodata-visual">
              <img src={NoData} alt="no-data" />
            </div>

            <div className="signlang__nodata-content">
              <span className="signlang_dashboard-pill">Dashboard</span>
              <h3>No data to display yet</h3>
              <p>
                Go to Practice and complete a full session: Start, do a few
                matches, then Stop. Once you save activity, your dashboard will
                show stats, top signs and leaderboard information.
              </p>

              {error ? (
                <p className="signlang__nodata-debug">Debug: {String(error)}</p>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <div className="signlang_dashboard-hero">
              <div className="signlang_dashboard-hero-copy">
                <span className="signlang_dashboard-pill">Your performance hub</span>
                <h1>Track your progress, practice patterns and rankings</h1>
                <p>
                  A clean overview of your sign language activity, most practiced
                  gestures and community leaderboard.
                </p>
              </div>

              <div className="signlang_dashboard-stats">
                <div className="signlang_dashboard-stat-card">
                  <span className="signlang_dashboard-stat-label">Practice sessions</span>
                  <strong>{totalPracticeSessions}</strong>
                </div>

                <div className="signlang_dashboard-stat-card">
                  <span className="signlang_dashboard-stat-label">Detected signs</span>
                  <strong>{totalDetectedSigns}</strong>
                </div>

                <div className="signlang_dashboard-stat-card">
                  <span className="signlang_dashboard-stat-label">Top user</span>
                  <strong>{currentTopUser?.username || "—"}</strong>
                </div>
              </div>
            </div>

            <div className="signlang_dashboard-grid-top">
              <div className="signlang_dashboard-card signlang_dashboard-card--chart">
                <div className="signlang_dashboard-card-head">
                  <div>
                    <span className="signlang_dashboard-card-kicker">Insights</span>
                    <h2>Practice timeline</h2>
                  </div>
                </div>

                <div className="signlang_dashboard-chart-wrap">
                  <ChartComp signDataList={signDataList} />
                </div>
              </div>

              <div className="signlang_dashboard-card signlang_dashboard-card--leaderboard">
                <div className="signlang_dashboard-card-head">
                  <div>
                    <span className="signlang_dashboard-card-kicker">Community</span>
                    <h2>Top users</h2>
                  </div>
                </div>

                <div className="signlang_toprank-box">
                  {(topUsers || []).length === 0 ? (
                    <p className="signlang_dashboard-empty">No users ranked yet.</p>
                  ) : (
                    (topUsers || []).map((u, index) => {
                      const rank = u.rank ?? index + 1;
                      return (
                        <div className="signlang_tank-row" key={u?.uid || index}>
                          <div className="signlang_tank-rank">{rank}</div>

                          <div className="signlang_tank-user">
                            <h3>{u.username}</h3>
                            <span>
                              {rank === 1
                                ? "Top performer"
                                : rank === 2
                                ? "Excellent consistency"
                                : rank === 3
                                ? "Strong progress"
                                : "Community member"}
                            </span>
                          </div>

                          {getTrophy(rank) ? (
                            <img src={getTrophy(rank)} alt="trophy" />
                          ) : (
                            <div className="signlang_tank-rank-badge">#{rank}</div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="signlang_dashboard-grid-bottom">
              <div className="signlang_dashboard-card signlang_dashboard-card--table">
                <div className="signlang_dashboard-card-head">
                  <div>
                    <span className="signlang_dashboard-card-kicker">Practice</span>
                    <h2>Your most practiced signs</h2>
                  </div>
                </div>

                {topFive.length === 0 ? (
                  <p className="signlang_dashboard-empty">
                    You have practice sessions saved, but no matched signs yet.
                    Try lowering the match threshold temporarily or practice more
                    until you get matches.
                  </p>
                ) : (
                  <div className="signlang_table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th className="table-heading">#</th>
                          <th className="table-heading">Sign</th>
                          <th className="table-heading">Frequency</th>
                        </tr>
                      </thead>

                      <tbody>
                        {topFive.map((data, i) => (
                          <tr key={data.SignDetected} className="sign-row">
                            <td>{i + 1}</td>
                            <td>{data.SignDetected}</td>
                            <td>{data.count} times</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="signlang_dashboard-card signlang_dashboard-card--quote">
                <div className="signlang_dashboard-card-head">
                  <div>
                    <span className="signlang_dashboard-card-kicker">Daily inspiration</span>
                    <h2>Quote of the day</h2>
                  </div>
                </div>

                <div className="signlang_quotes-box">
                  <blockquote>{quote.quote}</blockquote>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default Dashboard;