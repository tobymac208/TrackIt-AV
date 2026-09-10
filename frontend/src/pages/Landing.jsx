import { Link } from 'react-router-dom';

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
  return (
    <div className="landing-page">
      <header className="landing-topbar">
        <span className="landing-topbar-name">AV Tracker</span>
        <Link to="/login" className="btn btn-primary">
          Login
        </Link>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <h1>AV Tracker</h1>
          <p className="landing-lead">
            Ryan Companies AV hardware lifecycle tracker. Inventory conference rooms, installed
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
      </main>

      <footer className="landing-footer">
        <p>Created by Nik Fernandez and Cursor</p>
      </footer>
    </div>
  );
}
