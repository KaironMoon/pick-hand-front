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
      default: "#fafafa",
      paper: "#ffffff",
      header: "#e0e0e0",
      footer: "#f5f5f5",
      leftMenu: "#d3d3d3",
    },
    text: {
      primary: "#333",
    },
  },
});
