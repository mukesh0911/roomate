import { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  HelpCircle, ArrowLeft, Search, ChevronDown, ChevronUp,
  Mail, Send, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface FAQItem {
  category: string;
  question: string;
  answer: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    category: 'Verification',
    question: 'How long does document verification take?',
    answer: 'Identity and document submissions are reviewed by our safety verification team within 12–24 business hours. You will receive an in-app alert as soon as your trust status updates.',
  },
  {
    category: 'Verification',
    question: 'Are my uploaded government IDs visible to other users?',
    answer: 'Never. Your identity documents (Aadhaar, Passport, Driving License) are stored in secure, private encrypted storage accessible only by audited safety reviewers. Other users only see the official Verified Host badge.',
  },
  {
    category: 'Freshness',
    question: 'Why do listings expire after 30 days?',
    answer: 'To eliminate ghost listings and inactive rentals, every room listing expires after 30 days unless reconfirmed active by the host. Hosts receive a 1-tap renewal prompt to keep their room discoverable.',
  },
  {
    category: 'Deposits & Payments',
    question: 'Does NestMate collect rental deposits or booking fees?',
    answer: 'No. NestMate is 100% free with zero platform brokerage fees. Any landlord or roommate demanding visiting pass fees or advance deposit transfers before a physical walkthrough is violating our safety rules and should be reported immediately.',
  },
  {
    category: 'Contact Reveal',
    question: 'How do I get a roommate or host’s phone number?',
    answer: 'Phone numbers remain masked until you connect inside NestMate. Inside your active chat thread, either party can tap "Share Phone". Once both sides consent, verified phone numbers appear securely in the thread.',
  },
  {
    category: 'Safety & Reporting',
    question: 'What happens when I block another user?',
    answer: 'Blocking is immediate and bidirectional. The blocked party is sanitized from your discovery feeds, map view, and active messages. They will never be notified of the block.',
  },
  {
    category: 'Account',
    question: 'Can I both search for a room and list my current spare room?',
    answer: 'Yes! NestMate supports dual roles. You can switch between Seeker mode (finding roommates) and Host mode (managing listings) anytime using Account Settings.',
  },
];

export default function HelpSupport() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  // Contact Form
  const [topic, setTopic] = useState('verification');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [ticketSent, setTicketSent] = useState(false);

  useEffect(() => {
    document.title = 'Help & Support | NestMate';
  }, []);

  const filteredFAQs = useMemo(() => {
    if (!searchQuery.trim()) return FAQ_DATA;
    const q = searchQuery.toLowerCase();
    return FAQ_DATA.filter(
      item => item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error('Please describe your question or issue');
      return;
    }
    setSending(true);
    try {
      await addDoc(collection(db, 'supportTickets'), {
        userId: profile?.uid || 'anonymous',
        userEmail: profile?.email || null,
        userPhone: profile?.phone || null,
        userName: profile?.name || 'Anonymous User',
        topic,
        message: message.trim(),
        status: 'open',
        createdAt: serverTimestamp(),
      });
      setTicketSent(true);
      toast.success('Support ticket submitted! Our team will respond shortly.');
    } catch (err) {
      console.error('Failed to submit support ticket:', err);
      toast.error('Could not submit ticket right now. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFC] pb-24 font-sans">
      {/* Top Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 py-4 px-4 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/explore?tab=rooms');
              }
            }}
            className="flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-[#1E2229] bg-white px-3.5 py-1.5 rounded-full border border-gray-200 shadow-2xs transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#FFF2EB] text-[#FF5A36] flex items-center justify-center">
              <HelpCircle className="w-3.5 h-3.5" />
            </div>
            <h1 className="font-serif font-medium text-sm text-[#1E2229]">Help &amp; Support</h1>
          </div>
          <Link to="/safety" className="text-xs font-semibold text-red-600 hover:underline">
            Safety Center
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-8 space-y-6">

        <div>
          <h2 className="font-serif font-medium text-3xl text-[#1E2229]">Frequently Asked Questions</h2>
          <p className="text-xs text-gray-500 mt-1">Instant answers regarding verification, deposits, safety, and mutual contact reveal.</p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search FAQs (verification, deposits, freshness, safety...)"
            className="w-full bg-white border border-gray-200 rounded-full pl-11 pr-5 py-3 text-xs sm:text-sm text-[#1E2229] placeholder:text-gray-400 focus:outline-none focus:border-[#FF5A36] shadow-2xs font-medium"
          />
        </div>

        {/* Emergency Assistance Banner */}
        <div className="bg-red-50 border border-red-200/80 rounded-3xl p-5 flex items-start gap-4 shadow-2xs">
          <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center shrink-0 text-red-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="text-xs text-red-900 leading-relaxed">
            <strong className="block font-serif font-medium text-sm text-red-950 mb-0.5">Emergency Assistance Notice</strong>
            NestMate cannot handle live physical emergency response. If you are in immediate danger, please dial <strong>112</strong> immediately or visit our <Link to="/safety" className="underline font-bold text-red-800">Safety Center</Link>.
          </div>
        </div>

        {/* FAQ Accordion Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-xs space-y-4">
          {filteredFAQs.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">No questions found matching "{searchQuery}".</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredFAQs.map((item, idx) => {
                const isOpen = openIndex === idx;
                return (
                  <div key={idx} className="py-3.5 first:pt-0 last:pb-0">
                    <button
                      onClick={() => setOpenIndex(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between text-left group cursor-pointer"
                    >
                      <span className="text-sm font-semibold text-[#1E2229] group-hover:text-[#FF5A36] transition-colors pr-2">
                        {item.question}
                      </span>
                      <div className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center shrink-0 text-gray-500 group-hover:text-[#FF5A36]">
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </button>
                    {isOpen && (
                      <p className="text-xs text-gray-600 leading-relaxed pt-2.5 pb-1 font-sans">
                        {item.answer}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Contact Support Form */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-xs space-y-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-2xl bg-[#FFF2EB] text-[#FF5A36] flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif font-medium text-xl text-[#1E2229]">
                Contact NestMate Operations
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Have a question not listed above? Send a message directly to our human support team.
              </p>
            </div>
          </div>

          {ticketSent ? (
            <div className="p-8 bg-emerald-50 border border-emerald-200 rounded-3xl text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-serif font-medium text-lg text-emerald-950">Inquiry Received</h3>
              <p className="text-xs text-emerald-800 leading-relaxed max-w-sm mx-auto">
                Our support desk will respond to your registered profile ({profile?.phone || profile?.email || 'account inbox'}) within 24 hours.
              </p>
              <button
                type="button"
                onClick={() => { setTicketSent(false); setMessage(''); }}
                className="text-xs font-semibold text-[#FF5A36] hover:underline pt-2 block mx-auto cursor-pointer"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmitTicket} className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-[#1E2229] uppercase tracking-wider block mb-2">Category Topic</label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs sm:text-sm font-medium text-[#1E2229] focus:outline-none focus:border-[#FF5A36]"
                >
                  <option value="verification">Verification & Documents</option>
                  <option value="listing">Listing & Freshness Issue</option>
                  <option value="safety">Safety / Suspected Scam</option>
                  <option value="account">Account & Privacy Settings</option>
                  <option value="other">General Support & Feedback</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#1E2229] uppercase tracking-wider block mb-2">Detailed Message</label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your inquiry or issue with as much context as possible..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-xs sm:text-sm text-[#1E2229] placeholder:text-gray-400 focus:outline-none focus:border-[#FF5A36] leading-relaxed resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full py-3.5 bg-[#FF5A36] hover:bg-[#E54E2B] text-white rounded-full font-semibold text-xs shadow-sm shadow-[#FF5A36]/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all cursor-pointer active:scale-[0.98]"
              >
                {sending ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Support Request</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
