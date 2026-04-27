import { useState } from "react";
import { Box } from "@mui/material";
import { Outlet } from "react-router-dom";
import { TranscriptHudProvider } from "@/modules/transcript/context/TranscriptHudContext";
import { NavSidebar } from "./NavSidebar";
import { TopBar } from "./TopBar";

const SIDEBAR_WIDTH = 280;
const TOPBAR_HEIGHT = 64;

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <TranscriptHudProvider>
      <Box sx={{ display: "flex", minHeight: "100vh" }}>
        <TopBar
          sidebarWidth={SIDEBAR_WIDTH}
          topbarHeight={TOPBAR_HEIGHT}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <NavSidebar
          width={SIDEBAR_WIDTH}
          topbarHeight={TOPBAR_HEIGHT}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            minWidth: 0,
            minHeight: "100vh",
            pt: `${TOPBAR_HEIGHT}px`,
            bgcolor: "background.default",
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </TranscriptHudProvider>
  );
}
