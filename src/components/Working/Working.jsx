import React from "react";
import "./Working.css";

const Working = () => {
  return (
    <div className="signlang_working section__padding">
      <div className="signlang_working-visual">
        <div className="signlang_working-illustration">
          <div className="signlang_working-ring ring-1"></div>
          <div className="signlang_working-ring ring-2"></div>
          <div className="signlang_working-ring ring-3"></div>

          <div className="signlang_working-card card-hello">HELLO</div>
          <div className="signlang_working-card card-wave">WAVE</div>
          <div className="signlang_working-card card-sign">SIGN</div>

          <div className="signlang_working-hand">
            <span className="finger finger-1"></span>
            <span className="finger finger-2"></span>
            <span className="finger finger-3"></span>
            <span className="finger finger-4"></span>
            <span className="thumb"></span>
            <span className="palm"></span>
          </div>

          <div className="signlang_working-glow"></div>
        </div>
      </div>

      <div className="signlang_working-content">
        <h1 className="gradient__text">Get to know how it works</h1>
        <p>
          To use the sign language recognition system, you simply need to get
          your hand detected and make a sign. Once you make a sign, refer to
          the guide for the corresponding words. The system will then scan your
          hand and use its built-in model to predict the sign you have made.
          Finally, the predicted class will be displayed, allowing you to
          communicate effectively through sign language. With this system, you
          can bridge the communication gap between sign language users and
          non-sign language users, making it easier for everyone to connect and
          interact.
        </p>
      </div>
    </div>
  );
};

export default Working;