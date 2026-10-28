export default function StandingName({
  name,
  overdrive,
}: {
  name: string;
  overdrive?: boolean;
}) {
  return (
    <span
      className={overdrive === true ? "overdrive-name" : undefined}
      title={overdrive === true ? `${name} · Overdrive Core active` : undefined}
    >
      {name}
    </span>
  );
}
