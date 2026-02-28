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

  // ✅ IMPORTANT: with your store setup, everything comes from state.signData
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

  // ✅ only practice sessions feed "Most Practiced Signs"
  const practiceSessions = useMemo(
    () => (signDataList || []).filter((s) => s?.mode === "practice"),
    [signDataList]
  );

  // flatten signsPerformed
  const flatSigns = useMemo(() => {
    const list = practiceSessions
      .map((s) => (Array.isArray(s.signsPerformed) ? s.signsPerformed : []))
      .flat();

    return list;
  }, [practiceSessions]);

  // aggregate counts
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

  // helpful debug (you can delete later)
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

  return (
    <div className="signlang_dashboard-container">
      {loading || authLoader ? (
        <Spinner />
      ) : showNoData ? (
        <div className="signlang__nodata-cont">
          <img src={NoData} alt="no-data" />
          <h3 className="gradient__text">
            No Data to Display. Go to Practice and complete a session (Start → do matches → Stop).
          </h3>
          {error ? (
            <p style={{ marginTop: 10, opacity: 0.85 }}>
              Debug: {String(error)}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <div className="signlang_header-data">
            <ChartComp signDataList={signDataList} />

            <div className="signlang_leader-board">
              <h2 className="gradient__text title">Our Top Users</h2>
              <div className="signlang_toprank-box">
                {(topUsers || []).map((u, index) => (
                  <div className="signlang_tank-row" key={u?.uid || index}>
                    <h2 className="gradient__text">{u.rank ?? index + 1}</h2>
                    <h3>{u.username}</h3>
                    <img
                      src={
                        (u.rank ?? index + 1) === 1
                          ? GoldTrophy
                          : (u.rank ?? index + 1) === 2
                          ? SilverTrophy
                          : (u.rank ?? index + 1) === 3
                          ? BronzeTrophy
                          : ""
                      }
                      alt="trophy"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="signlang_dashboard-midsection">
            <div className="signlang_sign-table">
              <h2 className="gradient__text">Your Most Practiced Signs</h2>

              {topFive.length === 0 ? (
                <p style={{ marginTop: 10, opacity: 0.85 }}>
                  You have practice sessions saved, but no matched signs yet. Try lowering the match threshold
                  temporarily or practice more until you get matches.
                </p>
              ) : (
                <table>
                  <tbody>
                    <tr>
                      <th className="table-heading">Sr.No</th>
                      <th className="table-heading">Signs</th>
                      <th className="table-heading">Frequency</th>
                    </tr>

                    {topFive.map((data, i) => (
                      <tr key={data.SignDetected} className="sign-row">
                        <td>{i + 1}</td>
                        <td>{data.SignDetected}</td>
                        <td>{data.count} times</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="signlang_quotes-box">
              <h2 className="gradient__text">Quote of the Day</h2>
              <div>
                <blockquote>{quote.quote}</blockquote>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;