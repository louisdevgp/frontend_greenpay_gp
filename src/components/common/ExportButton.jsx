import React, { useState } from "react";
import { FiDownload } from "react-icons/fi";
import LoadingButton from "./LoadingButton";

export default function ExportButton({
  onExport,
  disabled = false,
  label = "Exporter",
  title = "Exporter Excel",
  ariaLabel = "Exporter Excel",
  className = "",
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    if (disabled || loading) return;
    setLoading(true);
    setTimeout(async () => {
      try {
        await Promise.resolve(onExport?.());
      } finally {
        setLoading(false);
      }
    }, 0);
  };

  return (
    <LoadingButton
      type="button"
      onClick={handleClick}
      loading={loading}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={className}
    >
      {loading ? null : <FiDownload />}
      {label}
    </LoadingButton>
  );
}
