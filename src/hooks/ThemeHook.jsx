import { useState } from "react";
import { PALETTE_MODE } from "../codes/theme-codes";

function usePaletteMode(mode = PALETTE_MODE.light) {
  const [paletteMode, setPaletteMode] = useState(mode);

  const changePaletteMode = (theme) => {
    setPaletteMode(theme);
  };

  return { paletteMode, changePaletteMode };
}

export default usePaletteMode;
