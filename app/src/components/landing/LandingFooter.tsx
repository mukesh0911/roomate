import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface LandingFooterProps {
  onListSpace: () => void;
}

export default function LandingFooter({ onListSpace }: LandingFooterProps) {
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setOpenSection((prev) => (prev === section ? null : section));
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-white border-t border-border/60 pt-10 sm:pt-20 pb-10 px-4 sm:px-6 lg:px-8 text-left">
      <div className="max-w-[1280px] mx-auto">
        {/* ─── MOBILE ACCORDION FOOTER (< md): Matches Reference Mockup ─── */}
        <div className="md:hidden flex flex-col pb-8 border-b border-gray-100">
          {/* Brand Info */}
          <Link to="/" className="inline-flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-xl bg-[#FF5A36] flex items-center justify-center text-white shadow-xs">
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 10.5L12 3l9 7.5" />
                <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
                <path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight text-[#1E2229]">NestMate</span>
          </Link>

          <p className="text-xs font-semibold text-[#1E2229] mb-1">
            People. Places. Possibilities.
          </p>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed max-w-xs">
            A safer, smarter way to find your next home and connect with verified roommates across India.
          </p>

          {/* Social Icons */}
          <div className="flex items-center gap-2.5 mb-6">
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noreferrer"
              aria-label="NestMate on X"
              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-slate-600 hover:text-black hover:border-black transition-colors"
            >
              <span className="text-xs font-bold">𝕏</span>
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
              aria-label="NestMate on Instagram"
              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-slate-600 hover:text-[#FF5A36] transition-colors"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noreferrer"
              aria-label="NestMate on LinkedIn"
              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-slate-600 hover:text-blue-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zm.02 4.5h-5v16h5v-16zm7.982 0h-4.968v16h4.969v-8.399c0-4.67 6.029-5.052 6.029 0v8.399h4.988v-10.131c0-7.88-8.922-7.593-11.018-3.714v-2.155z"/></svg>
            </a>
            <a
              href="https://youtube.com"
              target="_blank"
              rel="noreferrer"
              aria-label="NestMate on YouTube"
              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-slate-600 hover:text-red-600 transition-colors"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            </a>
          </div>

          {/* Collapsible Accordion Sections */}
          <div className="divide-y divide-gray-100 border-t border-gray-100">
            {/* Product Section */}
            <div>
              <button
                type="button"
                onClick={() => toggleSection('product')}
                className="w-full py-3.5 flex items-center justify-between text-[13px] font-bold text-[#1E2229] cursor-pointer"
              >
                <span>Product</span>
                <span className="text-gray-400 text-sm font-light">
                  {openSection === 'product' ? '−' : '+'}
                </span>
              </button>
              {openSection === 'product' && (
                <ul className="space-y-2.5 pb-3 text-xs text-slate-500 pl-1 font-medium">
                  <li>
                    <Link to="/explore?tab=rooms" className="hover:text-[#FF5A36] py-0.5 inline-block">Find a Room</Link>
                  </li>
                  <li>
                    <Link to="/explore?tab=roommates" className="hover:text-[#FF5A36] py-0.5 inline-block">Find Roommates</Link>
                  </li>
                  <li>
                    <button type="button" onClick={onListSpace} className="hover:text-[#FF5A36] cursor-pointer text-left py-0.5 inline-block">
                      List Your Space
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => scrollToSection('how-it-works')} className="hover:text-[#FF5A36] cursor-pointer text-left py-0.5 inline-block">
                      How It Works
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => scrollToSection('trust')} className="hover:text-[#FF5A36] cursor-pointer text-left py-0.5 inline-block">Safety</button>
                  </li>
                </ul>
              )}
            </div>

            {/* Company Section */}
            <div>
              <button
                type="button"
                onClick={() => toggleSection('company')}
                className="w-full py-3.5 flex items-center justify-between text-[13px] font-bold text-[#1E2229] cursor-pointer"
              >
                <span>Company</span>
                <span className="text-gray-400 text-sm font-light">
                  {openSection === 'company' ? '−' : '+'}
                </span>
              </button>
              {openSection === 'company' && (
                <ul className="space-y-2.5 pb-3 text-xs text-slate-500 pl-1 font-medium">
                  <li><Link to="/about" className="hover:text-[#FF5A36] py-0.5 inline-block">About Us</Link></li>
                  <li><Link to="/about" className="hover:text-[#FF5A36] py-0.5 inline-block">Careers</Link></li>
                  <li><Link to="/about" className="hover:text-[#FF5A36] py-0.5 inline-block">Blog</Link></li>
                  <li><Link to="/about" className="hover:text-[#FF5A36] py-0.5 inline-block">Press</Link></li>
                  <li><Link to="/help" className="hover:text-[#FF5A36] py-0.5 inline-block">Contact</Link></li>
                </ul>
              )}
            </div>

            {/* Resources Section */}
            <div>
              <button
                type="button"
                onClick={() => toggleSection('resources')}
                className="w-full py-3.5 flex items-center justify-between text-[13px] font-bold text-[#1E2229] cursor-pointer"
              >
                <span>Resources</span>
                <span className="text-gray-400 text-sm font-light">
                  {openSection === 'resources' ? '−' : '+'}
                </span>
              </button>
              {openSection === 'resources' && (
                <ul className="space-y-2.5 pb-3 text-xs text-slate-500 pl-1 font-medium">
                  <li><Link to="/help" className="hover:text-[#FF5A36] py-0.5 inline-block">Help Center</Link></li>
                  <li><button type="button" onClick={() => scrollToSection('trust')} className="hover:text-[#FF5A36] cursor-pointer text-left py-0.5 inline-block">Community Guidelines</button></li>
                  <li><button type="button" onClick={() => scrollToSection('trust')} className="hover:text-[#FF5A36] cursor-pointer text-left py-0.5 inline-block">Safety Tips</button></li>
                  <li><button type="button" onClick={() => scrollToSection('faq')} className="hover:text-[#FF5A36] cursor-pointer text-left py-0.5 inline-block">Living Guide & FAQ</button></li>
                  <li><Link to="/explore" className="hover:text-[#FF5A36] py-0.5 inline-block">Sitemap</Link></li>
                </ul>
              )}
            </div>

            {/* Stay in the loop Section */}
            <div>
              <button
                type="button"
                onClick={() => toggleSection('loop')}
                className="w-full py-3.5 flex items-center justify-between text-[13px] font-bold text-[#1E2229] cursor-pointer"
              >
                <span>Stay in the loop</span>
                <span className="text-gray-400 text-sm font-light">
                  {openSection === 'loop' ? '−' : '+'}
                </span>
              </button>
              {openSection === 'loop' && (
                <div className="pb-4 pt-1">
                  <p className="text-xs text-slate-500 mb-2.5 leading-relaxed">
                    Get tips, new listings and community stories.
                  </p>
                  <div className="relative">
                    <input
                      type="email"
                      disabled aria-label="Newsletter unavailable"
                      
                      placeholder="Newsletter unavailable"
                      className="w-full bg-[#F5F2EC] rounded-xl pl-3 pr-10 py-2.5 text-[13px] sm:text-xs text-[#1E2229] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#FF5A36] min-h-[42px]"
                    />
                    <button
                      type="submit"
                      aria-label="Newsletter unavailable" disabled
                      className="absolute right-1 top-1 bottom-1 w-8 rounded-lg bg-[#1E2229] text-white flex items-center justify-center cursor-pointer"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── DESKTOP FOOTER (>= md): Original 5-Column Layout Untouched ─── */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8 pb-16 border-b border-border/50">
          {/* Col 1: Brand & Tagline (4 cols) */}
          <div className="lg:col-span-4">
            <Link to="/" className="inline-flex items-center gap-2.5 mb-4 group">
              <div className="w-8 h-8 rounded-xl bg-[#FF5A36] flex items-center justify-center text-white shadow-xs">
                <svg
                  viewBox="0 0 24 24"
                  className="w-4.5 h-4.5 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 10.5L12 3l9 7.5" />
                  <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
                  <path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6" />
                </svg>
              </div>
              <span className="text-xl font-bold tracking-tight text-[#1E2229]">NestMate</span>
            </Link>

            <p className="text-xs sm:text-sm font-semibold text-[#1E2229] mb-1">
              People. Places. Possibilities.
            </p>
            <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
              A safer, smarter way to find your next home and connect with verified roommates across
              India.
            </p>

            {/* Social Icons */}
            <div className="flex items-center gap-3">
              {/* X / Twitter */}
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
                aria-label="NestMate on X"
                className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-slate-600 hover:text-black hover:border-black transition-colors"
              >
                <span className="text-xs font-bold">𝕏</span>
              </a>

              {/* Instagram */}
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                aria-label="NestMate on Instagram"
                className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-slate-600 hover:text-[#FF5A36] hover:border-[#FF5A36] transition-colors"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </a>

              {/* LinkedIn */}
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noreferrer"
                aria-label="NestMate on LinkedIn"
                className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-slate-600 hover:text-blue-700 hover:border-blue-700 transition-colors"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zm.02 4.5h-5v16h5v-16zm7.982 0h-4.968v16h4.969v-8.399c0-4.67 6.029-5.052 6.029 0v8.399h4.988v-10.131c0-7.88-8.922-7.593-11.018-3.714v-2.155z"/></svg>
              </a>

              {/* YouTube */}
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noreferrer"
                aria-label="NestMate on YouTube"
                className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-slate-600 hover:text-red-600 hover:border-red-600 transition-colors"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              </a>
            </div>
          </div>

          {/* Col 2: Product (2 cols) */}
          <div className="lg:col-span-2">
            <h4 className="text-xs font-bold tracking-wider uppercase text-[#1E2229] mb-4">
              Product
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-500 font-medium">
              <li>
                <Link to="/explore?tab=rooms" className="hover:text-[#FF5A36] transition-colors">
                  Find a Room
                </Link>
              </li>
              <li>
                <Link to="/explore?tab=roommates" className="hover:text-[#FF5A36] transition-colors">
                  Find Roommates
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onListSpace}
                  className="hover:text-[#FF5A36] transition-colors cursor-pointer text-left"
                >
                  List Your Space
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection('how-it-works')}
                  className="hover:text-[#FF5A36] transition-colors cursor-pointer text-left"
                >
                  How It Works
                </button>
              </li>
              <li>
                <Link to="/safety" className="hover:text-[#FF5A36] transition-colors">
                  Safety
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Company (2 cols) */}
          <div className="lg:col-span-2">
            <h4 className="text-xs font-bold tracking-wider uppercase text-[#1E2229] mb-4">
              Company
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-500 font-medium">
              <li>
                <Link to="/about" className="hover:text-[#FF5A36] transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-[#FF5A36] transition-colors">
                  Careers
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-[#FF5A36] transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-[#FF5A36] transition-colors">
                  Press
                </Link>
              </li>
              <li>
                <Link to="/help" className="hover:text-[#FF5A36] transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Resources (2 cols) */}
          <div className="lg:col-span-2">
            <h4 className="text-xs font-bold tracking-wider uppercase text-[#1E2229] mb-4">
              Resources
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-500 font-medium">
              <li>
                <Link to="/help" className="hover:text-[#FF5A36] transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link to="/trust" className="hover:text-[#FF5A36] transition-colors">
                  Community Guidelines
                </Link>
              </li>
              <li>
                <Link to="/safety" className="hover:text-[#FF5A36] transition-colors">
                  Safety Tips
                </Link>
              </li>
              <li>
                <Link to="/how-it-works" className="hover:text-[#FF5A36] transition-colors">
                  Living Guide
                </Link>
              </li>
              <li>
                <Link to="/explore" className="hover:text-[#FF5A36] transition-colors">
                  Sitemap
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 5: Stay in the loop (2 cols) */}
          <div className="lg:col-span-2">
            <h4 className="text-xs font-bold tracking-wider uppercase text-[#1E2229] mb-4">
              Stay in the loop
            </h4>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Get tips, new listings and community stories.
            </p>

            <div className="relative">
              <input
                type="email"
                disabled aria-label="Newsletter unavailable"
                
                placeholder="Newsletter unavailable"
                className="w-full bg-[#F5F2EC] rounded-xl pl-3 pr-10 py-2.5 text-xs text-[#1E2229] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#FF5A36]"
              />
              <button
                type="submit"
                aria-label="Newsletter unavailable" disabled
                className="absolute right-1 top-1 bottom-1 w-8 rounded-lg bg-[#1E2229] hover:bg-black text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 font-medium">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <span>© 2026 NestMate. All rights reserved.</span>
            <Link to="/privacy" className="hover:text-slate-600 transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-slate-600 transition-colors">
              Terms of Service
            </Link>
            <Link to="/privacy" className="hover:text-slate-600 transition-colors">
              Cookies
            </Link>
          </div>

          <div className="flex items-center gap-1 text-slate-500">
            <span>Made with</span>
            <span className="text-red-500">❤️</span>
            <span>for a brighter world</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
