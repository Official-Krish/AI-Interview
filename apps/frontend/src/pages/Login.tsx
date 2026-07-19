import { useState, useEffect } from "react";
import { Link, useNavigate, Navigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { loginSchema, type LoginInput } from "@evalio/shared";
import { useLogin } from "../lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { AuthLayout } from "@/components/static/AuthLayout";
import { SEO } from "@/components/SEO";
import toast from "react-hot-toast";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const loginMutation = useLogin();
  const queryClient = useQueryClient();
  const session = queryClient.getQueryData<{ user: unknown }>(["session"]);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    const email = searchParams.get("email");
    if (email) setValue("email", email);
  }, [searchParams, setValue]);

  const onSubmit = (data: LoginInput) => {
    loginMutation.mutate(data, {
      onSuccess: () => {
        toast.success("Welcome back!");
        navigate("/dashboard");
      },
      onError: (err) => {
        const msg = err.message;
        toast.error(msg);
        if (msg.includes("verify your email")) {
          navigate(`/verify-otp?email=${encodeURIComponent(data.email)}`);
        }
      },
    });
  };

  if (session) return <Navigate to="/dashboard" replace />;

  return (
    <AuthLayout variant="login">
      <SEO
        title="Sign In"
        description="Sign in to Evalio to continue your interview practice."
      />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[420px]"
      >
        <div className="mb-8 lg:mb-10">
          <p className="static-badge">Sign in</p>
          <h1 className="static-title mt-4 text-[2rem]">Welcome back.</h1>
          <p className="static-subtitle mt-2">Continue where you left off.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {["Live feedback", "Résumé-aware", "12 min avg"].map((tag) => (
              <span
                key={tag}
                className="text-[10px] tracking-[0.12em] uppercase text-[var(--landing-fg-faint)] border border-[var(--landing-line)] px-2.5 py-1"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="static-auth-card space-y-5"
        >
          <div>
            <label htmlFor="email" className="static-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              className="static-input"
              {...register("email")}
            />
            {errors.email && (
              <p className="mt-1 text-[12px] text-red-400">
                {errors.email.message}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="password" className="static-label">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                className="static-input pr-10"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--landing-fg-faint)] transition-colors text-sm cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-[12px] text-red-400">
                {errors.password.message}
              </p>
            )}
          </div>
          <div className="flex items-center justify-end -mt-2">
            <Link
              to="/forgot-password"
              className="text-[12px] text-[var(--landing-accent)] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="landing-cta-primary landing-cta-sharp w-full justify-center text-[13px] disabled:opacity-60 cursor-pointer"
          >
            {loginMutation.isPending ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-center text-[13px] text-[var(--landing-fg-faint)]">
            No account?{" "}
            <Link
              to="/signup"
              className="text-[var(--landing-accent)] hover:underline"
            >
              Create one
            </Link>
          </p>
        </form>
      </motion.div>
    </AuthLayout>
  );
}
