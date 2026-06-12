import {
  FaFileAudio,
  FaFileCode,
  FaFileCsv,
  FaFileExcel,
  FaFileImage,
  FaFileLines,
  FaFilePdf,
  FaFilePowerpoint,
  FaFileVideo,
  FaFileWord,
  FaFileZipper,
} from "react-icons/fa6";

const FILE_GROUPS = {
  pdf: {
    extensions: ["pdf"],
    Icon: FaFilePdf,
    className: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300",
  },
  image: {
    extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tif", "tiff", "heic"],
    Icon: FaFileImage,
    className: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300",
  },
  word: {
    extensions: ["doc", "docx", "odt", "rtf"],
    Icon: FaFileWord,
    className: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  },
  excel: {
    extensions: ["xls", "xlsx", "ods"],
    Icon: FaFileExcel,
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
  csv: {
    extensions: ["csv"],
    Icon: FaFileCsv,
    className: "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300",
  },
  powerpoint: {
    extensions: ["ppt", "pptx", "odp"],
    Icon: FaFilePowerpoint,
    className: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300",
  },
  archive: {
    extensions: ["zip", "rar", "7z", "tar", "gz"],
    Icon: FaFileZipper,
    className: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  },
  audio: {
    extensions: ["mp3", "wav", "ogg", "m4a", "aac"],
    Icon: FaFileAudio,
    className: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
  },
  video: {
    extensions: ["mp4", "mov", "avi", "mkv", "webm"],
    Icon: FaFileVideo,
    className: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-500/10 dark:text-fuchsia-300",
  },
  code: {
    extensions: ["json", "xml", "html", "css", "js", "jsx", "ts", "tsx"],
    Icon: FaFileCode,
    className: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300",
  },
};

const DEFAULT_GROUP = {
  Icon: FaFileLines,
  className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
};

function cleanExtension(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .split(/[?#]/)[0];

  if (!normalized) return "";
  if (normalized.includes("/")) return normalized.split("/").pop().replace(/^\./, "");

  const fileName = normalized.split(/[\\/]/).pop();
  const dotIndex = fileName.lastIndexOf(".");
  return (dotIndex >= 0 ? fileName.slice(dotIndex + 1) : fileName).replace(/^\./, "");
}

function getFileExtension({ fileName, format, url }) {
  return cleanExtension(fileName) || cleanExtension(format) || cleanExtension(url);
}

export default function DocumentFileIcon({ fileName, format, url }) {
  const extension = getFileExtension({ fileName, format, url });
  const group =
    Object.values(FILE_GROUPS).find(({ extensions }) => extensions.includes(extension)) || DEFAULT_GROUP;
  const { Icon, className } = group;
  const label = extension ? extension.slice(0, 5).toUpperCase() : "FILE";

  return (
    <span
      className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${className}`}
      title={`Fichier ${label}`}
      aria-hidden="true"
    >
      <Icon className="text-2xl" />
      <span className="absolute -bottom-1 rounded bg-current px-1.5 py-0.5 text-[8px] font-bold leading-none">
        <span className="text-white dark:text-gray-950">{label}</span>
      </span>
    </span>
  );
}
