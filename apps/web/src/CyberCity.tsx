import { memo } from "react";
import type { RegionId } from "./regions";
import NeonDistrict from "./NeonDistrict";
import FoundryBoard from "./FoundryBoard";
import VerdantNexus from "./VerdantNexus";
import ZeroDayCore from "./ZeroDayCore";

export default memo(function CyberCity({
  still,
  region = "neon",
}: {
  still: boolean;
  region?: RegionId;
}) {
  if (region === "neon") return <NeonDistrict still={still} />;
  if (region === "foundry") return <FoundryBoard still={still} />;
  if (region === "verdant") return <VerdantNexus still={still} />;
  return <ZeroDayCore still={still} />;
});
