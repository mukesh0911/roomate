import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications, type Notification } from '@/hooks/useNotifications';
import { Bell, MessageCircle, UserPlus, Home, FileText, Shield, Settings, CheckCheck, Trash2, Filter } from 'lucide-react';
import PageShell from '@/components/PageShell';
import StateEmpty from '@/components/StateEmpty';
import { toast } from 'sonner';

const iconMap: Record<string, { icon: any; color: string }> = {
  match: { icon: Bell, color: 'bg-[#FFF2EB] text-[#FF5A36]' },
  message: { icon: MessageCircle, color: 'bg-[#FFF2EB] text-[#FF5A36]' },
  connect: { icon: UserPlus, color: 'bg-emerald-50 text-emerald-700' },
  room: { icon: Home, color: 'bg-teal-50 text-teal-700' },
  agreement: { icon: FileText, color: 'bg-amber-50 text-amber-700' },
  verification: { icon: Shield, color: 'bg-emerald-50 text-emerald-700' },
  system: { icon: Settings, color: 'bg-gray-100 text-gray-700' },
};

const toDateSafe = (val: any): Date | null => {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const isToday = (d: Date | null) => {
  if (!d) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscribeToNotifications, markAsRead, markAllRead, deleteNotification, requestPermission } = useNotifications();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filterTab, setFilterTab] = useState<'all' | 'unread'>('all');
  const [permissionStatus, setPermissionStatus] = useState<string>(
    () => ('Notification' in window ? Notification.permission : 'default')
  );

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  // Dynamic SEO title
  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount}) Notifications | NestMate` : 'Notifications | NestMate';
  }, [unreadCount]);

  const handleEnablePush = async () => {
    const granted = await requestPermission();
    setPermissionStatus(granted ? 'granted' : 'denied');
    if (granted) {
      toast.success('Push notifications enabled!');
    } else {
      toast.info('Notification permission was not granted.');
    }
  };

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToNotifications(user.uid, setNotifications);
    return () => unsub();
  }, [user?.uid, subscribeToNotifications]);

  const handleMarkAllRead = async () => {
    if (!user?.uid) return;
    await markAllRead(user.uid);
    toast.success('All notifications marked as read');
  };

  const handleDelete = async (id: string) => {
    await deleteNotification(id);
    toast.success('Notification removed');
  };

  const handleClick = async (notif: Notification) => {
    if (!notif.read) await markAsRead(notif.id);
    if (notif.actionUrl) {
      navigate(notif.actionUrl);
    } else {
      switch (notif.type) {
        case 'message':
          navigate('/chat');
          break;
        case 'match':
        case 'connect':
          navigate('/explore?tab=roommates');
          break;
        case 'room':
          navigate('/explore?tab=rooms');
          break;
        case 'verification':
          navigate('/profile');
          break;
        default:
          break;
      }
    }
  };

  const visibleNotifs = useMemo(() => {
    if (filterTab === 'unread') {
      return notifications.filter(n => !n.read);
    }
    return notifications;
  }, [notifications, filterTab]);

  const todayNotifs = visibleNotifs.filter(n => isToday(toDateSafe(n.createdAt)));
  const olderNotifs = visibleNotifs.filter(n => !isToday(toDateSafe(n.createdAt)));

  return (
    <PageShell
      maxWidth="max-w-3xl"
      title="Notifications"
      subtitle="Stay updated on high compatibility matches, inquiries, and verified messages."
      actions={
        unreadCount > 0 ? (
          <button
            onClick={handleMarkAllRead}
            className="text-xs text-[#FF5A36] hover:text-[#E54E2B] font-semibold flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FFF2EB] border border-[#FF5A36]/20 transition-all shadow-2xs cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" /> Mark all as read
          </button>
        ) : undefined
      }
    >
      {permissionStatus === 'default' && (
        <div className="bg-white border border-emerald-200/80 rounded-3xl p-5 sm:p-6 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0 border border-emerald-100">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <p className="font-serif font-medium text-base text-[#1E2229]">Never miss an inquiry or match!</p>
              <p className="text-xs text-gray-500 mt-0.5">Enable browser notifications to receive immediate alerts when a roommate connects.</p>
            </div>
          </div>
          <button 
            onClick={handleEnablePush}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-full transition-all shadow-xs shadow-emerald-600/20 shrink-0 self-start sm:self-auto cursor-pointer"
          >
            Enable Alerts
          </button>
        </div>
      )}

      {/* Filter Tabs when notifications exist */}
      {notifications.length > 0 && (
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              filterTab === 'all'
                ? 'bg-[#1E2229] text-white shadow-2xs'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilterTab('unread')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterTab === 'unread'
                ? 'bg-[#FF5A36] text-white shadow-2xs'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                filterTab === 'unread' ? 'bg-white text-[#FF5A36]' : 'bg-[#FFF2EB] text-[#FF5A36]'
              }`}>
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      )}

      {visibleNotifs.length === 0 ? (
        <div className="py-8">
          <StateEmpty
            icon={Bell}
            title={filterTab === 'unread' ? 'No unread notifications' : 'All caught up!'}
            description={
              filterTab === 'unread'
                ? 'You have read all your notifications. Switch to "All" to view your history.'
                : 'You have no notifications right now. Explore available rooms or connect with verified flatmates.'
            }
            action={
              filterTab === 'unread' ? (
                <button
                  onClick={() => setFilterTab('all')}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#1E2229] text-xs font-semibold rounded-full transition-all cursor-pointer"
                >
                  View All Notifications
                </button>
              ) : (
                <button
                  onClick={() => navigate('/explore?tab=rooms')}
                  className="px-5 py-2.5 bg-[#FF5A36] hover:bg-[#E54E2B] text-white text-xs font-semibold rounded-full transition-all shadow-xs shadow-[#FF5A36]/20 cursor-pointer"
                >
                  Browse Listings & Roommates →
                </button>
              )
            }
            className="bg-white rounded-3xl max-w-xl mx-auto border border-gray-100 p-8 shadow-xs"
          />
        </div>
      ) : (
        <div className="space-y-6">
          {todayNotifs.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 mb-3">Today</p>
              <div className="space-y-3">
                {todayNotifs.map(notif => {
                  const config = iconMap[notif.type] || iconMap.system;
                  const Icon = config.icon;
                  const dateObj = toDateSafe(notif.createdAt);
                  return (
                    <div
                      key={notif.id}
                      data-testid="notification-item"
                      className={`w-full flex items-start gap-4 p-4 sm:p-5 rounded-3xl transition-all text-left ${
                        !notif.read ? 'bg-[#FFF2EB]/80 border border-[#FF5A36]/20 shadow-2xs' : 'bg-white border border-gray-100 shadow-2xs hover:border-gray-200'
                      }`}
                    >
                      <button onClick={() => handleClick(notif)} className="flex items-start gap-4 flex-1 text-left cursor-pointer">
                        <div className={`w-11 h-11 ${config.color} rounded-2xl flex items-center justify-center shrink-0 shadow-2xs`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-serif font-medium text-sm text-[#1E2229] mb-0.5">{notif.title}</p>
                          <p className="text-xs text-gray-600 leading-relaxed font-sans">{notif.description}</p>
                          <p className="text-[10px] text-gray-400 font-medium mt-1.5">
                            {dateObj ? dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </p>
                        </div>
                      </button>
                      <div className="flex items-center gap-1.5 shrink-0 pt-1">
                        {!notif.read && <span className="w-2.5 h-2.5 bg-[#FF5A36] rounded-full" aria-label="Unread" title="Unread" />}
                        <button
                          onClick={() => handleDelete(notif.id)}
                          className="p-2 text-gray-300 hover:text-red-500 transition-colors rounded-full hover:bg-red-50 cursor-pointer"
                          aria-label="Delete notification"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {olderNotifs.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 mb-3">Earlier</p>
              <div className="space-y-3">
                {olderNotifs.map(notif => {
                  const config = iconMap[notif.type] || iconMap.system;
                  const Icon = config.icon;
                  const dateObj = toDateSafe(notif.createdAt);
                  return (
                    <div
                      key={notif.id}
                      data-testid="notification-item"
                      className={`w-full flex items-start gap-4 p-4 sm:p-5 rounded-3xl transition-all text-left ${
                        !notif.read ? 'bg-[#FFF2EB]/80 border border-[#FF5A36]/20 shadow-2xs' : 'bg-white border border-gray-100 shadow-2xs hover:border-gray-200'
                      }`}
                    >
                      <button onClick={() => handleClick(notif)} className="flex items-start gap-4 flex-1 text-left cursor-pointer">
                        <div className={`w-11 h-11 ${config.color} rounded-2xl flex items-center justify-center shrink-0 shadow-2xs`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-serif font-medium text-sm text-[#1E2229] mb-0.5">{notif.title}</p>
                          <p className="text-xs text-gray-600 leading-relaxed font-sans">{notif.description}</p>
                          <p className="text-[10px] text-gray-400 font-medium mt-1.5">
                            {dateObj ? dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                          </p>
                        </div>
                      </button>
                      <div className="flex items-center gap-1.5 shrink-0 pt-1">
                        {!notif.read && <span className="w-2.5 h-2.5 bg-[#FF5A36] rounded-full" aria-label="Unread" title="Unread" />}
                        <button
                          onClick={() => handleDelete(notif.id)}
                          className="p-2 text-gray-300 hover:text-red-500 transition-colors rounded-full hover:bg-red-50 cursor-pointer"
                          aria-label="Delete notification"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
