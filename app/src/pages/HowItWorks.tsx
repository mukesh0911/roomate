import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, MessageCircle, Home, Shield, Star } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function HowItWorks() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    document.title = 'How It Works | NestMate';
  }, []);

  const steps = [
    {
      num: '01',
      title: 'Sign Up & Set Your Preferences',
      desc: 'Create one NestMate account, then tell us what matters to you. Browse rooms, find compatible roommates, and post a room when you need to.',
      points: ['Secure sign-in', 'Personalized discovery', 'Post a room from the same account'],
      icon: Users,
      image: 'signup',
    },
    {
      num: '02',
      title: 'Build Your Profile',
      desc: 'Answer 10 lifestyle questions that power our compatibility engine. The more honest you are, the better your matches.',
      points: ['10-question lifestyle quiz', 'Photo and basic info', 'Budget and location preferences'],
      icon: Search,
      image: 'profile',
    },
    {
      num: '03',
      title: 'Get Matched',
      desc: 'Our algorithm compares your lifestyle answers with everyone in your city to find the most compatible roommates.',
      points: ['Compatibility scores for every match', 'Filtered by budget and location', 'Verified profiles ranked higher'],
      icon: MessageCircle,
      image: 'matches',
    },
    {
      num: '04',
      title: 'Move In Together',
      desc: 'Chat safely in-app, share phone numbers only with mutual consent, then arrange your visit.',
      points: ['In-app chat (phone hidden)', 'Mutual phone-share when both agree'],
      icon: Home,
      image: 'movein',
    },
  ];

  return (
    <div className="min-h-screen bg-parchment page-transition">
      {/* Header */}
      <div className="gradient-dark py-20 px-4 text-center">
        <h1 className="text-4xl sm:text-5xl font-display italic text-white mb-4">How It Works</h1>
        <p className="text-white/60 max-w-lg mx-auto">From signup to move-in, find your perfect roommate in 4 simple steps</p>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <div className="space-y-20">
          {steps.map((step, i) => (
            <div key={i} className={`flex flex-col ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} gap-10 items-center`}>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-6xl font-display italic font-bold text-fire/10">{step.num}</span>
                </div>
                <div className="w-12 h-12 bg-fire/10 rounded-2xl flex items-center justify-center mb-4">
                  <step.icon className="w-6 h-6 text-fire" />
                </div>
                <h2 className="type-h2 mb-3">{step.title}</h2>
                <p className="text-ink/60 mb-5 leading-relaxed">{step.desc}</p>
                <ul className="space-y-2">
                  {step.points.map(p => (
                    <li key={p} className="flex items-center gap-2 text-sm text-ink/70">
                      <Star className="w-4 h-4 text-gold fill-gold" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex-1">
                <div className="card-nestmate p-8 flex items-center justify-center min-h-[280px] gradient-mesh-fire">
                  <step.icon className="w-24 h-24 text-fire/20" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust Section */}
        <div className="mt-20 card-nestmate p-8 text-center">
          <div className="w-14 h-14 bg-teal/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7 text-teal" />
          </div>
          <h2 className="type-h2 mb-3">Your Safety is Our Priority</h2>
          <p className="text-ink/60 max-w-md mx-auto mb-6">
            Every profile goes through verification. Phone numbers stay private until both parties agree to share. 
            Report any concerns and our team will respond within 24 hours.
          </p>
          <button
            type="button"
            onClick={() => navigate(user ? '/explore?tab=rooms' : '/login')}
            className="btn-fire cursor-pointer"
          >
            {user ? 'Explore Roommates & Rooms' : 'Get Started'}
          </button>
        </div>
      </div>
    </div>
  );
}
