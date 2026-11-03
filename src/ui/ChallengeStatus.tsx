import { useEffect, useState } from 'react';

export function ChallengeStatus({ used, finished, paused, activityId }: { used: number; finished: boolean; paused: boolean; activityId: string }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => { setSeconds(0); }, [activityId]);
  useEffect(() => {
    if (finished || paused) return;
    const timer = window.setInterval(() => setSeconds(n => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, [finished, paused, activityId]);
  const remaining = finished ? 0 : Math.max(0, 2 - used);
  return <div className="challenge-status">
    <div className="chance-counter" role="status" aria-label={finished ? 'اكتمل التحدي' : `متبقي ${remaining} من فرصتين`}>
      <span className="chance-counter__dots" aria-hidden="true">{[0, 1].map(i => <span key={i} className={i < remaining ? 'is-available' : ''}>★</span>)}</span>
      <strong>{finished ? 'اكتمل التحدي' : used === 0 ? 'عندك فرصتان' : 'باقي فرصة واحدة'}</strong>
    </div>
    <div className="challenge-clock"><span>وقت التحدي</span><b role="timer" aria-label="الوقت المستغرق" aria-live="off" dir="ltr">{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</b><small>خد وقتك، مفيش حد زمني</small></div>
  </div>;
}
