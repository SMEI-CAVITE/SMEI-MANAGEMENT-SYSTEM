/**
 * System Resource, Database Usage, and File Storage Monitoring System Module
 * SMEI Management System & TSD Portal Monitoring Architecture
 *
 * Compact, Responsive, Gray-Themed Dashboard Container
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  HardDrive,
  Database,
  FileText,
  Activity,
  Server,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  ArrowUpDown,
  Settings,
  Eye,
  Sliders,
  TrendingUp,
  Clock,
  Layers,
  PieChart,
  ShieldAlert,
  Info,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import {
  MonitoringOverviewData,
  MonitoringFileRecord,
  MonitoringSettings,
  SystemHealthStatus
} from "../types";
import { api } from "../lib/api";
import { monitoringService } from "../services/monitoringService";

// Helper: Format bytes to human readable format
function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// Health status badge mapping - Fixed Gray & Status Theme
const healthBadgeMap: Record<SystemHealthStatus, { label: string; bg: string; text: string; border: string; icon: any }> = {
  NORMAL: {
    label: "NORMAL HEALTH",
    bg: "bg-zinc-800/90",
    text: "text-emerald-400",
    border: "border-emerald-500/40",
    icon: CheckCircle2
  },
  WARNING: {
    label: "WARNING (70%+)",
    bg: "bg-zinc-800/90",
    text: "text-amber-400",
    border: "border-amber-500/40",
    icon: AlertTriangle
  },
  CRITICAL: {
    label: "CRITICAL (85%+)",
    bg: "bg-zinc-800/90",
    text: "text-orange-400",
    border: "border-orange-500/40",
    icon: ShieldAlert
  },
  EXTREME: {
    label: "EXTREME (95%+)",
    bg: "bg-zinc-800/90",
    text: "text-rose-400",
    border: "border-rose-500/40",
    icon: XCircle
  },
  LIMIT_REACHED: {
    label: "LIMIT REACHED",
    bg: "bg-zinc-800/90",
    text: "text-red-300",
    border: "border-red-500/60",
    icon: XCircle
  }
};

export default function SystemMonitoringModule() {
  const [overview, setOverview] = useState<MonitoringOverviewData | null>(null);
  const [files, setFiles] = useState<MonitoringFileRecord[]>([]);
  const [historyData, setHistoryData] = useState<{ snapshots: any[]; operationsLog: any[] }>({ snapshots: [], operationsLog: [] });
  const [forecastData, setForecastData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "registry" | "database" | "forecast" | "history">("overview");
  const [expandedDocPanels, setExpandedDocPanels] = useState<Record<string, boolean>>({});

  const toggleDocPanel = (docKey: string) => {
    setExpandedDocPanels(prev => ({ ...prev, [docKey]: !prev[docKey] }));
  };

  // Filter & Search states for File Registry
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPortal, setSelectedPortal] = useState<string>("ALL");
  const [selectedDocType, setSelectedDocType] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ACTIVE");
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Selected file detail modal state
  const [selectedFileDetail, setSelectedFileDetail] = useState<MonitoringFileRecord | null>(null);

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState<MonitoringSettings>({
    storageLimitBytes: 5368709120, // 5GB
    warningThresholdPct: 70,
    criticalThresholdPct: 85,
    extremeThresholdPct: 95
  });

  // Load all monitoring data
  const loadMonitoringData = async () => {
    setIsLoading(true);
    try {
      // Discover & sync local files first
      await monitoringService.discoverAndSyncLocalFiles();

      const [overviewRes, filesRes, historyRes, forecastRes, settingsRes] = await Promise.all([
        api.getMonitoringOverview(),
        api.getMonitoringFiles(),
        api.getMonitoringHistory(),
        api.getMonitoringForecast(),
        api.getMonitoringSettings()
      ]);

      setOverview(overviewRes);
      setFiles(filesRes);
      setHistoryData(historyRes);
      setForecastData(forecastRes);
      if (settingsRes) {
        setSettingsForm(settingsRes);
      }
    } catch (err) {
      console.error("[SystemMonitoring] Error loading monitoring data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMonitoringData();
  }, []);

  const handleSyncFiles = async () => {
    setIsSyncing(true);
    try {
      await monitoringService.discoverAndSyncLocalFiles();
      await loadMonitoringData();
    } catch (err) {
      console.error("[SystemMonitoring] Sync error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateMonitoringSettings(settingsForm);
      setIsSettingsOpen(false);
      await loadMonitoringData();
    } catch (err) {
      console.error("[SystemMonitoring] Error saving settings:", err);
    }
  };

  // Filtered files for File Registry
  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      if (selectedPortal !== "ALL" && f.portal !== selectedPortal) return false;
      if (selectedDocType !== "ALL" && f.documentType !== selectedDocType) return false;
      if (selectedStatus !== "ALL" && (f.status || "ACTIVE") !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = f.fileName && f.fileName.toLowerCase().includes(q);
        const matchesType = f.documentType && f.documentType.toLowerCase().includes(q);
        const matchesRecord = f.relatedRecordId && f.relatedRecordId.toLowerCase().includes(q);
        if (!matchesName && !matchesType && !matchesRecord) return false;
      }
      return true;
    }).sort((a, b) => {
      let valA = (a as any)[sortBy] ?? "";
      let valB = (b as any)[sortBy] ?? "";

      if (sortBy === "sizeBytes") {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [files, selectedPortal, selectedDocType, selectedStatus, searchQuery, sortBy, sortOrder]);

  // Largest active files
  const largestFiles = useMemo(() => {
    return files
      .filter((f) => (f.status || "ACTIVE") === "ACTIVE")
      .sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0))
      .slice(0, 10);
  }, [files]);

  const HealthIcon = overview ? healthBadgeMap[overview.healthStatus].icon : CheckCircle2;

  if (isLoading && !overview) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-zinc-100 flex items-center justify-center min-h-[160px] space-x-3">
        <div className="w-5 h-5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono font-semibold text-zinc-400 tracking-wide uppercase">
          Initializing Monitoring...
        </span>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-4 text-zinc-100 shadow-md font-sans w-full relative z-10 space-y-3">
      {/* Top Header - Compact Gray Theme */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2.5 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-1.5">
            <Server className="w-4 h-4 text-zinc-300 shrink-0" />
            <h2 className="text-sm sm:text-base font-bold tracking-tight text-zinc-100">
              System Resource & Storage Monitoring
            </h2>
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Real-time local database usage, persistent file storage, and portal health metrics
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleSyncFiles}
            disabled={isSyncing}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin text-zinc-300" : ""}`} />
            <span>{isSyncing ? "Syncing..." : "Recalculate & Sync"}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-100 border border-zinc-600 shadow-xs transition"
          >
            <Settings className="w-3 h-3" />
            <span>Thresholds</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition"
          >
            {isDetailsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <span>{isDetailsExpanded ? "Collapse" : "Expand"}</span>
          </button>
        </div>
      </div>

      {/* TOP SUMMARY CARDS - Compact Responsive Grid */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5">
          {/* Card 1: Storage Used */}
          <div className="bg-zinc-800/60 border border-zinc-700/80 rounded-lg p-2.5 sm:p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Storage</span>
              <HardDrive className="w-3.5 h-3.5 text-zinc-300" />
            </div>
            <div className="text-sm sm:text-base font-bold text-zinc-100 font-mono">
              {formatBytes(overview.totalStorageBytes)}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5 font-mono">
              Limit: {formatBytes(overview.storageLimitBytes)}
            </div>
            {/* Progress bar */}
            <div className="w-full bg-zinc-700 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  overview.storagePercentageUsed >= 95
                    ? "bg-rose-500"
                    : overview.storagePercentageUsed >= 85
                    ? "bg-orange-500"
                    : overview.storagePercentageUsed >= 70
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, overview.storagePercentageUsed)}%` }}
              />
            </div>
            <div className="text-[9px] font-bold text-right mt-1 font-mono text-zinc-400">
              {overview.storagePercentageUsed.toFixed(1)}% USED
            </div>
          </div>

          {/* Card 2: Total Files */}
          <div className="bg-zinc-800/60 border border-zinc-700/80 rounded-lg p-2.5 sm:p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Persistent Files</span>
              <FileText className="w-3.5 h-3.5 text-zinc-300" />
            </div>
            <div className="text-sm sm:text-base font-bold text-zinc-100 font-mono">
              {overview.activeFilesCount.toLocaleString()}
            </div>
            <div className="text-[10px] text-zinc-400 mt-1 truncate">
              Active ({overview.totalFilesCount} total)
            </div>
          </div>

          {/* Card 3: DB Reads */}
          <div className="bg-zinc-800/60 border border-zinc-700/80 rounded-lg p-2.5 sm:p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Database Reads</span>
              <Database className="w-3.5 h-3.5 text-zinc-300" />
            </div>
            <div className="text-sm sm:text-base font-bold text-zinc-100 font-mono">
              {overview.dbReadsToday.toLocaleString()}
            </div>
            <div className="text-[10px] text-zinc-400 mt-1">
              Today's Reads
            </div>
          </div>

          {/* Card 4: DB Writes */}
          <div className="bg-zinc-800/60 border border-zinc-700/80 rounded-lg p-2.5 sm:p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Database Writes</span>
              <Activity className="w-3.5 h-3.5 text-zinc-300" />
            </div>
            <div className="text-sm sm:text-base font-bold text-zinc-100 font-mono">
              {(overview.dbWritesToday + overview.dbUpdatesToday + overview.dbDeletesToday).toLocaleString()}
            </div>
            <div className="text-[10px] text-zinc-400 mt-1 truncate font-mono">
              C:{overview.dbWritesToday} U:{overview.dbUpdatesToday} D:{overview.dbDeletesToday}
            </div>
          </div>

          {/* Card 5: System Health */}
          <div className={`col-span-2 sm:col-span-1 border rounded-lg p-2.5 sm:p-3 ${healthBadgeMap[overview.healthStatus].bg} ${healthBadgeMap[overview.healthStatus].border}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300">System Health</span>
              <HealthIcon className={`w-3.5 h-3.5 ${healthBadgeMap[overview.healthStatus].text}`} />
            </div>
            <div className={`text-xs font-black uppercase tracking-wide mt-0.5 ${healthBadgeMap[overview.healthStatus].text}`}>
              {healthBadgeMap[overview.healthStatus].label}
            </div>
            <div className="text-[10px] text-zinc-400 mt-1 truncate font-mono">
              Warn {overview.thresholds.warningThresholdPct}% / Crit {overview.thresholds.criticalThresholdPct}%
            </div>
          </div>
        </div>
      )}

      {/* NAVIGATION TABS & DETAILS */}
      {isDetailsExpanded && (
        <>
          <div className="flex items-center gap-1 border-b border-zinc-800 overflow-x-auto pb-1 pt-1 scrollbar-none">
            {[
              { id: "overview", label: "Overview & Breakdowns", icon: Layers },
              { id: "registry", label: "File Registry", icon: FileText },
              { id: "database", label: "DB Operations", icon: Database },
              { id: "forecast", label: "Forecasting", icon: TrendingUp },
              { id: "history", label: "Usage Logs", icon: Clock }
            ].map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded transition whitespace-nowrap ${
                    isActive
                      ? "bg-zinc-700 text-zinc-100 border border-zinc-600 font-bold shadow-xs"
                      : "text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200 border border-transparent"
                  }`}
                >
                  <TabIcon className="w-3 h-3 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: OVERVIEW & BREAKDOWNS */}
          {activeTab === "overview" && overview && (
            <div className="space-y-3 pt-1">
              {/* PORTAL STORAGE SEPARATION */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* SMEI MANAGEMENT SYSTEM */}
                <div className="bg-zinc-800/50 border border-zinc-700/80 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-zinc-700/60">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      <h3 className="font-bold text-xs text-zinc-100 uppercase tracking-wider">
                        SMEI Management System
                      </h3>
                    </div>
                    <span className="text-[10px] font-bold text-zinc-400 font-mono">PORTAL 1</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-zinc-900/60 p-2 rounded border border-zinc-800">
                      <span className="text-[10px] text-zinc-400 font-semibold block">Storage Used</span>
                      <span className="text-sm font-bold font-mono text-zinc-100">
                        {formatBytes(overview.portalStats.smei.storageBytes)}
                      </span>
                    </div>
                    <div className="bg-zinc-900/60 p-2 rounded border border-zinc-800">
                      <span className="text-[10px] text-zinc-400 font-semibold block">Active Files</span>
                      <span className="text-sm font-bold font-mono text-zinc-200">
                        {overview.portalStats.smei.filesCount}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-zinc-400 font-semibold mb-0.5">
                      <span>Share of Total Storage</span>
                      <span className="font-mono font-bold text-zinc-300">
                        {overview.portalStats.smei.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-rose-500 h-full transition-all duration-300"
                        style={{ width: `${overview.portalStats.smei.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* TSD PORTAL */}
                <div className="bg-zinc-800/50 border border-zinc-700/80 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-zinc-700/60">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                      <h3 className="font-bold text-xs text-zinc-100 uppercase tracking-wider">
                        TSD Portal
                      </h3>
                    </div>
                    <span className="text-[10px] font-bold text-zinc-400 font-mono">PORTAL 2</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-zinc-900/60 p-2 rounded border border-zinc-800">
                      <span className="text-[10px] text-zinc-400 font-semibold block">Storage Used</span>
                      <span className="text-sm font-bold font-mono text-zinc-100">
                        {formatBytes(overview.portalStats.tsd.storageBytes)}
                      </span>
                    </div>
                    <div className="bg-zinc-900/60 p-2 rounded border border-zinc-800">
                      <span className="text-[10px] text-zinc-400 font-semibold block">Active Files</span>
                      <span className="text-sm font-bold font-mono text-zinc-200">
                        {overview.portalStats.tsd.filesCount}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-zinc-400 font-semibold mb-0.5">
                      <span>Share of Total Storage</span>
                      <span className="font-mono font-bold text-zinc-300">
                        {overview.portalStats.tsd.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-sky-500 h-full transition-all duration-300"
                        style={{ width: `${overview.portalStats.tsd.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* STORAGE BY DOCUMENT TYPE (PER-DOCUMENT TYPE INDEPENDENT COLLAPSE PANELS) */}
              <div className="bg-zinc-800/50 border border-zinc-700/80 rounded-lg p-3 space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-zinc-700/60">
                  <h3 className="font-bold text-xs text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                    <PieChart className="w-3.5 h-3.5 text-zinc-300" />
                    <span>Storage Usage by Document Type (Independent Panels)</span>
                  </h3>
                  <span className="text-[10px] text-zinc-400 font-semibold">
                    {overview.docTypeStats.length} Categories
                  </span>
                </div>

                <div className="space-y-1.5 pt-1">
                  {overview.docTypeStats.map((dt) => {
                    const isExpanded = !!expandedDocPanels[dt.documentType];
                    const categoryFiles = files.filter(f => f.documentType === dt.documentType);

                    return (
                      <div key={dt.documentType} className="border border-zinc-700/60 rounded-md overflow-hidden bg-zinc-900/60 transition-all">
                        {/* Header Bar - Toggle Panel */}
                        <button
                          onClick={() => toggleDocPanel(dt.documentType)}
                          className="w-full flex items-center justify-between p-2.5 text-left hover:bg-zinc-800/80 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-400 text-[10px] font-mono">
                              {isExpanded ? "▼" : "▶"}
                            </span>
                            <span className="font-bold text-xs text-zinc-200">
                              {dt.displayName}
                            </span>
                            <span className={`px-1.5 py-0.2 rounded font-bold text-[9px] ${
                              dt.portal === "TSD_PORTAL"
                                ? "bg-sky-950/80 text-sky-300 border border-sky-800/50"
                                : "bg-rose-950/80 text-rose-300 border border-rose-800/50"
                            }`}>
                              {dt.portal === "TSD_PORTAL" ? "TSD" : "SMEI"}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] font-mono">
                            <span className="text-zinc-400 font-semibold">
                              {dt.fileCount} {dt.fileCount === 1 ? "file" : "files"}
                            </span>
                            <span className="font-bold text-zinc-100">
                              {formatBytes(dt.sizeBytes)}
                            </span>
                            <span className="text-zinc-400 text-[10px]">
                              ({dt.percentageOfTotal.toFixed(1)}%)
                            </span>
                          </div>
                        </button>

                        {/* Collapsible Body */}
                        {isExpanded && (
                          <div className="p-2.5 border-t border-zinc-800 bg-zinc-950/50 space-y-2">
                            {categoryFiles.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-[10px] text-left text-zinc-300">
                                  <thead className="bg-zinc-800/80 text-zinc-400 uppercase font-bold text-[8px] border-b border-zinc-700">
                                    <tr>
                                      <th className="p-1">Filename</th>
                                      <th className="p-1">Size</th>
                                      <th className="p-1">Status</th>
                                      <th className="p-1">Created Date</th>
                                      <th className="p-1 text-center">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-800/60">
                                    {categoryFiles.map((f) => (
                                      <tr key={f.id} className="hover:bg-zinc-800/40 font-mono">
                                        <td className="p-1 truncate max-w-[200px] text-zinc-200 font-semibold" title={f.originalName}>
                                          {f.originalName}
                                        </td>
                                        <td className="p-1 text-zinc-300">{formatBytes(f.fileSizeBytes)}</td>
                                        <td className="p-1">
                                          <span className="text-emerald-400 bg-emerald-950/50 px-1 py-0.2 rounded text-[8px] font-bold">
                                            {f.status}
                                          </span>
                                        </td>
                                        <td className="p-1 text-zinc-400">
                                          {new Date(f.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="p-1 text-center">
                                          <button
                                            onClick={() => setSelectedFileDetail(f)}
                                            className="text-sky-400 hover:underline text-[9px]"
                                          >
                                            View
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="text-center py-2 text-[10px] text-zinc-500 font-mono">
                                No active registered files for {dt.displayName}.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* TOP 10 LARGEST FILES */}
              <div className="bg-zinc-800/50 border border-zinc-700/80 rounded-lg p-3 space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-zinc-700/60">
                  <h3 className="font-bold text-xs text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-zinc-300" />
                    <span>Largest Active Persistent Files</span>
                  </h3>
                  <span className="text-[10px] text-zinc-400 font-semibold">Top 10 Storage Consumers</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] text-left text-zinc-300">
                    <thead className="bg-zinc-800 text-zinc-400 uppercase text-[9px] font-bold border-b border-zinc-700">
                      <tr>
                        <th className="p-1.5">File Name</th>
                        <th className="p-1.5">Portal</th>
                        <th className="p-1.5">Document Type</th>
                        <th className="p-1.5 text-right">Size</th>
                        <th className="p-1.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {largestFiles.map((file) => (
                        <tr key={file.id} className="hover:bg-zinc-800/60 transition">
                          <td className="p-1.5 font-bold font-mono text-zinc-100 max-w-xs truncate">
                            {file.fileName}
                          </td>
                          <td className="p-1.5 font-mono text-[9px]">
                            <span className={`px-1.5 py-0.5 rounded font-bold ${
                              file.portal === "TSD_PORTAL"
                                ? "bg-sky-950/80 text-sky-300 border border-sky-800/50"
                                : "bg-rose-950/80 text-rose-300 border border-rose-800/50"
                            }`}>
                              {file.portal === "TSD_PORTAL" ? "TSD" : "SMEI"}
                            </span>
                          </td>
                          <td className="p-1.5 font-mono text-[10px] text-zinc-400">
                            {file.documentType}
                          </td>
                          <td className="p-1.5 text-right font-mono font-bold text-zinc-100">
                            {formatBytes(file.sizeBytes)}
                          </td>
                          <td className="p-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedFileDetail(file)}
                              className="p-1 text-zinc-400 hover:text-zinc-100 transition"
                              title="View File Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {largestFiles.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-3 text-center text-zinc-500 italic">
                            No active persistent files recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FILE REGISTRY */}
          {activeTab === "registry" && (
            <div className="bg-zinc-800/50 border border-zinc-700/80 rounded-lg p-3 space-y-3 pt-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-2 border-b border-zinc-700/60">
                <h3 className="font-bold text-xs text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-zinc-300" />
                  <span>Central File Registry ({filteredFiles.length})</span>
                </h3>

                {/* FILTERS */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  {/* Search */}
                  <div className="relative">
                    <Search className="w-3 h-3 absolute left-2 top-2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search file name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-7 pr-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-zinc-100 placeholder-zinc-500 outline-none focus:border-zinc-500"
                    />
                  </div>

                  {/* Portal filter */}
                  <select
                    value={selectedPortal}
                    onChange={(e) => setSelectedPortal(e.target.value)}
                    className="p-1 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-zinc-200 font-semibold outline-none focus:border-zinc-500"
                  >
                    <option value="ALL">All Portals</option>
                    <option value="SMEI_MANAGEMENT_SYSTEM">SMEI System</option>
                    <option value="TSD_PORTAL">TSD Portal</option>
                  </select>

                  {/* Document Type filter */}
                  <select
                    value={selectedDocType}
                    onChange={(e) => setSelectedDocType(e.target.value)}
                    className="p-1 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-zinc-200 font-semibold outline-none focus:border-zinc-500 max-w-[150px] truncate"
                  >
                    <option value="ALL">All Doc Types</option>
                    <option value="PURCHASE_ORDER">Purchase Orders</option>
                    <option value="PIS">PIS</option>
                    <option value="RFS">RFS</option>
                    <option value="CANVASS_SHEET">Canvass Sheets</option>
                    <option value="TSD_CONTROL_NUMBER">TSD Control No.</option>
                    <option value="TSD_LOADING">TSD Loading</option>
                    <option value="TSD_UNLOADING">TSD Unloading</option>
                    <option value="TSD_HAZARDOUS_WASTE">TSD Haz Waste</option>
                    <option value="TSD_WASTE_MOVEMENT_SOURCE_PDF">TSD WM Source PDF</option>
                    <option value="TSD_WASTE_MOVEMENT_GENERATED_FILE">TSD WM Generated</option>
                    <option value="TSD_WASTE_MOVEMENT_MERGED_FILE">TSD WM Merged</option>
                    <option value="TSD_TIMESTAMP_IMAGE">TSD Timestamp Photo</option>
                    <option value="TSD_MANIFEST_SUMMARY">TSD Manifest</option>
                  </select>

                  {/* Status Filter */}
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="p-1 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-zinc-200 font-semibold outline-none focus:border-zinc-500"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="TEMPORARY">Temporary</option>
                    <option value="DELETED">Deleted</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>

                  {/* Sorting */}
                  <button
                    type="button"
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                    className="p-1 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-300 font-bold flex items-center gap-1 hover:bg-zinc-700"
                    title={`Sort ${sortOrder === "asc" ? "Ascending" : "Descending"}`}
                  >
                    <ArrowUpDown className="w-3 h-3" />
                    <span className="uppercase">{sortOrder}</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-left text-zinc-300">
                  <thead className="bg-zinc-800 text-zinc-400 uppercase text-[9px] font-bold border-b border-zinc-700">
                    <tr>
                      <th className="p-1.5">File Name</th>
                      <th className="p-1.5">Portal</th>
                      <th className="p-1.5">Type</th>
                      <th className="p-1.5 text-right">Size</th>
                      <th className="p-1.5 text-center">Status</th>
                      <th className="p-1.5">Created</th>
                      <th className="p-1.5">Uploaded By</th>
                      <th className="p-1.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {filteredFiles.map((file) => (
                      <tr key={file.id} className="hover:bg-zinc-800/60 transition">
                        <td className="p-1.5 font-bold font-mono text-zinc-100 max-w-[180px] truncate">
                          {file.fileName}
                        </td>
                        <td className="p-1.5 font-mono text-[9px]">
                          <span className={`px-1.5 py-0.5 rounded font-bold ${
                            file.portal === "TSD_PORTAL"
                              ? "bg-sky-950/80 text-sky-300 border border-sky-800/50"
                              : "bg-rose-950/80 text-rose-300 border border-rose-800/50"
                          }`}>
                            {file.portal === "TSD_PORTAL" ? "TSD" : "SMEI"}
                          </span>
                        </td>
                        <td className="p-1.5 font-mono text-[10px] text-zinc-400 max-w-[120px] truncate">
                          {file.documentType}
                        </td>
                        <td className="p-1.5 text-right font-mono font-bold text-zinc-100">
                          {formatBytes(file.sizeBytes)}
                        </td>
                        <td className="p-1.5 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            file.status === "ACTIVE"
                              ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/50"
                              : file.status === "TEMPORARY"
                              ? "bg-amber-950/80 text-amber-300 border border-amber-800/50"
                              : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                          }`}>
                            {file.status || "ACTIVE"}
                          </span>
                        </td>
                        <td className="p-1.5 text-[10px] text-zinc-400 font-mono whitespace-nowrap">
                          {new Date(file.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-1.5 text-[10px] text-zinc-300 truncate max-w-[100px]">
                          {file.uploadedBy || "System User"}
                        </td>
                        <td className="p-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedFileDetail(file)}
                            className="p-1 text-zinc-400 hover:text-zinc-100 transition"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredFiles.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-4 text-center text-zinc-500 italic">
                          No files match the specified filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: DATABASE OPERATIONS */}
          {activeTab === "database" && overview && (
            <div className="bg-zinc-800/50 border border-zinc-700/80 rounded-lg p-3 space-y-2.5 pt-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-zinc-700/60">
                <h3 className="font-bold text-xs text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-zinc-300" />
                  <span>Local Database Operations Log (Today's Activity)</span>
                </h3>
                <span className="text-[10px] font-mono text-zinc-400">
                  {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-left text-zinc-300">
                  <thead className="bg-zinc-800 text-zinc-400 uppercase text-[9px] font-bold border-b border-zinc-700">
                    <tr>
                      <th className="p-1.5">Module Name</th>
                      <th className="p-1.5">Portal</th>
                      <th className="p-1.5 text-center text-emerald-400">Reads</th>
                      <th className="p-1.5 text-center text-amber-400">Creates</th>
                      <th className="p-1.5 text-center text-sky-400">Updates</th>
                      <th className="p-1.5 text-center text-rose-400">Deletes</th>
                      <th className="p-1.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {overview.dbOperationStats.map((op) => (
                      <tr key={`${op.portal}:${op.module}`} className="hover:bg-zinc-800/60 transition">
                        <td className="p-1.5 font-bold font-mono text-zinc-100">
                          {op.module}
                        </td>
                        <td className="p-1.5 font-mono text-[9px]">
                          <span className={`px-1.5 py-0.5 rounded font-bold ${
                            op.portal === "TSD_PORTAL"
                              ? "bg-sky-950/80 text-sky-300 border border-sky-800/50"
                              : "bg-rose-950/80 text-rose-300 border border-rose-800/50"
                          }`}>
                            {op.portal === "TSD_PORTAL" ? "TSD" : "SMEI"}
                          </span>
                        </td>
                        <td className="p-1.5 text-center font-mono font-bold text-emerald-400">
                          {op.reads}
                        </td>
                        <td className="p-1.5 text-center font-mono font-bold text-amber-400">
                          {op.creates}
                        </td>
                        <td className="p-1.5 text-center font-mono font-bold text-sky-400">
                          {op.updates}
                        </td>
                        <td className="p-1.5 text-center font-mono font-bold text-rose-400">
                          {op.deletes}
                        </td>
                        <td className="p-1.5 text-right font-mono font-bold text-zinc-100">
                          {op.totalOperations}
                        </td>
                      </tr>
                    ))}
                    {overview.dbOperationStats.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-zinc-500 italic">
                          No database operations recorded for today yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: FORECASTING */}
          {activeTab === "forecast" && (
            <div className="bg-zinc-800/50 border border-zinc-700/80 rounded-lg p-3 space-y-3 pt-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-zinc-700/60">
                <h3 className="font-bold text-xs text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-zinc-300" />
                  <span>Storage Growth Forecasting Engine</span>
                </h3>
                <span className="text-[10px] font-mono text-zinc-400">Linear Trend Projection</span>
              </div>

              {forecastData && forecastData.hasSufficientData ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="bg-zinc-900/60 p-2.5 rounded border border-zinc-800 space-y-0.5">
                      <span className="text-[10px] text-zinc-400 font-semibold block uppercase">Average Daily Growth</span>
                      <span className="text-base font-bold font-mono text-zinc-100">
                        {formatBytes(forecastData.avgDailyGrowthBytes)} / day
                      </span>
                      <span className="text-[9px] text-zinc-500 block font-mono">
                        Across {forecastData.observedDays} observed days
                      </span>
                    </div>

                    <div className="bg-zinc-900/60 p-2.5 rounded border border-zinc-800 space-y-0.5">
                      <span className="text-[10px] text-zinc-400 font-semibold block uppercase">Projected 30-Day Growth</span>
                      <span className="text-base font-bold font-mono text-zinc-100">
                        {formatBytes(forecastData.estimatedGrowth30DaysBytes)}
                      </span>
                      <span className="text-[9px] text-zinc-500 block">Est. total storage after 30 days</span>
                    </div>

                    <div className="bg-zinc-900/60 p-2.5 rounded border border-zinc-800 space-y-0.5">
                      <span className="text-[10px] text-zinc-400 font-semibold block uppercase">Estimated Days to Limit</span>
                      <span className="text-base font-bold font-mono text-sky-400">
                        {forecastData.estimatedDaysToLimit ? `${forecastData.estimatedDaysToLimit} Days` : "Stable"}
                      </span>
                      <span className="text-[9px] text-zinc-500 block">Based on configured ceiling</span>
                    </div>
                  </div>

                  <div className="bg-zinc-900/80 border border-zinc-700/80 rounded p-2.5 text-[11px] text-zinc-300 flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block mb-0.5 text-zinc-200">Forecast Disclaimer:</span>
                      <p className="text-zinc-400 text-[10px]">{forecastData.disclaimer}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center space-y-2 bg-zinc-900/40 rounded border border-dashed border-zinc-700">
                  <Clock className="w-6 h-6 text-zinc-500 mx-auto" />
                  <h4 className="font-bold text-xs text-zinc-300">
                    Insufficient Historical Data for Forecasting
                  </h4>
                  <p className="text-[11px] text-zinc-400 max-w-md mx-auto">
                    {forecastData?.message || "The forecasting engine requires at least 2 consecutive daily monitoring snapshots to calculate accurate growth trends."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: USAGE HISTORY LOGS */}
          {activeTab === "history" && (
            <div className="bg-zinc-800/50 border border-zinc-700/80 rounded-lg p-3 space-y-2.5 pt-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-zinc-700/60">
                <h3 className="font-bold text-xs text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-zinc-300" />
                  <span>Historical Daily Monitoring Snapshots ({historyData.snapshots.length})</span>
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-left text-zinc-300">
                  <thead className="bg-zinc-800 text-zinc-400 uppercase text-[9px] font-bold border-b border-zinc-700">
                    <tr>
                      <th className="p-1.5">Snapshot Date</th>
                      <th className="p-1.5 text-right">Total Storage</th>
                      <th className="p-1.5 text-center">Active Files</th>
                      <th className="p-1.5 text-right">SMEI Storage</th>
                      <th className="p-1.5 text-right">TSD Storage</th>
                      <th className="p-1.5 text-center">DB Reads</th>
                      <th className="p-1.5 text-center">DB Creates</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {historyData.snapshots.map((snap) => (
                      <tr key={snap.id || snap.date} className="hover:bg-zinc-800/60 transition">
                        <td className="p-1.5 font-bold font-mono text-zinc-100">
                          {snap.date}
                        </td>
                        <td className="p-1.5 text-right font-mono font-bold text-zinc-100">
                          {formatBytes(snap.totalStorageBytes)}
                        </td>
                        <td className="p-1.5 text-center font-mono font-bold">
                          {snap.totalFilesCount}
                        </td>
                        <td className="p-1.5 text-right font-mono text-zinc-400">
                          {formatBytes(snap.smeiStorageBytes)}
                        </td>
                        <td className="p-1.5 text-right font-mono text-zinc-400">
                          {formatBytes(snap.tsdStorageBytes)}
                        </td>
                        <td className="p-1.5 text-center font-mono text-emerald-400 font-bold">
                          {snap.dbReads}
                        </td>
                        <td className="p-1.5 text-center font-mono text-amber-400 font-bold">
                          {snap.dbCreates}
                        </td>
                      </tr>
                    ))}
                    {historyData.snapshots.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-zinc-500 italic">
                          No historical snapshots logged yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* FILE DETAIL VIEW MODAL */}
          {selectedFileDetail && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3">
              <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-md w-full p-4 shadow-2xl space-y-3 text-zinc-100 animate-in fade-in zoom-in duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-zinc-300" />
                    <h3 className="font-bold text-xs text-zinc-100 truncate max-w-[280px]">
                      File: {selectedFileDetail.fileName}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFileDetail(null)}
                    className="text-zinc-400 hover:text-zinc-200 font-bold text-sm"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="space-y-0.5">
                    <span className="text-zinc-500 font-semibold block">File Name</span>
                    <span className="font-mono font-bold text-zinc-100 break-all text-[10px]">
                      {selectedFileDetail.fileName}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-zinc-500 font-semibold block">Portal</span>
                    <span className={`inline-block px-1.5 py-0.5 rounded font-bold font-mono text-[9px] ${
                      selectedFileDetail.portal === "TSD_PORTAL"
                        ? "bg-sky-950/80 text-sky-300 border border-sky-800/50"
                        : "bg-rose-950/80 text-rose-300 border border-rose-800/50"
                    }`}>
                      {selectedFileDetail.portal}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-zinc-500 font-semibold block">Document Type</span>
                    <span className="font-mono font-bold text-zinc-200">
                      {selectedFileDetail.documentType}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-zinc-500 font-semibold block">File Size</span>
                    <span className="font-mono font-bold text-zinc-100">
                      {formatBytes(selectedFileDetail.sizeBytes)}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-zinc-500 font-semibold block">MIME Type</span>
                    <span className="font-mono text-zinc-300 text-[10px]">
                      {selectedFileDetail.mimeType || "application/octet-stream"}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-zinc-500 font-semibold block">Status</span>
                    <span className="font-bold font-mono uppercase text-emerald-400 text-[10px]">
                      {selectedFileDetail.status || "ACTIVE"}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-zinc-500 font-semibold block">Created Date</span>
                    <span className="font-mono text-zinc-300 text-[10px]">
                      {new Date(selectedFileDetail.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-zinc-500 font-semibold block">Uploaded By</span>
                    <span className="font-semibold text-zinc-300 text-[10px]">
                      {selectedFileDetail.uploadedBy || "System User"}
                    </span>
                  </div>
                </div>

                <div className="p-2 bg-zinc-800/80 rounded border border-zinc-700/80 text-[10px] font-mono space-y-0.5">
                  <span className="text-zinc-400 font-semibold block">Storage Path Location</span>
                  <span className="text-zinc-300 break-all">
                    {selectedFileDetail.storagePath}
                  </span>
                </div>

                {/* Waste Movement Relationship Chain Visualizer */}
                {selectedFileDetail.portal === "TSD_PORTAL" && selectedFileDetail.documentType.startsWith("TSD_WASTE_MOVEMENT") && (
                  <div className="p-2 bg-zinc-800/80 border border-zinc-700 rounded text-[10px] space-y-1">
                    <span className="font-bold text-zinc-300 block uppercase tracking-wide text-[9px]">
                      Waste Movement Workflow Chain
                    </span>
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-300">
                      <span className={`px-1 py-0.5 rounded ${selectedFileDetail.documentType === "TSD_WASTE_MOVEMENT_SOURCE_PDF" ? "bg-zinc-700 text-zinc-100 font-bold border border-zinc-500" : "bg-zinc-900 text-zinc-400"}`}>
                        Source PDF
                      </span>
                      <span>→</span>
                      <span className={`px-1 py-0.5 rounded ${selectedFileDetail.documentType === "TSD_WASTE_MOVEMENT_GENERATED_FILE" ? "bg-zinc-700 text-zinc-100 font-bold border border-zinc-500" : "bg-zinc-900 text-zinc-400"}`}>
                        Generated
                      </span>
                      <span>→</span>
                      <span className={`px-1 py-0.5 rounded ${selectedFileDetail.documentType === "TSD_WASTE_MOVEMENT_MERGED_FILE" ? "bg-zinc-700 text-zinc-100 font-bold border border-zinc-500" : "bg-zinc-900 text-zinc-400"}`}>
                        Merged Output
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setSelectedFileDetail(null)}
                    className="px-3 py-1 text-[11px] font-bold rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* THRESHOLD SETTINGS MODAL */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3">
          <form onSubmit={handleSaveSettings} className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-sm w-full p-4 shadow-2xl space-y-3 text-zinc-100">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-zinc-300" />
                <h3 className="font-bold text-xs text-zinc-100">
                  Configure Resource Thresholds
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-[11px]">
              <div>
                <label className="block font-bold text-zinc-300 mb-0.5">
                  Local Storage Limit Ceiling (GB)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="100"
                  value={settingsForm.storageLimitBytes / (1024 * 1024 * 1024)}
                  onChange={(e) => setSettingsForm({
                    ...settingsForm,
                    storageLimitBytes: parseFloat(e.target.value || "5") * 1024 * 1024 * 1024
                  })}
                  className="w-full p-1.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-100 font-mono text-[11px] outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block font-bold text-amber-400 mb-0.5">
                  Warning Threshold (%)
                </label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={settingsForm.warningThresholdPct}
                  onChange={(e) => setSettingsForm({
                    ...settingsForm,
                    warningThresholdPct: parseInt(e.target.value || "70")
                  })}
                  className="w-full p-1.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-100 font-mono text-[11px] outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block font-bold text-orange-400 mb-0.5">
                  Critical Threshold (%)
                </label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={settingsForm.criticalThresholdPct}
                  onChange={(e) => setSettingsForm({
                    ...settingsForm,
                    criticalThresholdPct: parseInt(e.target.value || "85")
                  })}
                  className="w-full p-1.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-100 font-mono text-[11px] outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block font-bold text-rose-400 mb-0.5">
                  Extreme Threshold (%)
                </label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={settingsForm.extremeThresholdPct}
                  onChange={(e) => setSettingsForm({
                    ...settingsForm,
                    extremeThresholdPct: parseInt(e.target.value || "95")
                  })}
                  className="w-full p-1.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-100 font-mono text-[11px] outline-none focus:border-zinc-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-1.5 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="px-2.5 py-1 text-[11px] font-semibold rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 text-[11px] font-bold rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-100 border border-zinc-600"
              >
                Save Thresholds
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
