import React, { useState } from 'react';
import { ShieldCheck, Search, Database, Terminal, RefreshCw } from 'lucide-react';
import { AuditLog } from '../types';

interface AuditLogsProps {
  auditLogs: AuditLog[];
  isAdmin?: boolean;
  onClearLogs?: () => void;
}

export default function AuditLogs({ auditLogs, isAdmin, onClearLogs }: AuditLogsProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const logs = auditLogs || [];

  const filteredLogs = logs.filter(log => {
    const term = searchTerm.toLowerCase();
    const logDetails = log.details || `Changed from "${log.oldValue || 'none'}" to "${log.newValue || 'none'}" (IP: ${log.ipAddress || 'unknown'})`;
    const logTargetId = log.targetId || "";
    return (
      log.username.toLowerCase().includes(term) ||
      log.action.toLowerCase().includes(term) ||
      logTargetId.toLowerCase().includes(term) ||
      logDetails.toLowerCase().includes(term)
    );
  });

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Admin':
      case 'Administrator':
        return 'text-rose-400 bg-rose-950/40 border-rose-800/30';
      case 'Manager':
        return 'text-amber-400 bg-amber-950/40 border-amber-800/30';
      case 'Procurement':
        return 'text-emerald-400 bg-emerald-950/40 border-emerald-800/30';
      default:
        return 'text-blue-400 bg-blue-950/40 border-blue-800/30';
    }
  };

  const formatTimestamp = (isoString: string) => {
    try {
      if (!isoString) return "";
      const d = new Date(isoString);
      if (isNaN(d.getTime())) {
        return isoString;
      }
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    } catch {
      return isoString;
    }
  };

  return (
    <div id="logs-section" className="space-y-6 font-mono text-xs">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <h1 className="text-3xl font-display font-bold text-neutral-100 tracking-tight font-sans">Compliance & Audit Trail</h1>
          <p className="text-sm text-neutral-400 mt-1 font-mono">
            Unalterable system logs tracking procurement delegation, approvals, and contract exports
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && onClearLogs && (
            <button
              onClick={onClearLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/30 border border-rose-800/40 hover:bg-rose-900/40 text-rose-400 rounded-lg font-bold font-mono text-[10px] uppercase tracking-wider transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Clear System Logs
            </button>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/30 border border-emerald-800/20 text-emerald-400 rounded-lg font-bold font-mono text-[10px] uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" /> Integrity Secure
          </div>
        </div>
      </div>

      {/* Terminal Board Panel */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="bg-neutral-900 px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-neutral-500" />
            <span className="text-[10px] uppercase font-bold text-neutral-300 tracking-wider">SMEI-POMS Secure Ledger</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-neutral-500">
            <Database className="w-3.5 h-3.5" /> Indexed
          </div>
        </div>

        {/* Filter bar inside terminal */}
        <div className="p-4 border-b border-neutral-800 bg-neutral-950/50 flex items-center relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="FILTER LEDGER BY OPERATOR, TARGET ID OR OPERATION CODE (e.g. Approved, PO-2026-001)..."
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2.5 pl-10 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-700"
          />
          <Search className="absolute left-7 top-7 w-4 h-4 text-neutral-600" />
        </div>

        {/* Console Log Area */}
        <div className="p-6 bg-neutral-950 divide-y divide-neutral-900/60 max-h-[500px] overflow-y-auto font-mono scrollbar-thin scrollbar-thumb-neutral-800">
          {filteredLogs.map(log => {
            const timestamp = log.timestamp || `${log.date}T${log.time}`;
            const logDetails = log.details || `Changed from "${log.oldValue || 'none'}" to "${log.newValue || 'none'}" (IP: ${log.ipAddress || 'unknown'})`;
            const logTargetId = log.targetId || "";
            return (
              <div key={log.id} className="py-3 flex flex-col md:flex-row md:items-center gap-3 md:gap-4 hover:bg-neutral-900/20 transition-all px-2 rounded">
                {/* Date Column */}
                <span className="text-neutral-500 select-none md:w-44 shrink-0 font-medium text-[11px]">
                  [{formatTimestamp(timestamp)}]
                </span>

                {/* Operator */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-neutral-300 font-bold font-sans">{log.username}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border tracking-tight ${getRoleColor(log.role)}`}>
                    {log.role}
                  </span>
                </div>

                {/* Action */}
                <div className="flex items-center gap-2 text-neutral-100 font-semibold shrink-0">
                  <span className="text-neutral-500 font-normal">→</span>
                  <span>{log.action}</span>
                  {logTargetId && (
                    <span className="px-1.5 py-0.5 bg-smei-darkred/20 text-smei-lightred rounded font-mono font-bold text-[10px]">
                      {logTargetId}
                    </span>
                  )}
                </div>

                {/* Detail message */}
                <p className="text-neutral-400 mt-1 md:mt-0 font-normal border-l md:border-l-0 pl-3 md:pl-0 border-neutral-800 truncate">
                  {logDetails}
                </p>
              </div>
            );
          })}

          {filteredLogs.length === 0 && (
            <div className="py-16 text-center text-neutral-600">
              [ NO MATCHING RECORD FOUND IN INTEGRITY LEDGER ]
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
