"use client";

import { useState } from "react";

const linkedin = "https://www.linkedin.com/in/suraaj-samanta-gatech/";

export default function Home() {
  const [totality, setTotality] = useState(false);

  return (
    <main className={totality ? "site totality" : "site"}>
      <a className="skip" href="#about">Skip to content</a>
      <div className="grain" aria-hidden="true" />
      <header className="header">
        <a href="#" className="wordmark" aria-label="Suraaj Samanta home">s<span className="brand-star">✳</span>s</a>
        <span className="header-note">A PERSONAL CORNER OF THE INTERNET</span>
        <a className="contact-link" href={linkedin} target="_blank" rel="noopener noreferrer">Let’s talk <span>↗</span></a>
      </header>

      <section className="hero" aria-labelledby="name">
        <div className="orbital-scene" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="corona" /><div className="eclipse" />
          <span className="star star-one">+</span><span className="star star-two">+</span>
        </div>
        <div className="hero-eyebrow"><span className="status-dot" /> SOMEWHERE BETWEEN AMBITION & OBSESSION</div>
        <h1 id="name"><span>SURAAJ</span><span className="surname">SAMANTA<span className="name-period">.</span></span></h1>
        <div className="hero-bottom">
          <p>Quietly building.<br /><span>Thinking beyond the visible.</span></p>
          <button className="totality-button" onClick={() => setTotality(!totality)} aria-pressed={totality}><span className="mini-eclipse" />{totality ? "LEAVE TOTALITY" : "ENTER TOTALITY"}<span className="button-arrow">↗</span></button>
        </div>
        <a href="#about" className="scroll-link"><span>SCROLL TO DISCOVER</span><span className="scroll-arrow">↓</span></a>
        <span className="hero-coordinate" aria-hidden="true">01 / THE ARRIVAL</span>
      </section>

      <section className="about" id="about" aria-labelledby="about-title">
        <div className="section-label"><span className="crosshair">+</span> 02 / THE SIGNAL</div>
        <div className="about-content">
          <h2 id="about-title">Drawn to the<br /><span>not-yet-possible.</span></h2>
          <div className="about-details"><p>I’m Suraaj. My world sits at the intersection of software engineering, machine learning, and the drive to build something that matters.</p><p>A Georgia Tech background. A restless curiosity. The next chapter is taking shape.</p></div>
          <a className="profile-link" href={linkedin} target="_blank" rel="noopener noreferrer"><span>THE LONGER STORY</span><span>LinkedIn ↗</span></a>
        </div>
      </section>

      <section className="connect" aria-labelledby="connect-title"><div className="section-label"><span className="status-dot" /> 03 / MAKE CONTACT</div><h2 id="connect-title">Good things start<br />with a <a href={linkedin} target="_blank" rel="noopener noreferrer">signal <span>↗</span></a></h2><p>Interesting ideas. Unexpected connections. Say hello.</p></section>
      <footer><a href="#" className="footer-name">SURAAJ SAMANTA</a><span>© {new Date().getFullYear()}</span><a href="https://github.com/suraajsamanta" target="_blank" rel="noopener noreferrer">GITHUB ↗</a><a href={linkedin} target="_blank" rel="noopener noreferrer">LINKEDIN ↗</a><a className="back-top" href="#">BACK TO THE SURFACE ↑</a></footer>
    </main>
  );
}
