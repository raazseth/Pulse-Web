import { useCallback, useState } from "react";
import { Box, useMediaQuery, useTheme } from "@mui/material";
import { Outlet } from "react-router-dom";
import { TranscriptHudProvider } from "@/modules/transcript/context/TranscriptHudContext";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { PwaInstallBanner } from "@/shared/components/PwaInstallBanner";

const SIDEBAR_WIDTH = 280;
const TOPBAR_HEIGHT = 64;

const LS_SIDEBAR_EXPANDED = "pulse-sidebar-expanded";

function readSidebarExpandedDefault(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(LS_SIDEBAR_EXPANDED) !== "0";
}

export function DashboardLayout() {
  const theme = useTheme();
  const isLg = useMediaQuery(theme.breakpoints.up("lg"));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarExpanded, setDesktopSidebarExpanded] = useState(readSidebarExpandedDefault);

  const setDesktopSidebarExpandedPersisted = useCallback((next: boolean) => {
    setDesktopSidebarExpanded(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LS_SIDEBAR_EXPANDED, next ? "1" : "0");
    }
  }, []);

  const topBarSidebarOffset = isLg ? (desktopSidebarExpanded ? SIDEBAR_WIDTH : 0) : 0;

  return (
    <TranscriptHudProvider>
      <Box sx={{ display: "flex", minHeight: "100vh" }}>
        <TopBar
          sidebarWidth={topBarSidebarOffset}
          topbarHeight={TOPBAR_HEIGHT}
          onMenuClick={() => setSidebarOpen(true)}
          desktopSidebarCollapsed={isLg && !desktopSidebarExpanded}
          onExpandDesktopSidebar={() => setDesktopSidebarExpandedPersisted(true)}
        />
        <Sidebar
          width={SIDEBAR_WIDTH}
          topbarHeight={TOPBAR_HEIGHT}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          desktopExpanded={desktopSidebarExpanded}
          onDesktopExpandedChange={setDesktopSidebarExpandedPersisted}
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
          <PwaInstallBanner />
          <Outlet />
        </Box>
      </Box>
    </TranscriptHudProvider>
  );
}
