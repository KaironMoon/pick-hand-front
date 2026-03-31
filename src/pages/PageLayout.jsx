import { useState } from "react";
import { Container, Box, Divider, Drawer, useMediaQuery } from "@mui/material";
import AppBar from "@mui/material/AppBar";
import { Outlet } from "react-router-dom";
import { useTheme } from "@mui/material/styles";

import PageHeader from "@/pages/components/layout/PageHeader";
import PageLeftMenu from "@/pages/components/layout/PageLeftMenu";
import PageFooter from "@/pages/components/layout/PageFooter";
import GameBlockedDialog from "@/pages/components/GameBlockedDialog";

const DRAWER_WIDTH = 200;

function PageLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleMenuToggle = () => setMobileMenuOpen(!mobileMenuOpen);
  const handleMenuClose = () => setMobileMenuOpen(false);

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
        <PageHeader isMobile={isMobile} onMenuToggle={handleMenuToggle} />
      </AppBar>
      <Box sx={{ display: "flex", flexGrow: 1, overflow: isMobile ? "visible" : "hidden" }}>
        {isMobile ? (
          <Drawer
            anchor="left"
            open={mobileMenuOpen}
            onClose={handleMenuClose}
            sx={{
              "& .MuiDrawer-paper": {
                width: DRAWER_WIDTH,
                backgroundColor: theme.palette.background.leftMenu,
              },
            }}
          >
            <PageLeftMenu isMobile={true} onMenuClose={handleMenuClose} />
          </Drawer>
        ) : (
          <Box
            sx={{
              backgroundColor: theme.palette.background.leftMenu,
              minHeight: "100%",
              width: DRAWER_WIDTH,
              flexShrink: 0,
            }}
          >
            <PageLeftMenu isMobile={false} />
          </Box>
        )}
        <Box
          sx={{
            flexGrow: 1,
            backgroundColor: theme.palette.background.default,
            overflow: "auto",
          }}
        >
          <Outlet />
        </Box>
      </Box>
      {!isMobile && (
        <>
          <Divider />
          <PageFooter />
        </>
      )}
      <GameBlockedDialog />
    </Container>
  );
}

export default PageLayout;
