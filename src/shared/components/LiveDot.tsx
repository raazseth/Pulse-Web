import { Box, Typography } from "@mui/material";
import { keyframes } from "@mui/system";

const livePulse = keyframes`
  0%   { box-shadow: 0 0 0 0   rgba(34,197,94,0.55); }
  70%  { box-shadow: 0 0 0 6px rgba(34,197,94,0);    }
  100% { box-shadow: 0 0 0 0   rgba(34,197,94,0);    }
`;

export function LiveDot() {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
      <Box
        sx={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          bgcolor: "#22c55e",
          animation: `${livePulse} 1.8s ease-in-out infinite`,
        }}
      />
      <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "#16a34a" }}>
        Live
      </Typography>
    </Box>
  );
}
