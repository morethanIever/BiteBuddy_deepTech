import { Link } from 'react-router-dom';

const TRAVELER_PLANS = [
  {
    tier: 'Traveler',
    price: 'Free',
    period: 'forever',
    desc: 'For tourists and visitors exploring Malaysia',
    features: [
      'View safe restaurant map',
      'Scan QR codes to verify restaurants',
      'Search by cuisine type & area',
      'Mobile-friendly interface',
    ],
    cta: 'Get Started Free',
    ctaLink: '/map',
    featured: false,
  },
  {
    tier: 'Explorer',
    price: 'RM 29',
    period: 'per month',
    desc: 'For frequent travelers and expats living in SE Asia',
    features: [
      'Everything in Traveler',
      'Real-time push alerts for your followed areas',
      'Filter by safety score & cuisine',
      'Restaurant scan history (30 days)',
      'Priority support',
    ],
    cta: 'Start Free Trial',
    ctaLink: '/apply',
    featured: true,
  },
];

const RESTAURANT_PLANS = [
  {
    tier: 'Basic',
    price: 'RM 299',
    period: 'per month',
    badge: null,
    tagline: 'Get certified and build customer trust',
    desc: 'Everything a single restaurant needs to get started with food safety certification — device, consumables, and a public-facing certificate included.',
    features: [
      'BiteBuddy biosensor device',
      'Monthly test strip refills',
      'QR safety certificate',
      'Public map listing',
    ],
    cta: 'Apply for Basic',
    ctaLink: '/apply',
    featured: false,
  },
  {
    tier: 'Premium',
    price: 'RM 549',
    period: 'per month',
    badge: '⭐ Most Popular',
    tagline: 'Stand out and grow with verified safety',
    desc: 'Everything in Basic, plus premium visibility, business tools, and dedicated support — built for restaurants that want to turn food safety into a competitive advantage.',
    features: [
      'Everything in Basic',
      'Top placement on the Safe Map',
      'Admin dashboard access',
      'B2B partnership badge',
      'Monthly safety report',
      'Dedicated support',
    ],
    cta: 'Apply for Premium',
    ctaLink: '/apply',
    featured: true,
  },
];

function PlanCard({ plan }) {
  return (
    <div className={`card p-8 relative ${plan.featured ? 'border-2 border-green shadow-lg' : ''}`}>
      {plan.featured && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-green text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
          {plan.badge || '⭐ Most Popular'}
        </div>
      )}
      <div className="text-xs font-bold text-green uppercase tracking-widest mb-2">{plan.tier}</div>
      <div className="font-head text-4xl font-extrabold text-navy mb-0.5">{plan.price}</div>
      <div className="text-sm text-gray-400 mb-2">{plan.period}</div>
      {plan.tagline && (
        <div className="text-sm font-semibold text-navy mb-1">{plan.tagline}</div>
      )}
      <div className="text-sm text-gray-400 leading-relaxed mb-6">{plan.desc}</div>
      <ul className="flex flex-col gap-2.5 mb-8">
        {plan.features.map(f => (
          <li key={f} className="flex items-start gap-2 text-sm text-navy">
            <span className="text-green font-bold mt-0.5 flex-shrink-0">✓</span>
            {f}
          </li>
        ))}
      </ul>
      <Link
        to={plan.ctaLink}
        className={`block text-center py-3 rounded-lg font-semibold text-sm transition no-underline ${
          plan.featured
            ? 'bg-green text-white hover:bg-green-dark'
            : 'border border-gray-300 text-navy hover:border-green hover:text-green'
        }`}
      >
        {plan.cta} →
      </Link>
    </div>
  );
}

export default function Pricing() {
  return (
    <div className="pt-16 min-h-screen">
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="section-title">Simple, transparent pricing</h1>
          <p className="text-gray-400 max-w-md mx-auto">Whether you're a traveler or a restaurant owner — we have a plan that fits.</p>
        </div>

        {/* Traveler Plans */}
        <div className="mb-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">For Travelers</h2>
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {TRAVELER_PLANS.map(plan => (
              <PlanCard key={plan.tier} plan={plan} />
            ))}
          </div>
        </div>

        {/* Restaurant Plans */}
        <div className="mb-12">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">For Restaurants</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {RESTAURANT_PLANS.map(plan => (
              <PlanCard key={plan.tier} plan={plan} />
            ))}
          </div>
        </div>

        {/* Enterprise */}
        <div className="bg-navy rounded-2xl p-8 grid md:grid-cols-[1fr_auto] gap-6 items-center">
          <div>
            <div className="font-head text-2xl font-extrabold text-white mb-2">Tourism Board & Enterprise</div>
            <div className="text-white/60 text-sm leading-relaxed">
              Partner with BiteBuddy to improve food safety across your region. Custom integrations, anonymized data insights for public health, co-branding, and bulk restaurant certification programs.
            </div>
          </div>
          <Link to="/apply" className="btn-primary whitespace-nowrap no-underline px-8 py-3">
            Contact Sales →
          </Link>
        </div>
      </section>

      <footer className="bg-navy text-white/50 text-center py-8 text-sm">
        <strong className="text-white">BiteBuddy</strong> — Eat Safe. Anywhere. · © 2026 BiteBuddy Sdn Bhd
      </footer>
    </div>
  );
}
