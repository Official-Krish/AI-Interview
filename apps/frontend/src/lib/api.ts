import { client, BASE_URL } from "./eden";
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

export const api = {
  login: async (input: LoginInput) => {
    const { data, error } = await client.api.auth.login.post(input);
    if (error) throw new Error(errorMessage(error.value));
    return data as unknown as { user: User };
  },

  signup: async (input: SignupInput) => {
    const { data, error } = await client.api.auth.signup.post(input);
    if (error) throw new Error(errorMessage(error.value));
    return data as unknown as { user: User };
  },

  me: async () => {
    const { data, error } = await client.api.auth.me.get();
    if (error) throw new Error(errorMessage(error.value));
    return data as { user: User } | { user: null };
  },

  logout: async () => {
    await client.api.auth.logout.post();
  },

  forgotPassword: async (input: ForgotPasswordInput) => {
    const { data, error } =
      await client.api.auth["forgot-password"].post(input);
    if (error) throw new Error(errorMessage(error.value));
    return data as unknown as { message: string };
  },

  resetPassword: async (input: ResetPasswordInput) => {
    const { data, error } = await client.api.auth["reset-password"].post(input);
    if (error) throw new Error(errorMessage(error.value));
    return data as unknown as { message: string };
  },

  verifyOtp: async (input: VerifyOtpInput) => {
    const { data, error } = await client.api.auth["verify-otp"].post(input);
    if (error) throw new Error(errorMessage(error.value));
    return data as unknown as { user: User; verified: boolean };
  },

  resendOtp: async (input: ResendOtpInput) => {
    const { data, error } = await client.api.auth["resend-otp"].post(input);
    if (error) throw new Error(errorMessage(error.value));
    return data as unknown as { message: string };
  },

  listResumes: async () => {
    const { data, error } = await client.api.resumes.get();
    if (error) throw new Error(errorMessage(error.value));
    return data as unknown as { resumes: Resume[] };
  },

  uploadResume: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE_URL}/api/resumes/upload`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    return data as { resume: Resume };
  },

  listInterviews: async (skip = 0, take = 20) => {
    const { data, error } = await client.api.interview.get({
      query: { skip: String(skip), take: String(take) },
    });
    if (error) throw new Error(errorMessage(error.value));
    return data as unknown as { interviews: InterviewSession[] };
  },

  getInterview: async (id: string) => {
    const { data, error } = await client.api.interview({ id }).get();
    if (error) throw new Error(errorMessage(error.value));
    return data as unknown as { interview: InterviewSession };
  },

  createInterview: async (input: CreateInterviewInput) => {
    const { data, error } = await client.api.interview.create.post(input);
    if (error) throw new Error(errorMessage(error.value));
    return data as unknown as { interview: InterviewSession };
  },

  evaluate: async (id: string) => {
    const { data, error } = await client.api.interview({ id }).evaluate.post();
    if (error) throw new Error(errorMessage(error.value));
    return data as unknown as { evaluation: EvaluationResult };
  },

  evaluationStatus: async (id: string) => {
    const { data, error } = await client.api
      .interview({ id })
      .evaluate.status.get();
    if (error) throw new Error(errorMessage(error.value));
    return data as unknown as EvaluationStatus;
  },

  getUser: async () => {
    const { data, error } = await client.api.user.get();
    if (error) throw new Error(errorMessage(error.value));
    return data as unknown as {
      user: User & { candidate?: { githubUsername: string | null } };
    };
  },

  updateUser: async (input: { name?: string }) => {
    const { data, error } = await client.api.user.patch(input);
    if (error) throw new Error(errorMessage(error.value));
    return data as { user: User };
  },

  getOverallAnalysis: async () => {
    const { data, error } = await client.api.analysis.get();
    if (error) throw new Error(errorMessage(error.value));
    return data as unknown as {
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
    };
  },

  getAnalysis: async (id: string) => {
    const { data, error } = await client.api.interview({ id }).analysis.get();
    if (error) throw new Error(errorMessage(error.value));
    return data as unknown as {
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
    };
  },

  getSkillProfile: async () => {
    const { data, error } = await client.api.profile.skills.get();
    if (error) throw new Error(errorMessage(error.value));
    return data as { profile: Record<string, unknown> | null };
  },

  getGithubProfile: async () => {
    const { data, error } = await client.api.github.get();
    if (error) throw new Error(errorMessage(error.value));
    return data as {
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
    };
  },

  updateGithubProfile: async (input: {
    username: string;
    summary?: string;
    languages?: string[];
    projects?: {
      name: string;
      description?: string | null;
      stars?: number;
      language?: string | null;
    }[];
  }) => {
    const { data, error } = await client.api.github.put(input);
    if (error) throw new Error(errorMessage(error.value));
    return data as { profile: Record<string, unknown> };
  },

  deleteGithubProfile: async () => {
    const { data, error } = await client.api.github.delete();
    if (error) throw new Error(errorMessage(error.value));
    return data as { success: boolean };
  },

  generateCompany: async (companyName: string, industry?: string) => {
    const { data, error } = await client.api.companies.generate.post({
      companyName,
      industry,
    });
    if (error) throw new Error(errorMessage(error.value));
    return data as {
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
    };
  },

  submitFeedback: async (input: {
    subject: string;
    rating: number;
    category: string;
    message: string;
  }) => {
    const { data, error } = await client.api.feedback.submit.post(input);
    if (error) throw new Error(errorMessage(error.value));
    return data as { feedback: { id: string } };
  },

  getWsToken: async () => {
    const { data, error } = await client.api.auth["ws-token"].post({});
    if (error) throw new Error(errorMessage(error.value));
    return data as { token: string };
  },

  listFeedbacks: async () => {
    const { data, error } = await client.api.feedback.get();
    if (error) throw new Error(errorMessage(error.value));
    return data as unknown as {
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
    };
  },

  startDsaSession: async (interviewId: string) => {
    const { data, error } = await client.api.dsa.start.post({
      interviewId,
    });
    if (error) throw new Error(errorMessage(error.value));
    return data as unknown as { session: Record<string, unknown> };
  },

  startHftSession: async (interviewId: string) => {
    const { data, error } = await client.api.dsa.start.post({
      interviewId,
      language: "cpp",
    });
    if (error) throw new Error(errorMessage(error.value));
    return data as unknown as { session: Record<string, unknown> };
  },

  startSqlSession: async (interviewId: string) => {
    const { data, error } = await client.api.sql.start.post({
      interviewId,
    });
    if (error) throw new Error(errorMessage(error.value));
    return data as unknown as { session: Record<string, unknown> };
  },

  startSdSession: async (interviewId: string) => {
    const { data, error } = await client.api.sd.start.post({
      interviewId,
    });
    if (error) throw new Error(errorMessage(error.value));
    return data as unknown as {
      title: string;
      description: string;
      fullBreakdown: string;
      difficulty: string;
    };
  },

  startCanvasSession: async (interviewId: string) => {
    const { data, error } = await client.api.canvas.start.post({
      interviewId,
    });
    if (error) throw new Error(errorMessage(error.value));
    return data as unknown as {
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
    };
  },

  startCaseStudySession: async (interviewId: string) => {
    const { data, error } = await client.api["case-study"].start.post({
      interviewId,
    });
    if (error) throw new Error(errorMessage(error.value));
    return data as unknown as {
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
    };
  },

  startDiscussionSession: async (interviewId: string) => {
    const { data, error } = await client.api.discussion.start.post({
      interviewId,
    });
    if (error) throw new Error(errorMessage(error.value));
    return data as unknown as {
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
    };
  },

  startQuantSession: async (interviewId: string) => {
    const { data, error } = await client.api.quant.start.post({
      interviewId,
    });
    if (error) throw new Error(errorMessage(error.value));
    return data as unknown as { session: Record<string, unknown> };
  },
};
