import React from "react";
import "./Card.css";

const getInitials = (name = "") => {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
};

const Card = ({ title, tag, text }) => {
  return (
    <article className="testimonial-card">
      <div className="testimonial-card__shine" />

      <div className="testimonial-card__header">
        <div className="testimonial-card__avatar">{getInitials(title)}</div>

        <div className="testimonial-card__info">
          <h3>{title}</h3>
          <span>{tag}</span>
        </div>

        <div className="testimonial-card__quote">“</div>
      </div>

      <div className="testimonial-card__body">
        <p>{text}</p>
      </div>
    </article>
  );
};

export default Card;