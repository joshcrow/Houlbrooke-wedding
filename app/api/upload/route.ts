import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { ALLOWED_CONTENT_TYPES, MAX_FILE_BYTES } from "@/lib/config";

// The client builds the pathname, so the server must enforce its exact shape:
// media/<slug>/<filename>.<ext>, no traversal, no surprises. This also keeps
// export/zip entry names safe (prevents zip-slip on extraction).
const PATHNAME_RE =
  /^media\/[a-z0-9-]{1,40}\/[A-Za-z0-9._-]{1,80}\.[a-z0-9]{1,8}$/;

function pathnameOk(pathname: string): boolean {
  return PATHNAME_RE.test(pathname) && !pathname.includes("..");
}

// No-login uploads: guests never authenticate. This route is the gatekeeper —
// it mints a short-lived, single-use token for one upload at a time and pins
// down what's allowed (type + size). Random internet writes can't bypass it.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathnameOk(pathname)) {
          throw new Error("Invalid upload path");
        }
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_FILE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ pathname }),
        };
      },
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
