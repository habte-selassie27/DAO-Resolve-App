import { activeNetwork } from "./networks.js";
import schema from "./schema/dao_resolve.json";

const addresses = {
  studionet: import.meta.env.VITE_CONTRACT_ADDRESS || "0x70bE655a5e504c9F1364e3e2C34e87aC348d3BAd",
  testnetBradbury: import.meta.env.VITE_CONTRACT_ADDRESS || "",
  localnet: import.meta.env.VITE_CONTRACT_ADDRESS || "",
};

export const contractAddress = addresses[activeNetwork.id] || "";
export const contractExplorerUrl =
  activeNetwork.explorer && contractAddress
    ? `${activeNetwork.explorer}/address/${contractAddress}`
    : "";
export const mockMode = import.meta.env.VITE_MOCK === "1";
export const contractSchema = schema;
export const demoDisputeIds = (import.meta.env.VITE_DEMO_DISPUTES || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);