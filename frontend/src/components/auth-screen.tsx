import { useMemo, useState } from "react";
import { KeyRound, LogIn, Mail, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth-store";

type AuthMode = "login" | "register" | "forgot" | "reset";

export function AuthScreen() {
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const resetToken = searchParams.get("reset_token") ?? "";
  const emailFromLink = searchParams.get("email") ?? "";
  const [mode, setMode] = useState<AuthMode>(resetToken ? "reset" : "login");
  const [email, setEmail] = useState(emailFromLink);
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { login, register, forgotPassword, resetPassword, isAuthenticating, error } = useAuthStore();

  const onSubmit = async () => {
    if (mode === "login") {
      await login({ email, password });
      toast.success("Logged in successfully.");
      return;
    }
    if (mode === "register") {
      if (password !== confirmPassword) {
        toast.error("Passwords do not match.");
        return;
      }
      await register({ email, password, full_name: fullName });
      toast.success("Profile created successfully.");
      return;
    }
    if (mode === "forgot") {
      const response = await forgotPassword(email);
      toast.success(response.message);
      if (response.dev_reset_link) {
        toast.message("SMTP is not configured yet. A dev reset link was returned by the backend.");
        window.history.replaceState({}, "", response.dev_reset_link);
      }
      return;
    }
    if (mode === "reset") {
      if (password !== confirmPassword) {
        toast.error("Passwords do not match.");
        return;
      }
      await resetPassword(resetToken, password);
      toast.success("Password updated. You can log in now.");
      window.history.replaceState({}, "", window.location.pathname);
      setMode("login");
      setPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border bg-card/90 shadow-panel lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden bg-gradient-to-br from-sky-600 via-cyan-500 to-orange-400 p-10 text-white lg:block">
          <div className="max-w-md">
            <div className="rounded-3xl bg-white/15 p-4 backdrop-blur">
              <ShieldCheck className="h-10 w-10" />
            </div>
            <h1 className="mt-8 text-4xl font-semibold leading-tight">Secure research chat for your documents and web insights.</h1>
            <p className="mt-5 text-sm leading-7 text-white/90">
              Create your profile, keep private chat threads, and recover access with reset links sent to your email.
            </p>
          </div>
        </div>

        <div className="p-6 md:p-10">
          <div className="mx-auto max-w-md">
            <h2 className="text-3xl font-semibold">
              {mode === "login" && "Welcome back"}
              {mode === "register" && "Create your profile"}
              {mode === "forgot" && "Forgot password"}
              {mode === "reset" && "Choose a new password"}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {mode === "forgot"
                ? "We will send a reset link to your email address."
                : mode === "reset"
                  ? "Set a new password for your account."
                  : "Sign in to continue into the Smart Research Chatbot workspace."}
            </p>

            <div className="mt-8 space-y-4">
              {mode === "register" ? (
                <div>
                  <label className="mb-2 block text-sm font-medium">Full name</label>
                  <Input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Aarav Sharma" />
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-sm font-medium">Email</label>
                <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" />
              </div>

              {mode !== "forgot" ? (
                <div>
                  <label className="mb-2 block text-sm font-medium">{mode === "reset" ? "New password" : "Password"}</label>
                  <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimum 8 characters" type="password" />
                </div>
              ) : null}

              {mode === "register" || mode === "reset" ? (
                <div>
                  <label className="mb-2 block text-sm font-medium">Confirm password</label>
                  <Input
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repeat your password"
                    type="password"
                  />
                </div>
              ) : null}

              {error ? <p className="rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p> : null}

              <Button className="w-full" onClick={onSubmit} disabled={isAuthenticating}>
                {mode === "login" ? <LogIn className="h-4 w-4" /> : mode === "register" ? <UserPlus className="h-4 w-4" /> : mode === "forgot" ? <Mail className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
                {mode === "login" && "Login"}
                {mode === "register" && "Create Profile"}
                {mode === "forgot" && "Send Reset Link"}
                {mode === "reset" && "Reset Password"}
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              {mode !== "login" ? (
                <button className="font-medium text-primary" onClick={() => setMode("login")}>
                  Back to login
                </button>
              ) : null}
              {mode === "login" ? (
                <>
                  <button className="font-medium text-primary" onClick={() => setMode("register")}>
                    Create profile
                  </button>
                  <button className="font-medium text-primary" onClick={() => setMode("forgot")}>
                    Forgot password?
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
