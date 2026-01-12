import React from "react";

export default function LoadingButton({
  loading = false,
  disabled,
  children,
  className = "",
  ...props
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center gap-2 ${className} ${
        isDisabled ? "opacity-60 cursor-not-allowed" : ""
      }`}
    >
      {loading ? (
        <span className="w-4 h-4 rounded-full border-2 border-white/70 border-t-white animate-spin" />
      ) : null}
      {children}
    </button>
  );
}
