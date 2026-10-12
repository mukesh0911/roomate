import { useState, useId, useEffect } from 'react';
import {
  type ScreeningQuestion,
  type ScreeningAnswer,
  validateScreeningAnswer,
} from '@/lib/screeningQuestions';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCircle2,
  Clock,
  Calendar,
  IndianRupee,
  Sparkles,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';

interface ScreeningQuestionnaireModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: ScreeningQuestion[];
  listingTitle?: string;
  ownerName?: string;
  onSubmit: (answers: Record<string, any>) => Promise<void>;
}

export default function ScreeningQuestionnaireModal({
  isOpen,
  onClose,
  questions,
  listingTitle,
  ownerName,
  onSubmit,
}: ScreeningQuestionnaireModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const baseId = useId();

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || questions.length === 0) return null;

  const currentQ = questions[currentIndex];
  const total = questions.length;
  const progressPct = Math.round(((currentIndex + 1) / total) * 100);
  const currentValue = answers[currentQ.id];

  const handleValueChange = (val: any) => {
    setError(null);
    setAnswers(prev => ({ ...prev, [currentQ.id]: val }));
  };

  const handleNext = async () => {
    const valResult = validateScreeningAnswer(currentQ, currentValue);
    if (!valResult.valid) {
      setError(valResult.error || 'Please provide an answer before continuing.');
      return;
    }

    if (currentIndex < total - 1) {
      setCurrentIndex(prev => prev + 1);
      setError(null);
    } else {
      // Final submission
      setIsSubmitting(true);
      setError(null);
      try {
        await onSubmit(answers);
        setCompleted(true);
        setTimeout(() => {
          onClose();
          setCompleted(false);
          setCurrentIndex(0);
          setAnswers({});
        }, 1200);
      } catch (err: any) {
        setError(err?.message || 'Failed to submit responses. Please retry.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setError(null);
      setCurrentIndex(prev => prev - 1);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={e => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] transition-all transform animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="screening-title"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-[#FBFBFC]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-orange-100 text-[#FF5A36] px-2.5 py-0.5 rounded-full">
                Question {currentIndex + 1} of {total}
              </span>
              {currentQ.category && (
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {currentQ.category}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium truncate max-w-xs sm:max-w-md">
              Applying to: <strong className="text-slate-800">{listingTitle || 'Listing'}</strong>
              {ownerName ? ` · Owner: ${ownerName}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-slate-100 relative">
          <div
            className="h-full bg-gradient-to-r from-orange-400 to-[#FF5A36] transition-all duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Main Body / Question Widget */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col justify-between">
          {completed ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 font-serif">Answers Submitted!</h3>
              <p className="text-sm text-slate-600 mt-1 max-w-xs">
                Your screening responses and interest have been sent to the property owner.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Question Title & Description */}
              <div>
                <h3
                  id="screening-title"
                  className="text-lg sm:text-xl font-bold text-[#1E2229] leading-snug font-serif"
                >
                  {currentQ.title}
                  {currentQ.required && (
                    <span className="text-red-500 ml-1 font-sans text-sm">*</span>
                  )}
                </h3>
                {currentQ.description && (
                  <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                    {currentQ.description}
                  </p>
                )}
              </div>

              {/* Bespoke Input Widget by Question Type */}
              <div className="pt-2">
                {/* 1. YES / NO WIDGET */}
                {currentQ.type === 'YES_NO' && (
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => handleValueChange(true)}
                      className={`p-5 rounded-2xl border-2 flex flex-col items-center justify-center gap-2.5 transition-all text-center ${
                        currentValue === true
                          ? 'border-[#FF5A36] bg-orange-50/60 text-[#FF5A36] shadow-sm font-bold scale-[1.01]'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white font-medium'
                      }`}
                    >
                      <ThumbsUp className={`w-6 h-6 ${currentValue === true ? 'text-[#FF5A36]' : 'text-slate-400'}`} />
                      <span className="text-base">Yes, comfortable</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleValueChange(false)}
                      className={`p-5 rounded-2xl border-2 flex flex-col items-center justify-center gap-2.5 transition-all text-center ${
                        currentValue === false
                          ? 'border-slate-800 bg-slate-900 text-white shadow-sm font-bold scale-[1.01]'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white font-medium'
                      }`}
                    >
                      <ThumbsDown className={`w-6 h-6 ${currentValue === false ? 'text-white' : 'text-slate-400'}`} />
                      <span className="text-base">No, prefer not</span>
                    </button>
                  </div>
                )}

                {/* 2. SINGLE CHOICE WIDGET */}
                {currentQ.type === 'SINGLE_CHOICE' && (
                  <div className="space-y-2.5">
                    {currentQ.options?.map((opt, i) => {
                      const isSelected = currentValue === opt;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleValueChange(opt)}
                          className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between text-left transition-all ${
                            isSelected
                              ? 'border-[#FF5A36] bg-orange-50/50 text-[#1E2229] font-bold shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                          }`}
                        >
                          <span className="text-sm">{opt}</span>
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              isSelected ? 'border-[#FF5A36] bg-[#FF5A36]' : 'border-slate-300'
                            }`}
                          >
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 3. MULTI CHOICE WIDGET */}
                {currentQ.type === 'MULTI_CHOICE' && (
                  <div className="space-y-2.5">
                    {currentQ.options?.map((opt, i) => {
                      const selectedList: string[] = Array.isArray(currentValue) ? currentValue : [];
                      const isChecked = selectedList.includes(opt);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              handleValueChange(selectedList.filter(x => x !== opt));
                            } else {
                              handleValueChange([...selectedList, opt]);
                            }
                          }}
                          className={`w-full p-3.5 rounded-2xl border-2 flex items-center justify-between text-left transition-all ${
                            isChecked
                              ? 'border-emerald-600 bg-emerald-50/60 text-slate-900 font-semibold shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                          }`}
                        >
                          <span className="text-sm">{opt}</span>
                          <div
                            className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                              isChecked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
                            }`}
                          >
                            {isChecked && <Check className="w-3.5 h-3.5" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 4. TIME WIDGET */}
                {currentQ.type === 'TIME' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#FF5A36] flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5" />
                      </div>
                      <input
                        type="time"
                        value={currentValue || ''}
                        onChange={e => handleValueChange(e.target.value)}
                        className="flex-1 px-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-[#FF5A36] focus:outline-hidden font-medium text-slate-900 text-sm"
                      />
                    </div>
                    {/* Quick Presets */}
                    <div>
                      <p className="text-xs text-slate-500 font-semibold mb-2 uppercase tracking-wider">
                        Common Presets:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {['22:00', '22:30', '23:00', '23:30', '00:00', '01:00'].map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => handleValueChange(t)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                              currentValue === t
                                ? 'bg-[#FF5A36] text-white border-[#FF5A36]'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent'
                            }`}
                          >
                            {t === '22:00' ? '10:00 PM' : t === '23:00' ? '11:00 PM' : t === '00:00' ? 'Midnight' : t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. DATE WIDGET */}
                {currentQ.type === 'DATE' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#FF5A36] flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <input
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        value={currentValue || ''}
                        onChange={e => handleValueChange(e.target.value)}
                        className="flex-1 px-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-[#FF5A36] focus:outline-hidden font-medium text-slate-900 text-sm"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-semibold mb-2 uppercase tracking-wider">
                        Quick Timelines:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: 'Immediately', days: 0 },
                          { label: 'Within 7 Days', days: 7 },
                          { label: 'Within 15 Days', days: 15 },
                          { label: '1st of Next Month', days: 30 },
                        ].map((preset, i) => {
                          const targetDate = new Date();
                          targetDate.setDate(targetDate.getDate() + preset.days);
                          const dateStr = targetDate.toISOString().split('T')[0];
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => handleValueChange(dateStr)}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                                currentValue === dateStr
                                  ? 'bg-[#FF5A36] text-white border-[#FF5A36]'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent'
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. TEXT WIDGET */}
                {currentQ.type === 'TEXT' && (
                  <div className="space-y-2">
                    <textarea
                      rows={4}
                      value={currentValue || ''}
                      onChange={e => handleValueChange(e.target.value)}
                      placeholder={currentQ.placeholder || 'Type your response here...'}
                      className="w-full p-4 rounded-2xl border-2 border-slate-200 focus:border-[#FF5A36] focus:outline-hidden text-sm text-slate-900 resize-none"
                    />
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{currentQ.min ? `Min ${currentQ.min} characters` : ''}</span>
                      <span>{(currentValue || '').length} / {currentQ.max || 400}</span>
                    </div>
                  </div>
                )}

                {/* 7. NUMBER WIDGET */}
                {currentQ.type === 'NUMBER' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          const curr = Number(currentValue || currentQ.min || 1);
                          if (curr > (currentQ.min || 1)) handleValueChange(curr - (currentQ.step || 1));
                        }}
                        className="w-12 h-12 rounded-2xl border-2 border-slate-200 hover:border-slate-300 font-bold text-xl flex items-center justify-center text-slate-700 active:scale-95"
                      >
                        -
                      </button>
                      <div className="text-center min-w-[120px]">
                        <span className="text-3xl font-extrabold text-[#1E2229]">
                          {currentValue ?? currentQ.min ?? 1}
                        </span>
                        {currentQ.unit && (
                          <span className="text-sm font-semibold text-slate-500 ml-1.5">
                            {currentQ.unit}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const curr = Number(currentValue || currentQ.min || 1);
                          if (!currentQ.max || curr < currentQ.max) handleValueChange(curr + (currentQ.step || 1));
                        }}
                        className="w-12 h-12 rounded-2xl border-2 border-slate-200 hover:border-slate-300 font-bold text-xl flex items-center justify-center text-slate-700 active:scale-95"
                      >
                        +
                      </button>
                    </div>
                    <div className="flex justify-center gap-2">
                      {[3, 6, 11, 12].map(num => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleValueChange(num)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                            Number(currentValue) === num
                              ? 'bg-[#FF5A36] text-white border-[#FF5A36]'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-transparent'
                          }`}
                        >
                          {num} months
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 8. BUDGET WIDGET */}
                {currentQ.type === 'BUDGET' && (
                  <div className="space-y-5">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                        <IndianRupee className="w-5 h-5 text-[#FF5A36]" />
                      </div>
                      <input
                        type="number"
                        min={currentQ.min || 3000}
                        max={currentQ.max || 100000}
                        step={currentQ.step || 500}
                        value={currentValue || ''}
                        onChange={e => handleValueChange(Number(e.target.value))}
                        placeholder="e.g. 15000"
                        className="w-full pl-11 pr-4 py-3.5 rounded-2xl border-2 border-slate-200 focus:border-[#FF5A36] focus:outline-hidden text-lg font-bold text-slate-900"
                      />
                    </div>
                    {currentValue && (
                      <p className="text-center font-bold text-[#FF5A36] text-lg font-serif">
                        ₹{Number(currentValue).toLocaleString()} / month
                      </p>
                    )}
                    {/* Budget Quick Pills */}
                    <div>
                      <p className="text-xs text-slate-500 font-semibold mb-2 uppercase tracking-wider">
                        Quick Budget Tiers:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {[8000, 12000, 15000, 20000, 25000, 30000].map(amt => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => handleValueChange(amt)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                              currentValue === amt
                                ? 'bg-[#FF5A36] text-white border-[#FF5A36]'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent'
                            }`}
                          >
                            ₹{amt.toLocaleString()}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 9. FREQUENCY WIDGET */}
                {currentQ.type === 'FREQUENCY' && (
                  <div className="space-y-2.5">
                    {currentQ.options?.map((opt, i) => {
                      const isSelected = currentValue === opt;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleValueChange(opt)}
                          className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between text-left transition-all ${
                            isSelected
                              ? 'border-[#FF5A36] bg-orange-50/50 text-[#1E2229] font-bold shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                          }`}
                        >
                          <span className="text-sm">{opt}</span>
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              isSelected ? 'border-[#FF5A36] bg-[#FF5A36]' : 'border-slate-300'
                            }`}
                          >
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 10. PREFERENCE SCALE WIDGET (1 to 10) */}
                {currentQ.type === 'PREFERENCE_SCALE' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>{currentQ.scaleMinLabel || '1 (Relaxed)'}</span>
                      <span>{currentQ.scaleMaxLabel || '10 (Strict)'}</span>
                    </div>
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map(num => {
                        const isSelected = Number(currentValue) === num;
                        return (
                          <button
                            key={num}
                            type="button"
                            onClick={() => handleValueChange(num)}
                            className={`h-12 rounded-xl font-bold text-sm border-2 transition-all flex items-center justify-center ${
                              isSelected
                                ? 'bg-[#FF5A36] text-white border-[#FF5A36] shadow-md scale-105'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {num}
                          </button>
                        );
                      })}
                    </div>
                    {currentValue && (
                      <p className="text-center text-xs font-semibold text-slate-600">
                        Selected Rating: <strong className="text-[#FF5A36] text-sm">{currentValue}/10</strong>
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Error Notice */}
              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* Bottom Actions */}
          {!completed && (
            <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-3 mt-6">
              <button
                type="button"
                onClick={handleBack}
                disabled={currentIndex === 0 || isSubmitting}
                className={`px-4 py-2.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  currentIndex === 0
                    ? 'opacity-0 pointer-events-none'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>

              <button
                type="button"
                onClick={handleNext}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-full bg-[#FF5A36] hover:bg-[#E54E2B] text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all active:scale-98 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Submitting...</span>
                ) : currentIndex === total - 1 ? (
                  <>
                    <span>Submit & Express Interest</span>
                    <Sparkles className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>Continue</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
