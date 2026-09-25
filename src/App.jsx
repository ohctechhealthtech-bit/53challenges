import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import RoleGuard from '@/components/RoleGuard';
import ProtectedRoute from '@/components/ProtectedRoute';
import HostAChallenge from './pages/HostAChallenge';
import HostStart from './pages/HostStart';
import HostIdeaWizard from './pages/HostIdeaWizard';
import HostTemplateSelect from './pages/HostTemplateSelect';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { needsAgeGate } from '@/lib/ageGate';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import Layout from './components/Layout';
import Home from './pages/Home';
import Challenges from './pages/Challenges';
import ChallengeIntro from './pages/ChallengeIntro';
import ChallengeFinalists from './pages/ChallengeFinalists';
import SubmitEntry from './pages/SubmitEntry';
import Leaderboard from './pages/Leaderboard';
import HallOfFame from './pages/HallOfFame';
import Ecosystem from './pages/Ecosystem';
import About from './pages/About';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import AgeGate from './pages/AgeGate';
import Profile from './pages/Profile';
import MyEntries from './pages/MyEntries';
import MyApplications from './pages/MyApplications';
import MyVotes from './pages/MyVotes';
import Dashboard from './pages/Dashboard';
import DashboardLegacy from './pages/DashboardLegacy';
import HostChallenge from './pages/HostChallenge';
import PortalManual from './pages/PortalManual';
import TyPlanner from './pages/TyPlanner';
import BecomeJudge from './pages/BecomeJudge';
import SponsorsAndJudges from './pages/SponsorsAndJudges';
import BecomeSponsor from './pages/BecomeSponsor';
import JudgingAdmin from './pages/JudgingAdmin';
import JudgesMasterAdmin from './pages/JudgesMasterAdmin';
import JudgePortal from './pages/JudgePortal';
import JudgeControlRoom from './pages/JudgeControlRoom';
import VoteFraudDashboard from './pages/VoteFraudDashboard';
import AuditWorkspace from './pages/AuditWorkspace';
import Pathways from './pages/Pathways';
import Marketing from './pages/Marketing';
import SponsorPortal from './pages/SponsorPortal';
import Reporting from './pages/Reporting';
import ComingSoon from './pages/ComingSoon';
import ComplianceGateAdmin from './pages/ComplianceGateAdmin';
import ComplianceRulesAdmin from './pages/ComplianceRulesAdmin';
import CorporateIntake from './pages/CorporateIntake';
import CorporateIntakeAdmin from './pages/CorporateIntakeAdmin';
import PricingCalculator from './pages/PricingCalculator';
import ChallengeEngine from './pages/ChallengeEngine';
import TemplateLibraryAdmin from './pages/TemplateLibraryAdmin';
import RateCardAdmin from './pages/RateCardAdmin';
import ActivityReport from './pages/ActivityReport';
import AdminSnapshot from './pages/AdminSnapshot';

import MyDashboard from './pages/MyDashboard';
import MyProgress from './pages/MyProgress';
import MyPromo from './pages/MyPromo';
import ChallengeCategoryDetail from './pages/ChallengeCategoryDetail';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfUse from './pages/TermsOfUse';
import CompetitionRules from './pages/CompetitionRules';
import SafetyAndWellbeing from './pages/SafetyAndWellbeing';
import ContactUs from './pages/ContactUs';
import HostApplication from './pages/host/HostApplication';
import HostDashboard from './pages/host/HostDashboard';
import HostWorkspace from './pages/host/HostWorkspace';
import GuardianDashboard from './pages/GuardianDashboard';
import DomainManagement from './pages/DomainManagement';
import SubdomainChallenge from './pages/SubdomainChallenge';
import { getChallengeSubdomain } from '@/lib/subdomainValidation';
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user, isAuthenticated } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to the in-app login page — unless we're already on an auth
      // route (otherwise we'd loop). On an auth route, fall through and render
      // the routes so the login / forgot / reset page shows.
      const p = window.location.pathname;
      const authRoutes = ['/login', '/register', '/forgot-password', '/reset-password', '/auth', '/age-gate'];
      if (!authRoutes.includes(p)) {
        navigateToLogin();
        return null;
      }
    }
  }

  // Signed-in users without a confirmed date of birth cannot use the app.
  // Admins skip. Under-16s are refused on the age-gate page itself.
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const ageSkip = ['/login', '/register', '/forgot-password', '/reset-password', '/auth', '/verify-email', '/age-gate', '/privacy-policy', '/terms-of-use', '/safety-and-wellbeing'];
  if (isAuthenticated && needsAgeGate(user) && !ageSkip.includes(path)) {
    return <Navigate to="/age-gate" replace />;
  }

  // Challenge subdomain routing: on e.g. dance.53challenges.com, "/" shows that
  // challenge instead of the homepage. Only the "/" route changes — returning
  // early here instead would stop <Routes> rendering at all, which made every
  // in-app link on a subdomain inert, including Enter Challenge and Vote.
  const subdomainSlug = getChallengeSubdomain();

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* Reset emails link to /auth?mode=reset&token=... */}
      <Route path="/auth" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/age-gate" element={<AgeGate />} />
      <Route element={<Layout />}>
        <Route path="/" element={subdomainSlug ? <SubdomainChallenge slug={subdomainSlug} /> : <Home />} />
        <Route path="/challenges" element={<Challenges />} />
        <Route path="/challenges/category/:slug" element={<ChallengeCategoryDetail />} />
        <Route path="/challenges/:id" element={<ChallengeIntro />} />
        <Route path="/challenges/:id/vote" element={<ChallengeFinalists />} />
        <Route path="/challenges/:id/submit" element={<SubmitEntry />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/hall-of-fame" element={<HallOfFame />} />
        <Route path="/ecosystem" element={<Ecosystem />} />
        <Route path="/about" element={<About />} />
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route path="/profile" element={<Profile />} />
          <Route path="/my-entries" element={<MyEntries />} />
          <Route path="/my-requests" element={<MyApplications />} />
          <Route path="/my-progress" element={<MyProgress />} />
          <Route path="/my-promo" element={<MyPromo />} />
          <Route path="/my-votes" element={<MyVotes />} />
          <Route path="/guardian" element={<GuardianDashboard />} />
          <Route path="/host-dashboard" element={<HostDashboard />} />
          <Route path="/host-workspace/:id" element={<HostWorkspace />} />
          <Route path="/judge-portal" element={<JudgePortal />} />
          <Route path="/judge" element={<JudgeControlRoom />} />
          <Route path="/sponsor-portal" element={<SponsorPortal />} />
          <Route path="/my-dashboard" element={<MyDashboard />} />
        </Route>
        <Route path="/corporate-intake" element={<CorporateIntake />} />
        <Route path="/pricing-calculator" element={<PricingCalculator />} />
        <Route path="/host-start" element={<HostStart />} />
        <Route path="/host-idea" element={<HostIdeaWizard />} />
        <Route path="/host-templates" element={<HostTemplateSelect />} />
        <Route path="/host-a-challenge" element={<HostAChallenge />} />
        <Route path="/host-a-challenge/enquiry" element={<HostChallenge />} />
        <Route path="/host-apply" element={<HostApplication />} />
        <Route path="/my-challenge-proposals" element={<Navigate to="/host-dashboard" replace />} />
        <Route path="/run-a-challenge" element={<Navigate to="/host-a-challenge" replace />} />
        <Route path="/sponsors-and-judges" element={<SponsorsAndJudges />} />
        <Route path="/become-a-judge" element={<BecomeJudge />} />
        <Route path="/pathways" element={<Pathways />} />
        <Route path="/become-a-sponsor" element={<BecomeSponsor />} />
        <Route path="/become-sponsor" element={<Navigate to="/become-a-sponsor" replace />} />
        <Route element={<RoleGuard message="The Challenge Engine is available to 53 Challenges administrators only." />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/DashboardLegacy" element={<DashboardLegacy />} />
          <Route path="/challenge-engine" element={<ChallengeEngine />} />
          <Route path="/template-library" element={<TemplateLibraryAdmin />} />
          <Route path="/corporate-intake-admin" element={<CorporateIntakeAdmin />} />
          <Route path="/compliance-gate" element={<ComplianceGateAdmin />} />
          <Route path="/compliance-rules" element={<ComplianceRulesAdmin />} />
          <Route path="/judging" element={<JudgingAdmin />} />
          <Route path="/judges-master" element={<JudgesMasterAdmin />} />
          <Route path="/vote-fraud" element={<VoteFraudDashboard />} />
          <Route path="/reporting" element={<Reporting />} />
          <Route path="/activity-report" element={<ActivityReport />} />
          <Route path="/admin-snapshot" element={<AdminSnapshot />} />
          <Route path="/marketing" element={<Marketing />} />
          <Route path="/rate-card-admin" element={<RateCardAdmin />} />
          <Route path="/audit" element={<AuditWorkspace />} />
          <Route path="/ty" element={<TyPlanner />} />
          <Route path="/domain-management" element={<DomainManagement />} />
        </Route>
        <Route path="/coming-soon" element={<ComingSoon />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-use" element={<TermsOfUse />} />
        <Route path="/competition-rules" element={<CompetitionRules />} />
        <Route path="/safety-and-wellbeing" element={<SafetyAndWellbeing />} />
        <Route path="/contact-us" element={<ContactUs />} />
        <Route path="/manual" element={<PortalManual />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <SonnerToaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App