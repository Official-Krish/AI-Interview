import { client, BASE_URL } from "./eden";
import type { InterviewTurn } from "@evalio/shared";
import type {
  User,
  InterviewSession,
  Resume,
  EvaluationResult,
  EvaluationStatus,
  LoginInput,
  SignupInput,
  VerifyOtpInput,
  ResendOtpInput,
  CreateInterviewInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from "@evalio/shared";

function errorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.error === "string") return e.error;
    if (typeof e.message === "string") return e.message;
  }
  return "Request failed";
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NETWORK"
      | "VALIDATION"
      | "SERVER"
      | "AUTH"
      | "UNKNOWN",
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiCall<T>(
  fn: () => Promise<{ data?: T; error?: unknown }>,
): Promise<T> {
  const { data, error } = await fn();
  if (error) {
    const errObj = error as { status?: number; value?: unknown };
    const status = errObj.status ?? 0;
    const msg = errorMessage(errObj.value);
    if (status === 401) throw new ApiError(msg, "AUTH", status);
    if (status >= 500) throw new ApiError(msg, "SERVER", status);
    if (status >= 400) throw new ApiError(msg, "VALIDATION", status);
    throw new ApiError(msg, "UNKNOWN", status);
  }
  return data as T;
}

export const api = {
  login: (input: LoginInput) =>
    apiCall(() => client.api.auth.login.post(input)) as Promise<{ user: User }>,

  signup: (input: SignupInput) =>
    apiCall(() => client.api.auth.signup.post(input)) as Promise<{
      user: User;
    }>,

  me: () =>
    apiCall(() => client.api.auth.me.get()) as Promise<
      { user: User } | { user: null }
    >,

  logout: async () => {
    await client.api.auth.logout.post();
  },

  forgotPassword: (input: ForgotPasswordInput) =>
    apiCall(() => client.api.auth["forgot-password"].post(input)) as Promise<{
      message: string;
    }>,

  resetPassword: (input: ResetPasswordInput) =>
    apiCall(() => client.api.auth["reset-password"].post(input)) as Promise<{
      message: string;
    }>,

  verifyOtp: (input: VerifyOtpInput) =>
    apiCall(() => client.api.auth["verify-otp"].post(input)) as Promise<{
      user: User;
      verified: boolean;
    }>,

  refresh: () =>
    apiCall(() => client.api.auth.refresh.post()) as Promise<{
      success: boolean;
    }>,

  resendOtp: (input: ResendOtpInput) =>
    apiCall(() => client.api.auth["resend-otp"].post(input)) as Promise<{
      message: string;
    }>,

  listResumes: () =>
    apiCall(() => client.api.resumes.get()) as Promise<{ resumes: Resume[] }>,

  uploadResume: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    let lastErr: unknown;
    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        const res = await fetch(`${BASE_URL}/api/resumes/upload`, {
          method: "POST",
          credentials: "include",
          body: form,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new ApiError(
            data.error || "Upload failed",
            res.status >= 500 ? "SERVER" : "VALIDATION",
            res.status,
          );
        }
        return data as { resume: Resume };
      } catch (err) {
        if (err instanceof ApiError) throw err;
        lastErr = err;
        if (attempt < 2)
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
      }
    }
    throw new ApiError(
      lastErr instanceof Error ? lastErr.message : "Upload failed",
      "NETWORK",
    );
  },

  listInterviews: (skip = 0, take = 20, cursor?: string) =>
    apiCall(() =>
      client.api.interview.get({
        query: {
          skip: String(skip),
          take: String(take),
          ...(cursor ? { cursor } : {}),
        },
      }),
    ) as Promise<{
      interviews: InterviewSession[];
      nextCursor: string | null;
    }>,

  getInterview: (id: string) =>
    apiCall(() => client.api.interview({ id }).get()) as Promise<{
      interview: InterviewSession;
    }>,

  listTurns: (id: string, cursor?: string, take = 50) =>
    apiCall(() =>
      client.api.interview({ id }).turns.get({
        query: { cursor, take: String(take) },
      }),
    ) as Promise<{
      turns: InterviewTurn[];
      nextCursor: string | null;
    }>,

  createInterview: (input: CreateInterviewInput) =>
    apiCall(() => client.api.interview.create.post(input)) as Promise<{
      interview: InterviewSession;
    }>,

  evaluate: (id: string) =>
    apiCall(() => client.api.interview({ id }).evaluate.post()) as Promise<{
      evaluation: EvaluationResult;
    }>,

  evaluationStatus: (id: string) =>
    apiCall(() =>
      client.api.interview({ id }).evaluate.status.get(),
    ) as Promise<EvaluationStatus>,

  getUser: () =>
    apiCall(() => client.api.user.get()) as Promise<{
      user: User & { candidate?: { githubUsername: string | null } };
    }>,

  updateUser: (input: { name?: string }) =>
    apiCall(() => client.api.user.patch(input)) as Promise<{ user: User }>,

  getOverallAnalysis: () =>
    apiCall(() => client.api.analysis.get()) as unknown as Promise<{
      sessions: Array<{
        id: string;
        companyName: string | null;
        roleTitle: string | null;
        overallScore: number | null;
        communicationScore: number | null;
        technicalScore: number | null;
        problemSolvingScore: number | null;
        durationSeconds: number | null;
        createdAt: string;
        mode: string;
        summary: {
          strengths: string[];
          weaknesses: string[];
          improvementAreas: string[];
          summary: string;
        } | null;
      }>;
      skillProfile: Record<string, unknown> | null;
    }>,

  getAnalysis: (id: string) =>
    apiCall(() => client.api.interview({ id }).analysis.get()) as Promise<{
      interview: Record<string, unknown>;
      scoreHistory: Array<{
        id: string;
        companyName: string | null;
        roleTitle: string | null;
        overallScore: number | null;
        communicationScore: number | null;
        technicalScore: number | null;
        problemSolvingScore: number | null;
        date: string;
        mode: string;
      }>;
      skillProfile: Record<string, unknown> | null;
    }>,

  getSkillProfile: () =>
    apiCall(() => client.api.profile.skills.get()) as Promise<{
      profile: Record<string, unknown> | null;
    }>,

  getGithubProfile: () =>
    apiCall(() => client.api.github.get()) as Promise<{
      profile: {
        username: string;
        summary: string;
        languages: string[];
        projects: {
          name: string;
          description?: string | null;
          stars?: number;
          language?: string | null;
        }[];
      } | null;
    }>,

  updateGithubProfile: (input: {
    username: string;
    summary?: string;
    languages?: string[];
    projects?: {
      name: string;
      description?: string | null;
      stars?: number;
      language?: string | null;
    }[];
  }) =>
    apiCall(() => client.api.github.put(input)) as Promise<{
      profile: Record<string, unknown>;
    }>,

  deleteGithubProfile: () =>
    apiCall(() => client.api.github.delete()) as Promise<{ success: boolean }>,

  generateCompany: (companyName: string, industry?: string) =>
    apiCall(() =>
      client.api.companies.generate.post({ companyName, industry }),
    ) as Promise<{
      company: {
        name: string;
        industry: string;
        personality: string;
        roles: {
          title: string;
          description: string;
          defaultStyle: string;
          defaultDepth: string;
        }[];
      };
    }>,

  submitFeedback: (input: {
    subject: string;
    rating: number;
    category: string;
    message: string;
  }) =>
    apiCall(() => client.api.feedback.submit.post(input)) as Promise<{
      feedback: { id: string };
    }>,

  getWsToken: () =>
    apiCall(() => client.api.auth["ws-token"].post({})) as Promise<{
      token: string;
    }>,

  listFeedbacks: () =>
    apiCall(() => client.api.feedback.get()) as unknown as Promise<{
      feedbacks: {
        id: string;
        userId: string;
        subject: string;
        rating: number;
        category: string;
        message: string;
        createdAt: string;
        user: { name: string | null; email: string };
      }[];
    }>,

  startDsaSession: (interviewId: string) =>
    apiCall(() => client.api.dsa.start.post({ interviewId })) as Promise<{
      session: Record<string, unknown>;
    }>,

  startHftSession: (interviewId: string) =>
    apiCall(() =>
      client.api.dsa.start.post({ interviewId, language: "cpp" }),
    ) as Promise<{
      session: Record<string, unknown>;
    }>,

  startSqlSession: (interviewId: string) =>
    apiCall(() => client.api.sql.start.post({ interviewId })) as Promise<{
      session: Record<string, unknown>;
    }>,

  startSdSession: (interviewId: string) =>
    apiCall(() => client.api.sd.start.post({ interviewId })) as Promise<{
      title: string;
      description: string;
      fullBreakdown: string;
      difficulty: string;
    }>,

  startCanvasSession: (interviewId: string) =>
    apiCall(() => client.api.canvas.start.post({ interviewId })) as Promise<{
      title: string;
      description: string;
      fullBreakdown: string;
      difficulty: string;
      questionCount?: number;
      questions?: Array<{
        title: string;
        description: string;
        fullBreakdown: string;
      }>;
    }>,

  startCaseStudySession: (interviewId: string) =>
    apiCall(() =>
      client.api["case-study"].start.post({ interviewId }),
    ) as Promise<{
      title: string;
      description: string;
      fullBreakdown: string;
      difficulty: string;
      questionCount?: number;
      questions?: Array<{
        title: string;
        description: string;
        fullBreakdown: string;
      }>;
    }>,

  startDiscussionSession: (interviewId: string) =>
    apiCall(() =>
      client.api.discussion.start.post({ interviewId }),
    ) as Promise<{
      title: string;
      description: string;
      fullBreakdown: string;
      difficulty: string;
      questionCount?: number;
      questions?: Array<{
        title: string;
        description: string;
        fullBreakdown: string;
      }>;
    }>,

  startQuantSession: (interviewId: string) =>
    apiCall(() => client.api.quant.start.post({ interviewId })) as Promise<{
      session: Record<string, unknown>;
    }>,
};
