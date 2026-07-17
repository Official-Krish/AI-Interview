import { lazy, Suspense, useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createBrowserRouter,
  Navigate,
} from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import { motion } from "motion/react";
import { useSession } from "./lib/auth";
import { ThemeProvider } from "./lib/theme";
import { useTheme } from "./lib/use-theme";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AppLayout } from "./components/layout/AppLayout";
import { SiteLoader, AnimatedLogo } from "./components/layout/SiteLoader";

const lazyPage = <K extends string>(
  imp: () => Promise<Record<K, React.ComponentType>>,
  name: K,
) => lazy(() => imp().then((m) => ({ default: m[name] })));

const LandingPage = lazyPage(() => import("./pages/Landing"), "LandingPage");
const LoginPage = lazyPage(() => import("./pages/Login"), "LoginPage");
const SignupPage = lazyPage(() => import("./pages/Signup"), "SignupPage");
const VerifyOtpPage = lazyPage(
  () => import("./pages/VerifyOtp"),
  "VerifyOtpPage",
);
const ForgotPasswordPage = lazyPage(
  () => import("./pages/ForgotPassword"),
  "ForgotPasswordPage",
);
const ResetPasswordPage = lazyPage(
  () => import("./pages/ResetPassword"),
  "ResetPasswordPage",
);
const DashboardPage = lazyPage(
  () => import("./pages/Dashboard"),
  "DashboardPage",
);
const NewInterviewPage = lazyPage(
  () => import("./pages/NewInterview"),
  "NewInterviewPage",
);
const InterviewPage = lazyPage(
  () => import("./pages/Interview"),
  "InterviewPage",
);
const ResultsPage = lazyPage(() => import("./pages/Results"), "ResultsPage");
const AnalysisPage = lazyPage(() => import("./pages/Analysis"), "AnalysisPage");
const ProfilePage = lazyPage(() => import("./pages/Profile"), "ProfilePage");
const PricingPage = lazyPage(() => import("./pages/Pricing"), "PricingPage");
const AboutPage = lazyPage(() => import("./pages/About"), "AboutPage");
const FAQPage = lazyPage(() => import("./pages/FAQ"), "FAQPage");
const ContactPage = lazyPage(() => import("./pages/Contact"), "ContactPage");
const FeedbackPage = lazyPage(() => import("./pages/Feedback"), "FeedbackPage");
const AdminFeedbackPage = lazyPage(
  () => import("./pages/AdminFeedback"),
  "AdminFeedbackPage",
);
const BlogPage = lazyPage(() => import("./pages/Blog"), "BlogPage");
const BlogPostPage = lazyPage(() => import("./pages/BlogPost"), "BlogPostPage");
const CareersPage = lazyPage(() => import("./pages/Careers"), "CareersPage");
const DocsPage = lazyPage(() => import("./pages/Docs"), "DocsPage");
const PrivacyPage = lazyPage(() => import("./pages/Privacy"), "PrivacyPage");
const TermsPage = lazyPage(() => import("./pages/Terms"), "TermsPage");
const CookiesPage = lazyPage(() => import("./pages/Cookies"), "CookiesPage");
const NotFoundPage = lazyPage(() => import("./pages/NotFound"), "NotFoundPage");

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useSession();
  if (isLoading) return null;
  if (!data?.user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/pricing", element: <PricingPage /> },
  { path: "/about", element: <AboutPage /> },
  { path: "/faq", element: <FAQPage /> },
  { path: "/contact", element: <ContactPage /> },
  {
    path: "/feedback",
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [{ index: true, element: <FeedbackPage /> }],
  },
  {
    path: "/admin/feedback",
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [{ index: true, element: <AdminFeedbackPage /> }],
  },
  { path: "/blog", element: <BlogPage /> },
  { path: "/blog/:slug", element: <BlogPostPage /> },
  { path: "/careers", element: <CareersPage /> },
  { path: "/docs", element: <DocsPage /> },
  { path: "/privacy", element: <PrivacyPage /> },
  { path: "/terms", element: <TermsPage /> },
  { path: "/cookies", element: <CookiesPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },
  { path: "/verify-otp", element: <VerifyOtpPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  {
    path: "/dashboard",
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [{ index: true, element: <DashboardPage /> }],
  },
  {
    path: "/interview/new",
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [{ index: true, element: <NewInterviewPage /> }],
  },
  {
    path: "/interview/:id",
    element: (
      <AuthGuard>
        <InterviewPage />
      </AuthGuard>
    ),
  },
  {
    path: "/results/:id",
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [{ index: true, element: <ResultsPage /> }],
  },
  {
    path: "/analysis",
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [{ index: true, element: <AnalysisPage /> }],
  },
  {
    path: "/profile",
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [{ index: true, element: <ProfilePage /> }],
  },
  { path: "*", element: <NotFoundPage /> },
]);

function PageSkeleton() {
  const { theme } = useTheme();
  const isLight = theme === "light";
  return (
    <div className="page-skeleton">
      <motion.div
        animate={{
          scale: [1, 1.03, 1],
        }}
        transition={{
          duration: 1.2,
          ease: "easeInOut",
          repeat: Infinity,
          repeatType: "reverse",
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 64,
          height: 64,
          willChange: "transform",
        }}
      >
        <AnimatedLogo size={64} isLight={isLight} />
      </motion.div>
    </div>
  );
}

export function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30_000 },
        },
      }),
  );

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const handleExpired = () => {
      queryClient.setQueryData(["session"], { user: null });
      toast.error("Session expired. Please log in again.");
      window.location.href = "/login";
    };
    window.addEventListener("auth:expired", handleExpired);
    return () => window.removeEventListener("auth:expired", handleExpired);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const checkReady = async () => {
      // 1. Wait for fonts if document.fonts is supported
      if (document.fonts) {
        try {
          await document.fonts.ready;
        } catch (e) {
          console.warn("Failed to load fonts", e);
        }
      }

      // 2. Wait for window load event if document is not complete yet
      if (document.readyState !== "complete") {
        await new Promise((resolve) => {
          window.addEventListener("load", resolve, { once: true });
        });
      }

      if (isMounted) {
        setIsReady(true);
      }
    };

    checkReady();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ErrorBoundary>
          <SiteLoader isReady={isReady}>
            <Suspense fallback={<PageSkeleton />}>
              <RouterProvider router={router} />
            </Suspense>
          </SiteLoader>
        </ErrorBoundary>
        <Toaster
          position="top-center"
          gutter={12}
          containerStyle={{ marginTop: 72 }}
          toastOptions={{
            duration: 4000,
            style: {
              background: "var(--color-bg-elevated)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              fontSize: "13px",
              padding: "12px 16px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
              maxWidth: 400,
            },
            success: {
              iconTheme: {
                primary: "#b8a88a",
                secondary: "#080808",
              },
            },
            error: {
              iconTheme: {
                primary: "#ef4444",
                secondary: "#080808",
              },
            },
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
