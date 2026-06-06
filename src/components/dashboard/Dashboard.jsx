/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import "./Dashboard.css";
import { useDispatch, useSelector } from "react-redux";
import {
  getSignData,
  getTopUsers,
  deleteTodayPracticeSessions,
} from "../../redux/actions/signdataaction";
import ChartComp from "./Chart/ChartComp";

import GoldTrophy from "../../assests/gold.png";
import SilverTrophy from "../../assests/silver.png";
import BronzeTrophy from "../../assests/bronze.png";
import NoData from "../../assests/No-data.svg";

import { quote } from "../../data/quotes";
import Spinner from "../Spinner/Spinner";
import { useNavigate } from "react-router-dom";

const formatDateKey = (dateValue) => {
  const date = dateValue ? new Date(dateValue) : new Date();

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const formatTime = (seconds) => {
  const totalSeconds = Number(seconds || 0);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${remainingSeconds}s`;
  }

  return `${minutes}m ${remainingSeconds}s`;
};

const getMatchRate = (matches, attempts) => {
  const safeAttempts = Number(attempts || 0);
  const safeMatches = Number(matches || 0);

  if (!safeAttempts) return 0;

  return Math.round((safeMatches / safeAttempts) * 100);
};

const Dashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [openDay, setOpenDay] = useState(null);

  const {
    loading: authLoader,
    accessToken,
    user,
  } = useSelector((state) => state.auth || {});

  const {
    signDataList = [],
    loading = false,
    topUsers = [],
    error = null,
  } = useSelector((state) => state.signData || {});

  const currentUserId = user?.userId || user?.uid || user?.id || null;
  const displayName = user?.name || user?.displayName || "User";
  const displayEmail = user?.email || "No email available";

const refreshDashboardData = useCallback(() => {
  if (accessToken && currentUserId) {
    dispatch(getSignData(currentUserId));
    dispatch(getTopUsers());
  }
}, [accessToken, currentUserId, dispatch]);

  useEffect(() => {
    if (!authLoader && !accessToken) {
      navigate("/");
      return;
    }

    if (accessToken && currentUserId) {
      dispatch(getSignData(currentUserId));
      dispatch(getTopUsers());
    }
  }, [accessToken, currentUserId, authLoader, navigate, dispatch]);

  const currentUserSessions = useMemo(() => {
    return (signDataList || []).filter((session) => {
      const sessionUserId = session?.userId || session?.uid || session?.id;
      return sessionUserId === currentUserId;
    });
  }, [signDataList, currentUserId]);

  const practiceSessions = useMemo(
    () =>
      currentUserSessions.filter((session) => session?.mode === "practice"),
    [currentUserSessions]
  );

  const flatSigns = useMemo(() => {
    return practiceSessions
      .map((session) =>
        Array.isArray(session.signsPerformed) ? session.signsPerformed : []
      )
      .flat();
  }, [practiceSessions]);

  const totalPracticeSessions = practiceSessions.length;

  const totalDetectedSigns = useMemo(() => {
    return flatSigns.reduce(
      (acc, item) => acc + (Number(item.count) || 0),
      0
    );
  }, [flatSigns]);

  const totalSecondsSpent = useMemo(() => {
    return practiceSessions.reduce(
      (acc, item) => acc + (Number(item.secondsSpent) || 0),
      0
    );
  }, [practiceSessions]);

  const totalMinutesSpent = Math.round(totalSecondsSpent / 60);

  const currentTopUser = (topUsers || [])[0];

  const dailyPracticeData = useMemo(() => {
    const map = new Map();

    for (const session of practiceSessions) {
      const dateKey = formatDateKey(session?.createdAtISO || session?.createdAt);
      const dateMs = session?.createdAtISO
        ? new Date(session.createdAtISO).getTime()
        : 0;

      if (!map.has(dateKey)) {
        map.set(dateKey, {
          dateKey,
          dateMs,
          sessions: 0,
          attempts: 0,
          matches: 0,
          totalPoints: 0,
          secondsSpent: 0,
          signsMap: new Map(),
        });
      }

      const day = map.get(dateKey);

      day.sessions += 1;
      day.dateMs = Math.max(day.dateMs || 0, dateMs || 0);
      day.attempts += Number(session?.stats?.attempts || 0);
      day.matches += Number(session?.stats?.matches || 0);
      day.totalPoints += Number(session?.stats?.totalPoints || 0);
      day.secondsSpent += Number(session?.secondsSpent || 0);

      const signsPerformed = Array.isArray(session?.signsPerformed)
        ? session.signsPerformed
        : [];

      for (const sign of signsPerformed) {
        const signName = sign?.SignDetected || sign?.signDetected;

        if (!signName) continue;

        const previous = day.signsMap.get(signName) || 0;
        day.signsMap.set(signName, previous + (Number(sign.count) || 0));
      }
    }

    return Array.from(map.values())
      .map((day) => ({
        ...day,
        matchRate: getMatchRate(day.matches, day.attempts),
        signs: Array.from(day.signsMap.entries())
          .map(([SignDetected, count]) => ({ SignDetected, count }))
          .sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.dateMs - a.dateMs)
      .slice(0, 10);
  }, [practiceSessions]);

  const latestPracticeDays = dailyPracticeData;

  useEffect(() => {
    console.log("[DASHBOARD] current user =", user);
    console.log("[DASHBOARD] currentUserId =", currentUserId);
    console.log("[DASHBOARD] signDataList len =", signDataList?.length);
    console.log(
      "[DASHBOARD] currentUserSessions len =",
      currentUserSessions?.length
    );
    console.log("[DASHBOARD] practiceSessions len =", practiceSessions?.length);
    console.log("[DASHBOARD] topUsers len =", topUsers?.length);
    if (error) console.log("[DASHBOARD] error =", error);
  }, [
    user,
    currentUserId,
    signDataList,
    currentUserSessions,
    practiceSessions,
    topUsers,
    error,
  ]);

  const showNoData =
    !loading &&
    !authLoader &&
    (currentUserSessions?.length === 0 || practiceSessions.length === 0);

  const getTrophy = (rank) => {
    if (rank === 1) return GoldTrophy;
    if (rank === 2) return SilverTrophy;
    if (rank === 3) return BronzeTrophy;
    return "";
  };

  const toggleDay = (dateKey) => {
    setOpenDay((current) => (current === dateKey ? null : dateKey));
  };

  // useEffect(() => {
  //   if (!currentUserId) return;

  //   dispatch(deleteTodayPracticeSessions(currentUserId));
  // }, [currentUserId, dispatch]);
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

              <h2>Hello, {displayName} 👋</h2>
              <p>
                You are currently logged in as <strong>{displayEmail}</strong>.
              </p>

              <h3>No data to display yet</h3>
              <p>
                Go to Practice and complete a full session: Start, do a few
                matches, then Stop. Once you save activity, your dashboard will
                show stats, top signs and leaderboard information.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="signlang_dashboard-hero">
              <div className="signlang_dashboard-hero-copy">
                <span className="signlang_dashboard-pill">
                  Your performance hub
                </span>

                <h1>Hello, {displayName} 👋</h1>

                <p>
                  You are currently logged in as <strong>{displayEmail}</strong>.
                </p>

                <p>
                  Track your progress, practice patterns and community rankings.
                </p>
              </div>

              <div className="signlang_dashboard-stats">
                <div className="signlang_dashboard-stat-card">
                  <span className="signlang_dashboard-stat-label">
                    Practice sessions
                  </span>
                  <strong>{totalPracticeSessions}</strong>
                </div>

                <div className="signlang_dashboard-stat-card">
                  <span className="signlang_dashboard-stat-label">
                    Matched signs
                  </span>
                  <strong>{totalDetectedSigns}</strong>
                </div>

                <div className="signlang_dashboard-stat-card">
                  <span className="signlang_dashboard-stat-label">
                    Time spent
                  </span>
                  <strong>{totalMinutesSpent} min</strong>
                </div>

                <div className="signlang_dashboard-stat-card">
                  <span className="signlang_dashboard-stat-label">
                    Top user
                  </span>
                  <strong>{currentTopUser?.username || "—"}</strong>
                </div>
              </div>
            </div>

            <div className="signlang_dashboard-grid-top">
              <div className="signlang_dashboard-card signlang_dashboard-card--chart">
                <div className="signlang_dashboard-card-head">
                  <div>
                    <span className="signlang_dashboard-card-kicker">
                      Insights
                    </span>
                    <h2>Practice timeline</h2>
                  </div>
                </div>

                <div className="signlang_dashboard-chart-wrap">
                  <ChartComp signDataList={currentUserSessions} />
                </div>
              </div>

              <div className="signlang_dashboard-card signlang_dashboard-card--leaderboard">
                <div className="signlang_dashboard-card-head">
                  <div>
                    <span className="signlang_dashboard-card-kicker">
                      Community
                    </span>
                    <h2>Top users</h2>
                  </div>
                </div>

                <div className="signlang_toprank-box">
                  {(topUsers || []).length === 0 ? (
                    <p className="signlang_dashboard-empty">
                      No users ranked yet.
                    </p>
                  ) : (
                    (topUsers || []).map((u, index) => {
                      const rank = u.rank ?? index + 1;

                      return (
                        <div
                          className="signlang_tank-row"
                          key={u?.uid || index}
                        >
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
                            <div className="signlang_tank-rank-badge">
                              #{rank}
                            </div>
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
                    <span className="signlang_dashboard-card-kicker">
                      Practice
                    </span>
                    <h2>Practice inventory by day</h2>
                  </div>
                </div>

                {dailyPracticeData.length === 0 ? (
                  <p className="signlang_dashboard-empty">
                    You have practice sessions saved, but no matched signs yet.
                  </p>
                ) : (
                  <div className="signlang_daily-accordion">
                    {dailyPracticeData.map((day) => (
                      <div
                        className="signlang_daily-item"
                        key={day.dateKey}
                      >
                        <button
                          type="button"
                          className="signlang_daily-summary"
                          onClick={() => toggleDay(day.dateKey)}
                        >
                          <div>
                            <strong>{day.dateKey}</strong>
                            <span>
                              {day.sessions} session
                              {day.sessions !== 1 ? "s" : ""} · {day.matches}{" "}
                              matches · {day.matchRate}% progress
                            </span>
                          </div>

                          <span className="signlang_daily-arrow">
                            {openDay === day.dateKey ? "−" : "+"}
                          </span>
                        </button>

                        {openDay === day.dateKey && (
                          <div className="signlang_daily-details">
                            {day.signs.length === 0 ? (
                              <p className="signlang_dashboard-empty">
                                No matched signs were saved for this day.
                              </p>
                            ) : (
                              <table>
                                <thead>
                                  <tr>
                                    <th className="table-heading">#</th>
                                    <th className="table-heading">Sign</th>
                                    <th className="table-heading">
                                      Matched in system
                                    </th>
                                  </tr>
                                </thead>

                                <tbody>
                                  {day.signs.map((sign, index) => (
                                    <tr
                                      key={`${day.dateKey}-${sign.SignDetected}`}
                                      className="sign-row"
                                    >
                                      <td>{index + 1}</td>
                                      <td>{sign.SignDetected}</td>
                                      <td>{sign.count} times</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="signlang_dashboard-card signlang_dashboard-card--quote">
                <div className="signlang_dashboard-card-head">
                  <div>
                    <span className="signlang_dashboard-card-kicker">
                      Last 10 practice days
                    </span>
                    <h2>Progress overview</h2>
                  </div>
                </div>

                {latestPracticeDays.length === 0 ? (
                  <p className="signlang_dashboard-empty">
                    No practice progress available yet.
                  </p>
                ) : (
                  <div className="signlang_progress-list">
                    {latestPracticeDays.map((day) => (
                      <div
                        className="signlang_progress-item"
                        key={`progress-${day.dateKey}`}
                      >
                        <div className="signlang_progress-top">
                          <strong>{day.dateKey}</strong>
                          <span>{day.matchRate}%</span>
                        </div>

                        <div className="signlang_progress-bar">
                          <div
                            className="signlang_progress-fill"
                            style={{ width: `${day.matchRate}%` }}
                          />
                        </div>

                        <div className="signlang_progress-meta">
                          <span>{day.matches}/{day.attempts} matches</span>
                          <span>{day.totalPoints} pts</span>
                          <span>{formatTime(day.secondsSpent)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="signlang_quotes-box signlang_quotes-box--small">
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