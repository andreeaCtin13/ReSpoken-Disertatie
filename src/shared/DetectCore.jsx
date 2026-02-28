import React, { useState, useRef, useEffect, useCallback } from "react";
import "../components/Detect/Detect.css";
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

const PRACTICE_DETECT_THRESHOLD = 0.15; // ✅ attempt dacă score >= 15%
const MATCH_THRESHOLD = 0.20;          // ✅ match dacă score >= 20%
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

  // translate collection
  const [detectedData, setDetectedData] = useState([]);

  // practice: counts + stats
  const practiceCountsRef = useRef(new Map());   // ✅ store detected gestures counts
  const practiceStatsRef = useRef({ attempts: 0, matches: 0, totalPoints: 0 });

  // throttle attempt counting
  const lastAttemptAtRef = useRef(0);

  const user = useSelector((state) => state.auth?.user);
  const { accessToken } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  const [currentImage, setCurrentImage] = useState(null);
  const [matchMsg, setMatchMsg] = useState("");

  // set/rotate images in practice
  useEffect(() => {
    let intervalId;
    if (webcamRunning && mode === "practice" && SignImageData?.length) {
      // set first
      setCurrentImage((prev) => prev ?? SignImageData[Math.floor(Math.random() * SignImageData.length)]);

      intervalId = setInterval(() => {
        setCurrentImage(SignImageData[Math.floor(Math.random() * SignImageData.length)]);
      }, 5000);
    } else {
      setCurrentImage(null);
    }

    return () => clearInterval(intervalId);
  }, [webcamRunning, mode]);

  useEffect(() => {
    setMatchMsg("");
  }, [currentImage?.id]);

  // load recognizer
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
          drawConnectors(ctx, lm, HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 5 });
          drawLandmarks(ctx, lm, { color: "#FF0000", lineWidth: 2 });
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

      // translate mode
      if (mode !== "practice") {
        setDetectedData((prev) => [...prev, { SignDetected: gestureName, DetectedScore: score }]);
      }

      // ✅ PRACTICE: count attempts on any confident detection, store detected gestures
      if (mode === "practice") {
        const now = Date.now();
        if (now - lastAttemptAtRef.current > 400 && score >= PRACTICE_DETECT_THRESHOLD) {
          lastAttemptAtRef.current = now;

          // attempt always
          practiceStatsRef.current = {
            ...practiceStatsRef.current,
            attempts: practiceStatsRef.current.attempts + 1,
          };

          // points even without match (so dashboard has data)
          const points = Math.max(1, Math.round(BASE_POINTS * score));
          practiceStatsRef.current = {
            attempts: practiceStatsRef.current.attempts,
            matches: practiceStatsRef.current.matches,
            totalPoints: practiceStatsRef.current.totalPoints + points,
          };

          // count detected gesture frequency (THIS feeds your dashboard)
          const m = practiceCountsRef.current;
          m.set(gestureName, (m.get(gestureName) || 0) + 1);

          // match with target (optional)
          if (currentImage) {
            const targetRaw = currentImage.sign || currentImage.name || "";
            const target = normalizeSign(targetRaw);
            const detected = normalizeSign(gestureName);
            const isMatch = target && detected && target === detected && score >= MATCH_THRESHOLD;

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
      // STOP
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

        console.log("[STOP PRACTICE] signsPerformed=", signsPerformed);
        console.log("[STOP PRACTICE] stats=", stats);

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

        // reset
        practiceCountsRef.current = new Map();
        practiceStatsRef.current = { attempts: 0, matches: 0, totalPoints: 0 };
      }

      if (mode !== "practice") {
        // existing translate save logic
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
      // START
      startTime = new Date();
      setDetectedData([]);

      practiceCountsRef.current = new Map();
      practiceStatsRef.current = { attempts: 0, matches: 0, totalPoints: 0 };
      lastAttemptAtRef.current = 0;

      // ensure practice has an image immediately
      if (mode === "practice" && SignImageData?.length) {
        setCurrentImage(SignImageData[Math.floor(Math.random() * SignImageData.length)]);
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

  const modeLabel = mode === "translate" ? "TRANSLATE MODE" : "PRACTICE MODE";

  return (
    <div className="signlang_detection-container">
      {accessToken ? (
        <>
          <div style={{ position: "relative" }}>
            <div className="signlang_mode-header">
              <div className="signlang_mode-label">
                <span>{modeLabel}</span>
              </div>
            </div>

            <Webcam audio={false} ref={webcamRef} className="signlang_webcam" />
            <canvas ref={canvasRef} className="signlang_canvas" />

            <div className="signlang_data-container">
              <button onClick={enableCam}>{webcamRunning ? "Stop" : "Start"}</button>

              <div className="signlang_data">
                <p className="gesture_output">
                  {gestureOutput ? `Recognized sign: ${gestureOutput}` : "No sign detected yet."}
                </p>

                {mode === "practice" && matchMsg ? (
                  <p style={{ marginTop: 10, fontWeight: 700 }}>{matchMsg}</p>
                ) : null}

                {progress > 0 && mode === "practice" ? <ProgressBar progress={progress} /> : null}
              </div>
            </div>
          </div>

          {mode === "practice" && (
            <div className="signlang_imagelist-container">
              <h2 className="gradient__text">Practice sign</h2>
              <div className="signlang_image-div">
                {currentImage ? (
                  <>
                    <img src={currentImage.url} alt={`img ${currentImage.id}`} />
                    <p>
                      Do the sign for: <b>{currentImage.sign || currentImage.name}</b>
                    </p>
                  </>
                ) : (
                  <h3 className="gradient__text">Click on Start to practice with images.</h3>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="signlang_detection_notLoggedIn">
          <h1 className="gradient__text">Please Login !</h1>
          <img src={DisplayImg} alt="diplay-img" />
          <p>Please login to test this detection feature.</p>
        </div>
      )}
    </div>
  );
};

export default DetectCore;