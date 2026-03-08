import React, { useState, useRef, useEffect, useCallback } from "react";
import "./Detect.css";
import { v4 as uuidv4 } from "uuid";
import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { HAND_CONNECTIONS } from "@mediapipe/hands";

import Webcam from "react-webcam";
import { SignImageData } from "../data/SignImageData";
import { useDispatch, useSelector } from "react-redux";
import { addSignData } from "../redux/actions/signdataaction";
import ProgressBar from "../components/Detect/ProgressBar/ProgressBar";
import DisplayImg from "../assests/displayGif.gif";

let startTime = null;

const PRACTICE_DETECT_THRESHOLD = 0.15;
const MATCH_THRESHOLD = 0.20;
const BASE_POINTS = 50;

const normalizeSign = (s) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const DetectCore = ({ mode = "translate" }) => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);

  const requestRef = useRef(null);
  const recognizerRef = useRef(null);
  const webcamRunningRef = useRef(false);

  const [webcamRunning, setWebcamRunning] = useState(false);
  const [gestureOutput, setGestureOutput] = useState("");
  const [progress, setProgress] = useState(0);

  const [detectedData, setDetectedData] = useState([]);

  const practiceCountsRef = useRef(new Map());
  const practiceStatsRef = useRef({ attempts: 0, matches: 0, totalPoints: 0 });

  const lastAttemptAtRef = useRef(0);

  const user = useSelector((state) => state.auth?.user);
  const { accessToken } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  const [currentImage, setCurrentImage] = useState(null);
  const [matchMsg, setMatchMsg] = useState("");

  useEffect(() => {
    let intervalId;

    if (webcamRunning && mode === "practice" && SignImageData?.length) {
      setCurrentImage(
        (prev) =>
          prev ?? SignImageData[Math.floor(Math.random() * SignImageData.length)]
      );

      intervalId = setInterval(() => {
        setCurrentImage(
          SignImageData[Math.floor(Math.random() * SignImageData.length)]
        );
      }, 5000);
    } else {
      setCurrentImage(null);
    }

    return () => clearInterval(intervalId);
  }, [webcamRunning, mode]);

  useEffect(() => {
    setMatchMsg("");
  }, [currentImage?.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadGestureRecognizer() {
      try {
        const modelPath =
          process.env.REACT_APP_TRAINED_MODEL_PATH ||
          process.env.REACT_APP_FIREBASE_STORAGE_TRAINED_MODEL;

        console.log("[MODEL PATH]", modelPath);
        if (!modelPath) throw new Error("Model path missing in .env");

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        const recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: { modelAssetPath: modelPath },
          numHands: 2,
          runningMode: "VIDEO",
        });

        if (cancelled) return;
        recognizerRef.current = recognizer;
        console.log("✅ GestureRecognizer loaded");
      } catch (e) {
        console.error("Failed to load gesture recognizer ❌", e);
      }
    }

    loadGestureRecognizer();

    return () => {
      cancelled = true;
    };
  }, []);

  const clearCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
  }, []);

  const stopLoop = useCallback(() => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    requestRef.current = null;
  }, []);

  const predictWebcam = useCallback(() => {
    if (!webcamRunningRef.current) return;

    const recognizer = recognizerRef.current;
    const video = webcamRef.current?.video;
    const canvas = canvasRef.current;

    if (!recognizer || !video || !canvas) {
      requestRef.current = requestAnimationFrame(predictWebcam);
      return;
    }

    if (video.readyState < 2) {
      requestRef.current = requestAnimationFrame(predictWebcam);
      return;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) {
      requestRef.current = requestAnimationFrame(predictWebcam);
      return;
    }

    if (canvas.width !== vw) canvas.width = vw;
    if (canvas.height !== vh) canvas.height = vh;

    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    try {
      const results = recognizer.recognizeForVideo(video, performance.now());

      if (results?.landmarks) {
        for (const lm of results.landmarks) {
          drawConnectors(ctx, lm, HAND_CONNECTIONS, {
            color: "#9d7bff",
            lineWidth: 4,
          });
          drawLandmarks(ctx, lm, {
            color: "#ffb27d",
            lineWidth: 2,
          });
        }
      }

      if (!(results?.gestures?.length > 0 && results.gestures[0]?.length > 0)) {
        setGestureOutput("");
        setProgress(0);
        requestRef.current = requestAnimationFrame(predictWebcam);
        return;
      }

      const top = results.gestures[0][0];
      const gestureName = top.categoryName || "";
      const score = typeof top.score === "number" ? top.score : 0;

      setGestureOutput(gestureName);
      setProgress(Math.round(score * 100));

      if (mode !== "practice") {
        setDetectedData((prev) => [
          ...prev,
          { SignDetected: gestureName, DetectedScore: score },
        ]);
      }

      if (mode === "practice") {
        const now = Date.now();

        if (now - lastAttemptAtRef.current > 400 && score >= PRACTICE_DETECT_THRESHOLD) {
          lastAttemptAtRef.current = now;

          practiceStatsRef.current = {
            ...practiceStatsRef.current,
            attempts: practiceStatsRef.current.attempts + 1,
          };

          const points = Math.max(1, Math.round(BASE_POINTS * score));

          practiceStatsRef.current = {
            attempts: practiceStatsRef.current.attempts,
            matches: practiceStatsRef.current.matches,
            totalPoints: practiceStatsRef.current.totalPoints + points,
          };

          const m = practiceCountsRef.current;
          m.set(gestureName, (m.get(gestureName) || 0) + 1);

          if (currentImage) {
            const targetRaw = currentImage.sign || currentImage.name || "";
            const target = normalizeSign(targetRaw);
            const detected = normalizeSign(gestureName);
            const isMatch =
              target && detected && target === detected && score >= MATCH_THRESHOLD;

            if (isMatch) {
              practiceStatsRef.current = {
                attempts: practiceStatsRef.current.attempts,
                matches: practiceStatsRef.current.matches + 1,
                totalPoints: practiceStatsRef.current.totalPoints,
              };
              setMatchMsg(`✅ MATCH: ${targetRaw} (${Math.round(score * 100)}%)`);
            } else {
              setMatchMsg(`❌ Detected: ${gestureName} (${Math.round(score * 100)}%)`);
            }
          } else {
            setMatchMsg(`Detected: ${gestureName} (${Math.round(score * 100)}%)`);
          }
        }
      }
    } catch (e) {
      console.warn("recognizeForVideo frame failed:", e);
    } finally {
      ctx.restore();
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  }, [mode, currentImage]);

  const enableCam = useCallback(() => {
    if (!recognizerRef.current) {
      alert("Please wait for gestureRecognizer to load");
      return;
    }

    if (webcamRunningRef.current) {
      webcamRunningRef.current = false;
      setWebcamRunning(false);
      stopLoop();
      clearCanvas();

      const endTime = new Date();
      const timeElapsed = startTime
        ? ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(2)
        : "0.00";

      const userId = user?.uid || user?.id || user?.userId;

      if (mode === "practice") {
        const signsPerformed = Array.from(practiceCountsRef.current.entries()).map(
          ([sign, count]) => ({ SignDetected: sign, count })
        );

        const stats = practiceStatsRef.current;

        dispatch(
          addSignData({
            id: uuidv4(),
            userId,
            username: user?.name,
            createdAt: endTime.toISOString(),
            secondsSpent: Number(timeElapsed),
            mode: "practice",
            signsPerformed,
            stats,
          })
        );

        practiceCountsRef.current = new Map();
        practiceStatsRef.current = { attempts: 0, matches: 0, totalPoints: 0 };
      }

      if (mode !== "practice") {
        const nonEmpty = detectedData.filter(
          (d) => d.SignDetected && typeof d.DetectedScore === "number"
        );

        const resultArray = [];
        let current = nonEmpty[0];

        for (let i = 1; i < nonEmpty.length; i++) {
          if (nonEmpty[i].SignDetected !== current.SignDetected) {
            resultArray.push(current);
            current = nonEmpty[i];
          }
        }

        if (current) resultArray.push(current);

        const countMap = new Map();
        for (const item of resultArray) {
          countMap.set(item.SignDetected, (countMap.get(item.SignDetected) || 0) + 1);
        }

        const outputArray = Array.from(countMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([sign, count]) => ({ SignDetected: sign, count }));

        dispatch(
          addSignData({
            id: uuidv4(),
            userId,
            username: user?.name,
            createdAt: endTime.toISOString(),
            secondsSpent: Number(timeElapsed),
            mode: "detect",
            signsPerformed: outputArray,
            stats: { totalPoints: 0, attempts: 0, matches: 0 },
          })
        );

        setDetectedData([]);
      }

      startTime = null;
      setGestureOutput("");
      setProgress(0);
      setMatchMsg("");
      setCurrentImage(null);
    } else {
      startTime = new Date();
      setDetectedData([]);

      practiceCountsRef.current = new Map();
      practiceStatsRef.current = { attempts: 0, matches: 0, totalPoints: 0 };
      lastAttemptAtRef.current = 0;

      if (mode === "practice" && SignImageData?.length) {
        setCurrentImage(
          SignImageData[Math.floor(Math.random() * SignImageData.length)]
        );
      }

      webcamRunningRef.current = true;
      setWebcamRunning(true);
      requestRef.current = requestAnimationFrame(predictWebcam);
    }
  }, [mode, detectedData, user, dispatch, clearCanvas, stopLoop, predictWebcam]);

  useEffect(() => {
    return () => {
      webcamRunningRef.current = false;
      stopLoop();
    };
  }, [stopLoop]);

  const modeLabel = mode === "translate" ? "Translate mode" : "Practice mode";
  const modeTitle =
    mode === "translate"
      ? "Live sign translation"
      : "Practice with guided signs";

  const modeText =
    mode === "translate"
      ? "Use your camera to detect gestures live and save your most recognized signs."
      : "Follow the sign prompt, perform the gesture and track your match confidence in real time.";

  return (
    <section className="signlang_detection-page">
      <div className="signlang_detection-bg signlang_detection-bg--one" />
      <div className="signlang_detection-bg signlang_detection-bg--two" />

      <div className="signlang_detection-container">
        {accessToken ? (
          <>
            <div className="signlang_detection-hero">
              <div className="signlang_detection-hero-copy">
                <span className="signlang_detection-pill">{modeLabel}</span>
                <h1>{modeTitle}</h1>
                <p>{modeText}</p>
              </div>

              <div className="signlang_detection-hero-mini">
                <div className="signlang_detection-mini-card">
                  <span>Status</span>
                  <strong>{webcamRunning ? "Session active" : "Ready to start"}</strong>
                </div>

                <div className="signlang_detection-mini-card">
                  <span>Recognition</span>
                  <strong>{progress > 0 ? `${progress}%` : "Waiting"}</strong>
                </div>
              </div>
            </div>

            <div
              className={`signlang_detection-layout ${
                mode === "practice" ? "practice-layout" : "translate-layout"
              }`}
            >
              <div className="signlang_detection-stage-card">
                <div className="signlang_detection-card-head">
                  <div>
                    <span className="signlang_detection-card-kicker">Camera feed</span>
                    <h2>Your live session</h2>
                  </div>

                  <div
                    className={`signlang_detection-live-badge ${
                      webcamRunning ? "is-live" : ""
                    }`}
                  >
                    <span />
                    {webcamRunning ? "Live" : "Idle"}
                  </div>
                </div>

                <div className="signlang_detection-stage">
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    className="signlang_webcam"
                  />
                  <canvas ref={canvasRef} className="signlang_canvas" />
                </div>

                <div className="signlang_detection-controls">
                  <button
                    className={`signlang_detection-main-btn ${
                      webcamRunning ? "is-stop" : "is-start"
                    }`}
                    onClick={enableCam}
                  >
                    {webcamRunning ? "Stop session" : "Start session"}
                  </button>
                </div>
              </div>

              <div className="signlang_detection-side">
                <div className="signlang_detection-info-card">
                  <div className="signlang_detection-card-head">
                    <div>
                      <span className="signlang_detection-card-kicker">Recognition</span>
                      <h2>Live result</h2>
                    </div>
                  </div>

                  <div className="signlang_detection-result-box">
                    <p className="gesture_output">
                      {gestureOutput
                        ? `Recognized sign: ${gestureOutput}`
                        : "No sign detected yet."}
                    </p>

                    {mode === "practice" && matchMsg ? (
                      <p className="signlang_detection-match">{matchMsg}</p>
                    ) : null}
                  </div>

                  {progress > 0 && mode === "practice" ? (
                    <div className="signlang_detection-progress-wrap">
                      <span>Confidence</span>
                      <ProgressBar progress={progress} />
                    </div>
                  ) : null}
                </div>

                {mode === "practice" && (
                  <div className="signlang_detection-practice-card">
                    <div className="signlang_detection-card-head">
                      <div>
                        <span className="signlang_detection-card-kicker">Practice prompt</span>
                        <h2>Current sign to perform</h2>
                      </div>
                    </div>

                    <div className="signlang_image-div">
                      {currentImage ? (
                        <>
                          <div className="signlang_detection-practice-image-wrap">
                            <img
                              src={currentImage.url}
                              alt={`img ${currentImage.id}`}
                            />
                          </div>

                          <p className="signlang_detection-practice-text">
                            Do the sign for:{" "}
                            <b>{currentImage.sign || currentImage.name}</b>
                          </p>
                        </>
                      ) : (
                        <div className="signlang_detection-practice-empty">
                          <h3>Click on Start to practice with images.</h3>
                          <p>
                            Once the session starts, a random sign prompt will appear
                            here every few seconds.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="signlang_detection_notLoggedIn">
            <div className="signlang_detection_login-card">
              <span className="signlang_detection-pill">Restricted feature</span>
              <h1>Please login</h1>
              <p>Please login to test this detection feature.</p>
              <img src={DisplayImg} alt="display-img" />
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default DetectCore;