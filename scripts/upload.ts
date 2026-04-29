type UploadOptions = {
  dryRun?: boolean;
};

export async function uploadPlaysToSupabase(_options: UploadOptions = {}): Promise<void> {
  throw new Error(
    "Phase 2 placeholder: implement Supabase upload flow in scripts/upload.ts when backend sync begins.",
  );
}

void uploadPlaysToSupabase;
