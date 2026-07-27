/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Notification, User } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { Bell, Check, X, Clipboard, ArrowRight, MessageSquare, AlertCircle } from "lucide-react";

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  currentUser: User;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onSelectPO: (poId: string) => void;
}

export default function NotificationsPanel({
  isOpen,
  onClose,
  notifications,
  currentUser,
  onMarkAsRead,
  onMarkAllAsRead,
  onSelectPO
}: NotificationsPanelProps) {
  // Filter notifications relevant to this specific role or user
  const relevantNotifications = notifications.filter(
    (n) => n.role === currentUser.role
  ).reverse(); // latest first

  const unreadCount = relevantNotifications.filter((n) => !n.isRead).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-40 no-print"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-2xl z-50 p-6 overflow-y-auto border-l border-gray-100 flex flex-col justify-between no-print"
          >
            <div>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-5">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Bell className="w-5 h-5 text-smei-crimson" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-500 rounded-full border border-white" />
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 font-display">System Notifications</h3>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mark All as Read Button */}
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllAsRead}
                  className="w-full mb-4 text-xs font-bold text-smei-crimson hover:text-smei-darkred text-right flex items-center justify-end gap-1.5 hover:underline"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Mark all as read for {currentUser.role}</span>
                </button>
              )}

              {/* Notification List */}
              <div className="space-y-3">
                {relevantNotifications.length > 0 ? (
                  relevantNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        if (notif.poId) {
                          onSelectPO(notif.poId);
                          onClose();
                        }
                        onMarkAsRead(notif.id);
                      }}
                      className={`p-4 rounded-xl border transition-all cursor-pointer hover:border-smei-lightred/40 hover:bg-red-50/10 flex items-start gap-3 relative overflow-hidden group ${
                        notif.isRead
                          ? "bg-white border-gray-100 text-gray-500"
                          : "bg-red-50/30 border-red-100/50 text-gray-800"
                      }`}
                    >
                      {/* Left color bar for unread notifications */}
                      {!notif.isRead && (
                        <span className="absolute left-0 top-0 bottom-0 w-1 bg-smei-crimson" />
                      )}

                      <div className={`p-2 rounded-lg ${notif.isRead ? "bg-gray-100" : "bg-red-50"} shrink-0`}>
                        <Clipboard className={`w-4 h-4 ${notif.isRead ? "text-gray-400" : "text-smei-crimson"}`} />
                      </div>

                      <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className={`text-xs font-bold leading-tight ${notif.isRead ? "text-gray-700" : "text-gray-900"}`}>
                            {notif.title}
                          </h4>
                          {!notif.isRead && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onMarkAsRead(notif.id);
                              }}
                              className="text-[10px] text-gray-400 hover:text-smei-crimson font-bold"
                              title="Mark read"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] leading-relaxed text-gray-600">
                          {notif.message}
                        </p>
                        <div className="flex items-center justify-between text-[9px] text-gray-400 font-mono mt-1 pt-1 border-t border-gray-100/40">
                          <span>{notif.date} • {notif.time}</span>
                          {notif.poId && (
                            <span className="text-smei-crimson font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                              <span>Action PO</span>
                              <ArrowRight className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-gray-400 font-sans space-y-2">
                    <AlertCircle className="w-8 h-8 text-gray-200 mx-auto" />
                    <p className="text-xs">No pending notifications for your clearance.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer details */}
            <div className="border-t border-gray-100 pt-4 text-center mt-6">
              <span className="text-[10px] text-gray-400 font-mono">
                SMEI Real-Time Activity Alert Dispatcher
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
