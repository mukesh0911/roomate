import { useEffect } from 'react';
import { X, ThumbsUp, ThumbsDown } from 'lucide-react';
import { CURATED_SCREENING_QUESTIONS } from '@/lib/screeningQuestions';

interface ApplicantScreeningAnswersModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicantName: string;
  applicantAvatar?: string;
  screeningAnswers?: Record<string, any>;
  onAccept?: () => void;
}

export default function ApplicantScreeningAnswersModal({
  isOpen,
  onClose,
  applicantName,
  applicantAvatar,
  screeningAnswers,
  onAccept,
}: ApplicantScreeningAnswersModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const answersEntries = Object.entries(screeningAnswers || {});

  // Find question definition from curated list or fallback
  const formatAnswer = (qId: string, val: any) => {
    const qDef = CURATED_SCREENING_QUESTIONS.find(q => q.id === qId);
    const title = qDef?.title || qId.replace(/^sq_/, '').replace(/_/g, ' ');

    let formattedVal = String(val);
    if (typeof val === 'boolean') {
      formattedVal = val ? 'Yes' : 'No';
    } else if (Array.isArray(val)) {
      formattedVal = val.join(', ');
    } else if (qDef?.type === 'BUDGET' || (typeof val === 'number' && val > 1000)) {
      formattedVal = `₹${Number(val).toLocaleString()} / month`;
    } else if (qDef?.type === 'PREFERENCE_SCALE') {
      formattedVal = `${val} / 10`;
    } else if (qDef?.type === 'NUMBER' && qDef.unit) {
      formattedVal = `${val} ${qDef.unit}`;
    }

    return {
      title,
      category: qDef?.category || 'General',
      type: qDef?.type || 'TEXT',
      rawVal: val,
      displayVal: formattedVal,
    };
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-[#FBFBFC]">
          <div className="flex items-center gap-3">
            {applicantAvatar ? (
              <img
                src={applicantAvatar}
                alt={applicantName}
                className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-xs"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-orange-100 text-[#FF5A36] flex items-center justify-center font-bold text-lg">
                {applicantName.charAt(0)}
              </div>
            )}
            <div>
              <h3 className="font-serif text-lg font-bold text-[#1E2229]">{applicantName}</h3>
              <p className="text-xs text-slate-500 font-medium">Screening Questionnaire Responses</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {answersEntries.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No specific questionnaire answers attached for this inquiry.
            </div>
          ) : (
            answersEntries.map(([qId, val]) => {
              const item = formatAnswer(qId, val);
              return (
                <div key={qId} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                      {item.category}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-800 leading-snug">{item.title}</h4>
                  <div className="pt-1">
                    {typeof item.rawVal === 'boolean' ? (
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          item.rawVal ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {item.rawVal ? <ThumbsUp className="w-3.5 h-3.5" /> : <ThumbsDown className="w-3.5 h-3.5" />}
                        {item.displayVal}
                      </span>
                    ) : (
                      <p className="text-sm font-bold text-[#1E2229] bg-white p-2.5 rounded-xl border border-slate-200/80">
                        {item.displayVal}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-white transition-all"
          >
            Close
          </button>
          {onAccept && (
            <button
              onClick={() => {
                onAccept();
                onClose();
              }}
              className="px-5 py-2 rounded-full bg-[#FF5A36] hover:bg-[#E54E2B] text-white text-xs font-semibold shadow-xs transition-all"
            >
              Accept Applicant
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
