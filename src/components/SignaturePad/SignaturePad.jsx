import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";

const SignaturePad = forwardRef(function SignaturePad(
  {
  label = "Signature",
  height = 160,
  penColor = "#111827",
  onChange,
    showStatus = false,
    showPreview = false,
  },
  forwardedRef
) {
  const ref = useRef(null);
  const [lastEmpty, setLastEmpty] = useState(true);
  const [lastDataUrl, setLastDataUrl] = useState("");

  const getPngDataUrl = () => {
    const api = ref.current;
    if (!api) return "";
    try {
      if (api.isEmpty?.()) return "";
      const canvas = api.getCanvas ? api.getCanvas() : null;
      if (!canvas || typeof canvas.toDataURL !== "function") return "";
      return canvas.toDataURL("image/png");
    } catch {
      return "";
    }
  };

  const canvasProps = useMemo(
    () => ({
      width: 720,
      height,
      className: "w-full rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950",
      onMouseUp: () => setTimeout(emit, 0),
      onTouchEnd: () => setTimeout(emit, 0),
      onPointerUp: () => setTimeout(emit, 0),
    }),
    [height]
  );

  const emit = () => {
    const api = ref.current;
    if (!api) return;
    const dataUrl = getPngDataUrl();
    const empty = !dataUrl;
    setLastEmpty(empty);
    setLastDataUrl(dataUrl);
    onChange?.({ empty, dataUrl });
  };

  useImperativeHandle(
    forwardedRef,
    () => ({
      isEmpty: () => {
        const api = ref.current;
        return api ? api.isEmpty() : true;
      },
      getDataUrl: () => {
        return getPngDataUrl();
      },
      clear: () => {
        const api = ref.current;
        if (!api) return;
        api.clear();
        setLastEmpty(true);
        setLastDataUrl("");
        onChange?.({ empty: true, dataUrl: "" });
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange]
  );

  const clear = () => {
    const api = ref.current;
    if (!api) return;
    api.clear();
    setLastEmpty(true);
    setLastDataUrl("");
    onChange?.({ empty: true, dataUrl: "" });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
        <button
          type="button"
          onClick={clear}
          className="px-3 py-2 text-xs border border-gray-200 rounded-lg dark:border-gray-800"
        >
          Effacer
        </button>
      </div>

      <div className="mt-2">
        <SignatureCanvas
          ref={ref}
          penColor={penColor}
          minWidth={0.6}
          maxWidth={2.2}
          onEnd={() => setTimeout(emit, 0)}
          canvasProps={canvasProps}
        />
      </div>

      <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
        Signez dans la zone puis validez.
      </div>

      {showStatus ? (
        <div
          className={`mt-2 text-[11px] ${
            lastEmpty ? "text-red-600 dark:text-red-300" : "text-emerald-600 dark:text-emerald-300"
          }`}
          aria-live="polite"
        >
          {lastEmpty ? "Signature non détectée" : "Signature détectée"}
        </div>
      ) : null}

      {showPreview && !lastEmpty && lastDataUrl ? (
        <div className="mt-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">Aperçu</div>
          <div className="mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
            <img
              src={lastDataUrl}
              alt="Aperçu de la signature"
              className="block w-full"
              style={{ maxHeight: 120, objectFit: "contain" }}
              loading="eager"
              decoding="async"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
});

export default SignaturePad;
