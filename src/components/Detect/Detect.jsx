import React, { useState, useRef, useEffect, useCallback } from "react";
import "./Detect.css";
import { v4 as uuidv4 } from "uuid";
import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { HAND_CONNECTIONS } from "@mediapipe/hands";

import Webcam from "react-webcam";
import { SignImageData } from "../../data/SignImageData";
import { useDispatch, useSelector } from "react-redux";
import { addSignData } from "../../redux/actions/signdataaction";
import ProgressBar from "./ProgressBar/ProgressBar";

import DisplayImg from "../../assests/displayGif.gif";

let startTime = "";

const Detect = () => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [webcamRunning, setWebcamRunning] = useState(false);
  const [gestureOutput, setGestureOutput] = useState("");
  const [gestureRecognizer, setGestureRecognizer] = useState(null);
  const [runningMode, setRunningMode] = useState("IMAGE");
  const [progress, setProgress] = useState(0);

  const requestRef = useRef();

  const [detectedData, setDetectedData] = useState([]);

  const user = useSelector((state) => state.auth?.user);
  const { accessToken } = useSelector((state) => state.auth);

  const dispatch = useDispatch();

  const [currentImage, setCurrentImage] = useState(null);

  // 🔹 mode: "translate" sau "practice"
  const [mode, setMode] = useState("translate");

  // imaginile de practice se schimbă DOAR când e mode === "practice"
  useEffect(() => {
    let intervalId;
    if (webcamRunning && mode === "practice") {
      intervalId = setInterval(() => {
        const randomIndex = Math.floor(Math.random() * SignImageData.length);
        const randomImage = SignImageData[randomIndex];
        setCurrentImage(randomImage);
      }, 5000);
    } else {
      setCurrentImage(null);
    }
    return () => clearInterval(intervalId);
  }, [webcamRunning, mode]);

  const predictWebcam = useCallback(() => {
    if (!gestureRecognizer || !webcamRef.current || !canvasRef.current) return;

    if (runningMode === "IMAGE") {
      setRunningMode("VIDEO");
      gestureRecognizer.setOptions({ runningMode: "VIDEO" });
    }

    const nowInMs = Date.now();
    const results = gestureRecognizer.recognizeForVideo(
      webcamRef.current.video,
      nowInMs
    );

    const canvasCtx = canvasRef.current.getContext("2d");
    canvasCtx.save();
    canvasCtx.clearRect(
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );

    const videoWidth = webcamRef.current.video.videoWidth;
    const videoHeight = webcamRef.current.video.videoHeight;

    if (!videoWidth || !videoHeight) {
      canvasCtx.restore();
      return;
    }

    webcamRef.current.video.width = videoWidth;
    webcamRef.current.video.height = videoHeight;

    canvasRef.current.width = videoWidth;
    canvasRef.current.height = videoHeight;

    // desenăm mâinile
    if (results.landmarks) {
      for (const landmarks of results.landmarks) {
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
          color: "#00FF00",
          lineWidth: 5,
        });
        drawLandmarks(canvasCtx, landmarks, { color: "#FF0000", lineWidth: 2 });
      }
    }

    if (results.gestures.length > 0) {
      const topGesture = results.gestures[0][0];
      const gestureName = topGesture.categoryName;
      const score = topGesture.score;

      setDetectedData((prevData) => [
        ...prevData,
        {
          SignDetected: gestureName,
        },
      ]);

      setGestureOutput(gestureName);
      setProgress(Math.round(parseFloat(score) * 100));
    } else {
      setGestureOutput("");
      setProgress(0);
    }

    if (webcamRunning === true) {
      requestRef.current = requestAnimationFrame(predictWebcam);
    }

    canvasCtx.restore();
  }, [webcamRunning, runningMode, gestureRecognizer]);

  const animate = useCallback(() => {
    requestRef.current = requestAnimationFrame(animate);
    predictWebcam();
  }, [predictWebcam]);

  const enableCam = useCallback(() => {
    if (!gestureRecognizer) {
      alert("Please wait for gestureRecognizer to load");
      return;
    }

    if (webcamRunning === true) {
      // STOP
      setWebcamRunning(false);
      cancelAnimationFrame(requestRef.current);
      setCurrentImage(null);

      // curățăm canvas-ul și outputul, ca să nu rămână mâna / semnul vechi
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        ctx.clearRect(
          0,
          0,
          canvasRef.current.width,
          canvasRef.current.height
        );
      }
      setGestureOutput("");
      setProgress(0);

      const endTime = new Date();

      const timeElapsed = (
        (endTime.getTime() - startTime.getTime()) /
        1000
      ).toFixed(2);

      const nonEmptyData = detectedData.filter(
        (data) => data.SignDetected !== "" && data.DetectedScore !== ""
      );

      const resultArray = [];
      let current = nonEmptyData[0];

      for (let i = 1; i < nonEmptyData.length; i++) {
        if (nonEmptyData[i].SignDetected !== current.SignDetected) {
          resultArray.push(current);
          current = nonEmptyData[i];
        }
      }

      if (current) {
        resultArray.push(current);
      }

      const countMap = new Map();

      for (const item of resultArray) {
        const count = countMap.get(item.SignDetected) || 0;
        countMap.set(item.SignDetected, count + 1);
      }

      const sortedArray = Array.from(countMap.entries()).sort(
        (a, b) => b[1] - a[1]
      );

      const outputArray = sortedArray
        .slice(0, 5)
        .map(([sign, count]) => ({ SignDetected: sign, count }));

      const data = {
        signsPerformed: outputArray,
        id: uuidv4(),
        username: user?.name,
        userId: user?.userId,
        createdAt: String(endTime),
        secondsSpent: Number(timeElapsed),
      };

      dispatch(addSignData(data));
      setDetectedData([]);
    } else {
      // START
      setWebcamRunning(true);
      startTime = new Date();
      requestRef.current = requestAnimationFrame(animate);
    }
  }, [
    webcamRunning,
    gestureRecognizer,
    animate,
    detectedData,
    user?.name,
    user?.userId,
    dispatch,
  ]);

  // încarcă modelul .task
  useEffect(() => {
    async function loadGestureRecognizer() {
      try {
        const modelPath =
          process.env.REACT_APP_TRAINED_MODEL_PATH ||
          process.env.REACT_APP_FIREBASE_STORAGE_TRAINED_MODEL_15_11_2025;

        console.log("MODEL PATH =", modelPath);

        if (!modelPath) {
          throw new Error(
            "Model path is not set. Check your .env (REACT_APP_TRAINED_MODEL_PATH sau REACT_APP_FIREBASE_STORAGE_TRAINED_MODEL_15_11_2025)."
          );
        }

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        const recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelPath,
          },
          numHands: 2,
          runningMode: runningMode,
        });

        setGestureRecognizer(recognizer);
        console.log("Gesture recognizer loaded ✅");
      } catch (e) {
        console.error("Failed to load gesture recognizer ❌", e);
      }
    }

    loadGestureRecognizer();
  }, [runningMode]);

  const modeLabel = mode === "translate" ? "TRANSLATE MODE" : "PRACTICE MODE";

  return (
    <>
      <div className="signlang_detection-container">
        {accessToken ? (
          <>
            <div style={{ position: "relative" }}>
              {/* butoanele de mod + label */}
              <div className="signlang_mode-header">
                <div className="signlang_mode-switch">
                  <button
                    type="button"
                    className={
                      mode === "translate"
                        ? "signlang_mode-btn active"
                        : "signlang_mode-btn"
                    }
                    onClick={() => setMode("translate")}
                  >
                    Translate
                  </button>
                  <button
                    type="button"
                    className={
                      mode === "practice"
                        ? "signlang_mode-btn active"
                        : "signlang_mode-btn"
                    }
                    onClick={() => setMode("practice")}
                  >
                    Practice
                  </button>
                </div>
                <div className="signlang_mode-label">
                  <span>{modeLabel}</span>
                </div>
              </div>

              <Webcam
                audio={false}
                ref={webcamRef}
                className="signlang_webcam"
              />

              <canvas ref={canvasRef} className="signlang_canvas" />

              <div className="signlang_data-container">
                <button onClick={enableCam}>
                  {webcamRunning ? "Stop" : "Start"}
                </button>

                <div className="signlang_data">
                  {/* în ambele moduri arătăm semnul curent */}
                  <p className="gesture_output">
                    {gestureOutput
                      ? `Recognized sign: ${gestureOutput}`
                      : "No sign detected yet."}
                  </p>

                  {progress ? <ProgressBar progress={progress} /> : null}
                </div>
              </div>
            </div>

            {/* panoul de practică doar în mode === "practice" */}
            {mode === "practice" && (
              <div className="signlang_imagelist-container">
                <h2 className="gradient__text">Practice sign</h2>

                <div className="signlang_image-div">
                  {currentImage ? (
                    <>
                      <img
                        src={currentImage.url}
                        alt={`img ${currentImage.id}`}
                      />
                      <p>Try to perform the sign shown in the image.</p>
                    </>
                  ) : (
                    <h3 className="gradient__text">
                      Click on Start to practice with images.
                    </h3>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="signlang_detection_notLoggedIn">
            <h1 className="gradient__text">Please Login !</h1>
            <img src={DisplayImg} alt="diplay-img" />
            <p>
              We save your detection data to show your progress and learning in
              the dashboard, so please login to test this detection feature.
            </p>
          </div>
        )}
      </div>
    </>
  );
};

export default Detect;
