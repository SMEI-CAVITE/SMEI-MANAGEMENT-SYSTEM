/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { getAppUrl } from "../config/env";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, 
  User as UserIcon, 
  Upload, 
  Trash2, 
  Lock, 
  Mail, 
  Phone, 
  Briefcase, 
  Building2, 
  Bell, 
  UserCheck, 
  ShieldCheck, 
  KeyRound,
  Eye,
  EyeOff,
  Settings,
  Globe
} from "lucide-react";
import { User } from "../types";
import { api } from "../lib/api";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUpdateCurrentUser: (user: User) => void;
  initialTab?: "profile" | "settings" | "password";
}

export default function ProfileModal({
  isOpen,
  onClose,
  currentUser,
  onUpdateCurrentUser,
  initialTab = "profile"
}: ProfileModalProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "settings" | "password">(initialTab);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Profile fields state
  const fullNameParts = currentUser.fullName.split(" ");
  const [firstName, setFirstName] = useState(fullNameParts[0] || "");
  const [lastName, setLastName] = useState(fullNameParts.slice(1).join(" ") || "");
  const [email, setEmail] = useState(currentUser.email || "");
  const [phoneNumber, setPhoneNumber] = useState(currentUser.phone_number || "");
  const [department, setDepartment] = useState(currentUser.department || "");
  const [position, setPosition] = useState(currentUser.position || "");

  // Settings state
  const [username, setUsername] = useState(currentUser.username || "");
  const [notifyEmail, setNotifyEmail] = useState(currentUser.notificationPreferences?.email ?? true);
  const [notifySystem, setNotifySystem] = useState(currentUser.notificationPreferences?.system ?? true);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Avatar upload states
  const [avatarPreview, setAvatarPreview] = useState<string | null>(currentUser.avatarUrl || null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Staged / pending changes to avatar
  const [pendingAvatar, setPendingAvatar] = useState<string | null | undefined>(undefined);

  // Reset form states and sync with latest currentUser when modal opens or currentUser updates
  useEffect(() => {
    if (isOpen && currentUser) {
      const parts = currentUser.fullName.split(" ");
      setFirstName(parts[0] || "");
      setLastName(parts.slice(1).join(" ") || "");
      setEmail(currentUser.email || "");
      setPhoneNumber(currentUser.phone_number || "");
      setDepartment(currentUser.department || "");
      setPosition(currentUser.position || "");
      setUsername(currentUser.username || "");
      setNotifyEmail(currentUser.notificationPreferences?.email ?? true);
      setNotifySystem(currentUser.notificationPreferences?.system ?? true);
      setAvatarPreview(currentUser.avatarUrl || null);
      setPendingAvatar(undefined);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFormErrors({});
    }
  }, [isOpen, currentUser]);

  // Unsaved changes tracking effect
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    
    const initialParts = currentUser.fullName.split(" ");
    const initialFirstName = initialParts[0] || "";
    const initialLastName = initialParts.slice(1).join(" ") || "";
    const initialEmail = currentUser.email || "";
    const initialPhone = currentUser.phone_number || "";
    const initialPosition = currentUser.position || "";
    const initialNotifyEmail = currentUser.notificationPreferences?.email ?? true;
    const initialNotifySystem = currentUser.notificationPreferences?.system ?? true;

    const hasProfileChanges = 
      firstName !== initialFirstName ||
      lastName !== initialLastName ||
      email !== initialEmail ||
      phoneNumber !== initialPhone ||
      position !== initialPosition ||
      notifyEmail !== initialNotifyEmail ||
      notifySystem !== initialNotifySystem ||
      pendingAvatar !== undefined;

    const hasPasswordChanges = 
      currentPassword !== "" ||
      newPassword !== "" ||
      confirmPassword !== "";

    window.smeiHasUnsavedChanges = hasProfileChanges || hasPasswordChanges;

    return () => {
      window.smeiHasUnsavedChanges = false;
    };
  }, [
    isOpen,
    currentUser,
    firstName,
    lastName,
    email,
    phoneNumber,
    position,
    notifyEmail,
    notifySystem,
    pendingAvatar,
    currentPassword,
    newPassword,
    confirmPassword
  ]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (window.smeiHasUnsavedChanges) {
      const confirmDiscard = window.confirm("You have unsaved changes. Are you sure you want to discard them and close the profile modal?");
      if (!confirmDiscard) return;
    }
    window.smeiHasUnsavedChanges = false;
    onClose();
  };

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Avatar file handlers - Local preview & stage changes without API updates
  const handleFile = (file: File) => {
    if (!file) return;

    // Type & Extension validation
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const allowedExtensions = ["jpg", "jpeg", "png", "webp"];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
      showToast("Only JPG, JPEG, PNG, and WEBP files are supported.", "error");
      return;
    }

    // Size validation (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast("File size exceeds 5MB limit.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target?.result as string;
      setAvatarPreview(base64Data);
      setPendingAvatar(base64Data);
      showToast("New profile picture selected! Save profile to apply changes.", "success");
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    setPendingAvatar(null);
    showToast("Profile picture flagged for removal! Save profile to apply changes.", "success");
  };

  // Submit profile details tab
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const newErrors: Record<string, string> = {};
    if (!firstName.trim()) newErrors.firstName = "First Name is required.";
    if (!lastName.trim()) newErrors.lastName = "Last Name is required.";

    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      return;
    }

    try {
      setIsSaving(true);
      
      let finalAvatarUrl = currentUser.avatarUrl;
      let finalProfileImage = currentUser.profile_image;

      // Commit pending avatar changes if any
      if (pendingAvatar !== undefined) {
        const avatarRes = await api.updateAvatar(pendingAvatar);
        finalAvatarUrl = avatarRes.avatarUrl;
        finalProfileImage = avatarRes.profile_image;
      }

      const res = await api.updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
        department,
        position: position.trim()
      });

      onUpdateCurrentUser({
        ...res.user,
        avatarUrl: finalAvatarUrl,
        profile_image: finalProfileImage
      });

      setPendingAvatar(undefined);
      showToast("Profile information updated successfully!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to update profile.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Submit account settings tab
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const newErrors: Record<string, string> = {};
    if (!username.trim()) newErrors.username = "System Username is required.";
    if (!email.trim()) newErrors.email = "Public Email Address is required.";

    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      return;
    }

    try {
      setIsSaving(true);

      let finalAvatarUrl = currentUser.avatarUrl;
      let finalProfileImage = currentUser.profile_image;

      // Commit pending avatar changes if any
      if (pendingAvatar !== undefined) {
        const avatarRes = await api.updateAvatar(pendingAvatar);
        finalAvatarUrl = avatarRes.avatarUrl;
        finalProfileImage = avatarRes.profile_image;
      }

      const res = await api.updateProfile({
        username: username.trim(),
        email: email.trim(),
        notificationPreferences: {
          email: notifyEmail,
          system: notifySystem
        }
      });

      onUpdateCurrentUser({
        ...res.user,
        avatarUrl: finalAvatarUrl,
        profile_image: finalProfileImage
      });

      setPendingAvatar(undefined);
      showToast("Account settings updated successfully!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to update settings.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Submit change password
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      showToast("Current Password is required.", "error");
      return;
    }
    if (!newPassword) {
      showToast("New Password is required.", "error");
      return;
    }
    if (newPassword.length < 4) {
      showToast("New password must be at least 4 characters.", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Confirm Password does not match new password.", "error");
      return;
    }

    try {
      setIsSaving(true);
      await api.updateProfile({
        currentPassword,
        newPassword
      });
      showToast("Password changed successfully!", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      showToast(err.message || "Failed to change password. Double check current password.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden border border-gray-100"
      >
        {/* Left column sidebar for profile tabs */}
        <div className="bg-gray-50 p-6 md:w-1/3 border-b md:border-b-0 md:border-r border-gray-100 flex flex-col justify-between shrink-0">
          <div>
            {/* Title / Header */}
            <div className="flex items-center gap-2 mb-6">
              <div className="p-1.5 bg-red-50 rounded-lg text-smei-crimson">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="text-base font-black text-gray-800 tracking-tight font-display">
                Profile Management
              </h2>
            </div>

            {/* Profile Avatar & Details Box */}
            <div className="flex flex-col items-center text-center p-4 bg-white border border-gray-100 rounded-xl shadow-sm mb-6 relative">
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-[9px] font-bold text-green-700 uppercase tracking-wider">Online</span>
              </div>
              <div className="relative group mb-3 mt-4">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 border-[3px] border-gray-50 shadow-sm flex items-center justify-center">
                  {avatarPreview ? (
                    <img 
                      src={avatarPreview} 
                      alt={currentUser.fullName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <UserIcon className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                {avatarPreview && (
                  <button
                    onClick={handleRemoveAvatar}
                    className="absolute -top-1 -right-1 p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full border border-white shadow transition-all cursor-pointer"
                    title="Remove Image"
                    type="button"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              
              <h3 className="font-bold text-sm text-gray-800 tracking-tight truncate max-w-full">
                {currentUser.fullName}
              </h3>
              {currentUser.position && (
                <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                  {currentUser.position}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-gray-100 text-gray-600 border border-gray-200">
                  {currentUser.department}
                </span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                  currentUser.role === "Administrator" ? "bg-red-50 text-red-600 border border-red-200" :
                  currentUser.role === "Purchasing Staff" ? "bg-blue-50 text-blue-600 border border-blue-200" :
                  currentUser.role === "Department Head" ? "bg-orange-50 text-orange-600 border border-orange-200" :
                  currentUser.role === "Accounting Staff" ? "bg-green-50 text-green-600 border border-green-200" :
                  currentUser.role === "Director" ? "bg-purple-50 text-purple-600 border border-purple-200" :
                  "bg-gray-50 text-gray-600 border border-gray-200"
                }`}>
                  {currentUser.role}
                </span>
              </div>
            </div>

            {/* Tab Navigation Menu */}
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab("profile")}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer ${
                  activeTab === "profile"
                    ? "bg-smei-crimson text-white shadow"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <UserIcon className="w-4 h-4" />
                <span>My Profile</span>
              </button>

              <button
                onClick={() => setActiveTab("settings")}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer ${
                  activeTab === "settings"
                    ? "bg-smei-crimson text-white shadow"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Account Settings</span>
              </button>

              <button
                onClick={() => setActiveTab("password")}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer ${
                  activeTab === "password"
                    ? "bg-smei-crimson text-white shadow"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <KeyRound className="w-4 h-4" />
                <span>Change Password</span>
              </button>
            </nav>
          </div>

          <div className="hidden md:block pt-4 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 font-mono">
              Securely connected <br />
              SMEI-POMS Session
            </p>
          </div>
        </div>

        {/* Right column content form area */}
        <div className="flex-1 p-6 md:p-8 flex flex-col justify-between overflow-y-auto max-h-[60vh] md:max-h-full">
          <div>
            {/* Header / Dismiss Button */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
              <div>
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider font-mono">
                  {activeTab === "profile" && "My Profile Information"}
                  {activeTab === "settings" && "Account & System Preferences"}
                  {activeTab === "password" && "Security & Password Management"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {activeTab === "profile" && "Manage your corporate identity, avatar, and contact channels."}
                  {activeTab === "settings" && "Update system identifiers and push alert preferences."}
                  {activeTab === "password" && "Maintain password integrity. Require current key block verification."}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main Forms switch based on active tab */}
            <div className="space-y-6">
              {activeTab === "profile" && (
                <form onSubmit={handleSaveProfile} className="space-y-5">
                  {/* Avatar upload dropzone container */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 font-mono mb-2">
                      Profile Picture
                    </label>
                    <div 
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      onClick={triggerFileInput}
                      className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                        dragActive 
                          ? "border-smei-crimson bg-red-50/30" 
                          : "border-gray-200 hover:border-smei-crimson hover:bg-gray-50/40"
                      }`}
                    >
                      <input 
                        ref={fileInputRef}
                        type="file" 
                        className="hidden" 
                        accept=".jpg,.jpeg,.png,.webp"
                        onChange={handleFileChange}
                      />
                      <Upload className="w-5 h-5 text-gray-400" />
                      <p className="text-xs text-gray-600 font-semibold text-center">
                        Drag and drop your image, or <span className="text-smei-crimson hover:underline">browse</span>
                      </p>
                      <p className="text-[10px] text-gray-400 text-center font-mono">
                        Supports: JPG, JPEG, PNG, WEBP (Max: 5MB)
                      </p>
                    </div>
                  </div>

                  {/* Corporate and Contact Information fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 font-mono mb-1.5">
                        First Name <span className="text-smei-crimson">*</span>
                      </label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => {
                          setFirstName(e.target.value);
                          if (formErrors.firstName) setFormErrors(prev => ({ ...prev, firstName: "" }));
                        }}
                        className={`w-full bg-white border ${formErrors.firstName ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200'} rounded-lg text-xs p-2.5 focus:outline-none focus:border-smei-crimson focus:ring-1 focus:ring-smei-crimson`}
                        placeholder="e.g. John"
                        required
                      />
                      {formErrors.firstName && <span className="text-xs text-red-600 mt-1 block">{formErrors.firstName}</span>}
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 font-mono mb-1.5">
                        Last Name <span className="text-smei-crimson">*</span>
                      </label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => {
                          setLastName(e.target.value);
                          if (formErrors.lastName) setFormErrors(prev => ({ ...prev, lastName: "" }));
                        }}
                        className={`w-full bg-white border ${formErrors.lastName ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200'} rounded-lg text-xs p-2.5 focus:outline-none focus:border-smei-crimson focus:ring-1 focus:ring-smei-crimson`}
                        placeholder="e.g. Doe"
                      />
                      {formErrors.lastName && <span className="text-xs text-red-600 mt-1 block">{formErrors.lastName}</span>}
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 font-mono mb-1.5">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg text-xs pl-9 p-2.5 focus:outline-none focus:border-smei-crimson focus:ring-1 focus:ring-smei-crimson"
                          placeholder="e.g. john.doe@southcoastmetal.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 font-mono mb-1.5">
                        Contact Number
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg text-xs pl-9 p-2.5 focus:outline-none focus:border-smei-crimson focus:ring-1 focus:ring-smei-crimson"
                          placeholder="e.g. +63 912 345 6789"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 font-mono mb-1.5">
                        Department
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={department}
                          disabled
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg text-xs pl-9 p-2.5 text-gray-500 cursor-not-allowed font-semibold"
                          title="Contact Administrator to change corporate department assignment."
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 font-mono mb-1.5">
                        Position
                      </label>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={position}
                          onChange={(e) => setPosition(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg text-xs pl-9 p-2.5 focus:outline-none focus:border-smei-crimson focus:ring-1 focus:ring-smei-crimson"
                          placeholder="e.g. Purchasing Manager"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-gray-100">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-5 py-2.5 bg-smei-crimson hover:bg-[#9B111E] text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-75"
                    >
                      {isSaving ? "Saving details..." : "Save Profile Details"}
                    </button>
                  </div>
                </form>
              )}

              {activeTab === "settings" && (
                <form onSubmit={handleSaveSettings} className="space-y-6">
                  {/* Account identifiers info */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-gray-700">Account Credentials</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 font-mono mb-1.5">
                          System Username <span className="text-smei-crimson">*</span>
                        </label>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => {
                            setUsername(e.target.value);
                            if (formErrors.username) setFormErrors(prev => ({ ...prev, username: "" }));
                          }}
                          className={`w-full bg-white border ${formErrors.username ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200'} rounded-lg text-xs p-2.5 focus:outline-none focus:border-smei-crimson focus:ring-1 focus:ring-smei-crimson`}
                          placeholder="Username"
                          required
                        />
                        {formErrors.username && <span className="text-xs text-red-600 mt-1 block">{formErrors.username}</span>}
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 font-mono mb-1.5">
                          Public Email Address <span className="text-smei-crimson">*</span>
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (formErrors.email) setFormErrors(prev => ({ ...prev, email: "" }));
                          }}
                          className={`w-full bg-white border ${formErrors.email ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200'} rounded-lg text-xs p-2.5 focus:outline-none focus:border-smei-crimson focus:ring-1 focus:ring-smei-crimson`}
                          placeholder="Email address"
                        />
                        {formErrors.email && <span className="text-xs text-red-600 mt-1 block">{formErrors.email}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 my-4" />

                  {/* System notification preferences */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Bell className="w-4 h-4 text-smei-crimson" />
                      <h4 className="text-xs font-bold">Notification Preferences</h4>
                    </div>
                    
                    <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={notifyEmail}
                          onChange={(e) => setNotifyEmail(e.target.checked)}
                          className="mt-0.5 rounded border-gray-300 text-smei-crimson focus:ring-smei-crimson w-4 h-4 cursor-pointer"
                        />
                        <div>
                          <p className="text-xs font-semibold text-gray-800">Email Alerts</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            Receive copy summaries of approved purchase orders and department status changes directly.
                          </p>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={notifySystem}
                          onChange={(e) => setNotifySystem(e.target.checked)}
                          className="mt-0.5 rounded border-gray-300 text-smei-crimson focus:ring-smei-crimson w-4 h-4 cursor-pointer"
                        />
                        <div>
                          <p className="text-xs font-semibold text-gray-800">In-App Notifications</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            Real-time broadcast alerts inside the system's notification bell panel.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 my-4" />

                  {/* System Information */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Globe className="w-4 h-4 text-smei-crimson" />
                      <h4 className="text-xs font-bold">System Information</h4>
                    </div>
                    
                    <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 font-mono mb-1.5">
                          Employee Portal URL
                        </p>
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            readOnly
                            value={getAppUrl()}
                            className="flex-1 bg-white border border-gray-200 rounded-lg text-xs p-2 focus:outline-none font-mono text-gray-600"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(getAppUrl());
                              setToast({ message: "Portal URL copied to clipboard.", type: "success" });
                              setTimeout(() => setToast(null), 3000);
                            }}
                            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition-all"
                          >
                            Copy URL
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-gray-100 mt-6">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-5 py-2.5 bg-smei-crimson hover:bg-[#9B111E] text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-75"
                    >
                      {isSaving ? "Saving preferences..." : "Save Preferences"}
                    </button>
                  </div>
                </form>
              )}

              {activeTab === "password" && (
                <form onSubmit={handleSavePassword} className="space-y-5">
                  <div className="space-y-4">
                    {/* Current password for validation */}
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 font-mono mb-1.5">
                        Current Password <span className="text-smei-crimson">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg text-xs p-2.5 pr-10 focus:outline-none focus:border-smei-crimson focus:ring-1 focus:ring-smei-crimson"
                          placeholder="••••••••"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                        >
                          {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* New password */}
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 font-mono mb-1.5">
                          New Password <span className="text-smei-crimson">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg text-xs p-2.5 pr-10 focus:outline-none focus:border-smei-crimson focus:ring-1 focus:ring-smei-crimson"
                            placeholder="Min 4 characters"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                          >
                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Confirm password */}
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 font-mono mb-1.5">
                          Confirm New Password <span className="text-smei-crimson">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg text-xs p-2.5 pr-10 focus:outline-none focus:border-smei-crimson focus:ring-1 focus:ring-smei-crimson"
                            placeholder="Confirm password"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Password tips */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-1">
                      <p className="text-[10px] font-bold text-gray-600 uppercase font-mono tracking-wider">
                        Password Guidelines
                      </p>
                      <ul className="text-[10px] text-gray-500 list-disc list-inside space-y-0.5">
                        <li>Password length must be at least 4 characters long.</li>
                        <li>Maintain alphanumeric mixture for elevated enterprise safety.</li>
                        <li>Never share credentials with unverified intranet operators.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-gray-100">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-5 py-2.5 bg-smei-crimson hover:bg-[#9B111E] text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-75"
                    >
                      {isSaving ? "Updating keys..." : "Update Security Password"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Toast / Notification Feed */}
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className={`p-3.5 rounded-xl border flex items-center gap-2 text-xs font-bold mt-4 shadow ${
                  toast.type === "success"
                    ? "bg-green-50 border-green-200 text-green-800"
                    : "bg-red-50 border-red-200 text-red-800"
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${toast.type === "success" ? "bg-green-500" : "bg-red-500"}`} />
                <span>{toast.message}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
