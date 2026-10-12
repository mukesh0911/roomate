import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Users, Sparkles, Check, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  cityName?: string;
}

export default function CreateTeamModal({ isOpen, onClose, cityName = '' }: CreateTeamModalProps) {
  const [teamName, setTeamName] = useState('');
  const [preferredBhk, setPreferredBhk] = useState('2BHK');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success(`Team "${teamName || 'Room Hunters'}" created! You can now invite roommates.`);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-gray-100 relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF2EB] text-[#FF5A36] flex items-center justify-center shadow-2xs">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-[#1E2229]">Make a Team &amp; Find Flat</h3>
            <p className="text-xs text-gray-500">Rent a complete 2BHK/3BHK together {cityName ? `in ${cityName}` : ''}</p>
          </div>
        </div>

        <div className="bg-[#FFFBF7] border border-[#FFEDE2] rounded-2xl p-4 mb-5 space-y-2 text-xs text-slate-700">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-[#FF5A36] shrink-0 mt-0.5" />
            <p><strong className="text-[#1E2229]">Save 35% to 50%</strong> on total rent compared to renting an individual studio.</p>
          </div>
          <div className="flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p>Access premium gated society apartments that are only rented to full groups.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Team Name</label>
            <input
              type="text"
              placeholder={`e.g. ${cityName ? `${cityName} Tech Roommates` : 'Urban Room Hunters'}`}
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 rounded-xl text-xs sm:text-sm border border-gray-200 outline-none focus:border-[#FF5A36] focus:bg-white transition-all font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Target Accommodation</label>
            <div className="grid grid-cols-3 gap-2">
              {['2BHK', '3BHK', 'Independent Villa'].map(bhk => (
                <button
                  type="button"
                  key={bhk}
                  onClick={() => setPreferredBhk(bhk)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    preferredBhk === bhk
                      ? 'border-[#FF5A36] bg-[#FFF2EB] text-[#FF5A36]'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {bhk}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl bg-[#FF5A36] hover:bg-[#E54E2B] text-white font-bold text-xs sm:text-sm transition-all shadow-md shadow-[#FF5A36]/25 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Create Team &amp; Invite Seekers</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
