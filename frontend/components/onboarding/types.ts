export type BusinessType = "cafe" | "bakery" | "bunsik";
export type Stage = "planning" | "contracted" | "preparing";
export type EntityType = "individual" | "corporation";
export type TaxType = "simplified" | "general";
export type DocumentType =
  | "business-registration"
  | "food-business-license"
  | "location-analysis"
  | "subsidy-application"
  | "employment-contract"
  | "lease-contract";

export interface FormData {
  // Step 1
  name: string;
  birthDate: string;
  phone: string;
  email: string;
  residentIdFront: string;
  residentIdGender: string;

  // Step 2
  businessType: BusinessType | "";
  businessName: string;
  district: string;
  stage: Stage | "";
  openDate: string;
  entityType: EntityType;
  hasCoOwner: boolean;

  // Step 3
  address: string;
  addressDetail: string;
  floorArea: string;
  taxType: TaxType;
  hasHygieneEdu: boolean;

  // Step 4
  selectedDocuments: DocumentType[];
}

export const initialFormData: FormData = {
  name: "",
  birthDate: "",
  phone: "",
  email: "",
  residentIdFront: "",
  residentIdGender: "",
  businessType: "",
  businessName: "",
  district: "",
  stage: "",
  openDate: "",
  entityType: "individual",
  hasCoOwner: false,
  address: "",
  addressDetail: "",
  floorArea: "",
  taxType: "simplified",
  hasHygieneEdu: false,
  selectedDocuments: [],
};
