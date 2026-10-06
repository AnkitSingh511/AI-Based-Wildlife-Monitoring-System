import { getSpeciesIcon } from "../../utils/speciesIcons";

/**
 * BoundingBoxOverlay
 * Renders precision responsive bounding boxes and species tags over live camera or captured photo.
 */
export default function BoundingBoxOverlay({
  boxes = [],
  imageWidth = 640,
  imageHeight = 480,
  className = "",
}) {
  if (!boxes || boxes.length === 0 || !imageWidth || !imageHeight) {
    return null;
  }

  return (
    <div
      className={`position-absolute top-0 start-0 w-100 h-100 pointer-events-none ${className}`}
      style={{ pointerEvents: "none", zIndex: 10 }}
    >
      {boxes.map((item, idx) => {
        // Support both [x1, y1, x2, y2] array and {x1, y1, x2, y2} object formats
        let x1;
        let y1;
        let x2;
        let y2;

        if (Array.isArray(item.box) && item.box.length === 4) {
          [x1, y1, x2, y2] = item.box;
        } else if (item.bounding_box) {
          x1 = item.bounding_box.x1;
          y1 = item.bounding_box.y1;
          x2 = item.bounding_box.x2;
          y2 = item.bounding_box.y2;
        } else if (item.box && typeof item.box === "object") {
          x1 = item.box.x1 || 0;
          y1 = item.box.y1 || 0;
          x2 = item.box.x2 || 0;
          y2 = item.box.y2 || 0;
        } else {
          return null;
        }

        // Clamp coordinates to image boundaries
        const left = Math.max(0, Math.min(100, (x1 / imageWidth) * 100));
        const top = Math.max(0, Math.min(100, (y1 / imageHeight) * 100));
        const width = Math.max(2, Math.min(100 - left, ((x2 - x1) / imageWidth) * 100));
        const height = Math.max(2, Math.min(100 - top, ((y2 - y1) / imageHeight) * 100));

        const confPct = Math.round((item.confidence || 0) * 100);
        const icon = getSpeciesIcon(item.species);

        return (
          <div
            key={idx}
            className="position-absolute transition-all"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${width}%`,
              height: `${height}%`,
              border: "2px solid #10b981",
              boxShadow: "0 0 16px rgba(16, 185, 129, 0.45), inset 0 0 8px rgba(16, 185, 129, 0.15)",
              borderRadius: "4px",
              boxSizing: "border-box",
              transition: "all 0.15s ease-out",
            }}
          >
            {/* Corner Target Markers */}
            <span
              style={{
                position: "absolute",
                top: "-3px",
                left: "-3px",
                width: "8px",
                height: "8px",
                borderTop: "3px solid #34d399",
                borderLeft: "3px solid #34d399",
              }}
            />
            <span
              style={{
                position: "absolute",
                top: "-3px",
                right: "-3px",
                width: "8px",
                height: "8px",
                borderTop: "3px solid #34d399",
                borderRight: "3px solid #34d399",
              }}
            />
            <span
              style={{
                position: "absolute",
                bottom: "-3px",
                left: "-3px",
                width: "8px",
                height: "8px",
                borderBottom: "3px solid #34d399",
                borderLeft: "3px solid #34d399",
              }}
            />
            <span
              style={{
                position: "absolute",
                bottom: "-3px",
                right: "-3px",
                width: "8px",
                height: "8px",
                borderBottom: "3px solid #34d399",
                borderRight: "3px solid #34d399",
              }}
            />

            {/* Species Badge Pill */}
            <div
              className="position-absolute d-inline-flex align-items-center gap-1 px-2 py-1 shadow-sm"
              style={{
                top: "-26px",
                left: "-2px",
                backgroundColor: "#064e3b",
                color: "#ecfdf5",
                border: "1px solid #10b981",
                borderRadius: "4px",
                fontSize: "0.74rem",
                fontWeight: "700",
                whiteSpace: "nowrap",
                letterSpacing: "0.02em",
                zIndex: 2,
              }}
            >
              <span>{icon}</span>
              <span>{item.species}</span>
              <span
                style={{
                  color: "#6ee7b7",
                  fontSize: "0.68rem",
                  marginLeft: "2px",
                  fontWeight: "600",
                }}
              >
                {confPct}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
