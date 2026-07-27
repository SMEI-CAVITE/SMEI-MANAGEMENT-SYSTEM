/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { PurchaseOrder, POItem, Supplier, User, UserRole, POStatus, Signatory } from "../types";
import { calculatePOFinancials } from "../store";
import { api } from "../lib/api";
import { motion } from "motion/react";
import { ArrowLeft, Save, Send, CheckCircle2, AlertTriangle, Printer, Trash2, Plus, RefreshCw, PenTool, Check, FileCheck, CircleSlash, XCircle, FileText, FileSpreadsheet } from "lucide-react";
import { exportPOToWord, exportPOToXLSM } from "../utils/wordExport";
import { formatRFSNo } from "../utils/templateMapping";
import { formatControlNumber } from "../utils/controlNumber";
import smeiLogo from "../assets/images/smei_logo_1782431389924.jpg";

interface POFormProps {
  po?: PurchaseOrder | null; // Null means create new
  suppliers: Supplier[];
  pos?: PurchaseOrder[];
  currentUser: User;
  onSave: (po: PurchaseOrder) => void;
  onCancel: () => void;
}

export default function POForm({
  po,
  suppliers,
  pos,
  currentUser,
  onSave,
  onCancel
}: POFormProps) {
  const isNew = !po;

  // 1. Supplier / Header Section State
  const [poNumber, setPoNumber] = useState("");
  const [rfsNumber, setRfsNumber] = useState("");
  const [poDate, setPoDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [recentlyUsedSuppliers, setRecentlyUsedSuppliers] = useState<Supplier[]>([]);
  const [attention, setAttention] = useState("");
  const [telNo, setTelNo] = useState("");
  const [faxNo, setFaxNo] = useState("");
  const [purpose, setPurpose] = useState("");
  const [poCategory, setPoCategory] = useState("");
  const [otherPoCategory, setOtherPoCategory] = useState("");
  const [category, setCategory] = useState("Vatable");

// ...
  const [items, setItems] = useState<POItem[]>([
    { id: "row-1", quantity: 1, unit: "pcs", description: "", unitPrice: 0, amount: 0 }
  ]);

  // Debounced description update
  const [debouncedDescription, setDebouncedDescription] = useState("");
  const descriptionTimeoutRef = useRef<NodeJS.Timeout>();

  const handleDescriptionChange = (id: string, value: string) => {
    // Update local state immediately
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, description: value } : item))
    );

    // Debounce the heavy calculation/sync
    if (descriptionTimeoutRef.current) clearTimeout(descriptionTimeoutRef.current);
    descriptionTimeoutRef.current = setTimeout(() => {
        setDebouncedDescription(value);
    }, 500);
  };
// ...

  // 3. Tax / VAT State
  const [discountVatAmount, setDiscountVatAmount] = useState(0);
  
  // Custom Override States
  const [overrideVat, setOverrideVat] = useState(false);
  const [vatableAmount, setVatableAmount] = useState(0);
  const [vat12, setVat12] = useState(0);
  const [vatExemptAmount, setVatExemptAmount] = useState(0);
  const [zeroRatedAmount, setZeroRatedAmount] = useState(0);
  const [partsEwtPercentage, setPartsEwtPercentage] = useState<number>(1.0);
  const [laborEwtPercentage, setLaborEwtPercentage] = useState<number>(2.0);
  const partsEwtRate = partsEwtPercentage / 100;
  const laborEwtRate = laborEwtPercentage / 100;
  const [partsEwt1, setPartsEwt1] = useState(0);
  const [laborEwt2, setLaborEwt2] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [currencySymbol, setCurrencySymbol] = useState("₱");

  // 4. Terms State
  const [paymentTerms, setPaymentTerms] = useState("");
  const [paymentTermsDropdown, setPaymentTermsDropdown] = useState("");
  const [paymentTermsOthers, setPaymentTermsOthers] = useState("");
  const [workDuration, setWorkDuration] = useState("");
  const [warranty, setWarranty] = useState("");
  const [warrantyDropdown, setWarrantyDropdown] = useState("");
  const [warrantyOthers, setWarrantyOthers] = useState("");
  const [remarks, setRemarks] = useState("");

  // 5. Workflow States
  const [status, setStatus] = useState<POStatus>("Draft");
  const [preparedBy, setPreparedBy] = useState("VICEDO, Lalaine");
  const [checkedBy, setCheckedBy] = useState("ORONGAN, Eliza C.");
  const [verifiedBy, setVerifiedBy] = useState("ROGADOR, Aprilyn");
  const [approvedBy, setApprovedBy] = useState("Agnes C. Vallejo");
  const [conforme, setConforme] = useState("");
  const [preparedByTitle, setPreparedByTitle] = useState("Impex/Purchasing Staff");
  const [checkedByTitle, setCheckedByTitle] = useState("Admin asst. Leader");
  const [verifiedByTitle, setVerifiedByTitle] = useState("Asst.Admin/Technical Manager");
  const [verifiedBy2, setVerifiedBy2] = useState("MILANTE, Maria Morena");
  const [verifiedBy2Title, setVerifiedBy2Title] = useState("Asst. Accounting Manager");
  const [approvedByTitle, setApprovedByTitle] = useState("Director");
  const [conformeTitle, setConformeTitle] = useState("Print name over the signature");
  const [excludePreparedBy, setExcludePreparedBy] = useState(false);
  const [excludeCheckedBy, setExcludeCheckedBy] = useState(false);
  const [excludeVerifiedBy, setExcludeVerifiedBy] = useState(false);
  const [excludeVerifiedBy2, setExcludeVerifiedBy2] = useState(false);
  const [excludeApprovedBy, setExcludeApprovedBy] = useState(false);
  const [excludeConforme, setExcludeConforme] = useState(false);
  const [additionalSignatories, setAdditionalSignatories] = useState<Signatory[]>([]);
  const [signatureText, setSignatureText] = useState("");
  const [signatureUrl, setSignatureUrl] = useState("");
  
  // Signature pad states
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  // Form validation state
  const [errors, setErrors] = useState<Record<string, string>>({});

  const initialValuesSet = useRef(false);

  // Dispatch editor open and close events for auto-sidebar-collapsing
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("smei-editor-opened"));
    return () => {
      window.dispatchEvent(new CustomEvent("smei-editor-closed"));
    };
  }, []);

  // Initialize values ref
  useEffect(() => {
    if (!po) {
      initialValuesSet.current = true;
    } else {
      const timer = setTimeout(() => {
        initialValuesSet.current = true;
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [po]);

  // Set global unsaved changes flag when fields change
  useEffect(() => {
    if (initialValuesSet.current) {
      window.smeiHasUnsavedChanges = true;
    }
  }, [
    poNumber,
    rfsNumber,
    poDate,
    deliveryDate,
    supplierId,
    attention,
    telNo,
    faxNo,
    purpose,
    poCategory,
    otherPoCategory,
    category,
    items,
    paymentTerms,
    workDuration,
    warranty,
    remarks,
    preparedBy,
    checkedBy,
    verifiedBy,
    verifiedBy2,
    approvedBy,
    conforme,
    excludePreparedBy,
    excludeCheckedBy,
    excludeVerifiedBy,
    excludeVerifiedBy2,
    excludeApprovedBy,
    excludeConforme,
    additionalSignatories,
    overrideVat,
    vatableAmount,
    vat12,
    vatExemptAmount,
    zeroRatedAmount,
    partsEwt1,
    laborEwt2,
    partsEwtPercentage,
    laborEwtPercentage,
    totalAmount
  ]);

  // Clean up global flag on unmount
  useEffect(() => {
    return () => {
      window.smeiHasUnsavedChanges = false;
    };
  }, []);

  // Compute recently used suppliers from POs list
  useEffect(() => {
    if (pos && pos.length > 0) {
      const uniqueIds = Array.from(new Set(pos.map(p => p.supplierId))).filter(Boolean);
      const activeRecentlyUsed = uniqueIds
        .map(id => suppliers.find(s => s.id === id))
        .filter((s): s is Supplier => !!s && s.status !== "Disabled")
        .slice(0, 3);
      setRecentlyUsedSuppliers(activeRecentlyUsed);
    }
  }, [pos, suppliers]);

  // 6. Pre-fill State on Load
  useEffect(() => {
    if (po) {
      setPoNumber((po.poNumber || "").toUpperCase());
      setRfsNumber(po.rfsNumber || "");
      setPoDate(po.poDate);
      setDeliveryDate(po.deliveryDate);
      setSupplierId(po.supplierId);
      setSupplierName(po.supplierName);
      setAttention(po.attention);
      setTelNo(po.telNo);
      setFaxNo(po.faxNo);
      setPurpose(po.purpose);
      setPoCategory(po.poCategory);
      const categoryList = [
        "Accounting Consumables Supplies", "Admin Consumables Supplies", "Building Repairs & Maintenance", "DA 75723", "DAU 3581", 
        "DB 1738 (Honda Wave-Red)", "EHS", "Forklift", "Forklift #1 (AMETCO)", "Forklift #2", "Forklift #3", "Forklift #4", 
        "Furniture and Equipment Maintenance", "713 DWC (Honda New Wave)", "OM Sales Consumables Supplies", "OM Sales Office Equipment", 
        "MGF 138", "NCO 9970", "NOW 6702", "NDW 3277", "NGF 8580", "TRAVIZ CBB6056", "New Honda Wave", "OM Sales", "Permit & Licenses", 
        "Production Consumables Supplies", "Production Equipment and Maintenance", "PWB Recycling Machine and Equipment", "Light Vehicles", 
        "Sales Representation", "Admin Representation", "RER 699", "RST 125", "Sales Consumables Supplies", "TMI 441"
      ];
      if (!categoryList.includes(po.poCategory)) {
        setPoCategory("Others");
        setOtherPoCategory(po.poCategory);
      }
      setCategory(po.category);
      setItems(po.items);
      setDiscountVatAmount(po.discountVatAmount);
      
      setVatableAmount(po.vatableAmount);
      setVat12(po.vat12);
      setVatExemptAmount(po.vatExemptAmount);
      setZeroRatedAmount(po.zeroRatedAmount);
      setPartsEwt1(po.partsEwt1);
      setLaborEwt2(po.laborEwt2);
      
      // Load Parts and Labor EWT Percentages
      let loadedPartsPct = 1.0;
      let loadedLaborPct = 2.0;
      
      if (po.partsEwt1 > 0 || po.ewtType === "Parts EWT") {
        loadedPartsPct = po.ewtPercentage !== undefined ? po.ewtPercentage : 1.0;
        loadedLaborPct = po.laborEwt2 > 0 ? 2.0 : 0.0;
      } else if (po.laborEwt2 > 0 || po.ewtType === "Labor EWT") {
        loadedLaborPct = po.ewtPercentage !== undefined ? po.ewtPercentage : 2.0;
        loadedPartsPct = po.partsEwt1 > 0 ? 1.0 : 0.0;
      } else {
        loadedPartsPct = 0.0;
        loadedLaborPct = 0.0;
      }
      
      setPartsEwtPercentage(loadedPartsPct);
      setLaborEwtPercentage(loadedLaborPct);
      setTotalAmount(po.totalAmount);

      setPaymentTerms(po.paymentTerms);
      // Initialize dropdown/others logic
      const paymentTermsOptions = [
        "CASH", "CASH/CHECK UPON DELIVERY", "50% Initial down payment for ceiling installation and full payment upon completion", 
        "15 working days upon completion of work", "50% Down Payment / 50% Upon Completion", "Cash on Delivery", 
        "Check payment upon delivery/service", "15 days upon delivery", "COD", "Cash on pick-up", 
        "50% DP and 50% Upon Completion", "COD/CASH", "100% payment upon pick up", "CASH UPON PURCHASE AND REPAIR", 
        "30 DAYS FULL PAYMENT UPON SUBMISSION OF RESULTS", "30 working days after pick-up/delivery", 
        "15 Working days upon Submission of Billing Statement", "N/A"
      ];
      if (paymentTermsOptions.includes(po.paymentTerms)) {
        setPaymentTermsDropdown(po.paymentTerms);
        setPaymentTermsOthers("");
      } else {
        setPaymentTermsDropdown("OTHERS");
        setPaymentTermsOthers(po.paymentTerms);
      }

      setWorkDuration(po.workDuration);

      setWarranty(po.warranty);
      const warrantyOptions = [
        "Subject for replacement if found with damage upon delivery/pick up", 
        "One year warranty for monitoring system equipment. No warranty for the accessories", 
        "7 Days", "One year", "1 year service warranty", 
        "Subject for replacement if found damage upon delivery/pickup", 
        "Lifetime warranty on Geotab Device (except fire and water damage)", 
        "6 months (Factory Defect) / Lifetime Free Service", 
        "7 Days Replacement and 3–6 months warranty in labor", "N/A"
      ];
      if (warrantyOptions.includes(po.warranty)) {
        setWarrantyDropdown(po.warranty);
        setWarrantyOthers("");
      } else {
        setWarrantyDropdown("OTHERS");
        setWarrantyOthers(po.warranty);
      }
      setRemarks(po.remarks);
      setCurrencySymbol(po.currencySymbol || "₱");

      setStatus(po.status);
      setPreparedBy(po.preparedBy);
      setPreparedByTitle(po.preparedByTitle || "Impex/Purchasing Staff");
      setCheckedBy(po.checkedBy || "");
      setCheckedByTitle(po.checkedByTitle || "Admin asst. Leader");
      setVerifiedBy(po.verifiedBy || "");
      setVerifiedByTitle(po.verifiedByTitle || "Asst.Admin/Technical Manager");
      setVerifiedBy2(po.verifiedBy2 || "");
      setVerifiedBy2Title(po.verifiedBy2Title || "Asst. Accounting Manager");
      setApprovedBy(po.approvedBy || "");
      setApprovedByTitle(po.approvedByTitle || "Director");
      setConforme(po.conforme || "");
      setConformeTitle("Print name over the signature");
      setExcludePreparedBy(!!po.excludePreparedBy);
      setExcludeCheckedBy(!!po.excludeCheckedBy);
      setExcludeVerifiedBy(!!po.excludeVerifiedBy);
      setExcludeVerifiedBy2(!!po.excludeVerifiedBy2);
      setExcludeApprovedBy(!!po.excludeApprovedBy);
      setExcludeConforme(!!po.excludeConforme);
      setAdditionalSignatories(po.additionalSignatories || []);
      setSignatureText(po.conforme || ""); // Default text sign is conforme
      setSignatureUrl(po.signature || "");
    } else {
      // Default Values for New PO
      setPoNumber("SMEI-2026-PENDING");
      api.getNextPONumber()
        .then(({ nextNumber }) => {
          setPoNumber(nextNumber);
        })
        .catch((err) => {
          console.error("Failed to load next PO number:", err);
          const numDigits = Math.floor(1000 + Math.random() * 9000);
          setPoNumber(`SMEI-2026-${numDigits}`);
        });

      setPoDate(new Date().toISOString().split("T")[0]);
      setDeliveryDate(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
      setPreparedBy("VICEDO, Lalaine");
      setPreparedByTitle("Impex/Purchasing Staff");
      setCheckedBy("ORONGAN, Eliza C.");
      setCheckedByTitle("Admin asst. Leader");
      setVerifiedBy("ROGADOR, Aprilyn");
      setVerifiedByTitle("Asst.Admin/Technical Manager");
      setVerifiedBy2("MILANTE, Maria Morena");
      setVerifiedBy2Title("Asst. Accounting Manager");
      setApprovedBy("Agnes C. Vallejo");
      setApprovedByTitle("Director");
      setConforme("");
      setConformeTitle("Supplier Authorized Rep");
      setStatus("Draft");
      setPaymentTerms("Net 30 Days");
      setPaymentTermsDropdown("OTHERS");
      setPaymentTermsOthers("Net 30 Days");
      setWorkDuration("15 Days");
      setWarranty("1 Year Warranty");
      setWarrantyDropdown("OTHERS");
      setWarrantyOthers("1 Year Warranty");
      setCurrencySymbol("₱");
      setExcludePreparedBy(false);
      setExcludeCheckedBy(false);
      setExcludeVerifiedBy(false);
      setExcludeVerifiedBy2(false);
      setExcludeApprovedBy(false);
      setExcludeConforme(false);
      
      setRfsNumber("2026-07-001");
      api.getNextRFSNumber()
        .then(({ nextNumber }) => {
          setRfsNumber(nextNumber);
        })
        .catch((err) => {
          console.error("Failed to load next RFS number for PO form:", err);
        });
    }
  }, [po, currentUser]);

  // 7. Auto-Calculate Financials on items/category change (unless manually overriden)
  const computed = calculatePOFinancials(items, category, discountVatAmount, partsEwtRate, laborEwtRate);



  // Sync Payment Terms
  useEffect(() => {
    if (paymentTermsDropdown === "OTHERS") {
      setPaymentTerms(paymentTermsOthers);
    } else {
      setPaymentTerms(paymentTermsDropdown);
    }
  }, [paymentTermsDropdown, paymentTermsOthers]);

  // Sync Warranty
  useEffect(() => {
    if (warrantyDropdown === "OTHERS") {
      setWarranty(warrantyOthers);
    } else {
      setWarranty(warrantyDropdown);
    }
  }, [warrantyDropdown, warrantyOthers]);

  useEffect(() => {
    if (!overrideVat) {
      setVatableAmount(computed.vatableAmount);
      setVat12(computed.vat12);
      setVatExemptAmount(computed.vatExemptAmount);
      setZeroRatedAmount(computed.zeroRatedAmount);
      setPartsEwt1(computed.partsEwt1);
      setLaborEwt2(computed.laborEwt2);
      setTotalAmount(computed.totalAmount);
    }
  }, [items, category, discountVatAmount, overrideVat, partsEwtRate, laborEwtRate]);

  // Auto calculate when reset
  const handleResetToAuto = () => {
    setOverrideVat(false);
    setVatableAmount(computed.vatableAmount);
    setVat12(computed.vat12);
    setVatExemptAmount(computed.vatExemptAmount);
    setZeroRatedAmount(computed.zeroRatedAmount);
    setPartsEwt1(computed.partsEwt1);
    setLaborEwt2(computed.laborEwt2);
    setTotalAmount(computed.totalAmount);
  };

  const currentGrossAmount = overrideVat
    ? (vatableAmount + vat12 + vatExemptAmount + zeroRatedAmount + partsEwt1 + laborEwt2)
    : computed.grossAmount;

  const currentTotalAmount = overrideVat
    ? (vatableAmount + vat12 + vatExemptAmount + zeroRatedAmount) - partsEwt1 - laborEwt2 - discountVatAmount
    : computed.totalAmount;

  // 8. Supplier Selection Event
  const handleSupplierSelect = (id: string) => {
    setSupplierId(id);
    const vendor = suppliers.find((s) => s.id === id);
    if (vendor) {
      setSupplierName(vendor.name);
      setAttention(vendor.attention);
      setTelNo(vendor.phone);
      setFaxNo(vendor.fax);
      setCategory(vendor.category.toLowerCase().includes("gas") || vendor.category.toLowerCase().includes("exempt") ? "VAT Exempt" : "Vatable");
    } else {
      setSupplierName("");
      setAttention("");
      setTelNo("");
      setFaxNo("");
    }
  };

  // 9. Items Grid Events
  const handleItemFieldChange = (id: string, field: keyof POItem, value: any) => {
    if (field === 'description') {
      handleDescriptionChange(id, value);
      return;
    }
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          if (field === "quantity" || field === "unitPrice") {
            const qty = field === "quantity" ? parseFloat(value) || 0 : item.quantity;
            const price = field === "unitPrice" ? parseFloat(value) || 0 : item.unitPrice;
            updatedItem.amount = qty * price;
          }
          return updatedItem;
        }
        return item;
      })
    );
  };

  const handleAddRow = () => {
    const newId = `row-${Date.now()}`;
    setItems((prev) => [
      ...prev,
      { id: newId, quantity: 1, unit: "pcs", description: "", unitPrice: 0, amount: 0 }
    ]);
  };

  const handleRemoveRow = (id: string) => {
    if (items.length === 1) return; // Keep at least one row
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addAdditionalSignatory = () => {
    const newSignatory: Signatory = {
      id: `sig-${Date.now()}`,
      name: "",
      role: "",
      status: "Pending"
    };
    setAdditionalSignatories([...additionalSignatories, newSignatory]);
  };

  const updateAdditionalSignatory = (id: string, updates: Partial<Signatory>) => {
    setAdditionalSignatories(additionalSignatories.map(sig => sig.id === id ? { ...sig, ...updates } : sig));
  };

  const removeAdditionalSignatory = (id: string) => {
    setAdditionalSignatories(additionalSignatories.filter(sig => sig.id !== id));
  };

  // 10. Form Submission
  const handleFormSave = (e: React.FormEvent, isSubmitting: boolean = false) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (isSubmitting) {
      if (!supplierName) newErrors.supplier = "Supplier is required.";
      if (!purpose) newErrors.purpose = "Purpose is required.";
      if (!poDate) newErrors.poDate = "PO Date is required.";
      if (!deliveryDate) newErrors.deliveryDate = "Delivery Date is required.";
      if (!category) newErrors.category = "Category is required.";

      items.forEach((item, index) => {
        if (!item.quantity || item.quantity <= 0) newErrors[`item_${index}_quantity`] = "Quantity must be greater than zero.";
        if (!item.unit) newErrors[`item_${index}_unit`] = "Unit is required.";
        if (!item.description.trim()) newErrors[`item_${index}_description`] = "Description is required.";
        if (item.unitPrice < 0) newErrors[`item_${index}_unitPrice`] = "Unit Price cannot be negative.";
      });
    } else {
      // For saving draft, the server still requires a supplier and at least one item
      if (!supplierName) newErrors.supplier = "Supplier is required to save a draft.";
      if (!items || items.length === 0) newErrors.items = "At least one item is required to save a draft.";
    }

    if (!poNumber) newErrors.poNumber = "PO Number is required.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Optional: Scroll to top to show errors
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setErrors({});

    const finalStatus = isSubmitting ? "Pending Review" : status;

    const savedPO: PurchaseOrder = {
      id: po?.id || `po-${Date.now()}`,
      poNumber,
      rfsNumber,
      poDate,
      deliveryDate,
      supplierId,
      supplierName,
      attention,
      telNo,
      faxNo,
      purpose,
      category,
      poCategory: poCategory === "Others" ? otherPoCategory : poCategory,
      items: items.map(item => ({
        ...item,
        quantity: typeof item.quantity === "number" ? item.quantity : (parseFloat(item.quantity) || 0),
        unitPrice: typeof item.unitPrice === "number" ? item.unitPrice : (parseFloat(item.unitPrice) || 0),
        amount: typeof item.amount === "number" ? item.amount : (parseFloat(item.amount) || 0),
      })),
      
      vatableAmount,
      vat12,
      vatExemptAmount,
      zeroRatedAmount,
      grossAmount: currentGrossAmount,
      discountVatAmount,
      partsEwt1,
      laborEwt2,
      ewtType: "Parts & Labor EWT",
      ewtPercentage: partsEwtPercentage,
      partsEwtPercentage,
      laborEwtPercentage,
      totalAmount: currentTotalAmount,

      paymentTerms,
      workDuration,
      warranty,
      remarks,

      preparedBy: excludePreparedBy ? "" : preparedBy,
      preparedByTitle: excludePreparedBy ? "" : preparedByTitle,
      checkedBy: excludeCheckedBy ? "" : (checkedBy || ""),
      checkedByTitle: excludeCheckedBy ? "" : (checkedByTitle || ""),
      verifiedBy: excludeVerifiedBy ? "" : (verifiedBy || ""),
      verifiedByTitle: excludeVerifiedBy ? "" : (verifiedByTitle || ""),
      verifiedBy2: excludeVerifiedBy2 ? "" : (verifiedBy2 || ""),
      verifiedBy2Title: excludeVerifiedBy2 ? "" : (verifiedBy2Title || ""),
      approvedBy: excludeApprovedBy ? "" : (approvedBy || ""),
      approvedByTitle: excludeApprovedBy ? "" : (approvedByTitle || ""),
      conforme: excludeConforme ? "" : (conforme || ""),
      conformeTitle: excludeConforme ? "" : (conformeTitle || ""),
      excludePreparedBy,
      excludeCheckedBy,
      excludeVerifiedBy,
      excludeVerifiedBy2,
      excludeApprovedBy,
      excludeConforme,
      additionalSignatories,
      signature: signatureUrl || undefined,
      dateApproved: status === "Approved" ? po?.dateApproved || new Date().toISOString().split("T")[0] : undefined,
      status: finalStatus as POStatus,
      currencySymbol,
      updatedAt: new Date().toISOString()
    };

    onSave(savedPO);
  };

  // 11. Workflows State Advancer (Roles Approval Buttons)
  const isViewer = currentUser.role === UserRole.Viewer;
  const isStaff = currentUser.role === UserRole.PurchasingStaff;
  const isHead = currentUser.role === UserRole.DepartmentHead;
  const isAccounting = currentUser.role === UserRole.AccountingStaff;
  const isDirector = currentUser.role === UserRole.Director;
  const isAdmin = currentUser.role === UserRole.Administrator;

  const triggerReviewAndCheck = async () => {
    try {
      const updated = await api.triggerWorkflow(po!.id, "Approve");
      onSave(updated);
    } catch (err: any) {
      alert(`Workflow transition failed: ${err.message}`);
    }
  };

  const triggerAccountingVerify = async () => {
    try {
      const updated = await api.triggerWorkflow(po!.id, "Verify");
      onSave(updated);
    } catch (err: any) {
      alert(`Workflow transition failed: ${err.message}`);
    }
  };

  const triggerDirectorApprove = async () => {
    try {
      const updated = await api.triggerWorkflow(po!.id, "Final Approve");
      onSave(updated);
    } catch (err: any) {
      alert(`Workflow transition failed: ${err.message}`);
    }
  };

  const triggerRejection = async () => {
    const reason = prompt("Please enter the rejection comment/reason:");
    if (reason === null) return; // cancelled prompt
    try {
      const updated = await api.triggerWorkflow(po!.id, "Reject", reason);
      onSave(updated);
    } catch (err: any) {
      alert(`Workflow transition failed: ${err.message}`);
    }
  };

  // 12. SignaturePad Events
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#8B0000"; // corporate dark red signature!

    const rect = canvas.getBoundingClientRect();
    let x, y;
    if ("touches" in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;
    if ("touches" in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureUrl("");
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL();
    setSignatureUrl(url);
    setShowSignaturePad(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatPHP = (val: number) => {
    return `${currencySymbol} ${val.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const currentPOData = useMemo<PurchaseOrder>(() => {
    return {
      id: po?.id || "temp-po-id",
      poNumber,
      rfsNumber,
      poDate,
      deliveryDate,
      supplierId,
      supplierName,
      attention,
      telNo,
      faxNo,
      purpose,
      category: poCategory === "Others" ? otherPoCategory : poCategory,
      items: items.map(item => ({
        ...item,
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || 0,
        amount: Number(item.amount) || 0
      })),
      paymentTerms: paymentTermsDropdown === "Others" ? paymentTermsOthers : paymentTermsDropdown,
      workDuration,
      warranty: warrantyDropdown === "Others" ? warrantyOthers : warrantyDropdown,
      remarks,
      preparedBy,
      checkedBy,
      verifiedBy,
      verifiedBy2,
      approvedBy,
      conforme,
      totalAmount,
      status,
      discountVatAmount,
      vatableAmount,
      vat12,
      vatExemptAmount,
      zeroRatedAmount,
      partsEwt1,
      laborEwt2,
      partsEwtPercentage,
      laborEwtPercentage,
      ewtType: "Parts & Labor EWT",
      ewtPercentage: partsEwtPercentage,
      excludePreparedBy,
      excludeCheckedBy,
      excludeVerifiedBy,
      excludeVerifiedBy2,
      excludeApprovedBy,
      excludeConforme,
      additionalSignatories,
      signatureUrl,
      created_by: po?.created_by || currentUser.fullName,
      createdAt: po?.createdAt || new Date().toISOString()
    };
  }, [
    po, poNumber, rfsNumber, poDate, deliveryDate, supplierId, supplierName,
    attention, telNo, faxNo, purpose, poCategory, otherPoCategory, items,
    paymentTermsDropdown, paymentTermsOthers, workDuration, warrantyDropdown,
    warrantyOthers, remarks, preparedBy, checkedBy, verifiedBy, verifiedBy2,
    approvedBy, conforme, totalAmount, status, discountVatAmount, vatableAmount,
    vat12, vatExemptAmount, zeroRatedAmount, partsEwt1, laborEwt2,
    partsEwtPercentage, laborEwtPercentage,
    excludePreparedBy, excludeCheckedBy, excludeVerifiedBy, excludeVerifiedBy2,
    excludeApprovedBy, excludeConforme, additionalSignatories, signatureUrl,
    currentUser
  ]);

  return (
    <div id="smei-po-form-container" className="p-4 md:p-10 max-w-7xl mx-auto space-y-6">
      
      {/* Top action header controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 no-print border-b border-gray-100 pb-4">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-800 font-semibold text-xs py-2 bg-gray-100 hover:bg-gray-200 px-3.5 rounded-xl transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Directory</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {!isNew && (
            <div className="flex flex-col gap-1.5">
              {po && (
                <div className="flex flex-col sm:flex-row gap-1.5">
                  <button
                    type="button"
                    onClick={() => exportPOToXLSM(po)}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2 px-3.5 rounded-xl shadow-sm transition-all"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Export Excel (.XLSM)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportPOToWord(po)}
                    className="inline-flex items-center gap-1.5 bg-[#2B579A] hover:bg-[#1C3A6A] text-white font-semibold text-xs py-2 px-3.5 rounded-xl shadow-sm transition-all"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Export Word (.DOCX)</span>
                  </button>
                </div>
              )}
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs py-2 px-3.5 rounded-xl shadow-sm transition-all justify-center"
              >
                <Printer className="w-4 h-4" />
                <span>Print</span>
              </button>
            </div>
          )}

          {/* Workflow approval buttons */}
          {po && po.status !== "Approved" && po.status !== "Cancelled" && (
            <div className="flex flex-wrap items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200">
              {/* Dept Head Action */}
              {isHead && po.status === "Pending Review" && !po.checkedBy && (
                <>
                  <button
                    onClick={triggerReviewAndCheck}
                    className="inline-flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white font-bold text-xs py-1.5 px-3 rounded-lg transition-all"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Check & Sign PO</span>
                  </button>
                  <button
                    onClick={triggerRejection}
                    className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-1.5 px-3 rounded-lg transition-all"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </>
              )}

              {/* Accounting Action */}
              {isAccounting && po.status === "Pending Review" && po.checkedBy && !po.verifiedBy && (
                <>
                  <button
                    onClick={triggerAccountingVerify}
                    className="inline-flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white font-bold text-xs py-1.5 px-3 rounded-lg transition-all"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>Verify VAT & Send to Director</span>
                  </button>
                  <button
                    onClick={triggerRejection}
                    className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-1.5 px-3 rounded-lg transition-all"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </>
              )}

              {/* Director Action */}
              {isDirector && po.status === "Pending Approval" && po.verifiedBy && !po.approvedBy && (
                <>
                  <button
                    onClick={triggerDirectorApprove}
                    className="inline-flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white font-bold text-xs py-1.5 px-3 rounded-lg transition-all"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Authorize PO</span>
                  </button>
                  <button
                    onClick={triggerRejection}
                    className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-1.5 px-3 rounded-lg transition-all"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Full Width Layout for PO Form */}
      <div className="w-full">
        {/* Form Editor */}
        <div className="w-full">
          <form onSubmit={(e) => handleFormSave(e, false)} className="bg-white p-6 sm:p-10 rounded-2xl shadow-xl border border-gray-100 print:shadow-none print:border-none print:p-0 space-y-8">
        
        {/* Printable Header Block */}
        <div className="flex flex-col md:flex-row items-center gap-6 justify-between border-b-2 border-smei-crimson pb-6">
          <div className="flex items-center gap-4">
            <div className="smei-logo-container p-1 border border-gray-200 rounded-lg shrink-0 bg-white">
              <img
                src={smeiLogo}
                alt="SMEI logo"
                className="smei-logo-img w-16 h-16 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold uppercase tracking-wider font-display text-smei-darkred">
                Southcoast Metal Enterprise, Inc.
              </h2>
              <p className="text-[10px] text-gray-500 max-w-sm mt-0.5">
                Block 8A, Phase 1, East Avenue, Cavite Economic Zone, Rosario, Cavite, Philippines
              </p>
              <p className="text-[9px] text-gray-400 font-mono">
                Tel No: +63-46-437-1234 / Fax: +63-46-437-5678
              </p>
            </div>
          </div>

          <div className="text-center md:text-right space-y-1 bg-red-50/50 p-4 rounded-xl border border-red-100 print:border-none print:bg-white min-w-[200px]">
            <h3 className="text-sm font-bold text-smei-crimson uppercase tracking-wider font-display">
              Purchase Order
            </h3>
            <div className="text-xs font-mono">
              <span className="text-gray-400">RFS No:</span>{" "}
              <span className="font-bold text-smei-darkred">{rfsNumber ? formatRFSNo(rfsNumber, poDate) : "N/A"}</span>
            </div>
            <div className="text-xs font-mono">
              <span className="text-gray-400">PO No:</span>{" "}
              <span className="font-bold text-smei-darkred">{poNumber || "N/A"}</span>
            </div>
            <div className="text-[10px] text-gray-500 font-semibold font-mono flex items-center justify-center md:justify-end gap-2">
              <span>Status:</span>
              <select
                value={status}
                onChange={(e) => {
                  const newStatus = e.target.value as POStatus;
                  if (status === "Approved" && !isAdmin) {
                    let requiredPin = "1234";
                    let isPinRequired = false;
                    try {
                      const savedSetting = localStorage.getItem("smei_security_config");
                      const globalEnabled = savedSetting === null ? false : JSON.parse(savedSetting).enabled;

                      if (globalEnabled) {
                        const saved = localStorage.getItem("smei_module_pins");
                        if (saved) {
                          const rules = JSON.parse(saved);
                          const rule = rules.find((r: any) => r.id === "po_status_change");
                          if (rule) {
                            requiredPin = rule.pinCode;
                            isPinRequired = rule.isEnabled;
                          }
                        } else {
                          isPinRequired = true;
                        }
                      }
                    } catch (e) {
                      console.error("Failed to parse module pin configuration", e);
                    }

                    if (isPinRequired) {
                      const pin = prompt("Admin PIN code required to change an Approved PO status:");
                      if (pin !== requiredPin) {
                        alert("Invalid PIN. Status not changed.");
                        return;
                      }
                    }
                  }
                  setStatus(newStatus);
                }}
                disabled={isViewer || (!isAdmin && status === "Approved")}
                className="uppercase text-smei-crimson font-extrabold bg-transparent border-b border-dashed border-red-200 hover:border-red-400 focus:outline-none cursor-pointer py-0.5 print:appearance-none print:border-none print:text-right"
              >
                <option value="Draft">DRAFT</option>
                <option value="Pending Review">PENDING REVIEW</option>
                <option value="Pending Approval">PENDING APPROVAL</option>
                <option value="Approved">APPROVED</option>
                <option value="Rejected">REJECTED</option>
                <option value="Cancelled">CANCELLED</option>
              </select>
            </div>
          </div>
        </div>

        {/* Supplier Information Section */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-smei-crimson uppercase tracking-wider border-b border-gray-100 pb-1.5">
            I. Supplier Information Section
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs font-sans">
            {/* LEFT SIDE */}
            <div className="space-y-4">
              {/* Supplier Searchable Text Input with Auto-Suggest */}
              <div className="space-y-1 relative" id="supplier-autosuggest-container">
                <label className="block font-bold text-gray-600 uppercase tracking-wide">
                  Supplier: <span className="text-smei-crimson font-bold">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    disabled={status !== "Draft" && !isAdmin}
                    value={supplierName}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSupplierName(value);
                      setSupplierId(""); // Clear supplier ID since it's a typed search/new name
                      setShowSuggestions(true);
                      setActiveSuggestionIndex(-1);
                      
                      // If the typed name matches an existing supplier exactly (case-insensitive and not disabled), pre-populate
                      const activeSuppliers = suppliers.filter(s => s.status !== "Disabled");
                      const match = activeSuppliers.find(s => s.name.toLowerCase() === value.trim().toLowerCase());
                      if (match) {
                        setSupplierId(match.id);
                        setAttention(match.attention || "");
                        setTelNo(match.phone || "");
                        setFaxNo(match.fax || "");
                        setCategory(match.category?.toLowerCase().includes("gas") || match.category?.toLowerCase().includes("exempt") ? "VAT Exempt" : "Vatable");
                      }
                    }}
                    onFocus={() => {
                      setShowSuggestions(true);
                      setActiveSuggestionIndex(-1);
                    }}
                    onBlur={() => {
                      // Small timeout to allow clicking suggestion item before dropdown disappears
                      setTimeout(() => {
                        setShowSuggestions(false);
                        setActiveSuggestionIndex(-1);
                      }, 250);
                    }}
                    onKeyDown={(e) => {
                      const activeSuppliers = suppliers.filter(s => s.status !== "Disabled");
                      const matches = activeSuppliers.filter(s => 
                        s.name.toLowerCase().includes(supplierName.toLowerCase())
                      );
                      const itemsToUse = supplierName.trim() === "" ? recentlyUsedSuppliers : matches;

                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setActiveSuggestionIndex(prev => 
                          prev < itemsToUse.length - 1 ? prev + 1 : prev
                        );
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setActiveSuggestionIndex(prev => (prev > 0 ? prev - 1 : -1));
                      } else if (e.key === "Enter" && activeSuggestionIndex >= 0) {
                        e.preventDefault();
                        const selected = itemsToUse[activeSuggestionIndex];
                        if (selected) {
                          setSupplierId(selected.id);
                          setSupplierName(selected.name);
                          setAttention(selected.attention || "");
                          setTelNo(selected.phone || "");
                          setFaxNo(selected.fax || "");
                          setCategory(selected.category?.toLowerCase().includes("gas") || selected.category?.toLowerCase().includes("exempt") ? "VAT Exempt" : "Vatable");
                          setShowSuggestions(false);
                          setActiveSuggestionIndex(-1);
                        }
                      }
                    }}
                    placeholder="Type supplier name manually..."
                    className={`w-full px-3.5 py-2 ${errors.supplier ? 'bg-red-50 border-red-500' : 'bg-gray-50 border-gray-200'} border rounded-xl font-medium focus:outline-none focus:ring-1.5 focus:ring-smei-crimson disabled:bg-gray-100`}
                  />
                  {supplierId && (
                    <span className="absolute right-3.5 top-2.5 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 font-mono">
                      REGISTERED
                    </span>
                  )}
                </div>
                {errors.supplier && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-red-600">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{errors.supplier}</span>
                  </div>
                )}

                {/* Suggestions Dropdown overlay */}
                {showSuggestions && (() => {
                  const activeSuppliers = suppliers.filter(s => s.status !== "Disabled");
                  const matches = activeSuppliers.filter(s => 
                    s.name.toLowerCase().includes(supplierName.toLowerCase())
                  );

                  // Decide whether to show recently used suppliers (if input is empty) or filtered matches
                  const isQueryEmpty = supplierName.trim() === "";
                  const showRecent = isQueryEmpty && recentlyUsedSuppliers.length > 0;
                  const listToRender = showRecent ? recentlyUsedSuppliers : matches;

                  if (listToRender.length === 0) return null;

                  return (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto divide-y divide-gray-100">
                      {showRecent && (
                        <div className="px-3 py-1.5 bg-gray-50 text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono">
                          Recently Used Partners
                        </div>
                      )}
                      {listToRender.map((sup, index) => (
                        <button
                          key={sup.id}
                          type="button"
                          className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors flex items-center justify-between cursor-pointer ${
                            index === activeSuggestionIndex 
                              ? "bg-red-50 text-smei-crimson font-bold" 
                              : "hover:bg-red-50/60 hover:text-smei-crimson text-gray-700"
                          }`}
                          onMouseDown={() => {
                            setSupplierId(sup.id);
                            setSupplierName(sup.name);
                            setAttention(sup.attention || "");
                            setTelNo(sup.phone || "");
                            setFaxNo(sup.fax || "");
                            setCategory(sup.category?.toLowerCase().includes("gas") || sup.category?.toLowerCase().includes("exempt") ? "VAT Exempt" : "Vatable");
                            setShowSuggestions(false);
                            setActiveSuggestionIndex(-1);
                          }}
                        >
                          <span>{sup.name}</span>
                          <span className="text-[10px] text-gray-400 font-mono italic">
                            {sup.category || "General"}
                          </span>
                        </button>
                      ))}
                      
                      {/* Dropdown Footer showing count metrics */}
                      <div className="px-3.5 py-1.5 bg-gray-50/50 text-[9px] text-gray-400 font-mono flex items-center justify-between">
                        <span>
                          {isQueryEmpty ? "Showing recently used" : `Showing ${matches.length} matches`}
                        </span>
                        <span>{activeSuppliers.length} active suppliers total</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Attention contact person */}
              <div className="space-y-1">
                <label className="block font-bold text-gray-600 uppercase tracking-wide">Attention:</label>
                <input
                  type="text"
                  disabled={status !== "Draft" && !isAdmin}
                  value={attention}
                  onChange={(e) => setAttention(e.target.value)}
                  placeholder="e.g. Arthur Santos"
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1.5 focus:ring-smei-crimson disabled:bg-gray-100"
                />
              </div>

              {/* Phone/Fax Numbers */}
              <div className="space-y-1">
                <label className="block font-bold text-gray-600 uppercase tracking-wide">Tel No. / Fax No.:</label>
                <input
                  type="text"
                  disabled={status !== "Draft" && !isAdmin}
                  value={telNo}
                  onChange={(e) => setTelNo(e.target.value)}
                  placeholder="e.g. +63-46-437-1234"
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1.5 focus:ring-smei-crimson disabled:bg-gray-100"
                />
              </div>

              {/* Subject */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block font-bold text-gray-600 uppercase tracking-wide">
                    Purpose: <span className="text-smei-crimson font-bold">*</span>
                  </label>
                </div>
                <input
                  type="text"
                  required
                  disabled={status !== "Draft" && !isAdmin}
                  value={purpose}
                  onChange={(e) => {
                    setPurpose(e.target.value);
                    if (errors.purpose) setErrors(prev => ({ ...prev, purpose: "" }));
                  }}
                  placeholder="e.g. Structural steel reinforcement support girders"
                  className={`w-full px-3.5 py-2 ${errors.purpose ? 'bg-red-50 border-red-500' : 'bg-gray-50 border-gray-200'} border rounded-xl focus:outline-none focus:ring-1.5 focus:ring-smei-crimson disabled:bg-gray-100`}
                />
                {errors.purpose && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-red-600">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{errors.purpose}</span>
                  </div>
                )}
              </div>

              {/* Category */}
              <div className="space-y-1">
                <label className="block font-bold text-gray-600 uppercase tracking-wide">PO Category:</label>
                <select
                  disabled={status !== "Draft" && !isAdmin}
                  value={poCategory}
                  onChange={(e) => {
                    setPoCategory(e.target.value);
                  }}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1.5 focus:ring-smei-crimson disabled:bg-gray-100 font-semibold text-gray-700"
                  required
                >
                  <option value="" disabled>Select Category</option>
                  <option value="Accounting Consumables Supplies">Accounting Consumables Supplies</option>
                  <option value="Admin Consumables Supplies">Admin Consumables Supplies</option>
                  <option value="Building Repairs & Maintenance">Building Repairs & Maintenance</option>
                  <option value="DA 75723">DA 75723</option>
                  <option value="DAU 3581">DAU 3581</option>
                  <option value="DB 1738 (Honda Wave-Red)">DB 1738 (Honda Wave-Red)</option>
                  <option value="EHS">EHS</option>
                  <option value="Forklift">Forklift</option>
                  <option value="Forklift #1 (AMETCO)">Forklift #1 (AMETCO)</option>
                  <option value="Forklift #2">Forklift #2</option>
                  <option value="Forklift #3">Forklift #3</option>
                  <option value="Forklift #4">Forklift #4</option>
                  <option value="Furniture and Equipment Maintenance">Furniture and Equipment Maintenance</option>
                  <option value="713 DWC (Honda New Wave)">713 DWC (Honda New Wave)</option>
                  <option value="OM Sales Consumables Supplies">OM Sales Consumables Supplies</option>
                  <option value="OM Sales Office Equipment">OM Sales Office Equipment</option>
                  <option value="MGF 138">MGF 138</option>
                  <option value="NCO 9970">NCO 9970</option>
                  <option value="NOW 6702">NOW 6702</option>
                  <option value="NDW 3277">NDW 3277</option>
                  <option value="NGF 8580">NGF 8580</option>
                  <option value="TRAVIZ CBB6056">TRAVIZ CBB6056</option>
                  <option value="New Honda Wave">New Honda Wave</option>
                  <option value="OM Sales">OM Sales</option>
                  <option value="Permit & Licenses">Permit & Licenses</option>
                  <option value="Production Consumables Supplies">Production Consumables Supplies</option>
                  <option value="Production Equipment and Maintenance">Production Equipment and Maintenance</option>
                  <option value="PWB Recycling Machine and Equipment">PWB Recycling Machine and Equipment</option>
                  <option value="Light Vehicles">Light Vehicles</option>
                  <option value="Sales Representation">Sales Representation</option>
                  <option value="Admin Representation">Admin Representation</option>
                  <option value="RER 699">RER 699</option>
                  <option value="RST 125">RST 125</option>
                  <option value="Sales Consumables Supplies">Sales Consumables Supplies</option>
                  <option value="TMI 441">TMI 441</option>
                  <option value="Others">Others</option>
                </select>
                {poCategory === "Others" && (
                  <input
                    type="text"
                    disabled={status !== "Draft" && !isAdmin}
                    value={otherPoCategory}
                    onChange={(e) => setOtherPoCategory(e.target.value)}
                    placeholder="Specify other category..."
                    className="w-full mt-2 px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1.5 focus:ring-smei-crimson disabled:bg-gray-100"
                  />
                )}
              </div>
            </div>

            {/* RIGHT SIDE */}
            <div className="space-y-4">
              {/* RFS No. */}
              <div className="space-y-1">
                <label className="block font-bold text-gray-600 uppercase tracking-wide">RFS No.:</label>
                <input
                  type="text"
                  value={rfsNumber}
                  onChange={(e) => setRfsNumber(e.target.value)}
                  placeholder="e.g. 2026-07-001"
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1.5 focus:ring-smei-crimson disabled:bg-gray-100 font-mono font-bold"
                />
              </div>

              {/* PO Number */}
              <div className="space-y-1">
                <label className="block font-bold text-gray-600 uppercase tracking-wide">
                  PO Number: <span className="text-smei-crimson font-bold">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={!isNew && !isAdmin}
                  value={poNumber}
                  onChange={(e) => {
                    setPoNumber(formatControlNumber(e.target.value, "poNumber"));
                    if (errors.poNumber) setErrors(prev => ({ ...prev, poNumber: "" }));
                  }}
                  placeholder="e.g. SMEI-2026-0001"
                  className={`w-full px-3.5 py-2 ${errors.poNumber ? 'bg-red-50 border-red-500' : 'bg-gray-50 border-gray-200'} border rounded-xl focus:outline-none focus:ring-1.5 focus:ring-smei-crimson disabled:bg-gray-100 font-mono font-bold`}
                />
                {errors.poNumber && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-red-600">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{errors.poNumber}</span>
                  </div>
                )}
              </div>

              {/* PO Date */}
              <div className="space-y-1">
                <label className="block font-bold text-gray-600 uppercase tracking-wide">
                  PO Date: <span className="text-smei-crimson font-bold">*</span>
                </label>
                <input
                  type="date"
                  required
                  disabled={status !== "Draft" && !isAdmin}
                  value={poDate}
                  onChange={(e) => {
                    setPoDate(e.target.value);
                    if (errors.poDate) setErrors(prev => ({ ...prev, poDate: "" }));
                  }}
                  className={`w-full px-3.5 py-2 ${errors.poDate ? 'bg-red-50 border-red-500' : 'bg-gray-50 border-gray-200'} border rounded-xl font-mono focus:outline-none focus:ring-1.5 focus:ring-smei-crimson disabled:bg-gray-100`}
                />
                {errors.poDate && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-red-600">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{errors.poDate}</span>
                  </div>
                )}
              </div>

              {/* Delivery Date */}
              <div className="space-y-1">
                <label className="block font-bold text-gray-600 uppercase tracking-wide">
                  Delivery Date: <span className="text-smei-crimson font-bold">*</span>
                </label>
                <input
                  type="date"
                  required
                  disabled={status !== "Draft" && !isAdmin}
                  value={deliveryDate}
                  onChange={(e) => {
                    setDeliveryDate(e.target.value);
                    if (errors.deliveryDate) setErrors(prev => ({ ...prev, deliveryDate: "" }));
                  }}
                  className={`w-full px-3.5 py-2 ${errors.deliveryDate ? 'bg-red-50 border-red-500' : 'bg-gray-50 border-gray-200'} border rounded-xl font-mono focus:outline-none focus:ring-1.5 focus:ring-smei-crimson disabled:bg-gray-100`}
                />
                {errors.deliveryDate && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-red-600">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{errors.deliveryDate}</span>
                  </div>
                )}
              </div>

              {/* Subject */}
              <div className="space-y-1">
                <label className="block font-bold text-gray-600 uppercase tracking-wide">Tax Category:</label>
                <select
                  disabled={status !== "Draft" && !isAdmin}
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    if (errors.category) setErrors(prev => ({ ...prev, category: "" }));
                  }}
                  className={`w-full px-3.5 py-2 ${errors.category ? 'bg-red-50 border-red-500' : 'bg-gray-50 border-gray-200'} border rounded-xl focus:outline-none focus:ring-1.5 focus:ring-smei-crimson disabled:bg-gray-100 font-semibold text-gray-700`}
                >
                  <option value="Vatable">Vatable</option>
                  <option value="Zero Rated">Zero Rated</option>
                  <option value="VAT Exempt">VAT Exempt</option>
                </select>
                {errors.category && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-red-600">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{errors.category}</span>
                  </div>
                )}
              </div>

              {/* Currency Symbol */}
              <div className="space-y-1">
                <label className="block font-bold text-gray-600 uppercase tracking-wide text-smei-crimson">Currency Symbol (PO Print):</label>
                <select
                  disabled={status !== "Draft" && !isAdmin}
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1.5 focus:ring-smei-crimson disabled:bg-gray-100 font-semibold text-gray-700"
                >
                  <option value="₱">₱ (PHP)</option>
                  <option value="$">$ (USD)</option>
                  <option value="€">€ (EUR)</option>
                  <option value="¥">¥ (JPY)</option>
                  <option value="£">£ (GBP)</option>
                  <option value="S$">S$ (SGD)</option>
                  <option value="RM">RM (MYR)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Item Details Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
            <h3 className="text-xs font-bold text-smei-crimson uppercase tracking-wider">
              II. Item Details Table
            </h3>
            {status === "Draft" && (
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 bg-red-50 text-smei-crimson border border-red-100 hover:bg-smei-crimson hover:text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item Line</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto border border-gray-100 rounded-xl">
            <table id="smei-items-table" className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                  <th className="py-3 px-3 font-display text-center w-16">Quantity</th>
                  <th className="py-3 px-3 font-display w-24">Unit</th>
                  <th className="py-3 px-3 font-display">Name / Description of Item</th>
                  <th className="py-3 px-3 font-display text-right w-36 pr-5">Unit Price (PHP)</th>
                  <th className="py-3 px-3 font-display text-right w-36 pr-5">Amount (PHP)</th>
                  {status === "Draft" && <th className="py-3 px-3 text-center w-12 no-print">Remove</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, index) => (
                  <tr key={item.id} className={index % 2 === 1 ? "bg-gray-50/20" : "bg-white"}>
                    {/* Quantity */}
                    <td className="py-2.5 px-3 align-top">
                      <input
                        type="number"
                        min="1"
                        step="any"
                        disabled={status !== "Draft" && !isAdmin}
                        value={item.quantity}
                        onChange={(e) => {
                          handleItemFieldChange(item.id, "quantity", e.target.value);
                          if (errors[`item_${index}_quantity`]) setErrors(prev => ({ ...prev, [`item_${index}_quantity`]: "" }));
                        }}
                        className={`w-full text-center py-1.5 ${errors[`item_${index}_quantity`] ? 'bg-red-50 border-red-500' : 'bg-gray-50/50 border-gray-200'} border rounded-lg focus:outline-none focus:ring-1 focus:ring-smei-crimson font-mono font-semibold`}
                      />
                      {errors[`item_${index}_quantity`] && (
                        <div className="text-[10px] text-red-600 mt-1 text-center font-medium leading-tight">{errors[`item_${index}_quantity`]}</div>
                      )}
                    </td>

                    {/* Unit */}
                    <td className="py-2.5 px-3 align-top">
                      <input
                        type="text"
                        disabled={status !== "Draft" && !isAdmin}
                        value={item.unit}
                        onChange={(e) => {
                          handleItemFieldChange(item.id, "unit", e.target.value);
                          if (errors[`item_${index}_unit`]) setErrors(prev => ({ ...prev, [`item_${index}_unit`]: "" }));
                        }}
                        placeholder="pcs, lot, box"
                        className={`w-full py-1.5 px-2 ${errors[`item_${index}_unit`] ? 'bg-red-50 border-red-500' : 'bg-gray-50/50 border-gray-200'} border rounded-lg focus:outline-none focus:ring-1 focus:ring-smei-crimson font-medium text-center`}
                      />
                      {errors[`item_${index}_unit`] && (
                        <div className="text-[10px] text-red-600 mt-1 text-center font-medium leading-tight">{errors[`item_${index}_unit`]}</div>
                      )}
                    </td>

                    {/* Description */}
                    <td className="py-2.5 px-3 align-top">
                      <div className="relative">
                        <input
                          type="text"
                          required
                          maxLength={400}
                          disabled={status !== "Draft" && !isAdmin}
                          value={item.description}
                          onChange={(e) => {
                            handleItemFieldChange(item.id, "description", e.target.value.slice(0, 400));
                            if (errors[`item_${index}_description`]) setErrors(prev => ({ ...prev, [`item_${index}_description`]: "" }));
                          }}
                          placeholder="Item name, industrial description, specifications..."
                          className={`w-full py-1.5 pl-3.5 pr-14 ${errors[`item_${index}_description`] ? 'bg-red-50 border-red-500' : 'bg-gray-50/50 border-gray-200'} border rounded-lg focus:outline-none focus:ring-1 focus:ring-smei-crimson text-gray-800`}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 font-mono select-none pointer-events-none">
                          {(item.description || "").length}/400
                        </span>
                      </div>
                      {errors[`item_${index}_description`] && (
                        <div className="text-[10px] text-red-600 mt-1 font-medium leading-tight">{errors[`item_${index}_description`]}</div>
                      )}
                    </td>

                    {/* Unit Price */}
                    <td className="py-2.5 px-3 align-top pr-5">
                      <input
                        type="text"
                        disabled={status !== "Draft" && !isAdmin}
                        value={item.unitPrice}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.]/g, '');
                          handleItemFieldChange(item.id, "unitPrice", val);
                          if (errors[`item_${index}_unitPrice`]) setErrors(prev => ({ ...prev, [`item_${index}_unitPrice`]: "" }));
                        }}
                        className={`w-full text-right py-1.5 px-2 ${errors[`item_${index}_unitPrice`] ? 'bg-red-50 border-red-500' : 'bg-gray-50/50 border-gray-200'} border rounded-lg focus:outline-none focus:ring-1 focus:ring-smei-crimson font-mono font-bold`}
                      />
                      {errors[`item_${index}_unitPrice`] && (
                        <div className="text-[10px] text-red-600 mt-1 text-right font-medium leading-tight">{errors[`item_${index}_unitPrice`]}</div>
                      )}
                    </td>

                    {/* Total Amount */}
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-700 pr-5 align-top">
                      {formatPHP(item.amount)}
                    </td>

                    {/* Action */}
                    {status === "Draft" && (
                      <td className="py-2.5 px-3 text-center no-print">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(item.id)}
                          disabled={items.length === 1}
                          className="p-1.5 text-gray-400 hover:text-smei-crimson hover:bg-red-50 rounded-lg disabled:opacity-30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* VAT and EWT Computation Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
          
          {/* Terms Section (Left side) */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-smei-crimson uppercase tracking-wider border-b border-gray-100 pb-1.5">
              III. Terms & Conditions Section
            </h3>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-bold text-gray-600 uppercase tracking-wide">Payment Terms:</label>
                  <select
                    disabled={status !== "Draft" && !isAdmin}
                    value={paymentTermsDropdown}
                    onChange={(e) => setPaymentTermsDropdown(e.target.value)}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
                  >
                    {[
                      "CASH", "CASH/CHECK UPON DELIVERY", "50% Initial down payment for ceiling installation and full payment upon completion", 
                      "15 working days upon completion of work", "50% Down Payment / 50% Upon Completion", "Cash on Delivery", 
                      "Check payment upon delivery/service", "15 days upon delivery", "COD", "Cash on pick-up", 
                      "50% DP and 50% Upon Completion", "COD/CASH", "100% payment upon pick up", "CASH UPON PURCHASE AND REPAIR", 
                      "30 DAYS FULL PAYMENT UPON SUBMISSION OF RESULTS", "30 working days after pick-up/delivery", 
                      "15 Working days upon Submission of Billing Statement", "N/A", "OTHERS"
                    ].map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                  {paymentTermsDropdown === "OTHERS" && (
                    <input
                      type="text"
                      disabled={status !== "Draft" && !isAdmin}
                      value={paymentTermsOthers}
                      onChange={(e) => setPaymentTermsOthers(e.target.value)}
                      placeholder="Specify Payment Terms..."
                      className="w-full mt-2 px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-gray-600 uppercase tracking-wide">Work Duration:</label>
                  <input
                    type="text"
                    disabled={status !== "Draft" && !isAdmin}
                    value={workDuration}
                    onChange={(e) => setWorkDuration(e.target.value)}
                    placeholder="e.g. 15 Days from NTP"
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-600 uppercase tracking-wide">Warranty Clause:</label>
                <select
                  disabled={status !== "Draft" && !isAdmin}
                  value={warrantyDropdown}
                  onChange={(e) => setWarrantyDropdown(e.target.value)}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
                >
                  {[
                    "Subject for replacement if found with damage upon delivery/pick up", 
                    "One year warranty for monitoring system equipment. No warranty for the accessories", 
                    "7 Days", "One year", "1 year service warranty", 
                    "Subject for replacement if found damage upon delivery/pickup", 
                    "Lifetime warranty on Geotab Device (except fire and water damage)", 
                    "6 months (Factory Defect) / Lifetime Free Service", 
                    "7 Days Replacement and 3–6 months warranty in labor", "N/A", "OTHERS"
                  ].map(option => <option key={option} value={option}>{option}</option>)}
                </select>
                {warrantyDropdown === "OTHERS" && (
                  <input
                    type="text"
                    disabled={status !== "Draft" && !isAdmin}
                    value={warrantyOthers}
                    onChange={(e) => setWarrantyOthers(e.target.value)}
                    placeholder="Specify Warranty..."
                    className="w-full mt-2 px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
                  />
                )}
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-600 uppercase tracking-wide">Special Instructions / Remarks:</label>
                <textarea
                  rows={4}
                  disabled={status !== "Draft" && !isAdmin}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Deliveries must be loaded with protective crane straps."
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* Actuary VAT/EWT computation section (Right side) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
              <h3 className="text-xs font-bold text-smei-crimson uppercase tracking-wider">
                IV. VAT & Amount Computation Section
              </h3>
              
              <div className="flex items-center gap-1.5 text-[10px] no-print">
                {overrideVat ? (
                  <button
                    type="button"
                    onClick={handleResetToAuto}
                    className="font-bold text-smei-crimson hover:underline flex items-center gap-0.5"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Auto-Align Formula</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOverrideVat(true)}
                    className="text-gray-500 hover:text-smei-crimson font-semibold hover:underline"
                    title="Let Accounting adjust custom numbers manually"
                  >
                    Customize Values
                  </button>
                )}
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-2.5 text-xs">
              
              {/* Vatable Amount */}
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">Vatable Amount</span>
                <input
                  type="number"
                  disabled={!overrideVat}
                  value={overrideVat ? vatableAmount : computed.vatableAmount}
                  onChange={(e) => setVatableAmount(parseFloat(e.target.value) || 0)}
                  className={`w-32 text-right px-2 py-0.5 rounded font-mono font-bold ${overrideVat ? "bg-white border border-gray-300" : "bg-transparent text-gray-700"}`}
                />
              </div>

              {/* 12% VAT */}
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">12% VAT</span>
                <input
                  type="number"
                  disabled={!overrideVat}
                  value={overrideVat ? vat12 : computed.vat12}
                  onChange={(e) => setVat12(parseFloat(e.target.value) || 0)}
                  className={`w-32 text-right px-2 py-0.5 rounded font-mono font-bold ${overrideVat ? "bg-white border border-gray-300" : "bg-transparent text-gray-700"}`}
                />
              </div>

              {/* VAT Exempt Amount */}
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">VAT Exempt Amount</span>
                <input
                  type="number"
                  disabled={!overrideVat}
                  value={overrideVat ? vatExemptAmount : computed.vatExemptAmount}
                  onChange={(e) => setVatExemptAmount(parseFloat(e.target.value) || 0)}
                  className={`w-32 text-right px-2 py-0.5 rounded font-mono font-bold ${overrideVat ? "bg-white border border-gray-300" : "bg-transparent text-gray-700"}`}
                />
              </div>

              {/* Zero Rated Amount */}
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">Zero Rated Amount</span>
                <input
                  type="number"
                  disabled={!overrideVat}
                  value={overrideVat ? zeroRatedAmount : computed.zeroRatedAmount}
                  onChange={(e) => setZeroRatedAmount(parseFloat(e.target.value) || 0)}
                  className={`w-32 text-right px-2 py-0.5 rounded font-mono font-bold ${overrideVat ? "bg-white border border-gray-300" : "bg-transparent text-gray-700"}`}
                />
              </div>

              {/* Total Amount */}
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">Total Amount</span>
                <span className="font-mono font-bold text-gray-800 pr-2">
                  {formatPHP(overrideVat ? (vatableAmount + vat12 + vatExemptAmount + zeroRatedAmount) : (computed.vatableAmount + computed.vat12 + computed.vatExemptAmount + computed.zeroRatedAmount))}
                </span>
              </div>

              <div className="border-t border-dashed border-gray-300 my-2 pt-1 font-bold text-gray-400 uppercase tracking-widest text-[9px]">
                Less
              </div>

              {/* Gross Amount */}
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">Gross Amount</span>
                <span className="font-mono font-bold text-gray-800 pr-2">
                  {formatPHP(currentGrossAmount)}
                </span>
              </div>

              {/* Parts EWT */}
              <div className="space-y-1.5 py-1.5 border-t border-gray-200/60">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 font-medium flex items-center gap-1">
                    <span>Parts EWT</span>
                    <span className="text-[10px] bg-red-50 text-smei-crimson font-bold px-1.5 py-0.5 rounded border border-red-200">
                      {partsEwtPercentage}%
                    </span>
                  </span>
                  <input
                    type="number"
                    disabled={!overrideVat}
                    value={overrideVat ? partsEwt1 : computed.partsEwt1}
                    onChange={(e) => setPartsEwt1(parseFloat(e.target.value) || 0)}
                    className={`w-32 text-right px-2 py-0.5 rounded font-mono font-bold ${
                      overrideVat ? "bg-white border border-gray-300" : "bg-transparent text-gray-700"
                    }`}
                  />
                </div>
                
                <div className="flex items-center gap-1.5 justify-end text-[10px] no-print">
                  <span className="text-gray-400 font-semibold uppercase tracking-wider">Parts EWT Rate:</span>
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={partsEwtPercentage}
                      disabled={status !== "Draft" && !isAdmin}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        setPartsEwtPercentage(parseFloat(val) || 0);
                      }}
                      className="w-10 text-center border border-gray-200 rounded px-1 py-0.5 text-[10px] font-bold font-mono bg-white"
                    />
                    <span className="ml-0.5 text-gray-500 font-bold">%</span>
                  </div>
                </div>
              </div>

              {/* Labor EWT */}
              <div className="space-y-1.5 py-1.5 border-t border-gray-200/60">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 font-medium flex items-center gap-1">
                    <span>Labor EWT</span>
                    <span className="text-[10px] bg-red-50 text-smei-crimson font-bold px-1.5 py-0.5 rounded border border-red-200">
                      {laborEwtPercentage}%
                    </span>
                  </span>
                  <input
                    type="number"
                    disabled={!overrideVat}
                    value={overrideVat ? laborEwt2 : computed.laborEwt2}
                    onChange={(e) => setLaborEwt2(parseFloat(e.target.value) || 0)}
                    className={`w-32 text-right px-2 py-0.5 rounded font-mono font-bold ${
                      overrideVat ? "bg-white border border-gray-300" : "bg-transparent text-gray-700"
                    }`}
                  />
                </div>
                
                <div className="flex items-center gap-1.5 justify-end text-[10px] no-print">
                  <span className="text-gray-400 font-semibold uppercase tracking-wider">Labor EWT Rate:</span>
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={laborEwtPercentage}
                      disabled={status !== "Draft" && !isAdmin}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        setLaborEwtPercentage(parseFloat(val) || 0);
                      }}
                      className="w-10 text-center border border-gray-200 rounded px-1 py-0.5 text-[10px] font-bold font-mono bg-white"
                    />
                    <span className="ml-0.5 text-gray-500 font-bold">%</span>
                  </div>
                </div>
              </div>

              {/* Discount VAT Amount (12%) */}
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">Discount VAT Amount (12%)</span>
                <input
                  type="number"
                  disabled={status !== "Draft" && !isAdmin}
                  value={discountVatAmount || ""}
                  onChange={(e) => setDiscountVatAmount(parseFloat(e.target.value) || 0)}
                  className="w-32 text-right px-2 py-0.5 bg-white border border-gray-200 rounded font-mono font-bold"
                />
              </div>

              {/* TOTAL */}
              <div className="bg-gradient-to-r from-smei-darkred to-smei-crimson text-white rounded-xl p-3 flex items-center justify-between mt-3 font-display">
                <div className="font-bold text-xs uppercase tracking-wide">TOTAL</div>
                <div className="text-right font-mono text-base font-extrabold">
                  {formatPHP(currentTotalAmount)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Approval Workflow Layout Block */}
        <div className="space-y-4 pt-6 border-t border-gray-100">
          <div className="flex items-center justify-between border-b border-gray-100 pb-1.5 flex-wrap gap-2">
            <h3 className="text-xs font-bold text-smei-crimson uppercase tracking-wider">
              V. sign-off authorizations & conforme
            </h3>
            <div className="flex items-center gap-3 text-[10px] no-print">
              {/* Restore menu for deleted signatories */}
              {(excludePreparedBy || excludeCheckedBy || excludeVerifiedBy || excludeVerifiedBy2 || excludeApprovedBy || excludeConforme) && (
                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg text-[9px] text-gray-500 font-medium font-sans flex-wrap">
                  <span className="font-bold text-gray-400">Restore:</span>
                  {excludePreparedBy && (
                    <button
                      type="button"
                      onClick={() => {
                        setExcludePreparedBy(false);
                        setPreparedBy("VICEDO, Lalaine");
                        setPreparedByTitle("Impex/Purchasing Staff");
                      }}
                      className="text-blue-600 hover:text-blue-800 font-bold hover:underline"
                    >
                      Prepared By
                    </button>
                  )}
                  {excludeCheckedBy && (
                    <button
                      type="button"
                      onClick={() => {
                        setExcludeCheckedBy(false);
                        setCheckedBy("ORONGAN, Eliza C.");
                        setCheckedByTitle("Admin asst. Leader");
                      }}
                      className="text-blue-600 hover:text-blue-800 font-bold hover:underline ml-1"
                    >
                      Check By
                    </button>
                  )}
                  {excludeVerifiedBy && (
                    <button
                      type="button"
                      onClick={() => {
                        setExcludeVerifiedBy(false);
                        setVerifiedBy("ROGADOR, Aprilyn");
                        setVerifiedByTitle("Asst.Admin/Technical Manager");
                      }}
                      className="text-blue-600 hover:text-blue-800 font-bold hover:underline ml-1"
                    >
                      Verified By (1)
                    </button>
                  )}
                  {excludeVerifiedBy2 && (
                    <button
                      type="button"
                      onClick={() => {
                        setExcludeVerifiedBy2(false);
                        setVerifiedBy2("MILANTE, Maria Morena");
                        setVerifiedBy2Title("Asst. Accounting Manager");
                      }}
                      className="text-blue-600 hover:text-blue-800 font-bold hover:underline ml-1"
                    >
                      Verified By (2)
                    </button>
                  )}
                  {excludeApprovedBy && (
                    <button
                      type="button"
                      onClick={() => {
                        setExcludeApprovedBy(false);
                        setApprovedBy("Agnes C. Vallejo");
                        setApprovedByTitle("Director");
                      }}
                      className="text-blue-600 hover:text-blue-800 font-bold hover:underline ml-1"
                    >
                      Approved By
                    </button>
                  )}
                  {excludeConforme && (
                    <button
                      type="button"
                      onClick={() => {
                        setExcludeConforme(false);
                        setConforme("");
                        setConformeTitle("Print name over the signature");
                      }}
                      className="text-blue-600 hover:text-blue-800 font-bold hover:underline ml-1"
                    >
                      Conforme
                    </button>
                  )}
                </div>
              )}
              {!isViewer && (
                <button
                  type="button"
                  onClick={addAdditionalSignatory}
                  className="inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Additional Signatory</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-x-16 gap-y-12 text-xs font-sans">
            
            {/* Row 1, Left: Prepared By */}
            <div className="md:col-start-1 md:row-start-1">
              {!excludePreparedBy && (
                <div className="flex flex-col relative w-full max-w-sm">
                  <div className="flex items-center justify-between no-print">
                    <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">1. Prepared By</span>
                    <div className="flex items-center gap-1.5">
                      {!preparedBy.trim() && (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" title="Warning: Signatory is blank!" />
                      )}
                      {!isViewer && (
                        <button
                          type="button"
                          onClick={() => {
                            setExcludePreparedBy(true);
                            setPreparedBy("");
                            setPreparedByTitle("");
                          }}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          title="Delete Signatory"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="font-bold text-gray-900 text-sm mt-1">Prepared by:</div>
                  <div className="h-14"></div>
                  <div className="border-b border-black w-full max-w-sm my-1"></div>
                  
                  <input
                    type="text"
                    value={preparedBy}
                    onChange={(e) => setPreparedBy(e.target.value)}
                    disabled={isViewer || (status !== "Draft" && !isAdmin)}
                    placeholder="Enter Name"
                    className="w-full font-sans font-bold text-gray-900 text-sm bg-transparent border-0 outline-none focus:ring-0 p-0 hover:bg-gray-100/50 rounded text-left transition-colors"
                  />
                  
                  <input
                    type="text"
                    value={preparedByTitle}
                    onChange={(e) => setPreparedByTitle(e.target.value)}
                    disabled={isViewer || (status !== "Draft" && !isAdmin)}
                    placeholder="Enter Title"
                    className="w-full text-gray-500 text-[11px] bg-transparent border-0 outline-none focus:ring-0 p-0 hover:bg-gray-100/50 rounded text-left transition-colors"
                  />
                </div>
              )}
            </div>

            {/* Row 1, Right: Check By */}
            <div className="md:col-start-2 md:row-start-1">
              {!excludeCheckedBy && (
                <div className="flex flex-col relative w-full max-w-sm">
                  <div className="flex items-center justify-between no-print">
                    <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">2. Check By</span>
                    <div className="flex items-center gap-1.5">
                      {!checkedBy.trim() && (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" title="Warning: Signatory is blank!" />
                      )}
                      {!isViewer && (
                        <button
                          type="button"
                          onClick={() => {
                            setExcludeCheckedBy(true);
                            setCheckedBy("");
                            setCheckedByTitle("");
                          }}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          title="Delete Signatory"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="font-bold text-gray-900 text-sm mt-1">Check by:</div>
                  <div className="h-14"></div>
                  <div className="border-b border-black w-full max-w-sm my-1"></div>
                  
                  <input
                    type="text"
                    value={checkedBy}
                    onChange={(e) => setCheckedBy(e.target.value)}
                    disabled={isViewer || (status !== "Draft" && !isAdmin && status !== "Pending Review")}
                    placeholder="Enter Name"
                    className="w-full font-sans font-bold text-gray-900 text-sm bg-transparent border-0 outline-none focus:ring-0 p-0 hover:bg-gray-100/50 rounded text-left transition-colors"
                  />
                  
                  <input
                    type="text"
                    value={checkedByTitle}
                    onChange={(e) => setCheckedByTitle(e.target.value)}
                    disabled={isViewer || (status !== "Draft" && !isAdmin)}
                    placeholder="Enter Title"
                    className="w-full text-gray-500 text-[11px] bg-transparent border-0 outline-none focus:ring-0 p-0 hover:bg-gray-100/50 rounded text-left transition-colors"
                  />
                </div>
              )}
            </div>

            {/* Row 2, Left: Verified By */}
            <div className="md:col-start-1 md:row-start-2">
              {!excludeVerifiedBy && (
                <div className="flex flex-col relative w-full max-w-sm">
                  <div className="flex items-center justify-between no-print">
                    <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">3. Verified By</span>
                    <div className="flex items-center gap-1.5">
                      {!verifiedBy.trim() && (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" title="Warning: Signatory is blank!" />
                      )}
                      {!isViewer && (
                        <button
                          type="button"
                          onClick={() => {
                            setExcludeVerifiedBy(true);
                            setVerifiedBy("");
                            setVerifiedByTitle("");
                          }}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          title="Delete Signatory"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="font-bold text-gray-900 text-sm mt-1">Verified by:</div>
                  <div className="h-14"></div>
                  <div className="border-b border-black w-full max-w-sm my-1"></div>
                  
                  <input
                    type="text"
                    value={verifiedBy}
                    onChange={(e) => setVerifiedBy(e.target.value)}
                    disabled={isViewer || (status !== "Draft" && !isAdmin && status !== "Pending Verification")}
                    placeholder="Enter Name"
                    className="w-full font-sans font-bold text-gray-900 text-sm bg-transparent border-0 outline-none focus:ring-0 p-0 hover:bg-gray-100/50 rounded text-left transition-colors"
                  />
                  
                  <input
                    type="text"
                    value={verifiedByTitle}
                    onChange={(e) => setVerifiedByTitle(e.target.value)}
                    disabled={isViewer || (status !== "Draft" && !isAdmin)}
                    placeholder="Enter Title"
                    className="w-full text-gray-500 text-[11px] bg-transparent border-0 outline-none focus:ring-0 p-0 hover:bg-gray-100/50 rounded text-left transition-colors"
                  />
                </div>
              )}
            </div>

            {/* Row 2, Right: Verified By (2) */}
            <div className="md:col-start-2 md:row-start-2">
              {!excludeVerifiedBy2 && (
                <div className="flex flex-col relative w-full max-w-sm">
                  <div className="flex items-center justify-between no-print">
                    <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">4. Verified By (2)</span>
                    <div className="flex items-center gap-1.5">
                      {!verifiedBy2.trim() && (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" title="Warning: Signatory is blank!" />
                      )}
                      {!isViewer && (
                        <button
                          type="button"
                          onClick={() => {
                            setExcludeVerifiedBy2(true);
                            setVerifiedBy2("");
                            setVerifiedBy2Title("");
                          }}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          title="Delete Signatory"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="font-bold text-gray-900 text-sm mt-1">Verified by:</div>
                  <div className="h-14"></div>
                  <div className="border-b border-black w-full max-w-sm my-1"></div>
                  
                  <input
                    type="text"
                    value={verifiedBy2}
                    onChange={(e) => setVerifiedBy2(e.target.value)}
                    disabled={isViewer || (status !== "Draft" && !isAdmin && status !== "Pending Verification")}
                    placeholder="Enter Name"
                    className="w-full font-sans font-bold text-gray-900 text-sm bg-transparent border-0 outline-none focus:ring-0 p-0 hover:bg-gray-100/50 rounded text-left transition-colors"
                  />
                  
                  <input
                    type="text"
                    value={verifiedBy2Title}
                    onChange={(e) => setVerifiedBy2Title(e.target.value)}
                    disabled={isViewer || (status !== "Draft" && !isAdmin)}
                    placeholder="Enter Title"
                    className="w-full text-gray-500 text-[11px] bg-transparent border-0 outline-none focus:ring-0 p-0 hover:bg-gray-100/50 rounded text-left transition-colors"
                  />
                </div>
              )}
            </div>

            {/* Row 3, Left: Approved By */}
            <div className="md:col-start-1 md:row-start-3">
              {!excludeApprovedBy && (
                <div className="flex flex-col relative w-full max-w-sm">
                  <div className="flex items-center justify-between no-print">
                    <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">5. Approved By</span>
                    <div className="flex items-center gap-1.5">
                      {!approvedBy.trim() && (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" title="Warning: Signatory is blank!" />
                      )}
                      {!isViewer && (
                        <button
                          type="button"
                          onClick={() => {
                            setExcludeApprovedBy(true);
                            setApprovedBy("");
                            setApprovedByTitle("");
                          }}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          title="Delete Signatory"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="font-bold text-gray-900 text-sm mt-1">Approved by:</div>
                  <div className="h-14"></div>
                  <div className="border-b border-black w-full max-w-sm my-1"></div>
                  
                  <input
                    type="text"
                    value={approvedBy}
                    onChange={(e) => setApprovedBy(e.target.value)}
                    disabled={isViewer || (status !== "Draft" && !isAdmin && status !== "Pending Approval")}
                    placeholder="Enter Name"
                    className="w-full font-sans font-bold text-gray-900 text-sm bg-transparent border-0 outline-none focus:ring-0 p-0 hover:bg-gray-100/50 rounded text-left transition-colors"
                  />
                  
                  <input
                    type="text"
                    value={approvedByTitle}
                    onChange={(e) => setApprovedByTitle(e.target.value)}
                    disabled={isViewer || (status !== "Draft" && !isAdmin)}
                    placeholder="Enter Title"
                    className="w-full text-gray-500 text-[11px] bg-transparent border-0 outline-none focus:ring-0 p-0 hover:bg-gray-100/50 rounded text-left transition-colors"
                  />
                </div>
              )}
            </div>

            {/* Row 3, Right: Conforme */}
            <div className="md:col-start-2 md:row-start-3">
              {!excludeConforme && (
                <div className="flex flex-col relative w-full max-w-sm">
                  <div className="flex items-center justify-between no-print">
                    <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">6. Conforme</span>
                    <div className="flex items-center gap-1.5">
                      {!isViewer && (
                        <button
                          type="button"
                          onClick={() => {
                            setExcludeConforme(true);
                            setConforme("");
                            setConformeTitle("");
                          }}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          title="Delete Signatory"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="font-bold text-gray-900 text-sm mt-1">Conforme:</div>
                  
                  <div className="h-14 relative flex items-end">
                    {signatureUrl ? (
                      <img
                        src={signatureUrl}
                        alt="Signature"
                        className="h-10 object-contain text-left"
                        referrerPolicy="no-referrer"
                      />
                    ) : signatureText ? (
                      <span className="font-display italic text-smei-crimson text-sm block tracking-widest">{signatureText}</span>
                    ) : conforme ? (
                      <span className="font-display italic text-smei-crimson text-sm block tracking-widest">{conforme}</span>
                    ) : (
                      <span className="text-gray-300 italic text-[11px] no-print">No Sign-off</span>
                    )}
                    {status === "Approved" && !isViewer && (
                      <button
                        type="button"
                        onClick={() => setShowSignaturePad(true)}
                        className="absolute bottom-1 right-1 bg-red-50 text-smei-crimson p-1 rounded hover:bg-smei-crimson hover:text-white transition-all no-print animate-bounce"
                        title="Conforme Digital Signature"
                      >
                        <PenTool className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  
                  <div className="border-b border-black w-full max-w-sm my-1"></div>
                  
                  <div className="text-gray-500 text-[11px] select-none pointer-events-none">
                    Printed name over signature
                  </div>
                </div>
              )}
            </div>

            {/* Additional Signatories */}
            {additionalSignatories.length > 0 && (
              <div className="md:col-span-2 mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-12">
                {additionalSignatories.map((sig, idx) => (
                  <div key={sig.id} className="flex flex-col relative w-full max-w-sm group">
                    <div className="flex items-center justify-between no-print">
                      <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">{6 + idx}. Additional Signatory</span>
                      <div className="flex items-center gap-1.5">
                        {!sig.name.trim() && (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" title="Warning: Signatory is blank!" />
                        )}
                        {!isViewer && (
                          <button
                            type="button"
                            onClick={() => removeAdditionalSignatory(sig.id)}
                            className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete Signatory"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="font-bold text-gray-900 text-sm mt-1">Authorized Rep:</div>
                    <div className="h-14"></div>
                    <div className="border-b border-black w-full max-w-sm my-1"></div>
                    
                    <input
                      type="text"
                      value={sig.name}
                      onChange={(e) => updateAdditionalSignatory(sig.id, { name: e.target.value })}
                      disabled={isViewer}
                      placeholder="Enter Name"
                      className="w-full font-sans font-bold text-gray-900 text-sm bg-transparent border-0 outline-none focus:ring-0 p-0 hover:bg-gray-100/50 rounded text-left transition-colors"
                    />
                    
                    <input
                      type="text"
                      value={sig.role}
                      onChange={(e) => updateAdditionalSignatory(sig.id, { role: e.target.value })}
                      disabled={isViewer}
                      placeholder="Enter Title"
                      className="w-full text-gray-500 text-[11px] bg-transparent border-0 outline-none focus:ring-0 p-0 hover:bg-gray-100/50 rounded text-left transition-colors"
                    />
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>

        {/* Form bottom submission CTA (For all authorized roles except viewers) */}
        {!isViewer && (
          <div className="flex items-center justify-end gap-3 no-print border-t border-gray-100 pt-6">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1 bg-white border border-gray-200 hover:border-smei-crimson text-gray-800 hover:text-smei-crimson font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{status === "Draft" || status === "Rejected" ? "Save Draft" : "Save Changes"}</span>
            </button>
            {(status === "Draft" || status === "Rejected" || isNew) && (
              <button
                type="button"
                onClick={(e) => handleFormSave(e, true)}
                className="inline-flex items-center gap-1.5 bg-gradient-to-r from-smei-darkred to-smei-crimson text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Submit for Dept Review</span>
              </button>
            )}
          </div>
        )}
          </form>
        </div>
      </div>

      {/* Signature Pad Draw Overlay Modal */}
      {showSignaturePad && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="font-bold text-gray-800 text-sm font-display">Supplier Sign-off Signature</h4>
              <button
                onClick={() => setShowSignaturePad(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm"
              >
                Close
              </button>
            </div>

            {/* Input name for typeface signature */}
            <div className="space-y-1 text-xs">
              <label className="block font-bold text-gray-600 uppercase">Type Signature Text:</label>
              <input
                type="text"
                value={signatureText}
                onChange={(e) => {
                  setSignatureText(e.target.value);
                  setConforme(e.target.value);
                }}
                placeholder="e.g. Arthur Alcantara"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
              />
            </div>

            {/* Canvas Draw */}
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <label className="block font-bold text-gray-600 uppercase">Or Draw Signature Below:</label>
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="text-[10px] font-bold text-smei-crimson hover:underline"
                >
                  Clear Pad
                </button>
              </div>
              <canvas
                ref={canvasRef}
                width={330}
                height={120}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl cursor-crosshair w-full"
              />
            </div>

            <button
              type="button"
              onClick={saveSignature}
              className="w-full bg-gradient-to-r from-smei-darkred to-smei-crimson text-white font-bold text-xs py-2.5 rounded-xl shadow transition-all"
            >
              Apply Signature
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
