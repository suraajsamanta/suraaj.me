const linkedin = "https://www.linkedin.com/in/suraaj-samanta-gatech/";
const github = "https://github.com/suraajsamanta";
function Mark() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M16 2v28M2 16h28M6 6l20 20M6 26 26 6"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <circle
        cx="16"
        cy="16"
        r="5"
        fill="var(--bg)"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .8a11.3 11.3 0 0 0-3.57 22.02c.56.1.77-.24.77-.54v-2.1c-3.15.68-3.81-1.34-3.81-1.34-.52-1.3-1.26-1.65-1.26-1.65-1.03-.7.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.01 1.73 2.65 1.23 3.3.94.1-.73.4-1.23.72-1.51-2.51-.29-5.15-1.26-5.15-5.59 0-1.23.44-2.24 1.17-3.03-.12-.28-.51-1.44.11-3 0 0 .95-.3 3.11 1.16a10.8 10.8 0 0 1 5.66 0c2.16-1.46 3.11-1.16 3.11-1.16.62 1.56.23 2.72.11 3a4.37 4.37 0 0 1 1.17 3.03c0 4.34-2.64 5.3-5.16 5.58.4.35.77 1.04.77 2.1v3.09c0 .3.2.65.78.54A11.3 11.3 0 0 0 12 .8Z" />
    </svg>
  );
}
function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 2H3.55C2.69 2 2 2.68 2 3.52v16.96c0 .84.69 1.52 1.55 1.52h16.9c.86 0 1.55-.68 1.55-1.52V3.52c0-.84-.69-1.52-1.55-1.52ZM7.93 18.75H4.98V9.2h2.95v9.55ZM6.45 7.9a1.71 1.71 0 1 1 0-3.42 1.71 1.71 0 0 1 0 3.42Zm12.3 10.85H15.8V14.1c0-1.1-.02-2.52-1.53-2.52-1.54 0-1.78 1.2-1.78 2.44v4.73H9.54V9.2h2.83v1.3h.04c.4-.75 1.36-1.54 2.8-1.54 3 0 3.54 1.98 3.54 4.55v5.24Z" />
    </svg>
  );
}
export default function Home() {
  return (
    <main className="site">
      <a className="skip" href="#signal">
        Skip to content
      </a>
      <div className="grain" aria-hidden="true" />
      <header className="header">
        <a href="#" className="wordmark" aria-label="Suraaj home">
          <Mark />
          suraaj<span>.</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#signal">The signal</a>
          <a href={github} target="_blank" rel="noopener noreferrer">
            GitHub ↗
          </a>
        </nav>
        <a
          className="contact-link"
          href={linkedin}
          target="_blank"
          rel="noopener noreferrer"
        >
          Make contact <span>↗</span>
        </a>
      </header>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-content">
          <div className="eyebrow">
            <span className="status-dot" /> INDEPENDENT MIND. INFINITE
            POSSIBILITIES.
          </div>
          <h1 id="hero-title">
            A little ahead
            <br />
            of <span>the curve.</span>
          </h1>
          <p className="hero-description">
            Suraaj Samanta. Exploring the space between
            <br className="desktop-break" /> intelligence, software, and
            whatever comes next.
          </p>
          <div className="hero-actions">
            <a
              className="primary-button"
              href={linkedin}
              target="_blank"
              rel="noopener noreferrer"
            >
              Let’s connect <span>↗</span>
            </a>
            <a
              href={github}
              target="_blank"
              rel="noopener noreferrer"
              className="icon-link"
              aria-label="Suraaj on GitHub"
            >
              <GithubIcon />
            </a>
            <a
              href={linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="icon-link"
              aria-label="Suraaj on LinkedIn"
            >
              <LinkedInIcon />
            </a>
          </div>
        </div>
        <div className="hero-baseline">
          <span>
            <span className="tiny-cross">+</span> LESS NOISE. MORE POSSIBILITY.
          </span>
          <a href="#signal" className="discover-link">
            EXPLORE <span>↓</span>
          </a>
        </div>
      </section>
      <section className="signal" id="signal" aria-labelledby="signal-title">
        <div className="signal-intro">
          <div className="eyebrow">
            <span className="tiny-cross">+</span> THE SIGNAL
          </div>
          <h2 id="signal-title">
            Stay curious.
            <br />
            Build with intent.
          </h2>
          <p>
            Software engineering and machine learning.
            <br />A Georgia Tech foundation.
            <br />
            Always looking at what could be.
          </p>
        </div>
        <div className="principles">
          {[
            {
              title: "Explore the edges.",
              text: "The most interesting ideas live between disciplines.",
              icon: "✳",
            },
            {
              title: "Make it real.",
              text: "From a passing thought to something you can use.",
              icon: "⌘",
            },
            {
              title: "Keep the horizon open.",
              text: "Good conversations tend to lead somewhere unexpected.",
              icon: "◎",
            },
          ].map((item, i) => (
            <article key={item.title}>
              <span className="principle-icon" aria-hidden="true">
                {item.icon}
              </span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
              <span className="index">0{i + 1}</span>
            </article>
          ))}
        </div>
      </section>
      <section className="connect">
        <div>
          <span className="eyebrow">OPEN CHANNEL</span>
          <h2>Something on your mind?</h2>
          <p>I’m always up for an interesting conversation.</p>
        </div>
        <a
          href={linkedin}
          className="connect-button"
          target="_blank"
          rel="noopener noreferrer"
        >
          Send a signal <span>↗</span>
        </a>
      </section>
      <footer>
        <a href="#" className="footer-brand">
          <Mark />
          suraaj.
        </a>
        <span>© 2026 Suraaj Samanta</span>
        <div>
          <a
            href={github}
            aria-label="GitHub"
            target="_blank"
            rel="noopener noreferrer"
          >
            <GithubIcon />
          </a>
          <a
            href={linkedin}
            aria-label="LinkedIn"
            target="_blank"
            rel="noopener noreferrer"
          >
            <LinkedInIcon />
          </a>
          <span className="footer-note">
            STILL EXPLORING <span className="status-dot" />
          </span>
        </div>
      </footer>
    </main>
  );
}
