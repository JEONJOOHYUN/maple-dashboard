import { AUCTION_HOUSE_FEE_RATE } from "./constants";

export type SettlementBreakdown = {
  grossMeso: number;
  feeMeso: number;
  netMeso: number;
  totalMeso: number;
  krwValue: number;
};

export function computeSettlement(
  fragmentCount: number,
  pureMeso: number,
  fragmentPrice: number,
  cashRate: number
): SettlementBreakdown {
  const grossMeso = fragmentPrice * fragmentCount;
  const feeMeso = grossMeso * AUCTION_HOUSE_FEE_RATE;
  const netMeso = grossMeso - feeMeso;
  const totalMeso = netMeso + pureMeso;
  const krwValue = (totalMeso / 100_000_000) * cashRate;
  return { grossMeso, feeMeso, netMeso, totalMeso, krwValue };
}
