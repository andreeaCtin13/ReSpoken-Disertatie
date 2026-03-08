import React from "react";
import "./Testimonials.css";
import { userFeedback } from "../../data/FeedbackData";
import Card from "./Card/Card";

const Testimonials = () => {
  const loopedFeedback = [...userFeedback, ...userFeedback];

  return (
    <section className="signlang_testimonials section__padding">
      <div className="signlang_testimonial-header">
        <span className="signlang_testimonial-badge">Testimonials</span>

        <h2 className="signlang_testimonial-title">
          What users and domain experts say about our platform
        </h2>

        <p className="signlang_testimonial-subtitle">
          Real feedback from people who explored the experience, usability and
          impact of the sign language web application.
        </p>
      </div>

      <div className="signlang_testimonials-marquee">
        <div className="signlang_testimonials-track">
          {loopedFeedback.map((data, i) => (
            <div className="signlang_testimonials-slide" key={`${data.title}-${i}`}>
              <Card title={data.title} text={data.text} tag={data.tag} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;