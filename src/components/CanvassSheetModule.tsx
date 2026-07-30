/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { CanvassSheet, CanvassItem, User, UserRole } from "../types";
import { api } from "../lib/api";
import { Search, Plus, Trash2, Edit3, Eye, FileText, X, Calculator, PlusCircle } from "lucide-react";
import { exportWordWithTemplate, exportExcelWithTemplate } from "../utils/templateExport";
import { mapCanvassData } from "../utils/templateMapping";
import { ExportWordButton, CreateButton } from "./SharedButtons";
import { TableSkeleton } from "./ui/Skeleton";

interface CanvassModuleProps {
  currentUser: User;
}

interface FormSupplier {
  id: string;
  name: string;
  contactPerson: string;
  contactNo: string;
  workDuration: string;
  warranty: string;
  paymentTerms: string;
  isNonVat?: boolean;
  nonVatRate?: string;
}

interface FormPart {
  id: string;
  description: string;
  prices: Record<string, number>; // Maps supplier.id -> price
}

export default function CanvassSheetModule({ currentUser }: CanvassModuleProps) {
  const [sheets, setSheets] = useState<CanvassSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState<CanvassSheet | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);

  // Form State - Document Information
  const [canvassNumber, setCanvassNumber] = useState("");
  const [canvassDate, setCanvassDate] = useState("");
  const [category, setCategory] = useState("");
  const [plateNo, setPlateNo] = useState("");
  const [remarks, setRemarks] = useState("");

  // Dynamic Lists State
  const [suppliers, setSuppliers] = useState<FormSupplier[]>([]);
  const [parts, setParts] = useState<FormPart[]>([]);

  // Signatory State
  const [preparedBy, setPreparedBy] = useState("");
  const [preparedByPosition, setPreparedByPosition] = useState("Canvasser");
  const [checkedBy, setCheckedBy] = useState("");
  const [checkedByPosition, setCheckedByPosition] = useState("Maintenance Supervisor");
  const [verifiedBy, setVerifiedBy] = useState("");
  const [verifiedByPosition, setVerifiedByPosition] = useState("Operations Manager");
  const [approvedBy, setApprovedBy] = useState("");
  const [approvedByPosition, setApprovedByPosition] = useState("Purchasing Manager");

  // Errors State
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isAdmin = currentUser.role === UserRole.Administrator;
  const isStaff = currentUser.role === UserRole.PurchasingStaff;
  const isAuthorized = isAdmin || isStaff;

  const fetchSheets = async () => {
    setLoading(true);
    try {
      const data = await api.getCanvass();
      setSheets(data);
      if (data && data.length > 0 && !activeSheetId) {
        setActiveSheetId(data[data.length - 1].id);
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes("Session expired") || errMsg.includes("unauthorized") || errMsg.includes("token")) {
        console.warn("Canvass fetch unauthorized or session expired (handled globally):", errMsg);
      } else {
        console.error("Error fetching canvass sheets:", errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSheets();
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      window.dispatchEvent(new CustomEvent("smei-editor-opened"));
    } else {
      window.dispatchEvent(new CustomEvent("smei-editor-closed"));
    }
    return () => {
      window.dispatchEvent(new CustomEvent("smei-editor-closed"));
    };
  }, [isModalOpen]);

  // Auto-calculated computations live based on form inputs
  const supplierCalculations = useMemo(() => {
    return suppliers.map((s) => {
      const sum = parts.reduce((acc, p) => acc + (Number(p.prices[s.id]) || 0), 0);
      const vat = 0;
      const total = sum;
      return {
        supplierId: s.id,
        sum,
        vat,
        total,
      };
    });
  }, [suppliers, parts]);

  // Dynamically display recommended supplier (the one with the lowest total amount > 0)
  const recommended = useMemo(() => {
    const validSuppliers = supplierCalculations.filter((calc) => calc.sum > 0);
    if (validSuppliers.length === 0) return { name: "N/A", total: 0 };

    const sorted = [...validSuppliers].sort((a, b) => a.total - b.total);
    const best = sorted[0];
    const supplierObj = suppliers.find((s) => s.id === best.supplierId);
    return {
      name: supplierObj ? supplierObj.name : "N/A",
      total: best.total,
    };
  }, [supplierCalculations, suppliers]);

  // Highlights the lowest price per part in the table
  const getLowestPriceSupplierIds = (p: FormPart) => {
    const validPrices = suppliers
      .map((s) => ({ id: s.id, val: Number(p.prices[s.id]) || 0 }))
      .filter((x) => x.val > 0);
    if (validPrices.length === 0) return [];
    const minVal = Math.min(...validPrices.map((x) => x.val));
    return validPrices.filter((x) => x.val === minVal).map((x) => x.id);
  };

  // Filter & Search Logic
  const filteredSheets = useMemo(() => {
    return sheets.filter((sheet) => {
      return (
        sheet.canvassNumber.toLowerCase().includes(search.toLowerCase()) ||
        sheet.supplierName.toLowerCase().includes(search.toLowerCase()) ||
        (sheet.recommendedSupplier || "").toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [sheets, search]);

  const currentCanvassData = useMemo<CanvassSheet>(() => {
    return {
      id: selectedSheet?.id || "temp-canvass-id",
      canvassNumber,
      canvassDate,
      supplierName: recommended.name,
      address: "",
      contactPerson: "",
      phoneNumber: "",
      email: "",
      items: parts.map(p => ({
        id: p.id,
        item: p.description,
        specification: "",
        quantity: 1,
        unit: "",
        supplierAPrice: Number(p.prices[suppliers[0]?.id]) || 0,
        supplierBPrice: Number(p.prices[suppliers[1]?.id]) || 0,
        supplierCPrice: Number(p.prices[suppliers[2]?.id]) || 0,
        selectedSupplier: recommended.name as any,
        remarks: ""
      })),
      lowestPrice: recommended.total,
      recommendedSupplier: recommended.name,
      totalCost: recommended.total,
      category,
      plateNo,
      remarks,
      requestedBy: preparedBy,
      preparedByPosition,
      checkedBy,
      checkedByPosition,
      verifiedBy,
      verifiedByPosition,
      approvedBy,
      approvedByPosition,
      shops: suppliers,
      parts: parts,
      created_by: selectedSheet?.created_by || currentUser.fullName,
      createdAt: selectedSheet?.createdAt || new Date().toISOString(),
      updatedAt: selectedSheet?.updatedAt || new Date().toISOString()
    };
  }, [
    selectedSheet, canvassNumber, canvassDate, recommended, category, plateNo, remarks,
    preparedBy, preparedByPosition, checkedBy, checkedByPosition, verifiedBy, verifiedByPosition,
    approvedBy, approvedByPosition, suppliers, parts, currentUser
  ]);

  // Open Modal Dialog
  const handleOpenModal = async (sheet: CanvassSheet | null = null, edit = false) => {
    setErrors({});
    if (sheet) {
      setSelectedSheet(sheet);
      setIsEditMode(edit);
      setCanvassNumber(sheet.canvassNumber);
      setCanvassDate(sheet.canvassDate);
      setCategory(sheet.category || "");
      setPlateNo(sheet.plateNo || "");
      setRemarks(sheet.remarks || "");

      setPreparedBy(sheet.requestedBy || "");
      setPreparedByPosition(sheet.preparedByPosition || "Canvasser");
      setCheckedBy(sheet.checkedBy || "");
      setCheckedByPosition(sheet.checkedByPosition || "Maintenance Supervisor");
      setVerifiedBy(sheet.verifiedBy || "");
      setVerifiedByPosition(sheet.verifiedByPosition || "Operations Manager");
      setApprovedBy(sheet.approvedBy || "");
      setApprovedByPosition(sheet.approvedByPosition || "Purchasing Manager");

      // Load dynamic structures if present in the database, else use backward-compatible fallback
      if (sheet.suppliersList && Array.isArray(sheet.suppliersList) && sheet.suppliersList.length > 0) {
        setSuppliers(sheet.suppliersList);
      } else {
        setSuppliers([
          {
            id: "supplier_1",
            name: sheet.shopName1 || sheet.supplierName || "Supplier A",
            contactPerson: sheet.contactPerson1 || sheet.contactPerson || "",
            contactNo: sheet.contactNo1 || sheet.phoneNumber || "",
            workDuration: sheet.workDuration1 || "",
            warranty: sheet.warranty1 || "",
            paymentTerms: sheet.paymentTerms1 || "",
          },
          {
            id: "supplier_2",
            name: sheet.shopName2 || "Supplier B",
            contactPerson: sheet.contactPerson2 || "",
            contactNo: sheet.contactNo2 || "",
            workDuration: sheet.workDuration2 || "",
            warranty: sheet.warranty2 || "",
            paymentTerms: sheet.paymentTerms2 || "",
          },
        ]);
      }

      if (sheet.partsList && Array.isArray(sheet.partsList) && sheet.partsList.length > 0) {
        setParts(sheet.partsList);
      } else {
        const fallbackSuppliers = sheet.suppliersList || [
          { id: "supplier_1" },
          { id: "supplier_2" },
        ];
        const s1Id = fallbackSuppliers[0]?.id || "supplier_1";
        const s2Id = fallbackSuppliers[1]?.id || "supplier_2";

        setParts(
          (sheet.items || []).map((it, idx) => ({
            id: it.id || `part_${Date.now()}_${idx}`,
            description: it.item,
            prices: {
              [s1Id]: it.supplierAPrice || 0,
              [s2Id]: it.supplierBPrice || 0,
            },
          }))
        );
      }
    } else {
      setSelectedSheet(null);
      setIsEditMode(true);
      setCanvassDate(new Date().toISOString().split("T")[0]);
      setCategory("");
      setPlateNo("");
      setRemarks("");

      // Prefill standard default signatories
      setPreparedBy(currentUser.fullName);
      setPreparedByPosition("Canvasser");
      setCheckedBy("");
      setCheckedByPosition("Maintenance Supervisor");
      setVerifiedBy("");
      setVerifiedByPosition("Operations Manager");
      setApprovedBy("");
      setApprovedByPosition("Purchasing Manager");

      setSuppliers([
        {
          id: "supplier_1",
          name: "Supplier A",
          contactPerson: "",
          contactNo: "",
          workDuration: "",
          warranty: "",
          paymentTerms: "",
        },
      ]);

      setParts([
        {
          id: "part_1",
          description: "",
          prices: {
            supplier_1: 0,
          },
        },
      ]);

      try {
        const { nextNumber } = await api.getNextCanvassNumber();
        setCanvassNumber(nextNumber);
      } catch (err) {
        setCanvassNumber("");
      }
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSheet(null);
  };

  // Add/Remove Suppliers dynamically
  const handleAddSupplier = () => {
    const newId = `supplier_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const labelLetter = String.fromCharCode(65 + suppliers.length);
    const newSupplier: FormSupplier = {
      id: newId,
      name: `Supplier ${labelLetter}`,
      contactPerson: "",
      contactNo: "",
      workDuration: "",
      warranty: "",
      paymentTerms: "",
    };
    setSuppliers([...suppliers, newSupplier]);

    setParts(
      parts.map((p) => ({
        ...p,
        prices: {
          ...p.prices,
          [newId]: 0,
        },
      }))
    );
  };

  const handleRemoveSupplier = (id: string) => {
    if (suppliers.length <= 1) {
      alert("At least one supplier is required.");
      return;
    }
    setSuppliers(suppliers.filter((s) => s.id !== id));
    setParts(
      parts.map((p) => {
        const copy = { ...p.prices };
        delete copy[id];
        return {
          ...p,
          prices: copy,
        };
      })
    );
  };

  const handleSupplierChange = (id: string, field: keyof FormSupplier, value: any) => {
    setSuppliers(suppliers.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  // Add/Remove Parts dynamically
  const handleAddPart = () => {
    const newId = `part_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const initialPrices: Record<string, number> = {};
    suppliers.forEach((s) => {
      initialPrices[s.id] = 0;
    });
    setParts([...parts, { id: newId, description: "", prices: initialPrices }]);
  };

  const handleRemovePart = (id: string) => {
    if (parts.length <= 1) {
      alert("At least one part is required.");
      return;
    }
    setParts(parts.filter((p) => p.id !== id));
  };

  const handlePartDescChange = (id: string, val: string) => {
    setParts(parts.map((p) => (p.id === id ? { ...p, description: val } : p)));
  };

  const handlePartPriceChange = (partId: string, supplierId: string, val: number) => {
    setParts(
      parts.map((p) => {
        if (p.id === partId) {
          return {
            ...p,
            prices: {
              ...p.prices,
              [supplierId]: val,
            },
          };
        }
        return p;
      })
    );
  };

  // Form Submission & Database persistence
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditMode) return;

    // Strict validation rules
    const newErrors: Record<string, string> = {};

    if (!canvassNumber.trim()) {
      newErrors.canvassNumber = "Canvass Number is required.";
    } else {
      const format = /^\d{5}$/;
      if (!format.test(canvassNumber)) {
        newErrors.canvassNumber = "Invalid format. Expected: 5-digit sequential number (e.g., 00001).";
      }
    }

    if (!canvassDate) {
      newErrors.canvassDate = "Canvass Date is required.";
    }

    suppliers.forEach((s, idx) => {
      if (!s.name.trim()) {
        newErrors[`supplier_name_${s.id}`] = `Supplier #${idx + 1} Name is required.`;
      }
    });

    parts.forEach((p, idx) => {
      if (!p.description.trim()) {
        newErrors[`part_desc_${p.id}`] = `Part #${idx + 1} Description is required.`;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const s0 = suppliers[0] || { name: "N/A", contactPerson: "", contactNo: "", workDuration: "", warranty: "", paymentTerms: "" };
    const s1 = suppliers[1] || { name: "", contactPerson: "", contactNo: "", workDuration: "", warranty: "", paymentTerms: "" };

    const payload: Partial<CanvassSheet> = {
      canvassNumber,
      canvassDate,
      supplierName: s0.name,
      address: s0.contactPerson ? "N/A" : "",
      contactPerson: s0.contactPerson || "",
      phoneNumber: s0.contactNo || "",
      email: "",

      // Save rich dynamic data models directly
      suppliersList: suppliers,
      partsList: parts,

      // Excel legacy items array mapping
      items: parts.map((p) => ({
        id: p.id,
        item: p.description,
        specification: "",
        quantity: 1,
        unit: "pcs",
        supplierAPrice: p.prices[s0.id] || 0,
        supplierBPrice: p.prices[s1.id] || 0,
        supplierCPrice: (suppliers[2] && p.prices[suppliers[2].id]) || 0,
        selectedSupplier: "Supplier A",
        remarks: "",
      })),

      lowestPrice: recommended.total,
      recommendedSupplier: recommended.name,
      totalCost: recommended.total,

      requestedBy: preparedBy,
      checkedBy,
      verifiedBy,
      approvedBy,

      category,
      plateNo,
      scopeOfWorks: parts.map((p) => p.description).join(", "),

      shopName1: s0.name,
      shopName2: s1.name,
      contactPerson1: s0.contactPerson,
      contactPerson2: s1.contactPerson,
      contactNo1: s0.contactNo,
      contactNo2: s1.contactNo,
      remarks,
      workDuration1: s0.workDuration,
      workDuration2: s1.workDuration,
      warranty1: s0.warranty,
      warranty2: s1.warranty,
      paymentTerms1: s0.paymentTerms,
      paymentTerms2: s1.paymentTerms,

      preparedByPosition,
      checkedByPosition,
      verifiedByPosition,
      approvedByPosition,
    };

    try {
      if (selectedSheet) {
        await api.updateCanvass(selectedSheet.id, payload);
      } else {
        await api.createCanvass(payload);
      }
      fetchSheets();
      handleCloseModal();
    } catch (err: any) {
      setErrors({ server: err.message || "An unexpected error occurred saving the sheet." });
    }
  };

  const handleDelete = async (id: string, num: string) => {
    if (confirm(`Are you sure you want to delete Canvass Sheet ${num}?`)) {
      try {
        await api.deleteCanvass(id);
        fetchSheets();
        if (activeSheetId === id) setActiveSheetId(null);
      } catch (err: any) {
        alert(err.message || "Error deleting Canvass Sheet");
      }
    }
  };

  // Export Compatibility Handler
  const handleExport = async (sheet: CanvassSheet, format: "word" | "excel") => {
    const sList: FormSupplier[] = sheet.suppliersList || sheet.shops || [
      {
        id: "supplier_1",
        name: sheet.shopName1 || sheet.supplierName || "Supplier A",
        contactPerson: sheet.contactPerson1 || sheet.contactPerson || "",
        contactNo: sheet.contactNo1 || sheet.phoneNumber || "",
        workDuration: sheet.workDuration1 || "",
        warranty: sheet.warranty1 || "",
        paymentTerms: sheet.paymentTerms1 || "",
      },
      {
        id: "supplier_2",
        name: sheet.shopName2 || "Supplier B",
        contactPerson: sheet.contactPerson2 || "",
        contactNo: sheet.contactNo2 || "",
        workDuration: sheet.workDuration2 || "",
        warranty: sheet.warranty2 || "",
        paymentTerms: sheet.paymentTerms2 || "",
      },
    ];

    const s0 = sList[0] || { id: "s0", name: "", contactPerson: "", contactNo: "", workDuration: "", warranty: "", paymentTerms: "" };
    const s1 = sList[1] || { id: "s1", name: "", contactPerson: "", contactNo: "", workDuration: "", warranty: "", paymentTerms: "" };

    const pList: FormPart[] = sheet.partsList || sheet.parts || (sheet.items || []).map((it, idx) => ({
      id: it.id || `p_${idx}`,
      description: it.item,
      prices: {
        [s0.id]: it.supplierAPrice || 0,
        [s1.id]: it.supplierBPrice || 0,
      },
    }));

    // Reconstruct sheet data with rich dynamic data models to feed into single source of truth mapper
    const sheetToMap: CanvassSheet = {
      ...sheet,
      shops: sList,
      parts: pList,
    };

    const { exportData, excelShops, excelItems } = mapCanvassData(sheetToMap);

    if (format === "word") {
      await exportWordWithTemplate("CANVASS_TEMPLATE.docx", exportData, `${sheet.canvassNumber}_SMEI_CANVASS.docx`);
    } else {
      await exportExcelWithTemplate(
        "CANVASS_TEMPLATE.xlsx",
        { ...exportData, shops: excelShops },
        "items",
        excelItems,
        `${sheet.canvassNumber}_SMEI_CANVASS.xlsx`
      );
    }
  };

  const handleExportWord = () => {
    const active = sheets.find((s) => s.id === activeSheetId);
    if (!active) {
      alert("Please select a Canvass Sheet from the list first.");
      return;
    }
    handleExport(active, "word");
  };

  return (
    <div id="smei-canvass-list" className="p-4 md:p-6 space-y-4 max-w-[130rem] mx-auto w-full">
      {/* Upper Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 tracking-tight font-display">Canvass Sheets Directory</h2>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5">Compare supplier bids, compute VAT/Non-VAT compliance, and determine optimal sourcing</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full md:w-auto md:justify-end">
          {activeSheetId && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase font-mono tracking-wider">Selected:</span>
              <span className="text-[11px] font-bold font-mono text-smei-crimson bg-red-50 border border-red-200 px-2.5 py-1 rounded-md">
                {sheets.find((s) => s.id === activeSheetId)?.canvassNumber || ""}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            {isAuthorized && (
              <CreateButton onClick={() => handleOpenModal(null)} label="Create Canvass" />
            )}
          </div>
        </div>
      </div>

      {/* Full Width Layout for Canvass Grid */}
      <div className="w-full flex flex-col gap-4 h-[calc(100vh-170px)] min-h-[650px]">
        
        {/* Compressed Search and Filters Board */}
        <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
            <div className="grid grid-cols-1 gap-2.5">
              {/* Search Keywords */}
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Search Keywords</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search Canvass Number, Supplier, Recommended..."
                    className="w-full pl-7.5 pr-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent focus:bg-white transition-all text-gray-700"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            <div className="w-full overflow-x-auto flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="sticky top-0 bg-white z-10 shadow-sm">
                <tr className="bg-red-50/20 text-gray-600 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-4 px-6">Canvass Number</th>
                  <th className="py-4 px-6">Canvass Date</th>
                  <th className="py-4 px-6">Primary Supplier</th>
                  <th className="py-4 px-6">Recommended Supplier</th>
                  <th className="py-4 px-6 text-right font-mono">Lowest Price (with VAT)</th>
                  <th className="py-4 px-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton rows={5} columns={6} />
                ) : filteredSheets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400">
                      No Canvass Sheets found.
                    </td>
                  </tr>
                ) : (
                  filteredSheets.map((sheet, idx) => (
                    <tr
                      key={sheet.id}
                      onClick={() => setActiveSheetId(sheet.id)}
                      onDoubleClick={() => handleOpenModal(sheet, false)}
                      className={`cursor-pointer transition-all border-b border-gray-50/60 group ${
                        activeSheetId === sheet.id
                          ? "bg-red-50/70 border-l-4 border-l-smei-crimson font-medium"
                          : idx % 2 === 1
                          ? "bg-gray-50/30 hover:bg-red-50/30"
                          : "bg-white hover:bg-red-50/30"
                      }`}
                      title="Double-click to View details"
                    >
                      <td className="py-3 px-6 font-mono font-bold text-smei-darkred">
                        <div className="flex items-center gap-2">
                          {activeSheetId === sheet.id && (
                            <div className="w-1.5 h-1.5 bg-smei-crimson rounded-full animate-pulse shrink-0" />
                          )}
                          <span>{sheet.canvassNumber}</span>
                        </div>
                      </td>
                      <td className="py-3 px-6 text-gray-500 font-mono">{sheet.canvassDate}</td>
                      <td className="py-3 px-6 font-semibold text-gray-800">{sheet.supplierName}</td>
                      <td className="py-3 px-6 font-semibold text-emerald-700 text-xs">
                        <span className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {sheet.recommendedSupplier}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-right font-mono font-bold text-emerald-600">
                        {new Intl.NumberFormat("en-PH", {
                          style: "currency",
                          currency: "PHP",
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }).format(sheet.lowestPrice)}
                      </td>
                      <td className="py-3 px-6 text-center" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenModal(sheet, false)}
                            className="p-1 hover:bg-red-50 hover:text-smei-crimson text-gray-400 rounded transition-all"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isAuthorized && (
                            <button
                              onClick={() => handleOpenModal(sheet, true)}
                              className="p-1 hover:bg-blue-50 hover:text-blue-600 text-gray-400 rounded transition-all"
                              title="Edit"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}

                          {isAuthorized && (
                            <button
                              onClick={() => handleDelete(sheet.id, sheet.canvassNumber)}
                              className="p-1 hover:bg-rose-50 hover:text-rose-600 text-gray-400 rounded transition-all"
                              title="Delete Canvass"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Rebuilt, High-Fidelity Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 w-full max-w-3xl overflow-hidden transition-all scale-100">
            <div className="bg-smei-crimson text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold uppercase tracking-wide">
                  {selectedSheet ? (isEditMode ? "Edit Canvass Sheet" : "Canvass Sheet Details") : "Create New Canvass Sheet"}
                </h3>
                <p className="text-[10px] text-red-100 font-medium">SMEI Comparative Price Canvassing (SMEI Canvass Sheet Layout)</p>
              </div>
              <button onClick={handleCloseModal} className="text-white hover:text-red-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[80vh] overflow-y-auto">
              {/* Form Editor */}
              <div className="w-full">
                <form onSubmit={handleSubmit} className="space-y-6">
              {errors.server && (
                <div className="bg-rose-50 border-l-4 border-rose-500 text-rose-700 text-xs p-3 rounded-md font-medium">
                  {errors.server}
                </div>
              )}

              {/* SECTION 1: GENERAL INFORMATION */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-smei-crimson uppercase tracking-wide border-b border-gray-100 pb-1.5">
                  1. General Information
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Document No. */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Document No. *</label>
                    <input
                      type="text"
                      disabled={!isEditMode}
                      className="w-full text-xs font-semibold p-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed outline-none"
                      value="FM-PPD-04"
                      readOnly
                    />
                  </div>

                  {/* Control No. */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Control No. *</label>
                    <input
                      type="text"
                      required
                      disabled={!isEditMode}
                      className={`w-full text-xs font-mono font-semibold p-2.5 border rounded-xl focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none transition-all ${
                        errors.canvassNumber ? "border-rose-500 bg-rose-50/20 animate-pulse" : "border-gray-200 bg-white"
                      }`}
                      value={canvassNumber}
                      onChange={(e) => setCanvassNumber(e.target.value)}
                      placeholder="00001"
                    />
                    {errors.canvassNumber && <p className="text-[10px] text-rose-500 mt-0.5 font-semibold">{errors.canvassNumber}</p>}
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Category *</label>
                    <input
                      type="text"
                      required
                      disabled={!isEditMode}
                      className="w-full text-xs font-semibold p-2.5 border border-gray-200 rounded-xl bg-white focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none transition-all"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g. Spare Parts"
                    />
                  </div>

                  {/* Plate No. */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Plate No. *</label>
                    <input
                      type="text"
                      required
                      disabled={!isEditMode}
                      className="w-full text-xs font-semibold p-2.5 border border-gray-200 rounded-xl bg-white focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none transition-all"
                      value={plateNo}
                      onChange={(e) => setPlateNo(e.target.value)}
                      placeholder="e.g. ABC-1234"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: COMPARATIVE SUPPLIERS PROFILE */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                  <h4 className="text-xs font-bold text-smei-crimson uppercase tracking-wide">
                    2. Comparative Suppliers Information
                  </h4>
                  {isEditMode && (
                    <button
                      type="button"
                      onClick={handleAddSupplier}
                      className="text-xs bg-red-50 hover:bg-red-100 text-smei-crimson border border-red-200 px-2.5 py-1 rounded-md font-bold flex items-center gap-1 transition-all"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Add Supplier Option</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {suppliers.map((s, idx) => (
                    <div
                      key={s.id}
                      className="relative border border-gray-200/80 rounded-xl p-4 bg-gray-50/20 space-y-3 shadow-xs hover:shadow-md transition-shadow"
                    >
                      {isEditMode && suppliers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSupplier(s.id)}
                          className="absolute right-3 top-3 p-1 hover:bg-red-50 hover:text-red-600 text-gray-400 rounded transition-all"
                          title="Remove Supplier Option"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      <span className="inline-block bg-red-50 text-smei-crimson border border-red-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Supplier Option {idx + 1}
                      </span>

                      <div className="space-y-2.5">
                        {/* Supplier Name */}
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 mb-1">Supplier Name *</label>
                          <input
                            type="text"
                            required
                            disabled={!isEditMode}
                            className={`w-full text-xs font-semibold p-2 border rounded-xl outline-none focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson transition-all ${
                              errors[`supplier_name_${s.id}`] ? "border-rose-400 bg-rose-50/20" : "border-gray-200 bg-white"
                            }`}
                            value={s.name}
                            onChange={(e) => handleSupplierChange(s.id, "name", e.target.value)}
                            placeholder="Supplier Company Name"
                          />
                          {errors[`supplier_name_${s.id}`] && (
                            <p className="text-[9px] text-rose-500 mt-0.5 font-bold">{errors[`supplier_name_${s.id}`]}</p>
                          )}
                        </div>

                        {/* Contact Person */}
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 mb-1">Contact Person</label>
                          <input
                            type="text"
                            disabled={!isEditMode}
                            className="w-full text-xs font-semibold p-2 border border-gray-200 rounded-xl bg-white focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none transition-all"
                            value={s.contactPerson}
                            onChange={(e) => handleSupplierChange(s.id, "contactPerson", e.target.value)}
                            placeholder="Full name of contact"
                          />
                        </div>

                        {/* Contact No. */}
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 mb-1">Contact No.</label>
                          <input
                            type="text"
                            disabled={!isEditMode}
                            className="w-full text-xs font-semibold p-2 border border-gray-200 rounded-xl bg-white focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none font-mono transition-all"
                            value={s.contactNo}
                            onChange={(e) => handleSupplierChange(s.id, "contactNo", e.target.value)}
                            placeholder="Phone or Mobile number"
                          />
                        </div>

                        {/* Work Duration */}
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 mb-1">Work Duration</label>
                          <input
                            type="text"
                            disabled={!isEditMode}
                            className="w-full text-xs font-semibold p-2 border border-gray-200 rounded-xl bg-white focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none transition-all"
                            value={s.workDuration}
                            onChange={(e) => handleSupplierChange(s.id, "workDuration", e.target.value)}
                            placeholder="e.g. 3-5 Working Days"
                          />
                        </div>

                        {/* Warranty */}
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 mb-1">Warranty</label>
                          <input
                            type="text"
                            disabled={!isEditMode}
                            className="w-full text-xs font-semibold p-2 border border-gray-200 rounded-xl bg-white focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none transition-all"
                            value={s.warranty}
                            onChange={(e) => handleSupplierChange(s.id, "warranty", e.target.value)}
                            placeholder="e.g. 1 Year against defects"
                          />
                        </div>

                        {/* Payment Terms */}
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 mb-1">Payment Terms</label>
                          <input
                            type="text"
                            disabled={!isEditMode}
                            className="w-full text-xs font-semibold p-2 border border-gray-200 rounded-xl bg-white focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none transition-all"
                            value={s.paymentTerms}
                            onChange={(e) => handleSupplierChange(s.id, "paymentTerms", e.target.value)}
                            placeholder="e.g. Net 30 Days"
                          />
                        </div>

                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 3: DYNAMIC PARTS COMPARISON TABLE */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                  <h4 className="text-xs font-bold text-smei-crimson uppercase tracking-wide">
                    3. Parts Procurement Comparison Grid
                  </h4>
                  {isEditMode && (
                    <button
                      type="button"
                      onClick={handleAddPart}
                      className="text-xs bg-red-50 hover:bg-red-100 text-smei-crimson border border-red-200 px-2.5 py-1 rounded-md font-bold flex items-center gap-1 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Part Row</span>
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto border border-gray-100 rounded-xl shadow-xs bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-gray-600 font-bold uppercase border-b border-gray-200 text-[10px]">
                        <th className="py-3 px-4 w-12 text-center">No.</th>
                        <th className="py-3 px-4 min-w-[240px]">Part Description *</th>
                        {suppliers.map((s, idx) => (
                          <th key={s.id} className="py-3 px-4 text-right w-44 font-semibold">
                            {s.name || `Supplier Option ${idx + 1}`} (Price)
                          </th>
                        ))}
                        {isEditMode && <th className="py-3 px-4 text-center w-12">Act</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {parts.map((p, pIdx) => {
                        const lowestSupplierIds = getLowestPriceSupplierIds(p);
                        return (
                          <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                            <td className="py-2.5 px-4 text-center text-gray-500 font-mono">{pIdx + 1}</td>
                            
                            {/* Part Description */}
                            <td className="py-2.5 px-4">
                              <input
                                type="text"
                                required
                                disabled={!isEditMode}
                                className={`w-full text-xs p-1.5 border rounded-md focus:border-smei-crimson outline-none ${
                                  errors[`part_desc_${p.id}`] ? "border-rose-400 bg-rose-50/20" : "border-gray-200"
                                }`}
                                value={p.description}
                                onChange={(e) => handlePartDescChange(p.id, e.target.value)}
                                placeholder="Part Name or Description"
                              />
                              {errors[`part_desc_${p.id}`] && (
                                <p className="text-[9px] text-rose-500 mt-0.5 font-bold">{errors[`part_desc_${p.id}`]}</p>
                              )}
                            </td>

                            {/* Supplier Prices */}
                            {suppliers.map((s) => {
                              const isLowest = lowestSupplierIds.includes(s.id);
                              return (
                                <td
                                  key={s.id}
                                  className={`py-2.5 px-4 text-right transition-colors ${
                                    isLowest ? "bg-emerald-50/80 text-emerald-800" : ""
                                  }`}
                                >
                                  <div className="flex items-center justify-end gap-1 font-mono">
                                    <span className="text-gray-400 text-[10px]">₱</span>
                                    <input
                                      type="number"
                                      step="any"
                                      disabled={!isEditMode}
                                      className={`w-full min-w-[5.5rem] text-xs p-1.5 border rounded-xl text-right focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none transition-all ${
                                        isLowest
                                          ? "border-emerald-300 text-emerald-800 bg-emerald-50/30 font-bold"
                                          : "border-gray-200 bg-white"
                                      }`}
                                      value={p.prices[s.id] === 0 ? "" : p.prices[s.id]}
                                      onChange={(e) => handlePartPriceChange(p.id, s.id, e.target.value === "" ? 0 : Number(e.target.value))}
                                    />
                                  </div>
                                </td>
                              );
                            })}

                            {/* Delete Part Action */}
                            {isEditMode && (
                              <td className="py-2.5 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemovePart(p.id)}
                                  className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                  title="Delete Part Row"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}

                      {/* SUMMARY ROW: SUM OF PARTS */}
                      <tr className="bg-gray-50/50 border-t border-gray-200 text-[11px] font-bold text-gray-700">
                        <td colSpan={2} className="py-3 px-4 text-right uppercase tracking-wider">
                          Sum of Parts (Sub-Total):
                        </td>
                        {suppliers.map((s) => {
                          const calc = supplierCalculations.find((c) => c.supplierId === s.id);
                          return (
                            <td key={s.id} className="py-3 px-4 text-right font-mono text-gray-900">
                              {new Intl.NumberFormat("en-PH", {
                                style: "currency",
                                currency: "PHP",
                                minimumFractionDigits: 2,
                              }).format(calc ? calc.sum : 0)}
                            </td>
                          );
                        })}
                        {isEditMode && <td />}
                      </tr>

                      {/* SUMMARY ROW: TOTAL AMOUNT */}
                      <tr className="bg-red-50/10 text-[11px] font-extrabold text-smei-crimson border-b border-gray-200">
                        <td colSpan={2} className="py-3.5 px-4 text-right uppercase tracking-wider">
                          Total Amount:
                        </td>
                        {suppliers.map((s) => {
                          const calc = supplierCalculations.find((c) => c.supplierId === s.id);
                          return (
                            <td key={s.id} className="py-3.5 px-4 text-right font-mono text-base">
                              {new Intl.NumberFormat("en-PH", {
                                style: "currency",
                                currency: "PHP",
                                minimumFractionDigits: 2,
                              }).format(calc ? calc.total : 0)}
                            </td>
                          );
                        })}
                        {isEditMode && <td />}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* AUTOMATIC SUMMARY CARDS AND RECOMMENDATIONS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 border border-gray-200/60 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-red-100 text-smei-crimson rounded-xl">
                    <Calculator className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                      Recommended Best Option (Lowest Bid)
                    </span>
                    <span className="block font-extrabold text-emerald-700 text-base uppercase tracking-wide">
                      {recommended.name}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-gray-200 pt-3 md:pt-0 md:pl-4">
                  <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
                    <Calculator className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                      Best Aggregate Procurement Cost
                    </span>
                    <span className="block font-mono font-extrabold text-emerald-700 text-base">
                      {new Intl.NumberFormat("en-PH", {
                        style: "currency",
                        currency: "PHP",
                        minimumFractionDigits: 2,
                      }).format(recommended.total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* REMARKS */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700">Remarks / Recommendations</label>
                <textarea
                  disabled={!isEditMode}
                  rows={2}
                  className="w-full text-xs p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-smei-crimson resize-none bg-white"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Explain options selection reasoning, special instructions, or overall remarks..."
                />
              </div>

              {/* SECTION 4: WORKFLOW SIGNATORIES */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-smei-crimson uppercase tracking-wide border-b border-gray-100 pb-1.5">
                  4. Document Workflow Signatories
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Prepared By */}
                  <div className="space-y-2 p-3.5 border border-gray-100 bg-gray-50/50 rounded-xl">
                    <span className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider">1. Prepared By</span>
                    <div>
                      <input
                        type="text"
                        disabled={!isEditMode}
                        className="w-full text-xs font-semibold p-2.5 border rounded-xl border-gray-200 bg-white focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none transition-all"
                        value={preparedBy}
                        onChange={(e) => setPreparedBy(e.target.value)}
                        placeholder="Prepared By Name"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        disabled={!isEditMode}
                        className="w-full text-[11px] font-semibold p-2 border rounded-xl border-gray-200 bg-white text-gray-600 focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none transition-all"
                        value={preparedByPosition}
                        onChange={(e) => setPreparedByPosition(e.target.value)}
                        placeholder="Prepared By Position"
                      />
                    </div>
                  </div>

                  {/* Checked By */}
                  <div className="space-y-2 p-3.5 border border-gray-100 bg-gray-50/50 rounded-xl">
                    <span className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider">2. Checked By</span>
                    <div>
                      <input
                        type="text"
                        disabled={!isEditMode}
                        className="w-full text-xs font-semibold p-2.5 border rounded-xl border-gray-200 bg-white focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none transition-all"
                        value={checkedBy}
                        onChange={(e) => setCheckedBy(e.target.value)}
                        placeholder="Checked By Name"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        disabled={!isEditMode}
                        className="w-full text-[11px] font-semibold p-2 border rounded-xl border-gray-200 bg-white text-gray-600 focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none transition-all"
                        value={checkedByPosition}
                        onChange={(e) => setCheckedByPosition(e.target.value)}
                        placeholder="Checked By Position"
                      />
                    </div>
                  </div>

                  {/* Verified By */}
                  <div className="space-y-2 p-3.5 border border-gray-100 bg-gray-50/50 rounded-xl">
                    <span className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider">3. Verified By</span>
                    <div>
                      <input
                        type="text"
                        disabled={!isEditMode}
                        className="w-full text-xs font-semibold p-2.5 border rounded-xl border-gray-200 bg-white focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none transition-all"
                        value={verifiedBy}
                        onChange={(e) => setVerifiedBy(e.target.value)}
                        placeholder="Verified By Name"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        disabled={!isEditMode}
                        className="w-full text-[11px] font-semibold p-2 border rounded-xl border-gray-200 bg-white text-gray-600 focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none transition-all"
                        value={verifiedByPosition}
                        onChange={(e) => setVerifiedByPosition(e.target.value)}
                        placeholder="Verified By Position"
                      />
                    </div>
                  </div>

                  {/* Approved By */}
                  <div className="space-y-2 p-3.5 border border-gray-100 bg-gray-50/50 rounded-xl">
                    <span className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider">4. Approved By</span>
                    <div>
                      <input
                        type="text"
                        disabled={!isEditMode}
                        className="w-full text-xs font-semibold p-2.5 border rounded-xl border-gray-200 bg-white focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none transition-all"
                        value={approvedBy}
                        onChange={(e) => setApprovedBy(e.target.value)}
                        placeholder="Approved By Name"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        disabled={!isEditMode}
                        className="w-full text-[11px] font-semibold p-2 border rounded-xl border-gray-200 bg-white text-gray-600 focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none transition-all"
                        value={approvedByPosition}
                        onChange={(e) => setApprovedByPosition(e.target.value)}
                        placeholder="Approved By Position"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* FORM ACTION FOOTER */}
              <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  {isEditMode ? "Cancel" : "Close"}
                </button>
                {isEditMode && (
                  <button
                    type="submit"
                    className="px-5 py-2 bg-smei-crimson hover:bg-smei-darkred text-white text-sm font-semibold rounded-lg shadow-xs"
                  >
                    Save Canvass Sheet
                  </button>
                )}
              </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
