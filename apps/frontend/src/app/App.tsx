import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Wifi } from "lucide-react";
import { Toaster } from "sonner";
import { api, User as ApiUser } from "../services/api";
import { AppStoreProvider } from "./store";
import { AppShell } from "./AppShell";
import { AuthScreen } from "../pages/AuthScreen";
import { LandingScreen } from "../pages/LandingScreen";
import { OnboardingScreen } from "../pages/OnboardingScreen";
import { FeedScreen } from "../pages/FeedScreen";
import { ExploreScreen } from "../pages/ExploreScreen";
import { ContentScreen } from "../pages/ContentScreen";
import { CreateScreen } from "../pages/CreateScreen";
import { ProfileScreen } from "../pages/ProfileScreen";
import { AboutScreen } from "../pages/AboutScreen";
import { CampusScreen } from "../pages/CampusScreen";
import { AnnalsScreen } from "../pages/AnnalsScreen";
import { CampusLifeScreen } from "../pages/CampusLifeScreen";
import { PracticeScreen } from "../pages/PracticeScreen";
import { ProjectsScreen } from "../pages/ProjectsScreen";
import { PeopleScreen } from "../pages/PeopleScreen";
import { OpportunitiesScreen } from "../pages/OpportunitiesScreen";
import { DashboardScreen } from "../pages/DashboardScreen";
import { AiScreen } from "../pages/AiScreen";

function BootSpinner() {
  return (
    <div className="min-h-dvh tt-shell flex flex-col items-center justify-center gap-5">
      <span className="tt-logo-mark w-12 h-12 rounded-2xl tt-pop">
        <Wifi size={20} />
      </span>
      <span className="w-28 h-[3px] rounded-full opacity-80" style={{ background: "var(--orange)" }} />
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactElement }) {
  if (!api.getToken()) return <Navigate to="/login" replace />;
  return children;
}

/* Campus pages were written before routing; they expect an onBack callback. */
function useGoBack() {
  const navigate = useNavigate();
  return () => navigate("/feed");
}

const CampusRoute = () => <CampusScreen onBack={useGoBack()} />;
const AnnalsRoute = () => <AnnalsScreen onBack={useGoBack()} />;
const CampusLifeRoute = () => <CampusLifeScreen onBack={useGoBack()} />;
const AboutRoute = () => <AboutScreen onBack={useGoBack()} />;

export default function App() {
  const navigate = useNavigate();
  const [user, setUser] = useState<ApiUser | null>(() => api.getUser());
  const [bootstrapping, setBootstrapping] = useState(() => !!api.getToken());

  useEffect(() => {
    if (!api.getToken()) {
      setBootstrapping(false);
      return;
    }
    api.getMe().then((res) => {
      if (res.success && res.user) {
        setUser(res.user);
        api.scheduleTokenRefresh();
      } else {
        api.logout();
        setUser(null);
      }
      setBootstrapping(false);
    });
  }, []);

  const handleAuthSuccess = (authUser: ApiUser) => {
    setUser(authUser);
    api.scheduleTokenRefresh();
    const onboarded = localStorage.getItem("teachtalk_onboarding_done");
    navigate(onboarded ? "/feed" : "/onboarding");
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    navigate("/");
  };

  if (bootstrapping) return <BootSpinner />;

  return (
    <AppStoreProvider user={user} onUserUpdate={setUser} onLogout={handleLogout}>
      <Toaster position="top-center" toastOptions={{ style: { borderRadius: "14px" } }} />
      <Routes>
        <Route path="/" element={<LandingScreen />} />
        <Route path="/login" element={user ? <Navigate to="/feed" replace /> : <AuthScreen onAuthSuccess={handleAuthSuccess} />} />

        <Route
          path="/onboarding"
          element={
            <RequireAuth>
              <OnboardingScreen />
            </RequireAuth>
          }
        />

        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/feed" element={<FeedScreen />} />
          <Route path="/dashboard" element={<DashboardScreen />} />
          <Route path="/ai" element={<AiScreen />} />
          <Route path="/explore" element={<ExploreScreen />} />
          <Route path="/practice" element={<PracticeScreen />} />
          <Route path="/projects" element={<ProjectsScreen />} />
          <Route path="/people" element={<PeopleScreen />} />
          <Route path="/opportunities" element={<OpportunitiesScreen />} />
          <Route path="/content/:id" element={<ContentScreen />} />
          <Route path="/create" element={<CreateScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="/saved" element={<Navigate to="/profile?tab=favoris" replace />} />
          <Route path="/settings" element={<Navigate to="/profile?tab=parametres" replace />} />
          <Route path="/about" element={<AboutRoute />} />
          <Route path="/campus" element={<CampusRoute />} />
          <Route path="/annals" element={<AnnalsRoute />} />
          <Route path="/campus-life" element={<CampusLifeRoute />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppStoreProvider>
  );
}
