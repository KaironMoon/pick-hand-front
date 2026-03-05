import { Container, Box, Divider } from "@mui/material";
import AppBar from "@mui/material/AppBar";
import { Outlet } from "react-router-dom";
import { useTheme } from "@mui/material/styles";

import PageHeader from "@/pages/components/layout/PageHeader";
import PageLeftMenu from "@/pages/components/layout/PageLeftMenu";
import PageFooter from "@/pages/components/layout/PageFooter";

function PageLayout() {
  const theme = useTheme();

  return (
    <Container
      maxWidth={false}
      disableGutters
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        backgroundColor: theme.palette.background.default,
      }}
    >
      <AppBar position="static" sx={{ backgroundColor: theme.palette.background.paper }}>
        <PageHeader />
      </AppBar>
      <Box sx={{ display: "flex", flexGrow: 1 }}>
        <Box sx={{ backgroundColor: theme.palette.background.leftMenu, minHeight: "100%" }}>
          <PageLeftMenu />
        </Box>
        <Box sx={{ flexGrow: 1, backgroundColor: theme.palette.background.default }}>
          <Outlet />
        </Box>
      </Box>
      <Divider />
      <PageFooter />
    </Container>
  );
}

export default PageLayout;
