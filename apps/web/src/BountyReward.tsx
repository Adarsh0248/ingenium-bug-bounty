import { bountyRank } from "./bug-art";

export function TecnoesisCoin() {
  return (
    <img
      className="tecnoesis-coin"
      src="/graphics/tecnoesis-coin.svg"
      alt=""
      aria-hidden="true"
      width="22"
      height="23"
    />
  );
}

const layouts = [
  [[94, 16, 94, -8]],
  [
    [62, 51, 73, -18],
    [141, 48, 73, 17],
    [101, 28, 84, -5],
  ],
  [
    [97, 61, 85, 0],
    [97, 50, 85, 0],
    [97, 39, 85, 0],
    [97, 28, 85, 0],
    [97, 17, 85, 0],
    [157, 59, 64, 16],
  ],
  [
    [28, 64, 66, -13],
    [62, 58, 70, 0],
    [62, 47, 70, 0],
    [62, 36, 70, 0],
    [62, 25, 70, 0],
    [163, 65, 70, 9],
    [163, 54, 70, 9],
    [163, 43, 70, 9],
    [163, 32, 70, 9],
    [108, 52, 79, -4],
    [108, 40, 79, -4],
    [108, 28, 79, -4],
    [108, 16, 79, -4],
    [103, 69, 68, -26],
  ],
] as const;
const names = ["single", "pile", "stack", "heap"] as const;

export default function BountyReward({
  amount,
  title,
}: {
  amount: number;
  title: string;
}) {
  const tier = bountyRank(amount).tier;
  return (
    <div
      className="bounty-reward"
      role="status"
      aria-atomic="true"
      data-coins={names[tier]}
    >
      <div className="reward-coins" aria-hidden="true">
        {layouts[tier].map(([x, y, size, angle], index) => (
          <span
            key={index}
            style={
              {
                left: x,
                top: y,
                width: size,
                "--coin-angle": `${angle}deg`,
                "--coin-delay": `${index * 14}ms`,
              } as React.CSSProperties
            }
          >
            <TecnoesisCoin />
          </span>
        ))}
      </div>
      <span className="reward-caption">BOUNTY SECURED</span>
      <strong>
        +{amount.toLocaleString()} <small>coins</small>
      </strong>
      <span className="reward-target">{title}</span>
      <span className="reward-mint" aria-hidden="true">
        TECNOESIS / VERIFIED REWARD
      </span>
    </div>
  );
}
