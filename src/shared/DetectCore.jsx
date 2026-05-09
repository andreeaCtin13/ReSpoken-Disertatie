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

let startTime = null;

const PRACTICE_DETECT_THRESHOLD = 0.12;
const MATCH_THRESHOLD = 0.16;
const BASE_POINTS = 50;
const MOBILE_BREAKPOINT = 800;

const normalizeSign = (s) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const DetectCore = ({ mode = "translate" }) => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);

  const requestRef = useRef(null);
  const recognizerRef = useRef(null);
  const webcamRunningRef = useRef(false);
  const currentImageRef = useRef(null);
  const modeRef = useRef(mode);

  const [webcamRunning, setWebcamRunning] = useState(false);
  const [gestureOutput, setGestureOutput] = useState("");
  const [progress, setProgress] = useState(0);
  const [detectedData, setDetectedData] = useState([]);

  const practiceCountsRef = useRef(new Map());
  const practiceStatsRef = useRef({ attempts: 0, matches: 0, totalPoints: 0 });
  const matchedCurrentPromptRef = useRef(false);

  const user = useSelector((state) => state.auth?.user);
  const { accessToken } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  const [currentImage, setCurrentImage] = useState(null);
  const [matchMsg, setMatchMsg] = useState("");
  const [promptMatched, setPromptMatched] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(
    typeof window !== "undefined" ? window.innerWidth <= MOBILE_BREAKPOINT : false
  );

  useEffect(() => {
    currentImageRef.current = currentImage;
  }, [currentImage]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const onResize = () => {
      setIsMobileViewport(window.innerWidth <= MOBILE_BREAKPOINT);
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
    setPromptMatched(false);
    matchedCurrentPromptRef.current = false;

    if (webcamRunning && mode === "practice" && currentImage) {
      practiceStatsRef.current = {
        ...practiceStatsRef.current,
        attempts: practiceStatsRef.current.attempts + 1,
      };
    }
  }, [currentImage?.id, webcamRunning, mode, currentImage]);

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
    const liveMode = modeRef.current;
    const liveImage = currentImageRef.current;

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

      // WIDGET
      if (gestureName && score > 0.5) {
        window.postMessage(
          {
            source: "respoken",
            type: "translation",
            text: gestureName,
            score: score,
          },
          "*"
        );
      }

      if (liveMode !== "practice") {
        setDetectedData((prev) => [
          ...prev,
          { SignDetected: gestureName, DetectedScore: score },
        ]);
      }

      if (liveMode === "practice") {
        if (!liveImage || score < PRACTICE_DETECT_THRESHOLD) {
          requestRef.current = requestAnimationFrame(predictWebcam);
          return;
        }

        const targetRaw = liveImage.sign || liveImage.name || "";
        const target = normalizeSign(targetRaw);
        const detected = normalizeSign(gestureName);

        const sameSign =
          target &&
          detected &&
          (detected === target ||
            detected.includes(target) ||
            target.includes(detected));

        const isMatch = sameSign && score >= MATCH_THRESHOLD;

        console.log("[PRACTICE CHECK]", {
          targetRaw,
          target,
          gestureName,
          detected,
          score,
          sameSign,
          isMatch,
          alreadyMatched: matchedCurrentPromptRef.current,
        });

        if (isMatch) {
          setPromptMatched(true);

          if (!matchedCurrentPromptRef.current) {
            matchedCurrentPromptRef.current = true;

            const m = practiceCountsRef.current;
            m.set(targetRaw, (m.get(targetRaw) || 0) + 1);

            const points = Math.max(1, Math.round(BASE_POINTS * score));

            practiceStatsRef.current = {
              attempts: practiceStatsRef.current.attempts,
              matches: practiceStatsRef.current.matches + 1,
              totalPoints: practiceStatsRef.current.totalPoints + points,
            };

            setMatchMsg(
              `✅ MATCH CONFIRMED: ${targetRaw} — saved (${Math.round(score * 100)}%)`
            );
          } else {
            setMatchMsg(
              `✅ Already matched for this prompt: ${targetRaw} (${Math.round(score * 100)}%)`
            );
          }
        } else {
          if (!matchedCurrentPromptRef.current) {
            setPromptMatched(false);
            setMatchMsg(`❌ Detected: ${gestureName} (${Math.round(score * 100)}%)`);
          }
        }
      }
    } catch (e) {
      console.warn("recognizeForVideo frame failed:", e);
    } finally {
      ctx.restore();
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  }, []);

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

        console.log("[PRACTICE SAVE]", {
          signsPerformed,
          stats,
        });

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
        matchedCurrentPromptRef.current = false;
        setPromptMatched(false);
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
      matchedCurrentPromptRef.current = false;
      setPromptMatched(false);

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

  const isMobilePractice = mode === "practice" && isMobileViewport;

  const renderRecognitionCard = (compact = false) => (
    <div
      className="signlang_detection-info-card signlang_detection-info-card--highlight"
      style={
        mode === "practice" && promptMatched
          ? {
              border: "2px solid rgba(46, 204, 113, 0.9)",
              boxShadow: "0 0 0 2px rgba(46, 204, 113, 0.18), 0 0 30px rgba(46, 204, 113, 0.18)",
              background:
                "linear-gradient(180deg, rgba(10, 35, 24, 0.95) 0%, rgba(11, 20, 34, 0.96) 100%)",
            }
          : undefined
      }
    >
      <div
        className={`signlang_detection-card-head ${
          compact ? "signlang_detection-card-head--compact" : ""
        }`}
      >
        <div>
          <span className="signlang_detection-card-kicker">
            {mode === "practice" && promptMatched ? "Recognition saved" : "Recognition"}
          </span>
          <h2>{mode === "practice" && promptMatched ? "Matched successfully" : "Live result"}</h2>
        </div>
      </div>

      <div className="signlang_detection-result-box signlang_detection-result-box--big">
        <div>
          <span className="signlang_detection-result-label">
            {mode === "practice" && promptMatched ? "Recognized prompt" : "Translated sign"}
          </span>
          <p
            className="gesture_output gesture_output--large"
            style={
              mode === "practice" && promptMatched
                ? { color: "#7CFFB2", fontWeight: 800 }
                : undefined
            }
          >
            {gestureOutput ? gestureOutput : "No sign detected yet."}
          </p>

          {mode === "practice" && promptMatched ? (
            <p
              style={{
                marginTop: "12px",
                color: "#7CFFB2",
                fontWeight: 700,
                fontSize: "0.98rem",
              }}
            >
              ✔ Match accepted for current prompt
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );

  const renderTranslateLayout = () => (
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

      <div className="signlang_detection-layout translate-layout">
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

          <div className="signlang_detection-stage signlang_detection-stage--compact">
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

        <div className="signlang_detection-side">{renderRecognitionCard()}</div>
      </div>
    </>
  );

  const renderPracticeDesktopLayout = () => (
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

      <div className="signlang_detection-layout practice-layout">
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

          <div className="signlang_detection-stage signlang_detection-stage--compact">
            <Webcam
              audio={false}
              ref={webcamRef}
              className="signlang_webcam"
            />
            <canvas ref={canvasRef} className="signlang_canvas" />
          </div>

          {progress > 0 ? (
            <div className="signlang_detection-stage-progress">
              <span>Confidence</span>
              <ProgressBar progress={progress} />
            </div>
          ) : null}

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
          {renderRecognitionCard()}

          <div className="signlang_detection-feedback-card">
            <div className="signlang_detection-card-head signlang_detection-card-head--compact">
              <div>
                <span className="signlang_detection-card-kicker">Feedback</span>
                <h2>Match status</h2>
              </div>
            </div>

            <div className="signlang_detection-feedback-box">
              <p
                className="signlang_detection-match signlang_detection-match--standalone"
                style={
                  promptMatched
                    ? { color: "#7CFFB2", fontWeight: 800 }
                    : undefined
                }
              >
                {matchMsg || "Perform the prompted sign to see feedback here."}
              </p>
            </div>
          </div>

          <div className="signlang_detection-practice-card">
            <div className="signlang_detection-card-head">
              <div>
                <span className="signlang_detection-card-kicker">Practice prompt</span>
                <h2>Current sign to perform</h2>
              </div>
            </div>

            <div className="signlang_image-div">
              {currentImage ? (
                <div className="signlang_detection-practice-split">
                  <div className="signlang_detection-practice-image-wrap">
                    <img src={currentImage.url} alt={`img ${currentImage.id}`} />
                  </div>

                  <div className="signlang_detection-practice-copy">
                    <p className="signlang_detection-practice-label">
                      Do the sign for
                    </p>
                    <p className="signlang_detection-practice-text">
                      <b>{currentImage.sign || currentImage.name}</b>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="signlang_detection-practice-empty">
                  <h3>Click on Start to practice with images.</h3>
                  <p>
                    Once the session starts, a random sign prompt will appear here
                    every few seconds.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderPracticeMobileLayout = () => {
    if (!webcamRunning) {
      return (
        <div className="signlang_detection-mobile-startonly">
          <div className="signlang_detection-mobile-start-card">
            <span className="signlang_detection-pill">Practice mode</span>
            <h1>Practice with guided signs</h1>
            <p>
              Start the session and the practice screen will open below the navbar.
            </p>

            <button
              className="signlang_detection-main-btn is-start signlang_detection-mobile-start-btn"
              onClick={enableCam}
            >
              Start session
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="signlang_detection-mobile-practice-live">
        <div className="signlang_detection-mobile-practice-stage">
          <div className="signlang_detection-mobile-practice-stage-inner">
            {currentImage ? (
              <>
                <div className="signlang_detection-mobile-practice-image">
                  <img src={currentImage.url} alt={`img ${currentImage.id}`} />
                </div>

                <div className="signlang_detection-mobile-practice-overlay-copy">
                  <span className="signlang_detection-mobile-practice-overlay-label">
                    Do this sign
                  </span>
                  <p className="signlang_detection-mobile-practice-overlay-text">
                    {currentImage.sign || currentImage.name}
                  </p>
                </div>
              </>
            ) : (
              <div className="signlang_detection-mobile-practice-empty">
                <h3>Preparing practice prompt...</h3>
                <p>A sign prompt will appear here in a moment.</p>
              </div>
            )}

            <div className="signlang_detection-mobile-self-preview">
              <div className="signlang_detection-mobile-self-preview-shell">
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  className="signlang_webcam"
                />
                <canvas ref={canvasRef} className="signlang_canvas" />
              </div>
            </div>
          </div>
        </div>

        <div className="signlang_detection-mobile-live-meta">
          <div className="signlang_detection-mini-strip">
            <div className="signlang_detection-mini-strip-item">
              <span>Status</span>
              <strong>Session active</strong>
            </div>
            <div className="signlang_detection-mini-strip-item">
              <span>Recognition</span>
              <strong>{progress > 0 ? `${progress}%` : "Waiting"}</strong>
            </div>
          </div>

          {renderRecognitionCard(true)}

          <div className="signlang_detection-feedback-card">
            <div className="signlang_detection-card-head signlang_detection-card-head--compact">
              <div>
                <span className="signlang_detection-card-kicker">Feedback</span>
                <h2>Match status</h2>
              </div>
            </div>

            <div className="signlang_detection-feedback-box">
              <p
                className="signlang_detection-match signlang_detection-match--standalone"
                style={
                  promptMatched
                    ? { color: "#7CFFB2", fontWeight: 800 }
                    : undefined
                }
              >
                {matchMsg || "Perform the prompted sign to see feedback here."}
              </p>
            </div>
          </div>

          {progress > 0 ? (
            <div className="signlang_detection-stage-progress">
              <span>Confidence</span>
              <ProgressBar progress={progress} />
            </div>
          ) : null}

          <div className="signlang_detection-controls signlang_detection-controls--mobile-practice">
            <button
              className="signlang_detection-main-btn is-stop signlang_detection-mobile-stop-btn"
              onClick={enableCam}
            >
              Stop session
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="signlang_detection-page">
      <div className="signlang_detection-bg signlang_detection-bg--one" />
      <div className="signlang_detection-bg signlang_detection-bg--two" />

      <div className="signlang_detection-container">
        {accessToken ? (
          mode === "translate"
            ? renderTranslateLayout()
            : isMobilePractice
            ? renderPracticeMobileLayout()
            : renderPracticeDesktopLayout()
        ) : (
          <div className="signlang_detection_notLoggedIn">
            <div className="signlang_detection_login-card">
              <span className="signlang_detection-pill">Restricted feature</span>
              <h1>Please login</h1>
              <p>Please login to test this detection feature.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default DetectCore;