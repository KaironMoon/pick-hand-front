import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import Home from "../pages/home";
import Info from "../pages/info";
import GamePage from "../pages/t9game";
import PatternPage from "../pages/t9game/pattern.jsx";
import SetupPage from "../pages/t9game/setup.jsx";
import CurrentSetupPage from "../pages/t9game/current-setup.jsx";
import UserGamePage from "../pages/t9game/user-game.jsx";
import NotFound from "../pages/error/NotFound";
import PageLayout from "../pages/PageLayout";
import LoginPage from "../pages/login";
import UsersPage from "../pages/users";
import ProtectedRoute from "../pages/components/ProtectedRoute";
import { Navigate } from "react-router-dom";
import { useAtomValue } from "jotai";
import { userAtom } from "../store/auth-store";

function RootRedirect() {
  const user = useAtomValue(userAtom);
  return <Navigate to={user?.role === "admin" ? "/t9game" : "/t9game/user"} replace />;
}

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
        path: "/",
        element: <PageLayout />,
        children: [
          {
            path: "/",
            element: <RootRedirect />,
          },
          {
            path: "/home",
            element: <Home />,
          },
          {
            path: "/info",
            element: <Info />,
          },
          {
            path: "/t9game/user",
            element: <UserGamePage />,
          },
          {
            path: "/t9game/current-setup",
            element: <CurrentSetupPage />,
          },
          {
            element: <ProtectedRoute adminOnly />,
            children: [
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
