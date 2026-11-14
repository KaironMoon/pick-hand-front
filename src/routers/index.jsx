import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import Home from "../pages/home";
import NotFound from "../pages/error/NotFound";
import PageLayout from "../pages/PageLayout";
import LoginPage from "../pages/login";
import ProtectedRoute from "../pages/components/ProtectedRoute";
import GameGuard from "../pages/components/GameGuard";

const AutoHistoryPage = lazy(() => import("../pages/auto-history"));
const GhTestShoesPage = lazy(() => import("../pages/gh-test-shoes"));
const Info = lazy(() => import("../pages/info"));
const GamePage = lazy(() => import("../pages/t9game"));
const PatternPage = lazy(() => import("../pages/t9game/pattern.jsx"));
const SetupPage = lazy(() => import("../pages/t9game/setup.jsx"));
const CurrentSetupPage = lazy(() => import("../pages/t9game/current-setup.jsx"));
const UserGamePage = lazy(() => import("../pages/t9game/user-game.jsx"));
const HbGamePage = lazy(() => import("../pages/hbgame"));
const HbUserGamePage = lazy(() => import("../pages/hbgame/user-game.jsx"));
const HbSetupPage = lazy(() => import("../pages/hbgame/setup.jsx"));
const GhGamePage = lazy(() => import("../pages/ghgame"));
const GhUserGamePage = lazy(() => import("../pages/ghgame/user-game.jsx"));
const GhMaxMissPopupPage = lazy(() => import("../pages/ghgame/max-miss-popup.jsx"));
const GhSetupPage = lazy(() => import("../pages/ghgame/setup.jsx"));
const T9UserSetupPage = lazy(() => import("../pages/t9game/user-setup.jsx"));
const HbUserSetupPage = lazy(() => import("../pages/hbgame/user-setup.jsx"));
const GhUserSetupPage = lazy(() => import("../pages/ghgame/user-setup.jsx"));
const NcGamePage = lazy(() => import("../pages/ncgame"));
const NcUserGamePage = lazy(() => import("../pages/ncgame/user-game.jsx"));
const NcSetupPage = lazy(() => import("../pages/ncgame/setup.jsx"));
const NcCurrentSetupPage = lazy(() => import("../pages/ncgame/current-setup.jsx"));
const NcUserSetupPage = lazy(() => import("../pages/ncgame/user-setup.jsx"));
const NcPatternPage = lazy(() => import("../pages/ncgame/pattern.jsx"));
const Nc2UserGamePage = lazy(() => import("../pages/nc2game/user-game.jsx"));
const Nc2UserSetupPage = lazy(() => import("../pages/nc2game/user-setup.jsx"));
const WhGamePage = lazy(() => import("../pages/whgame"));
const WhUserGamePage = lazy(() => import("../pages/whgame/user-game.jsx"));
const WhSetupPage = lazy(() => import("../pages/whgame/setup.jsx"));
const WhCurrentSetupPage = lazy(() => import("../pages/whgame/current-setup.jsx"));
const WhUserSetupPage = lazy(() => import("../pages/whgame/user-setup.jsx"));
const WhPatternPage = lazy(() => import("../pages/whgame/pattern.jsx"));
const MhGamePage = lazy(() => import("../pages/mhgame"));
const MhUserGamePage = lazy(() => import("../pages/mhgame/user-game.jsx"));
const MhSetupPage = lazy(() => import("../pages/mhgame/setup.jsx"));
const MhCurrentSetupPage = lazy(() => import("../pages/mhgame/current-setup.jsx"));
const MhUserSetupPage = lazy(() => import("../pages/mhgame/user-setup.jsx"));
const MhPatternPage = lazy(() => import("../pages/mhgame/pattern.jsx"));
const DhGamePage = lazy(() => import("../pages/dhgame"));
const DhUserGamePage = lazy(() => import("../pages/dhgame/user-game.jsx"));
const DhSetupPage = lazy(() => import("../pages/dhgame/setup.jsx"));
const DhCurrentSetupPage = lazy(() => import("../pages/dhgame/current-setup.jsx"));
const DhUserSetupPage = lazy(() => import("../pages/dhgame/user-setup.jsx"));
const DhPatternPage = lazy(() => import("../pages/dhgame/pattern.jsx"));
const UsersPage = lazy(() => import("../pages/users"));
const AppSettingsPage = lazy(() => import("../pages/app-settings"));
const MaintenancePage = lazy(() => import("../pages/maintenance"));
const GhSupportAdminPage = lazy(() => import("../pages/gh-support-admin"));
const MaintenanceAdminPage = lazy(() => import("../pages/maintenance-admin"));

const ProductLayout = lazy(() => import("../pages/product/ProductLayout"));
const ProductList = lazy(() => import("../pages/product"));
const ProductDetail = lazy(() => import("../pages/product/ProductDetail"));

const ProductRouter = [
  {
    path: "/product",
    element: <ProductLayout />,
    children: [
      {
        path: "/product",
        element: <ProductList />,
      },
      {
        path: "/product/:id",
        element: <ProductDetail />,
      },
    ],
  },
];

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      {
        path: "/ghgame/max-miss",
        element: <GameGuard gameType="gh"><GhMaxMissPopupPage /></GameGuard>,
      },
      {
        path: "/",
        element: <PageLayout />,
        children: [
          {
            path: "/",
            element: <Home />,
          },
          {
            path: "/auto-history",
            element: <AutoHistoryPage />,
          },
          {
            path: "/info",
            element: <Info />,
          },
          {
            path: "/maintenance",
            element: <MaintenancePage />,
          },
          {
            path: "/t9game/user",
            element: <GameGuard gameType="t9"><UserGamePage /></GameGuard>,
          },
          {
            path: "/t9game/current-setup",
            element: <CurrentSetupPage />,
          },
          {
            path: "/hbgame/user",
            element: <GameGuard gameType="hb"><HbUserGamePage /></GameGuard>,
          },
          {
            path: "/ghgame/user",
            element: <GameGuard gameType="gh"><GhUserGamePage /></GameGuard>,
          },
          {
            path: "/ncgame/user",
            element: <GameGuard gameType="nc"><NcUserGamePage /></GameGuard>,
          },
          {
            path: "/ncgame/current-setup",
            element: <NcCurrentSetupPage />,
          },
          {
            path: "/nc2game/user",
            element: <GameGuard gameType="nc2"><Nc2UserGamePage /></GameGuard>,
          },
          {
            path: "/whgame/user",
            element: <GameGuard gameType="wh"><WhUserGamePage /></GameGuard>,
          },
          {
            path: "/whgame/current-setup",
            element: <WhCurrentSetupPage />,
          },
          {
            path: "/mhgame/user",
            element: <GameGuard gameType="mh"><MhUserGamePage /></GameGuard>,
          },
          {
            path: "/mhgame/current-setup",
            element: <MhCurrentSetupPage />,
          },
          {
            path: "/dhgame/user",
            element: <GameGuard gameType="dh"><DhUserGamePage /></GameGuard>,
          },
          {
            path: "/dhgame/current-setup",
            element: <DhCurrentSetupPage />,
          },
          {
            path: "/gh-support-admin",
            element: <GhSupportAdminPage />,
          },
          {
            element: <ProtectedRoute adminOnly />,
            children: [
              {
                path: "/gh-test-shoes",
                element: <GhTestShoesPage />,
              },
              {
                path: "/t9game/user-setup",
                element: <T9UserSetupPage />,
              },
              {
                path: "/hbgame/user-setup",
                element: <HbUserSetupPage />,
              },
              {
                path: "/ghgame/user-setup",
                element: <GhUserSetupPage />,
              },
              {
                path: "/ncgame/user-setup",
                element: <NcUserSetupPage />,
              },
              {
                path: "/nc2game/user-setup",
                element: <Nc2UserSetupPage />,
              },
              {
                path: "/whgame/user-setup",
                element: <WhUserSetupPage />,
              },
              {
                path: "/mhgame/user-setup",
                element: <MhUserSetupPage />,
              },
              {
                path: "/dhgame/user-setup",
                element: <DhUserSetupPage />,
              },
              {
                path: "/t9game",
                element: <GamePage />,
              },
              {
                path: "/t9game/setup",
                element: <SetupPage />,
              },
              {
                path: "/patterns",
                element: <PatternPage />,
              },
              {
                path: "/users",
                element: <UsersPage />,
              },
              {
                path: "/app-settings",
                element: <AppSettingsPage />,
              },
              {
                path: "/maintenance-admin",
                element: <MaintenanceAdminPage />,
              },
              {
                path: "/hbgame",
                element: <HbGamePage />,
              },
              {
                path: "/hbgame/setup",
                element: <HbSetupPage />,
              },
              {
                path: "/ghgame",
                element: <GhGamePage />,
              },
              {
                path: "/ghgame/setup",
                element: <GhSetupPage />,
              },
              {
                path: "/ncgame",
                element: <NcGamePage />,
              },
              {
                path: "/ncgame/setup",
                element: <NcSetupPage />,
              },
              {
                path: "/ncgame/patterns",
                element: <NcPatternPage />,
              },
              {
                path: "/whgame",
                element: <WhGamePage />,
              },
              {
                path: "/whgame/setup",
                element: <WhSetupPage />,
              },
              {
                path: "/whgame/patterns",
                element: <WhPatternPage />,
              },
              {
                path: "/mhgame",
                element: <MhGamePage />,
              },
              {
                path: "/mhgame/setup",
                element: <MhSetupPage />,
              },
              {
                path: "/mhgame/patterns",
                element: <MhPatternPage />,
              },
              {
                path: "/dhgame",
                element: <DhGamePage />,
              },
              {
                path: "/dhgame/setup",
                element: <DhSetupPage />,
              },
              {
                path: "/dhgame/patterns",
                element: <DhPatternPage />,
              },
            ],
          },
          ...ProductRouter,
        ],
      },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);

export default router;
