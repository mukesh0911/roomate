import React from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, MessageCircle, ShieldCheck, Clock, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import FlatmateAvatar from './FlatmateAvatar';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { useStore } from '@/store/useStore';
import type { UserProfile } from '@/hooks/useAuth';
import { formatWhatsAppDeepLink, getConnectedUserWhatsApp } from '@/hooks/useConnections';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
}

export default function ContactModal({ isOpen, onClose, profile }: ContactModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getOrCreateChatRoom } = useChat();
  const [copied, setCopied] = React.useState(false);
  const [resolvedWhatsApp, setResolvedWhatsApp] = React.useState<string | null>(null);
  const [isStartingChat, setIsStartingChat] = React.useState(false);

  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  React.useEffect(() => {
    let isMounted = true;
    if (isOpen && profile?.uid) {
      if (profile.whatsappNumber) {
        setResolvedWhatsApp(profile.whatsappNumber);
      } else {
        getConnectedUserWhatsApp(profile.uid).then(num => {
          if (isMounted) setResolvedWhatsApp(num);
        });
      }
    } else {
      setResolvedWhatsApp(null);
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, profile?.uid, profile?.whatsappNumber]);

  if (!isOpen || !profile) return null;

  const hasPhone = Boolean(profile.phone && profile.phone.trim());
  const phoneNumber = profile.phone || '';
  const effectiveWhatsApp = resolvedWhatsApp || profile.whatsappNumber || '';
  const hasWhatsApp = Boolean(effectiveWhatsApp && effectiveWhatsApp.trim());
  const whatsappNumber = effectiveWhatsApp;

  const handleCopy = () => {
    const textToCopy = phoneNumber || whatsappNumber;
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success('Contact copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMessageChat = async () => {
    if (!user?.uid) {
      onClose();
      useStore.getState().openAuthModal({
        title: 'Sign in to Chat',
        subtitle: 'Start a direct chat with this verified host.',
        redirect: `/chat`,
      });
      return;
    }
    if (!profile.uid || isStartingChat) return;
    setIsStartingChat(true);
    try {
      const roomId = await getOrCreateChatRoom(user.uid, profile.uid);
      onClose();
      navigate(`/chat/${roomId}`);
    } catch (err) {
      console.error('Failed to start chat:', err);
      toast.error('Could not start chat. Please try again.');
    } finally {
      setIsStartingChat(false);
    }
  };

  const displayLocation = profile.locality && profile.city
    ? `${profile.locality}, ${profile.city}`
    : profile.locality || profile.city || 'Location not specified';

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 relative"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-modal-title"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0">
            <FlatmateAvatar
              avatar={profile.avatar}
              name={profile.name}
              gender={profile.gender}
              isVerified={profile.isVerified}
              className="w-full h-full"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 id="contact-modal-title" className="font-bold text-lg text-[#1E2229] truncate">{profile.name}</h3>
              {profile.isVerified && (
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              )}
            </div>
            <p className="text-xs text-gray-500 truncate">{displayLocation}</p>
            <p className="text-xs font-bold text-[#FF5A36] mt-0.5">
              {profile.budget ? `₹ ${profile.budget.toLocaleString('en-IN')} / month` : 'Flexible budget'}
            </p>
          </div>
        </div>

        <div className="space-y-3 bg-[#FFFBF7] border border-[#FFEDE2] rounded-2xl p-4 mb-5 text-xs text-slate-700">
          {hasPhone && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Phone Number</span>
              <span className="font-bold text-[#1E2229] text-sm tracking-wide">
                {phoneNumber}
              </span>
            </div>
          )}
          {hasWhatsApp && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 flex items-center gap-1.5 font-medium">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp
              </span>
              <span className="font-bold text-emerald-800 text-sm tracking-wide">
                {whatsappNumber}
              </span>
            </div>
          )}
          {!hasPhone && !hasWhatsApp && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Contact Details</span>
              <span className="font-semibold text-stone-600 text-xs">
                Shared on connection
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 text-emerald-700 font-semibold pt-1 border-t border-[#FFEDE2]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Community Verified on NestMate</span>
          </div>
          <div className="flex items-center gap-2 text-gray-500">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span>{(hasPhone || hasWhatsApp) ? 'Best time to reach out: 6:00 PM – 9:30 PM' : 'Connect via in-app chat to exchange details'}</span>
          </div>
        </div>

        <div className="space-y-2.5">
          {hasWhatsApp && (
            <a
              href={formatWhatsAppDeepLink(whatsappNumber, `Hi ${profile.name}, connecting via NestMate!`)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Message on WhatsApp</span>
            </a>
          )}

          {hasPhone && (
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-xs transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Phone Number Copied' : 'Copy Phone Number'}</span>
            </button>
          )}

          <button
            onClick={handleMessageChat}
            disabled={isStartingChat}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#FF5A36] hover:bg-[#E54E2B] text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs disabled:opacity-70"
          >
            {isStartingChat ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <MessageCircle className="w-4 h-4 text-white" />
            )}
            <span>Chat on NestMate</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
