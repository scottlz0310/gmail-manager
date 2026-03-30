import { type ThemeMode, useTheme } from "../contexts/ThemeContext";

const modes: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "ライト", icon: <SunIcon /> },
  { value: "system", label: "システム", icon: <MonitorIcon /> },
  { value: "dark", label: "ダーク", icon: <MoonIcon /> },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <fieldset className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden p-0 m-0">
      <legend className="sr-only">テーマ選択</legend>
      {modes.map(({ value, label, icon }) => (
        <label
          key={value}
          title={label}
          className={`flex items-center justify-center w-8 h-8 transition-colors cursor-pointer ${
            theme === value
              ? "bg-blue-600 text-white"
              : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
        >
          <input
            type="radio"
            name="theme"
            value={value}
            aria-label={label}
            checked={theme === value}
            onChange={() => setTheme(value)}
            className="sr-only"
          />
          {icon}
        </label>
      ))}
    </fieldset>
  );
}

function SunIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <circle cx={12} cy={12} r={4} />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <rect x={2} y={3} width={20} height={14} rx={2} />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
