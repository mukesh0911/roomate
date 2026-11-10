import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStore } from '@/store/useStore';
import { submitSupportTicket, supportTopics } from '@/lib/support';

export default function HelpPage() {
  const { user, isLoading } = useAuth();
  const { openAuthModal } = useStore();
  const [topic, setTopic] = useState('account');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!user) { openAuthModal({ redirect: '/help' }); return; }
    setPending(true); setError('');
    try { setReceipt(await submitSupportTicket(topic, message)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not send your request. Try again.'); }
    finally { setPending(false); }
  }
  const inputClass = 'mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 focus:outline-none focus:ring-2 focus:ring-orange-500';
  return <div className="min-h-screen bg-[#F7F5F1] text-slate-900">
    <header className="border-b bg-white px-6 py-5"><nav aria-label="Main" className="mx-auto flex max-w-4xl justify-between gap-4">
      <Link to="/" className="text-xl font-bold text-orange-600">NestMate</Link><Link to="/explore" className="font-medium">Explore places and people</Link>
    </nav></header>
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-3xl font-bold">Help and support</h1>
      <p className="mt-3 text-slate-600">Get help with your account, conversations, listings or verification.</p>
      <section aria-labelledby="workflow-help" className="mt-8 rounded-2xl border bg-white p-6">
        <h2 id="workflow-help" className="text-xl font-semibold">Using NestMate</h2>
        <dl className="mt-4 space-y-4">
          <div><dt className="font-semibold">Starting a conversation</dt><dd className="mt-1 text-slate-600">Message on a room requests permission from its poster. Chat opens after acceptance. Review received requests in <Link className="underline" to="/connections">Connections</Link>.</dd></div>
          <div><dt className="font-semibold">Applying for a place</dt><dd className="mt-1 text-slate-600">Applications and conversations are separate. Shortlisting or selecting an applicant does not reserve or fill a place.</dd></div>
          <div><dt className="font-semibold">Privacy and your data</dt><dd className="mt-1 text-slate-600">Use <Link className="underline" to="/profile?section=settings">Settings</Link> to manage roommate discovery, announcements and request a private export. Account deletion is currently unavailable.</dd></div>
          <div><dt className="font-semibold">Reporting a concern</dt><dd className="mt-1 text-slate-600">Use the report or block action on the relevant profile or conversation. For an account access concern, send a support request below.</dd></div>
        </dl>
      </section>
      <section aria-labelledby="support-heading" className="mt-6 rounded-2xl border bg-white p-6">
        <h2 id="support-heading" className="text-xl font-semibold">Contact support</h2>
        {receipt ? <div role="status" className="mt-4">
          <p>Your support request was stored.</p><p className="mt-2 break-all">Reference: <strong>{receipt}</strong></p>
          <button className="mt-4 rounded-xl border px-4 py-3" onClick={() => { setReceipt(''); setMessage(''); }}>Send another request</button>
        </div> : <form onSubmit={send} className="mt-4 space-y-5" aria-busy={pending}>
          <p className="text-sm text-slate-600">Include the relevant listing or conversation reference. Do not include passwords, identity-document numbers or payment credentials.</p>
          <div><label htmlFor="support-topic" className="font-medium">Topic</label><select id="support-topic" value={topic} onChange={e => setTopic(e.target.value)} disabled={pending} className={inputClass}>
            {supportTopics.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
          </select></div>
          <div><label htmlFor="support-message" className="font-medium">Message</label><textarea id="support-message" required maxLength={4000} rows={6} value={message} onChange={e => setMessage(e.target.value)} disabled={pending} aria-describedby={error ? 'support-error' : undefined} className={inputClass} /></div>
          {error && <p id="support-error" role="alert" className="text-red-700">{error}</p>}
          <button type="submit" disabled={pending || isLoading} className="rounded-xl bg-orange-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{pending ? 'Sending...' : user ? 'Send request' : 'Sign in to send'}</button>
        </form>}
      </section>
    </main>
  </div>;
}
