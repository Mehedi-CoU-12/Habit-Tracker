import dayjs from "dayjs";

const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

const YEARS = [2024, 2025, 2026, 2027];

export default function MonthSelector({
    year,
    month,
    onYearChange,
    onMonthChange,
}: {
    year: number;
    month: number;
    onYearChange: (year: number) => void;
    onMonthChange: (month: number) => void;
}) {
    const monthName = MONTHS[month - 1] ?? "";
    const daysInMonth = dayjs(
        `${year}-${String(month).padStart(2, "0")}-01`,
    ).daysInMonth();
    const firstDayName = dayjs(
        `${year}-${String(month).padStart(2, "0")}-01`,
    ).format("dddd");

    return (
        <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-2">
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-1">
                        Habit Tracker
                    </p>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                        {monthName}
                    </h1>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
                        {year} · {daysInMonth} days · Week starts {firstDayName}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-0.5">
                        <label className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                            Year
                        </label>
                        <select
                            value={year}
                            onChange={(e) =>
                                onYearChange(Number(e.target.value))
                            }
                            className="cursor-pointer rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                        >
                            {YEARS.map((y) => (
                                <option key={y} value={y}>
                                    {y}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <label className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                            Month
                        </label>
                        <select
                            value={month}
                            onChange={(e) =>
                                onMonthChange(Number(e.target.value))
                            }
                            className="cursor-pointer rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                        >
                            {MONTHS.map((m, i) => (
                                <option key={m} value={i + 1}>
                                    {m}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
}
