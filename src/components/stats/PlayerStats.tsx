import type { PlayerStats as PlayerStatsType } from '@/types';

interface PlayerStatsProps {
  stats: PlayerStatsType;
  playerName: string;
}

export function PlayerStatsDisplay({ stats, playerName }: PlayerStatsProps) {
  const vpip = stats.handsEligible > 0 ? (stats.vpipCount / stats.handsEligible * 100).toFixed(1) : '0.0';
  const pfr = stats.handsEligible > 0 ? (stats.pfrCount / stats.handsEligible * 100).toFixed(1) : '0.0';
  const threeBet = stats.threeBetOpportunities > 0 ? (stats.threeBetCount / stats.threeBetOpportunities * 100).toFixed(1) : '0.0';
  const cbet = stats.cBetOpportunities > 0 ? (stats.cBetCount / stats.cBetOpportunities * 100).toFixed(1) : '0.0';
  const wtsd = stats.handsEligible > 0 ? (stats.wentToShowdown / stats.handsEligible * 100).toFixed(1) : '0.0';
  const wsd = stats.wentToShowdown > 0 ? (stats.wonAtShowdown / stats.wentToShowdown * 100).toFixed(1) : '0.0';

  return (
    <div className="bg-gray-800 rounded p-3">
      <h4 className="text-sm font-semibold mb-2">{playerName}</h4>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <StatItem label="VPIP" value={`${vpip}%`} />
        <StatItem label="PFR" value={`${pfr}%`} />
        <StatItem label="3-Bet" value={`${threeBet}%`} />
        <StatItem label="C-Bet" value={`${cbet}%`} />
        <StatItem label="WTSD" value={`${wtsd}%`} />
        <StatItem label="W$SD" value={`${wsd}%`} />
      </div>
      <div className="mt-1 text-[10px] text-gray-500">
        {stats.handsEligible} hands
      </div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-gray-400">{label}</span>
      <span className="font-mono font-semibold text-white">{value}</span>
    </div>
  );
}
