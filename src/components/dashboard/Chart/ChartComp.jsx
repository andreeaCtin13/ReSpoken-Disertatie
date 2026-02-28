/* eslint-disable no-unused-vars */
import React from "react";
import "./Chart.css";
import Chart from "chart.js/auto";
import { Bar } from "react-chartjs-2";

// ✅ helper: returns Date or null from any format we may have in Firestore
const toDateSafe = (item) => {
  // Prefer createdAtISO if present
  if (typeof item?.createdAtISO === "string" && item.createdAtISO.length > 0) {
    const d = new Date(item.createdAtISO);
    if (!isNaN(d.getTime())) return d;
  }

  const createdAt = item?.createdAt;

  // If string
  if (typeof createdAt === "string") {
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) return d;

    // fallback
    try {
      const dd = new Date(String(createdAt));
      if (!isNaN(dd.getTime())) return dd;
    } catch {}
  }

  // If Firestore Timestamp (has toDate)
  if (createdAt && typeof createdAt.toDate === "function") {
    try {
      const d = createdAt.toDate();
      if (!isNaN(d.getTime())) return d;
    } catch {}
  }

  // Timestamp-like {seconds}
  if (createdAt && typeof createdAt.seconds === "number") {
    const d = new Date(createdAt.seconds * 1000);
    if (!isNaN(d.getTime())) return d;
  }

  // If Date
  if (createdAt instanceof Date) return createdAt;

  return null;
};

// ✅ helper: formats a Date -> MM/DD/YYYY
const formatMMDDYYYY = (d) => {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

const ChartComp = ({ signDataList = [] }) => {
  // Extract date and secondsSpent from each object and store in a new array
  const extractedData = (signDataList || [])
    .map((item) => {
      const d = toDateSafe(item);
      if (!d) return null;

      return {
        date: formatMMDDYYYY(d),
        secondsSpent: Number(item?.secondsSpent || 0),
      };
    })
    .filter(Boolean);

  // Combine secondsSpent for same dates
  const reducedData = extractedData.reduce((acc, curr) => {
    const matchingIndex = acc.findIndex((item) => item.date === curr.date);
    if (matchingIndex !== -1) {
      acc[matchingIndex].secondsSpent += curr.secondsSpent;
    } else {
      acc.push(curr);
    }
    return acc;
  }, []);

  // Sort by date
  reducedData.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Separate dates and secondsSpent into separate arrays
  const dates = reducedData.map((item) => item.date).reverse();
  const secondsSpent = reducedData.map((item) => item.secondsSpent).reverse();

  const data = {
    labels: dates.slice(0, 7),
    datasets: [
      {
        data: secondsSpent.slice(0, 7),
        backgroundColor: "#f07458",
        barThickness: 20,
      },
    ],
  };

  const options = {
    maintainAspectRatio: true,
    responsive: true,
    scales: {
      x: {
        ticks: {
          color: "#fff",
        },
        grid: {
          color: "#81AFDD",
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: "#fff",
        },
        grid: {
          color: "#81AFDD",
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
    },
  };

  return (
    <div className="signlang_chart">
      {dates.length > 0 && secondsSpent.length > 0 ? (
        <>
          <h2 className="gradient__text">Time Spent By You (in seconds)</h2>
          <Bar className="bar-chart" data={data} options={options} />
        </>
      ) : (
        <h2 className="gradient__text">
          You don't have any Data for Chart !<br />
          Please go to Detect Page to Start
        </h2>
      )}
    </div>
  );
};

export default ChartComp;