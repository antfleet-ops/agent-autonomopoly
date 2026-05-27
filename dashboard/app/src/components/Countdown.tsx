import { useEffect, useState } from 'react';

interface CountdownProps {
  targetUnix: bigint; // seconds
  label: string;
}

function formatRemaining(seconds: number): string {
  if (seconds <= 0) return 'Ended';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export default function Countdown({ targetUnix, label }: CountdownProps) {
  const [remaining, setRemaining] = useState<number>(
    Number(targetUnix) - Math.floor(Date.now() / 1000),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Number(targetUnix) - Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [targetUnix]);

  return (
    <span className="tabular-nums text-sm">
      {label}: <span className={remaining <= 0 ? 'text-gray-400' : 'text-green-400'}>{formatRemaining(remaining)}</span>
    </span>
  );
}
