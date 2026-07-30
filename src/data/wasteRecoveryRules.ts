export interface WasteRecoveryRule {
  description: string;
  company: string;
  recoveryType: "HAZ_WASTE" | "LOCAL_TSD" | "NON_HAZ" | "MULTIPLE";
  percentage: number;
  classification: "104" | "M506";
  secondaryPercentage?: number;
  secondaryRecoveryType?: "LOCAL_TSD" | "HAZ_WASTE" | "NON_HAZ";
  remarks?: string;
}

export const WASTE_RECOVERY_RULES: WasteRecoveryRule[] = [
  {
    "description": "Adaptor",
    "company": "GMTI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "104",
    "remarks": "0.1"
  },
  {
    "description": "Adaptor",
    "company": "SUMITRONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "104",
    "remarks": "0.1"
  },
  {
    "description": "Aluminum Diecast w/ Paint",
    "company": "IONICS",
    "recoveryType": "NON_HAZ",
    "percentage": 100,
    "classification": "104",
    "remarks": "100% non haz"
  },
  {
    "description": "Aluminum Turnings",
    "company": "PSPI F1",
    "recoveryType": "LOCAL_TSD",
    "percentage": 5.87,
    "classification": "104",
    "remarks": "5.87% TSD"
  },
  {
    "description": "Aluminum Turnings",
    "company": "PSPI F3",
    "recoveryType": "LOCAL_TSD",
    "percentage": 7.48,
    "classification": "104",
    "remarks": "7.48% TSD"
  },
  {
    "description": "Aluminum w/ Fe",
    "company": "TSUKIDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Assorted Scrap (Asstd. E-waste)",
    "company": "APC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "Assorted Scrap (Asstd. E-waste)",
    "company": "ASTEC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "Assorted Scrap (Asstd. E-waste)",
    "company": "BROTHER",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "Assorted Scrap (Asstd. E-waste)",
    "company": "EPSON",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "Assorted Scrap (Asstd. E-waste)",
    "company": "H3",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "Assorted Scrap (Asstd. E-waste)",
    "company": "IONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "Assorted Scrap (Asstd. E-waste)",
    "company": "LEAR",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "Assorted Scrap (Asstd. E-waste)",
    "company": "MATECH",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "Assorted Scrap (Asstd. E-waste)",
    "company": "MITSUMI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "Assorted Scrap (Asstd. E-waste)",
    "company": "OMMPI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "Assorted Scrap (Asstd. E-waste)",
    "company": "ROHM",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "Assorted Scrap (Asstd. E-waste)",
    "company": "SDP",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "Assorted Scrap (Asstd. E-waste)",
    "company": "SIIX EMS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "Assorted Scrap (Asstd. E-waste)",
    "company": "TAIYO YUDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "Assorted Scrap (Asstd. E-waste)",
    "company": "TOSHIBA",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "Assorted Scrap (Asstd. E-waste)",
    "company": "TSUKIDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "BGA w/ Au (Offcuts)",
    "company": "IBIDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "BGA w/ Au (Unit)",
    "company": "IBIDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "BGA w/ Au (Strips)",
    "company": "IBIDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Brass Turnings",
    "company": "PSPI F1",
    "recoveryType": "LOCAL_TSD",
    "percentage": 5.87,
    "classification": "104",
    "remarks": "5.87% TSD"
  },
  {
    "description": "Brass Turnings",
    "company": "PSPI F3",
    "recoveryType": "LOCAL_TSD",
    "percentage": 7.48,
    "classification": "104",
    "remarks": "7.48% TSD"
  },
  {
    "description": "Brass Turnings A",
    "company": "PSPI F1",
    "recoveryType": "LOCAL_TSD",
    "percentage": 5.87,
    "classification": "104",
    "remarks": "5.87% TSD"
  },
  {
    "description": "Brass Turnings A",
    "company": "PSPI F3",
    "recoveryType": "LOCAL_TSD",
    "percentage": 7.48,
    "classification": "104",
    "remarks": "7.48% TSD"
  },
  {
    "description": "Brass Turnings B",
    "company": "PSPI F1",
    "recoveryType": "LOCAL_TSD",
    "percentage": 5.87,
    "classification": "104",
    "remarks": "5.87% TSD"
  },
  {
    "description": "Brass Turnings B",
    "company": "PSPI F3",
    "recoveryType": "LOCAL_TSD",
    "percentage": 7.48,
    "classification": "104",
    "remarks": "7.48% TSD"
  },
  {
    "description": "Brass Turnings B",
    "company": "SMESI",
    "recoveryType": "NON_HAZ",
    "percentage": 100,
    "classification": "104",
    "remarks": "100% NON"
  },
  {
    "description": "Brass Turnings C",
    "company": "PSPI F1",
    "recoveryType": "LOCAL_TSD",
    "percentage": 5.87,
    "classification": "104",
    "remarks": "5.87% TSD"
  },
  {
    "description": "Brass Turnings C",
    "company": "PSPI F3",
    "recoveryType": "LOCAL_TSD",
    "percentage": 7.48,
    "classification": "104",
    "remarks": "7.48% TSD"
  },
  {
    "description": "Brass Turnings w/ Impurities",
    "company": "PSPI F1",
    "recoveryType": "LOCAL_TSD",
    "percentage": 5.87,
    "classification": "104",
    "remarks": "5.87% TSD"
  },
  {
    "description": "Brass Turnings w/ Impurities",
    "company": "PSPI F3",
    "recoveryType": "LOCAL_TSD",
    "percentage": 7.48,
    "classification": "104",
    "remarks": "7.48% TSD"
  },
  {
    "description": "Capacitor",
    "company": "SUMITRONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "100% tsd"
  },
  {
    "description": "Capacitor",
    "company": "TOSHIBA",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "100% tsd"
  },
  {
    "description": "Carbon",
    "company": "MITSUMI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 13.200000000000001,
    "classification": "104",
    "remarks": "0.132"
  },
  {
    "description": "Components w/ lead",
    "company": "NT PHILS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Connector w/ Au",
    "company": "TOSHIBA",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "Connector w/ PWB",
    "company": "TOSHIBA",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "CPU",
    "company": "BROTHER",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "CPU",
    "company": "IBIDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "CPU",
    "company": "IONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "CPU",
    "company": "MITSUMI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "CPU",
    "company": "ROHM",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "CPU",
    "company": "SDP",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "CPU",
    "company": "SIIX EMS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "Cutpins (Metal Cutwire)",
    "company": "IONICS",
    "recoveryType": "NON_HAZ",
    "percentage": 100,
    "classification": "104",
    "remarks": "100% non haz"
  },
  {
    "description": "DC Cord (Machine accessories)",
    "company": "TAIYO YUDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "104",
    "remarks": "0.1"
  },
  {
    "description": "Flexible Circuit",
    "company": "BROTHER",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Flexible Circuit",
    "company": "SIIX EMS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Flexible Circuit",
    "company": "TOSHIBA",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Flexible Circuit B",
    "company": "TOSHIBA",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Flex w/ Aluminum",
    "company": "TOSHIBA",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "HDD",
    "company": "EPSON",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "104",
    "remarks": "0.1"
  },
  {
    "description": "HDD w/ PWB",
    "company": "BROTHER",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "HDD w/ PWB 2.5",
    "company": "TOSHIBA",
    "recoveryType": "LOCAL_TSD",
    "percentage": 12.790000000000001,
    "classification": "M506",
    "remarks": "0.1279"
  },
  {
    "description": "HDD w/ PWB 3.5",
    "company": "TOSHIBA",
    "recoveryType": "LOCAL_TSD",
    "percentage": 6.77,
    "classification": "M506",
    "remarks": "0.0677"
  },
  {
    "description": "IC",
    "company": "MATECH",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "IC",
    "company": "TOSHIBA",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Insulated Wire",
    "company": "GLORY",
    "recoveryType": "NON_HAZ",
    "percentage": 100,
    "classification": "104",
    "remarks": "100% non"
  },
  {
    "description": "Insulated Wire",
    "company": "ROHM",
    "recoveryType": "NON_HAZ",
    "percentage": 100,
    "classification": "104",
    "remarks": "100% non Haz"
  },
  {
    "description": "Insulated Wire",
    "company": "SUMITRONICS",
    "recoveryType": "NON_HAZ",
    "percentage": 100,
    "classification": "104",
    "remarks": "100% non Haz"
  },
  {
    "description": "Insulated Wire 20%",
    "company": "TSUKIDEN",
    "recoveryType": "NON_HAZ",
    "percentage": 100,
    "classification": "104",
    "remarks": "100% non"
  },
  {
    "description": "Insulated Wire 30%",
    "company": "IONICS",
    "recoveryType": "NON_HAZ",
    "percentage": 100,
    "classification": "104",
    "remarks": "100% non haz"
  },
  {
    "description": "Insulated Wire 30%",
    "company": "ROHM",
    "recoveryType": "NON_HAZ",
    "percentage": 100,
    "classification": "104",
    "remarks": "100% non haz"
  },
  {
    "description": "Insulated Wire 30%",
    "company": "SIIX EMS",
    "recoveryType": "NON_HAZ",
    "percentage": 100,
    "classification": "104",
    "remarks": "100% non"
  },
  {
    "description": "Insulated Wire C",
    "company": "GLORY",
    "recoveryType": "NON_HAZ",
    "percentage": 100,
    "classification": "104",
    "remarks": "100% non"
  },
  {
    "description": "Insulated Wire C",
    "company": "ROHM",
    "recoveryType": "NON_HAZ",
    "percentage": 100,
    "classification": "104",
    "remarks": "100% Non Haz"
  },
  {
    "description": "Insulated Wire C",
    "company": "SIIX EMS",
    "recoveryType": "NON_HAZ",
    "percentage": 100,
    "classification": "104",
    "remarks": "100 non"
  },
  {
    "description": "Insulated Wire D",
    "company": "MITSUMI",
    "recoveryType": "NON_HAZ",
    "percentage": 100,
    "classification": "104",
    "remarks": "100% non haz"
  },
  {
    "description": "Insulated Wire D",
    "company": "ROHM",
    "recoveryType": "NON_HAZ",
    "percentage": 100,
    "classification": "104",
    "remarks": "100% non haz"
  },
  {
    "description": "Insulated Wire D",
    "company": "SIIX EMS",
    "recoveryType": "NON_HAZ",
    "percentage": 100,
    "classification": "104",
    "remarks": "100% non"
  },
  {
    "description": "Keyboard",
    "company": "BROTHER",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "104",
    "remarks": "0.1"
  },
  {
    "description": "Keyboard",
    "company": "TAIYO YUDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "104",
    "remarks": "0.1"
  },
  {
    "description": "LED w/ Ceramic",
    "company": "SUMITRONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "100% tsd"
  },
  {
    "description": "Machine accessories (Scrap)",
    "company": "TAIYO YUDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "Metal Assorted",
    "company": "ROHM",
    "recoveryType": "NON_HAZ",
    "percentage": 100,
    "classification": "104",
    "remarks": "100% non"
  },
  {
    "description": "Metal Assorted",
    "company": "TSUKIDEN",
    "recoveryType": "NON_HAZ",
    "percentage": 100,
    "classification": "104",
    "remarks": "100% non"
  },
  {
    "description": "Metal Light",
    "company": "IONICS",
    "recoveryType": "NON_HAZ",
    "percentage": 100,
    "classification": "104",
    "remarks": "100% non haz"
  },
  {
    "description": "Metal Turnings",
    "company": "AMBER",
    "recoveryType": "LOCAL_TSD",
    "percentage": 3,
    "classification": "104",
    "remarks": "0.03"
  },
  {
    "description": "Metal Turnings",
    "company": "GLORY",
    "recoveryType": "LOCAL_TSD",
    "percentage": 3,
    "classification": "104",
    "remarks": "0.03"
  },
  {
    "description": "Metal Turnings",
    "company": "GMTI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 1.31,
    "classification": "104",
    "remarks": "1.31%  TSD"
  },
  {
    "description": "Metal Turnings",
    "company": "IZUMITECH",
    "recoveryType": "LOCAL_TSD",
    "percentage": 9.54,
    "classification": "104",
    "remarks": "9.54% TSD"
  },
  {
    "description": "Metal Turnings",
    "company": "MKP",
    "recoveryType": "LOCAL_TSD",
    "percentage": 16.9,
    "classification": "104",
    "remarks": "16.90% TSD"
  },
  {
    "description": "Metal Turnings",
    "company": "PSPI F1",
    "recoveryType": "LOCAL_TSD",
    "percentage": 5.87,
    "classification": "104",
    "remarks": "5.87% TSD"
  },
  {
    "description": "Metal Turnings",
    "company": "PSPI F3",
    "recoveryType": "LOCAL_TSD",
    "percentage": 7.48,
    "classification": "104",
    "remarks": "7.48% TSD"
  },
  {
    "description": "Metal Turnings",
    "company": "TAIYO YUDEN",
    "recoveryType": "NON_HAZ",
    "percentage": 100,
    "classification": "104",
    "remarks": "100% NON"
  },
  {
    "description": "Mix Components",
    "company": "APC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Mix Components",
    "company": "ASTEC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Mix Components",
    "company": "BROTHER",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Mix Components",
    "company": "EPSON",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Mix Components",
    "company": "IBIDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Mix Components",
    "company": "IONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Mix Components",
    "company": "JECO",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Mix Components",
    "company": "MATECH",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Mix Components",
    "company": "MITSUMI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Mix Components",
    "company": "SIIX EMS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Mix Components",
    "company": "SUMITRONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Mix Components",
    "company": "TOSHIBA",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Mix Components",
    "company": "TSUKIDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Mix Components (Coil)",
    "company": "MITSUMI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 13.200000000000001,
    "classification": "104",
    "remarks": "0.132"
  },
  {
    "description": "Mix Componets (Carbon)",
    "company": "MITSUMI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 13.200000000000001,
    "classification": "104",
    "remarks": "0.132"
  },
  {
    "description": "Mix Componets Diode",
    "company": "MITSUMI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Mix Components (Transformer)",
    "company": "MITSUMI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Mix Components in reels",
    "company": "MATECH",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Mix Components in reels",
    "company": "MITSUMI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Mix Components in reels",
    "company": "SIIX EMS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Mix Components in reels",
    "company": "SUMITRONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Mix Components w/ Cellophane",
    "company": "MITSUMI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Monitor/ LCD",
    "company": "BROTHER",
    "recoveryType": "MULTIPLE",
    "percentage": 11.2,
    "classification": "M506",
    "secondaryPercentage": 12,
    "secondaryRecoveryType": "LOCAL_TSD",
    "remarks": "11.20% haz, 12% tsd"
  },
  {
    "description": "Monitor/ LCD",
    "company": "HRD",
    "recoveryType": "MULTIPLE",
    "percentage": 11.2,
    "classification": "M506",
    "secondaryPercentage": 12,
    "secondaryRecoveryType": "LOCAL_TSD",
    "remarks": "11.20% haz, 12% tsd"
  },
  {
    "description": "Monitor/ LCD",
    "company": "IONICS",
    "recoveryType": "MULTIPLE",
    "percentage": 11.2,
    "classification": "M506",
    "secondaryPercentage": 12,
    "secondaryRecoveryType": "LOCAL_TSD",
    "remarks": "11.20% haz, 12% tsd"
  },
  {
    "description": "Monitor/ LCD",
    "company": "JECO",
    "recoveryType": "MULTIPLE",
    "percentage": 11.2,
    "classification": "M506",
    "secondaryPercentage": 12,
    "secondaryRecoveryType": "LOCAL_TSD",
    "remarks": "11.20% haz, 12% tsd"
  },
  {
    "description": "Monitor/ LCD",
    "company": "MITSUMI",
    "recoveryType": "MULTIPLE",
    "percentage": 11.2,
    "classification": "M506",
    "secondaryPercentage": 12,
    "secondaryRecoveryType": "LOCAL_TSD",
    "remarks": "11.20% haz, 12% tsd"
  },
  {
    "description": "Monitor/ LCD",
    "company": "ROHM",
    "recoveryType": "MULTIPLE",
    "percentage": 11.2,
    "classification": "M506",
    "secondaryPercentage": 12,
    "secondaryRecoveryType": "LOCAL_TSD",
    "remarks": "11.20% haz, 12% tsd"
  },
  {
    "description": "Monitor/ LCD",
    "company": "SDP",
    "recoveryType": "MULTIPLE",
    "percentage": 11.2,
    "classification": "M506",
    "secondaryPercentage": 12,
    "secondaryRecoveryType": "LOCAL_TSD",
    "remarks": "11.20% haz, 12% tsd"
  },
  {
    "description": "Monitor/ LCD",
    "company": "TAIYO YUDEN",
    "recoveryType": "MULTIPLE",
    "percentage": 11.2,
    "classification": "M506",
    "secondaryPercentage": 12,
    "secondaryRecoveryType": "LOCAL_TSD",
    "remarks": "11.20% haz, 12% tsd"
  },
  {
    "description": "Monitor/ LCD",
    "company": "TOSHIBA",
    "recoveryType": "MULTIPLE",
    "percentage": 11.2,
    "classification": "M506",
    "secondaryPercentage": 12,
    "secondaryRecoveryType": "LOCAL_TSD",
    "remarks": "11.20% haz, 12% tsd"
  },
  {
    "description": "Motherboard",
    "company": "TOSHIBA",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Motor w/ Flex and PWB",
    "company": "SUMITRONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "Motor w/ PWB",
    "company": "SUMITRONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "Mouse",
    "company": "TAIYO YUDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "104",
    "remarks": "0.1"
  },
  {
    "description": "PCBA Mounted B",
    "company": "TOSHIBA",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "Power Supply",
    "company": "APC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "104",
    "remarks": "0.1"
  },
  {
    "description": "Power Supply",
    "company": "ASTEC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "104",
    "remarks": "0.1"
  },
  {
    "description": "Power Supply",
    "company": "BROTHER",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "104",
    "remarks": "0.1"
  },
  {
    "description": "Power Supply",
    "company": "HRD",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "104",
    "remarks": "0.1"
  },
  {
    "description": "Power Supply",
    "company": "IONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "104",
    "remarks": "0.1"
  },
  {
    "description": "Power Supply",
    "company": "LEAR",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "104",
    "remarks": "0.1"
  },
  {
    "description": "Power Supply",
    "company": "ROHM",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "104",
    "remarks": "0.1"
  },
  {
    "description": "Power Supply",
    "company": "TAIYO YUDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "104",
    "remarks": "0.1"
  },
  {
    "description": "Power Supply",
    "company": "TOSHIBA",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "104",
    "remarks": "0.1"
  },
  {
    "description": "Power Supply",
    "company": "TSUKIDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "104",
    "remarks": "0.1"
  },
  {
    "description": "Plastic w/ Fe",
    "company": "IONICS",
    "recoveryType": "NON_HAZ",
    "percentage": 100,
    "classification": "104",
    "remarks": "100% non haz"
  },
  {
    "description": "Plastic w/ Metal",
    "company": "SIIX EMS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "100% tsd"
  },
  {
    "description": "Plastic w/ Metal",
    "company": "SUMITRONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "104",
    "remarks": "0.1"
  },
  {
    "description": "Printer",
    "company": "BROTHER",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "104",
    "remarks": "0.1"
  },
  {
    "description": "Printer",
    "company": "ROHM",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "104",
    "remarks": "0.1"
  },
  {
    "description": "PWB Crushed",
    "company": "ASTEC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB HDD Board w/ Cu 30%",
    "company": "TOSHIBA",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mixed",
    "company": "MATECH",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mixed",
    "company": "MITSUMI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Motherboard",
    "company": "TOSHIBA",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted",
    "company": "ASTEC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted",
    "company": "EPSON",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted",
    "company": "GLORY",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted",
    "company": "SDP",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted",
    "company": "TAIYO YUDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted A",
    "company": "TOSHIBA",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted B",
    "company": "APC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted B",
    "company": "DENSO",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted B",
    "company": "HRD",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted B",
    "company": "IONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted B",
    "company": "LEAR",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted B",
    "company": "MITSUMI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted B",
    "company": "NIDEC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted B",
    "company": "ROHM",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted B",
    "company": "SIIX EMS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted B",
    "company": "SUMITRONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted B",
    "company": "TOSHIBA",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted B",
    "company": "TSUKIDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted B w/ IC",
    "company": "BROTHER",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted C",
    "company": "ASTEC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted C",
    "company": "BROTHER",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted C",
    "company": "DENSO",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted C",
    "company": "EPSON",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted C",
    "company": "IONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted C",
    "company": "JECO",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted C",
    "company": "MATECH",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted C",
    "company": "MITSUMI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted C",
    "company": "NIDEC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted C",
    "company": "ROHM",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted C",
    "company": "SIIX EMS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted C",
    "company": "SUMITRONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted C",
    "company": "TSUKIDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted C (Low)",
    "company": "MITSUMI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted C (Low)",
    "company": "ROHM",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted D",
    "company": "MITSUMI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted D",
    "company": "ROHM",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted D",
    "company": "SUMITRONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted D Low",
    "company": "MITSUMI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 72.44,
    "classification": "M506",
    "remarks": "0.7244"
  },
  {
    "description": "PWB Mounted (Mixed)",
    "company": "ASTEC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted (Mixed)",
    "company": "BROTHER",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted (Mixed)",
    "company": "GMTI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted (Mixed)",
    "company": "MATECH",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted (Mixed)",
    "company": "MITSUMI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted (Mixed)",
    "company": "NIDEC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted (Mixed)",
    "company": "ROHM",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted (Mixed)",
    "company": "SUMITRONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted PS Low",
    "company": "BROTHER",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted PS Low",
    "company": "MITSUMI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 72.44,
    "classification": "M506",
    "remarks": "0.7244"
  },
  {
    "description": "PWB Mounted PS Low",
    "company": "NIDEC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "100% tsd"
  },
  {
    "description": "PWB Mounted PS Low",
    "company": "SUMITRONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted PS",
    "company": "EPSON",
    "recoveryType": "LOCAL_TSD",
    "percentage": 37.580000000000005,
    "classification": "M506",
    "remarks": "0.3758"
  },
  {
    "description": "PWB Mounted PS",
    "company": "LEAR",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted PS",
    "company": "TAIYO YUDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Mounted PS",
    "company": "TOSHIBA",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Powder",
    "company": "BROTHER",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "100% tsd"
  },
  {
    "description": "PWB Power Supply",
    "company": "APC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 46.89,
    "classification": "M506",
    "remarks": "0.4689"
  },
  {
    "description": "PWB Power Supply",
    "company": "ASTEC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Power Supply",
    "company": "BROTHER",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Power Supply",
    "company": "DANAM",
    "recoveryType": "LOCAL_TSD",
    "percentage": 46.89,
    "classification": "M506",
    "remarks": "0.4689"
  },
  {
    "description": "PWB Power Supply",
    "company": "EPSON",
    "recoveryType": "LOCAL_TSD",
    "percentage": 37.580000000000005,
    "classification": "M506",
    "remarks": "0.3758"
  },
  {
    "description": "PWB Power Supply",
    "company": "GMTI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Power Supply",
    "company": "H3",
    "recoveryType": "LOCAL_TSD",
    "percentage": 33.44,
    "classification": "M506",
    "remarks": "0.3344"
  },
  {
    "description": "PWB Power Supply",
    "company": "IONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Power Supply",
    "company": "MITSUMI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 72.44,
    "classification": "M506",
    "remarks": "0.7244"
  },
  {
    "description": "PWB Power Supply",
    "company": "ROHM",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Power Supply",
    "company": "SIIX EMS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Power Supply",
    "company": "TOSHIBA",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Power Supply",
    "company": "TSUKIDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Power Supply Low",
    "company": "MITSUMI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 72.44,
    "classification": "M506",
    "remarks": "0.7244"
  },
  {
    "description": "PWB Power Supply Low",
    "company": "SUMITRONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Trimmings",
    "company": "DANAM",
    "recoveryType": "LOCAL_TSD",
    "percentage": 90,
    "classification": "M506",
    "remarks": "90%"
  },
  {
    "description": "PWB Trmmings w/ Cu 20%",
    "company": "IONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Trmmings w/ Cu 20%",
    "company": "TOSHIBA",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB Trimmings w/ Garbage",
    "company": "APC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 90,
    "classification": "M506",
    "remarks": "0.9"
  },
  {
    "description": "PWB Trimmings w/ Garbage",
    "company": "DANAM",
    "recoveryType": "LOCAL_TSD",
    "percentage": 90,
    "classification": "M506",
    "remarks": "0.9"
  },
  {
    "description": "PWB Trimmings w/ Garbage",
    "company": "DKP",
    "recoveryType": "LOCAL_TSD",
    "percentage": 90,
    "classification": "M506",
    "remarks": "0.9"
  },
  {
    "description": "PWB w/ Au",
    "company": "APC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Au",
    "company": "BROTHER",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Au",
    "company": "GMTI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Au",
    "company": "MITSUMI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu",
    "company": "APC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu",
    "company": "ASTEC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu",
    "company": "BROTHER",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu",
    "company": "MITSUMI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu",
    "company": "SANRITSU",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu",
    "company": "SDP",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu 20%",
    "company": "ARKRAY",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu 20%",
    "company": "ASTEC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu 20%",
    "company": "BROTHER",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu 20%",
    "company": "DENSO",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu 20%",
    "company": "EMS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu 20%",
    "company": "EPSON",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu 20%",
    "company": "GMTI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu 20%",
    "company": "IONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu 20%",
    "company": "MATECH",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu 20%",
    "company": "MITSUMI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu 20%",
    "company": "NIDEC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu 20%",
    "company": "PIMES",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu 20%",
    "company": "SANRITSU",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu 20%",
    "company": "SDP",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu 20%",
    "company": "SIIX EMS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu 20%",
    "company": "SUMITRONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu 20%",
    "company": "TOSHIBA",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu 20%",
    "company": "TSUKIDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu 30%",
    "company": "EMS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu 30%",
    "company": "NIDEC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu 30%",
    "company": "TOSHIBA",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu 40%",
    "company": "EMS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu B",
    "company": "NIDEC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu B",
    "company": "SIIX EMS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "100"
  },
  {
    "description": "PWB w/ Cu C",
    "company": "ASTEC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu C",
    "company": "DENSO",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu C",
    "company": "DKP",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu C",
    "company": "EMS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu C",
    "company": "EPSON",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu C",
    "company": "IONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu C",
    "company": "MITSUMI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu C",
    "company": "NIDEC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu C",
    "company": "PIMES",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu C",
    "company": "SDP",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu C",
    "company": "SIIX EMS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu C",
    "company": "TSUKIDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu D",
    "company": "BROTHER",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu D",
    "company": "IONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu D",
    "company": "MATECH",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu D",
    "company": "MITSUMI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu D",
    "company": "NIDEC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu D",
    "company": "SANRITSU",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu D",
    "company": "SDP",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu D",
    "company": "SIIX EMS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu D",
    "company": "SUMITRONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu D",
    "company": "TSUKIDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu E",
    "company": "DENSO",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu E",
    "company": "IONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "100% tsd"
  },
  {
    "description": "PWB w/ Cu E",
    "company": "SIIX EMS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "100% tsd"
  },
  {
    "description": "PWB w/ Cu E (Motherboard)",
    "company": "DENSO",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu E Low",
    "company": "DENSO",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu Low",
    "company": "APC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 90,
    "classification": "M506",
    "remarks": "0.9"
  },
  {
    "description": "PWB w/ Cu Low",
    "company": "DKP",
    "recoveryType": "LOCAL_TSD",
    "percentage": 90,
    "classification": "M506",
    "remarks": "0.9"
  },
  {
    "description": "PWB w/ Cu Low",
    "company": "EMS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "100% tsd"
  },
  {
    "description": "PWB w/ Cu Low",
    "company": "GMTI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "100% tsd"
  },
  {
    "description": "PWB w/ Cu Low",
    "company": "JECO",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu Low",
    "company": "MATECH",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "100% tsd"
  },
  {
    "description": "PWB w/ Cu Low",
    "company": "MITSUMI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "100% tsd"
  },
  {
    "description": "PWB w/ Cu Low",
    "company": "NIDEC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Cu Low",
    "company": "SIIX EMS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "100% tsd"
  },
  {
    "description": "PWB w/ Cu Low",
    "company": "SUMITRONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "100% tsd"
  },
  {
    "description": "PWB w/ Cu Low",
    "company": "TSUKIDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "100% tsd"
  },
  {
    "description": "PWB w/ Cu mixed",
    "company": "EMS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "1"
  },
  {
    "description": "PWB w/ Fe",
    "company": "SIIX EMS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "100% tsd"
  },
  {
    "description": "PWB w/ Metal",
    "company": "SIIX EMS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 58.809999999999995,
    "classification": "M506",
    "remarks": "0.5881"
  },
  {
    "description": "PWB w/ Metal",
    "company": "SUMITRONICS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 58.809999999999995,
    "classification": "M506",
    "remarks": "0.5881"
  },
  {
    "description": "PWB w/ Plastic",
    "company": "SIIX EMS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "100% tsd"
  },
  {
    "description": "PWB w/out Cu",
    "company": "APC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "100% tsd"
  },
  {
    "description": "PWB w/out Cu",
    "company": "GMTI",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "100% tsd"
  },
  {
    "description": "PWB w/out Cu",
    "company": "MATECH",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "100% tsd"
  },
  {
    "description": "PWB w/out Cu",
    "company": "NIDEC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "100% tsd"
  },
  {
    "description": "PWB w/out Cu",
    "company": "SDP",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "100% tsd"
  },
  {
    "description": "PWB w/out Cu",
    "company": "SIIX EMS",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "M506",
    "remarks": "100% tsd"
  },
  {
    "description": "Refrigerator",
    "company": "TAIYO YUDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "104",
    "remarks": "0.1"
  },
  {
    "description": "Scrap machine (Machine accesories)",
    "company": "TAIYO YUDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "M506",
    "remarks": "0.1"
  },
  {
    "description": "Scrap Power Supply",
    "company": "TOSHIBA",
    "recoveryType": "LOCAL_TSD",
    "percentage": 7.6,
    "classification": "M506",
    "remarks": "0.076"
  },
  {
    "description": "Small IC",
    "company": "TOSHIBA",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "1"
  },
  {
    "description": "SUS 304 B",
    "company": "PSPI F1",
    "recoveryType": "LOCAL_TSD",
    "percentage": 5.87,
    "classification": "104",
    "remarks": "5.87% TSD"
  },
  {
    "description": "SUS 304 B",
    "company": "PSPI F3",
    "recoveryType": "LOCAL_TSD",
    "percentage": 7.48,
    "classification": "104",
    "remarks": "7.48% TSD"
  },
  {
    "description": "SUS 304 C",
    "company": "PSPI F1",
    "recoveryType": "LOCAL_TSD",
    "percentage": 5.87,
    "classification": "104",
    "remarks": "5.87% TSD"
  },
  {
    "description": "SUS 304 C",
    "company": "PSPI F3",
    "recoveryType": "LOCAL_TSD",
    "percentage": 7.48,
    "classification": "104",
    "remarks": "7.48% TSD"
  },
  {
    "description": "Stainless Turnings A",
    "company": "GLORY",
    "recoveryType": "LOCAL_TSD",
    "percentage": 3,
    "classification": "104",
    "remarks": "0.03"
  },
  {
    "description": "Stainless Turnings A",
    "company": "PSPI F1",
    "recoveryType": "LOCAL_TSD",
    "percentage": 5.87,
    "classification": "104",
    "remarks": "5.87% TSD"
  },
  {
    "description": "Stainless Turnings A",
    "company": "PSPI F3",
    "recoveryType": "LOCAL_TSD",
    "percentage": 5.87,
    "classification": "104",
    "remarks": "5.87% TSD"
  },
  {
    "description": "Stainless 304 Turnings w/ Impurities",
    "company": "GLORY",
    "recoveryType": "LOCAL_TSD",
    "percentage": 3,
    "classification": "104",
    "remarks": "0.03"
  },
  {
    "description": "Stainless 304 Turnings Reject",
    "company": "TAIYO YUDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 100,
    "classification": "104",
    "remarks": "100% tsd"
  },
  {
    "description": "Toner & Cartridges",
    "company": "SUMITRONICS",
    "recoveryType": "NON_HAZ",
    "percentage": 100,
    "classification": "M506",
    "remarks": "100% non"
  },
  {
    "description": "Transformer",
    "company": "APC",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "104",
    "remarks": "0.1"
  },
  {
    "description": "Transformer",
    "company": "BROTHER",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "104",
    "remarks": "0.1"
  },
  {
    "description": "Transformer",
    "company": "TAIYO YUDEN",
    "recoveryType": "LOCAL_TSD",
    "percentage": 10,
    "classification": "104",
    "remarks": "0.1"
  }
];

export function getUniqueDescriptions(): string[] {
  const descriptions = WASTE_RECOVERY_RULES.map(r => r.description);
  return Array.from(new Set(descriptions)).sort((a, b) => a.localeCompare(b));
}

export function getUniqueCompanies(): string[] {
  const companies = WASTE_RECOVERY_RULES.map(r => r.company);
  return Array.from(new Set(companies)).sort((a, b) => a.localeCompare(b));
}

export function getCompaniesForDescription(description: string): string[] {
  if (!description) return [];
  const filtered = WASTE_RECOVERY_RULES.filter(
    r => r.description.toLowerCase() === description.toLowerCase()
  );
  const companies = filtered.map(r => r.company);
  return Array.from(new Set(companies)).sort((a, b) => a.localeCompare(b));
}

export function getDescriptionsForCompany(company: string): string[] {
  if (!company) return [];
  const filtered = WASTE_RECOVERY_RULES.filter(
    r => r.company.toLowerCase() === company.toLowerCase()
  );
  const descriptions = filtered.map(r => r.description);
  return Array.from(new Set(descriptions)).sort((a, b) => a.localeCompare(b));
}

export function getRule(description: string, company: string): WasteRecoveryRule | undefined {
  if (!description || !company) return undefined;
  return WASTE_RECOVERY_RULES.find(
    r => r.description.toLowerCase() === description.toLowerCase() &&
         r.company.toLowerCase() === company.toLowerCase()
  );
}
