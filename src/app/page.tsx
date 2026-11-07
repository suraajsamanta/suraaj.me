const linkedin = "https://www.linkedin.com/in/suraaj-samanta-gatech/";
const github = "https://github.com/suraajsamanta";
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
      <div className="grain" aria-hidden="true" />
      <span className="corner-note">suraaj.me</span>
      <section className="intro" aria-labelledby="name">
        <p className="hello">hey, I’m</p>
        <h1 id="name">Suraaj Samanta</h1>
        <p className="tagline">learning, building, exploring.</p>
        <nav className="socials" aria-label="Find me online">
          <a href={github} target="_blank" rel="noopener noreferrer">
            <GithubIcon />
            <span>GitHub</span>
            <span className="arrow" aria-hidden="true">
              ↗
            </span>
          </a>
          <span className="separator" aria-hidden="true" />
          <a href={linkedin} target="_blank" rel="noopener noreferrer">
            <LinkedInIcon />
            <span>LinkedIn</span>
            <span className="arrow" aria-hidden="true">
              ↗
            </span>
          </a>
        </nav>
      </section>
      <footer>
        <span>always a work in progress.</span>
        <span>© 2026</span>
      </footer>
    </main>
  );
}
