import { Suspense } from "react";
import { RouterProvider } from "react-router-dom";
import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";

import router from "@/routers";
import { PALETTE_MODE } from "@/codes/theme-codes";
import { darkTheme, lightTheme } from "@/styles/theme";
import usePaletteMode from "@/hooks/ThemeHook";
import PageLoading from "@/pages/components/PageLoading";

function App() {
  const { paletteMode } = usePaletteMode(PALETTE_MODE.dark);

  return (
    <ThemeProvider theme={paletteMode === PALETTE_MODE.dark ? darkTheme : lightTheme}>
      <CssBaseline />
      <Suspense fallback={<PageLoading fullScreen />}>
        <RouterProvider router={router} />
      </Suspense>
    </ThemeProvider>
  );
}

export default App;
