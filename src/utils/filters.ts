import { MB_BYTES } from "../constants";

export function parseSizeInput(value: string) {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    return null;
  }
  return parsed * MB_BYTES;
}
