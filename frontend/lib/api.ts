import { supabase } from "./supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Supabase 로그인 유저의 X-User-Id 헤더를 자동 첨부하는 fetch 래퍼 */
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (user) headers["x-user-id"] = user.id;

  return fetch(`${API_URL}${path}`, { ...options, headers });
}

/** FormData(camelCase) → API 전송용 snake_case 프로필 변환 */
export function formDataToProfile(f: Record<string, unknown>): Record<string, unknown> {
  return {
    email: f.email ?? "",
    name: f.name ?? "",
    birth_date: f.birthDate ?? "",
    phone: f.phone ?? "",
    resident_id_front: f.residentIdFront ?? "",
    resident_id_gender: f.residentIdGender ?? "",
    business_type: f.businessType ?? "",
    business_name: f.businessName ?? "",
    district: f.district ?? "",
    stage: f.stage ?? "",
    open_date: f.openDate ?? "",
    entity_type: f.entityType ?? "individual",
    has_co_owner: f.hasCoOwner ?? false,
    address: f.address ?? "",
    address_detail: f.addressDetail ?? "",
    floor_area: f.floorArea ?? "",
    tax_type: f.taxType ?? "simplified",
    has_hygiene_edu: f.hasHygieneEdu ?? false,
    selected_documents: f.selectedDocuments ?? [],
  };
}

/** API snake_case 프로필 → localStorage FormData(camelCase) 변환 */
export function profileToFormData(p: Record<string, unknown>): Record<string, unknown> {
  return {
    email: p.email ?? "",
    name: p.name ?? "",
    birthDate: p.birth_date ?? "",
    phone: p.phone ?? "",
    residentIdFront: p.resident_id_front ?? "",
    residentIdGender: p.resident_id_gender ?? "",
    businessType: p.business_type ?? "",
    businessName: p.business_name ?? "",
    district: p.district ?? "",
    stage: p.stage ?? "",
    openDate: p.open_date ?? "",
    entityType: p.entity_type ?? "individual",
    hasCoOwner: p.has_co_owner ?? false,
    address: p.address ?? "",
    addressDetail: p.address_detail ?? "",
    floorArea: p.floor_area ?? "",
    taxType: p.tax_type ?? "simplified",
    hasHygieneEdu: p.has_hygiene_edu ?? false,
    selectedDocuments: p.selected_documents ?? [],
  };
}
