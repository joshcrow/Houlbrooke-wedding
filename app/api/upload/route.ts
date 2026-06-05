import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { ALLOWED_CONTENT_TYPES, MAX_FILE_BYTES } from "@/lib/config";

// No-login uploads: guests never authenticate. This route is the gatekeeper —
// it mints a short-lived, single-use token for one upload at a time and pins
// down what's allowed (type + size). Random internet writes can't bypass it.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => ({
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
        maximumSizeInBytes: MAX_FILE_BYTES,
        addRandomSuffix: true,
        // pathname already carries uploader folder + filename from the client.
        tokenPayload: JSON.stringify({ pathname }),
      }),
      onUploadCompleted: async () => {
        // No database in the MVP — the gallery enumerates the blob store.
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
