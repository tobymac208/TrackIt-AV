import { useState } from 'react';
import { Link } from 'react-router-dom';

const FEATURE_REQUEST_EMAIL = 'nik56+jsriohazdgpcixcdjjas@boards.trello.com';
const IMPORTANCE_LEVELS = ['low', 'normal', 'medium', 'high'];

const examples = [
  {
    src: '/landing/dashboard.png',
    alt: 'Dashboard with replacement review and end-of-support alerts',
    title: 'Hardware lifecycle dashboard',
    description: 'See what is past end of support, out of warranty, or due for replacement.',
  },
  {
    src: '/landing/rooms.png',
    alt: 'Conference rooms list with functional and issue status',
    title: 'Conference room status',
    description: 'Track room health and document issues that need a fix or a spare shipped out.',
  },
  {
    src: '/landing/inventory.png',
    alt: 'Shelf stock inventory with quantities ready to deploy',
    title: 'Shelf stock inventory',
    description: 'Know what transmitters, navigators, and other gear are ready to deploy.',
  },
];

export default function Landing() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [importance, setImportance] = useState('normal');
  const [request, setRequest] = useState('');

  const handleFeatureRequest = (event) => {
    event.preventDefault();
    const subject = `[${importance}] Feature request from ${name.trim()}`;
    const body = [
      `Name: ${name.trim()}`,
      `Email: ${email.trim()}`,
      `Importance: ${importance}`,
      '',
      request.trim(),
    ].join('\n');
    window.location.href = `mailto:${FEATURE_REQUEST_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="landing-page">
      <header className="landing-topbar">
        <span className="landing-topbar-name">TrackIt! AV</span>
        <Link to="/login" className="btn btn-primary">
          Login
        </Link>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <h1>TrackIt! AV</h1>
          <p className="landing-lead">
            A general-use AV hardware lifecycle tracker. Inventory conference rooms, installed
            devices, and shelf stock so replacements and emergency shipments are ready when a room
            goes down.
          </p>
        </section>

        <section className="landing-examples" aria-label="Example screens">
          {examples.map((example) => (
            <figure key={example.src} className="landing-example">
              <img src={example.src} alt={example.alt} />
              <figcaption>
                <strong>{example.title}</strong>
                <span>{example.description}</span>
              </figcaption>
            </figure>
          ))}
        </section>

        <section className="landing-request" aria-labelledby="feature-request-heading">
          <h2 id="feature-request-heading">Request a feature</h2>
          <p>
            Have an idea for TrackIt! AV? Send a request and it will go straight to the product
            board.
          </p>
          <form className="landing-request-form" onSubmit={handleFeatureRequest}>
            <div className="form-field">
              <label htmlFor="feature-name" className="required">
                Name
              </label>
              <input
                id="feature-name"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="feature-email" className="required">
                Email
              </label>
              <input
                id="feature-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="feature-importance" className="required">
                Importance
              </label>
              <select
                id="feature-importance"
                name="importance"
                value={importance}
                onChange={(e) => setImportance(e.target.value)}
                required
              >
                {IMPORTANCE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field landing-request-details">
              <label htmlFor="feature-request" className="required">
                Feature request
              </label>
              <textarea
                id="feature-request"
                name="request"
                rows={4}
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-primary" type="submit">
              Email request
            </button>
          </form>
        </section>
      </main>

      <footer className="landing-footer">
        <p>Created by Nik Fernandez and Cursor</p>
      </footer>
    </div>
  );
}
