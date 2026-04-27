import { TextCard } from "./cards/TextCard";
import { BreakdownCard } from "./cards/BreakdownCard";
import { DrillPromptCard } from "./cards/DrillPromptCard";
import { BrandCard } from "./cards/BrandCard";
import { RecapGridCard } from "./cards/RecapGridCard";
import type {
  BrandCardProps,
  BreakdownCardProps,
  CardType,
  DrillPromptCardProps,
  RecapGridCardProps,
  TextCardProps,
} from "../data/types";

interface CardPanelProps {
  cardType: CardType;
  props:
    | TextCardProps
    | BreakdownCardProps
    | DrillPromptCardProps
    | BrandCardProps
    | RecapGridCardProps;
}

export const CardPanel: React.FC<CardPanelProps> = ({ cardType, props }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 40,
        right: 40,
        width: 1030,
        height: 600,
        backgroundColor: "#ffffff",
        borderRadius: 24,
        border: "2px solid #f0e9dc",
        boxShadow: "0 12px 40px rgba(20, 20, 20, 0.06)",
        overflow: "hidden",
      }}
    >
      {cardType === "text" && <TextCard {...(props as TextCardProps)} />}
      {cardType === "breakdown" && <BreakdownCard {...(props as BreakdownCardProps)} />}
      {cardType === "drillPrompt" && <DrillPromptCard {...(props as DrillPromptCardProps)} />}
      {cardType === "brand" && <BrandCard {...(props as BrandCardProps)} />}
      {cardType === "recapGrid" && <RecapGridCard {...(props as RecapGridCardProps)} />}
    </div>
  );
};
