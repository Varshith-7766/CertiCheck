import type { ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "./lib/auth";
import { ThemeProvider } from "./lib/theme";
import { Spinner } from "./components/ui";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Forgot from "./pages/Forgot";
import Reset from "./pages/Reset";
import VerifyEmail from "./pages/VerifyEmail";
import Setup2fa from "./pages/Setup2fa";
import Checker from "./pages/Checker";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";

function LoadingSplash() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <Spinner className="size-9 text-accent" />
    </div>
  );
}

/** Mirrors the main app's guards: login → role consoles → setup-2fa gate. */
function RequireAuth({ roles, children }: { roles?: ("ADMIN" | "CHECKER")[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSplash />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.emailVerified || (user.totpRequired && !user.totpEnabled)) {
    return <Navigate to="/setup-2fa" replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === "ADMIN" ? "/admin" : "/checker"} replace />;
  }
  return <>{children}</>;
}

function AnimatedRoutes() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.main
        key={location.pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
      >
        <Routes location={location}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot" element={<Forgot />} />
          <Route path="/reset" element={<Reset />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/setup-2fa" element={<Setup2fa />} />
          <Route
            path="/checker"
            element={
              <RequireAuth roles={["CHECKER"]}>
                <Checker />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth roles={["ADMIN"]}>
                <Admin />
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <Settings />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.main>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AnimatedRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
