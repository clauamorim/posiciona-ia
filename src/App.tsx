import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import BusinessQuestionnaire from "./pages/BusinessQuestionnaire";
import ArchetypeQuestionnaire from "./pages/ArchetypeQuestionnaire";
import Results from "./pages/Results";
import StoryBrand from "./pages/StoryBrand";
import EditorialPage from "./pages/EditorialPage";
import Report from "./pages/Report";
import HistoryPage from "./pages/HistoryPage";
import PostEditorPage from "./pages/PostEditorPage";
import InstagramAnalysis from "./pages/InstagramAnalysis";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/business-questionnaire" element={<ProtectedRoute><BusinessQuestionnaire /></ProtectedRoute>} />
            <Route path="/archetype-questionnaire" element={<ProtectedRoute><ArchetypeQuestionnaire /></ProtectedRoute>} />
            <Route path="/results" element={<ProtectedRoute><Results /></ProtectedRoute>} />
            <Route path="/report" element={<ProtectedRoute><Report /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
            <Route path="/post-editor" element={<ProtectedRoute><PostEditorPage /></ProtectedRoute>} />
            <Route path="/storybrand" element={<ProtectedRoute><StoryBrand /></ProtectedRoute>} />
            <Route path="/editorial" element={<ProtectedRoute><EditorialPage /></ProtectedRoute>} />
            <Route path="/instagram-analysis" element={<ProtectedRoute><InstagramAnalysis /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requireAdmin><AdminUsers /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
