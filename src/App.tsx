import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import BusinessQuestionnaire from "./pages/BusinessQuestionnaire";
import PersonalQuestionnaire from "./pages/PersonalQuestionnaire";
import ArchetypeQuestionnaire from "./pages/ArchetypeQuestionnaire";
import Results from "./pages/Results";
import StoryBrand from "./pages/StoryBrand";
import EditorialPage from "./pages/EditorialPage";
import Report from "./pages/Report";
import HistoryPage from "./pages/HistoryPage";
import PostEditorPage from "./pages/PostEditorPage";
import InstagramAnalysis from "./pages/InstagramAnalysis";
import PortraitGenerator from "./pages/PortraitGenerator";
import MyDesignsPage from "./pages/MyDesignsPage";
import MyGalleryPage from "./pages/MyGalleryPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminDocuments from "./pages/admin/AdminDocuments";
import AdminGallery from "./pages/admin/AdminGallery";
import AdminTemplates from "./pages/admin/AdminTemplates";
import ChoosePlan from "./pages/ChoosePlan";
import HelpPage from "./pages/HelpPage";
import NotFound from "./pages/NotFound";
import SalesNarrativeQuestionnaire from "./pages/SalesNarrativeQuestionnaire";
import SalesNarrativeIntro from "./pages/SalesNarrativeIntro";
import SalesStoriesPage from "./pages/SalesStoriesPage";
import SobrePage from "./pages/SobrePage";
import TermosDeServico from "./pages/TermosDeServico";
import PoliticaDePrivacidade from "./pages/PoliticaDePrivacidade";
import { AssistantButton } from "./components/assistant/AssistantButton";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/sobre" element={<SobrePage />} />
            <Route path="/termos-de-servico" element={<TermosDeServico />} />
            <Route path="/politica-de-privacidade" element={<PoliticaDePrivacidade />} />
            <Route path="/checkout-success" element={<CheckoutSuccess />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/choose-plan" element={<ProtectedRoute><ChoosePlan /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute requirePlan><Dashboard /></ProtectedRoute>} />
            <Route path="/business-questionnaire" element={<ProtectedRoute requirePlan><BusinessQuestionnaire /></ProtectedRoute>} />
            <Route path="/personal-questionnaire" element={<ProtectedRoute requirePlan><PersonalQuestionnaire /></ProtectedRoute>} />
            <Route path="/archetype-questionnaire" element={<ProtectedRoute requirePlan><ArchetypeQuestionnaire /></ProtectedRoute>} />
            <Route path="/results" element={<ProtectedRoute requirePlan><Results /></ProtectedRoute>} />
            <Route path="/report" element={<ProtectedRoute requirePlan><Report /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute requirePlan><HistoryPage /></ProtectedRoute>} />
            <Route path="/post-editor" element={<ProtectedRoute requirePlan><PostEditorPage /></ProtectedRoute>} />
            <Route path="/storybrand" element={<ProtectedRoute requirePlan><StoryBrand /></ProtectedRoute>} />
            <Route path="/editorial" element={<ProtectedRoute requirePlan><EditorialPage /></ProtectedRoute>} />
            <Route path="/instagram-analysis" element={<ProtectedRoute requirePlan><InstagramAnalysis /></ProtectedRoute>} />
            <Route path="/portraits" element={<ProtectedRoute requirePlan><PortraitGenerator /></ProtectedRoute>} />
            <Route path="/my-designs" element={<ProtectedRoute requirePlan><MyDesignsPage /></ProtectedRoute>} />
            <Route path="/my-gallery" element={<ProtectedRoute requirePlan><MyGalleryPage /></ProtectedRoute>} />
            <Route path="/sales-narrative-intro" element={<ProtectedRoute requirePlan><SalesNarrativeIntro /></ProtectedRoute>} />
            <Route path="/sales-narrative" element={<ProtectedRoute requirePlan><SalesNarrativeQuestionnaire /></ProtectedRoute>} />
            <Route path="/stories-de-venda" element={<ProtectedRoute requirePlan><SalesStoriesPage /></ProtectedRoute>} />
            <Route path="/help" element={<ProtectedRoute requirePlan><HelpPage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/metrics" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requireAdmin><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/documents" element={<ProtectedRoute requireAdmin><AdminDocuments /></ProtectedRoute>} />
            <Route path="/admin/gallery" element={<ProtectedRoute requireAdmin><AdminGallery /></ProtectedRoute>} />
            <Route path="/admin/templates" element={<ProtectedRoute requireAdmin><AdminTemplates /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <AssistantButton />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
