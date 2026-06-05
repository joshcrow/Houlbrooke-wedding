import { ImageResponse } from "next/og";

// A tiny camera in the wedding palette (dusty blue / cream / lemon).
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#3E5C8A",
          borderRadius: 16,
        }}
      >
        <div
          style={{
            width: 44,
            height: 32,
            background: "#FBF7EC",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 9,
              background: "#F2D06B",
              border: "3px solid #6E89B7",
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
