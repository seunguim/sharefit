import { getSupabase } from "@/lib/supabase";

const BUCKET = "post-images";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** 올릴 수 없는 사진이면 이유를, 괜찮으면 null을 돌려줘요. */
export function checkImageFile(file: File): string | null {
  if (!EXTENSIONS[file.type]) {
    return "JPG, PNG, WEBP, GIF 사진만 올릴 수 있어요.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "사진은 5MB 이하만 올릴 수 있어요.";
  }
  return null;
}

/** 사진을 올리고, 누구나 볼 수 있는 사진 주소를 돌려줘요. (로그인 필요, 내 폴더에만 올라가요) */
export async function uploadPostImage(
  userId: string,
  file: File
): Promise<string> {
  const problem = checkImageFile(file);
  if (problem) throw new Error(problem);

  const path = `${userId}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
  const storage = getSupabase().storage.from(BUCKET);
  const { error } = await storage.upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(`사진을 올리지 못했어요. (${error.message})`);
  return storage.getPublicUrl(path).data.publicUrl;
}

/** 올려 둔 사진을 지워요. 실패해도 화면은 계속 동작하도록 오류는 무시해요. */
export async function deletePostImage(publicUrl: string): Promise<void> {
  const marker = `/${BUCKET}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return;
  const path = decodeURIComponent(publicUrl.slice(index + marker.length));
  try {
    await getSupabase().storage.from(BUCKET).remove([path]);
  } catch {
    // 지우지 못한 사진은 저장 공간에만 남고, 서비스에는 영향이 없어요.
  }
}
