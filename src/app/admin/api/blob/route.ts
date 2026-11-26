import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireAdminAction } from "@/lib/admin/auth";
import {
  ALLOWED_BLOB_CONTENT_TYPES,
  MAX_BLOB_SIZE_BYTES,
  isBlobConfigured,
} from "@/lib/blog/media";

class UploadRouteError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const ALLOWED_PATH_RE = /^blog\/[a-z0-9][a-z0-9._-]*\.(webp|jpe?g|png|gif|avif)$/i;

function validateClientPayloadContentType(clientPayload: string | null): void {
  if (!clientPayload) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(clientPayload);
  } catch {
    throw new UploadRouteError(400, "Invalid upload payload.");
  }
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "contentType" in parsed &&
    typeof (parsed as { contentType?: unknown }).contentType === "string"
  ) {
    const ct = (parsed as { contentType: string }).contentType;
    if (!ALLOWED_BLOB_CONTENT_TYPES.includes(ct as (typeof ALLOWED_BLOB_CONTENT_TYPES)[number])) {
      throw new UploadRouteError(400, "Unsupported image content type.");
    }
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    await requireAdminAction("blog:write");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    if (msg === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isBlobConfigured()) {
    return NextResponse.json(
      { error: "Image uploads aren't configured." },
      { status: 503 },
    );
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        await requireAdminAction("blog:write");

        if (!pathname.startsWith("blog/") || pathname.includes("..") || !ALLOWED_PATH_RE.test(pathname)) {
          throw new UploadRouteError(400, "Invalid upload pathname.");
        }

        validateClientPayloadContentType(clientPayload);

        return {
          allowedContentTypes: [...ALLOWED_BLOB_CONTENT_TYPES],
          maximumSizeInBytes: MAX_BLOB_SIZE_BYTES,
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    if (err instanceof UploadRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : "Upload error";
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (msg === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
