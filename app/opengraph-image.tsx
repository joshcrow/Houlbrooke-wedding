import { ImageResponse } from "next/og";
import { COUPLE } from "@/lib/config";

// Branded link preview when the page is shared (Messages, WhatsApp, etc.).
export const alt = `${COUPLE.names} ${COUPLE.lastName} — Share Your Photos`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FBF7EC",
          color: "#3E5C8A",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ fontSize: 110, fontWeight: 600 }}>{COUPLE.names}</div>
        <div style={{ fontSize: 44, color: "#6E89B7", marginTop: 8 }}>
          {`${COUPLE.lastName} · ${COUPLE.year}`}
        </div>
        <div style={{ fontSize: 40, color: "#34435E", marginTop: 28 }}>
          Share your photos
        </div>
      </div>
    ),
    size,
  );
}
