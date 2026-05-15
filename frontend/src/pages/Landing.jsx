import { Link } from 'react-router-dom';

const BACTERIA = [
  { name: 'Salmonella spp.', result: 'Not Detected', safe: true },
  { name: 'E. coli O157:H7', result: 'Not Detected', safe: true },
  { name: 'Staph. aureus', result: 'Not Detected', safe: true },
];

const PROBLEMS = [
  { icon: '🤢', title: '600M+ get sick yearly', desc: 'Foodborne illness is a global crisis. Travelers in SE Asia face heightened risk from unfamiliar bacteria and food-handling practices.' },
  { icon: '🚫', title: 'No way to know', desc: "It's impossible to judge food safety by sight or smell. Foreigners avoid local food out of fear — missing out on culture and experience." },
  { icon: '🔬', title: 'Lab tests take days', desc: 'Traditional food testing takes 24–72 hours and costs hundreds of ringgit — far too slow and expensive for daily consumer use.' },
];

const HOW = [
  { step: '01', icon: '🥄', title: 'Take a sample', desc: 'Collect a small food sample using the single-use test strip' },
  { step: '02', icon: '📲', title: 'Insert & Start', desc: 'Insert strip into the BiteBuddy device and tap Start on the app' },
  { step: '03', icon: '✅', title: 'Get results', desc: '15 minutes later — safe, warning, or danger result on your phone' },
];

export default function Landing() {
  return (
    <div className="pt-16">
      {/* HERO */}
      <section className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-16 items-center">
        <div>
          <div className="inline-flex items-center gap-2 bg-green-light text-green-dark text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
            <span className="pulse-dot w-2 h-2 bg-green rounded-full block" />
            Live in Kuala Lumpur
          </div>
          <h1 className="font-head text-5xl md:text-6xl font-extrabold leading-tight mb-6">
            Eat <span className="text-green">fearlessly</span> in Malaysia.
          </h1>
          <p className="text-gray-500 text-lg leading-relaxed mb-8">
            BiteBuddy is a rapid biosensor system that detects 3 major foodborne bacteria in 15 minutes — so travelers and expats can dine with confidence anywhere in SE Asia.
          </p>
          <div className="flex gap-3 flex-wrap">
            <Link to="/map" className="btn-primary no-underline">🗺 Find Safe Restaurants</Link>
            <Link to="/pricing" className="btn-outline no-underline">View Plans</Link>
          </div>
          <div className="flex gap-8 mt-10 pt-8 border-t border-gray-200">
            {[['15 min', 'Test results'],['3','Bacteria detected'],['20+', 'KL Venues']].map(([n, l]) => (
              <div key={l}>
                <div className="font-head text-3xl font-extrabold text-navy">{n}</div>
                <div className="text-sm text-gray-400 mt-1">{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Device mockup */}
        <div className="flex justify-center">
          <div className="card p-6 w-72 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <span className="font-head font-bold text-navy">BiteBuddy</span>
              <span className="flex items-center gap-1.5 text-green text-xs font-semibold">
                <span className="pulse-dot w-2 h-2 bg-green rounded-full block" />
                Scanning…
              </span>
            </div>
            <div className="bg-green-light rounded-xl p-4 text-center mb-4">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Overall Result</div>
              <div className="font-head text-4xl font-extrabold text-green">SAFE ✓</div>
              <div className="text-xs text-green-dark mt-1">Low risk detected</div>
            </div>
            <div className="flex flex-col gap-2">
              {BACTERIA.map(b => (
                <div key={b.name} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2 text-sm">
                  <span className="italic text-navy text-xs">{b.name}</span>
                  <span className="text-green font-semibold text-xs">Not Detected</span>
                </div>
              ))}
            </div>
            <div className="text-center mt-4 text-xs text-gray-400">
              Time Elapsed<br />
              <span className="font-head text-xl font-bold text-navy">15:00</span>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES STRIP */}
      <div className="bg-navy py-5">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap justify-center gap-8">
          {[['🧬','University of Malaya IP-backed'],['⚡','Results in 15 minutes'],['🦠','3 bacteria detected'],['📱','QR code per restaurant'],['🌏','Built for SE Asia']].map(([icon, label]) => (
            <div key={label} className="flex items-center gap-2.5 text-white/80 text-sm font-medium">
              <span className="text-lg">{icon}</span>{label}
            </div>
          ))}
        </div>
      </div>

      {/* PROBLEMS */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="section-title text-center mb-12">The problem we solve</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {PROBLEMS.map(p => (
            <div key={p.title} className="card p-8">
              <div className="text-4xl mb-4">{p.icon}</div>
              <h3 className="font-head text-lg font-bold mb-2">{p.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-green-light py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="section-title text-center mb-12">How BiteBuddy works</h2>
          <div className="flex flex-wrap justify-center gap-6">
            {HOW.map(s => (
              <div key={s.step} className="card p-8 text-center flex-1 min-w-52 max-w-xs">
                <div className="font-head text-xs font-bold text-green tracking-widest uppercase mb-3">{s.step}</div>
                <div className="text-4xl mb-3">{s.icon}</div>
                <h3 className="font-head text-lg font-bold mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="font-head text-4xl font-extrabold mb-4">Ready to eat safely?</h2>
        <p className="text-gray-400 mb-8 max-w-md mx-auto">Join thousands of travelers who trust BiteBuddy to verify their food before every meal.</p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link to="/map" className="btn-primary no-underline text-lg px-8 py-4">View Safe Restaurant Map →</Link>
          <Link to="/apply" className="btn-outline no-underline text-lg px-8 py-4">Apply for Certification</Link>
        </div>
      </section>

      <footer className="bg-navy text-white/50 text-center py-8 text-sm">
        <strong className="text-white">BiteBuddy</strong> — Eat Safe. Anywhere.
        &nbsp;·&nbsp; Powered by UMIP &nbsp;·&nbsp; PI 2024002131
        &nbsp;·&nbsp; © 2026 BiteBuddy Sdn Bhd
      </footer>
    </div>
  );
}
