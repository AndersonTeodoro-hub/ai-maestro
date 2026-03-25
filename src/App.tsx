import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "next-themes";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { InstallPrompt } from "./components/InstallPrompt";
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardHome from "./pages/DashboardHome";
import Chat from "./pages/Chat";
import Prompts from "./pages/Prompts";
import Analytics from "./pages/Analytics";
import SettingsPage from "./pages/SettingsPage";
import CharactersPage from "./pages/CharactersPage";
import NotFound from "./pages/NotFound";
import { Navigate } from "react-router-dom";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" storageKey="savvyowl-theme" disableTransitionOnChange={false}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <InstallPrompt />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<Navigate to="/dashboard/chat" replace />} />
              <Route path="home" element={<DashboardHome />} />
              <Route path="chat" element={<Chat />} />
              <Route path="prompts" element={<Prompts />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="characters" element={<CharactersPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
