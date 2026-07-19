import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import {
  signupSchema,
  passwordRequirements,
  type SignupInput,
} from "@evalio/shared";
import { useSignup } from "../lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { AuthLayout } from "@/components/static/AuthLayout";
import { SEO } from "@/components/SEO";
import toast from "react-hot-toast";

export function SignupPage() {
  const navigate = useNavigate();
  const signupMutation = useSignup();
  const queryClient = useQueryClient();
  const session = queryClient.getQueryData<{ user: unknown }>(["session"]);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const watchedPassword = watch("password", "");

  const onSubmit = (data: SignupInput) => {
    signupMutation.mutate(data, {
      onSuccess: () => {
        toast.success(
          "Account created! Check your email for the verification code.",
        );
        navigate(`/verify-otp?email=${encodeURIComponent(data.email)}`);
      },
      onError: (err) => {
        const msg = err.message;
        if (msg.includes("sign in with your credentials")) {
          toast("Account already exists. Redirecting you to sign in…");
          navigate(`/login?email=${encodeURIComponent(data.email)}`);
        } else {
          toast.error(msg);
        }
      },
    });
  };

  if (session) return <Navigate to="/dashboard" replace />;

  return (
    <AuthLayout variant="signup">
      <SEO
        title="Create Account"
        description="Create your Evalio account and start practicing interviews with AI."
      />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[420px]"
      >
        <div className="mb-4 lg:mb-6">
          <p className="static-badge">Get started</p>
          <h1 className="static-title mt-4 text-[2rem]">Start interviewing.</h1>
          <p className="static-subtitle mt-2">
            Free during early access. No card required.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {["No card", "Instant setup", "Real pressure"].map((tag) => (
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
            <label htmlFor="name" className="static-label">
              Name
            </label>
            <input
              id="name"
              type="text"
              placeholder="Your name"
              className="static-input"
              {...register("name")}
            />
            {errors.name && (
              <p className="mt-1 text-[12px] text-red-400">
                {errors.name.message}
              </p>
            )}
          </div>
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
                placeholder="Create a strong password"
                className="static-input pr-10"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--landing-fg-faint)] hover:text-[var(--landing-fg)] transition-colors text-sm"
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
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {passwordRequirements.map((req) => {
                const met = !watchedPassword || req.test(watchedPassword);
                return (
                  <div
                    key={req.label}
                    className={`text-[11px] flex items-center gap-1.5 transition-colors ${
                      !watchedPassword
                        ? "text-[var(--landing-fg-faint)]"
                        : met
                          ? "text-emerald-400"
                          : "text-red-400"
                    }`}
                  >
                    <span className="text-[13px] leading-none shrink-0">
                      {met ? "✓" : "○"}
                    </span>
                    {req.label}
                  </div>
                );
              })}
            </div>
          </div>
          <button
            type="submit"
            disabled={signupMutation.isPending}
            className="landing-cta-primary landing-cta-sharp w-full justify-center text-[13px] disabled:opacity-60 cursor-pointer"
          >
            {signupMutation.isPending ? "Creating…" : "Create account"}
          </button>
          <p className="text-center text-[13px] text-[var(--landing-fg-faint)]">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-[var(--landing-accent)] hover:underline"
            >
              Sign in
            </Link>
          </p>
        </form>
      </motion.div>
    </AuthLayout>
  );
}
