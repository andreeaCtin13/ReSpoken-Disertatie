import React from 'react'
import "./Header.css"
import SignHand from "../../assests/SignHand.png";

const Header = () => {
  return (
    <div className="signlang__header section__padding gradient__bg" id="home">

    <div className="signlang__header-content">
      <h1 className="gradient__text">Connect with ReSpoken.</h1>
      <p>
        This app is more than just a learning tool. It’s a step toward inclusion. It gives you the chance to learn sign language while also enabling real communication with people who use it every day. Togheter, we are breaking communication barriers and creating a more inclusive society.      </p>

    </div>
    <div className="signlang__header-image">
      <img src={SignHand} alt='SIGN-HAND'/>
    </div>
  </div>
  )
}

export default Header