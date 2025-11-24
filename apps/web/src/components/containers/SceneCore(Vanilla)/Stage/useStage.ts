import { useContext } from "react";
import { StageContext } from "./StageContext";

export function useStage() {
  const ctx = useContext(StageContext);
  if (!ctx) throw new Error("useStage must be used inside <Stage>");
  return ctx;
}
