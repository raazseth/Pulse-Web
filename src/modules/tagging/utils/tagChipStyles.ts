import { alpha, type Theme } from "@mui/material/styles";
import type { TagOption } from "@/modules/tagging/types";

   
                                                                                       
                                                                                                
   
export function tagChipOutlinedRestSx(theme: Theme, color: TagOption["color"]) {
  if (color === "default") {
    return {
      borderColor: alpha(theme.palette.grey[500], 0.28),
      bgcolor: alpha(theme.palette.background.paper, 0.72),
    };
  }
  const tone = theme.palette[color];
  const main = "main" in tone ? tone.main : theme.palette.grey[600];
  const dark = "dark" in tone ? tone.dark : main;
  return {
    borderColor: alpha(main, 0.42),
    bgcolor: alpha(main, 0.12),
    color: dark,
    "&:hover": {
      bgcolor: alpha(main, 0.18),
      borderColor: alpha(main, 0.55),
    },
  };
}
