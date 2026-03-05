import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";

import router from "@/routers";
import { PALETTE_MODE } from "@/codes/theme-codes";
import { darkTheme, lightTheme } from "@/styles/theme";
import usePaletteMode from "@/hooks/ThemeHook";

function App() {
  const { paletteMode, changePaletteMode } = usePaletteMode();

  useEffect(() => {
    setTimeout(() => {
      changePaletteMode(PALETTE_MODE.dark);
    }, 1000);
  });

  return (
    <ThemeProvider theme={paletteMode === PALETTE_MODE.dark ? darkTheme : lightTheme}>
      <CssBaseline />
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}

export default App;
