import { createTheme } from "@mui/material/styles";

export const darkTheme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#000",
      paper: "#2d2d2d",
      header: "#2d2d2d",
      footer: "#2d2d2d",
      leftMenu: "#3a3a3a",
    },
    text: {
      primary: "#fff",
    },
  },
});

export const lightTheme = createTheme({
  palette: {
    mode: "light",
    background: {
      default: "#f0f0f0",
      paper: "#f5f5f5",
      header: "#d0d0d0",
      footer: "#e0e0e0",
      leftMenu: "#c8c8c8",
    },
    text: {
      primary: "#222",
      secondary: "#555",
    },
  },
});
