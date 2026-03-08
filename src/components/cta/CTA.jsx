import React from "react";
import "./CTA.css";
import { Link } from "react-router-dom";

const CTA = () => {
  return (
    <section className="signlang_cta-section">
      <div className="signlang_cta">
        <div className="signlang_cta-glow signlang_cta-glow--left" />
        <div className="signlang_cta-glow signlang_cta-glow--right" />

        <div className="signlang_cta-content">

          <h3>Start detecting sign language in real time</h3>

          <p>
            Test the model, explore the interface and see how quickly the app
            can recognize gestures in a smooth, interactive experience.
          </p>
        </div>

        <div className="signlang_cta-button">
          <Link to="/detect" className="signlang_cta-link">
            <span>Try the model</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M5 12H19M19 12L13 6M19 12L13 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default CTA;