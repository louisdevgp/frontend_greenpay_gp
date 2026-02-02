import { useEffect, useId, useRef } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import Label from "./Label";
import { CalenderIcon } from "../../icons";
import Hook = flatpickr.Options.Hook;
import DateOption = flatpickr.Options.DateOption;

type PropsType = {
  id?: string;
  mode?: "single" | "multiple" | "range" | "time";
  onChange?: Hook | Hook[] | ((date: Date | null, dateStr?: string) => void);
  defaultDate?: DateOption;
  value?: DateOption | null;
  dateFormat?: string;
  options?: flatpickr.Options.Options;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export default function DatePicker({
  id,
  mode,
  onChange,
  label,
  defaultDate,
  value,
  dateFormat,
  options,
  placeholder,
  className,
  disabled,
}: PropsType) {
  const fallbackId = useId();
  const inputId = id || `date-picker-${fallbackId}`;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pickerRef = useRef<flatpickr.Instance | null>(null);
  const onChangeRef = useRef<PropsType["onChange"]>(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!inputRef.current) return undefined;

    if (pickerRef.current) {
      pickerRef.current.destroy();
      pickerRef.current = null;
    }

    const mergedOptions = { allowInput: false, ...(options || {}) };
    const flatPickr = flatpickr(inputRef.current, {
      mode: mode || "single",
      static: true,
      monthSelectorType: "static",
      dateFormat: dateFormat || "Y-m-d",
      defaultDate,
      onChange: (selectedDates, dateStr, instance) => {
        const handler = onChangeRef.current;
        if (!handler) return;
        if (Array.isArray(handler)) {
          handler.forEach((fn) => fn(selectedDates, dateStr, instance));
          return;
        }
        if (typeof handler === "function") {
          if (handler.length >= 3) {
            (handler as Hook)(selectedDates, dateStr, instance);
            return;
          }
          (handler as (date: Date | null, dateStr?: string) => void)(
            selectedDates?.[0] ?? null,
            dateStr
          );
        }
      },
      ...mergedOptions,
    });
    pickerRef.current = flatPickr;

    return () => {
      flatPickr.destroy();
      if (pickerRef.current === flatPickr) pickerRef.current = null;
    };
  }, [mode, inputId, defaultDate, dateFormat, options]);

  useEffect(() => {
    if (!pickerRef.current) return;
    if (value === undefined) return;
    if (value === null || value === "") {
      if (pickerRef.current.input.value) pickerRef.current.clear();
      return;
    }
    const next = value instanceof Date ? value : new Date(value as string);
    const current = pickerRef.current.selectedDates?.[0];
    if (current && Number.isFinite(current.getTime()) && Number.isFinite(next.getTime())) {
      if (current.getTime() === next.getTime()) return;
    }
    pickerRef.current.setDate(value, false);
  }, [value]);

  return (
    <div>
      {label && <Label htmlFor={inputId}>{label}</Label>}

      <div className="relative">
        <input
          id={inputId}
          ref={inputRef}
          placeholder={placeholder}
          disabled={disabled}
          className={`h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:focus:border-brand-800 ${className || ""}`}
        />

        <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
          <CalenderIcon className="size-6" />
        </span>
      </div>
    </div>
  );
}
