import { FormEvent, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/modules/auth/hooks/useAuthStore";
import { useToast } from "@/shared/components/Toast";



const LEFT_GRADIENT =
  "linear-gradient(155deg, #083d2a 0%, #0e6647 35%, #149F77 70%, #1ebd8e 100%)";

const BTN_GRADIENT =
  "linear-gradient(135deg, #0a5c42 0%, #149F77 55%, #22c99a 100%)";

const BTN_GRADIENT_HOVER =
  "linear-gradient(135deg, #083d2a 0%, #0e7a5a 55%, #18aa82 100%)";



function PulseLogo() {
  return (
    <Box
      aria-hidden
      sx={{
        width: 52,
        height: 52,
        borderRadius: "16px",
        background: BTN_GRADIENT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 8px 28px rgba(20,159,119,0.38)",
      }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 12h3l3-8 4 16 3-10 2 2h3"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Box>
  );
}

function LeftPanelDecorations() {
  return (
    <>
      {                                       }
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          bottom: -110,
          left: -110,
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.055)",
          pointerEvents: "none",
        }}
      />
      {                }
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          bottom: -200,
          left: -200,
          width: 700,
          height: 700,
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.07)",
          pointerEvents: "none",
        }}
      />
      {                                       }
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: "25%",
          right: -64,
          width: 210,
          height: 210,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.045)",
          pointerEvents: "none",
        }}
      />
    </>
  );
}



const INPUT_SX = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "12px",
    backgroundColor: "#F9FAFB",
    "& fieldset": { borderColor: "#E5E7EB" },
    "&:hover fieldset": { borderColor: "#149F77" },
    "&.Mui-focused fieldset": {
      borderColor: "#149F77",
      borderWidth: "1.5px",
    },
    "& input": { color: "#111827", fontSize: "0.9375rem" },
    "& input::placeholder": { color: "#9CA3AF", opacity: 1 },
    
    "& input:-webkit-autofill": {
      WebkitBoxShadow: "0 0 0 1000px #F9FAFB inset",
      WebkitTextFillColor: "#111827",
      caretColor: "#111827",
      borderRadius: "12px",
    },
    "& input:-webkit-autofill:hover": {
      WebkitBoxShadow: "0 0 0 1000px #F9FAFB inset",
    },
    "& input:-webkit-autofill:focus": {
      WebkitBoxShadow: "0 0 0 1000px #F9FAFB inset",
    },
    "& .MuiInputAdornment-positionStart svg": { color: "#9CA3AF" },
    "& .MuiInputAdornment-positionEnd svg": { color: "#9CA3AF" },
  },
  "& .MuiInputLabel-root": { color: "#6B7280", fontSize: "0.9375rem" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#149F77" },
  "& .MuiInputLabel-root.Mui-error": { color: "#DC2626" },
  "& .MuiOutlinedInput-root.Mui-error fieldset": { borderColor: "#FCA5A5" },
} as const;



export function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [loading, setLoading] = useState(false);

  const isLogin = mode === "login";

  const switchMode = (next: "login" | "register") => {
    setMode(next);
    setHasError(false);
    setEmail("");
    setPassword("");
    setName("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setHasError(false);
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      navigate("/");
    } catch (err) {
      setHasError(true);
      toast((err as Error).message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>

      {                                                           }
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          justifyContent: "flex-end",
          width: { md: "32%", lg: "34%" },
          flexShrink: 0,
          background: LEFT_GRADIENT,
          p: { md: "40px 36px", lg: "52px 44px" },
          position: "relative",
          overflow: "hidden",
        }}
      >
        <LeftPanelDecorations />

        {                 }
        <Stack spacing={2} sx={{ position: "relative", zIndex: 1 }}>
          <Typography
            sx={{
              color: "rgba(255,255,255,0.5)",
              fontSize: "0.6875rem",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Real-time interview assistant
          </Typography>

          <Typography
            sx={{
              color: "#fff",
              fontWeight: 800,
              fontSize: { md: "1.375rem", lg: "1.75rem" },
              lineHeight: 1.22,
              letterSpacing: "-0.03em",
            }}
          >
            Surface insights.<br />
            Stay present.<br />
            Ship better research.
          </Typography>

          <Typography
            sx={{
              color: "rgba(255,255,255,0.52)",
              fontSize: "0.9375rem",
              lineHeight: 1.72,
              maxWidth: "100%",
            }}
          >
            AI-powered prompts and live transcription so you never miss a moment during qualitative interviews.
          </Typography>

          {                  }
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            {[
              "Live transcript capture",
              "Context-aware AI prompts",
              "JSON & CSV session export",
            ].map((feat) => (
              <Box key={feat} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    bgcolor: "rgba(255,255,255,0.7)",
                    flexShrink: 0,
                  }}
                />
                <Typography sx={{ color: "rgba(255,255,255,0.65)", fontSize: "0.875rem" }}>
                  {feat}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Stack>
      </Box>

      {                                                           }
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "#fff",
          px: { xs: 3, sm: 5 },
          py: { xs: 5, sm: 7 },
          overflowY: "auto",
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 392 }}>

          {                    }
          <Stack spacing={1.5} sx={{ mb: 4, alignItems: "center" }}>
            <PulseLogo />
            <Box sx={{ textAlign: "center" }}>
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: "1.5rem",
                  color: "#111827",
                  letterSpacing: "-0.025em",
                  lineHeight: 1.25,
                }}
              >
                {isLogin ? "Welcome back" : "Create your account"}
              </Typography>
              <Typography sx={{ color: "#6B7280", fontSize: "0.875rem", mt: 0.75, lineHeight: 1.5 }}>
                {isLogin
                  ? "Sign in to your Pulse HUD workspace"
                  : "Get started — it only takes a minute"}
              </Typography>
            </Box>
          </Stack>

          {          }
          <Stack component="form" spacing={2.5} onSubmit={handleSubmit} noValidate>
            {!isLogin && (
              <TextField
                label="Full name"
                placeholder="Your full name"
                autoComplete="name"
                autoFocus
                value={name}
                onChange={(e) => { setName(e.target.value); setHasError(false); }}
                error={hasError}
                required
                fullWidth
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonOutlineRoundedIcon sx={{ fontSize: "1.2rem" }} />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={INPUT_SX}
              />
            )}

            <TextField
              label="Email address"
              placeholder="Your work email"
              type="email"
              autoComplete="email"
              autoFocus={isLogin}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setHasError(false); }}
              error={hasError}
              required
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailOutlinedIcon sx={{ fontSize: "1.2rem" }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={INPUT_SX}
            />

            <TextField
              label="Password"
              placeholder="Your password"
              type={showPassword ? "text" : "password"}
              autoComplete={isLogin ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setHasError(false); }}
              error={hasError}
              required
              fullWidth
              slotProps={{
                htmlInput: { minLength: 8 },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlinedIcon sx={{ fontSize: "1.2rem" }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        edge="end"
                        tabIndex={-1}
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        sx={{ color: "#9CA3AF", "&:hover": { color: "#374151" } }}
                      >
                        {showPassword
                          ? <VisibilityOffOutlinedIcon sx={{ fontSize: "1.125rem" }} />
                          : <VisibilityOutlinedIcon sx={{ fontSize: "1.125rem" }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
              sx={INPUT_SX}
            />

            {isLogin && (
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    sx={{
                      color: "#D1D5DB",
                      borderRadius: "6px",
                      "&.Mui-checked": { color: "#149F77" },
                      "& .MuiSvgIcon-root": { fontSize: "1.1rem" },
                    }}
                  />
                }
                label={
                  <Typography sx={{ color: "#374151", fontSize: "0.875rem", userSelect: "none" }}>
                    Keep me signed in
                  </Typography>
                }
                sx={{ mx: 0 }}
              />
            )}

            <Button
              type="submit"
              fullWidth
              disabled={loading}
              sx={{
                mt: 0.5,
                height: 50,
                borderRadius: "12px",
                fontWeight: 700,
                fontSize: "0.9375rem",
                color: "#fff",
                textTransform: "none",
                letterSpacing: "0.01em",
                background: BTN_GRADIENT,
                boxShadow: "0 4px 18px rgba(20,159,119,0.38)",
                "&:hover": {
                  background: BTN_GRADIENT_HOVER,
                  boxShadow: "0 6px 22px rgba(20,159,119,0.48)",
                },
                "&.Mui-disabled": {
                  background: "linear-gradient(135deg, rgba(8,61,42,0.45) 0%, rgba(20,159,119,0.45) 100%)",
                  color: "rgba(255,255,255,0.55)",
                },
              }}
              startIcon={
                loading
                  ? <CircularProgress size={16} sx={{ color: "rgba(255,255,255,0.7)" }} />
                  : null
              }
            >
              {isLogin ? "Sign in" : "Create account"}
            </Button>
          </Stack>

          {                        }
          {isLogin && (
            <Box sx={{ mt: 2.5, textAlign: "center" }}>
              <Link
                component="button"
                type="button"
                sx={{
                  color: "#149F77",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  textDecoration: "none",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                Having trouble signing in?
              </Link>
            </Box>
          )}

          {                 }
          <Box sx={{ mt: 2.5, textAlign: "center" }}>
            <Typography sx={{ color: "#9CA3AF", fontSize: "0.875rem" }}>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <Link
                component="button"
                type="button"
                onClick={() => switchMode(isLogin ? "register" : "login")}
                sx={{
                  color: "#149F77",
                  fontWeight: 600,
                  textDecoration: "none",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                {isLogin ? "Create one" : "Sign in"}
              </Link>
            </Typography>
          </Box>

          {                  }
          <Stack
            direction="row"
            spacing={3}
            sx={{ mt: 4, pt: 3, borderTop: "1px solid #F3F4F6", justifyContent: "center" }}
          >
            {["Privacy Policy", "Terms of Service"].map((label) => (
              <Link
                key={label}
                href="#"
                sx={{
                  color: "#9CA3AF",
                  fontSize: "0.75rem",
                  textDecoration: "none",
                  "&:hover": { color: "#374151" },
                }}
              >
                {label}
              </Link>
            ))}
          </Stack>

        </Box>
      </Box>


    </Box>
  );
}
